"use client";

import Link from "next/link";
import { IconArrowLeft } from "@/components/ui/icons";

export default function PhilosophersHeader() {
  return (
    <header
      className="sticky top-0 z-30 md:hidden"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "rgba(10, 17, 32, 0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}
    >
      <div className="flex items-center px-4 py-3.5">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150"
          style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
        >
          <IconArrowLeft size={16} />
        </Link>
        <h1
          className="flex-1 text-center text-base font-semibold"
          style={{ color: "var(--text-primary)" }}
        >
          Philosophers
        </h1>
        <span className="h-9 w-9" />
      </div>
    </header>
  );
}
