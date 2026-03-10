import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../build-system-prompt";

describe("buildSystemPrompt", () => {
  const BASE_PROMPT = "You are Marcus Aurelius.\n\n{retrieved_passages}\n\nRespond in first person.";

  it("injects passages into the system prompt placeholder", () => {
    const passages = [
      {
        workTitle: "Meditations",
        chapterRef: "Book II, §1",
        content: "Begin the morning by saying to thyself…",
      },
    ];
    const result = buildSystemPrompt(BASE_PROMPT, passages);
    expect(result).toContain("[P1 | Meditations, Book II, §1]");
    expect(result).toContain("Begin the morning");
    expect(result).not.toContain("{retrieved_passages}");
  });

  it("uses fallback text when no passages are provided", () => {
    const result = buildSystemPrompt(BASE_PROMPT, []);
    expect(result).toContain("No passages retrieved for this query");
    expect(result).not.toContain("{retrieved_passages}");
  });

  it("numbers multiple passages sequentially", () => {
    const passages = [
      { workTitle: "Meditations", chapterRef: "I.1", content: "First." },
      { workTitle: "Meditations", chapterRef: "I.2", content: "Second." },
      { workTitle: "Meditations", chapterRef: "I.3", content: "Third." },
    ];
    const result = buildSystemPrompt(BASE_PROMPT, passages);
    expect(result).toContain("[P1 |");
    expect(result).toContain("[P2 |");
    expect(result).toContain("[P3 |");
  });

  it("leaves other prompt text untouched", () => {
    const result = buildSystemPrompt(BASE_PROMPT, []);
    expect(result).toContain("You are Marcus Aurelius.");
    expect(result).toContain("Respond in first person.");
  });

  it("includes safety instructions for crisis, explicit content, and harmful instructions", () => {
    const result = buildSystemPrompt(BASE_PROMPT, []);
    expect(result).toContain("Safety:");
    expect(result).toContain("988");
    expect(result).toContain("Crisis");
    expect(result).toContain("Explicit content");
    expect(result).toContain("Harmful instructions");
  });
});
