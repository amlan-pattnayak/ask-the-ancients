import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/lib/convex";
import { buildSystemPrompt } from "@/lib/build-system-prompt";
import {
  buildComparisonResponse,
  stripCitationMarkers,
  type ComparisonPassage,
} from "@/lib/agora/comparison";

type DetectedProvider = "groq" | "anthropic" | "openrouter" | "openai-compat";
type CompareMode = "guest" | "byok";

interface CompareRequest {
  question: string;
  philosopherAId: string;
  philosopherBId: string;
  mode?: CompareMode;
  byokKey?: string;
  byokModel?: string;
  byokEndpoint?: string;
  principalType?: "anon" | "user";
  principalId?: string;
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

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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
      max_tokens: 350,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    throw new Error(`Provider returned ${res.status}. Check model and API key.`);
  }

  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  // Use || not ?? — Groq can return content: "" (empty string) under rate pressure,
  // which ?? passes through as-is since "" is not null/undefined.
  return data.choices?.[0]?.message?.content || "I was unable to formulate a response.";
}

async function callAnthropic(
  messages: ChatMessage[],
  key: string,
  model: string,
): Promise<string> {
  const systemMsg = messages.find((message) => message.role === "system");
  const conversation = messages.filter((message) => message.role !== "system");

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
    throw new Error(`Anthropic returned ${res.status}. Check model and API key.`);
  }

  const data = await res.json() as {
    content?: Array<{ type?: string; text?: string }>;
  };
  return data.content?.find((entry) => entry.type === "text")?.text ??
    "I was unable to formulate a response.";
}

async function inferAnswer(
  messages: ChatMessage[],
  options: {
    mode: CompareMode;
    byokKey?: string;
    byokModel?: string;
    byokEndpoint?: string;
  },
): Promise<string> {
  if (options.mode === "byok") {
    if (!options.byokKey) {
      throw new Error("BYOK mode requires byokKey.");
    }
    const provider = detectProvider(options.byokKey, options.byokEndpoint);
    const model = options.byokModel ?? PROVIDER_DEFAULT_MODELS[provider];
    if (provider === "anthropic") {
      return callAnthropic(messages, options.byokKey, model);
    }
    const baseUrl = options.byokEndpoint ?? PROVIDER_ENDPOINTS[provider];
    return callOpenAICompatible(messages, options.byokKey, baseUrl, model);
  }

  const guestKey = process.env.GROQ_API_KEY;
  if (!guestKey) {
    throw new Error("Guest comparison is unavailable (GROQ_API_KEY missing).");
  }
  return callOpenAICompatible(
    messages,
    guestKey,
    PROVIDER_ENDPOINTS.groq,
    PROVIDER_DEFAULT_MODELS.groq,
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as CompareRequest;
  const { userId } = await auth();

  const question = body.question?.trim();
  const philosopherAId = body.philosopherAId;
  const philosopherBId = body.philosopherBId;
  const mode: CompareMode = body.mode ?? "guest";
  const principalType: "anon" | "user" = userId ? "user" : "anon";
  const principalId = userId ?? body.principalId?.trim();

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  if (!question) {
    return new Response("Question is required.", { status: 400 });
  }
  if (!philosopherAId || !philosopherBId) {
    return new Response("Both philosopher IDs are required.", { status: 400 });
  }
  if (philosopherAId === philosopherBId) {
    return new Response("Please choose two different philosophers.", { status: 400 });
  }

  if (!principalId) {
    return new Response("Principal ID required.", { status: 401 });
  }

  // Abuse guard for both modes:
  // - guest: consumes normal quota
  // - byok: count=0 applies burst control without charging daily quota
  const rateCheck = await convex.mutation(api.rateLimit.consumePublic, {
    principalType,
    principalId,
    count: mode === "guest" ? 2 : 0,
  });
  if (!rateCheck.allowed) {
    const msg =
      rateCheck.reason === "burst"
        ? "Please wait a moment before comparing again."
        : "Daily limit reached. Return tomorrow, sign in for more, or use your own key in Settings.";
    return new Response(msg, { status: 429 });
  }

  if (mode === "guest") {
    // explicit guard to prevent accidental guest fallback when BYOK was intended
    if (body.byokKey) {
      return new Response("Guest mode does not accept byokKey.", { status: 400 });
    }
  } else if (!body.byokKey) {
    return new Response("BYOK mode requires byokKey.", { status: 400 });
  }
  const philosophers = await convex.query(api.philosophers.listActive, {});
  const philosopherA = philosophers.find((phil) => phil._id === philosopherAId);
  const philosopherB = philosophers.find((phil) => phil._id === philosopherBId);
  if (!philosopherA || !philosopherB) {
    return new Response("One or both philosophers were not found.", { status: 404 });
  }

  const [passagesA, passagesB] = await Promise.all([
    convex.action(api.rag.retrievePassages, {
      query: question,
      philosopherId: philosopherA._id,
      topK: 6,
    }).catch(() => {
      console.warn("RAG failed for A; proceeding without passages.");
      return [];
    }),
    convex.action(api.rag.retrievePassages, {
      query: question,
      philosopherId: philosopherB._id,
      topK: 6,
    }).catch(() => {
      console.warn("RAG failed for B; proceeding without passages.");
      return [];
    }),
  ]);

  const promptA = buildSystemPrompt(philosopherA.systemPrompt, passagesA);
  const promptB = buildSystemPrompt(philosopherB.systemPrompt, passagesB);

  const [answerA, answerB] = await Promise.all([
    inferAnswer(
      [
        { role: "system", content: promptA },
        { role: "user", content: question },
      ],
      {
        mode,
        byokKey: body.byokKey,
        byokModel: body.byokModel,
        byokEndpoint: body.byokEndpoint,
      },
    ),
    inferAnswer(
      [
        { role: "system", content: promptB },
        { role: "user", content: question },
      ],
      {
        mode,
        byokKey: body.byokKey,
        byokModel: body.byokModel,
        byokEndpoint: body.byokEndpoint,
      },
    ),
  ]);

  const response = buildComparisonResponse(
    {
      rawAnswer: answerA,
      displayAnswer: stripCitationMarkers(answerA),
      passages: passagesA.map((passage) => ({
        sourceTextId: String(passage.sourceTextId),
        workTitle: passage.workTitle,
        chapterRef: passage.chapterRef,
        content: passage.content,
      })) as ComparisonPassage[],
    },
    {
      rawAnswer: answerB,
      displayAnswer: stripCitationMarkers(answerB),
      passages: passagesB.map((passage) => ({
        sourceTextId: String(passage.sourceTextId),
        workTitle: passage.workTitle,
        chapterRef: passage.chapterRef,
        content: passage.content,
      })) as ComparisonPassage[],
    },
  );

  return Response.json(response);
}
