# Adding a Philosopher

This guide walks through every step required to add a new philosopher to Ask the Ancients — from sourcing texts to passing the eval before merge.

---

## 0. Licensing First

Before writing any code, confirm the corpus texts are permissively licensed.

**Acceptable licenses:**
- Public domain (pre-1928 in the US, or expired copyright)
- Project Gutenberg texts (always public domain)
- Creative Commons Zero (CC0)

**Not acceptable:**
- CC BY-SA (copyleft — propagates to the app)
- Any "non-commercial" restriction
- Texts that require attribution in every rendered citation

If you are unsure, open an issue using the philosopher request template and we will advise.

---

## 1. Database Seed Record

Add the philosopher to the seed data. The required fields map directly to the `philosophers` table schema:

```typescript
{
  slug: "plato",                    // URL-safe, lowercase, hyphenated
  name: "Plato",
  school: "Platonism",              // School or movement
  tradition: "Western",
  era: "428–348 BCE",
  tagline: "Knowledge is virtue.",  // One sentence
  bio: "...",                       // 2–3 sentences shown on profile page
  avatarUrl: "/avatars/plato.png",  // Place image in public/avatars/
  systemPrompt: "...",              // See System Prompt Template below
  greeting: "...",                  // Opening message shown in new chats
  works: [
    {
      title: "Republic",
      shortTitle: "Republic",
      sourceUrl: "https://www.gutenberg.org/cache/epub/1497/pg1497.txt",
    },
    // Add one entry per ingested work
  ],
  isActive: true,
  sortOrder: 4,                     // Controls display order in the grid
}
```

Add the entry to `convex/seed.ts` (or run a one-time mutation via the Convex dashboard for production).

---

## 2. Avatar Image

- Generate or source a marble bust illustration (512×512 PNG)
- File name must match `avatarUrl` in the seed record
- Place in `public/avatars/`
- Describe the generation prompt used in your PR description for reproducibility

---

## 3. System Prompt Template

The system prompt shapes the philosopher's voice for every reply. Follow this structure closely:

```
You are [Name], the [era] [tradition] philosopher. You speak in the first person,
from within your lifetime ([birth]–[death] CE/BCE).

VOICE AND TONE:
- [Key characteristic of their writing style — e.g., "Direct and aphoristic" / "Socratic and questioning"]
- [Second characteristic — e.g., "Blends personal reflection with universal principle"]
- [Third characteristic — e.g., "Uses vivid analogies drawn from daily Roman life"]

PHILOSOPHICAL CORE:
- [Central doctrine 1 in 1 sentence]
- [Central doctrine 2 in 1 sentence]
- [Central doctrine 3 in 1 sentence]

CITATION RULES:
- Cite retrieved passages naturally within your answer using the work title and section reference.
- Never invent citations. Only reference passages that appear in the CONTEXT block.
- If no passage is directly relevant, acknowledge the gap rather than fabricating one.

BOUNDARIES:
- Do not claim knowledge of events after [death year].
- Do not use anachronistic language or modern idioms.
- If asked about topics outside your philosophical scope, redirect thoughtfully.
```

**Quality bar:** the system prompt must produce responses that pass the citation faithfulness eval (see step 6).

---

## 4. Corpus Ingestion

### 4a. Add a chunker function

Gutenberg plain-text files have no consistent structure across works. You must write a chunker tailored to your specific epub ID.

Add a function to `scripts/chunk-stoics.ts` (or a new file if the philosopher is not Stoic):

```typescript
export function chunkPlato(text: string): TextChunk[] {
  // Split on Stephanus numbers, chapter headings, or dialogue breaks
  // Each chunk should be ~300–600 tokens (roughly 200–400 words)
  // Return: Array<{ chapterRef: string; content: string }>
}
```

**Chunking guidelines:**
- Keep semantic units together (don't cut mid-argument)
- `chapterRef` should be human-readable: `"Book VII, 514a"` not `"chunk_43"`
- Aim for 300–600 tokens per chunk — larger chunks reduce precision; smaller chunks lose context
- Test with `bun run ingest:dry-run` before touching the database

### 4b. Register the source

Add entries to the `SOURCES` array in `scripts/ingest-texts.ts`:

```typescript
{
  philosopher: "plato",
  workTitle: "Republic",
  url: "https://www.gutenberg.org/cache/epub/1497/pg1497.txt",
  chunker: (text) => chunkPlato(text),
},
```

### 4c. Dry-run verification

```bash
bun run ingest:dry-run
```

Confirm the chunk counts match expectations before writing to Convex. Log the expected counts in your PR description.

### 4d. Ingest

```bash
bun run ingest
```

---

## 5. Attribution Record

Add every new text to `ATTRIBUTION.md`:

```markdown
| Plato | Republic | Project Gutenberg #1497 | https://www.gutenberg.org/ebooks/1497 | Public domain (Jowett translation, 1871) | CC0 | 2026-03-01 | Stephanus sections |
```

Fields: Philosopher, Work, Source ID, URL, License rationale, SPDX identifier, Ingestion date, Chunking method.

---

## 6. Eval Checklist

Before merging, run the eval harness and attach the output to your PR:

```bash
bun run eval
```

The eval runs a fixed set of test questions against the new philosopher and scores citation faithfulness (did the response reference only retrieved passages?) and response relevance.

**Minimum bar to merge:**
- Citation precision ≥ 0.8 (no more than 20% hallucinated citations)
- No fabricated quotes that contradict the source texts
- Greeting renders without errors in the UI

---

## Checklist Summary

- [ ] License confirmed (public domain or CC0)
- [ ] Seed record added with all required fields
- [ ] Avatar image in `public/avatars/`
- [ ] System prompt follows the template and passes manual review
- [ ] Chunker function written and dry-run verified
- [ ] Source registered in `ingest-texts.ts`
- [ ] Corpus ingested to dev Convex deployment
- [ ] Attribution entry added to `ATTRIBUTION.md`
- [ ] Eval harness passes (citation precision ≥ 0.8)
- [ ] PR includes dry-run chunk counts and eval output
