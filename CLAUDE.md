# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

This is a **pre-scaffolding project**. Planning docs and UI mockups exist; no source code yet. The scaffolding milestone (M0) defines the first coding deliverables. Read `docs/m0-architecture-freeze-notes-for-scaffolding.md` before any implementation work. That document's decisions are binding — not open for re-evaluation.

## What This App Is

"Ask the Ancients" is a RAG-grounded philosopher chat app. Users pick a philosopher, ask questions, and receive answers in that philosopher's authentic voice, grounded in their published texts, with citations. Wave 1 covers three Stoics (Marcus Aurelius, Seneca, Epictetus).

## Commands

Once scaffolded, these will be the standard commands (all use `bun`):

```bash
bun dev              # Next.js + Convex dev server
bunx convex dev      # Convex backend dev server (run alongside bun dev)
bun build            # Production build
bun typecheck        # TypeScript type checking
bun lint             # ESLint
bun test             # Vitest unit tests
bun test <filepath>  # Single test file
```

CI runs: `typecheck`, `lint`, secret scan (gitleaks), and eval harness (citation faithfulness).

## Architecture

**Stack:** Next.js 15 (App Router) + Convex + Clerk (auth) + shadcn/ui + Tailwind CSS. Deployed to Vercel. Package manager: `bun` only.

**Backend:** Convex is the entire backend — database, serverless functions, real-time subscriptions, and vector search. There is no separate API server.

**RAG pipeline (5 steps):** Embed query → vector search filtered by `philosopherId` (top-8, hybrid with keyword via RRF) → build system prompt + retrieved passages + history → stream LLM response → display with citation cards.

**LLM providers:**
- Guest path: Groq (Llama 3.1 8B), rate-limited, V1 only
- BYOK: provider abstraction layer supporting Claude, OpenRouter, Groq, and any OpenAI-compatible endpoint

**Embeddings:** OpenAI `text-embedding-3-small` (1536 dims), stored in Convex `sourceTexts` table.

### Route Structure

```
/                       Landing + philosopher grid
/philosophers           Browse all philosophers
/philosophers/[slug]    Philosopher profile
/chat/[threadId]        Full-screen chat (hides bottom nav)
/history                Past conversations
/bookmarks              Saved passages
/settings               BYOK config, theme, account
```

### Source Layout (planned)

```
src/
├── app/               # Next.js App Router pages
├── components/        # UI components (shadcn/ui in components/ui/)
├── lib/               # philosophers.ts metadata, utils.ts
└── hooks/             # use-philosopher.ts, use-scroll-to-bottom.ts

convex/
├── schema.ts          # Convex table definitions
├── philosophers.ts    # Philosopher queries
├── chat.ts            # Thread + message mutations
├── bookmarks.ts       # Bookmark mutations
├── agent.ts           # Convex Agent per philosopher
├── rag.ts             # Retrieval logic
├── ingest.ts          # Corpus ingestion
└── seed.ts            # Dev seed data

scripts/               # One-time data pipeline scripts
```

## Frozen Decisions (Non-Negotiable)

These were frozen at M0 and cannot be changed without explicit owner approval.

**D1 — No sign-in wall.** Anonymous users can create threads, receive responses, view history, and save bookmarks. Every user-owned table must use `principalType` (`anon` | `user`) + `principalId`, never `userId` as the sole ownership key. On sign-in, data merges from `anonId` to `userId` via idempotent operation.

**D2 — BYOK defaults to session mode.** API keys stay in memory only (cleared on tab close). Persistent mode is opt-in with explicit UI warning. Keys must never appear in logs, telemetry, or error traces. The settings model carries: `provider`, `mode` (guest | byok), `keyStorageMode` (session | persistent), `model`, `customEndpoint`.

**D3 — Guest inference is Groq only for V1.** Rate limits enforced server-side from day one: anonymous = 10 msg/day, signed-in free = 15 msg/day. Config flags required: `GUEST_MODE_ENABLED`, `GUEST_PROVIDER=groq`, `GUEST_DAILY_LIMIT_ANON`, `GUEST_DAILY_LIMIT_USER`.

**D4 — UI must match the draw.io assets exactly.** Any visual deviation requires owner approval. Assets are in `assets/`: `chat-interface-mockup.drawio`, `chat-interface-components.drawio`, `philosopher-browser.drawio`, `history-page.drawio`, `bookmarks-page.drawio`, `settings-page.drawio`. The `drawio-mcp-server` is available globally for design parity checks.

**D5 — Repository visibility is owner decision.** Do not add automation that forces a private→public switch.

**D6 — Package manager is `bun` only.** Use `bun`/`bunx` in all scripts and docs. Commit only `bun.lockb`. Never commit `package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`. Keep any Node pinning in a repo-local `.nvmrc`; do not touch `~/.zshrc` or any global shell config.

## Convex Schema (Key Tables)

- `philosophers` — slug, name, school, tradition, era, systemPrompt, greeting, works
- `threads` — `principalId`, `principalType`, `philosopherId`, timestamps
- `bookmarks` — `principalId`, `principalType`, passage reference
- `sourceTexts` — corpus chunks with 1536-d vector embeddings, filtered by `philosopherId`
- `chatEvents` — lightweight usage analytics for rate-limit tracking

## Design System

- Dark mode default: deep navy `#0f172a`, warm gold `#d4a843`, cream `#faf8f0`
- Fonts: Crimson Pro (serif) for philosopher content, Inter (sans-serif) for UI chrome
- Philosopher avatars: AI-generated marble bust illustrations
- Navigation: persistent bottom tab bar (Philosophers, History, Saved, Settings); chat page is full-screen and hides the tab bar

## MCP Servers Available

- `context7` — fetch up-to-date library docs (Convex, Next.js, Clerk, shadcn/ui, Vercel AI SDK)
- `drawio-mcp-server` (global) — inspect `.drawio` assets for design parity verification

## Core Runtime Dependencies

```bash
bun add convex @clerk/nextjs ai openai zod
bun add -d typescript eslint prettier @types/node vitest @playwright/test
```

## M0 Scaffolding Done Criteria

The scaffold is complete when:
- All route skeletons render locally
- Convex schema deploys (`principalType` + `principalId` on all user-owned tables)
- Anonymous principal can create a thread record
- Optional Clerk sign-in works without blocking anonymous usage
- Settings page can toggle guest/BYOK mode at UI state level
- No hardcoded secrets in code or `.env.example`
