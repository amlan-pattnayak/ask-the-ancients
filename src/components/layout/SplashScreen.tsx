"use client";

import { useEffect, useState } from "react";
import WordmarkLogo from "@/components/layout/WordmarkLogo";

export default function SplashScreen() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    // Total display: 1.8s hold + 0.5s fade = 2.3s, then unmount
    const t = setTimeout(() => setHidden(true), 2300);
    return () => clearTimeout(t);
  }, []);

  if (hidden) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "var(--bg-primary)",
        animation: "splash-fade-out 2.3s ease forwards",
      }}
    >
      {/* Radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(201,151,58,0.10) 0%, transparent 70%)",
        }}
      />

      {/* Decorative horizontal lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(201,151,58,0.025) 39px, rgba(201,151,58,0.025) 40px)",
        }}
      />

      {/* Logo mark */}
      <div
        className="relative z-10 flex flex-col items-center gap-5"
        style={{ animation: "splash-logo-in 0.7s cubic-bezier(0.19,1,0.22,1) 0.2s both" }}
      >
        <WordmarkLogo size="lg" linked={false} />

        {/* Tagline */}
        <p
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            fontSize: "clamp(0.85rem, 2vw, 1rem)",
            color: "var(--text-secondary)",
            fontStyle: "italic",
            letterSpacing: "0.05em",
            animation: "splash-tagline-in 0.6s ease 0.8s both",
          }}
        >
          Converse with history&apos;s greatest minds
        </p>
      </div>
    </div>
  );
}
