/**
 * Smoke tests for the SSE parsing logic used in the streaming API route.
 * We extract and test the pure parsing functions in isolation.
 */
import { describe, it, expect } from "vitest";

// ── Inline the pure parsing functions (same as route.ts) ─────────────────────

function parseOpenAIChunk(line: string): string {
  if (!line.startsWith("data: ")) return "";
  const data = line.slice(6).trim();
  if (data === "[DONE]") return "";
  try {
    const json = JSON.parse(data) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    return json.choices?.[0]?.delta?.content ?? "";
  } catch {
    return "";
  }
}

function parseAnthropicChunk(line: string): string {
  if (!line.startsWith("data: ")) return "";
  const data = line.slice(6).trim();
  try {
    const json = JSON.parse(data) as {
      type?: string;
      delta?: { type?: string; text?: string };
    };
    if (
      json.type === "content_block_delta" &&
      json.delta?.type === "text_delta"
    ) {
      return json.delta.text ?? "";
    }
  } catch {
    /* ignore */
  }
  return "";
}

// ─────────────────────────────────────────────────────────────────────────────

describe("parseOpenAIChunk", () => {
  it("extracts content from a delta event", () => {
    const line = `data: ${JSON.stringify({
      choices: [{ delta: { content: "Hello" } }],
    })}`;
    expect(parseOpenAIChunk(line)).toBe("Hello");
  });

  it("returns empty string for [DONE]", () => {
    expect(parseOpenAIChunk("data: [DONE]")).toBe("");
  });

  it("returns empty string for non-data lines", () => {
    expect(parseOpenAIChunk("event: ping")).toBe("");
    expect(parseOpenAIChunk("")).toBe("");
  });

  it("returns empty string when delta has no content field", () => {
    const line = `data: ${JSON.stringify({ choices: [{ delta: {} }] })}`;
    expect(parseOpenAIChunk(line)).toBe("");
  });

  it("handles malformed JSON gracefully", () => {
    expect(parseOpenAIChunk("data: {broken}")).toBe("");
  });
});

describe("parseAnthropicChunk", () => {
  it("extracts text from content_block_delta events", () => {
    const line = `data: ${JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Greetings" },
    })}`;
    expect(parseAnthropicChunk(line)).toBe("Greetings");
  });

  it("ignores other event types", () => {
    const line = `data: ${JSON.stringify({ type: "message_start" })}`;
    expect(parseAnthropicChunk(line)).toBe("");
  });

  it("returns empty string for non-data lines", () => {
    expect(parseAnthropicChunk("event: ping")).toBe("");
  });

  it("handles malformed JSON gracefully", () => {
    expect(parseAnthropicChunk("data: !!!")).toBe("");
  });
});
