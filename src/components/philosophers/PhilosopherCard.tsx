"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api, type Id } from "@/lib/convex";
import { usePrincipal } from "@/hooks/use-principal";
import { IconChevronRight } from "@/components/ui/icons";

interface PhilosopherCardProps {
  id: Id<"philosophers">;
  name: string;
  slug: string;
  tagline: string;
  era: string;
  school: string;
}

// Per-image crop position — "center" for seated/full figures, "top" for busts
const BUST_OBJECT_POSITION: Record<string, string> = {
  buddha: "center",
};

/** First initial of first + last name word */
function monogram(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0];
  return words[0][0] + words[words.length - 1][0];
}

export default function PhilosopherCard({
  id,
  name,
  slug,
  tagline,
  era,
  school,
}: PhilosopherCardProps) {
  const router = useRouter();
  const createThread = useMutation(api.threads.create);
  const principal = usePrincipal();
  const bustUrl = `/busts/${slug}.jpg`;
  const objectPosition = BUST_OBJECT_POSITION[slug] ?? "top";
  const [imageError, setImageError] = useState(false);

  async function handleStartChat() {
    if (principal.isLoading) return;
    const threadId = await createThread({
      principalType: principal.principalType,
      principalId: principal.principalId,
      philosopherId: id,
    });
    router.push(`/chat/${threadId}`);
  }

  return (
    <article
      className="card-accent group flex h-full flex-col overflow-hidden transition-all duration-300"
      style={{
        willChange: "transform, box-shadow",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.35), 0 0 40px rgba(201,151,58,0.08)";
        e.currentTarget.style.borderColor = "rgba(201, 151, 58, 0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.borderColor = "var(--border)";
      }}
    >
      {/* Bust / avatar area */}
      <div
        className="relative flex items-center justify-center py-10"
        style={{
          background: "linear-gradient(135deg, rgba(201,151,58,0.06) 0%, rgba(10,17,32,0) 60%)",
        }}
      >
        <div
          className="relative flex h-24 w-24 items-center justify-center rounded-full overflow-hidden flex-shrink-0"
          style={{
            border: "1px solid rgba(201, 151, 58, 0.2)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 20px rgba(0,0,0,0.3)",
          }}
        >
          {bustUrl && !imageError ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bustUrl}
              alt={`Marble bust of ${name}`}
              className="h-full w-full object-cover"
              style={{ objectPosition }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center"
              style={{
                background: "radial-gradient(circle at 35% 35%, rgba(201,151,58,0.18), rgba(201,151,58,0.04))",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-crimson-pro), Georgia, serif",
                  fontSize: "1.75rem",
                  fontWeight: 400,
                  color: "var(--accent-light)",
                  letterSpacing: "0.05em",
                  lineHeight: 1,
                  userSelect: "none",
                }}
              >
                {monogram(name)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
        {/* Name + era */}
        <div className="space-y-1 text-center">
          <h3
            className="text-base font-semibold"
            style={{ color: "var(--text-primary)", letterSpacing: "-0.01em" }}
          >
            {name}
          </h3>
          <p
            className="text-[11px] tracking-[0.12em] uppercase"
            style={{ color: "var(--text-muted)" }}
          >
            {era}
          </p>
        </div>

        {/* Tagline */}
        <p
          className="text-center text-[0.8125rem] leading-snug"
          style={{
            fontFamily: "var(--font-crimson-pro), Georgia, serif",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          &ldquo;{tagline}&rdquo;
        </p>

        {/* School badge */}
        <div className="flex justify-center">
          <span className="school-badge">{school}</span>
        </div>

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={handleStartChat}
            className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all duration-200"
            style={{
              background: "var(--accent)",
              color: "var(--color-navy)",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-light)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            Begin Dialogue
          </button>

          <Link
            href={`/philosophers/${slug}`}
            className="flex w-full items-center justify-center gap-1 rounded-xl py-2.5 text-sm transition-all duration-200"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border-strong)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLAnchorElement).style.borderColor = "var(--border)"; }}
          >
            View Profile
            <IconChevronRight size={14} />
          </Link>
        </div>
      </div>
    </article>
  );
}
