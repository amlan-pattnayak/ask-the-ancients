import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/lib/convex";
import {
  DIFFERENCE_SUMMARIZER_SYSTEM_PROMPT,
  buildDifferenceSummarizerInput,
} from "@/lib/prompt-spec";
import { validateDifferenceSummary } from "@/lib/prompt-validators";

type DetectedProvider = "groq" | "anthropic" | "openrouter" | "openai-compat";
type SummarizeMode = "guest" | "byok";

interface SummarizeRequest {
  question: string;
  philosopherAName: string;
  answerA: string;
  philosopherBName: string;
  answerB: string;
  mode?: SummarizeMode;
  byokKey?: string;
  byokModel?: string;
  byokEndpoint?: string;
  principalId?: string;
}

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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

async function callOpenAICompatible(
  messages: ChatMessage[],
  key: string,
  baseUrl: string,
  model: string,
): Promise<string> {
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
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 300,
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    throw new Error(`Provider returned ${res.status}. Check model and API key.`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  messages: ChatMessage[],
  key: string,
  model: string,
): Promise<string> {
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
      max_tokens: 300,
      ...(systemMsg && { system: systemMsg.content }),
      messages: conversation,
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic returned ${res.status}. Check model and API key.`);
  }

  const data = await res.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return data.content?.find((entry) => entry.type === "text")?.text ?? "";
}

async function inferAnswer(
  messages: ChatMessage[],
  options: {
    mode: SummarizeMode;
    byokKey?: string;
    byokModel?: string;
    byokEndpoint?: string;
  },
): Promise<string> {
  if (options.mode === "byok") {
    if (!options.byokKey) throw new Error("BYOK mode requires byokKey.");
    const provider = detectProvider(options.byokKey, options.byokEndpoint);
    const model = options.byokModel ?? PROVIDER_DEFAULT_MODELS[provider];
    if (provider === "anthropic") {
      return callAnthropic(messages, options.byokKey, model);
    }
    const baseUrl = options.byokEndpoint ?? PROVIDER_ENDPOINTS[provider];
    return callOpenAICompatible(messages, options.byokKey, baseUrl, model);
  }

  const guestKey = process.env.GROQ_API_KEY;
  if (!guestKey) throw new Error("Guest summarization is unavailable (GROQ_API_KEY missing).");
  return callOpenAICompatible(messages, guestKey, PROVIDER_ENDPOINTS.groq, PROVIDER_DEFAULT_MODELS.groq);
}

export async function POST(req: Request) {
  const body = (await req.json()) as SummarizeRequest;
  const { userId } = await auth();
  const principalType: "anon" | "user" = userId ? "user" : "anon";
  const principalId = userId ?? body.principalId?.trim();

  const { question, philosopherAName, answerA, philosopherBName, answerB } = body;
  if (!question?.trim() || !philosopherAName || !answerA || !philosopherBName || !answerB) {
    return new Response("Missing required fields.", { status: 400 });
  }

  const mode: SummarizeMode = body.mode ?? "guest";
  if (!principalId) {
    return new Response("Principal ID required.", { status: 401 });
  }
  if (mode === "guest" && body.byokKey) {
    return new Response("Guest mode does not accept byokKey.", { status: 400 });
  }
  if (mode === "byok" && !body.byokKey) {
    return new Response("BYOK mode requires byokKey.", { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const rateCheck = await convex.mutation(api.rateLimit.consumePublic, {
    principalType,
    principalId,
    count: mode === "guest" ? 1 : 0,
  });
  if (!rateCheck.allowed) {
    const msg =
      rateCheck.reason === "burst"
        ? "Please wait a moment before summarizing again."
        : "Daily limit reached. Return tomorrow, sign in for more, or use your own key in Settings.";
    return new Response(msg, { status: 429 });
  }

  const userContent = buildDifferenceSummarizerInput({
    userQuestion: question.trim(),
    philosopherAName,
    answerA,
    philosopherBName,
    answerB,
  });

  const messages: ChatMessage[] = [
    { role: "system", content: DIFFERENCE_SUMMARIZER_SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  let summary: string;
  try {
    summary = await inferAnswer(messages, {
      mode,
      byokKey: body.byokKey,
      byokModel: body.byokModel,
      byokEndpoint: body.byokEndpoint,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    return new Response(message, { status: 500 });
  }

  if (!summary.trim()) {
    return new Response("Summarizer returned empty output.", { status: 500 });
  }

  // Soft validation: log issues but return the summary regardless.
  const validation = validateDifferenceSummary(summary);
  if (!validation.isValid) {
    console.warn("Difference summary validation warnings:", validation.errors);
  }

  return Response.json({ summary });
}
