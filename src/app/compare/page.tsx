import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import { IconAgora } from "@/components/ui/icons";

export default function AgoraPage() {
  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10 md:px-6">

        {/* ── Header ──────────────────────────────────────────── */}
        <header className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.75 }}
          >
            Experimental
          </p>
          <h1
            className="font-serif text-3xl font-semibold md:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            The Agora
          </h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            An open space where ideas are tested, compared, and examined.
            Features here push beyond the standard dialogue.
          </p>
        </header>

        {/* ── The Dialectic card ──────────────────────────────── */}
        <Link href="/compare/dialectic" className="group block outline-none">
          <article
            className="relative overflow-hidden rounded-2xl transition-all duration-300 group-hover:-translate-y-0.5 group-focus-visible:ring-2"
            style={{
              background: "linear-gradient(135deg, rgba(20,28,48,0.95) 0%, rgba(15,23,42,0.98) 100%)",
              border: "1px solid rgba(212,168,67,0.25)",
              boxShadow: "0 4px 32px rgba(2,6,23,0.6), inset 0 1px 0 rgba(212,168,67,0.08)",
              // @ts-expect-error -- CSS custom property not in CSSProperties
              "--tw-ring-color": "var(--accent)",
            }}
          >
            {/* Decorative background grid */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(212,168,67,1) 40px)," +
                  "repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(212,168,67,1) 40px)",
              }}
            />

            {/* Glow on hover */}
            <div
              className="pointer-events-none absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              style={{ background: "rgba(212,168,67,0.08)" }}
            />

            <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:gap-10 md:p-8">
              {/* Icon medallion */}
              <div className="flex shrink-0 items-center justify-center">
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full md:h-24 md:w-24"
                  style={{
                    background: "rgba(212,168,67,0.08)",
                    border: "1px solid rgba(212,168,67,0.2)",
                    boxShadow: "0 0 32px rgba(212,168,67,0.1)",
                  }}
                >
                  <IconAgora size={36} style={{ color: "var(--accent)" }} />
                </div>
              </div>

              {/* Text content */}
              <div className="flex flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]"
                    style={{
                      background: "rgba(212,168,67,0.12)",
                      color: "var(--accent)",
                      border: "1px solid rgba(212,168,67,0.2)",
                    }}
                  >
                    Comparison
                  </span>
                  <span
                    className="font-serif text-xs italic tracking-wide"
                    style={{ color: "rgba(212,168,67,0.45)" }}
                  >
                    διαλεκτική
                  </span>
                </div>

                <h2
                  className="font-serif text-2xl font-semibold md:text-3xl"
                  style={{ color: "var(--text-primary)" }}
                >
                  The Dialectic
                </h2>

                <p className="max-w-lg text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  Pose one question to two philosophers and watch their reasoning
                  diverge. Compare Marcus Aurelius against Epictetus, or Seneca
                  against any other voice in the corpus, then continue the
                  conversation with whichever answer compels you.
                </p>

                <div className="flex items-center gap-2 pt-1">
                  <span
                    className="text-sm font-semibold transition-colors duration-200"
                    style={{ color: "var(--accent)" }}
                  >
                    Begin Dialectic
                  </span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="transition-transform duration-200 group-hover:translate-x-1"
                    style={{ color: "var(--accent)" }}
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Bottom accent line */}
            <div
              className="h-px w-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{ background: "linear-gradient(90deg,transparent,rgba(212,168,67,0.4),transparent)" }}
            />
          </article>
        </Link>

        {/* ── Future features placeholder ─────────────────────── */}
        <p className="text-center text-xs" style={{ color: "var(--text-muted)", opacity: 0.4 }}>
          More features coming to the Agora.
        </p>

      </main>
      <BottomNav />
    </div>
  );
}
