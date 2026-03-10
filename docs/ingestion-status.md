# Ingestion Pipeline — Current Status

## What We're Doing
Running `bun run ingest` to embed ~600–700 source text chunks into Convex (`sourceTexts` table) for RAG. OpenAI `text-embedding-3-small` is the embedding model. The user has $10 credit available.

## Bugs Found & Fixed

### 1. Meditations chunking (was: 1 chunk, should be ~420)
- **Problem**: `chunkMeditations` looked for `BOOK I`, `BOOK II` and Arabic `1.`, `2.` — but Gutenberg epub 2680 uses `THE FIRST BOOK`, `THE SECOND BOOK` and Roman numeral reflections `I.`, `II.`
- **Fix**: Updated regex to match `THE (FIRST|SECOND|...) BOOK` and `^([IVXLCDM]+)\. ` with an `isRomanNumeral` validator capped at 500 to avoid false positives (e.g. `M.` at the start of a wrapped line).

### 2. Discourses chunking (was: 1 chunk, should be ~40+)
- **Problem A**: `chunkDiscourses` looked for `CHAPTER [IVX...]` headers. epub 10661 has no such headers — chapters are ALL-CAPS descriptions ending with `.—` em-dash (e.g. `OF THE THINGS WHICH ARE IN OUR POWER AND NOT IN OUR POWER.—Of all the...`)
- **Problem B**: `text.indexOf("THE ENCHEIRIDION, OR MANUAL.")` matched the TOC entry (index 189) instead of the real section — the TOC entry has a leading space (` THE ENCHEIRIDION`) but the actual section header doesn't. Fix: search for `"\nTHE ENCHEIRIDION, OR MANUAL.\n"`.
- **Fix**: Rewritten to detect `.—` em-dash (U+2014) chapter boundaries and corrected the Enchiridion section search.

### 3. Enchiridion chunking (was: 0 chunks, should be ~52)
- **Problem**: epub 45109 uses centered Roman numerals (`"                                   I"`). `fetchGutenbergText` collapses all whitespace runs to a single space, so `\s{15,}` never matches.
- **Fix**: Pattern updated to `\n ([IVXLCDM]+) *\n` (single leading space after newline).

### 4. Seneca URLs (both broken)
- **Problem A**: `pg97811.txt` (Letters to Lucilius) → HTTP 404. Seneca's Letters are not available in English on Gutenberg.
- **Problem B**: `pg1830.txt` (On the Shortness of Life) → HTTP 200 but wrong book — it's "Wyndham Towers" by Thomas Bailey Aldrich.
- **Fix**: Both Seneca sources now use epub 64576 (Seneca's *Minor Dialogues*, Aubrey Stewart translation) with a new `chunkSenecaDialogue(text, sectionTitle, workTitle)` function that extracts the right section by title:
  - `"OF THE SHORTNESS OF LIFE."` → *On the Shortness of Life* (~20 chunks)
  - `"OF A HAPPY LIFE."` → *On the Happy Life* (~28 chunks)
  - `"OF PEACE OF MIND."` → *On Peace of Mind* (~17 chunks)

## Current State
All fixes are applied in `scripts/chunk-stoics.ts` and `scripts/ingest-texts.ts`. TypeScript typecheck passes. Dry-run test was interrupted before completion.

## Next Steps
1. Verify dry-run chunk counts: `bun run - < scripts/dry-run-test.ts` (or just run the ingest)
2. Run `bun run ingest` to embed and insert all chunks
3. Expected total: ~537 chunks (420 Meditations + ~45 Discourses + ~52 Enchiridion + ~65 Seneca)
4. Proceed to M1 Phase 4 (UI)
