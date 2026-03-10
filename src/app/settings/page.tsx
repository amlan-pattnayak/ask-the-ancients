"use client";

import Image from "next/image";
import { useUser, useClerk, SignInButton } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { useState, useEffect } from "react";
import { api } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import ProviderToggle from "@/components/settings/ProviderToggle";
import BottomNav from "@/components/layout/BottomNav";
import Navbar from "@/components/layout/Navbar";

const CONFIG_STORAGE = "ata_provider_config";

function readProviderMode(): "guest" | "byok" {
  if (typeof window === "undefined") return "guest";
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE);
    if (!raw) return "guest";
    return (JSON.parse(raw) as { mode?: string }).mode === "byok" ? "byok" : "guest";
  } catch {
    return "guest";
  }
}

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const isSignedIn = isLoaded && !!user;
  const principal = usePrincipal();
  const [signingOut, setSigningOut] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [providerMode, setProviderMode] = useState<"guest" | "byok">("guest");

  // Read provider mode from localStorage after mount (client-only)
  useEffect(() => {
    setProviderMode(readProviderMode());
    // Re-sync if the user changes mode on this page
    function onStorage() { setProviderMode(readProviderMode()); }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isByok = isSignedIn && providerMode === "byok";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut({ redirectUrl: "/" });
  }

  const rateLimit = useQuery(
    api.rateLimit.check,
    // Skip the query entirely when BYOK is active — limits don't apply
    !isByok && principal.principalId
      ? { principalType: principal.principalType, principalId: principal.principalId }
      : "skip"
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-24">
      <Navbar />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-col gap-2">
          <p
            className="text-xs font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--accent)", opacity: 0.75 }}
          >
            Preferences
          </p>
          <h1
            className="font-serif text-3xl font-semibold md:text-4xl"
            style={{ color: "var(--text-primary)" }}
          >
            Settings
          </h1>
          <p className="max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Manage account access, usage mode, and local app configuration.
          </p>
        </header>
        {/* Account */}
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Account</div>
        <section className="card px-5 py-5">
          {isSignedIn ? (
            <div className="space-y-4">
              {/* Profile row */}
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-lg font-bold text-[var(--bg-primary)] overflow-hidden">
                  {user.imageUrl && !avatarError ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.fullName ?? "Profile"}
                      fill
                      className="object-cover"
                      onError={() => setAvatarError(true)}
                      unoptimized
                    />
                  ) : (
                    (user.fullName ?? user.username ?? "?")
                      .split(" ").slice(0, 2).map((w: string) => w[0]).join("").toUpperCase()
                  )}
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] truncate">
                    {user.fullName ?? user.username ?? "Signed in"}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                </div>
              </div>

              {/* Sign Out button — explicit, full-width on mobile */}
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="w-full rounded-xl border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-red-500/50 hover:text-red-400 disabled:opacity-50"
              >
                {signingOut ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--text-secondary)]">
                Sign in for 25 messages/day (vs 10 as guest), unlock Bring Your Own Key (BYOK) for unlimited usage, and sync your conversations across devices.
              </p>
              <div className="mt-4">
                <SignInButton mode="redirect">
                  <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)]">
                    Sign in
                  </button>
                </SignInButton>
              </div>
            </>
          )}
        </section>

        {/* AI Provider */}
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">AI Provider</div>
        <section className="card px-5 py-5 space-y-4">
          {/* Live usage indicator */}
          <div className="flex items-center justify-between rounded-xl bg-[var(--bg-elevated)] px-4 py-3">
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {isByok ? "BYOK mode" : isSignedIn ? "Signed-in free mode" : "Anonymous guest mode"}
              </div>
              <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                {isByok
                  ? "No daily limit, your API key is used directly"
                  : rateLimit
                  ? `${rateLimit.remaining} of ${rateLimit.limit} messages remaining today`
                  : "Loading usage…"}
              </div>
            </div>
            {isByok ? (
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--accent)" }}
              >
                ∞
              </span>
            ) : rateLimit && (
              <div className="w-16">
                <div className="h-1.5 rounded-full bg-[var(--border)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--accent)] transition-all"
                    style={{ width: `${Math.round((rateLimit.remaining / rateLimit.limit) * 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-right text-xs text-[var(--text-muted)]">
                  {rateLimit.remaining}/{rateLimit.limit}
                </div>
              </div>
            )}
          </div>

          {/* Tier comparison */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {/* Header row */}
            <div className="grid grid-cols-3 bg-[var(--bg-elevated)] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
              <span>Tier</span>
              <span className="text-center">Daily limit</span>
              <span className="text-right">Resets</span>
            </div>
            {/* Guest row — active when: not signed in AND not byok */}
            {(() => {
              const guestActive = !isSignedIn && !isByok;
              const signedInActive = isSignedIn && !isByok;
              return (
                <>
                  <div
                    className="grid grid-cols-3 items-center px-4 py-3 text-sm"
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: guestActive ? "rgba(201,151,58,0.04)" : "transparent",
                    }}
                  >
                    <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                      {guestActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                      Guest
                    </span>
                    <span className="text-center font-semibold text-[var(--text-primary)]">10 msgs</span>
                    <span className="text-right text-xs text-[var(--text-muted)]">Midnight UTC</span>
                  </div>
                  {/* Signed-in row */}
                  <div
                    className="grid grid-cols-3 items-center px-4 py-3 text-sm"
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: signedInActive ? "rgba(201,151,58,0.04)" : "transparent",
                    }}
                  >
                    <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                      {signedInActive && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                      Signed in
                    </span>
                    <span className="text-center font-semibold text-[var(--text-primary)]">25 msgs</span>
                    <span className="text-right text-xs text-[var(--text-muted)]">Midnight UTC</span>
                  </div>
                  {/* BYOK row */}
                  <div
                    className="grid grid-cols-3 items-center px-4 py-3 text-sm"
                    style={{
                      borderTop: "1px solid var(--border)",
                      background: isByok ? "rgba(201,151,58,0.04)" : "transparent",
                    }}
                  >
                    <span className="flex items-center gap-2 text-[var(--text-secondary)]">
                      {isByok && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />}
                      BYOK
                    </span>
                    <span className="text-center font-semibold" style={{ color: isByok ? "var(--accent)" : "var(--text-primary)" }}>Unlimited</span>
                    <span className="text-right text-xs text-[var(--text-muted)]">N/A</span>
                  </div>
                </>
              );
            })()}
          </div>

          <ProviderToggle isSignedIn={isSignedIn} />
        </section>

        {/* Data */}
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">Data</div>
        <section className="card px-5 py-5 text-sm text-[var(--text-primary)]">
          <div className="flex items-center justify-between">
            <span>Conversations</span>
            <span className="text-[var(--text-secondary)]">Stored locally</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span>Bookmarks</span>
            <span className="text-[var(--text-secondary)]">Stored locally</span>
          </div>
          <div className="mt-4 flex gap-3 text-xs">
            <button className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5">Export My Data</button>
            <button className="rounded-full border border-[var(--accent)] px-3 py-1.5 text-[var(--accent)]">Clear All Data</button>
          </div>
        </section>

        {/* About */}
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">About</div>
        <section className="card px-5 py-5 text-sm text-[var(--text-primary)]">
          <div className="font-semibold">Ask the Ancients v1.0.0</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">Open source · Built with Next.js + Convex</div>
          <div className="mt-4 flex gap-3 text-xs">
            <button className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5">View on GitHub</button>
            <button className="rounded-full bg-[var(--bg-elevated)] px-3 py-1.5">Report an Issue</button>
          </div>
        </section>
      </main>
      <BottomNav />
    </div>
  );
}
