import { describe, it, expect } from "vitest";
import { detectCrisis, CRISIS_RESPONSE } from "../safety";

describe("detectCrisis", () => {
  // ─── Positive cases ────────────────────────────────────────────────────────

  it.each([
    ["direct suicidal statement", "I want to kill myself"],
    ["lowercase variant", "i want to kill myself tonight"],
    ["self-harm", "I've been hurting myself"],
    ["hyphenated form", "I've been self-harming"],
    ["no reason to live", "I have no reason to live anymore"],
    ["want to die", "I want to die"],
    ["end my life", "I'm thinking about ending my life"],
    ["take my life", "I'm going to take my life"],
    ["suicidal", "I've been feeling suicidal lately"],
    ["commit suicide", "I'm going to commit suicide"],
    ["not worth living", "This life is not worth living"],
    ["life isn't worth living", "I feel like life isn't worth living"],
    ["don't want to live", "I don't want to live anymore"],
    ["don't want to be alive", "I don't want to be alive"],
    ["i want to be dead", "I want to be dead"],
    ["mixed case", "I WANT TO KILL MYSELF"],
    ["embedded in longer text", "things have been really bad and I want to kill myself, nothing is working"],
  ])("detects: %s", (_label, input) => {
    expect(detectCrisis(input)).toBe(true);
  });

  // ─── Negative cases (philosophical discussion of death should NOT trigger) ──

  it.each([
    ["stoic discussion of death", "Stoics believed death was not to be feared"],
    ["historical reference", "Socrates chose to die rather than abandon his principles"],
    ["philosophical query", "What did Marcus Aurelius say about mortality?"],
    ["grief without crisis signal", "I lost someone close to me and I'm grieving"],
    ["asking about ancient suicide", "Why did Cato choose to end his life in Utica?"],
    ["general sadness", "I've been feeling really low lately"],
    ["existential musing", "Sometimes I wonder what the point of everything is"],
    ["empty string", ""],
    ["unrelated message", "What is virtue according to Epictetus?"],
  ])("does not trigger on: %s", (_label, input) => {
    expect(detectCrisis(input)).toBe(false);
  });
});

describe("CRISIS_RESPONSE", () => {
  it("contains US resources", () => {
    expect(CRISIS_RESPONSE).toContain("988");
    expect(CRISIS_RESPONSE).toContain("741741");
  });

  it("contains India resources", () => {
    expect(CRISIS_RESPONSE).toContain("9152987821");      // iCall
    expect(CRISIS_RESPONSE).toContain("1860-2662-345");   // Vandrevala Foundation
  });

  it("contains UK resources", () => {
    expect(CRISIS_RESPONSE).toContain("116 123");         // Samaritans
  });

  it("contains Australia resources", () => {
    expect(CRISIS_RESPONSE).toContain("13 11 14");        // Lifeline
  });

  it("contains Canada resources", () => {
    expect(CRISIS_RESPONSE).toContain("1-833-456-4566");  // Crisis Services Canada
  });

  it("contains IASP catch-all for all other countries", () => {
    expect(CRISIS_RESPONSE).toContain("iasp.info");
  });

  it("mentions emergency services", () => {
    expect(CRISIS_RESPONSE).toContain("emergency services");
  });

  it("uses only double-newline paragraph breaks (no markdown syntax)", () => {
    // No markdown bold/italic markers — they render as literal asterisks in MessageBubble.
    expect(CRISIS_RESPONSE).not.toContain("**");
    expect(CRISIS_RESPONSE).not.toContain("__");
    // Every paragraph boundary is a double newline so toParagraphs() renders them correctly.
    const paragraphs = CRISIS_RESPONSE.split(/\n{2,}/).filter(Boolean);
    expect(paragraphs.length).toBeGreaterThanOrEqual(8);
  });
});
