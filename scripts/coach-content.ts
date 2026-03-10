export type CoachTopic = "ts" | "py";
export type CoachMode = "explain" | "quiz" | "exercise";
export type CoachLevel = "beginner" | "intermediate";

export interface CoachLesson {
  id: string;
  topic: CoachTopic;
  mode: CoachMode;
  level: CoachLevel;
  title: string;
  objective: string;
  repoExamples: string[];
  whyItMatters: string[];
  conceptBrief: string[];
  antiPattern: string;
  betterPattern: string;
  quizPrompt: string;
  exercisePrompt: string;
  debugPrompt: string;
  checklist: string[];
  nextStep: string;
}

const TS_CURATED_SNIPPET_ASYNC = `// Better async boundary
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function fetchUser(id: string): Promise<Result<{ id: string }>> {
  try {
    const row = await db.get(id);
    if (!row) return { ok: false, error: "not_found" };
    return { ok: true, data: row };
  } catch {
    return { ok: false, error: "unexpected_failure" };
  }
}`;

const TS_CURATED_SNIPPET_NARROWING = `type Payment = { kind: "card"; last4: string } | { kind: "cash" };

function receiptLabel(payment: Payment): string {
  if (payment.kind === "card") {
    return "Card ending " + payment.last4; // narrowed safely
  }
  return "Cash";
}`;

const PY_CURATED_SNIPPET_DATACLASS = `from dataclasses import dataclass

@dataclass(slots=True)
class Chunk:
    source_id: str
    text: str
    token_count: int
`;

const PY_CURATED_SNIPPET_ASYNC = `import asyncio

async def fetch_many(ids: list[str]) -> list[str]:
    async def fetch_one(i: str) -> str:
        await asyncio.sleep(0.01)
        return i

    return await asyncio.gather(*(fetch_one(i) for i in ids))
`;

export const COACH_LESSONS: CoachLesson[] = [
  {
    id: "ts-01",
    topic: "ts",
    mode: "explain",
    level: "beginner",
    title: "Modeling analytics events with discriminated unions",
    objective: "Understand how this repo models analytics events with strict type safety.",
    repoExamples: ["src/lib/analytics/types.ts", "convex/analytics.ts"],
    whyItMatters: [
      "Prevents malformed analytics payloads at compile time.",
      "Makes KPI math trustworthy by standardizing event shape.",
      "Speeds up refactors because every event use-site is discoverable.",
    ],
    conceptBrief: [
      "A discriminated union is a union of object types that all share a tag field (eventName).",
      "TypeScript narrows based on that tag, so each event gets the right properties safely.",
      "Use this when events or commands have multiple variants.",
      TS_CURATED_SNIPPET_NARROWING,
    ],
    antiPattern: `type Event = { eventName: string; properties: any };`,
    betterPattern: `type Event = { eventName: "message_sent"; properties: MessageSentProps } | { eventName: "citation_opened"; properties: CitationOpenedProps };`,
    quizPrompt: "Why is `eventName: string` weaker than an eventName union when computing KPI rollups?",
    exercisePrompt:
      "Design a new `thread_archived` event type with strict properties and add it to a discriminated union in pseudo-code.",
    debugPrompt:
      "A teammate added `eventName: 'message_sent'` but forgot `messageLength` in properties. What compile-time guard would you expect?",
    checklist: [
      "I can explain what the discriminator field is.",
      "I know why unions beat `any` for event payloads.",
      "I can add a new event variant without breaking existing ones.",
    ],
    nextStep: "Run `bun run coach --topic=ts --mode=exercise --level=intermediate`.",
  },
  {
    id: "ts-02",
    topic: "ts",
    mode: "exercise",
    level: "intermediate",
    title: "Safe async error boundaries in Convex/Next flows",
    objective: "Practice robust async handling and user-safe error surfaces.",
    repoExamples: ["convex/chat.ts", "src/app/api/chat/stream/route.ts", "convex/messages.ts"],
    whyItMatters: [
      "Prevents leaked secrets in logs and error payloads.",
      "Keeps UX responsive when providers fail.",
      "Maintains stable KPIs by recording failed outcomes explicitly.",
    ],
    conceptBrief: [
      "Async boundaries should transform low-level exceptions into domain-safe outcomes.",
      "Never forward raw provider errors to users.",
      TS_CURATED_SNIPPET_ASYNC,
    ],
    antiPattern: "catch (e) { throw e; }",
    betterPattern:
      "catch (err) { return { ok: false, error: 'provider_error' }; } // plus analytics event",
    quizPrompt: "When should an async function return a typed failure object instead of throwing?",
    exercisePrompt:
      "Refactor a pseudo `sendMessage()` that throws provider errors so it returns a typed Result and logs a safe analytics failure class.",
    debugPrompt:
      "Users see provider internals in UI. Which layer should sanitize error strings first in this architecture?",
    checklist: [
      "I can distinguish recoverable vs unrecoverable failures.",
      "I can map raw failures to safe failure classes.",
      "I can preserve observability without exposing secrets.",
    ],
    nextStep: "Compare this against current handling in `convex/chat.ts`.",
  },
  {
    id: "ts-03",
    topic: "ts",
    mode: "quiz",
    level: "beginner",
    title: "Readonly design and immutable event pipelines",
    objective: "Build intuition for immutable data handling in event processing.",
    repoExamples: ["src/lib/safety.ts", "src/lib/analytics/types.ts"],
    whyItMatters: [
      "Immutable flows reduce accidental mutation bugs.",
      "Safer in async code and easier to test.",
    ],
    conceptBrief: [
      "Use readonly arrays and pure helpers where possible.",
      "Avoid in-place edits to shared payload objects.",
    ],
    antiPattern: "events.push(newEvent); mutate existing event fields later",
    betterPattern: "const next = [...events, newEvent];",
    quizPrompt: "What risk is introduced when shared event objects are mutated after validation?",
    exercisePrompt: "Rewrite a mutable event-enrichment function into a pure function.",
    debugPrompt: "A metric changes unexpectedly across retries. How can mutation cause this?",
    checklist: [
      "I can identify mutable hotspots in TS code.",
      "I prefer pure functions for transforms.",
    ],
    nextStep: "Practice in `scripts/coach.ts` exercise mode.",
  },
  {
    id: "ts-04",
    topic: "ts",
    mode: "explain",
    level: "intermediate",
    title: "Server components vs client components for secure admin pages",
    objective: "Understand why `/kpi` auth checks live on the server.",
    repoExamples: ["src/app/kpi/page.tsx", "src/components/kpi/KpiCharts.tsx", "src/lib/admin.ts"],
    whyItMatters: [
      "Prevents client-side bypass of admin checks.",
      "Keeps identity and allowlist logic in trusted execution context.",
    ],
    conceptBrief: [
      "Server components enforce authorization before data leaves the server.",
      "Client components are ideal for chart interactivity after access is granted.",
    ],
    antiPattern: "Fetch dashboard data in client then hide UI if not admin.",
    betterPattern: "Authorize in server page, then render client chart component.",
    quizPrompt: "Why is client-only admin gating insufficient for sensitive metrics?",
    exercisePrompt: "Sketch a secure split between server auth and client interactivity for a new admin page.",
    debugPrompt: "A non-admin briefly sees dashboard data flash. Which architectural boundary is wrong?",
    checklist: [
      "I can explain trusted vs untrusted render layers.",
      "I know where to place auth checks in Next.js App Router.",
    ],
    nextStep: "Inspect `/kpi` implementation and explain it out loud in 2 minutes.",
  },
  {
    id: "ts-05",
    topic: "ts",
    mode: "exercise",
    level: "intermediate",
    title: "Designing KPI rollups with explicit canonical sources",
    objective: "Model deterministic metrics when telemetry has multiple sources.",
    repoExamples: ["convex/analytics.ts", "convex/crons.ts", "src/components/chat/ChatInterface.tsx"],
    whyItMatters: [
      "Avoids double-counting when both client and server emit similar events.",
      "Improves stakeholder trust in dashboards.",
    ],
    conceptBrief: [
      "Define one canonical source per KPI metric.",
      "Keep alternative events as diagnostic telemetry.",
    ],
    antiPattern: "COUNT(message_sent) across all events regardless of source",
    betterPattern: "COUNT(message_sent WHERE source='server') for KPI; keep client events for UX diagnostics",
    quizPrompt: "What is the product risk of mixing client and server message counts in one KPI?",
    exercisePrompt: "Write pseudo-query logic for KPI truth + telemetry side panel.",
    debugPrompt: "A release doubled `message_sent` KPI overnight. What source-mixing bug would you test first?",
    checklist: [
      "I can define canonical vs diagnostic metrics.",
      "I can explain this policy to non-technical stakeholders.",
    ],
    nextStep: "Review cron rollup output against raw `product_events` samples.",
  },
  {
    id: "py-01",
    topic: "py",
    mode: "explain",
    level: "beginner",
    title: "Python data modeling for ingestion pipelines",
    objective: "Learn how to model ingestion entities cleanly in Python.",
    repoExamples: ["scripts/chunk-stoics.ts", "scripts/chunk-indians.ts", "scripts/ingest-texts.ts"],
    whyItMatters: [
      "Data pipelines become easier to reason about and test.",
      "Cleaner models reduce parsing bugs and malformed records.",
    ],
    conceptBrief: [
      "In Python, use `@dataclass` for structured pipeline records.",
      "Prefer explicit field names and type hints.",
      PY_CURATED_SNIPPET_DATACLASS,
    ],
    antiPattern: "Using nested dicts with implicit keys everywhere",
    betterPattern: "Define dataclasses for Chunk, WorkMetadata, and IngestResult",
    quizPrompt: "Why are dataclasses better than ad-hoc dicts for ingestion stages?",
    exercisePrompt: "Create a Python `Chunk` dataclass and a function that validates empty content.",
    debugPrompt: "A chunk is missing `source_id`; how would typed models catch this earlier?",
    checklist: [
      "I can model ingestion records with dataclasses.",
      "I can explain type hints as communication, not just linting.",
    ],
    nextStep: "Implement the same ingestion stage once in dict-style and once in dataclass-style, compare readability.",
  },
  {
    id: "py-02",
    topic: "py",
    mode: "exercise",
    level: "intermediate",
    title: "Python async batching for API-heavy tasks",
    objective: "Practice async batching patterns used in embedding/retrieval workloads.",
    repoExamples: ["scripts/ingest-texts.ts", "convex/rag.ts"],
    whyItMatters: [
      "Improves throughput when calling external APIs.",
      "Reduces wall-clock pipeline time.",
    ],
    conceptBrief: [
      "Use `asyncio.gather` for I/O-bound parallelism with bounded concurrency.",
      "Add retry and backoff for transient failures.",
      PY_CURATED_SNIPPET_ASYNC,
    ],
    antiPattern: "Sequentially awaiting each network call in a loop",
    betterPattern: "Batch + gather + semaphore + retry policy",
    quizPrompt: "When should you avoid full parallel gather and use bounded concurrency instead?",
    exercisePrompt: "Write pseudo-Python that embeds 100 chunks with concurrency=10 and retry-on-429.",
    debugPrompt: "API rate limits spike after migrating to asyncio. What limiter is missing?",
    checklist: [
      "I can separate CPU-bound vs I/O-bound work.",
      "I can add concurrency controls to async pipelines.",
    ],
    nextStep: "Map this to your TS ingestion scripts and identify equivalent control points.",
  },
  {
    id: "py-03",
    topic: "py",
    mode: "quiz",
    level: "beginner",
    title: "Python exceptions and domain-safe error contracts",
    objective: "Learn to convert raw exceptions into predictable domain errors.",
    repoExamples: ["convex/chat.ts", "src/app/api/chat/stream/route.ts"],
    whyItMatters: [
      "Keeps user-facing behavior stable.",
      "Improves observability by classifying failures.",
    ],
    conceptBrief: [
      "Catch low-level exceptions and map to semantic error codes.",
      "Log details internally; return safe messages externally.",
    ],
    antiPattern: "except Exception as e: return str(e)",
    betterPattern: "except ProviderTimeout: return {'ok': False, 'error': 'provider_timeout'}",
    quizPrompt: "What should be logged vs returned in a public API response?",
    exercisePrompt: "Define a small Python Result type pattern for safe API surfaces.",
    debugPrompt: "Users report random internal stack traces in responses. Where should you sanitize?",
    checklist: [
      "I can map raw errors to domain-safe categories.",
      "I can avoid leaking internals to clients.",
    ],
    nextStep: "Compare your answer with TS handling in `convex/chat.ts`.",
  },
  {
    id: "py-04",
    topic: "py",
    mode: "explain",
    level: "intermediate",
    title: "Testing strategy: unit tests for deterministic pipeline pieces",
    objective: "Use deterministic tests to validate pipeline logic.",
    repoExamples: ["src/lib/__tests__/prompt-validators.test.ts", "src/lib/__tests__/safety.test.ts"],
    whyItMatters: [
      "Protects core behavior during refactors.",
      "Keeps quality high without relying on flaky integration tests.",
    ],
    conceptBrief: [
      "In Python, test pure transformers and validators with parameterized tests.",
      "Keep network and filesystem boundaries mocked.",
    ],
    antiPattern: "Only end-to-end tests with external APIs",
    betterPattern: "Mostly fast deterministic unit tests + minimal integration smoke tests",
    quizPrompt: "Which layer should own tests for quote/citation validation logic?",
    exercisePrompt: "Design 5 deterministic test cases for a Python `extract_citation_ids` helper.",
    debugPrompt: "A flaky test depends on real clock/network; how do you stabilize it?",
    checklist: [
      "I can identify deterministic test targets.",
      "I can isolate side effects in tests.",
    ],
    nextStep: "Translate one Vitest suite in this repo into equivalent pytest style mentally.",
  },
  {
    id: "py-05",
    topic: "py",
    mode: "exercise",
    level: "intermediate",
    title: "Repository + curated best practice synthesis",
    objective: "Practice transferring patterns across TS and Python.",
    repoExamples: ["convex/analytics.ts", "scripts/run-ingest.ts", "scripts/eval-harness.ts"],
    whyItMatters: [
      "Builds language-agnostic engineering judgment.",
      "Lets you explain architecture in interviews beyond syntax details.",
    ],
    conceptBrief: [
      "Patterns transfer across languages: typed contracts, safe boundaries, deterministic tests, clear ownership.",
      "Your value as PM/engineer is choosing the right pattern, not just writing syntax.",
    ],
    antiPattern: "Treating TS and Python as separate silos with no shared design principles",
    betterPattern: "Shared architecture principles, language-specific implementation details",
    quizPrompt: "Name 3 design principles that should stay identical across TS and Python implementations.",
    exercisePrompt:
      "Draft a Python version of the KPI rollup architecture: raw events table, daily rollup job, dashboard read model, and canonical source policy.",
    debugPrompt:
      "A teammate ports logic from TS to Python but drops canonical source filtering. What KPI symptom appears first?",
    checklist: [
      "I can map architecture principles across languages.",
      "I can explain design choices in interview-ready language.",
      "I can identify where syntax differences are irrelevant to product outcomes.",
    ],
    nextStep: "Run one coached session in each mode (explain/quiz/exercise) and summarize lessons learned.",
  },
];

export function getLessons(topic: CoachTopic, mode: CoachMode, level: CoachLevel): CoachLesson[] {
  return COACH_LESSONS.filter(
    (lesson) =>
      lesson.topic === topic &&
      lesson.mode === mode &&
      lesson.level === level
  );
}

