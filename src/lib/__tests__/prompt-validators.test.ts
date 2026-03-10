import { describe, expect, it } from "vitest";
import {
  extractCitationIds,
  validateCitations,
  validateDifferenceSummary,
} from "../prompt-validators";

describe("prompt-validators", () => {
  it("extracts citation IDs from assistant output", () => {
    const text = "Focus on control [CIT:EPI-1] and assent [CIT:MAR-2].";
    expect(extractCitationIds(text)).toEqual(["EPI-1", "MAR-2"]);
  });

  it("validates citation IDs against allowed set", () => {
    const result = validateCitations(
      "Use only what is given [CIT:EPI-1] [CIT:BAD-9].",
      ["EPI-1", "SEN-2"],
    );
    expect(result.isValid).toBe(false);
    expect(result.invalidCitationIds).toEqual(["BAD-9"]);
  });

  it("passes valid three-bullet difference summary", () => {
    const result = validateDifferenceSummary(
      "- A centers freedom on inner judgment.\n- B emphasizes duty in relation to nature.\n- A uses therapeutic framing while B uses civic framing.",
    );
    expect(result.isValid).toBe(true);
    expect(result.bulletCount).toBe(3);
  });

  it("fails difference summary with wrong bullet count", () => {
    const result = validateDifferenceSummary(
      "- First difference.\n- Second difference.",
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Difference summary must contain exactly 3 bullets.");
  });

  it("fails bullet that has multiple sentences", () => {
    const result = validateDifferenceSummary(
      "- First difference. Extra sentence.\n- Second difference.\n- Third difference.",
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Each bullet must be exactly one sentence.");
  });
});
