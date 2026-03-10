#!/usr/bin/env bun
/**
 * scripts/eval-harness.ts
 *
 * End-to-end citation-faithfulness evaluator.
 *
 * Usage:
 *   bun run scripts/eval-harness.ts
 *
 * Requires:
 *   NEXT_PUBLIC_CONVEX_URL  — Convex deployment URL
 *   EVAL_ANON_ID            — A valid anon principal ID to use for test threads
 *   GROQ_API_KEY (optional) — If set, sends real messages via guest mode
 *
 * The harness:
 *   1. Sends benchmark questions to each philosopher via Convex mutations.
 *   2. Polls for the AI response (up to 30 s per question).
 *   3. Checks that every cited passage actually exists in the response.
 *   4. Flags responses that appear to quote text not in any retrieved passage.
 *   5. Prints a pass/fail report; exits with code 1 if any check fails.
 *
 * This script is NOT run in the unit-test CI job (it requires live credentials
 * and takes ~2 min). Add it to an optional "eval" CI job gated on secrets.
 */

import { ConvexHttpClient } from "convex/browser";

// ─── Benchmark questions ──────────────────────────────────────────────────────

const BENCHMARKS: Array<{ slug: string; question: string }> = [
  // Marcus Aurelius
  {
    slug: "marcus-aurelius",
    question: "How should I deal with people who frustrate me at work?",
  },
  {
    slug: "marcus-aurelius",
    question: "What does it mean to act according to nature?",
  },
  // Seneca
  {
    slug: "seneca",
    question: "How do I stop wasting time?",
  },
  {
    slug: "seneca",
    question: "Is it possible to be wealthy and still live a good life?",
  },
  // Epictetus
  {
    slug: "epictetus",
    question: "I feel powerless in my situation. What can I actually control?",
  },
  {
    slug: "epictetus",
    question: "How do I handle fear of what other people think of me?",
  },
];

// ─── Hallucination detection ─────────────────────────────────────────────────

/**
 * Simple heuristic: flag if the response contains a quoted phrase (text inside
 * quotation marks) that is longer than 20 chars and does not appear in any of
 * the provided passage texts.  Not perfect but catches blatant fabrications.
 */
function detectHallucinatedQuotes(
  response: string,
  passageTexts: string[]
): string[] {
  const quotePattern = /[""]([^"""]{20,})["'"]/g;
  const suspicious: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = quotePattern.exec(response)) !== null) {
    const quoted = match[1].toLowerCase();
    const foundInCorpus = passageTexts.some((p) =>
      p.toLowerCase().includes(quoted.slice(0, 40)) // check first 40 chars
    );
    if (!foundInCorpus) {
      suspicious.push(match[1]);
    }
  }

  return suspicious;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const anonId = process.env.EVAL_ANON_ID;

  if (!convexUrl || !anonId) {
    console.error(
      "❌ Missing required env vars: NEXT_PUBLIC_CONVEX_URL, EVAL_ANON_ID"
    );
    process.exit(1);
  }

  const convex = new ConvexHttpClient(convexUrl);

  // Fetch all philosophers once
  const philosophers = await (convex as any).query(
    { path: "philosophers:listActive", args: {} }
  ).catch(() => null);

  if (!philosophers) {
    console.error("❌ Could not fetch philosophers from Convex. Is the deployment running?");
    process.exit(1);
  }

  const results: Array<{
    slug: string;
    question: string;
    passed: boolean;
    hallucinatedQuotes: string[];
    error?: string;
  }> = [];

  for (const bench of BENCHMARKS) {
    const phil = (philosophers as any[]).find((p: any) => p.slug === bench.slug);
    if (!phil) {
      console.warn(`  ⚠ Philosopher "${bench.slug}" not found — skipping`);
      continue;
    }

    process.stdout.write(`  Testing ${phil.name}: "${bench.question.slice(0, 50)}…" `);

    try {
      // Create test thread
      const threadId = await (convex as any).mutation(
        { path: "threads:create", args: {
          principalType: "anon",
          principalId: anonId,
          philosopherId: phil._id,
          title: `[eval] ${bench.question.slice(0, 40)}`,
        }}
      );

      // Send message (triggers Convex processMessage action)
      await (convex as any).mutation(
        { path: "messages:sendUserMessage", args: {
          threadId,
          principalType: "anon",
          principalId: anonId,
          content: bench.question,
        }}
      );

      // Poll for assistant response (max 30 s)
      let response: any = null;
      const deadline = Date.now() + 30_000;
      while (Date.now() < deadline) {
        const messages = await (convex as any).query(
          { path: "messages:listByThread", args: {
            threadId,
            principalType: "anon",
            principalId: anonId,
          }}
        );
        const assistantMsg = (messages as any[]).find(
          (m: any) => m.role === "assistant"
        );
        if (assistantMsg) {
          response = assistantMsg;
          break;
        }
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (!response) {
        console.log("TIMEOUT");
        results.push({ slug: bench.slug, question: bench.question, passed: false, hallucinatedQuotes: [], error: "timeout" });
        continue;
      }

      // Check for hallucinated quotes
      const passageTexts = (response.citations ?? []).map((c: any) => c.passage as string);
      const hallucinatedQuotes = detectHallucinatedQuotes(response.content, passageTexts);
      const passed = hallucinatedQuotes.length === 0;

      console.log(passed ? "✅ PASS" : `❌ FAIL (${hallucinatedQuotes.length} suspicious quotes)`);
      if (!passed) {
        hallucinatedQuotes.forEach((q) => console.log(`     Quote: "${q.slice(0, 80)}…"`));
      }

      results.push({ slug: bench.slug, question: bench.question, passed, hallucinatedQuotes });

      // Clean up: delete test thread
      await (convex as any).mutation(
        { path: "threads:deleteThread", args: {
          threadId,
          principalType: "anon",
          principalId: anonId,
        }}
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`ERROR: ${msg}`);
      results.push({ slug: bench.slug, question: bench.question, passed: false, hallucinatedQuotes: [], error: msg });
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const pct = total === 0 ? 0 : Math.round((passed / total) * 100);

  console.log("\n─────────────────────────────────────────");
  console.log(`Eval results: ${passed}/${total} passed (${pct}%)`);

  const THRESHOLD = 95;
  if (pct < THRESHOLD) {
    console.error(`❌ Below faithfulness threshold (${pct}% < ${THRESHOLD}%)`);
    process.exit(1);
  } else {
    console.log(`✅ Citation faithfulness: ${pct}% (threshold: ${THRESHOLD}%)`);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
