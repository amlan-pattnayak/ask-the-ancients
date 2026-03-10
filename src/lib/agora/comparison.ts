import { extractCitationIds } from "@/lib/prompt-validators";

export interface ComparisonPassage {
  sourceTextId: string;
  workTitle: string;
  chapterRef: string;
  content: string;
}

export interface ComparisonCitation {
  workTitle: string;
  chapterRef: string;
  passage: string;
  sourceTextId: string;
}

export interface ComparisonLegResult {
  answer: string;
  citations: ComparisonCitation[];
}

export interface ComparisonResponse {
  results: {
    philosopherA: ComparisonLegResult;
    philosopherB: ComparisonLegResult;
  };
}

export function stripCitationMarkers(text: string): string {
  return text.replace(/\[CIT:P\d+\]/g, "").replace(/  +/g, " ").trim();
}

export function selectCitationsFromPassages(
  rawAnswer: string,
  passages: ComparisonPassage[],
): ComparisonCitation[] {
  const usedIds = Array.from(new Set(extractCitationIds(rawAnswer)));
  return usedIds.map((id) => {
    const match = id.match(/^P(\d+)$/);
    if (!match) return null;
    const p = passages[parseInt(match[1], 10) - 1];
    if (!p) return null;
    return {
      workTitle: p.workTitle,
      chapterRef: p.chapterRef,
      passage: p.content,
      sourceTextId: p.sourceTextId,
    };
  }).filter((c): c is ComparisonCitation => c !== null);
}

export function buildComparisonResponse(
  philosopherA: { rawAnswer: string; displayAnswer: string; passages: ComparisonPassage[] },
  philosopherB: { rawAnswer: string; displayAnswer: string; passages: ComparisonPassage[] },
): ComparisonResponse {
  return {
    results: {
      philosopherA: {
        answer: philosopherA.displayAnswer,
        citations: selectCitationsFromPassages(philosopherA.rawAnswer, philosopherA.passages),
      },
      philosopherB: {
        answer: philosopherB.displayAnswer,
        citations: selectCitationsFromPassages(philosopherB.rawAnswer, philosopherB.passages),
      },
    },
  };
}
