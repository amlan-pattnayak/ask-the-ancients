"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api, type Id } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import BottomNav from "@/components/layout/BottomNav";
import { IconArrowLeft } from "@/components/ui/icons";

// All philosopher busts are self-hosted at /public/busts/{slug}.jpg.
// Derive the URL directly from the slug so new philosophers work automatically.
function bustUrlForSlug(slug: string): string {
  return `/busts/${slug}.jpg`;
}

function initials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Shared sticky header — used by loading, not-found, and main render
function PageHeader({ backHref = "/philosophers" }: { backHref?: string }) {
  return (
    <header
      className="sticky top-0 z-30"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 17, 32, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center px-4 py-3.5">
        <Link
          href={backHref}
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
          style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
        >
          <IconArrowLeft size={16} />
        </Link>
        <h1
          className="flex-1 text-center text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Philosopher Profile
        </h1>
        <span className="h-9 w-9" />
      </div>
    </header>
  );
}

export default function PhilosopherDetailClient({ slug }: { slug: string }) {
  const router = useRouter();
  const principal = usePrincipal();
  const philosopher = useQuery(api.philosophers.getBySlug, slug ? { slug } : "skip");

  const allThreads = useQuery(
    api.threads.listByPrincipal,
    principal.isLoading
      ? "skip"
      : { principalType: principal.principalType, principalId: principal.principalId }
  );

  const recentThreads =
    philosopher && allThreads
      ? allThreads.filter((t) => t.philosopherId === philosopher._id).slice(0, 3)
      : [];

  const createThread = useMutation(api.threads.create);
  const [starting, setStarting] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Resolve bust URL from slug immediately — no Convex round-trip needed.
  const bustUrl = bustUrlForSlug(slug);

  async function handleStartChat() {
    if (!philosopher || principal.isLoading || starting) return;
    setStarting(true);
    try {
      const threadId = await createThread({
        principalType: principal.principalType,
        principalId: principal.principalId,
        philosopherId: philosopher._id as Id<"philosophers">,
      });
      router.push(`/chat/${threadId}`);
    } catch {
      setStarting(false);
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (philosopher === undefined) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
        <PageHeader />
        <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
          <div className="flex flex-col items-center gap-4 py-10">
            {/* Show bust immediately from slug — no Convex data needed */}
            <div
              className="relative h-36 w-36 rounded-full overflow-hidden flex-shrink-0"
              style={{
                border: "2px solid rgba(201, 151, 58, 0.35)",
                boxShadow: "0 0 0 6px rgba(201,151,58,0.06), 0 12px 48px rgba(0,0,0,0.5)",
              }}
            >
              {bustUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bustUrl} alt="Philosopher bust" className="h-full w-full object-cover object-top" />
              ) : (
                <div className="h-36 w-36 rounded-full bg-[var(--bg-secondary)] animate-pulse" />
              )}
            </div>
            <div className="h-7 w-48 rounded bg-[var(--bg-secondary)] animate-pulse" />
            <div className="h-4 w-28 rounded bg-[var(--bg-secondary)] animate-pulse" />
          </div>
          {[1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--bg-secondary)] animate-pulse" />
          ))}
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────────────────
  if (philosopher === null) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
        <PageHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <p className="text-4xl mb-4">🏛</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">Philosopher not found</p>
          <p className="mt-2 text-sm text-[var(--text-muted)]">This thinker hasn&apos;t joined us yet.</p>
          <Link
            href="/philosophers"
            className="mt-6 inline-block rounded-full px-5 py-2 text-sm font-semibold"
            style={{ background: "var(--accent)", color: "var(--bg-primary)" }}
          >
            Browse all philosophers
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  const showBust = bustUrl && !imageError;

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary)" }}>
      <PageHeader />

      {/* ── Atmospheric hero ─────────────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center gap-5 px-4 pb-10 pt-10 text-center overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(201,151,58,0.12) 0%, rgba(10,17,32,0) 65%)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Subtle decorative lines */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(201,151,58,0.03) 39px, rgba(201,151,58,0.03) 40px)",
          }}
        />

        {/* Bust / Monogram */}
        <div
          className="relative z-10 flex h-36 w-36 flex-shrink-0 items-center justify-center rounded-full overflow-hidden"
          style={{
            border: "2px solid rgba(201, 151, 58, 0.35)",
            boxShadow:
              "0 0 0 6px rgba(201,151,58,0.06), 0 12px 48px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.07)",
          }}
        >
          {showBust ? (
            // Plain <img> bypasses the Next.js /_next/image proxy so Wikimedia
            // images load instantly without an extra round-trip.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bustUrl}
              alt={`Marble bust of ${philosopher.name}`}
              className="h-full w-full object-cover object-top"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background:
                  "radial-gradient(circle at 35% 35%, rgba(201,151,58,0.22), rgba(201,151,58,0.05))",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-crimson-pro), Georgia, serif",
                  fontSize: "2.5rem",
                  fontWeight: 300,
                  color: "var(--accent-light)",
                  letterSpacing: "0.08em",
                }}
              >
                {initials(philosopher.name)}
              </span>
            </div>
          )}
        </div>

        {/* Identity */}
        <div className="relative z-10 space-y-2">
          <h2
            className="text-3xl font-medium"
            style={{
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              color: "var(--text-primary)",
              letterSpacing: "-0.01em",
              lineHeight: 1.15,
            }}
          >
            {philosopher.name}
          </h2>
          <p className="text-xs tracking-[0.18em] uppercase" style={{ color: "var(--text-muted)" }}>
            {philosopher.era}
          </p>
          <div className="flex items-center justify-center gap-2 pt-0.5">
            <span className="school-badge">{philosopher.school}</span>
            {philosopher.tradition !== philosopher.school && (
              <span
                className="school-badge"
                style={{ opacity: 0.65 }}
              >
                {philosopher.tradition}
              </span>
            )}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Tagline */}
        <p
          className="text-center text-[0.9375rem] leading-relaxed"
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          &ldquo;{philosopher.tagline}&rdquo;
        </p>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={handleStartChat}
          disabled={starting || principal.isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold transition-all duration-200 disabled:opacity-60"
          style={{
            background: "var(--accent)",
            color: "var(--color-navy)",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-light)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
        >
          {starting ? (
            <>
              <span className="h-4 w-4 rounded-full border-2 border-[var(--color-navy)]/40 border-t-[var(--color-navy)] animate-spin" />
              Starting…
            </>
          ) : (
            `Begin Dialogue with ${philosopher.name.split(" ")[0]}`
          )}
        </button>

        {/* ── About ─────────────────────────────────────────────────────────── */}
        <section
          className="rounded-2xl px-5 py-5"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <h3
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--accent)", opacity: 0.8 }}
          >
            About
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            {philosopher.bio}
          </p>
        </section>

        {/* ── Sources ───────────────────────────────────────────────────────── */}
        {philosopher.works.length > 0 && (
          <section
            className="rounded-2xl px-5 py-5"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
          >
            <h3
              className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              Primary Sources
            </h3>
            <ul className="space-y-2.5">
              {philosopher.works.map((work) => (
                <li key={work.title} className="flex items-start gap-3">
                  <span
                    className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full"
                    style={{ background: "var(--accent)" }}
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      {work.title}
                    </p>
                    {work.shortTitle !== work.title && (
                      <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                        {work.shortTitle}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Opening Words ─────────────────────────────────────────────────── */}
        <section
          className="rounded-2xl px-5 py-5"
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-accent)",
          }}
        >
          <h3
            className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]"
            style={{ color: "var(--accent)", opacity: 0.8 }}
          >
            Opening Words
          </h3>
          <div className="flex gap-3">
            <div
              className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                background: "radial-gradient(circle at 35% 35%, rgba(201,151,58,0.22), rgba(201,151,58,0.06))",
                border: "1px solid rgba(201, 151, 58, 0.2)",
                color: "var(--accent-light)",
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
              }}
            >
              {initials(philosopher.name)}
            </div>
            <p
              className="philosopher-text italic leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              &ldquo;{philosopher.greeting}&rdquo;
            </p>
          </div>
        </section>

        {/* ── Recent conversations ──────────────────────────────────────────── */}
        {recentThreads.length > 0 && (
          <section>
            <h3
              className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--accent)", opacity: 0.8 }}
            >
              Your Recent Conversations
            </h3>
            <div className="space-y-2">
              {recentThreads.map((thread) => (
                <Link
                  key={thread._id}
                  href={`/chat/${thread._id}`}
                  className="flex items-center justify-between rounded-2xl px-4 py-3 transition-all duration-200"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,151,58,0.3)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-secondary)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card)";
                  }}
                >
                  <div className="min-w-0">
                    {thread.title ? (
                      <p className="truncate text-sm italic" style={{ color: "var(--text-secondary)" }}>
                        &ldquo;{thread.title}&rdquo;
                      </p>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--text-muted)" }}>Untitled conversation</p>
                    )}
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                      {thread.messageCount} {thread.messageCount === 1 ? "message" : "messages"}
                    </p>
                  </div>
                  <span className="ml-3 flex-shrink-0 text-xs" style={{ color: "var(--text-muted)" }}>
                    {relativeTime(thread.lastMessageAt)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Bottom CTA (repeat for long pages) ───────────────────────────── */}
        <div className="pb-2">
          <button
            type="button"
            onClick={handleStartChat}
            disabled={starting || principal.isLoading}
            className="w-full rounded-2xl py-4 text-sm font-semibold transition-all duration-200 disabled:opacity-60"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-accent)",
              color: "var(--accent)",
            }}
          >
            {starting ? "Starting…" : `Ask ${philosopher.name.split(" ")[0]} a question →`}
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
