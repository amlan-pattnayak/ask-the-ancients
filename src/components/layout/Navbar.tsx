"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import WordmarkLogo from "@/components/layout/WordmarkLogo";

const NAV_ITEMS = [
  { href: "/philosophers", label: "Philosophers" },
  { href: "/history",      label: "History" },
  { href: "/compare",      label: "Agora" },
  { href: "/bookmarks",    label: "Saved" },
  { href: "/settings",     label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

  return (
    <nav
      className="hidden md:block"
      style={{
        borderBottom: "1px solid var(--border-strong)",
        background: "var(--bg-card)",
        boxShadow: "0 10px 28px rgba(2, 6, 23, 0.35)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <div className="flex w-full items-center justify-between px-6 py-4 lg:px-8">
        <WordmarkLogo size="sm" className="origin-left scale-110 -translate-y-1" />

        {/* Links + auth */}
        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className="relative px-3.5 py-1.5 text-sm rounded-full transition-all duration-200"
                style={{
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                  background: active ? "rgba(201, 151, 58, 0.08)" : "transparent",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
                {active && (
                  <span
                    className="absolute bottom-0 left-1/2 h-px w-4 -translate-x-1/2 rounded-full"
                    style={{ background: "var(--accent)", opacity: 0.6 }}
                  />
                )}
              </Link>
            );
          })}

          <div className="mx-2 h-4 w-px" style={{ background: "var(--border-strong)" }} />

          {isLoaded && (
            isSignedIn
              ? <UserButton afterSignOutUrl="/" />
              : (
                <SignInButton mode="redirect">
                  <button
                    className="rounded-full px-4 py-1.5 text-sm font-medium transition-all duration-200"
                    style={{
                      background: "var(--accent)",
                      color: "var(--color-navy)",
                    }}
                  >
                    Sign in
                  </button>
                </SignInButton>
              )
          )}
        </div>
      </div>
    </nav>
  );
}
