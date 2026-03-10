// Redacts sensitive values from logs and error traces.
// BYOK keys must NEVER appear in logs, telemetry, or error traces.
export function redactSecrets(obj: unknown): unknown {
  if (typeof obj === "string") {
    return obj
      .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
      .replace(/gsk_[A-Za-z0-9_-]{20,}/g, "[REDACTED]")
      .replace(/xai-[A-Za-z0-9_-]{20,}/g, "[REDACTED]");
  }
  if (Array.isArray(obj)) {
    return obj.map(redactSecrets);
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k,
        /key|secret|token|password|authorization/i.test(k) ? "[REDACTED]" : redactSecrets(v),
      ])
    );
  }
  return obj;
}
