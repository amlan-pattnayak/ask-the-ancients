"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import type { Id } from "@/lib/convex";
import { readByokConfig, readSavedByokModels } from "@/lib/byok-storage";
import { usePrincipal } from "@/hooks/use-principal";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import MessageBubble from "@/components/chat/MessageBubble";
import { IconArrowLeft, IconChevronDown, IconEdit, IconTrash } from "@/components/ui/icons";
import Link from "next/link";

// ── Helpers ────────────────────────────────────────────────────────────────────

function getProviderLabel(modelId: string, endpoint?: string): string {
  if (endpoint) return "Custom";
  if (modelId.startsWith("claude")) return "Anthropic";
  if (modelId.startsWith("gpt") || modelId.startsWith("o1") || modelId.startsWith("o3")) return "OpenAI";
  const prefix = modelId.split("/")[0]?.toLowerCase() ?? "";
  if (!prefix || prefix === modelId.toLowerCase()) return "Other";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

// ── Model selector pill ────────────────────────────────────────────────────────

interface ModelOption {
  id: string;
  label: string;
  detail?: string;
  provider?: string;
}

function ModelPill({
  options,
  selectedId,
  onSelect,
  disabled,
}: {
  options: ModelOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === selectedId) ?? options[0];

  const grouped = useMemo(() => {
    const map = new Map<string, ModelOption[]>();
    for (const o of options) {
      const p = o.provider?.trim() || "Other";
      map.set(p, [...(map.get(p) ?? []), o]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "App") return -1;
      if (b === "App") return 1;
      return a.localeCompare(b);
    });
  }, [options]);

  useEffect(() => {
    if (!open) return;
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOut);
    return () => document.removeEventListener("mousedown", onOut);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled || options.length === 0}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors duration-150 disabled:opacity-40"
        style={{
          borderColor: open ? "rgba(212,168,67,0.45)" : "var(--border)",
          color: "var(--text-secondary)",
          background: "var(--bg-elevated)",
        }}
      >
        <span className="max-w-[140px] truncate">{selected?.label ?? "Model"}</span>
        <IconChevronDown
          size={12}
          style={{ flexShrink: 0, transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      {open && options.length > 0 && (
        <div
          className="absolute bottom-full left-0 z-50 mb-2 max-h-56 w-64 overflow-y-auto rounded-xl border p-1.5"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--bg-card)",
            boxShadow: "0 12px 24px rgba(2,6,23,0.32)",
          }}
        >
          {grouped.map(([provider, opts]) => (
            <div key={provider} className="mb-1.5 last:mb-0">
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                {provider}
              </p>
              {opts.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelect(o.id); setOpen(false); }}
                  className="block w-full rounded-lg px-2.5 py-2 text-left transition-colors duration-100"
                  style={{
                    background: o.id === selectedId ? "rgba(212,168,67,0.08)" : "transparent",
                  }}
                  onMouseEnter={(e) => { if (o.id !== selectedId) e.currentTarget.style.background = "var(--bg-elevated)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = o.id === selectedId ? "rgba(212,168,67,0.08)" : "transparent"; }}
                >
                  <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>{o.label}</p>
                  {o.detail && (
                    <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>{o.detail}</p>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Custom philosopher dropdown ────────────────────────────────────────────────

function PhilosopherSelect({
  value,
  onChange,
  philosophers,
  placeholder = "Select philosopher",
  disabled = false,
}: {
  value: Id<"philosophers"> | "";
  onChange: (id: Id<"philosophers"> | "") => void;
  philosophers: Array<{ _id: Id<"philosophers">; name: string }>;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = philosophers.find((p) => p._id === value);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50"
        style={{
          background: "var(--bg-primary)",
          border: `1px solid ${open ? "rgba(212,168,67,0.45)" : "var(--border)"}`,
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        <span>{selected?.name ?? placeholder}</span>
        <IconChevronDown
          size={15}
          style={{
            color: "var(--text-muted)",
            transition: "transform 0.18s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1.5 w-full overflow-hidden rounded-xl py-1"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
            boxShadow: "0 12px 36px rgba(2,6,23,0.65)",
          }}
        >
          {philosophers.map((p) => {
            const isSelected = p._id === value;
            return (
              <button
                key={p._id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(p._id); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-sm transition-colors duration-100"
                style={{
                  background: isSelected ? "rgba(212,168,67,0.08)" : "transparent",
                  color: isSelected ? "var(--accent)" : "var(--text-primary)",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                {isSelected
                  ? <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: "var(--accent)" }} />
                  : <span className="h-1.5 w-1.5 shrink-0" />
                }
                {p.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface ComparisonCitation {
  workTitle: string;
  chapterRef: string;
  passage: string;
  sourceTextId?: string;
}

interface ComparisonResultSide {
  answer: string;
  citations: ComparisonCitation[];
}

interface ComparisonResponse {
  results: {
    philosopherA: ComparisonResultSide;
    philosopherB: ComparisonResultSide;
  };
}

type SavedComparison = {
  _id: Id<"dialectic_comparisons">;
  title?: string;
  question: string;
  philosopherAId: Id<"philosophers">;
  philosopherAName: string;
  philosopherBId: Id<"philosophers">;
  philosopherBName: string;
  answerA: string;
  answerB: string;
  citationsA: ComparisonCitation[];
  citationsB: ComparisonCitation[];
  createdAt: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ── History item card ───────────────────────────────────────────────────────────

function HistoryItem({
  item,
  principalType,
  principalId,
  onRestore,
}: {
  item: SavedComparison;
  principalType: "anon" | "user";
  principalId: string;
  onRestore: (item: SavedComparison) => void;
}) {
  const renameMutation = useMutation(api.dialecticComparisons.rename);
  const removeMutation = useMutation(api.dialecticComparisons.remove);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(item.title ?? item.question);
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  }

  async function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== (item.title ?? item.question)) {
      await renameMutation({ comparisonId: item._id, principalType, principalId, title: trimmed }).catch(() => {});
    }
    setEditing(false);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    await removeMutation({ comparisonId: item._id, principalType, principalId }).catch(() => {});
  }

  const displayTitle = item.title ?? item.question;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !editing && onRestore(item)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !editing) {
          e.preventDefault();
          onRestore(item);
        }
      }}
      className="block cursor-pointer rounded-2xl px-4 py-4 transition-all duration-200"
      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border-accent)";
        e.currentTarget.style.background = "var(--bg-secondary)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--bg-card)";
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--border-accent)";
        e.currentTarget.style.background = "var(--bg-secondary)";
        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 151, 58, 0.18)";
      }}
      onBlur={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--bg-card)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar — balance scale medallion */}
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[var(--bg-primary)]"
          style={{ background: "var(--accent)" }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v18" /><path d="M4 6h16" />
            <path d="M6 6l-3 6a3 3 0 0 0 6 0L6 6Z" />
            <path d="M18 6l-3 6a3 3 0 0 0 6 0L18 6Z" />
            <path d="M9 21h6" />
          </svg>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center justify-between gap-2">
            {editing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void commitRename()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitRename();
                  if (e.key === "Escape") setEditing(false);
                }}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 rounded-lg px-2 py-0.5 text-sm font-semibold"
                style={{
                  background: "var(--bg-elevated)",
                  border: "1px solid rgba(212,168,67,0.45)",
                  color: "var(--text-primary)",
                  outline: "none",
                }}
              />
            ) : (
              <span className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {displayTitle}
              </span>
            )}
            <span className="flex-shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
              {relativeTime(item.createdAt)}
            </span>
          </div>

          {/* Philosophers badge */}
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--accent)" }}>
            {item.philosopherAName} <span style={{ opacity: 0.55 }}>vs</span> {item.philosopherBName}
          </p>

          {/* If title is customized, show question below as subtitle */}
          {item.title && (
            <p className="mt-1 line-clamp-1 text-xs" style={{ color: "var(--text-muted)" }}>
              {item.question}
            </p>
          )}

          {/* Action buttons */}
          <div className="mt-2 flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={startEdit}
              title="Rename"
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150"
              style={{ color: "var(--text-muted)", background: "rgba(10,17,32,0.45)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,151,58,0.12)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,17,32,0.45)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <IconEdit size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => void handleDelete(e)}
              title="Delete"
              className="flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150"
              style={{ color: "var(--text-muted)", background: "rgba(10,17,32,0.45)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "rgb(248,113,113)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10,17,32,0.45)"; e.currentTarget.style.color = "var(--text-muted)"; }}
            >
              <IconTrash size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ComparisonInterface() {
  const router = useRouter();
  const philosophers = useQuery(api.philosophers.listActive) ?? [];
  const { principalType, principalId, isLoading: isPrincipalLoading } = usePrincipal();
  const createWithSeed = useMutation(api.threads.createWithSeed);
  const saveComparison = useMutation(api.dialecticComparisons.save);

  const history = useQuery(
    api.dialecticComparisons.listByPrincipal,
    principalId ? { principalType, principalId } : "skip",
  ) as SavedComparison[] | undefined;

  const [activeTab, setActiveTab] = useState<"compare" | "history">("compare");
  const [question, setQuestion] = useState("");
  const [philosopherAId, setPhilosopherAId] = useState<Id<"philosophers"> | "">("");
  const [philosopherBId, setPhilosopherBId] = useState<Id<"philosophers"> | "">("");
  const [isComparing, setIsComparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<"A" | "B">("A");
  const [result, setResult] = useState<ComparisonResponse | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [continuingWith, setContinuingWith] = useState<"A" | "B" | null>(null);
  const [savedByokModels, setSavedByokModels] = useState<Array<{ id: string; name: string; model: string; endpoint?: string }>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("app-default");

  // Keep model options in sync with settings changes (storage events from Settings page).
  useEffect(() => {
    function sync() {
      const { models, activeByokModelId } = readSavedByokModels();
      setSavedByokModels(models);
      const nextDefault = activeByokModelId ? `byok:${activeByokModelId}` : "app-default";
      setSelectedModelId((current) => {
        if (current === "app-default") return nextDefault;
        const stillExists = current.startsWith("byok:") && models.some((m) => `byok:${m.id}` === current);
        return stillExists ? current : nextDefault;
      });
    }
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const philosopherById = useMemo(
    () => new Map(philosophers.map((p) => [p._id, p])),
    [philosophers],
  );

  const philosopherA = philosopherAId ? philosopherById.get(philosopherAId) : undefined;
  const philosopherB = philosopherBId ? philosopherById.get(philosopherBId) : undefined;

  const modelOptions = useMemo<ModelOption[]>(() => {
    const saved = savedByokModels.map((m) => ({
      id: `byok:${m.id}`,
      label: m.name,
      detail: m.model,
      provider: getProviderLabel(m.model, m.endpoint),
    }));
    return [
      { id: "app-default", label: "App Default", detail: "Shared Groq provider", provider: "App" },
      ...saved,
    ];
  }, [savedByokModels]);

  async function handleCompare() {
    const trimmed = question.trim();
    if (!trimmed || !philosopherAId || !philosopherBId || philosopherAId === philosopherBId) return;

    // Resolve model selection to BYOK params (or guest mode).
    let mode: "guest" | "byok" = "guest";
    let byokKey: string | undefined;
    let byokModel: string | undefined;
    let byokEndpoint: string | undefined;
    if (selectedModelId.startsWith("byok:")) {
      const byok = readByokConfig();
      if (!byok) {
        setError("Selected BYOK model needs an available API key. Add one in Settings.");
        return;
      }
      const modelId = selectedModelId.replace("byok:", "");
      const saved = byok.savedModels?.find((m) => m.id === modelId);
      mode = "byok";
      byokKey = byok.key;
      byokModel = saved?.model ?? byok.model;
      byokEndpoint = saved?.endpoint ?? byok.customEndpoint;
    }

    setIsComparing(true);
    setError(null);
    setResult(null);
    setSummary(null);
    setSummaryError(null);
    try {
      const response = await fetch("/api/agora/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          philosopherAId,
          philosopherBId,
          mode,
          byokKey,
          byokModel,
          byokEndpoint,
          principalType,
          principalId,
        }),
      });
      if (!response.ok) throw new Error(await response.text());

      const payload = (await response.json()) as ComparisonResponse;
      setResult(payload);

      // Auto-save to history
      if (principalId && philosopherAId && philosopherBId) {
        saveComparison({
          principalType,
          principalId,
          question: trimmed,
          philosopherAId: philosopherAId as Id<"philosophers">,
          philosopherAName: philosopherById.get(philosopherAId)?.name ?? "",
          philosopherBId: philosopherBId as Id<"philosophers">,
          philosopherBName: philosopherById.get(philosopherBId)?.name ?? "",
          answerA: payload.results.philosopherA.answer,
          answerB: payload.results.philosopherB.answer,
          citationsA: payload.results.philosopherA.citations.map(({ workTitle, chapterRef, passage }) => ({ workTitle, chapterRef, passage })),
          citationsB: payload.results.philosopherB.citations.map(({ workTitle, chapterRef, passage }) => ({ workTitle, chapterRef, passage })),
        }).catch(() => { /* best-effort */ });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setIsComparing(false);
    }
  }

  async function handleSummarize() {
    if (!result) return;
    const wantsByok = selectedModelId.startsWith("byok:");
    let mode: "guest" | "byok" = "guest";
    let byokKey: string | undefined;
    let byokModel: string | undefined;
    let byokEndpoint: string | undefined;
    if (wantsByok) {
      const byok = readByokConfig();
      if (!byok) {
        setSummaryError("Selected BYOK model needs an available API key. Add one in Settings.");
        return;
      }
      const modelId = selectedModelId.replace("byok:", "");
      const saved = byok.savedModels?.find((m) => m.id === modelId);
      mode = "byok";
      byokKey = byok.key;
      byokModel = saved?.model ?? byok.model;
      byokEndpoint = saved?.endpoint ?? byok.customEndpoint;
    }

    setIsSummarizing(true);
    setSummaryError(null);
    try {
      const response = await fetch("/api/agora/summarize-difference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          philosopherAName: philosopherA?.name ?? "Philosopher A",
          answerA: result.results.philosopherA.answer,
          philosopherBName: philosopherB?.name ?? "Philosopher B",
          answerB: result.results.philosopherB.answer,
          mode,
          byokKey,
          byokModel,
          byokEndpoint,
          principalId,
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSummary(((await response.json()) as { summary: string }).summary);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : "Summarization failed.");
    } finally {
      setIsSummarizing(false);
    }
  }

  async function handleContinue(side: "A" | "B") {
    if (!result || !principalId) return;
    const philosopherId = side === "A" ? philosopherAId : philosopherBId;
    const answer = side === "A" ? result.results.philosopherA.answer : result.results.philosopherB.answer;
    const name = side === "A" ? (philosopherA?.name ?? "Philosopher A") : (philosopherB?.name ?? "Philosopher B");
    if (!philosopherId) return;

    setContinuingWith(side);
    try {
      const threadId = await createWithSeed({
        principalType,
        principalId,
        philosopherId: philosopherId as Id<"philosophers">,
        title: question.trim().slice(0, 80),
        seedUserMessage: question.trim(),
        seedAssistantMessage: answer,
      });
      router.push(`/chat/${threadId}`);
    } catch {
      setContinuingWith(null);
      setError(`Could not start conversation with ${name}.`);
    }
  }

  function restoreFromHistory(item: SavedComparison) {
    setQuestion(item.question);
    setPhilosopherAId(item.philosopherAId);
    setPhilosopherBId(item.philosopherBId);
    setResult({
      results: {
        philosopherA: { answer: item.answerA, citations: item.citationsA },
        philosopherB: { answer: item.answerB, citations: item.citationsB },
      },
    });
    setSummary(null);
    setSummaryError(null);
    setError(null);
    setActiveTab("compare");
  }

  const canCompare =
    question.trim().length > 0 &&
    !!philosopherAId &&
    !!philosopherBId &&
    philosopherAId !== philosopherBId &&
    !isComparing &&
    !isPrincipalLoading &&
    principalId.length > 0;

  const showColumns = isComparing || !!result;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">

        {/* Back link */}
        <Link
          href="/compare"
          className="flex w-fit items-center gap-1.5 text-xs transition-colors duration-150"
          style={{ color: "var(--text-muted)" }}
        >
          <IconArrowLeft size={13} />
          <span>The Agora</span>
        </Link>

        {/* Page header + tabs */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="font-serif text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
                The Dialectic
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
                Two philosophers. One question. Let reason decide.
              </p>
            </div>
            <span
              className="hidden shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] sm:block"
              style={{
                background: "rgba(212,168,67,0.10)",
                color: "var(--accent)",
                border: "1px solid rgba(212,168,67,0.18)",
              }}
            >
              διαλεκτική
            </span>
          </div>

          {/* Tab row */}
          <div
            className="flex gap-1 rounded-xl p-1 w-fit"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            {(["compare", "history"] as const).map((tab) => {
              const label = tab === "compare" ? "Compare" : "Dialectic History";
              const count = tab === "history" && history ? history.length : null;
              const active = activeTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-150"
                  style={{
                    background: active ? "rgba(212,168,67,0.12)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {label}
                  {count !== null && count > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: active ? "rgba(212,168,67,0.2)" : "rgba(255,255,255,0.07)",
                        color: active ? "var(--accent)" : "var(--text-muted)",
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Compare tab ─────────────────────────────────────────────────────── */}
        {activeTab === "compare" && (
          <>
            <section
              className="rounded-2xl p-4 md:p-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                    Philosopher A
                  </span>
                  <PhilosopherSelect
                    value={philosopherAId}
                    onChange={setPhilosopherAId}
                    philosophers={philosophers}
                    disabled={isComparing}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                    Philosopher B
                  </span>
                  <PhilosopherSelect
                    value={philosopherBId}
                    onChange={setPhilosopherBId}
                    philosophers={philosophers}
                    disabled={isComparing}
                  />
                </label>
              </div>

              <label className="mt-3 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-muted)" }}>
                  Question
                </span>
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="What should I do when I feel overwhelmed?"
                  rows={4}
                  disabled={isComparing}
                  className="resize-y rounded-xl px-3 py-2 text-sm disabled:opacity-60"
                  style={{
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </label>

              <div className="mt-3 flex items-center justify-between gap-3">
                <ModelPill
                  options={modelOptions}
                  selectedId={selectedModelId}
                  onSelect={setSelectedModelId}
                  disabled={isComparing}
                />
                <button
                  type="button"
                  onClick={() => void handleCompare()}
                  disabled={!canCompare}
                  className="rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "var(--color-navy)" }}
                >
                  {isComparing ? "Comparing…" : "Compare"}
                </button>
              </div>

              {error && (
                <p className="mt-3 text-sm" style={{ color: "rgb(248,113,113)" }}>{error}</p>
              )}
            </section>

            {showColumns && (
              <>
                {/* Mobile tab switcher */}
                <div className="flex items-center gap-2 md:hidden">
                  {(["A", "B"] as const).map((side) => {
                    const name = side === "A" ? (philosopherA?.name ?? "Philosopher A") : (philosopherB?.name ?? "Philosopher B");
                    return (
                      <button
                        key={side}
                        type="button"
                        onClick={() => setActiveMobileTab(side)}
                        className="rounded-full px-3 py-1.5 text-xs font-semibold"
                        style={{
                          color: activeMobileTab === side ? "var(--color-navy)" : "var(--text-secondary)",
                          background: activeMobileTab === side ? "var(--accent)" : "var(--bg-card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>

                {/* Results grid */}
                <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {(["A", "B"] as const).map((side) => {
                    const philosopher = side === "A" ? philosopherA : philosopherB;
                    const legResult = result
                      ? (side === "A" ? result.results.philosopherA : result.results.philosopherB)
                      : null;
                    const isVisible = activeMobileTab === side;

                    return (
                      <div
                        key={side}
                        className={isVisible ? "flex flex-col gap-3" : "hidden md:flex md:flex-col md:gap-3"}
                      >
                        <div className="px-1 text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--accent)" }}>
                          {philosopher?.name ?? `Philosopher ${side}`}
                        </div>
                        <MessageBubble
                          role="assistant"
                          content={legResult?.answer ?? ""}
                          citations={legResult?.citations ?? []}
                          philosopherName={philosopher?.name}
                          isStreaming={isComparing}
                          extraActions={legResult ? (
                            <button
                              type="button"
                              onClick={() => void handleContinue(side)}
                              disabled={continuingWith !== null}
                              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 disabled:opacity-50"
                              style={{
                                background: "rgba(212,168,67,0.08)",
                                border: "1px solid rgba(212,168,67,0.2)",
                                color: "var(--accent)",
                              }}
                            >
                              {continuingWith === side ? "Opening…" : (
                                <>
                                  Continue
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                  </svg>
                                </>
                              )}
                            </button>
                          ) : undefined}
                        />
                      </div>
                    );
                  })}
                </section>

                {/* Key Differences */}
                {result && (
                  <section
                    className="rounded-2xl p-4 md:p-5"
                    style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
                  >
                    <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>Key Differences</h2>
                    <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>A neutral summary of how these responses differ.</p>

                    {!summary && (
                      <button
                        type="button"
                        onClick={() => void handleSummarize()}
                        disabled={isSummarizing}
                        className="mt-3 rounded-full px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
                        style={{ background: "var(--accent)", color: "var(--color-navy)" }}
                      >
                        {isSummarizing ? "Analyzing…" : "What's the key difference?"}
                      </button>
                    )}

                    {summary && (
                      <ul className="mt-3 flex flex-col gap-2">
                        {summary.split("\n").filter((l) => /^\s*[-*]\s/.test(l)).map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--accent)" }} />
                            <span>{line.replace(/^\s*[-*]\s+/, "")}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {summaryError && (
                      <p className="mt-3 text-sm" style={{ color: "rgb(248,113,113)" }}>{summaryError}</p>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ── History tab ──────────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <section className="flex flex-col gap-3">
            {!history ? (
              <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>Loading…</p>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "rgba(212,168,67,0.08)", border: "1px solid rgba(212,168,67,0.15)" }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--accent)", opacity: 0.6 }}>
                    <path d="M12 3v18M4 6h16M6 6l-3 6a3 3 0 0 0 6 0L6 6ZM18 6l-3 6a3 3 0 0 0 6 0L18 6ZM9 21h6" />
                  </svg>
                </div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>No comparisons yet.</p>
                <button
                  type="button"
                  onClick={() => setActiveTab("compare")}
                  className="rounded-full px-4 py-2 text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "var(--color-navy)" }}
                >
                  Start comparing
                </button>
              </div>
            ) : (
              history.map((item) => (
                <HistoryItem
                  key={item._id}
                  item={item}
                  principalType={principalType}
                  principalId={principalId}
                  onRestore={restoreFromHistory}
                />
              ))
            )}
          </section>
        )}

      </main>
      <BottomNav />
    </div>
  );
}
