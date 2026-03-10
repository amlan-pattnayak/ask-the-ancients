"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import { api } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import BottomNav from "@/components/layout/BottomNav";
import Navbar from "@/components/layout/Navbar";
import RenameThreadModal from "@/components/threads/RenameThreadModal";
import DeleteThreadModal from "@/components/threads/DeleteThreadModal";
import Link from "next/link";
import { IconSearch, IconClose, IconHistory, IconTrash, IconEdit } from "@/components/ui/icons";
import Toast from "@/components/ui/Toast";

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

type DateGroup = "Today" | "Yesterday" | "Last Week" | "Older";

function getDateGroup(ts: number): DateGroup {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const weekStart = todayStart - 7 * 86_400_000;
  if (ts >= todayStart) return "Today";
  if (ts >= yesterdayStart) return "Yesterday";
  if (ts >= weekStart) return "Last Week";
  return "Older";
}

const GROUP_ORDER: DateGroup[] = ["Today", "Yesterday", "Last Week", "Older"];

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const { user, isLoaded } = useUser();
  const principal = usePrincipal();
  const isSignedIn = isLoaded && !!user;

  const philosophers = useQuery(api.philosophers.listActive) ?? [];
  const philosopherById = new Map(philosophers.map((p) => [p._id, p]));

  const deleteThread = useMutation(api.threads.deleteThread);
  const renameThread = useMutation(api.threads.renameThread);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [renameThreadId, setRenameThreadId] = useState<string | null>(null);
  const [renameInitialTitle, setRenameInitialTitle] = useState<string | undefined>(undefined);
  const [renameFallbackTitle, setRenameFallbackTitle] = useState("Conversation");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteThreadId, setDeleteThreadId] = useState<string | null>(null);
  const [deleteThreadTitle, setDeleteThreadTitle] = useState<string | undefined>(undefined);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const threads = useQuery(
    api.threads.listByPrincipal,
    principal.isLoading
      ? "skip"
      : { principalType: principal.principalType, principalId: principal.principalId }
  ) ?? [];

  const [query, setQuery] = useState("");

  const filtered = threads.filter((t) => {
    const p = philosopherById.get(t.philosopherId);
    const hay = `${t.title ?? ""} ${p?.name ?? ""} ${p?.school ?? ""}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  // Group threads by date bucket
  const groups = GROUP_ORDER.reduce<Record<DateGroup, typeof filtered>>((acc, label) => {
    acc[label] = [];
    return acc;
  }, {} as Record<DateGroup, typeof filtered>);

  for (const t of filtered) {
    groups[getDateGroup(t.lastMessageAt)].push(t);
  }

  const activeGroups = GROUP_ORDER.filter((g) => groups[g].length > 0);

  function showToast(message: string) {
    setToastMessage(message);
    setToastVisible(true);
    window.setTimeout(() => setToastVisible(false), 2200);
  }

  function openDeleteModal(threadId: string, threadTitle?: string) {
    setDeleteThreadId(threadId);
    setDeleteThreadTitle(threadTitle);
    setDeleteModalOpen(true);
  }

  function closeDeleteModal() {
    if (deletingId) return;
    setDeleteModalOpen(false);
    setDeleteThreadId(null);
    setDeleteThreadTitle(undefined);
  }

  async function handleDeleteConfirm() {
    if (!principal.principalId || !deleteThreadId) return;
    setDeletingId(deleteThreadId);
    try {
      await deleteThread({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        threadId: deleteThreadId as any,
        principalType: principal.principalType,
        principalId: principal.principalId,
      });
      closeDeleteModal();
      showToast("Conversation deleted");
    } finally {
      setDeletingId(null);
    }
  }

  function openRenameModal(threadId: string, currentTitle: string | undefined, fallbackName: string) {
    setRenameThreadId(threadId);
    setRenameInitialTitle(currentTitle);
    setRenameFallbackTitle(fallbackName);
    setRenameModalOpen(true);
  }

  function closeRenameModal() {
    if (renamingId) return;
    setRenameModalOpen(false);
    setRenameThreadId(null);
    setRenameInitialTitle(undefined);
  }

  async function handleRenameSubmit(title: string) {
    if (!principal.principalId || !renameThreadId) return;
    setRenamingId(renameThreadId);
    try {
      await renameThread({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        threadId: renameThreadId as any,
        principalType: principal.principalType,
        principalId: principal.principalId,
        title,
      });
      closeRenameModal();
    } finally {
      setRenamingId(null);
    }
  }

  const isLoading = principal.isLoading || threads === undefined;

  if (isLoaded && !isSignedIn) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary)" }}>
        <Navbar />
        <div className="flex flex-col items-center justify-center gap-6 px-6 pt-32 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(201,151,58,0.1)", border: "1px solid rgba(201,151,58,0.2)" }}
          >
            <IconHistory size={28} style={{ color: "var(--accent)" }} />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Sign in to view chat history
          </h2>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Your conversations with the philosophers are saved when you sign in.
          </p>
          <SignInButton mode="modal">
            <button
              className="rounded-xl px-6 py-2.5 text-sm font-semibold transition-colors"
              style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
            >
              Sign in
            </button>
          </SignInButton>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-5 md:py-8">
        <header className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.75 }}
          >
            Archive
          </p>
          <h1
            className="font-serif text-3xl font-semibold md:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            History
          </h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Pick up where you left off, rename threads, or remove old conversations.
          </p>
        </header>
        {/* Search */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-4 py-3"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-strong)",
          }}
        >
          <IconSearch size={15} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations…"
            className="flex-1 bg-transparent text-sm focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex-shrink-0 transition-colors duration-150"
              style={{ color: "var(--text-muted)" }}
            >
              <IconClose size={14} />
            </button>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && threads.length === 0 && (
          <div
            className="rounded-2xl px-6 py-12 text-center"
            style={{ border: "1px dashed var(--border-strong)" }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              <IconHistory size={24} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No conversations yet</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Start one from the philosophers page.</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150"
              style={{ background: "var(--accent)", color: "var(--color-navy)" }}
            >
              Browse philosophers
            </Link>
          </div>
        )}

        {/* No results */}
        {!isLoading && threads.length > 0 && filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--text-muted)]">No conversations match &ldquo;{query}&rdquo;</p>
        )}

        {/* Grouped thread list */}
        {!isLoading && activeGroups.map((groupLabel) => (
          <section key={groupLabel}>
            <p className="mb-3 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
              {groupLabel}
            </p>
            <div className="space-y-3">
              {groups[groupLabel].map((thread) => {
                const philosopher = philosopherById.get(thread.philosopherId);
                const isDeleting = deletingId === thread._id;
                return (
                  <div key={thread._id}>
                    <Link
                      href={`/chat/${thread._id}`}
                      className="block rounded-2xl px-4 py-4 transition-all duration-200"
                      style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-accent)"; (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-secondary)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card)"; }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Avatar */}
                        <div className="flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--bg-primary)]">
                          {philosopher ? initials(philosopher.name) : "?"}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
                              {philosopher?.name ?? "Conversation"}
                            </span>
                            <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                              {relativeTime(thread.lastMessageAt)}
                            </span>
                          </div>

                          {philosopher?.school && (
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--accent)]">
                              {philosopher.school}
                            </p>
                          )}

                          {thread.title && (
                            <div className="mt-1.5 flex items-start gap-2">
                              <span
                                className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]"
                                style={{
                                  background: "rgba(201, 151, 58, 0.12)",
                                  border: "1px solid rgba(201, 151, 58, 0.25)",
                                  color: "var(--accent)",
                                }}
                              >
                                Saved title
                              </span>
                              <p className="line-clamp-2 text-sm font-medium text-[var(--text-secondary)]">
                                {thread.title}
                              </p>
                            </div>
                          )}

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="text-xs text-[var(--text-muted)]">
                              {thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={renamingId === thread._id}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openRenameModal(thread._id, thread.title, philosopher?.name ?? "Conversation");
                                }}
                                title="Rename conversation"
                                className="flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 disabled:opacity-40"
                                style={{ color: "var(--text-muted)", background: "rgba(10, 17, 32, 0.45)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,151,58,0.12)"; e.currentTarget.style.color = "var(--accent)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10, 17, 32, 0.45)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                <IconEdit size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  openDeleteModal(thread._id, thread.title);
                                }}
                                title="Delete conversation"
                                className="flex items-center justify-center rounded-lg p-1.5 transition-colors duration-150 disabled:opacity-40"
                                style={{ color: "var(--text-muted)", background: "rgba(10, 17, 32, 0.45)" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "rgb(248,113,113)"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(10, 17, 32, 0.45)"; e.currentTarget.style.color = "var(--text-muted)"; }}
                              >
                                <IconTrash size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!isLoading && threads.length > 0 && (
          <p className="text-center text-xs italic text-[var(--text-muted)]">
            Use the edit and trash buttons on each conversation to rename or delete.
          </p>
        )}
      </main>

      <RenameThreadModal
        open={renameModalOpen}
        initialTitle={renameInitialTitle}
        fallbackTitle={renameFallbackTitle}
        isSaving={Boolean(renamingId)}
        onClose={closeRenameModal}
        onSave={handleRenameSubmit}
      />
      <DeleteThreadModal
        open={deleteModalOpen}
        threadTitle={deleteThreadTitle}
        isDeleting={Boolean(deletingId)}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
      />
      <Toast message={toastMessage} visible={toastVisible} />

      <BottomNav />
    </div>
  );
}
