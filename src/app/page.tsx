"use client";

import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import BottomNav from "@/components/layout/BottomNav";
import SplashScreen from "@/components/layout/SplashScreen";
import WordmarkLogo from "@/components/layout/WordmarkLogo";

const PHILOSOPHERS = [
  {
    name: "Marcus Aurelius",
    role: "Roman Emperor · Stoic",
    slug: "marcus-aurelius",
    bust: "/busts/marcus-aurelius.jpg",
    quote: "You have power over your mind, not outside events.",
    tradition: "Greek & Roman",
  },
  {
    name: "The Buddha",
    role: "The Awakened One · Buddhist",
    slug: "buddha",
    bust: "/busts/buddha.jpg",
    quote: "All that we are is the result of what we have thought.",
    tradition: "Indian",
  },
  {
    name: "Patanjali",
    role: "Sage of the Mind · Yoga",
    slug: "patanjali",
    bust: "/busts/patanjali.jpg",
    quote: "Yoga is the cessation of the fluctuations of the mind.",
    tradition: "Indian",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Choose a philosopher",
    body: "Browse thinkers from across traditions, Greek Stoics, Indian sages, Buddhist teachers. Seven philosophers and growing.",
  },
  {
    step: "02",
    title: "Ask what matters",
    body: "Ask anything about purpose, suffering, virtue, and leadership. No question is too large or too small.",
  },
  {
    step: "03",
    title: "Receive grounded answers",
    body: "Every response is drawn from the philosopher's actual writings, cited with the original passage.",
  },
  {
    step: "04",
    title: "Verify the source",
    body: "Citation cards let you trace every idea back to the primary text. No invention, only interpretation.",
  },
];

export default function HomePage() {
  return (
    <>
      <SplashScreen />

      <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
        <Navbar />

        {/* ── HERO ──────────────────────────────────────────────────────────── */}
        <section
          className="relative flex min-h-[92dvh] flex-col items-center justify-center overflow-hidden px-5 text-center"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(201,151,58,0.09) 0%, transparent 65%)",
          }}
        >
          {/* Fine grid lines */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 59px, rgba(201,151,58,0.025) 59px, rgba(201,151,58,0.025) 60px), repeating-linear-gradient(90deg, transparent, transparent 59px, rgba(201,151,58,0.015) 59px, rgba(201,151,58,0.015) 60px)",
            }}
          />

          {/* Hero content */}
          <div
            className="relative z-10 flex flex-col items-center gap-7"
            style={{ animation: "hero-in 0.8s cubic-bezier(0.19,1,0.22,1) 2s both" }}
          >
            {/* Logo */}
            <WordmarkLogo size="lg" linked={false} />

            {/* Headline */}
            <h1
              className="max-w-2xl"
              style={{
                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                fontSize: "clamp(2.25rem, 6vw, 3.75rem)",
                fontWeight: 300,
                color: "var(--text-primary)",
                lineHeight: 1.15,
                letterSpacing: "-0.01em",
              }}
            >
              Converse with history&apos;s
              <br />
              <em style={{ color: "var(--accent-light)", fontStyle: "italic" }}>greatest minds</em>
            </h1>

            {/* Sub-headline */}
            <p
              className="max-w-md text-base leading-relaxed"
              style={{ color: "var(--text-secondary)" }}
            >
              Greek Stoics. Indian sages. Buddhist teachers. Ask any of them about
              purpose, suffering, virtue, or the nature of mind, every answer drawn from their{" "}
              <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>actual writings</span>
              , with citations you can verify.
            </p>

            {/* CTA */}
            <Link
              href="/philosophers"
              className="group relative mt-2 inline-flex items-center gap-2.5 rounded-2xl px-8 py-4 text-sm font-semibold transition-all duration-300"
              style={{
                background: "var(--accent)",
                color: "var(--color-navy)",
                letterSpacing: "0.02em",
                boxShadow: "0 0 0 0 rgba(201,151,58,0.4)",
              }}
              onMouseEnter={undefined}
            >
              <span>Explore Philosophers</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>

            <p
              className="text-xs"
              style={{ color: "var(--text-muted)", fontStyle: "italic" }}
            >
              10 msgs/day as guest &nbsp;·&nbsp; 25/day signed in &nbsp;·&nbsp; unlimited with BYOK
            </p>
          </div>

          {/* Scroll hint */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40"
            style={{ animation: "hero-in 0.6s ease 3s both" }}
          >
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
              scroll
            </span>
            <div
              className="h-6 w-px"
              style={{ background: "linear-gradient(to bottom, var(--border-accent), transparent)" }}
            />
          </div>
        </section>

        {/* ── PHILOSOPHER SHOWCASE ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-20 px-5">
          {/* Section rule */}
          <div className="mx-auto mb-12 flex max-w-5xl items-center gap-4">
            <div className="divider-gold flex-1" />
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.25em]"
              style={{ color: "var(--accent)", opacity: 0.7 }}
            >
              Across traditions
            </span>
            <div className="divider-gold flex-1" />
          </div>

          {/* Three-up bust display */}
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-3">
            {PHILOSOPHERS.map((phil) => (
              <Link
                key={phil.slug}
                href={`/philosophers/${phil.slug}`}
                className="group flex flex-col items-center gap-5 rounded-2xl px-6 py-8 text-center transition-all duration-300"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(201,151,58,0.35)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-3px)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "0 16px 48px rgba(0,0,0,0.4), 0 0 40px rgba(201,151,58,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(0)";
                  (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
                }}
              >
                {/* Bust image */}
                <div
                  className="relative h-36 w-36 flex-shrink-0 overflow-hidden rounded-full"
                  style={{
                    border: "2px solid rgba(201,151,58,0.3)",
                    boxShadow: "0 0 0 6px rgba(201,151,58,0.05), 0 8px 32px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={phil.bust}
                    alt={`Portrait of ${phil.name}`}
                    className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                  {/* Subtle vignette */}
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "radial-gradient(ellipse at center, transparent 55%, rgba(10,17,32,0.35) 100%)",
                    }}
                  />
                </div>

                {/* Identity */}
                <div className="space-y-1.5">
                  <h3
                    className="text-xl font-medium"
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      color: "var(--text-primary)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {phil.name}
                  </h3>
                  <p
                    className="text-[10px] uppercase tracking-[0.18em]"
                    style={{ color: "var(--accent)", opacity: 0.7 }}
                  >
                    {phil.role}
                  </p>
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]"
                    style={{
                      background: "rgba(201,151,58,0.08)",
                      border: "1px solid rgba(201,151,58,0.2)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {phil.tradition}
                  </span>
                </div>

                {/* Quote */}
                <p
                  className="text-sm leading-relaxed"
                  style={{
                    fontFamily: "var(--font-crimson-pro), Georgia, serif",
                    color: "var(--text-secondary)",
                    fontStyle: "italic",
                  }}
                >
                  &ldquo;{phil.quote}&rdquo;
                </p>

                {/* Ghost CTA */}
                <span
                  className="mt-auto text-xs font-medium transition-colors duration-200"
                  style={{ color: "var(--accent)", opacity: 0.7 }}
                >
                  View profile →
                </span>
              </Link>
            ))}
          </div>

          {/* Coming soon */}
          <p
            className="mt-10 text-center text-xs italic"
            style={{ color: "var(--text-muted)" }}
          >
            More coming, Plato, Nagarjuna, Nietzsche, and beyond&hellip;
          </p>
        </section>

        {/* ── HOW IT WORKS ──────────────────────────────────────────────────── */}
        <section
          className="relative py-20 px-5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <div className="mx-auto max-w-4xl">
            <div className="mb-12 flex items-center gap-4">
              <div className="divider-gold flex-1" />
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                style={{ color: "var(--accent)", opacity: 0.7 }}
              >
                How it works
              </span>
              <div className="divider-gold flex-1" />
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {HOW_IT_WORKS.map(({ step, title, body }) => (
                <div
                  key={step}
                  className="flex gap-5 rounded-2xl px-5 py-5"
                  style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
                >
                  <span
                    className="flex-shrink-0 text-4xl font-light leading-none"
                    style={{
                      fontFamily: "var(--font-crimson-pro), Georgia, serif",
                      color: "rgba(201,151,58,0.2)",
                      letterSpacing: "-0.03em",
                    }}
                  >
                    {step}
                  </span>
                  <div className="space-y-1.5 pt-1">
                    <h3
                      className="text-sm font-semibold"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Access tiers ──────────────────────────────────────────── */}
            <div
              className="mt-12 rounded-2xl px-6 py-6 space-y-5"
              style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-center gap-4">
                <div className="divider-gold flex-1" />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.25em]"
                  style={{ color: "var(--accent)", opacity: 0.7 }}
                >
                  Free to use · No sign-in required
                </span>
                <div className="divider-gold flex-1" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  {
                    tier: "Guest",
                    limit: "10 msgs / day",
                    note: "No account needed",
                    highlight: false,
                  },
                  {
                    tier: "Signed In",
                    limit: "25 msgs / day",
                    note: "Free account",
                    highlight: true,
                  },
                  {
                    tier: "BYOK",
                    limit: "Unlimited",
                    note: "Bring your own API key",
                    highlight: false,
                  },
                ].map(({ tier, limit, note, highlight }) => (
                  <div
                    key={tier}
                    className="flex flex-col items-center gap-1.5 rounded-xl px-4 py-4 text-center"
                    style={{
                      background: highlight ? "rgba(201,151,58,0.06)" : "var(--bg-elevated)",
                      border: highlight ? "1px solid rgba(201,151,58,0.25)" : "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="text-[10px] font-semibold uppercase tracking-[0.15em]"
                      style={{ color: highlight ? "var(--accent)" : "var(--text-muted)" }}
                    >
                      {tier}
                    </span>
                    <span
                      className="text-lg font-semibold"
                      style={{
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        color: highlight ? "var(--accent-light)" : "var(--text-primary)",
                      }}
                    >
                      {limit}
                    </span>
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>{note}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                Limits reset daily at midnight UTC.{" "}
                <Link href="/settings" style={{ color: "var(--accent)" }} className="underline underline-offset-2">
                  Manage in Settings →
                </Link>
              </p>
            </div>

            {/* Bottom CTA repeat */}
            <div className="mt-12 flex flex-col items-center gap-4">
              <Link
                href="/philosophers"
                className="inline-flex items-center gap-2.5 rounded-2xl px-8 py-3.5 text-sm font-semibold transition-all duration-200"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-accent)",
                  color: "var(--accent)",
                  letterSpacing: "0.01em",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(201,151,58,0.08)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "var(--bg-card)";
                }}
              >
                Explore Philosophers
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <p className="text-xs italic" style={{ color: "var(--text-muted)" }}>
                10 msgs/day as guest &nbsp;·&nbsp; 25/day signed in &nbsp;·&nbsp; unlimited with BYOK
              </p>
            </div>
          </div>
        </section>

        <BottomNav />
      </div>
    </>
  );
}
