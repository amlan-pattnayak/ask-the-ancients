import { describe, expect, it } from "vitest";
import {
  GLOBAL_STYLE_CONTRACT,
  DIFFERENCE_SUMMARIZER_SYSTEM_PROMPT,
  buildComparisonQueryMessage,
  buildDifferenceSummarizerInput,
  buildPhilosopherPersonaSystemPrompt,
} from "../prompt-spec";

describe("prompt-spec", () => {
  it("contains key grounding and citation rules in global style contract", () => {
    expect(GLOBAL_STYLE_CONTRACT).toContain("ground your claims in the provided Context passages");
    expect(GLOBAL_STYLE_CONTRACT).toContain("Use only citation IDs present in Context");
    expect(GLOBAL_STYLE_CONTRACT).toContain("Default max length is 150 words");
  });

  it("builds philosopher persona prompt with supplied metadata", () => {
    const prompt = buildPhilosopherPersonaSystemPrompt({
      philosopherId: "seneca",
      philosopherName: "Seneca",
      schoolOrTradition: "Stoicism",
    });

    expect(prompt).toContain("You are answering as Seneca.");
    expect(prompt).toContain("school/tradition: Stoicism");
    expect(prompt).toContain("persona_id: seneca");
  });

  it("builds comparison query message with context passages", () => {
    const message = buildComparisonQueryMessage("How should I handle anger?", [
      {
        citationId: "SEN-01",
        sourceTitle: "On Anger",
        sourceAuthor: "Seneca",
        passageText: "No plague has cost the human race more.",
      },
    ]);

    expect(message).toContain("Question:");
    expect(message).toContain("CitationID: SEN-01");
    expect(message).toContain("On Anger (Seneca)");
  });

  it("builds empty-context comparison query message", () => {
    const message = buildComparisonQueryMessage("Hello", []);
    expect(message).toContain("(No passages retrieved)");
  });

  it("defines difference summarizer constraints", () => {
    expect(DIFFERENCE_SUMMARIZER_SYSTEM_PROMPT).toContain("Output exactly 3 bullet points.");
    expect(DIFFERENCE_SUMMARIZER_SYSTEM_PROMPT).toContain("each one sentence");
  });

  it("builds difference summarizer input payload", () => {
    const input = buildDifferenceSummarizerInput({
      userQuestion: "What is freedom?",
      philosopherAName: "Epictetus",
      answerA: "Freedom is inner command over judgment.",
      philosopherBName: "Marcus Aurelius",
      answerB: "Freedom is disciplined assent to nature and duty.",
    });

    expect(input).toContain("Response A (Epictetus):");
    expect(input).toContain("Response B (Marcus Aurelius):");
    expect(input).toContain("exactly 3 bullet points");
  });
});
