import { fetchGutenbergText } from "./fetch-gutenberg";
import {
  chunkMeditations,
  chunkDiscourses,
  chunkEnchiridion,
  chunkSenecaDialogue,
  type TextChunk,
} from "./chunk-stoics";

interface Source {
  workTitle: string;
  url: string;
  chunker: (text: string) => TextChunk[];
}

const SENECA_MINOR_DIALOGUES_URL =
  "https://www.gutenberg.org/cache/epub/64576/pg64576.txt";

const SOURCES: Source[] = [
  {
    workTitle: "Meditations",
    url: "https://www.gutenberg.org/cache/epub/2680/pg2680.txt",
    chunker: (text) => chunkMeditations(text),
  },
  {
    workTitle: "Discourses",
    url: "https://www.gutenberg.org/cache/epub/10661/pg10661.txt",
    chunker: (text) => chunkDiscourses(text),
  },
  {
    workTitle: "Enchiridion",
    url: "https://www.gutenberg.org/cache/epub/45109/pg45109.txt",
    chunker: (text) => chunkEnchiridion(text),
  },
  {
    workTitle: "On the Shortness of Life",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) =>
      chunkSenecaDialogue(text, "OF THE SHORTNESS OF LIFE.", "On the Shortness of Life"),
  },
  {
    workTitle: "On the Happy Life",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) => chunkSenecaDialogue(text, "OF A HAPPY LIFE.", "On the Happy Life"),
  },
  {
    workTitle: "On Peace of Mind",
    url: SENECA_MINOR_DIALOGUES_URL,
    chunker: (text) => chunkSenecaDialogue(text, "OF PEACE OF MIND.", "On Peace of Mind"),
  },
];

async function main() {
  const cache = new Map<string, string>();
  let total = 0;

  console.log("Dry-run chunking report");
  console.log("=======================");

  for (const source of SOURCES) {
    let text = cache.get(source.url);
    if (!text) {
      text = await fetchGutenbergText(source.url);
      cache.set(source.url, text);
    }

    const chunks = source.chunker(text);
    total += chunks.length;

    const first = chunks[0];
    const last = chunks[chunks.length - 1];
    console.log(`\n${source.workTitle}`);
    console.log(`  chunks: ${chunks.length}`);
    if (first) console.log(`  first: ${first.chapterRef}`);
    if (last) console.log(`  last:  ${last.chapterRef}`);
  }

  console.log(`\nTotal chunks: ${total}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
