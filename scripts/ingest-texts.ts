import OpenAI from "openai";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import type { Id } from "../convex/_generated/dataModel";
import { fetchGutenbergText } from "./fetch-gutenberg";
import {
  chunkMeditations,
  chunkDiscourses,
  chunkEnchiridion,
  chunkSenecaDialogue,
  type TextChunk,
} from "./chunk-stoics";
import {
  chunkYogaSutras,
  chunkDhammapada,
  chunkUpanishads,
  mergeShortChunksIndian,
} from "./chunk-indians";
import { MAHAVIRA_CURATED_CHUNKS } from "./mahavira-texts";
import {
  chunkNicomacheanEthics,
  chunkSpinozaEthics,
} from "./chunk-western";
import { RAMANUJA_CURATED_CHUNKS } from "./ramanuja-texts";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

interface Source {
  philosopher: PhilosopherSlug;
  workTitle: string;
  url: string;
  chunker: (text: string) => TextChunk[];
}

interface CuratedSource {
  philosopher: PhilosopherSlug;
  chunks: TextChunk[];
}

const STOIC_SLUGS = ["marcus-aurelius", "seneca", "epictetus"] as const;
const INDIAN_SLUGS = ["patanjali", "shankaracharya", "buddha", "mahavira"] as const;
const WAVE3_SLUGS = ["aristotle", "ramanuja", "spinoza"] as const;
const PHILOSOPHER_SLUGS = [...STOIC_SLUGS, ...INDIAN_SLUGS, ...WAVE3_SLUGS] as const;
type PhilosopherSlug = (typeof PHILOSOPHER_SLUGS)[number];

async function resolvePhilosopherIds(
  convex: ConvexHttpClient
): Promise<Record<PhilosopherSlug, Id<"philosophers">>> {
  const entries = await Promise.all(
    PHILOSOPHER_SLUGS.map(async (slug) => {
      const phil = await convex.query(api.philosophers.getBySlug, { slug });
      if (!phil) throw new Error(`Missing philosopher in DB for slug "${slug}". Run seed first.`);
      return [slug, phil._id] as const;
    })
  );
  return Object.fromEntries(entries) as Record<PhilosopherSlug, Id<"philosophers">>;
}

// Seneca's Minor Dialogues (epub 64576) contains:
//   On Providence, On Constancy, On Anger (3 books), Consolation to Marcia,
//   On the Happy Life, On Tranquility of Mind, On Leisure,
//   On the Shortness of Life, Consolation to Helvia, Consolation to Polybius,
//   On Clemency (2 books)
const SENECA_MINOR_DIALOGUES_URL =
  "https://www.gutenberg.org/cache/epub/64576/pg64576.txt";

const SOURCES: Source[] = [
  {
    philosopher: "marcus-aurelius",
    workTitle: "Meditations",
    url: "https://www.gutenberg.org/cache/epub/2680/pg2680.txt",
    chunker: (text) => chunkMeditations(text),
  },
  {
    // epub 10661 = "A Selection from the Discourses of Epictetus with the Encheiridion"
    // chunkDiscourses extracts only the Discourses section (before the Enchiridion)
    philosopher: "epictetus",
    workTitle: "Discourses",
    url: "https://www.gutenberg.org/cache/epub/10661/pg10661.txt",
    chunker: (text) => chunkDiscourses(text),
  },
  {
    // epub 45109 = standalone Enchiridion (Higginson translation)
    philosopher: "epictetus",
    workTitle: "Enchiridion",
    url: "https://www.gutenberg.org/cache/epub/45109/pg45109.txt",
    chunker: (text) => chunkEnchiridion(text),
  },
  {
    philosopher: "seneca",
    workTitle: "On the Shortness of Life",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) =>
      chunkSenecaDialogue(text, "OF THE SHORTNESS OF LIFE.", "On the Shortness of Life"),
  },
  {
    philosopher: "seneca",
    workTitle: "On the Happy Life",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) =>
      chunkSenecaDialogue(text, "OF A HAPPY LIFE.", "On the Happy Life"),
  },
  {
    philosopher: "seneca",
    workTitle: "On Peace of Mind",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) =>
      chunkSenecaDialogue(text, "OF PEACE OF MIND.", "On Peace of Mind"),
  },
  // ── Indian texts ─────────────────────────────────────────────────────────
  {
    // epub 2526 = Johnston translation of Yoga Sutras of Patanjali
    philosopher: "patanjali",
    workTitle: "Yoga Sutras",
    url: "https://www.gutenberg.org/cache/epub/2526/pg2526.txt",
    chunker: (text) => mergeShortChunksIndian(chunkYogaSutras(text), 150),
  },
  {
    // epub 2017 = Max Müller translation of Dhammapada
    philosopher: "buddha",
    workTitle: "Dhammapada",
    url: "https://www.gutenberg.org/cache/epub/2017/pg2017.txt",
    chunker: (text) => mergeShortChunksIndian(chunkDhammapada(text), 150),
  },
  {
    // epub 3283 = Swami Paramananda translation of Upanishads (Isa, Katha, Kena)
    philosopher: "shankaracharya",
    workTitle: "Upanishads",
    url: "https://www.gutenberg.org/cache/epub/3283/pg3283.txt",
    chunker: (text) => mergeShortChunksIndian(chunkUpanishads(text), 150),
  },
  // ── Wave-3 texts ──────────────────────────────────────────────────────────
  {
    // epub 8438 = Ross translation of Aristotle's Nicomachean Ethics
    philosopher: "aristotle",
    workTitle: "Nicomachean Ethics",
    url: "https://www.gutenberg.org/cache/epub/8438/pg8438.txt",
    chunker: (text) => chunkNicomacheanEthics(text),
  },
  {
    // epub 3800 = Elwes translation of Spinoza's Ethics
    philosopher: "spinoza",
    workTitle: "Ethics",
    url: "https://www.gutenberg.org/cache/epub/3800/pg3800.txt",
    chunker: (text) => chunkSpinozaEthics(text),
  },
];

// ── Curated sources (no URL fetch needed) ─────────────────────────────────────
const CURATED_SOURCES: CuratedSource[] = [
  {
    philosopher: "mahavira",
    chunks: MAHAVIRA_CURATED_CHUNKS,
  },
  {
    philosopher: "ramanuja",
    chunks: RAMANUJA_CURATED_CHUNKS,
  },
];

function splitOverlongChunk(
  chunk: TextChunk,
  maxChars: number
): TextChunk[] {
  if (chunk.content.length <= maxChars) return [chunk];

  const words = chunk.content.split(/\s+/).filter(Boolean);
  const parts: TextChunk[] = [];
  let buffer: string[] = [];
  let part = 1;

  for (const word of words) {
    const candidate = buffer.length === 0 ? word : `${buffer.join(" ")} ${word}`;
    if (candidate.length > maxChars && buffer.length > 0) {
      parts.push({
        ...chunk,
        chapterRef: `${chunk.chapterRef}, Part ${part}`,
        content: buffer.join(" "),
      });
      buffer = [word];
      part++;
    } else {
      buffer.push(word);
    }
  }

  if (buffer.length > 0) {
    parts.push({
      ...chunk,
      chapterRef: `${chunk.chapterRef}, Part ${part}`,
      content: buffer.join(" "),
    });
  }

  return parts;
}

function normalizeChunksForEmbedding(
  chunks: TextChunk[],
  maxChars: number
): TextChunk[] {
  return chunks.flatMap((chunk) => splitOverlongChunk(chunk, maxChars));
}

async function embedTexts(texts: string[], openai: OpenAI): Promise<number[][]> {
  const BATCH = 100;
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });
    embeddings.push(...res.data.map((d) => d.embedding));
    process.stdout.write(`  Embedded ${Math.min(i + BATCH, texts.length)}/${texts.length}\r`);
    // Rate limit: small delay between batches
    if (i + BATCH < texts.length) await new Promise(r => setTimeout(r, 200));
  }
  console.log();
  return embeddings;
}

async function ingestChunks(
  label: string,
  chunks: TextChunk[],
  philosopherId: Id<"philosophers">,
  workTitle: string,
  convex: ConvexHttpClient,
  openai: OpenAI
): Promise<number> {
  const normalized = normalizeChunksForEmbedding(chunks, 6000);
  console.log(`  Chunked into ${normalized.length} passages (embedding-safe)`);

  if (normalized.length === 0) {
    console.log("  No chunks — skipping");
    return 0;
  }

  console.log("  Generating embeddings...");
  const embeddings = await embedTexts(normalized.map((c) => c.content), openai);

  const clearResult = await convex.mutation(api.ingest.clearByWork, {
    philosopherId,
    workTitle,
  });
  console.log(`  Cleared ${clearResult.deleted} existing chunks for this work`);

  const payload = normalized.map((chunk, i) => ({
    philosopherId,
    workTitle: chunk.workTitle,
    chapterRef: chunk.chapterRef,
    content: chunk.content,
    embedding: embeddings[i],
  }));

  const BATCH_SIZE = 50;
  let inserted = 0;
  for (let i = 0; i < payload.length; i += BATCH_SIZE) {
    const batch = payload.slice(i, i + BATCH_SIZE);
    const result = await convex.mutation(api.ingest.batchInsert, { chunks: batch });
    inserted += result.inserted;
    process.stdout.write(`  Inserted ${inserted}/${payload.length}\r`);
  }
  console.log(`  Inserted ${inserted} chunks`);
  return inserted;
}

async function main() {
  console.log("Ask the Ancients — Source Text Ingestion");
  console.log("==========================================");

  // Optional: pass slugs as CLI args to ingest only specific philosophers
  // e.g.: bun scripts/ingest-texts.ts patanjali buddha
  const filterSlugs = process.argv.slice(2);
  if (filterSlugs.length > 0) {
    console.log(`  Filtering to: ${filterSlugs.join(", ")}`);
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
  const convex = new ConvexHttpClient(CONVEX_URL);
  const philosopherIds = await resolvePhilosopherIds(convex);

  // Cache fetched URLs to avoid re-downloading the same file for multiple works
  const urlCache = new Map<string, string>();
  let totalChunks = 0;

  // ── URL-based sources ──────────────────────────────────────────────────────
  for (const source of SOURCES) {
    if (filterSlugs.length > 0 && !filterSlugs.includes(source.philosopher)) continue;

    console.log(`\n[${source.philosopher}] ${source.workTitle}`);

    let rawText: string;
    if (urlCache.has(source.url)) {
      rawText = urlCache.get(source.url)!;
      console.log(`  Using cached text (${rawText.length} chars)`);
    } else {
      console.log("  Fetching text...");
      try {
        rawText = await fetchGutenbergText(source.url);
        urlCache.set(source.url, rawText);
      } catch (e) {
        console.error(`  ERROR fetching: ${e}`);
        continue;
      }
      console.log(`  Fetched ${rawText.length} chars`);
    }

    const chunks = source.chunker(rawText);
    const philosopherId = philosopherIds[source.philosopher];
    const inserted = await ingestChunks(
      `${source.philosopher}/${source.workTitle}`,
      chunks,
      philosopherId,
      source.workTitle,
      convex,
      openai
    );
    totalChunks += inserted;
  }

  // ── Curated sources ────────────────────────────────────────────────────────
  for (const source of CURATED_SOURCES) {
    if (filterSlugs.length > 0 && !filterSlugs.includes(source.philosopher)) continue;
    if (source.chunks.length === 0) continue;

    const workTitle = source.chunks[0].workTitle;
    console.log(`\n[${source.philosopher}] ${workTitle} (curated)`);

    const philosopherId = philosopherIds[source.philosopher];
    const inserted = await ingestChunks(
      `${source.philosopher}/${workTitle}`,
      source.chunks,
      philosopherId,
      workTitle,
      convex,
      openai
    );
    totalChunks += inserted;
  }

  console.log(`\nTotal chunks inserted: ${totalChunks}`);
}

main().catch(console.error);
