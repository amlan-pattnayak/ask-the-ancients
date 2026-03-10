import { describe, it, expect, beforeEach } from "vitest";

// ── Minimal localStorage/sessionStorage mock ──────────────────────────────────
function createStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  } satisfies Storage;
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock,
  configurable: true,
});
Object.defineProperty(globalThis, "window", {
  value: globalThis,
  configurable: true,
});

// Import AFTER mocks are in place
const { readByokConfig, isByokMode } = await import("../byok-storage");

const CONFIG_KEY = "ata_provider_config";
const KEYS_META_KEY = "ata_byok_keys_meta";
const ACTIVE_KEY = "ata_byok_active_key_id";

function seedKey(opts: {
  id: string;
  name: string;
  storageMode: "session" | "persistent";
  value: string;
  active?: boolean;
}) {
  const meta = [{ id: opts.id, name: opts.name, maskedValue: "sk-abc…xyz", storageMode: opts.storageMode, addedAt: Date.now() }];
  localStorageMock.setItem(KEYS_META_KEY, JSON.stringify(meta));
  if (opts.active !== false) localStorageMock.setItem(ACTIVE_KEY, opts.id);

  const storageKey = `ata_byok_key_${opts.id}`;
  if (opts.storageMode === "session") {
    sessionStorageMock.setItem(storageKey, opts.value);
  } else {
    localStorageMock.setItem(storageKey, opts.value);
  }
}

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});

describe("isByokMode", () => {
  it("returns false when no config exists", () => {
    expect(isByokMode()).toBe(false);
  });

  it("returns false for guest mode", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "guest" }));
    expect(isByokMode()).toBe(false);
  });

  it("returns true for byok mode", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "byok" }));
    expect(isByokMode()).toBe(true);
  });
});

describe("readByokConfig", () => {
  it("returns null when mode is guest", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "guest" }));
    expect(readByokConfig()).toBeNull();
  });

  it("returns null when no active key is set", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "byok" }));
    expect(readByokConfig()).toBeNull();
  });

  it("reads a session-mode key from sessionStorage", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "byok" }));
    seedKey({ id: "k1", name: "Groq Key", storageMode: "session", value: "gsk_test_abc123" });

    const result = readByokConfig();
    expect(result).not.toBeNull();
    expect(result!.key).toBe("gsk_test_abc123");
    expect(result!.keyName).toBe("Groq Key");
    expect(result!.storageMode).toBe("session");
  });

  it("reads a persistent key from localStorage", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "byok" }));
    seedKey({ id: "k2", name: "Claude Key", storageMode: "persistent", value: "sk-ant-secret" });

    const result = readByokConfig();
    expect(result!.key).toBe("sk-ant-secret");
    expect(result!.storageMode).toBe("persistent");
  });

  it("returns persisted model and custom endpoint when present", () => {
    localStorageMock.setItem(
      CONFIG_KEY,
      JSON.stringify({
        mode: "byok",
        model: "openai/gpt-4.1-mini",
        customEndpoint: "https://openrouter.ai/api/v1",
      }),
    );
    seedKey({ id: "k4", name: "OpenRouter Key", storageMode: "session", value: "sk-or-secret" });

    const result = readByokConfig();
    expect(result).not.toBeNull();
    expect(result!.model).toBe("openai/gpt-4.1-mini");
    expect(result!.customEndpoint).toBe("https://openrouter.ai/api/v1");
  });

  it("returns null when key value is missing from both storages", () => {
    localStorageMock.setItem(CONFIG_KEY, JSON.stringify({ mode: "byok" }));
    localStorageMock.setItem(KEYS_META_KEY, JSON.stringify([
      { id: "k3", name: "Missing Key", maskedValue: "sk-ab…cdef", storageMode: "session", addedAt: Date.now() },
    ]));
    localStorageMock.setItem(ACTIVE_KEY, "k3");
    // Key value not written → should return null
    expect(readByokConfig()).toBeNull();
  });
});
