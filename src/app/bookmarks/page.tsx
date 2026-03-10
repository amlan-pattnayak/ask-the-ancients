"use client";

import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { useUser, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import Navbar from "@/components/layout/Navbar";
import { api } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import { IconSearch, IconClose, IconBookmark } from "@/components/ui/icons";

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

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Copy feedback hook ───────────────────────────────────────────────────────

function useCopyFeedback() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  function copy(id: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }
  return { copiedId, copy };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BookmarksPage() {
  const { user, isLoaded } = useUser();
  const principal = usePrincipal();
  const toggleBookmark = useMutation(api.bookmarks.toggle);

  const items = useQuery(
    api.bookmarks.listByPrincipal,
    principal.isLoading
      ? "skip"
      : { principalType: principal.principalType, principalId: principal.principalId }
  ) ?? [];

  const [query, setQuery] = useState("");
  const [activeSchool, setActiveSchool] = useState<string>("All");
  const { copiedId, copy } = useCopyFeedback();

  // Derive unique schools from actual data
  const schools = Array.from(
    new Set(items.map((i) => i.philosopher?.school).filter(Boolean) as string[])
  ).sort();

  const filtered = items.filter((item) => {
    if (!item.message || !item.philosopher) return false;
    const matchesSchool =
      activeSchool === "All" || item.philosopher.school === activeSchool;
    if (!matchesSchool) return false;
    if (!query) return true;
    const hay = `${item.message.content ?? ""} ${item.philosopher.name ?? ""}`.toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  const isLoading = principal.isLoading || items === undefined;

  async function handleRemove(item: (typeof items)[number]) {
    if (!item.message || !principal.principalId) return;
    await toggleBookmark({
      principalType: principal.principalType,
      principalId: principal.principalId,
      threadId: item.bookmark.threadId,
      messageId: item.bookmark.messageId!,
    });
  }

  if (isLoaded && !user) {
    return (
      <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary)" }}>
        <Navbar />
        <div className="flex flex-col items-center justify-center gap-6 px-6 pt-32 text-center">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(201,151,58,0.1)", border: "1px solid rgba(201,151,58,0.2)" }}
          >
            <IconBookmark size={28} style={{ color: "var(--accent)" }} />
          </div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
            Sign in to save passages
          </h2>
          <p className="max-w-sm text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Save meaningful passages from the philosophers and revisit them anytime.
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
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 md:py-8">
        <header className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.75 }}
          >
            Collection
          </p>
          <h1
            className="font-serif text-3xl font-semibold md:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Saved Wisdom
          </h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Revisit the passages you marked during conversations.
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
            placeholder="Search saved passages…"
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

        {/* Filter chips */}
        {schools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {["All", ...schools].map((school) => (
              <button
                key={school}
                type="button"
                onClick={() => setActiveSchool(school)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeSchool === school
                    ? "bg-[var(--accent)] text-[var(--bg-primary)]"
                    : "border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-muted)]"
                }`}
              >
                {school}
              </button>
            ))}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-44 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && (
          <div
            className="rounded-2xl px-6 py-12 text-center"
            style={{ border: "1px dashed var(--border-strong)" }}
          >
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}
            >
              <IconBookmark size={22} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>No saved passages yet</p>
            <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
              Tap the bookmark icon on any philosopher response to save it here.
            </p>
          </div>
        )}

        {/* No filter results */}
        {!isLoading && items.length > 0 && filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--text-muted)]">
            {query
              ? `No saved passages match "${query}"`
              : `No saved passages from ${activeSchool} philosophers`}
          </p>
        )}

        {/* Bookmark cards */}
        <div className="space-y-4">
          {filtered.map((item) => {
            const { bookmark, message, thread, philosopher } = item;
            if (!message || !philosopher) return null;
            const bookmarkId = bookmark._id;

            // Truncate long content for display
            const displayContent =
              message.content.length > 400
                ? message.content.slice(0, 400) + "…"
                : message.content;

            const primaryCitation = message.citations?.[0];

            return (
              <div
                key={bookmarkId}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] px-5 py-5 space-y-4"
              >
                {/* Quote */}
                <p className="philosopher-text text-[var(--text-primary)] italic leading-relaxed">
                  &ldquo;{displayContent}&rdquo;
                </p>

                {/* Philosopher attribution */}
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-bold text-[var(--bg-primary)]">
                    {initials(philosopher.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{philosopher.name}</p>
                    {primaryCitation && (
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        {primaryCitation.workTitle}
                        {primaryCitation.chapterRef ? `, ${primaryCitation.chapterRef}` : ""}
                      </p>
                    )}
                  </div>
                  <span className="flex-shrink-0 text-xs text-[var(--text-muted)]">
                    {relativeTime(bookmark.createdAt)}
                  </span>
                </div>

                {/* Thread context */}
                {thread && (
                  <p className="text-xs italic text-[var(--text-muted)]">
                    Saved from: &ldquo;{thread.title ?? "Conversation"}&rdquo;
                  </p>
                )}

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {thread && (
                    <Link
                      href={`/chat/${thread._id}`}
                      className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      View in Context
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => copy(bookmarkId, message.content)}
                    className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    {copiedId === bookmarkId ? "Copied!" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(item)}
                    className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5 text-xs text-[var(--text-muted)] hover:bg-red-900/20 hover:text-red-400 transition-colors ml-auto"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {!isLoading && items.length > 0 && (
          <p className="text-center text-xs italic text-[var(--text-muted)]">
            Swipe left to remove from saved
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
