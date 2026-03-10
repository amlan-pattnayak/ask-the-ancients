/**
 * /api/chat/stream
 *
 * Streaming inference endpoint for BYOK mode.
 * Handles: RAG retrieval, AI streaming, client returns result to Convex.
 *
 * Guest mode continues to use the Convex scheduled-action path (which
 * includes full RAG + citations but is non-streaming).
 */

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api, type Id } from "@/lib/convex";
import { buildSystemPrompt } from "@/lib/build-system-prompt";
import { detectCrisis, CRISIS_RESPONSE } from "@/lib/safety";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrincipalType = "anon" | "user";
type DetectedProvider = "groq" | "anthropic" | "openrouter" | "openai-compat";

interface StreamRequest {
  threadId: string;
  content: string;
  anonId?: string; // present when signed out
  byokKey: string;
  byokModel?: string;
  byokEndpoint?: string;
}

// ─── Provider detection (mirrors convex/chat.ts) ──────────────────────────────

function detectProvider(key: string, customEndpoint?: string): DetectedProvider {
  if (customEndpoint) return "openai-compat";
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  return "openai-compat";
}

const PROVIDER_ENDPOINTS: Record<DetectedProvider, string> = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  anthropic: "https://api.anthropic.com/v1",
  "openai-compat": "https://api.openai.com/v1",
};

const PROVIDER_DEFAULT_MODELS: Record<DetectedProvider, string> = {
  groq: "llama-3.3-70b-versatile",
  openrouter: "anthropic/claude-3-5-haiku",
  anthropic: "claude-3-5-haiku-20241022",
  "openai-compat": "gpt-4o-mini",
};

// ─── SSE → text stream parsers ────────────────────────────────────────────────

function parseOpenAIChunk(line: string): string {
  if (!line.startsWith("data: ")) return "";
  const data = line.slice(6).trim();
  if (data === "[DONE]") return "";
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string | null } }>;
      error?: { message?: string };
    };
    // OpenRouter / some providers embed errors in SSE data lines.
    if (json.error?.message) throw new Error(json.error.message);
    // `content` may be null during reasoning-model thinking phase — skip those chunks.
    return json.choices?.[0]?.delta?.content ?? "";
  } catch (err) {
    if (err instanceof SyntaxError) return "";
    throw err; // re-throw provider errors so they surface to the user
  }
}

function parseAnthropicChunk(line: string): string {
  if (!line.startsWith("data: ")) return "";
  const data = line.slice(6).trim();
  try {
    const json = JSON.parse(data) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (json.type === "content_block_delta" && json.delta?.type === "text_delta") {
      return json.delta.text ?? "";
    }
  } catch {
    /* ignore malformed lines */
  }
  return "";
}

// ─── Citation sentinel ────────────────────────────────────────────────────────
// We embed citations at the END of the stream body to avoid header-encoding
// issues (non-ASCII chars in passage text / chapter refs). The STX control
// character (U+0002) cannot appear in normal LLM output, making it a safe
// delimiter. Client detects it, strips everything from STX onward, and stores
// the citation JSON.
const CITATION_SENTINEL = "\u0002";

// ─── Streaming fetch helpers ──────────────────────────────────────────────────

async function streamOpenAICompat(
  messages: Array<{ role: string; content: string }>,
  key: string,
  baseUrl: string,
  model: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  const encoder = new TextEncoder();
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...(baseUrl.includes("openrouter") && {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000",
        "X-Title": "Ask the Ancients",
      }),
    },
    body: JSON.stringify({ model, messages, stream: true, max_tokens: 2048, temperature: 0.7 }),
  });

  if (!res.ok) {
    throw new Error(`Provider returned ${res.status}. Check your API key and model settings.`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      // Detect HTTP-200 error bodies that some providers (e.g. OpenRouter)
      // embed inside the SSE stream as a non-data JSON object.
      if (line.startsWith("{") && line.includes('"error"')) {
        try {
          const errObj = JSON.parse(line) as { error?: { message?: string } };
          if (errObj.error?.message) throw new Error(errObj.error.message);
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) { /* not JSON, ignore */ } else throw parseErr;
        }
      }
      const chunk = parseOpenAIChunk(line);
      if (chunk) controller.enqueue(encoder.encode(chunk));
    }
  }
}

async function streamAnthropic(
  messages: Array<{ role: string; content: string }>,
  key: string,
  model: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<void> {
  const encoder = new TextEncoder();
  const systemMsg = messages.find((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true", // for CORS
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: true,
      ...(systemMsg && { system: systemMsg.content }),
      messages: conversation,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic returned ${res.status}. Check your API key and model settings.`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const chunk = parseAnthropicChunk(line);
      if (chunk) controller.enqueue(encoder.encode(chunk));
    }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * Redact any string that looks like an API key from error messages / logs.
 * Keys follow patterns: sk-*, gsk_*, sk-ant-*, sk-or-*.
 */
function redactKey(value: string): string {
  return value.replace(/\b(sk-[A-Za-z0-9_-]{10,}|gsk_[A-Za-z0-9_]{10,})/g, "[REDACTED]");
}

export async function POST(req: Request) {
  // 1. Auth — determine caller identity
  const { userId } = await auth();
  const body = (await req.json()) as StreamRequest;
  // Destructure separately so byokKey is never accidentally spread into logs.
  const { threadId, content, anonId, byokModel, byokEndpoint } = body;
  const byokKey: string | undefined = body.byokKey;

  let principalType: PrincipalType;
  let principalId: string;

  if (userId) {
    principalType = "user";
    principalId = userId;
  } else if (anonId) {
    principalType = "anon";
    principalId = anonId;
  } else {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!byokKey) {
    return new Response("BYOK key required", { status: 400 });
  }

  if (principalType === "anon") {
    return new Response("Sign in to use your own API key", { status: 403 });
  }

  // 2. Crisis pre-flight — short-circuit before any LLM call.
  //    Returns a plain-text stream so the client handles it identically to a
  //    normal response (no special UI path needed).
  if (detectCrisis(content)) {
    const encoder = new TextEncoder();
    const safeStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(CRISIS_RESPONSE));
        controller.close();
      },
    });
    return new Response(safeStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  // 3. Convex HTTP client — use the client-provided Convex JWT (already cached client-side)
  //    so we avoid a server-side Clerk API call on every request.
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (userId) {
    const authHeader = req.headers.get("Authorization");
    const convexToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (convexToken) convex.setAuth(convexToken);
  }

  // 4. Fetch thread, philosophers, and message history in parallel to reduce pre-flight latency.
  const [thread, philosophers, allMessages] = await Promise.all([
    convex.query(api.threads.getById, {
      threadId: threadId as Id<"threads">,
      principalType,
      principalId,
    }),
    convex.query(api.philosophers.listActive, {}),
    convex.query(api.messages.listByThread, {
      threadId: threadId as Id<"threads">,
      principalType,
      principalId,
    }),
  ]);

  if (!thread) {
    return new Response("Thread not found or access denied", { status: 404 });
  }

  const phil = philosophers.find((p) => p._id === thread.philosopherId);
  if (!phil) {
    return new Response("Philosopher not found", { status: 404 });
  }

  const history = allMessages.slice(-10).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // 5. RAG retrieval (needs thread.philosopherId — runs after thread is resolved)
  let passages: Array<{ sourceTextId: string; workTitle: string; chapterRef: string; content: string }> = [];
  try {
    passages = await convex.action(api.rag.retrievePassages, {
      query: content,
      philosopherId: thread.philosopherId,
      topK: 6,
    });
  } catch {
    console.warn("[stream] RAG retrieval failed, proceeding without passages.");
  }

  // 6. Build system prompt
  const systemPrompt = buildSystemPrompt(phil.systemPrompt, passages);
  const llmMessages = [
    { role: "system" as const, content: systemPrompt },
    ...history,
  ];

  // 7. Stream from AI provider
  const provider = detectProvider(byokKey, byokEndpoint);
  const baseUrl = byokEndpoint ?? PROVIDER_ENDPOINTS[provider];
  const model = byokModel ?? PROVIDER_DEFAULT_MODELS[provider];

  // Build citation JSON once (before streaming starts) so it's ready to append.
  const citationObjects = passages.map((p) => ({
    workTitle: p.workTitle,
    chapterRef: p.chapterRef,
    passage: p.content,
    sourceTextId: p.sourceTextId,
  }));
  // Base64-encode so non-ASCII chars (§, smart quotes, em-dashes) survive
  // the stream without any encoding ambiguity.
  const citationsB64 = passages.length > 0
    ? Buffer.from(JSON.stringify(citationObjects), "utf-8").toString("base64")
    : "";

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (provider === "anthropic") {
          await streamAnthropic(llmMessages, byokKey, model, controller);
        } else {
          await streamOpenAICompat(llmMessages, byokKey, baseUrl, model, controller);
        }
        // Append citation data as a sentinel-delimited final chunk.
        // STX (U+0002) is the sentinel; base64 payload follows immediately.
        if (citationsB64) {
          controller.enqueue(encoder.encode(`${CITATION_SENTINEL}${citationsB64}`));
        }
      } catch (err) {
        // Redact any key material that might appear in error messages.
        const raw = err instanceof Error ? err.message : "Inference failed.";
        const msg = redactKey(raw);
        controller.enqueue(encoder.encode(`\n\n⚠ ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
