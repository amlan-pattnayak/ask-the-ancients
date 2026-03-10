# Architecture

Canonical architecture doc for Ask the Ancients.

## Overview

Ask the Ancients is a retrieval-grounded chat system built on Next.js + Convex. The app stores source chunks in Convex, retrieves top passages by embedding similarity, assembles philosopher/system prompts, and calls either shared guest inference (Groq) or user-provided BYOK inference.

Key runtime defaults from code:
- Guest model: Groq `llama-3.3-70b-versatile`
- Embedding model: OpenAI `text-embedding-3-small`
- Retrieval depth in chat pipeline: `topK = 6`
- Guest limits: anon `10/day`, signed-in `25/day`

## Data Flow

1. Ingest source text (`scripts/ingest-texts.ts`) from Project Gutenberg or curated chunk files.
2. Chunk text with work-specific chunkers.
3. Embed chunks with OpenAI embeddings API (`text-embedding-3-small`).
4. Store chunk + metadata + embedding in Convex `sourceTexts`.
5. On user query, embed query text (same embedding model).
6. Run Convex vector search filtered by philosopher.
7. Assemble prompt: philosopher system prompt + shared style contract + retrieved passages.
8. Infer response via:
- Guest mode: shared server-side Groq key
- BYOK mode: user key/model (provider-detected)
9. Build/store citations from retrieved passages and render in UI.

## Request Path (Chat)

- `src/components/chat/ChatInterface.tsx` sends messages.
- `convex/chat.ts` orchestrates rate-limit, retrieval, inference, and persistence.
- `convex/rag.ts` performs query embedding + vector search.
- `src/lib/build-system-prompt.ts` appends shared conversation contract.
- Citations are attached to assistant messages and rendered as:
- Mobile: inline accordion in message bubble
- Desktop: fixed citation rail

## Design Decisions and Tradeoffs

### Convex as primary backend

Decision:
- Use Convex for data model, functions, vector index, auth-aware data access patterns.

Why:
- Single backend surface for persistence + vector retrieval + app actions.
- Realtime queries simplify chat/bookmark/history UI sync.

Tradeoffs:
- Convex action model can constrain straightforward token streaming patterns.
- Vendor lock-in relative to self-hosted Postgres + separate vector DB.

### Shared guest inference on Groq + BYOK escape hatch

Decision:
- Provide a free shared model path and optional BYOK mode.

Why:
- Low-friction trial path for users.
- BYOK removes shared-infra quota bottlenecks and allows model experimentation.

Tradeoffs:
- Shared guest path needs strict rate limiting and budget guardrails.
- BYOK increases UX complexity (provider detection, key handling, model selection).

### Embedding model: `text-embedding-3-small`

Decision:
- Use a lower-cost embedding model for corpus and query embedding.

Why:
- Good quality/price balance for small-medium text corpus retrieval.
- Fast enough for iterative ingestion during development.

Tradeoffs:
- May lose retrieval quality on subtle philosophical distinctions versus larger embeddings.
- No reranking layer currently to recover misses.

### Top-K retrieval with philosopher filter

Decision:
- Retrieve a small top-K set (`6`) scoped to selected philosopher.

Why:
- Keeps prompts compact and persona-consistent.
- Reduces irrelevant cross-philosopher contamination.

Tradeoffs:
- Hard top-K can miss useful context for broad questions.
- No MMR/diversity control yet.

## Known Limitations

- No reranking/MMR stage after vector retrieval.
- Citation confidence is heuristic (not calibrated with explicit confidence scoring).
- Persona isolation is prompt-based; no formal adversarial eval harness yet.
- Streaming architecture is split (Convex action path vs Next.js streaming route).
- Curated source packs (currently Mahavira and Ramanuja) need explicit provenance/licensing policy in OSS docs.

## Next Improvements

- Add reranking (cross-encoder or lightweight heuristic) and/or MMR.
- Build a reproducible eval harness for retrieval relevance, persona fidelity, and citation faithfulness.
- Add citation-confidence labels and better retrieval diagnostics.
- Add persona-isolation checks (automated tests for style bleed / cross-philosopher leakage).
- Add response caching and retrieval cache to reduce repeated cost/latency.

## Performance and Cost Notes (High-Level)

- Ingestion cost is dominated by one-time embedding generation.
- Runtime cost is dominated by inference tokens; BYOK offloads this to the user.
- Retrieval cost/latency is low at current corpus scale because vector search scope is filtered by philosopher.
- Scaling pressure points are expected in inference throughput, eval coverage, and prompt/retrieval quality control rather than storage volume.

## Canonical References

- Architecture (this file): [ARCHITECTURE.md](ARCHITECTURE.md)
- Setup + product framing: [README.md](README.md)
- Source/license ledger: [ATTRIBUTION.md](ATTRIBUTION.md)
- Contributor process: [CONTRIBUTING.md](CONTRIBUTING.md)
- Philosopher onboarding workflow: [ADDING_PHILOSOPHERS.md](ADDING_PHILOSOPHERS.md)
