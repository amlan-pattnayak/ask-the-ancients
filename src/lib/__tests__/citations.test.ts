/**
 * Citation Faithfulness Unit Tests
 *
 * Tests the positional-ID citation extraction used in convex/chat.ts and
 * src/lib/agora/comparison.ts. The LLM writes [CIT:P1], [CIT:P2], etc.;
 * these are mapped back to retrieved passages by 1-based position index.
 *
 * Note: end-to-end faithfulness evaluation (calling the live API) is done
 * via `scripts/eval-harness.ts` and is not run in unit CI.
 */
import { describe, it, expect } from "vitest";
import { extractCitationIds } from "../prompt-validators";

// ── Helpers mirrored from convex/chat.ts ─────────────────────────────────────

interface Passage {
  workTitle: string;
  chapterRef: string;
  content: string;
}

function stripCitationMarkers(text: string): string {
  return text.replace(/\[CIT:P\d+\]/g, "").replace(/  +/g, " ").trim();
}

function selectCitations(rawAnswer: string, passages: Passage[]): Passage[] {
  const usedIds = Array.from(new Set(extractCitationIds(rawAnswer)));
  return usedIds
    .map((id) => {
      const match = id.match(/^P(\d+)$/);
      if (!match) return null;
      return passages[parseInt(match[1], 10) - 1] ?? null;
    })
    .filter((p): p is Passage => p !== null);
}

// ─────────────────────────────────────────────────────────────────────────────

const MEDITATIONS_PASSAGE: Passage = {
  workTitle: "Meditations",
  chapterRef: "Book II, §1",
  content: "Begin the morning by saying to thyself, I shall meet with the busy-body...",
};

const DISCOURSES_PASSAGE: Passage = {
  workTitle: "Discourses",
  chapterRef: "Book I, Chapter 1",
  content: "Of things some are in our power, and others are not.",
};

const LETTERS_PASSAGE: Passage = {
  workTitle: "Letters to Lucilius",
  chapterRef: "Letter I",
  content: "Ita fac, mi Lucili: vindica te tibi.",
};

describe("positional citation extraction", () => {
  it("[CIT:P1] maps to passages[0]", () => {
    const result = selectCitations("Inner focus [CIT:P1] is essential.", [
      MEDITATIONS_PASSAGE,
      DISCOURSES_PASSAGE,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].workTitle).toBe("Meditations");
  });

  it("[CIT:P1] and [CIT:P3] map to passages[0] and passages[2]", () => {
    const result = selectCitations(
      "Two truths: [CIT:P1] about mornings and [CIT:P3] about reclaiming time.",
      [MEDITATIONS_PASSAGE, DISCOURSES_PASSAGE, LETTERS_PASSAGE],
    );
    expect(result).toHaveLength(2);
    expect(result[0].workTitle).toBe("Meditations");
    expect(result[1].workTitle).toBe("Letters to Lucilius");
  });

  it("returns empty citations when no markers are present", () => {
    const result = selectCitations("One must act with virtue regardless of circumstance.", [
      MEDITATIONS_PASSAGE,
      DISCOURSES_PASSAGE,
    ]);
    expect(result).toHaveLength(0);
  });

  it("bounds-guards: [CIT:P9] with only 2 passages yields empty", () => {
    const result = selectCitations("See [CIT:P9] for more.", [
      MEDITATIONS_PASSAGE,
      DISCOURSES_PASSAGE,
    ]);
    expect(result).toHaveLength(0);
  });

  it("deduplicates repeated [CIT:P1] markers", () => {
    const result = selectCitations("[CIT:P1] is cited twice [CIT:P1].", [MEDITATIONS_PASSAGE]);
    expect(result).toHaveLength(1);
    expect(result[0].workTitle).toBe("Meditations");
  });

  it("handles empty answer without error", () => {
    const result = selectCitations("", [MEDITATIONS_PASSAGE]);
    expect(result).toHaveLength(0);
  });

  it("handles empty passages array without error", () => {
    const result = selectCitations("See [CIT:P1].", []);
    expect(result).toHaveLength(0);
  });
});

describe("stripCitationMarkers", () => {
  it("removes [CIT:Px] tokens from text", () => {
    // Marker between words: surrounding spaces collapse to one.
    const cleaned = stripCitationMarkers("Focus inward [CIT:P1] and persist [CIT:P2] daily.");
    expect(cleaned).toBe("Focus inward and persist daily.");
  });

  it("collapses double spaces left by stripped markers", () => {
    const cleaned = stripCitationMarkers("Begin [CIT:P1]  the day.");
    expect(cleaned).not.toContain("  ");
  });

  it("returns empty string when input is only markers", () => {
    const cleaned = stripCitationMarkers("[CIT:P1][CIT:P2]");
    expect(cleaned).toBe("");
  });
});
