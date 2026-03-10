## Session Summary

- Hardened RAG ingestion by splitting raw texts into embedding-safe chunks, caching Gutenberg downloads, clearing per-work rows before reinsert, and resolving philosopher IDs dynamically so reruns stay idempotent and resilient.  
- Added `scripts/dry-run-test.ts` plus `bun run ingest:dry-run` to preview chunk counts without hitting OpenAI; bounded each chunk to ~6k characters for `text-embedding-3-small`.  
- Secured Convex chat/threads API: ownership checks on thread/message mutations/queries, consistent message counts, typed citations, and new `clearByWork` mutation + schema index; deployed updated schema/code via `npx convex codegen` and `npx convex deploy`.  
- Fixed hydration warnings by suppressing mismatched attributes on the root layout, and replaced effect-driven state with storage-safe boots (Provider toggle, usePrincipal).  
- Validated with `bun run lint` and `bunx tsc --noEmit --incremental false`; ingestion succeeded (~916 chunks) and `bun run dev` now starts after clearing stale Next.js lock.

## Next Steps

1. Re-run `bun run ingest` occasionally to keep Convex up-to-date; the script now clears per-work chunks before inserting.  
2. Run UI tests/manual flows (chat, citations, settings) to confirm hydration and provider toggles behave in browsers.  
3. Track any Groq provider/rate-limit implementation gaps noted in `src/lib/providers`/`src/lib/rate-limit`; they remain TODOs.
