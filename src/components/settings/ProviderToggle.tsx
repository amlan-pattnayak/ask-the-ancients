"use client";

import { useEffect, useRef, useState } from "react";
import type { ProviderMode, KeyStorageMode } from "@/lib/providers/types";
import Toast from "@/components/ui/Toast";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import { createClientEvent, getOrCreateSessionId } from "@/lib/analytics/client";

// ─── Storage key constants ────────────────────────────────────────────────────
const CONFIG_STORAGE = "ata_provider_config";
const KEYS_META_STORAGE = "ata_byok_keys_meta";
const ACTIVE_KEY_STORAGE = "ata_byok_active_key_id";
function keyValueStorage(id: string) {
  return `ata_byok_key_${id}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface StoredConfig {
  mode: ProviderMode;
  model?: string;
  customEndpoint?: string;
  byokModels?: SavedByokModel[];
  activeByokModelId?: string;
}

interface KeyMeta {
  id: string;
  name: string;
  maskedValue: string;
  storageMode: KeyStorageMode;
  addedAt: number;
}

interface SavedByokModel {
  id: string;
  name: string;
  model: string;
  endpoint?: string;
  createdAt: number;
}

const DEFAULTS: StoredConfig = {
  mode: "guest",
  model: "",
  customEndpoint: "",
  byokModels: [],
  activeByokModelId: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function maskKey(value: string): string {
  if (value.length <= 10) return "****";
  return value.slice(0, 6) + "…" + value.slice(-4);
}

function loadConfig(): StoredConfig {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function loadKeysMeta(): KeyMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEYS_META_STORAGE);
    if (!raw) return [];
    return JSON.parse(raw) as KeyMeta[];
  } catch {
    return [];
  }
}

function saveKeysMeta(keys: KeyMeta[]) {
  localStorage.setItem(KEYS_META_STORAGE, JSON.stringify(keys));
}

/** Clear key values when switching to guest mode.
 * Persistent-mode keys survive the roundtrip — only session-mode keys
 * are cleared (they're ephemeral by design anyway).
 */
function clearSessionKeyValues(keys: KeyMeta[]) {
  for (const k of keys) {
    if (k.storageMode === "session") {
      sessionStorage.removeItem(keyValueStorage(k.id));
      localStorage.removeItem(keyValueStorage(k.id)); // clean up any stale copy
    }
    // Persistent keys intentionally NOT cleared — they should survive guest↔BYOK toggles
  }
}

/** Returns true if the actual key value is still accessible in browser storage. */
function isKeyValueAvailable(id: string): boolean {
  if (typeof window === "undefined") return false;
  const storageKey = keyValueStorage(id);
  return Boolean(sessionStorage.getItem(storageKey) ?? localStorage.getItem(storageKey));
}

function inferProviderFromModel(model?: string): string {
  if (!model) return "unknown";
  const prefix = model.split("/")[0]?.toLowerCase();
  if (!prefix) return "unknown";
  if (prefix === "anthropic") return "anthropic";
  if (prefix === "openai") return "openai";
  if (prefix === "groq") return "groq";
  if (prefix === "meta") return "meta";
  return "openai-compat";
}

// ─── KeyRow subcomponent ──────────────────────────────────────────────────────
interface KeyRowProps {
  meta: KeyMeta;
  isActive: boolean;
  isEditing: boolean;
  editingName: string;
  valueAvailable: boolean;
  onSelect: () => void;
  onStartEdit: () => void;
  onEditNameChange: (v: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function KeyRow({
  meta, isActive, isEditing, editingName, valueAvailable,
  onSelect, onStartEdit, onEditNameChange, onSaveEdit, onCancelEdit, onDelete,
}: KeyRowProps) {
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer transition-colors ${
        isActive
          ? "border-[var(--accent)] bg-[var(--bg-elevated)]"
          : "border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--text-muted)]"
      }`}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 151, 58, 0.18)";
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Active indicator dot */}
      <span
        className={`flex-shrink-0 h-3 w-3 rounded-full border-2 transition-colors ${
          isActive
            ? "bg-[var(--accent)] border-[var(--accent)]"
            : "bg-transparent border-[var(--text-muted)]"
        }`}
        aria-label={isActive ? "Active key" : "Inactive key"}
      />

      {/* Name + masked value */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={editRef}
            value={editingName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="w-full rounded border border-[var(--accent)] bg-[var(--bg-primary)] px-2 py-0.5 text-sm text-[var(--text-primary)] focus:outline-none"
          />
        ) : (
          <p className="truncate text-sm font-medium text-[var(--text-primary)]">{meta.name}</p>
        )}
        <p className="mt-0.5 font-mono text-xs text-[var(--text-muted)]">{meta.maskedValue}</p>
        {!valueAvailable && (
          <p className="mt-0.5 text-[10px] font-medium text-yellow-400">
            Key value expired, delete and re-add
          </p>
        )}
      </div>

      {/* Storage badge */}
      <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        meta.storageMode === "persistent"
          ? "bg-yellow-900/30 text-yellow-400"
          : "bg-[var(--bg-elevated)] text-[var(--text-muted)]"
      }`}>
        {meta.storageMode === "persistent" ? "disk" : "session"}
      </span>

      {/* Action buttons */}
      <div
        className="flex flex-shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onSaveEdit}
              className="rounded px-2 py-1 text-xs font-medium text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded px-2 py-1 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onStartEdit}
              title="Rename key"
              className="rounded p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
            >
              {/* Pencil icon */}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354zm.885 3.668-1.44-1.44-6.908 6.91a.25.25 0 0 0-.068.11l-.604 2.118 2.118-.604a.25.25 0 0 0 .11-.068z"/>
              </svg>
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete key"
              className="rounded p-1.5 text-[var(--text-muted)] hover:bg-red-900/20 hover:text-red-400"
            >
              {/* X icon */}
              <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06z"/>
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ProviderToggle({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const principal = usePrincipal();
  const trackEvent = useMutation(api.analytics.trackEvent);
  // Mode
  const [mode, setMode] = useState<ProviderMode>(DEFAULTS.mode);
  const previousModeRef = useRef<ProviderMode>(DEFAULTS.mode);

  // Saved keys list and active selection
  const [savedKeys, setSavedKeys] = useState<KeyMeta[]>([]);
  const [activeKeyId, setActiveKeyId] = useState<string | null>(null);
  const [savedModels, setSavedModels] = useState<SavedByokModel[]>([]);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  const [addModelName, setAddModelName] = useState("");
  const [addModelId, setAddModelId] = useState("");
  const [addModelEndpoint, setAddModelEndpoint] = useState("");
  const [addModelError, setAddModelError] = useState("");
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editingModelName, setEditingModelName] = useState("");
  const [editingModelValue, setEditingModelValue] = useState("");
  const [editingModelEndpoint, setEditingModelEndpoint] = useState("");
  const [editModelError, setEditModelError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  // Hydration gate — prevents the persistence effect from running with DEFAULTS
  // before the mount effect has had a chance to restore stored state
  const [initialized, setInitialized] = useState(false);

  // Add-key form
  const [addName, setAddName] = useState("");
  const [addValue, setAddValue] = useState("");
  const [addValueVisible, setAddValueVisible] = useState(false);
  const [addStorageMode, setAddStorageMode] = useState<KeyStorageMode>("session");
  const [addError, setAddError] = useState("");

  // Inline rename
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  // ── Mount: restore from storage ────────────────────────────────────────────
  useEffect(() => {
    const cfg = loadConfig();
    setMode(cfg.mode);
    const models = Array.isArray(cfg.byokModels) ? cfg.byokModels : [];
    setSavedModels(models);
    if (cfg.activeByokModelId && models.some((m) => m.id === cfg.activeByokModelId)) {
      setActiveModelId(cfg.activeByokModelId);
    } else {
      setActiveModelId(models[0]?.id ?? null);
    }

    const keys = loadKeysMeta();
    setSavedKeys(keys);

    const activeId = localStorage.getItem(ACTIVE_KEY_STORAGE);
    // Only restore active ID if it still exists in metadata
    if (activeId && keys.some((k) => k.id === activeId)) {
      setActiveKeyId(activeId);
    } else if (keys.length > 0) {
      setActiveKeyId(keys[0].id);
    }

    setInitialized(true);
  }, []);

  function emitClientEvent(
    eventName:
      | "byok_settings_opened"
      | "mode_switched_guest_to_byok"
      | "mode_switched_byok_to_guest",
    properties: Record<string, unknown>
  ) {
    if (principal.isLoading || !principal.principalId) return;
    void trackEvent(
      createClientEvent({
        eventName,
        principalType: principal.principalType,
        principalId: principal.principalId,
        sessionId: getOrCreateSessionId(),
        properties,
      })
    );
  }

  // ── Persist mode; clear keys when reverting to guest ──────────────────────
  useEffect(() => {
    if (!initialized) return;
    localStorage.setItem(
      CONFIG_STORAGE,
      JSON.stringify({
        mode,
        byokModels: savedModels,
        activeByokModelId: activeModelId || undefined,
        // Backward compatibility fields for older readers.
        model: savedModels.find((m) => m.id === activeModelId)?.model || undefined,
        customEndpoint: savedModels.find((m) => m.id === activeModelId)?.endpoint || undefined,
      }),
    );
    // Dispatch a storage event so same-tab listeners (SettingsPage) re-sync
    window.dispatchEvent(new StorageEvent("storage", { key: CONFIG_STORAGE }));
    if (mode === "guest") {
      clearSessionKeyValues(savedKeys);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, savedModels, activeModelId, initialized]);

  // ── Active key persistence ─────────────────────────────────────────────────
  useEffect(() => {
    if (!initialized) return;
    if (activeKeyId) {
      localStorage.setItem(ACTIVE_KEY_STORAGE, activeKeyId);
    } else {
      localStorage.removeItem(ACTIVE_KEY_STORAGE);
    }
  }, [activeKeyId, initialized]);

  // ── Reset to guest if BYOK is active but user signs out ───────────────────
  useEffect(() => {
    if (initialized && !isSignedIn && mode === "byok") {
      setMode("guest");
    }
  }, [isSignedIn, mode, initialized]);

  useEffect(() => {
    if (!initialized || !isSignedIn) return;

    const previousMode = previousModeRef.current;
    if (mode === "byok") {
      emitClientEvent("byok_settings_opened", { currentMode: "byok" });
      if (previousMode !== "byok") {
        const activeModel = savedModels.find((m) => m.id === activeModelId);
        const activeKey = savedKeys.find((k) => k.id === activeKeyId);
        emitClientEvent("mode_switched_guest_to_byok", {
          provider: inferProviderFromModel(activeModel?.model),
          model: activeModel?.model,
          keyStorageMode: activeKey?.storageMode ?? "session",
        });
      }
    } else if (previousMode === "byok" && mode === "guest") {
      const activeModel = savedModels.find((m) => m.id === activeModelId);
      emitClientEvent("mode_switched_byok_to_guest", {
        previousProvider: inferProviderFromModel(activeModel?.model),
      });
    }

    previousModeRef.current = mode;
  }, [activeKeyId, activeModelId, initialized, isSignedIn, mode, savedKeys, savedModels]);

  // ── Operations ─────────────────────────────────────────────────────────────
  function handleAddKey() {
    const name = addName.trim();
    const value = addValue.trim();
    if (!name) { setAddError("Key name is required."); return; }
    if (!value) { setAddError("Key value is required."); return; }
    setAddError("");

    const id = crypto.randomUUID();
    const meta: KeyMeta = {
      id,
      name,
      maskedValue: maskKey(value),
      storageMode: addStorageMode,
      addedAt: Date.now(),
    };

    const updated = [...savedKeys, meta];
    setSavedKeys(updated);
    saveKeysMeta(updated);

    // Store actual value in the appropriate storage
    const storageKey = keyValueStorage(id);
    if (addStorageMode === "persistent") {
      localStorage.setItem(storageKey, value);
    } else {
      sessionStorage.setItem(storageKey, value);
    }

    // Auto-select if no active key yet
    if (!activeKeyId) {
      setActiveKeyId(id);
    }

    // Clear form
    setAddName("");
    setAddValue("");
    setAddValueVisible(false);
    setAddStorageMode("session");
  }

  function handleDeleteKey(id: string) {
    const updated = savedKeys.filter((k) => k.id !== id);
    setSavedKeys(updated);
    saveKeysMeta(updated);

    // Remove actual value from both storages (safe regardless of mode)
    localStorage.removeItem(keyValueStorage(id));
    sessionStorage.removeItem(keyValueStorage(id));

    // Re-assign active key if we just deleted the active one
    if (activeKeyId === id) {
      const next = updated[0]?.id ?? null;
      setActiveKeyId(next);
    }
  }

  function handleSelectKey(id: string) {
    setActiveKeyId(id);
  }

  function handleStartEdit(meta: KeyMeta) {
    setEditingId(meta.id);
    setEditingName(meta.name);
  }

  function handleSaveEdit(id: string) {
    const name = editingName.trim();
    if (!name) return;
    const updated = savedKeys.map((k) => k.id === id ? { ...k, name } : k);
    setSavedKeys(updated);
    saveKeysMeta(updated);
    setEditingId(null);
    setEditingName("");
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditingName("");
  }

  function handleAddModel() {
    const name = addModelName.trim();
    const model = addModelId.trim();
    const endpoint = addModelEndpoint.trim();
    if (!name) { setAddModelError("Model name is required."); return; }
    if (!model) { setAddModelError("Model ID is required."); return; }
    setAddModelError("");

    const item: SavedByokModel = {
      id: crypto.randomUUID(),
      name,
      model,
      endpoint: endpoint || undefined,
      createdAt: Date.now(),
    };
    const updated = [...savedModels, item];
    setSavedModels(updated);
    if (!activeModelId) setActiveModelId(item.id);
    setAddModelName("");
    setAddModelId("");
    setAddModelEndpoint("");
    setToastMessage("Model added");
    setToastVisible(true);
  }

  function handleDeleteModel(id: string) {
    if (editingModelId === id) {
      setEditingModelId(null);
      setEditModelError("");
    }
    const updated = savedModels.filter((m) => m.id !== id);
    setSavedModels(updated);
    if (activeModelId === id) {
      setActiveModelId(updated[0]?.id ?? null);
    }
    setToastMessage("Model removed");
    setToastVisible(true);
  }

  function handleStartEditModel(model: SavedByokModel) {
    setEditingModelId(model.id);
    setEditingModelName(model.name);
    setEditingModelValue(model.model);
    setEditingModelEndpoint(model.endpoint ?? "");
    setEditModelError("");
  }

  function handleCancelEditModel() {
    setEditingModelId(null);
    setEditingModelName("");
    setEditingModelValue("");
    setEditingModelEndpoint("");
    setEditModelError("");
  }

  function handleSaveEditModel(id: string) {
    const name = editingModelName.trim();
    const model = editingModelValue.trim();
    const endpoint = editingModelEndpoint.trim();
    if (!name) {
      setEditModelError("Model name is required.");
      return;
    }
    if (!model) {
      setEditModelError("Model ID is required.");
      return;
    }
    setSavedModels((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name, model, endpoint: endpoint || undefined } : m))
    );
    handleCancelEditModel();
    setToastMessage("Model updated");
    setToastVisible(true);
  }

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => setToastVisible(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [toastVisible]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Mode selector */}
      <p className="text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">Default inference provider</p>
      {isSignedIn ? (
        <div className="grid grid-cols-2 gap-3">
          <ModeButton
            active={mode === "guest"}
            onClick={() => setMode("guest")}
            label="App Default"
            description="Shared Groq endpoint. Daily limits apply."
          />
          <ModeButton
            active={mode === "byok"}
            onClick={() => setMode("byok")}
            label="BYOK"
            description="Your API key. No daily limits."
          />
        </div>
      ) : (
        <div className="rounded-xl border-2 border-[var(--accent)] bg-[var(--bg-elevated)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">App Default</p>
          <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">Shared Groq endpoint · Daily limits apply</p>
        </div>
      )}

      {/* Guest mode info */}
      {(!isSignedIn || mode === "guest") && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-sm">
          <p className="font-medium text-[var(--text-primary)]">
            {isSignedIn ? "25 messages / day" : "10 messages / day"}
          </p>
          <p className="mt-1 text-[var(--text-muted)]">
            {isSignedIn
              ? "Switch to BYOK for unlimited usage."
              : "Sign in for 25/day and to unlock Bring Your Own Key for unlimited usage."}
          </p>
        </div>
      )}

      {/* BYOK panel — signed-in users only */}
      {isSignedIn && mode === "byok" && (
        <div className="space-y-5">
          {/* ── Model + endpoint options ─────────────────────────────────── */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">BYOK models</p>
            <div className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
              {savedModels.length > 0 && (
                <div className="space-y-2">
                  {savedModels.map((m) => {
                    const active = activeModelId === m.id;
                    const isEditing = editingModelId === m.id;
                    return (
                      <div
                        key={m.id}
                        className={`rounded-lg border px-3 py-2 ${active ? "border-[var(--accent)]" : "border-[var(--border)]"}`}
                        style={{ background: "var(--bg-primary)" }}
                      >
                        {isEditing ? (
                          <div className="space-y-2">
                            <div className="grid gap-2 md:grid-cols-2">
                              <input
                                type="text"
                                value={editingModelName}
                                onChange={(e) => {
                                  setEditingModelName(e.target.value);
                                  setEditModelError("");
                                }}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                                placeholder="Model name"
                              />
                              <input
                                type="text"
                                value={editingModelValue}
                                onChange={(e) => {
                                  setEditingModelValue(e.target.value);
                                  setEditModelError("");
                                }}
                                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                                placeholder="Model ID"
                              />
                            </div>
                            <input
                              type="url"
                              value={editingModelEndpoint}
                              onChange={(e) => setEditingModelEndpoint(e.target.value)}
                              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs text-[var(--text-primary)]"
                              placeholder="Custom endpoint (optional)"
                            />
                            {editModelError && <p className="text-[11px] text-red-400">{editModelError}</p>}
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={handleCancelEditModel}
                                className="rounded px-2 py-1 text-[11px] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEditModel(m.id)}
                                className="rounded px-2 py-1 text-[11px] font-semibold text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveModelId(m.id)}
                              className={`h-3 w-3 rounded-full border-2 ${active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-[var(--text-muted)]"}`}
                              aria-label={active ? "Active model" : "Inactive model"}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-[var(--text-primary)]">{m.name}</p>
                              <p className="truncate text-[11px] text-[var(--text-muted)]">{m.model}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleStartEditModel(m)}
                              className="rounded px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteModel(m.id)}
                              className="rounded px-2 py-1 text-[11px] text-[var(--text-muted)] hover:text-red-400"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                  Model name
                </label>
                <input
                  type="text"
                  value={addModelName}
                  onChange={(e) => { setAddModelName(e.target.value); setAddModelError(""); }}
                  placeholder="e.g. OpenRouter Sonnet"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-[var(--text-secondary)]">
                  Model ID
                </label>
                <input
                  type="text"
                  value={addModelId}
                  onChange={(e) => { setAddModelId(e.target.value); setAddModelError(""); }}
                  placeholder="e.g. anthropic/claude-3.5-sonnet or openai/gpt-4o-mini"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div className="rounded-lg border border-dashed border-[var(--border)] px-3 py-2.5">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">Advanced (optional)</p>
                <label className="mb-1 mt-2 block text-[11px] text-[var(--text-muted)]">
                  Custom endpoint
                </label>
                <input
                  type="url"
                  value={addModelEndpoint}
                  onChange={(e) => setAddModelEndpoint(e.target.value)}
                  placeholder="https://your-openai-compatible-endpoint/v1"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                  For OpenRouter, leave this blank unless you intentionally use a custom endpoint.
                </p>
              </div>
              {addModelError && <p className="text-xs text-red-400">{addModelError}</p>}
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Add multiple models, then choose one in chat.
                </p>
                <button
                  type="button"
                  onClick={handleAddModel}
                  className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-xs font-semibold text-[var(--bg-primary)]"
                >
                  Add model
                </button>
              </div>
            </div>
          </div>

          {/* ── Saved keys list ─────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">Saved keys</p>
            {savedKeys.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-4 text-center space-y-1">
                <p className="text-sm text-[var(--text-muted)]">No keys saved on this device</p>
                <p className="text-xs text-[var(--text-muted)] opacity-70">
                  Keys are stored in this browser only, they don&apos;t sync across devices. Add a key below.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedKeys.map((meta) => (
                  <KeyRow
                    key={meta.id}
                    meta={meta}
                    isActive={activeKeyId === meta.id}
                    isEditing={editingId === meta.id}
                    editingName={editingName}
                    valueAvailable={isKeyValueAvailable(meta.id)}
                    onSelect={() => handleSelectKey(meta.id)}
                    onStartEdit={() => handleStartEdit(meta)}
                    onEditNameChange={setEditingName}
                    onSaveEdit={() => handleSaveEdit(meta.id)}
                    onCancelEdit={handleCancelEdit}
                    onDelete={() => handleDeleteKey(meta.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Add a key ───────────────────────────────────────────────── */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.15em] text-[var(--text-muted)]">Add a key</p>
            <div className="space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">

              {/* Key name */}
              <input
                type="text"
                value={addName}
                onChange={(e) => { setAddName(e.target.value); setAddError(""); }}
                placeholder="Key name (e.g. My Groq Key)"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                autoComplete="off"
                spellCheck={false}
              />

              {/* Key value + show/hide */}
              <div className="flex gap-2">
                <input
                  type={addValueVisible ? "text" : "password"}
                  value={addValue}
                  onChange={(e) => { setAddValue(e.target.value); setAddError(""); }}
                  placeholder="sk-… (Groq, Claude, OpenAI, etc.)"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setAddValueVisible((v) => !v)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  {addValueVisible ? "Hide" : "Show"}
                </button>
              </div>

              {/* Storage mode toggle */}
              <div className="grid grid-cols-2 gap-2">
                <StorageButton
                  active={addStorageMode === "session"}
                  onClick={() => setAddStorageMode("session")}
                  label="Session only"
                  description="Cleared on tab close."
                />
                <StorageButton
                  active={addStorageMode === "persistent"}
                  onClick={() => setAddStorageMode("persistent")}
                  label="Persistent"
                  description="Stored in localStorage."
                />
              </div>

              {/* Persistent warning */}
              {addStorageMode === "persistent" && (
                <p className="rounded-lg border border-yellow-700/40 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-300">
                  ⚠ Your key will be written to localStorage and persist across sessions. Never use on a shared or public device.
                </p>
              )}

              {/* Error message */}
              {addError && (
                <p className="text-xs text-red-400">{addError}</p>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleAddKey}
                className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--bg-primary)] disabled:opacity-40"
              >
                Save key
              </button>
            </div>
          </div>
        </div>
      )}
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}

// ─── ModeButton ───────────────────────────────────────────────────────────────
function ModeButton({
  active, onClick, label, description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-4 text-left transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--bg-elevated)] text-[var(--text-primary)]"
          : "border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs leading-snug text-[var(--text-muted)]">{description}</p>
    </button>
  );
}

// ─── StorageButton ────────────────────────────────────────────────────────────
function StorageButton({
  active, onClick, label, description,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border-2 p-3 text-left transition-colors ${
        active
          ? "border-[var(--accent)] bg-[var(--bg-primary)] text-[var(--text-primary)]"
          : "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
      }`}
    >
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-0.5 text-xs leading-snug text-[var(--text-muted)]">{description}</p>
    </button>
  );
}
