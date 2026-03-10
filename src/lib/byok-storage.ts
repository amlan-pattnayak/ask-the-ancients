/**
 * byok-storage.ts
 *
 * Client-only utility for reading the active BYOK API key from
 * sessionStorage / localStorage. Must never be imported in server
 * components or Convex functions.
 *
 * Storage layout (mirrors ProviderToggle.tsx):
 *   localStorage["ata_provider_config"]    → {
 *                                              mode: "guest" | "byok",
 *                                              model?: string,
 *                                              customEndpoint?: string
 *                                            }
 *   localStorage["ata_byok_keys_meta"]     → KeyMeta[]
 *   localStorage["ata_byok_active_key_id"] → string (active key id)
 *   sessionStorage["ata_byok_key_{id}"]    → actual key value (session mode)
 *   localStorage["ata_byok_key_{id}"]      → actual key value (persistent mode)
 */

const CONFIG_STORAGE = "ata_provider_config";
const KEYS_META_STORAGE = "ata_byok_keys_meta";
const ACTIVE_KEY_STORAGE = "ata_byok_active_key_id";

interface KeyMeta {
  id: string;
  name: string;
  maskedValue: string;
  storageMode: "session" | "persistent";
  addedAt: number;
}

export interface SavedByokModel {
  id: string;
  name: string;
  model: string;
  endpoint?: string;
  createdAt: number;
}

export interface ByokConfig {
  /** The raw API key — handle with care, never log */
  key: string;
  keyId: string;
  keyName: string;
  storageMode: "session" | "persistent";
  /** Optional model override persisted from Settings */
  model?: string;
  /** Optional OpenAI-compatible custom endpoint override */
  customEndpoint?: string;
  savedModels?: SavedByokModel[];
  activeByokModelId?: string;
}

/**
 * Read the active BYOK key from browser storage.
 * Returns null if:
 *  - not in a browser (SSR)
 *  - mode is "guest"
 *  - no active key is selected
 *  - the key value is missing (e.g. session cleared after tab close)
 */
export function readByokConfig(): ByokConfig | null {
  if (typeof window === "undefined") return null;

  try {
    // Check provider mode
    const configRaw = localStorage.getItem(CONFIG_STORAGE);
    if (!configRaw) return null;
    const config = JSON.parse(configRaw) as {
      mode: string;
      model?: string;
      customEndpoint?: string;
      byokModels?: SavedByokModel[];
      activeByokModelId?: string;
    };
    if (config.mode !== "byok") return null;

    // Get the active key ID
    const activeId = localStorage.getItem(ACTIVE_KEY_STORAGE);
    if (!activeId) return null;

    // Find key metadata
    const metaRaw = localStorage.getItem(KEYS_META_STORAGE);
    if (!metaRaw) return null;
    const keys = JSON.parse(metaRaw) as KeyMeta[];
    const meta = keys.find((k) => k.id === activeId);
    if (!meta) return null;

    // Read actual key value (check both storages — key may be in either)
    const storageKey = `ata_byok_key_${activeId}`;
    const keyValue =
      sessionStorage.getItem(storageKey) ??
      localStorage.getItem(storageKey) ??
      null;

    if (!keyValue) return null;

    const savedModels = Array.isArray(config.byokModels) ? config.byokModels : [];
    const activeModelId = config.activeByokModelId;
    const activeSavedModel = savedModels.find((m) => m.id === activeModelId);

    return {
      key: keyValue,
      keyId: activeId,
      keyName: meta.name,
      storageMode: meta.storageMode,
      model: activeSavedModel?.model?.trim() || config.model?.trim() || undefined,
      customEndpoint: activeSavedModel?.endpoint?.trim() || config.customEndpoint?.trim() || undefined,
      savedModels,
      activeByokModelId: activeSavedModel?.id,
    };
  } catch {
    return null;
  }
}

export function readSavedByokModels(): {
  models: SavedByokModel[];
  activeByokModelId?: string;
} {
  if (typeof window === "undefined") return { models: [] };
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE);
    if (!raw) return { models: [] };
    const parsed = JSON.parse(raw) as {
      byokModels?: SavedByokModel[];
      activeByokModelId?: string;
    };
    return {
      models: Array.isArray(parsed.byokModels) ? parsed.byokModels : [],
      activeByokModelId: parsed.activeByokModelId,
    };
  } catch {
    return { models: [] };
  }
}

/**
 * True if the user has BYOK mode selected (regardless of whether the
 * key value is still in storage).
 */
export function isByokMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE);
    if (!raw) return false;
    const config = JSON.parse(raw) as { mode: string };
    return config.mode === "byok";
  } catch {
    return false;
  }
}
