import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function queryTerms(query: string): string[] {
  const stopwords = new Set([
    "the", "and", "that", "this", "with", "from", "your", "about", "what",
    "when", "where", "which", "into", "have", "will", "would", "there", "their",
    "them", "they", "been", "more", "than", "does", "did", "just", "want", "learn",
  ]);
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4 && !stopwords.has(term))
    .slice(0, 10);
}

function nearestSentenceBoundary(text: string, from: number, direction: "left" | "right"): number {
  const marks = [". ", "? ", "! ", "; "];
  if (direction === "left") {
    let best = -1;
    for (const mark of marks) {
      const idx = text.lastIndexOf(mark, from);
      if (idx > best) best = idx;
    }
    return best;
  }
  let best = -1;
  for (const mark of marks) {
    const idx = text.indexOf(mark, from);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

function buildRelevantExcerpt(content: string, query: string): string {
  const clean = normalizeWhitespace(content);
  if (!clean) return "";
  if (clean.length <= 680) return clean;

  const lower = clean.toLowerCase();
  const terms = queryTerms(query);

  let matchIndex = -1;
  for (const term of terms) {
    const idx = lower.indexOf(term);
    if (idx !== -1 && (matchIndex === -1 || idx < matchIndex)) {
      matchIndex = idx;
    }
  }
  if (matchIndex === -1) matchIndex = 0;

  const maxChars = 560;
  const leftPad = 180;
  let start = Math.max(0, matchIndex - leftPad);
  let end = Math.min(clean.length, start + maxChars);

  const leftBoundary = nearestSentenceBoundary(clean, start, "left");
  if (leftBoundary !== -1 && leftBoundary >= start - 140) {
    start = leftBoundary + 2;
  }

  const rightBoundary = nearestSentenceBoundary(clean, end, "right");
  if (rightBoundary !== -1 && rightBoundary <= end + 140) {
    end = rightBoundary + 1;
  }

  let excerpt = clean.slice(start, end).trim();
  if (!excerpt) excerpt = clean.slice(0, maxChars).trim();
  if (start > 0) excerpt = `…${excerpt}`;
  if (end < clean.length) excerpt = `${excerpt}…`;
  return excerpt;
}

export const retrievePassages = action({
  args: {
    query: v.string(),
    philosopherId: v.id("philosophers"),
    topK: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    sourceTextId: Id<"sourceTexts">;
    workTitle: string;
    chapterRef: string;
    content: string;
    score: number;
  }>> => {
    const k = args.topK ?? 8;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");

    // Embed the query
    const embedResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: args.query,
      }),
    });

    if (!embedResponse.ok) {
      const err = await embedResponse.text();
      throw new Error(`OpenAI embedding failed: ${err}`);
    }

    const embedData = await embedResponse.json() as {
      data: Array<{ embedding: number[] }>;
    };
    const queryEmbedding = embedData.data[0].embedding;

    // Vector search filtered by philosopher
    const results = await ctx.vectorSearch("sourceTexts", "by_embedding", {
      vector: queryEmbedding,
      limit: k,
      filter: (q) => q.eq("philosopherId", args.philosopherId),
    });

    // Fetch full documents
    const passages = await Promise.all(
      results.map(async (r) => {
        const doc = await ctx.runQuery(internal.sourceTexts.getById, { id: r._id });
        return {
          sourceTextId: r._id,
          workTitle: doc?.workTitle ?? "",
          chapterRef: doc?.chapterRef ?? "",
          content: buildRelevantExcerpt(doc?.content ?? "", args.query),
          score: r._score,
        };
      })
    );

    return passages;
  },
});
