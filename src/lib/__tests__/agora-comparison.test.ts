import { describe, expect, it } from "vitest";
import {
  buildComparisonResponse,
  selectCitationsFromPassages,
  type ComparisonPassage,
} from "../agora/comparison";

const PASSAGES: ComparisonPassage[] = [
  {
    sourceTextId: "src-1",
    workTitle: "Meditations",
    chapterRef: "Book II, §1",
    content: "Begin the morning by saying to thyself...",
  },
  {
    sourceTextId: "src-2",
    workTitle: "Discourses",
    chapterRef: "Book I, Chapter 1",
    content: "Of things some are in our power, and others are not.",
  },
];

describe("agora comparison helpers", () => {
  it("builds response with the expected nested shape", () => {
    const response = buildComparisonResponse(
      {
        rawAnswer: "Focus inward [CIT:P1].",
        displayAnswer: "Focus inward.",
        passages: PASSAGES,
      },
      {
        rawAnswer: "Distinguish what is yours [CIT:P2].",
        displayAnswer: "Distinguish what is yours.",
        passages: PASSAGES,
      },
    );

    expect(response.results).toHaveProperty("philosopherA");
    expect(response.results).toHaveProperty("philosopherB");
    expect(typeof response.results.philosopherA.answer).toBe("string");
    expect(Array.isArray(response.results.philosopherA.citations)).toBe(true);
    expect(typeof response.results.philosopherB.answer).toBe("string");
    expect(Array.isArray(response.results.philosopherB.citations)).toBe(true);
  });

  it("stores displayAnswer (stripped) as the answer field", () => {
    const response = buildComparisonResponse(
      { rawAnswer: "Inner [CIT:P1] governance.", displayAnswer: "Inner governance.", passages: PASSAGES },
      { rawAnswer: "External [CIT:P2] control.", displayAnswer: "External control.", passages: PASSAGES },
    );
    expect(response.results.philosopherA.answer).toBe("Inner governance.");
    expect(response.results.philosopherB.answer).toBe("External control.");
  });

  it("returns empty citations when passages are empty", () => {
    const response = buildComparisonResponse(
      { rawAnswer: "General answer [CIT:P1].", displayAnswer: "General answer.", passages: [] },
      { rawAnswer: "Another general answer.", displayAnswer: "Another general answer.", passages: [] },
    );

    expect(response.results.philosopherA.citations).toEqual([]);
    expect(response.results.philosopherB.citations).toEqual([]);
  });

  it("returns empty citations when no [CIT:Px] markers are present", () => {
    const selected = selectCitationsFromPassages(
      "The Republic says justice is harmony in the soul.",
      PASSAGES,
    );
    expect(selected).toEqual([]);
  });

  it("selects citations from [CIT:Px] markers in answer", () => {
    const selected = selectCitationsFromPassages(
      "Inner governance [CIT:P1] connects to control [CIT:P2].",
      PASSAGES,
    );
    expect(selected).toHaveLength(2);
    expect(selected[0].workTitle).toBe("Meditations");
    expect(selected[1].workTitle).toBe("Discourses");
  });
});
