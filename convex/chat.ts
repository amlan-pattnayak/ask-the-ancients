import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal, api } from "./_generated/api";
import { buildSystemPrompt } from "./prompts";
import type { Id } from "./_generated/dataModel";

// ─── Provider detection ───────────────────────────────────────────────────────

type DetectedProvider = "groq" | "anthropic" | "openrouter" | "openai-compat";

function detectProvider(key: string, customEndpoint?: string): DetectedProvider {
  if (customEndpoint) return "openai-compat"; // custom endpoint → treat as OpenAI-compatible
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  return "openai-compat"; // default: treat as OpenAI-compatible (covers OpenAI, etc.)
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

// ─── OpenAI-compatible inference ─────────────────────────────────────────────

async function callOpenAICompatible(
  messages: Array<{ role: string; content: string }>,
  key: string,
  baseUrl: string,
  model: string,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      // OpenRouter requires a site URL/title header
      ...(baseUrl.includes("openrouter") && {
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://localhost:3000",
        "X-Title": "Ask the Ancients",
      }),
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    // Do not include the response body in the error — it may echo the key
    throw new Error(`Provider returned ${res.status}. Check your API key and model settings.`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content?: string | null; reasoning_content?: string } }>;
    error?: { message: string };
  };

  // Some providers (e.g. OpenRouter) return HTTP 200 with an error body.
  if (data.error?.message) {
    throw new Error(data.error.message);
  }

  const choice = data.choices[0]?.message;
  // Reasoning models (DeepSeek R1, Kimi K2, etc.) put the final answer in
  // `content` and chain-of-thought in `reasoning_content`. We only want content.
  return choice?.content ?? "I was unable to formulate a response.";
}

// ─── Anthropic Messages API ───────────────────────────────────────────────────
// Anthropic uses a different API format than OpenAI — system message is
// a top-level field, not part of the messages array.

async function callAnthropic(
  messages: Array<{ role: string; content: string }>,
  key: string,
  model: string,
): Promise<string> {
  // Extract system message from the front of the array
  const systemMsg = messages.find((m) => m.role === "system");
  const conversation = messages.filter((m) => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 350,
      ...(systemMsg && { system: systemMsg.content }),
      messages: conversation,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic returned ${res.status}. Check your API key and model settings.`);
  }

  const data = await res.json() as {
    content: Array<{ type: string; text: string }>;
  };
  return data.content.find((c) => c.type === "text")?.text ?? "I was unable to formulate a response.";
}

// ─── BYOK dispatcher ─────────────────────────────────────────────────────────

async function callByokProvider(
  messages: Array<{ role: string; content: string }>,
  byokKey: string,
  byokModel?: string,
  byokEndpoint?: string,
): Promise<string> {
  const provider = detectProvider(byokKey, byokEndpoint);

  if (provider === "anthropic") {
    const model = byokModel ?? PROVIDER_DEFAULT_MODELS.anthropic;
    return callAnthropic(messages, byokKey, model);
  }

  const baseUrl = byokEndpoint ?? PROVIDER_ENDPOINTS[provider];
  const model = byokModel ?? PROVIDER_DEFAULT_MODELS[provider];
  return callOpenAICompatible(messages, byokKey, baseUrl, model);
}

// ─── Guest Groq inference ─────────────────────────────────────────────────────

async function callGuestGroq(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Guest inference is not configured (GROQ_API_KEY missing).");

  return callOpenAICompatible(
    messages,
    key,
    PROVIDER_ENDPOINTS.groq,
    "llama-3.3-70b-versatile",
  );
}

// ─── Crisis pre-flight ────────────────────────────────────────────────────────
// Mirrors src/lib/safety.ts — kept in sync manually since Convex cannot import
// from the Next.js src/ tree.

const CRISIS_PHRASES = [
  "kill myself",
  "killing myself",
  "end my life",
  "ending my life",
  "take my life",
  "want to die",
  "going to die by suicide",
  "commit suicide",
  "committing suicide",
  "suicidal",
  "i want to be dead",
  "don't want to be alive",
  "don't want to live",
  "no reason to live",
  "not worth living",
  "life isn't worth living",
  "life is not worth living",
  "hurt myself",
  "hurting myself",
  "self-harm",
  "self harm",
] as const;

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_PHRASES.some((phrase) => lower.includes(phrase));
}

const CRISIS_RESPONSE = `I'm stepping outside my role for a moment because what you've shared is important.

If you're having thoughts of suicide or self-harm, please reach out for support right now:

United States — 988 Suicide & Crisis Lifeline: call or text 988. Crisis Text Line: text HOME to 741741.

India — iCall (TISS): 9152987821 (Mon–Sat, 8 am–10 pm IST). Vandrevala Foundation: 1860-2662-345 (24/7).

United Kingdom — Samaritans: 116 123 (free, 24/7).

Australia — Lifeline: 13 11 14 (24/7).

Canada — Crisis Services Canada: 1-833-456-4566 (24/7).

For all other countries, find your local helpline at https://www.iasp.info/resources/Crisis_Centres/

You don't have to face this alone. These lines are free and confidential.

If you're in immediate danger, please call your local emergency services.`;

// ─── processMessage ───────────────────────────────────────────────────────────

export const processMessage = internalAction({
  args: {
    threadId: v.id("threads"),
    userMessageId: v.id("messages"),
    principalType: v.union(v.literal("anon"), v.literal("user")),
    principalId: v.string(),
    userContent: v.string(),
    // BYOK — optional, undefined means guest mode
    byokKey: v.optional(v.string()),
    byokModel: v.optional(v.string()),
    byokEndpoint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const isByok = Boolean(args.byokKey);

    // 1. Crisis pre-flight — always runs, bypasses rate limit and LLM entirely.
    //    Returns a canned safe response immediately; does not consume rate quota.
    if (detectCrisis(args.userContent)) {
      await ctx.runMutation(internal.messages.storeAssistantMessage, {
        threadId: args.threadId,
        principalType: args.principalType,
        principalId: args.principalId,
        content: CRISIS_RESPONSE,
        citations: [],
      });
      return;
    }

    // 2. Rate limit — guest mode only; BYOK users use their own quota
    if (!isByok) {
      // Guest kill switch — ops safety valve
      const guestEnabled = (process.env.GUEST_MODE_ENABLED ?? "true") !== "false";
      if (!guestEnabled) {
        await ctx.runMutation(internal.messages.storeAssistantMessage, {
          threadId: args.threadId,
          principalType: args.principalType,
          principalId: args.principalId,
          content:
            "Guest inference is temporarily unavailable. Please add your own API key in Settings to continue.",
          citations: [],
        });
        return;
      }

      const rateCheck = await ctx.runMutation(internal.rateLimit.consume, {
        principalType: args.principalType,
        principalId: args.principalId,
      });

      if (!rateCheck.allowed) {
        const isBurst = "reason" in rateCheck && rateCheck.reason === "burst";
        await ctx.runMutation(internal.messages.storeAssistantMessage, {
          threadId: args.threadId,
          principalType: args.principalType,
          principalId: args.principalId,
          content: isBurst
            ? "Please wait a moment before sending another message."
            : "You have reached your daily message limit. Return tomorrow, sign in for a higher allowance, or bring your own API key in Settings.",
          citations: [],
        });
        return;
      }
    }

    // 2. Get thread and philosopher
    // Use internal queries — internalActions have no user auth context, so public
    // queries with assertPrincipalAccess would always throw for signed-in users.
    // Ownership is verified structurally (principalType + principalId match).
    const thread = await ctx.runQuery(internal.threads.getByIdInternal, {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
    });
    if (!thread) throw new Error("Thread not found");

    const philosophers = await ctx.runQuery(api.philosophers.listActive, {});
    const phil = philosophers.find((p) => p._id === thread.philosopherId);
    if (!phil) throw new Error("Philosopher not found");

    // 3. Conversation history (last 10 messages for context)
    const allMessages = await ctx.runQuery(internal.messages.listByThreadInternal, {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
    });
    const history = allMessages.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 4. RAG retrieval
    let passages: Array<{
      sourceTextId: Id<"sourceTexts">;
      workTitle: string;
      chapterRef: string;
      content: string;
      score: number;
    }> = [];
    try {
      passages = await ctx.runAction(api.rag.retrievePassages, {
        query: args.userContent,
        philosopherId: thread.philosopherId,
        topK: 6,
      });
    } catch {
      console.warn("RAG retrieval failed, proceeding without passages.");
    }

    // 5. Build system prompt
    const systemPrompt = buildSystemPrompt(phil.systemPrompt, passages);
    const llmMessages = [
      { role: "system" as const, content: systemPrompt },
      ...history,
    ];

    // 6. Inference — BYOK or guest Groq
    let assistantContent: string;
    const inferenceStartedAt = Date.now();
    try {
      if (isByok && args.byokKey) {
        assistantContent = await callByokProvider(
          llmMessages,
          args.byokKey,
          args.byokModel,
          args.byokEndpoint,
        );
      } else {
        assistantContent = await callGuestGroq(llmMessages);
      }
    } catch (err) {
      // Surface a clean error message — never echo key material
      const message = err instanceof Error ? err.message : "Inference failed.";
      try {
        await ctx.runMutation(api.analytics.trackEvent, {
          eventId: crypto.randomUUID(),
          schemaVersion: 1,
          eventName: "assistant_response_failed",
          principalType: args.principalType,
          principalId: args.principalId,
          timestamp: Date.now(),
          source: "server",
          properties: {
            threadId: args.threadId,
            philosopherId: thread.philosopherId,
            philosopherSlug: phil.slug,
            mode: isByok ? "byok" : "guest",
            failureClass: "provider_error",
          },
        });
      } catch {
        // Analytics failures should never block user-facing responses.
      }
      await ctx.runMutation(internal.messages.storeAssistantMessage, {
        threadId: args.threadId,
        principalType: args.principalType,
        principalId: args.principalId,
        content: `⚠ ${message}`,
        citations: [],
      });
      return;
    }

    // 7. Build citations from positional [CIT:Px] markers in the LLM response.
    // Mirrors src/lib/prompt-validators.ts — keep in sync.
    // Models naturally cite as [P1], [P2], or group them as [CIT:P1, P2].
    // Also accept the legacy [CIT:P1] form so old sessions continue to work.
    // Captures everything inside the brackets so multi-citation groups are handled.
    const CITATION_RE = /\[(?:CIT:)?([Pp]\d+(?:[,;\s]+(?:CIT:)?[Pp]\d+)*)\]/g;

    function extractCitationIds(text: string): string[] {
      const ids: string[] = [];
      for (const match of text.matchAll(CITATION_RE)) {
        for (const part of match[1].split(/[,;\s]+/)) {
          const id = part.replace(/^CIT:/i, "").toUpperCase();
          if (/^P\d+$/.test(id)) ids.push(id);
        }
      }
      return ids;
    }

    // Replace [P1] / [CIT:P1] / [CIT:P1, P2] with bracketed inline references like
    // [*Meditations · Book XII, §XXXII*]. Brackets make citations visually distinct
    // from surrounding prose; italics mark them as source references.
    function resolveCitationMarkers(text: string): string {
      return text
        .replace(CITATION_RE, (_match, group) => {
          const refs = group.split(/[,;\s]+/).flatMap((part: string) => {
            const id = part.replace(/^CIT:/i, "").toUpperCase();
            const m = id.match(/^P(\d+)$/);
            if (!m) return [];
            const p = passages[parseInt(m[1], 10) - 1];
            if (!p) return [];
            const ref = [p.workTitle, p.chapterRef].filter(Boolean).join(" · ");
            return ref ? [`[*${ref}*]`] : [];
          });
          return refs.join(" ");
        })
        .replace(/  +/g, " ")
        .trim();
    }

    const usedIds = Array.from(new Set(extractCitationIds(assistantContent)));
    const citations = usedIds.map((id) => {
      const match = id.match(/^P(\d+)$/); // already uppercased above
      if (!match) return null;
      const p = passages[parseInt(match[1], 10) - 1];
      if (!p) return null;
      return { workTitle: p.workTitle, chapterRef: p.chapterRef, passage: p.content, sourceTextId: p.sourceTextId };
    }).filter((c): c is NonNullable<typeof c> => c !== null);

    const cleanContent = resolveCitationMarkers(assistantContent);

    // 8. Store assistant message
    await ctx.runMutation(internal.messages.storeAssistantMessage, {
      threadId: args.threadId,
      principalType: args.principalType,
      principalId: args.principalId,
      content: cleanContent,
      citations,
    });

    try {
      await ctx.runMutation(api.analytics.trackEvent, {
        eventId: crypto.randomUUID(),
        schemaVersion: 1,
        eventName: "assistant_response_received",
        principalType: args.principalType,
        principalId: args.principalId,
        timestamp: Date.now(),
        source: "server",
        properties: {
          threadId: args.threadId,
          messageId: args.userMessageId,
          philosopherId: thread.philosopherId,
          philosopherSlug: phil.slug,
          mode: isByok ? "byok" : "guest",
          latencyMs: Date.now() - inferenceStartedAt,
          citationCount: citations.length,
          responseLength: cleanContent.length,
          crisisDetected: false,
        },
      });
    } catch {
      // Analytics failures should never block user-facing responses.
    }
  },
});
