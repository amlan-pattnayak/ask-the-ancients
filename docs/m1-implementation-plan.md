# M1 Implementation Plan -- Vertical Slice

**Created:** 2026-02-17
**Milestone:** M1 -- Vertical Slice (Private Repo)
**Status:** Draft -- awaiting owner approval

## Overview

M1 delivers the first end-to-end user flow: land on the app, pick a Stoic philosopher, have a grounded conversation with citations, browse history, and bookmark a response. This is the "demoable vertical slice" that proves the core product works.

**Exit criteria from execution spec:**
- Demoable flow: landing -> pick philosopher -> ask -> cited answer -> bookmark
- No critical runtime errors in local + preview deploy
- No unapproved UI deviations for implemented pages

---

## 1. Scope

### In M1

| Feature | Description |
|---------|-------------|
| Anonymous identity | `anonId` cookie generated client-side, passed to all Convex operations |
| Philosopher data layer | `philosophers` table + seed data for 3 Stoics |
| Source text ingestion | `sourceTexts` table, chunking pipeline for Meditations (Marcus Aurelius only for first vertical slice; Seneca + Epictetus corpus added in M1 as well) |
| Chat flow | Create thread, send message, retrieve passages, generate response via Groq, stream to UI |
| Citation rendering | Citation cards below assistant messages, expandable to show source passage |
| History page | List threads by principal, grouped by time, tap to reopen |
| Bookmarks | Save/remove a message, bookmarks page with list |
| Basic rate limiting | Server-side check + consume backed by `usage_counters` table (already in schema) |
| Settings -- rate limit visibility | Show remaining daily messages in settings |
| Navigation | Bottom tab bar on main pages, full-screen chat |
| Design system foundations | Color palette, fonts (Crimson Pro + Inter), dark mode default |

### Deferred to M2+

| Feature | Why deferred |
|---------|-------------|
| CI eval harness (citation faithfulness, hallucination checks) | M2 -- quality gate |
| Abuse controls (Turnstile, IP velocity, device fingerprint) | M2 -- safety gate |
| BYOK full implementation (multi-provider, test connection) | M2 -- cost controls |
| Budget alerts + guest kill switch | M2 -- cost controls |
| CSP / XSS hardening | M2 -- security gate |
| PWA manifest, service worker, install prompt | M3 -- OSS packaging |
| Search within history/bookmarks | M2 polish |
| Swipe-to-delete on history/bookmarks | M2 polish |
| Share button on bookmarks | M2 polish |
| Data export/clear in settings | M2 polish |
| Merge flow (anonId -> userId on sign-in) | M2 -- requires careful testing; anon-only is sufficient for M1 demo |
| Philosopher profile page (`/philosophers/[slug]`) | Partially in M1 (basic version); full stats + conversation counts in M2 |

---

## 2. Feature Breakdown

### F1: Anonymous Identity System
**Complexity:** Simple

The anonymous identity is the foundation -- every other feature depends on having a `principalType` + `principalId` pair.

**What it does:**
- On first visit, generate a UUID v4 and store it in an `anonId` cookie (HttpOnly=false since client JS needs it; SameSite=Lax; max-age=1 year)
- `resolvePrincipal()` reads the cookie, returns `{ principalType: "anon", principalId: <cookie value> }`
- If Clerk session exists, return `{ principalType: "user", principalId: <clerkUserId>, userId: <clerkUserId> }`
- All Convex mutations/queries receive `principalType` + `principalId` as args from the client

**Key decision:** The `anonId` cookie must be readable by client-side JavaScript (so it can be passed to Convex client queries). This means `HttpOnly=false`. The cookie contains no secret -- it is simply a random identifier. Security implication is minimal since the value itself has no privilege; it only scopes data visibility.

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth.ts` | Modify | Implement real `resolvePrincipal()` using cookie + Clerk |
| `src/lib/anon-id.ts` | Create | `getOrCreateAnonId()` -- cookie read/write utility |
| `src/hooks/use-principal.ts` | Create | React hook that calls `resolvePrincipal()` and memoizes |
| `src/components/Providers.tsx` | Modify | Ensure anonId cookie is set on first render |

### F2: Schema Evolution -- Philosophers + Source Texts
**Complexity:** Medium

The M0 schema is missing two critical tables from the project plan: `philosophers` and `sourceTexts`. These must be added. The existing `threads` table also needs a `philosopherId` field.

**What it does:**
- Add `philosophers` table with slug, name, school, tradition, era, tagline, bio, avatarUrl, systemPrompt, greeting, works array, isActive flag, sortOrder
- Add `sourceTexts` table with philosopherId, workTitle, chapterRef, content, embedding (1536-d vector)
- Add vector index on `sourceTexts` for filtered retrieval
- Modify `threads` table to include `philosopherId` (required reference to philosopher) and `lastMessageAt`, `messageCount`
- Modify `messages` table to add optional `citations` array field for assistant messages

**Schema changes in detail:**

```typescript
// NEW: philosophers table
philosophers: defineTable({
  slug: v.string(),
  name: v.string(),
  school: v.string(),
  tradition: v.string(),
  era: v.string(),
  tagline: v.string(),
  bio: v.string(),
  avatarUrl: v.string(),
  systemPrompt: v.string(),
  greeting: v.string(),
  works: v.array(v.object({
    title: v.string(),
    shortTitle: v.string(),
    sourceUrl: v.string(),
  })),
  isActive: v.boolean(),
  sortOrder: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_school", ["school"])
  .index("by_tradition", ["tradition"]),

// NEW: sourceTexts table
sourceTexts: defineTable({
  philosopherId: v.id("philosophers"),
  workTitle: v.string(),
  chapterRef: v.string(),
  content: v.string(),
  embedding: v.array(v.float64()),
})
  .vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1536,
    filterFields: ["philosopherId"],
  })
  .index("by_philosopher", ["philosopherId"]),
```

**Threads table modification:**

```typescript
threads: defineTable({
  principalType: v.union(v.literal("anon"), v.literal("user")),
  principalId: v.string(),
  userId: v.optional(v.string()),
  philosopherId: v.id("philosophers"),  // NEW
  title: v.optional(v.string()),
  lastMessageAt: v.number(),            // NEW (replaces updatedAt)
  messageCount: v.number(),             // NEW
  createdAt: v.number(),
})
  .index("by_principal", ["principalType", "principalId"])
  .index("by_userId", ["userId"]),
```

**Messages table modification:**

```typescript
messages: defineTable({
  threadId: v.id("threads"),
  principalType: v.union(v.literal("anon"), v.literal("user")),
  principalId: v.string(),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  citations: v.optional(v.array(v.object({   // NEW
    workTitle: v.string(),
    chapterRef: v.string(),
    passage: v.string(),
    sourceTextId: v.id("sourceTexts"),
  }))),
  createdAt: v.number(),
}).index("by_thread", ["threadId"]),
```

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/schema.ts` | Modify | Add philosophers, sourceTexts tables; update threads and messages |
| `convex/philosophers.ts` | Create | Queries: getBySlug, listActive, listBySchool |
| `convex/seed.ts` | Create | Seed function for 3 Stoic philosophers |

### F3: Philosopher Seed Data
**Complexity:** Medium

Create the 3 Stoic philosopher entries with full metadata and system prompts.

**What it does:**
- Marcus Aurelius: emperor voice, references Meditations, mentions teachers
- Seneca: advisor voice, references Letters to Lucilius, On the Shortness of Life
- Epictetus: teacher voice, references Discourses and Enchiridion
- Each philosopher gets: a unique system prompt, a greeting message, a tagline, a bio, a works array
- Placeholder avatar URLs (marble bust style images, to be generated)

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/seed.ts` | Create | `seedPhilosophers` mutation with all 3 Stoics |
| `convex/philosophers.ts` | Create | Queries for philosopher data |
| `public/philosophers/` | Create | Placeholder avatar images (can use SVG busts initially) |

### F4: Source Text Ingestion Pipeline
**Complexity:** Complex

This is the most technically involved piece of M1. We need to fetch public domain texts from Project Gutenberg, chunk them appropriately, generate embeddings, and store them in Convex.

**What it does:**
- Fetch raw text from Gutenberg (Meditations, Letters to Lucilius, On the Shortness of Life, Discourses, Enchiridion)
- Parse and clean: strip Gutenberg headers/footers, HTML entities, normalize whitespace
- Chunk by structural divisions:
  - Meditations: one chunk per numbered reflection (e.g., "Book 2, Reflection 1")
  - Seneca's Letters: one chunk per thematic paragraph within each letter
  - On the Shortness of Life: one chunk per chapter section
  - Discourses: one chunk per topic section
  - Enchiridion: one chunk per section/maxim
- Target chunk size: 200-500 words (split long sections, merge very short ones)
- Generate embeddings via OpenAI `text-embedding-3-small` (1536 dims)
- Store chunks + embeddings in Convex `sourceTexts` table via mutation
- Ingestion is a one-time script, not a runtime operation

**Estimated corpus:**
- ~725 chunks total across all 3 Stoics
- Embedding cost: ~$0.50 one-time

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `scripts/ingest-texts.ts` | Create | Main ingestion orchestrator |
| `scripts/fetch-gutenberg.ts` | Create | Gutenberg text fetcher + cleaner |
| `scripts/chunk-stoics.ts` | Create | Stoic-specific chunking logic |
| `convex/ingest.ts` | Create | Convex mutation to batch-insert sourceTexts with embeddings |
| `texts/stoic/` | Create | Raw downloaded texts (gitignored if large, or committed if small) |
| `texts/README.md` | Create | Attribution + source URLs |

**Decision needed:** Should the ingestion scripts run via `bun` locally (calling Convex mutations via HTTP) or as a Convex action? Recommendation: **local bun script** that calls Convex mutations. Reasoning: ingestion is one-time, needs OpenAI API access for embeddings, and is easier to debug locally. The script can use the `convex` npm package's `ConvexHttpClient` to call mutations.

### F5: RAG Retrieval
**Complexity:** Medium

Vector search over the `sourceTexts` table, filtered by philosopher, returning the top-k most relevant passages for a user query.

**What it does:**
- Receive user message + philosopherId
- Embed the user message via OpenAI `text-embedding-3-small`
- Vector search `sourceTexts` filtered by `philosopherId`, top-8 results
- Return passages with metadata (workTitle, chapterRef, content, score)
- These passages are injected into the system prompt as `{retrieved_passages}`

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/rag.ts` | Create | Vector search action: embed query, search sourceTexts, return top-k |

**Key decision:** The embedding for the user query needs to happen server-side (in a Convex action) because we need the OpenAI API key, which must not be on the client. Convex actions can make external HTTP calls, so this works. The `OPENAI_API_KEY` will be a Convex environment variable.

### F6: Chat Flow (Core Loop)
**Complexity:** Complex

This is the central feature -- the full send-message-receive-response loop.

**What it does:**
1. User types a message and hits send
2. Client calls Convex mutation: `messages.send({ threadId, content, principalType, principalId })`
3. Mutation stores user message, then triggers a Convex action for inference
4. Action: embed query -> RAG retrieve -> build prompt -> call Groq API -> stream response
5. Action stores assistant message (with citations) via mutation
6. Client sees messages update in real-time via Convex subscription

**Streaming approach for M1:**
Convex does not natively support streaming action responses to the client in the same way SSE does. For M1, the approach is:
- The Convex action calls Groq, collects the full response, then stores it as a message
- The client subscribes to messages for the thread; when the assistant message appears, it renders
- "Simulated streaming" on the client: reveal the stored message character-by-character with a typing animation
- True streaming (SSE from Convex action) is a M2 enhancement

**Alternative considered:** Use a Next.js API route as a streaming proxy. This adds complexity and breaks the "Convex is the entire backend" principle. Deferred.

**System prompt assembly:**
```
[philosopher.systemPrompt]

RETRIEVED PASSAGES FROM YOUR WRITINGS:
[passage 1: workTitle, chapterRef]
"passage content..."

[passage 2: workTitle, chapterRef]
"passage content..."

... (up to 8 passages)

CITATION INSTRUCTIONS:
- Reference specific passages when relevant
- Use the format: (workTitle, chapterRef)
- Only cite passages that are actually provided above
- If no passage is directly relevant, reason from general Stoic principles and say so

CONVERSATION HISTORY:
[last N messages]
```

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/messages.ts` | Create | send mutation, listByThread query |
| `convex/threads.ts` | Modify | Update create mutation to include philosopherId; add getById query |
| `convex/chat.ts` | Create | Main chat action: RAG + inference + store response |
| `convex/prompts.ts` | Create | System prompt assembly logic |
| `src/lib/providers/guest-groq.ts` | Modify | Implement real Groq API call (server-side, in Convex action) |

**Wait -- architecture clarification needed:**

The existing `src/lib/providers/` directory contains client-side TypeScript. But the Groq guest call MUST happen server-side (Convex action) because:
1. The `GROQ_API_KEY` is a server secret
2. Rate limiting must be enforced server-side

So the provider abstraction for **guest mode** lives in `convex/`, not `src/lib/`. The `src/lib/providers/` code is for **BYOK mode** where the key comes from the client. For M1, we only need guest mode working, so the inference logic lives entirely in Convex actions.

**Revised file plan:**
| File | Action | Description |
|------|--------|-------------|
| `convex/inference.ts` | Create | Groq API call from Convex action (uses env var `GROQ_API_KEY`) |
| `convex/chat.ts` | Create | Orchestrator action: rate-limit check -> RAG -> inference -> store |
| `convex/messages.ts` | Create | send mutation (user msg), store mutation (assistant msg), listByThread query |
| `convex/threads.ts` | Modify | Add philosopherId to create; add getById; update lastMessageAt/messageCount |
| `convex/prompts.ts` | Create | System prompt builder |

### F7: Rate Limiting (Basic)
**Complexity:** Simple

The `usage_counters` table already exists in the M0 schema. We need to implement the actual check/consume logic in Convex.

**What it does:**
- Before each chat action, check usage_counters for today's date + principal
- If count >= limit (10 for anon, 15 for user), reject with a clear error
- On successful inference, increment the counter
- Return remaining count to client for UI display

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/rateLimit.ts` | Create | check + consume mutations using usage_counters table |
| `src/lib/rate-limit/stub-service.ts` | Remove or keep as client fallback | The real enforcement is in Convex now |

### F8: Chat UI
**Complexity:** Medium

The chat interface is the centerpiece of M1's visual delivery.

**What it does:**
- Full-screen layout (hides bottom tab bar)
- Header: back button, philosopher name + school + era, options menu (placeholder)
- Message list: scrollable, auto-scroll to bottom on new message
- User messages: right-aligned bubbles
- Assistant messages: left-aligned with philosopher avatar, name, content
- Citation cards: below assistant messages, showing workTitle + chapterRef, tappable to expand and show the full passage
- Save button on assistant messages (adds bookmark)
- Copy button on assistant messages
- Input bar: text input + send button at bottom
- Loading state: typing indicator while waiting for assistant response
- Empty state: philosopher greeting message shown when thread is new

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/components/chat/ChatInterface.tsx` | Rewrite | Full chat UI with Convex subscriptions |
| `src/components/chat/ChatInput.tsx` | Rewrite | Input bar with send button |
| `src/components/chat/MessageBubble.tsx` | Rewrite | User and assistant message rendering |
| `src/components/chat/CitationCard.tsx` | Create | Expandable citation below assistant messages |
| `src/components/chat/ChatHeader.tsx` | Create | Philosopher info + back button |
| `src/components/chat/TypingIndicator.tsx` | Create | Animated dots while waiting for response |
| `src/app/chat/[threadId]/page.tsx` | Modify | Wire up ChatInterface with threadId param |
| `src/hooks/use-scroll-to-bottom.ts` | Create | Auto-scroll hook for message list |

### F9: Philosopher Browser + Selection
**Complexity:** Medium

The philosopher browser is the entry point to starting a conversation.

**What it does:**
- Grid of philosopher cards (3 Stoics for V1)
- Each card: avatar, name, tagline, school badge, era
- Tapping a card navigates to `/philosophers/[slug]`
- Profile page: bio, works list, "Start Conversation" CTA
- CTA creates a new thread and navigates to `/chat/[threadId]`
- Landing page (`/`) shows a hero section + the philosopher grid inline

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/components/philosophers/PhilosopherCard.tsx` | Rewrite | Full card with avatar, metadata, school badge |
| `src/components/philosophers/PhilosopherBrowser.tsx` | Rewrite | Grid layout, fetches from Convex |
| `src/app/philosophers/page.tsx` | Modify | Wire up PhilosopherBrowser |
| `src/app/philosophers/[slug]/page.tsx` | Modify | Philosopher profile + Start Conversation CTA |
| `src/app/page.tsx` | Modify | Landing page with hero + philosopher grid |

### F10: History Page
**Complexity:** Simple

**What it does:**
- List all threads for the current principal, ordered by lastMessageAt desc
- Group by time: Today, Yesterday, Last Week, Older
- Each item: philosopher avatar + name, school badge, first user message as preview, message count, time ago
- Tap to navigate to `/chat/[threadId]`
- Empty state for new users

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/app/history/page.tsx` | Modify | Wire up thread list |
| `src/components/history/ThreadCard.tsx` | Create | Thread preview card |
| `src/components/history/ThreadList.tsx` | Create | Grouped list with time headers |

### F11: Bookmarks
**Complexity:** Simple

**What it does:**
- Save button on assistant messages adds a bookmark (stores messageId + threadId)
- Bookmarks page lists all saved messages with passage content, philosopher name, citation ref
- "View in Context" button navigates to the original thread
- Remove bookmark (tap again or swipe -- tap-toggle for M1, swipe for M2)

**Bookmarks schema note:** The M0 bookmarks table has `messageId` as optional. For M1, we will always populate it. The bookmark stores a reference to a specific assistant message.

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `convex/bookmarks.ts` | Create | add, remove, listByPrincipal mutations/queries |
| `src/app/bookmarks/page.tsx` | Modify | Wire up bookmark list |
| `src/components/bookmarks/BookmarkCard.tsx` | Create | Saved passage card |
| `src/components/bookmarks/BookmarkList.tsx` | Create | List of bookmarks |

### F12: Navigation -- Bottom Tab Bar
**Complexity:** Simple

**What it does:**
- Persistent bottom bar on all pages EXCEPT `/chat/[threadId]`
- 4 tabs: Philosophers (temple icon), History (chat icon), Saved (bookmark icon), Settings (gear icon)
- Active tab highlighted with gold accent (#d4a843)
- Chat page uses full-screen layout with back navigation instead

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/components/layout/BottomNav.tsx` | Create | Bottom tab bar component |
| `src/app/layout.tsx` | Modify | Conditionally render BottomNav (not on chat routes) |
| `src/components/layout/Navbar.tsx` | Modify or remove | May not be needed if bottom nav is primary |

### F13: Design System Foundations
**Complexity:** Simple

**What it does:**
- Configure Tailwind v4 with the project color palette
- Load Crimson Pro (serif) and Inter (sans-serif) fonts
- Dark mode as default
- Basic component tokens: card borders, text colors, backgrounds
- Gold accent for active states and CTAs

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/app/globals.css` | Modify | CSS custom properties for design system, Tailwind theme |
| `src/app/layout.tsx` | Modify | Font loading (Crimson Pro + Inter) |
| `tailwind.config.ts` | Modify (if exists) or configure in CSS | Theme extension |

### F14: Settings -- Rate Limit Visibility
**Complexity:** Simple

**What it does:**
- Show current principal type (anonymous or signed in)
- Show remaining daily messages and progress bar
- Sign-in CTA for anonymous users ("Sign in for 15 messages/day")
- Existing ProviderToggle component remains

**Files:**
| File | Action | Description |
|------|--------|-------------|
| `src/app/settings/page.tsx` | Modify | Add account section, rate limit display |
| `src/components/settings/RateLimitBadge.tsx` | Create | Remaining messages display with progress bar |
| `src/components/settings/AccountSection.tsx` | Create | Anonymous vs signed-in state |

---

## 3. Implementation Order

### Phase 1: Foundations [SEQUENTIAL]
These must be done first and in order. Everything else depends on them.

```
Step 1.1: Anonymous Identity System (F1)
  Dependencies: none
  Produces: usePrincipal() hook, anonId cookie

Step 1.2: Schema Evolution (F2)
  Dependencies: none (can parallel with 1.1)
  Produces: philosophers + sourceTexts tables deployed

Step 1.3: Philosopher Seed Data (F3)
  Dependencies: 1.2 (schema must be deployed)
  Produces: 3 Stoic philosopher records in Convex

Step 1.4: Design System Foundations (F13)
  Dependencies: none (can parallel with 1.1-1.3)
  Produces: color palette, fonts, dark mode default
```

### Phase 2: Data Pipeline [SEQUENTIAL then PARALLEL]

```
Step 2.1: Source Text Ingestion Pipeline (F4) [SEQUENTIAL]
  Dependencies: 1.2 (sourceTexts table), 1.3 (philosopher IDs for foreign key)
  Produces: ~725 chunks with embeddings in Convex

Step 2.2: RAG Retrieval (F5) [SEQUENTIAL after 2.1]
  Dependencies: 2.1 (needs data to search)
  Produces: Working vector search returning relevant passages
```

### Phase 3: Chat Backend [SEQUENTIAL]

```
Step 3.1: Chat Action -- Inference + RAG (F6) [SEQUENTIAL after 2.2]
  Dependencies: 2.2 (RAG), 1.1 (principal), 1.3 (philosopher data)
  Produces: End-to-end: user message -> RAG -> Groq -> stored assistant message

Step 3.2: Rate Limiting (F7) [PARALLEL with 3.1 or after]
  Dependencies: 1.1 (principal identity)
  Produces: Server-side rate check in chat action flow
```

### Phase 4: UI [PARALLEL -- all can be built simultaneously]

```
Step 4.1: Bottom Nav (F12)
  Dependencies: 1.4 (design system)

Step 4.2: Philosopher Browser + Landing (F9)
  Dependencies: 1.3 (seed data), 1.4 (design system)

Step 4.3: Chat UI (F8)
  Dependencies: 3.1 (chat backend), 1.4 (design system)

Step 4.4: History Page (F10)
  Dependencies: 1.1 (principal), 1.4 (design system)

Step 4.5: Bookmarks (F11)
  Dependencies: 1.1 (principal), 1.4 (design system)

Step 4.6: Settings Rate Limit Display (F14)
  Dependencies: 3.2 (rate limiting), 1.1 (principal)
```

### Phase 5: Integration + Polish [SEQUENTIAL]

```
Step 5.1: Full Flow Integration Test
  Dependencies: all of Phase 4
  Test: landing -> select philosopher -> create thread -> chat -> see citations -> bookmark -> view in history

Step 5.2: UI Parity Pass
  Dependencies: 5.1
  Check implemented pages against draw.io assets

Step 5.3: Bug Fixes + Edge Cases
  Dependencies: 5.2
```

### Parallelism Map for Agent Swarm

```
                    Phase 1 (Foundations)
                   /        |         \
              [1.1]      [1.2]      [1.4]
            (identity) (schema)   (design)
                   \      |
                    [1.3]
                  (seed data)
                      |
               Phase 2 (Data)
                  [2.1] -> [2.2]
                (ingest)   (RAG)
                      |
               Phase 3 (Backend)
                [3.1]    [3.2]
              (chat)   (rate limit)
                |          |
               Phase 4 (UI -- ALL PARALLEL)
        [4.1] [4.2] [4.3] [4.4] [4.5] [4.6]
                      |
               Phase 5 (Integration)
              [5.1] -> [5.2] -> [5.3]
```

**Optimal agent assignments:**

| Agent | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|-------|---------|---------|---------|---------|
| Agent A (Backend/Data) | 1.2 schema + 1.3 seed | 2.1 ingest + 2.2 RAG | 3.1 chat action | -- |
| Agent B (Identity/Infra) | 1.1 anonId | -- | 3.2 rate limit | 4.6 settings |
| Agent C (UI) | 1.4 design system | -- | -- | 4.1 nav + 4.2 browser + 4.3 chat UI |
| Agent D (UI) | -- | -- | -- | 4.4 history + 4.5 bookmarks |

---

## 4. Key Decisions Requiring Clarification

### D1: Streaming Strategy for M1

**Options:**
- **A) Full response then render (simulated typing):** Convex action collects full Groq response, stores as message, client animates character-by-character reveal. Simplest. No true streaming.
- **B) Next.js API route as streaming proxy:** Client sends message to `/api/chat`, which calls Convex for RAG, then streams Groq response via SSE. More complex, breaks "Convex is entire backend" principle.
- **C) Convex action with progressive message updates:** Action updates the message document multiple times as chunks arrive. Client sees real-time updates via subscription. Unconventional but possible.

**Recommendation:** Option A for M1. It is the simplest path to a working demo. The typing animation provides adequate UX. True streaming is a M2 enhancement.

### D2: Convex Agent Framework vs. Manual RAG

The project plan mentions "Convex Agent framework" and "Convex RAG component." These are Convex-provided abstractions for building chat agents with retrieval.

**Options:**
- **A) Use Convex Agent framework:** Handles thread management, message storage, tool calling, and RAG retrieval in an opinionated way. Potentially faster to implement but adds framework coupling.
- **B) Manual implementation:** Write our own thread/message mutations, RAG retrieval action, and inference action. More code but full control and easier to debug.

**Recommendation:** Investigate the Convex Agent framework API before committing. If it supports our principal model (anonId + userId dual identity) and does not force a Clerk-only auth pattern, use it. If it assumes authenticated users only, go manual. **This needs a quick spike (1-2 hours) at the start of Phase 2.**

### D3: Embedding Generation Location

**Options:**
- **A) Local script:** `bun run scripts/ingest-texts.ts` calls OpenAI embeddings API, then pushes chunks to Convex via `ConvexHttpClient`. Simple, one-time.
- **B) Convex action:** Upload raw text to Convex, then a Convex action calls OpenAI embeddings API. Keeps everything in Convex.

**Recommendation:** Option A. Ingestion is a one-time dev operation. Running it locally is simpler to debug and does not consume Convex action compute for a batch job.

### D4: Citation Extraction from LLM Response

The LLM will reference passages in its response text (e.g., "As I wrote in the Meditations, Book 6..."). We also need structured citation data for the citation cards.

**Options:**
- **A) Structured output:** Ask the LLM to return JSON with `{ response, citations: [...] }`. Requires prompt engineering and output parsing.
- **B) Post-processing:** Parse the response text for citation patterns. Fragile.
- **C) Attach all retrieved passages as citations:** Every passage that was retrieved and injected into the prompt is listed as a citation card, regardless of whether the LLM referenced it. Simplest but may show irrelevant citations.
- **D) Hybrid:** Attach retrieved passages as potential citations, then use a simple heuristic (does the response text mention the work title or chapter ref?) to filter to only relevant ones.

**Recommendation:** Option D for M1. Attach all retrieved passages but highlight/show only those whose `workTitle` or `chapterRef` appears in the response text. Show the rest in an expandable "Related passages" section. This avoids complex LLM output parsing while maintaining citation quality.

### D5: Avatar Images

The design calls for "AI-generated marble bust illustrations." For M1, do we:
- **A) Generate real images** using an image generation tool
- **B) Use placeholder SVGs** with initials/silhouettes
- **C) Use public domain bust photographs** from Wikimedia Commons

**Recommendation:** Option C for M1. Wikimedia Commons has public domain photos of classical busts for all 3 Stoics. Use them. Replace with custom-generated images later if desired.

---

## 5. File-Level Plan (Complete)

### New Files

| File | Feature | Description |
|------|---------|-------------|
| `src/lib/anon-id.ts` | F1 | Cookie-based anonymous ID utility |
| `src/hooks/use-principal.ts` | F1 | React hook for resolved principal |
| `convex/philosophers.ts` | F2, F3 | Philosopher queries + seed |
| `convex/seed.ts` | F3 | Seed data mutation |
| `convex/ingest.ts` | F4 | Batch insert mutations for sourceTexts |
| `convex/rag.ts` | F5 | Vector search action |
| `convex/chat.ts` | F6 | Chat orchestrator action |
| `convex/messages.ts` | F6 | Message mutations + queries |
| `convex/inference.ts` | F6 | Groq API call from Convex action |
| `convex/prompts.ts` | F6 | System prompt builder |
| `convex/rateLimit.ts` | F7 | Rate limit check + consume |
| `convex/bookmarks.ts` | F11 | Bookmark mutations + queries |
| `scripts/ingest-texts.ts` | F4 | Ingestion orchestrator |
| `scripts/fetch-gutenberg.ts` | F4 | Gutenberg fetcher |
| `scripts/chunk-stoics.ts` | F4 | Chunking logic |
| `texts/stoic/README.md` | F4 | Attribution manifest |
| `src/components/chat/CitationCard.tsx` | F8 | Expandable citation |
| `src/components/chat/ChatHeader.tsx` | F8 | Chat page header |
| `src/components/chat/TypingIndicator.tsx` | F8 | Loading animation |
| `src/components/history/ThreadCard.tsx` | F10 | Thread preview card |
| `src/components/history/ThreadList.tsx` | F10 | Grouped thread list |
| `src/components/bookmarks/BookmarkCard.tsx` | F11 | Saved passage card |
| `src/components/bookmarks/BookmarkList.tsx` | F11 | Bookmark list |
| `src/components/layout/BottomNav.tsx` | F12 | Bottom tab bar |
| `src/components/settings/RateLimitBadge.tsx` | F14 | Rate limit display |
| `src/components/settings/AccountSection.tsx` | F14 | Account state display |
| `src/hooks/use-scroll-to-bottom.ts` | F8 | Auto-scroll for chat |
| `public/philosophers/marcus-aurelius.webp` | F3 | Avatar image |
| `public/philosophers/seneca.webp` | F3 | Avatar image |
| `public/philosophers/epictetus.webp` | F3 | Avatar image |

### Modified Files

| File | Feature | Change |
|------|---------|--------|
| `convex/schema.ts` | F2 | Add philosophers, sourceTexts; modify threads, messages |
| `convex/threads.ts` | F6 | Add philosopherId to create, add getById, update lastMessageAt |
| `src/lib/auth.ts` | F1 | Implement real resolvePrincipal() |
| `src/lib/providers/guest-groq.ts` | F6 | Mark as client-side BYOK path (actual guest inference is in convex/) |
| `src/components/Providers.tsx` | F1 | Ensure anonId is initialized |
| `src/components/chat/ChatInterface.tsx` | F8 | Full rewrite |
| `src/components/chat/ChatInput.tsx` | F8 | Full rewrite |
| `src/components/chat/MessageBubble.tsx` | F8 | Full rewrite |
| `src/components/philosophers/PhilosopherCard.tsx` | F9 | Full rewrite |
| `src/components/philosophers/PhilosopherBrowser.tsx` | F9 | Full rewrite |
| `src/app/page.tsx` | F9 | Landing page with hero + grid |
| `src/app/philosophers/page.tsx` | F9 | Wire up browser |
| `src/app/philosophers/[slug]/page.tsx` | F9 | Profile + CTA |
| `src/app/chat/[threadId]/page.tsx` | F8 | Wire up ChatInterface |
| `src/app/history/page.tsx` | F10 | Wire up thread list |
| `src/app/bookmarks/page.tsx` | F11 | Wire up bookmark list |
| `src/app/settings/page.tsx` | F14 | Add account + rate limit sections |
| `src/app/layout.tsx` | F12, F13 | BottomNav, fonts, design system |
| `src/app/globals.css` | F13 | Theme tokens, color palette |

### Deleted/Replaced Files

| File | Reason |
|------|--------|
| `src/lib/rate-limit/stub-service.ts` | Replaced by `convex/rateLimit.ts` |
| `src/components/common/PrincipalBadge.tsx` | May not be needed in M1 UI |

---

## 6. Environment Variables

### Existing (from M0)
- `NEXT_PUBLIC_CONVEX_URL` -- Convex deployment URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` -- Clerk publishable key
- `CLERK_SECRET_KEY` -- Clerk secret key

### New for M1 (Convex environment variables)
These are set via `bunx convex env set <KEY> <VALUE>`:

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Server-side Groq API key for guest inference |
| `OPENAI_API_KEY` | For embedding generation (used in ingestion and RAG query embedding) |
| `GUEST_MODE_ENABLED` | `"true"` or `"false"` -- kill switch for guest mode |
| `GUEST_DAILY_LIMIT_ANON` | `"10"` -- daily message limit for anonymous users |
| `GUEST_DAILY_LIMIT_USER` | `"15"` -- daily message limit for signed-in users |

---

## 7. Done Criteria

M1 is complete when ALL of the following are true:

### Functional
- [ ] Anonymous user can visit `/`, see 3 Stoic philosophers in a grid
- [ ] Tapping a philosopher card navigates to their profile page
- [ ] "Start Conversation" creates a thread and navigates to `/chat/[threadId]`
- [ ] Chat page shows philosopher greeting as first message
- [ ] User can type a message and receive a grounded response from Groq
- [ ] Assistant response includes 1-3 citation cards with workTitle + chapterRef
- [ ] Citation cards expand to show the original passage text
- [ ] Save button on assistant messages creates a bookmark
- [ ] History page lists all threads for the current anonymous user, grouped by time
- [ ] Tapping a thread in history reopens the conversation
- [ ] Bookmarks page lists all saved passages
- [ ] Bottom tab bar navigates between Philosophers, History, Saved, Settings
- [ ] Chat page is full-screen (no bottom tab bar)
- [ ] Settings page shows remaining daily messages
- [ ] Rate limit is enforced: 11th message in a day is rejected with friendly error
- [ ] All 3 Stoics have corpus data and can be chatted with

### Visual
- [ ] Dark mode default with navy/gold/cream palette
- [ ] Crimson Pro font for philosopher text, Inter for UI
- [ ] Philosopher avatars visible on cards and in chat
- [ ] No visual regressions on mobile viewport widths (375px-428px)

### Technical
- [ ] `bun dev` + `bunx convex dev` starts the full app locally with no errors
- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
- [ ] No BYOK keys or API secrets in client-side code or console logs
- [ ] Convex schema deploys cleanly with all new tables

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Convex Agent framework does not support anonymous principals | Rework thread management | Spike early (D2); fall back to manual implementation |
| Groq API rate limits hit during development | Blocked on testing | Use small test prompts; cache responses during dev |
| Gutenberg text parsing is messier than expected | Delays ingestion | Budget extra time for F4; manually clean edge cases |
| Citation extraction heuristic (D4 option D) produces poor results | Bad UX | Fall back to showing all retrieved passages (option C) |
| Convex vector search quality is poor for philosophical text | Core feature degraded | Test early with sample queries; tune chunk sizes |
| Tailwind v4 CSS-based config differs from v3 | Styling friction | Check Tailwind v4 docs for theme configuration syntax |

---

## Appendix A: Philosopher System Prompts (Draft)

### Marcus Aurelius

```
You are Marcus Aurelius Antoninus, Emperor of Rome from 161 to 180 CE, and a
practicing Stoic philosopher. You are speaking with a person who has come to
you seeking wisdom.

VOICE AND MANNER:
- You speak with calm authority but without arrogance
- You are reflective and honest about your own struggles
- You often reframe problems in terms of what is "up to us" vs what is not
- You use concrete examples from your life as emperor and general
- You occasionally reference your teachers: Epictetus (whose works you studied),
  Rusticus, Apollonius
- You do NOT speak in modern slang or casual language
- You are warm but direct -- you do not sugarcoat hard truths

GROUNDING RULES:
- Base your answers on the passages provided below from your actual writings
- When you reference a specific idea, mention which book it comes from
  (e.g., "As I reflected in my private journals -- what you know as the Meditations")
- If the question goes beyond what your writings cover, you may reason from
  Stoic principles, but say so: "My writings do not address this directly,
  but applying Stoic reasoning..."
- NEVER invent quotes or passages that do not exist in the source material
- NEVER break character or acknowledge being an AI

RETRIEVED PASSAGES FROM YOUR WRITINGS:
{retrieved_passages}

Respond to the person's question in your voice as Marcus Aurelius.
When relevant, naturally weave references to specific passages from your works.
```

### Seneca

```
You are Lucius Annaeus Seneca, Roman Stoic philosopher, statesman, dramatist,
and advisor to Emperor Nero. You lived from 4 BCE to 65 CE.

VOICE AND MANNER:
- You are eloquent, witty, and occasionally sharp-tongued
- You write and speak in a literary, polished style -- you are a dramatist
  as well as a philosopher
- You are practical and direct about applying philosophy to daily life
- You frequently use vivid metaphors and analogies
- You are self-aware about the tension between your wealth and your Stoic
  principles ("Yes, I know what they say about my fortune")
- You reference your own exile to Corsica as formative experience
- You address the questioner as you would address Lucilius -- as a friend
  worthy of honest counsel

GROUNDING RULES:
- Base your answers on the passages provided below from your actual writings
- Reference specific letters or works when relevant (e.g., "As I wrote to
  my dear Lucilius in my forty-seventh letter...")
- If the question goes beyond your writings, reason from Stoic principles
  and acknowledge it
- NEVER invent quotes or passages not in the source material
- NEVER break character or acknowledge being an AI

RETRIEVED PASSAGES FROM YOUR WRITINGS:
{retrieved_passages}

Respond in your voice as Seneca. Be eloquent but substantive.
When relevant, naturally reference specific works and passages.
```

### Epictetus

```
You are Epictetus, Stoic philosopher and teacher. Born a slave around 50 CE
in Hierapolis (modern Turkey), you were freed and studied under Musonius Rufus
before founding your own school in Nicopolis. Your teachings were recorded by
your student Arrian in the Discourses and the Enchiridion.

VOICE AND MANNER:
- You are a teacher above all -- direct, sometimes blunt, always practical
- You use the Socratic method: you ask questions to lead people to insight
- You frequently use everyday examples (the broken cup, the festival, the
  wrestling match) to illustrate philosophical points
- You are passionate and occasionally fierce -- you do not tolerate excuses
- You speak from experience of slavery and hardship, not from privilege
- You often reference the distinction between what is "up to us" (prohairesis)
  and what is not
- You sometimes challenge the questioner directly: "But what did you expect?"

GROUNDING RULES:
- Base your answers on the passages provided below from your actual teachings
- Reference specific discourses or sections of the Enchiridion when relevant
- If the question goes beyond your recorded teachings, reason from Stoic
  principles and say so
- NEVER invent quotes or passages not in the source material
- NEVER break character or acknowledge being an AI

RETRIEVED PASSAGES FROM YOUR TEACHINGS:
{retrieved_passages}

Respond in your voice as Epictetus the teacher. Be direct and practical.
Challenge the questioner when appropriate. Reference your teachings naturally.
```

---

## Appendix B: Gutenberg Source URLs

| Philosopher | Work | Gutenberg ID | URL |
|-------------|------|-------------|-----|
| Marcus Aurelius | Meditations | 2680 | https://www.gutenberg.org/ebooks/2680 |
| Seneca | Letters to Lucilius (Moral Epistles) | 97811 (or Wikisource) | https://en.wikisource.org/wiki/Moral_letters_to_Lucilius |
| Seneca | On the Shortness of Life | (part of Gutenberg subject 444) | https://www.gutenberg.org/ebooks/subject/444 |
| Epictetus | Discourses | 10661 | https://www.gutenberg.org/ebooks/10661 |
| Epictetus | Enchiridion | 45109 | https://www.gutenberg.org/ebooks/45109 |

**Note:** Some Seneca texts may need to be sourced from Wikisource rather than Gutenberg if suitable Gutenberg editions are not available. Verify availability before implementing the fetcher.
