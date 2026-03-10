export interface TextChunk {
  workTitle: string;
  chapterRef: string;
  content: string;
}

// ─── Roman numeral helpers ────────────────────────────────────────────────────

function isRomanNumeral(s: string): boolean {
  // Validates a Roman numeral string in a stoic-text range (1–500).
  // Capped at 500 to avoid matching stray words that start with M/D/C/L/X/V/I.
  if (!/^M{0,1}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return false;
  return s.length > 0 && romanToInt(s) <= 500 && romanToInt(s) >= 1;
}

function romanToInt(s: string): number {
  const vals: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let result = 0;
  for (let i = 0; i < s.length; i++) {
    const curr = vals[s[i]];
    const next = vals[s[i + 1]] ?? 0;
    result += curr < next ? -curr : curr;
  }
  return result;
}

// ─── Meditations (epub 2680) ──────────────────────────────────────────────────
// Books: "THE FIRST BOOK", "THE SECOND BOOK", etc. on standalone lines
// Reflections: Roman numerals at start of line, e.g. "I. Of my grandfather..."

const ORDINAL_TO_ROMAN: Record<string, string> = {
  FIRST: "I", SECOND: "II", THIRD: "III", FOURTH: "IV", FIFTH: "V",
  SIXTH: "VI", SEVENTH: "VII", EIGHTH: "VIII", NINTH: "IX", TENTH: "X",
  ELEVENTH: "XI", TWELFTH: "XII",
};

export function chunkMeditations(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const lines = text.split(/\r?\n/);

  let currentBook = "";
  let currentRef = "";
  let currentLines: string[] = [];
  let inContent = false;

  function flush() {
    if (!currentBook || currentLines.length === 0) { currentLines = []; return; }
    const content = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (content.length > 50) {
      chunks.push({ workTitle: "Meditations", chapterRef: currentRef, content });
    }
    currentLines = [];
  }

  for (const line of lines) {
    // Book headers: "THE FIRST BOOK" etc. (exact line, possibly with trailing spaces)
    const bookMatch = line.trim().match(
      /^THE\s+(FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH)\s+BOOK$/
    );
    if (bookMatch) {
      flush();
      const roman = ORDINAL_TO_ROMAN[bookMatch[1]];
      currentBook = `Book ${roman}`;
      currentRef = currentBook;
      inContent = true;
      continue;
    }

    if (!inContent) continue;

    // Reflection markers: Roman numeral at start of line followed by ". "
    const reflMatch = line.match(/^([IVXLCDM]+)\.\s+(.*)/);
    if (reflMatch && isRomanNumeral(reflMatch[1])) {
      flush();
      currentRef = `${currentBook}, §${reflMatch[1]}`;
      currentLines = reflMatch[2] ? [reflMatch[2].trim()] : [];
      continue;
    }

    const trimmed = line.trim();
    if (trimmed) currentLines.push(trimmed);
  }

  flush();
  return mergeShortChunks(chunks, 100);
}

// ─── Discourses (epub 10661) ──────────────────────────────────────────────────
// epub 10661 contains BOTH Discourses and Enchiridion in one file.
// Discourses chapters are delimited by ALL-CAPS headings ending with ".\u2014" (em-dash).
// The heading and the first sentence appear on the same line: "TITLE.—First sentence..."

export function chunkDiscourses(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];
  const EM_DASH = "\u2014";

  // Only take the Discourses section (before the Enchiridion).
  // After fetchGutenbergText, the TOC entry is " THE ENCHEIRIDION..." (leading space)
  // but the actual section header is "THE ENCHEIRIDION..." (no leading space).
  // Search for the section header with a preceding newline to avoid the TOC entry.
  const enchiridionMarker = "\nTHE ENCHEIRIDION, OR MANUAL.";
  const endIdx = text.indexOf(enchiridionMarker);
  const discoursesText = endIdx > 0 ? text.slice(0, endIdx) : text;

  const lines = discoursesText.split(/\r?\n/);

  let chapterNum = 0;
  let currentTitle = "";
  let currentLines: string[] = [];

  function flush() {
    if (currentLines.length === 0) return;

    const paragraphs = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (paragraphs.length < 50) { currentLines = []; return; }

    // Split long chapters into parts (~800 chars each)
    if (paragraphs.length <= 900) {
      chunks.push({ workTitle: "Discourses", chapterRef: currentTitle, content: paragraphs });
    } else {
      const words = paragraphs.split(" ");
      let part = 1;
      let acc: string[] = [];
      for (const word of words) {
        acc.push(word);
        if (acc.join(" ").length > 800) {
          chunks.push({ workTitle: "Discourses", chapterRef: `${currentTitle}, Part ${part}`, content: acc.join(" ").trim() });
          acc = [];
          part++;
        }
      }
      if (acc.length > 0 && acc.join(" ").trim().length > 50) {
        chunks.push({ workTitle: "Discourses", chapterRef: `${currentTitle}, Part ${part}`, content: acc.join(" ").trim() });
      }
    }
    currentLines = [];
  }

  for (const line of lines) {
    const emIdx = line.indexOf(EM_DASH);
    if (emIdx > 5) {
      const beforeDash = line.slice(0, emIdx).replace(/\.$/, "").trim();
      // Chapter header: mostly uppercase, ends with period before em-dash
      if (beforeDash.length > 5 && /^[A-Z][A-Z ,.']+$/.test(beforeDash)) {
        flush();
        chapterNum++;
        // Truncate very long titles to 6 words for the ref
        const titleWords = beforeDash.split(/\s+/).slice(0, 6).join(" ");
        currentTitle = `Ch. ${chapterNum}: ${titleWords}`;
        const afterDash = line.slice(emIdx + 1).trim();
        currentLines = afterDash ? [afterDash] : [];
        continue;
      }
    }
    const trimmed = line.trim();
    if (trimmed) currentLines.push(trimmed);
  }

  flush();
  return chunks;
}

// ─── Enchiridion (epub 45109) ─────────────────────────────────────────────────
// Sections are centered Roman numerals on their own line, e.g.:
//   "                                   I"
// Followed by blank line and content.

export function chunkEnchiridion(text: string): TextChunk[] {
  const chunks: TextChunk[] = [];

  // fetchGutenbergText collapses whitespace runs to a single space, so the original
  // centered Roman numerals like "                                   I" become " I".
  // Match lines that are solely " ROMAN_NUMERAL" (single leading space + numeral only).
  // JavaScript split with capturing group includes the captured value in the array.
  const parts = text.split(/\n ([IVXLCDM]+) *\n/);

  // parts[0] = preamble, parts[1] = "I", parts[2] = content I, parts[3] = "II", ...
  for (let i = 1; i < parts.length; i += 2) {
    const sectionNum = parts[i];
    const content = parts[i + 1]?.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim() ?? "";
    if (!isRomanNumeral(sectionNum) || content.length < 30) continue;
    chunks.push({ workTitle: "Enchiridion", chapterRef: `Section ${sectionNum}`, content });
  }

  return mergeShortChunks(chunks, 80);
}

// ─── Seneca Minor Dialogues (epub 64576) ─────────────────────────────────────
// The file contains multiple dialogues. Each starts with:
//   "OF [TITLE OF DIALOGUE]." or "THE [ORDINAL] BOOK OF THE DIALOGUES..."
// Chapters within each dialogue use Roman numerals: "I. Text...", "II. Text..."

export function chunkSenecaDialogue(
  text: string,
  sectionTitle: string,
  workTitle: string
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Find the start of this specific dialogue section
  const startIdx = text.indexOf(sectionTitle);
  if (startIdx === -1) {
    console.error(`  [chunk-stoics] Could not find section "${sectionTitle}" in text`);
    return [];
  }

  // Find the end: next "THE ... BOOK OF THE DIALOGUES" header or end of text
  const nextBookRe = /\nTHE (?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH) BOOK OF THE DI/;
  const nextMatch = text.slice(startIdx + sectionTitle.length).search(nextBookRe);
  const sectionText = nextMatch > 0
    ? text.slice(startIdx, startIdx + sectionTitle.length + nextMatch)
    : text.slice(startIdx);

  const lines = sectionText.split(/\r?\n/);
  let currentRef = workTitle;
  let currentLines: string[] = [];

  function flush() {
    if (currentLines.length === 0) return;
    const content = currentLines.join(" ").replace(/\s+/g, " ").trim();
    if (content.length > 50) {
      chunks.push({ workTitle, chapterRef: currentRef, content });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const romanMatch = line.match(/^([IVXLCDM]+)\.\s+(.*)/);
    if (romanMatch && isRomanNumeral(romanMatch[1])) {
      flush();
      currentRef = `${workTitle}, §${romanMatch[1]}`;
      if (romanMatch[2]) currentLines.push(romanMatch[2].trim());
      continue;
    }
    const trimmed = line.trim();
    if (trimmed) currentLines.push(trimmed);
  }

  flush();
  return mergeShortChunks(chunks, 100);
}

// ─── Generic paragraph chunker (kept for compatibility) ──────────────────────

export function chunkByParagraphs(
  text: string,
  workTitle: string,
  sectionPattern: RegExp,
  sectionLabel: string
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const sections = text.split(sectionPattern);

  let sectionNum = 1;
  for (const section of sections) {
    if (section.trim().length < 50) { sectionNum++; continue; }

    const paragraphs = section.split(/\n\n+/).filter(p => p.trim().length > 40);
    let accumulated = "";
    let partNum = 1;

    for (const para of paragraphs) {
      if (accumulated.length + para.length > 900 && accumulated.length > 150) {
        chunks.push({ workTitle, chapterRef: `${sectionLabel} ${sectionNum}${paragraphs.length > 3 ? `, Part ${partNum}` : ""}`, content: accumulated.trim() });
        accumulated = para;
        partNum++;
      } else {
        accumulated += (accumulated ? "\n\n" : "") + para;
      }
    }
    if (accumulated.trim().length > 50) {
      chunks.push({ workTitle, chapterRef: `${sectionLabel} ${sectionNum}${partNum > 1 ? `, Part ${partNum}` : ""}`, content: accumulated.trim() });
    }
    sectionNum++;
  }

  return chunks;
}

// ─── Merge short chunks ───────────────────────────────────────────────────────

export function mergeShortChunks(chunks: TextChunk[], minLength: number): TextChunk[] {
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
