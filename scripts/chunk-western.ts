import { mergeShortChunks } from "./chunk-stoics";
import type { TextChunk } from "./chunk-stoics";

// ─── Nicomachean Ethics of Aristotle (Gutenberg epub 8438, Ross translation) ──
//
// Structure:
//   "BOOK I" on its own line (all caps), then blank line, then
//   "Chapter I." on its own line, then blank line, then paragraphs.
//   Books I–X; chapters numbered with Roman numeral + period.
//
// We chunk at the Book+Chapter level.  Each Chapter becomes one chunk
// (the ingest pipeline's splitOverlongChunk will further break up long ones).

export function chunkNicomacheanEthics(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Skip preamble — find first "BOOK I" as its own line
  const bookIStart = text.search(/\nBOOK I\n/);
  if (bookIStart === -1) return chunks;
  const content = text.slice(bookIStart);

  const lines = content.split(/\r?\n/);

  let currentBook = "";
  let currentChapter = "";
  let currentLines: string[] = [];

  function flush() {
    if (!currentBook || currentLines.length === 0) {
      currentLines = [];
      return;
    }
    const combined = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (combined.length > 80) {
      const ref = currentChapter
        ? `${currentBook}, ${currentChapter}`
        : currentBook;
      chunks.push({
        workTitle: "Nicomachean Ethics",
        chapterRef: ref,
        content: combined,
      });
    }
    currentLines = [];
  }

  for (const line of lines) {
    // Book headings: "BOOK I", "BOOK II", ... (all caps, standalone line)
    const bookMatch = line.match(/^BOOK ([IVXLC]+)$/);
    if (bookMatch) {
      flush();
      currentBook = `Book ${bookMatch[1]}`;
      currentChapter = "";
      continue;
    }

    // Chapter headings: "Chapter I.", "Chapter II.", etc. (standalone line)
    const chapterMatch = line.match(/^Chapter ([IVXLC]+)\.\s*$/);
    if (chapterMatch) {
      flush();
      currentChapter = `Chapter ${chapterMatch[1]}`;
      continue;
    }

    const trimmed = line.trim();
    if (trimmed) currentLines.push(trimmed);
  }

  flush();
  return mergeShortChunks(chunks, 150);
}

// ─── Ethics of Spinoza (Gutenberg epub 3800, Elwes translation) ───────────────
//
// Structure:
//   Parts I–V, each with:
//     DEFINITIONS section (multiple numbered definitions)
//     AXIOMS section (multiple numbered axioms)
//     PROPOSITIONS section: "PROP. I.", "PROP. II.", ... each followed by
//       Proof, Corollary, Note/Scholium paragraphs.
//
// Part heading variants in the text:
//   "PART I. CONCERNING GOD."   (all caps)
//   "Part II."                  (mixed case)
//   "PART III."                 (all caps)
//   "PART IV:"                  (all caps)
//   "PART V:"                   (all caps)
//
// Chunking strategy:
//   - One chunk for all Definitions of a Part
//   - One chunk for all Axioms of a Part
//   - One chunk per Proposition (PROP + Proof + Notes/Scholia)
//     Large propositions are handled by the ingest pipeline's splitOverlongChunk.

const PART_NAMES: Record<string, string> = {
  "I": "Part I (On God)",
  "II": "Part II (On the Mind)",
  "III": "Part III (On the Emotions)",
  "IV": "Part IV (On Human Bondage)",
  "V": "Part V (On Human Freedom)",
};

export function chunkSpinozaEthics(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Find the start of actual content — first PART heading
  const startIdx = text.search(/\nPART I[. ]/i);
  if (startIdx === -1) return chunks;
  const content = text.slice(startIdx);
  const lines = content.split(/\r?\n/);

  let currentPart = "";
  let currentSection: "definitions" | "axioms" | "proposition" | "none" = "none";
  let currentPropRef = "";
  let currentLines: string[] = [];

  function flush() {
    if (currentLines.length === 0) return;
    const combined = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (combined.length < 50) {
      currentLines = [];
      return;
    }

    let chapterRef: string;
    if (currentSection === "definitions") {
      chapterRef = `${currentPart}, Definitions`;
    } else if (currentSection === "axioms") {
      chapterRef = `${currentPart}, Axioms`;
    } else if (currentSection === "proposition" && currentPropRef) {
      chapterRef = `${currentPart}, ${currentPropRef}`;
    } else {
      // Preamble/preface content — attach to current part
      chapterRef = currentPart || "Ethics";
    }

    chunks.push({
      workTitle: "Ethics",
      chapterRef,
      content: combined,
    });
    currentLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Part headings — match all variants
    // "PART I. CONCERNING GOD.", "Part II.", "PART III.", "PART IV:", "PART V:"
    const partMatch = trimmed.match(
      /^PART\s+(I{1,3}|IV|V)[.:, ]/i
    );
    if (partMatch) {
      flush();
      const romanPart = partMatch[1].toUpperCase();
      currentPart = PART_NAMES[romanPart] ?? `Part ${romanPart}`;
      currentSection = "none";
      currentPropRef = "";
      continue;
    }

    // DEFINITIONS section header
    if (trimmed === "DEFINITIONS" || trimmed === "DEFINITION") {
      flush();
      currentSection = "definitions";
      continue;
    }

    // AXIOMS section header
    if (trimmed === "AXIOMS" || trimmed === "AXIOM") {
      flush();
      currentSection = "axioms";
      continue;
    }

    // PROPOSITIONS section header (just the word "PROPOSITIONS")
    if (trimmed === "PROPOSITIONS") {
      // Don't flush here — stay in current section context until we see PROP.
      continue;
    }

    // Proposition heading: "PROP. I.  ..." or "PROP. I."
    const propMatch = trimmed.match(/^PROP\.\s+([IVXLC]+)\.\s*(.*)/i);
    if (propMatch) {
      flush();
      currentSection = "proposition";
      const propRoman = propMatch[1].toUpperCase();
      currentPropRef = `Prop. ${propRoman}`;
      const rest = propMatch[2]?.trim() ?? "";
      if (rest) currentLines.push(rest);
      continue;
    }

    // Skip blank lines but use them as soft chunk boundaries within long propositions
    if (trimmed.length === 0) {
      // If current proposition content is very long, flush it
      if (
        currentSection === "proposition" &&
        currentLines.join(" ").length > 2000
      ) {
        flush();
        // Keep propRef so continuation goes to same ref (ingest will suffix Part N)
      }
      continue;
    }

    // Skip standalone "APPENDIX:" lines (they follow PROP. XXXVI in Part I)
    if (trimmed.startsWith("APPENDIX")) {
      if (currentLines.length > 0) flush();
      // treat appendix content as a definitions-style chunk
      currentSection = "definitions";
      continue;
    }

    // POSTULATES section (appears in Part II after Prop. XIII)
    if (trimmed === "POSTULATES") {
      flush();
      currentSection = "axioms"; // treat as axioms-style grouping
      continue;
    }

    currentLines.push(trimmed);
  }

  flush();
  return mergeShortChunks(chunks, 150);
}
