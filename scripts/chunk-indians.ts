import type { TextChunk } from "./chunk-stoics";

// ─── Yoga Sutras of Patanjali (Gutenberg epub 2526, Johnston translation) ─────
//
// Structure: "BOOK I", "BOOK II", "BOOK III", "BOOK IV" as headings
// Sutras are numbered: "1.", "2.", "3.", etc.  followed by content + commentary.
// We chunk at the sutra level, grouping 3-5 sutras per chunk for context.

export function chunkYogaSutras(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Drop preamble before BOOK I
  const bookIStart = text.indexOf("\nBOOK I\n");
  if (bookIStart === -1) return chunks;
  const content = text.slice(bookIStart);

  const BOOK_NAMES: Record<string, string> = {
    "BOOK I": "Samadhi Pada (On Concentration)",
    "BOOK II": "Sadhana Pada (On Practice)",
    "BOOK III": "Vibhuti Pada (On Powers)",
    "BOOK IV": "Kaivalya Pada (On Liberation)",
  };

  // Split into book sections
  const bookSections = content.split(/\n(BOOK (?:I{1,3}|IV))\n/);

  let currentBook = "";
  let currentPadaName = "";

  for (let si = 0; si < bookSections.length; si++) {
    const section = bookSections[si].trim();
    if (section.match(/^BOOK (?:I{1,3}|IV)$/)) {
      currentBook = section;
      currentPadaName = BOOK_NAMES[currentBook] ?? currentBook;
      continue;
    }
    if (!currentBook || section.length < 50) continue;

    // Within each book, group sutras. Sutras are lines like "1. Text..."
    // The commentary follows as un-numbered paragraphs.
    const lines = section.split(/\n/);
    let sutraNum = 0;
    let sutraLines: string[] = [];
    let groupStart = 0;
    let groupChunks: Array<{ num: number; text: string }> = [];

    const flushGroup = () => {
      if (groupChunks.length === 0) return;
      const firstNum = groupChunks[0].num;
      const lastNum = groupChunks[groupChunks.length - 1].num;
      const ref =
        firstNum === lastNum
          ? `${currentPadaName}, Sutra ${firstNum}`
          : `${currentPadaName}, Sutras ${firstNum}–${lastNum}`;
      const combined = groupChunks.map((c) => c.text).join("\n\n");
      const trimmed = combined.replace(/\s+/g, " ").trim();
      if (trimmed.length > 80) {
        chunks.push({ workTitle: "Yoga Sutras", chapterRef: ref, content: trimmed });
      }
      groupChunks = [];
    };

    for (const line of lines) {
      const sutraMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (sutraMatch) {
        const num = parseInt(sutraMatch[1]);
        if (sutraLines.length > 0) {
          groupChunks.push({ num: sutraNum, text: sutraLines.join(" ").replace(/\s+/g, " ").trim() });
          sutraLines = [];
          // Flush every 4 sutras
          if (groupChunks.length >= 4) flushGroup();
        }
        sutraNum = num;
        sutraLines = sutraMatch[2] ? [sutraMatch[2]] : [];
      } else {
        const trimmed = line.trim();
        if (trimmed) sutraLines.push(trimmed);
      }
    }

    // Flush remaining
    if (sutraLines.length > 0 && sutraNum > 0) {
      groupChunks.push({ num: sutraNum, text: sutraLines.join(" ").replace(/\s+/g, " ").trim() });
    }
    flushGroup();
  }

  return chunks;
}

// ─── Dhammapada (Gutenberg epub 2017, Max Müller translation) ─────────────────
//
// Structure: "Chapter I. The Twin-Verses\n\n1. ...\n\n2. ..." etc.
// Chapters have thematic headings; verses are individually numbered.
// We chunk by chapter (group all verses in a chapter into one or two chunks).

export function chunkDhammapada(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Find start of actual content
  const contentStart = text.indexOf("Chapter I.");
  if (contentStart === -1) return chunks;
  const content = text.slice(contentStart);

  // Split into chapters
  const chapterParts = content.split(/\n(Chapter [IVXLC]+\. [^\n]+)\n/);

  for (let i = 1; i < chapterParts.length; i += 2) {
    const chapterTitle = chapterParts[i].trim();
    const chapterContent = chapterParts[i + 1] ?? "";

    // Collect individual verses
    const verses: string[] = [];
    const verseLines = chapterContent.split(/\n\n+/);
    for (const block of verseLines) {
      const trimmed = block.trim();
      if (trimmed.length > 20) verses.push(trimmed);
    }

    if (verses.length === 0) continue;

    // Group verses into chunks of ~6 each
    const GROUP_SIZE = 6;
    for (let v = 0; v < verses.length; v += GROUP_SIZE) {
      const group = verses.slice(v, v + GROUP_SIZE);
      const combined = group.join(" ").replace(/\s+/g, " ").trim();
      if (combined.length < 80) continue;

      const firstVerseMatch = group[0].match(/^(\d+)\./);
      const lastVerseMatch = group[group.length - 1].match(/^(\d+)\./);
      let ref = chapterTitle;
      if (firstVerseMatch && lastVerseMatch) {
        const first = firstVerseMatch[1];
        const last = lastVerseMatch[1];
        ref = first === last
          ? `${chapterTitle}, v.${first}`
          : `${chapterTitle}, v.${first}–${last}`;
      }

      chunks.push({ workTitle: "Dhammapada", chapterRef: ref, content: combined });
    }
  }

  return chunks;
}

// ─── The Upanishads (Gutenberg epub 3283, Swami Paramananda translation) ──────
//
// Contains: Isa, Katha, and Kena Upanishads.
// Structure: Upanishad name headings, then verse sections.
// We chunk by Upanishad + verse group, keeping Shankara's voice in mind.

export function chunkUpanishads(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // The Gutenberg text has TOC entries like "Isa-Upanishad" (no indent)
  // and body section headers like " Isa-Upanishad" (1 leading space).
  // We search for the body headers using the leading-space pattern.
  const UPANISHADS: Array<{ key: string; displayName: string }> = [
    { key: " Isa-Upanishad", displayName: "Isa Upanishad" },
    { key: " Katha-Upanishad", displayName: "Katha Upanishad" },
    { key: " Kena-Upanishad", displayName: "Kena Upanishad" },
  ];

  // Find the first body-header occurrence of each (skip the TOC)
  const sections: Array<{ start: number; end: number; displayName: string }> = [];

  for (const up of UPANISHADS) {
    // Find second occurrence (first is TOC, second is actual body header)
    let pos = text.indexOf(up.key);
    if (pos === -1) continue;
    const bodyPos = text.indexOf(up.key, pos + up.key.length);
    if (bodyPos === -1) continue; // only one occurrence — use it
    sections.push({ start: bodyPos, end: -1, displayName: up.displayName });
  }

  // Set end boundaries
  sections.sort((a, b) => a.start - b.start);
  for (let i = 0; i < sections.length; i++) {
    sections[i].end = i + 1 < sections.length ? sections[i + 1].start : text.length;
  }

  for (const { start, end, displayName } of sections) {
    const section = text.slice(start, end);
    const lines = section.split(/\n/);

    let currentSection = "";
    let buffer: string[] = [];
    let charCount = 0;

    const flush = () => {
      if (buffer.length === 0) return;
      const combined = buffer.join(" ").replace(/\s+/g, " ").trim();
      if (combined.length > 80) {
        chunks.push({
          workTitle: "Upanishads",
          chapterRef: `${displayName}${currentSection ? `, ${currentSection}` : ""}`,
          content: combined,
        });
      }
      buffer = [];
      charCount = 0;
    };

    for (const line of lines) {
      const trimmed = line.trim();

      // Part/section headers like "PART I.", "I.", "THE FIRST VALLI"
      const sectionMatch = trimmed.match(/^(PART [IVXLC]+\.?|THE [A-Z]+ (?:VALLI|ADHYAYA|CHAPTER))$/);
      if (sectionMatch) {
        if (charCount > 400) flush();
        currentSection = sectionMatch[1];
        continue;
      }

      // Roman numeral verse markers like "I.", "II." on their own line
      const romanLine = trimmed.match(/^([IVXLC]+)\.$/)
      if (romanLine && romanLine[1].length <= 4) {
        if (charCount > 500) flush();
        // Don't change section label, just use as a soft break
        continue;
      }

      // "Peace Chant" is a named section
      if (trimmed === "Peace Chant") {
        if (charCount > 400) flush();
        currentSection = "Peace Chant";
        continue;
      }

      if (trimmed.length < 3) {
        if (charCount > 600) flush();
        continue;
      }

      buffer.push(trimmed);
      charCount += trimmed.length;
    }
    flush();
  }

  return chunks;
}

// ─── Merge short chunks ───────────────────────────────────────────────────────
// (same helper as in chunk-stoics, re-exported here for convenience)

export function mergeShortChunksIndian(chunks: TextChunk[], minLength: number): TextChunk[] {
  const result: TextChunk[] = [];
  for (const chunk of chunks) {
    if (result.length > 0 && result[result.length - 1].content.length < minLength) {
      result[result.length - 1].content += " " + chunk.content;
    } else {
      result.push({ ...chunk });
    }
  }
  return result;
}
