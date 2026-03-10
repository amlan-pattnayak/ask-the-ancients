"use client";

import type React from "react";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex";
import PhilosopherCard from "./PhilosopherCard";

type Tradition = "all" | "greek-roman" | "indian" | "western-modern";

interface SchoolGroup {
  school: string;
  tradition: string;
  label: string;
  subtitle: string;
}

const SCHOOL_ORDER: SchoolGroup[] = [
  { school: "Stoicism",        tradition: "greek-roman",    label: "Stoic School",               subtitle: "Athens & Rome" },
  { school: "Peripateticism",  tradition: "greek-roman",    label: "Peripatetic School",          subtitle: "The Lyceum · Athens" },
  { school: "Yoga",            tradition: "indian",         label: "Yoga School",                 subtitle: "Sāṃkhya-Yoga" },
  { school: "Vedanta",         tradition: "indian",         label: "Advaita Vedānta",             subtitle: "Non-Dualism" },
  { school: "Vishishtadvaita", tradition: "indian",         label: "Viśiṣṭādvaita Vedānta",       subtitle: "Qualified Non-Dualism" },
  { school: "Buddhism",        tradition: "indian",         label: "Buddhist School",             subtitle: "Theravāda · Pali Canon" },
  { school: "Jainism",         tradition: "indian",         label: "Jain School",                 subtitle: "Śramaṇa Tradition" },
  { school: "Rationalism",     tradition: "western-modern", label: "Rationalist School",          subtitle: "Early Modern Europe" },
];

const TRADITION_LABELS: Record<Tradition, string> = {
  all: "All Traditions",
  "greek-roman": "Greek & Roman",
  indian: "Indian",
  "western-modern": "Western Modern",
};

function traditionOf(school: string): Tradition {
  const greekRoman = ["Stoicism", "Epicureanism", "Platonism", "Skepticism", "Aristotelianism", "Peripateticism"];
  const westernModern = ["Rationalism", "Empiricism", "Idealism", "Existentialism"];
  if (greekRoman.includes(school)) return "greek-roman";
  if (westernModern.includes(school)) return "western-modern";
  return "indian";
}

export default function PhilosopherBrowser() {
  const philosophers = useQuery(api.philosophers.listActive) ?? [];
  const [activeTradition, setActiveTradition] = useState<Tradition>("all");

  // Group philosophers by school
  const bySchool = new Map<string, typeof philosophers>();
  for (const phil of philosophers) {
    if (!bySchool.has(phil.school)) bySchool.set(phil.school, []);
    bySchool.get(phil.school)!.push(phil);
  }

  // Determine which school groups to show
  const visibleGroups = SCHOOL_ORDER.filter((group) => {
    if (!bySchool.has(group.school)) return false;
    if (activeTradition === "all") return true;
    return group.tradition === activeTradition;
  });

  // Also collect any school not in SCHOOL_ORDER
  const knownSchools = new Set(SCHOOL_ORDER.map((g) => g.school));
  const unknownSchools = [...bySchool.keys()].filter((s) => !knownSchools.has(s));
  const unknownGroups: SchoolGroup[] = unknownSchools
    .filter((s) => activeTradition === "all" || traditionOf(s) === activeTradition)
    .map((s) => ({ school: s, tradition: traditionOf(s), label: `${s} School`, subtitle: "" }));

  const allGroups = [...visibleGroups, ...unknownGroups];

  const isLoading = philosophers.length === 0;

  return (
    <div className="space-y-8">
      {/* ── Tradition filter tabs ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "greek-roman", "indian", "western-modern"] as Tradition[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTradition(t)}
            className="rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200"
            style={{
              background: activeTradition === t ? "var(--accent)" : "var(--bg-elevated)",
              color: activeTradition === t ? "var(--color-navy)" : "var(--text-muted)",
              border: activeTradition === t ? "1px solid var(--accent)" : "1px solid var(--border)",
              letterSpacing: "0.04em",
            }}
          >
            {TRADITION_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── School groups ── */}
      {isLoading ? (
        <div className="space-y-10">
          {[1, 2].map((g) => (
            <div key={g} className="space-y-4">
              <div className="h-4 w-48 rounded animate-shimmer" />
              <div className="flex gap-5 overflow-x-auto pb-3 pt-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-80 w-72 flex-shrink-0 rounded-2xl animate-shimmer"
                    style={{ animationDelay: `${(i - 1) * 100}ms`, scrollSnapAlign: "start" } as React.CSSProperties}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : allGroups.length === 0 ? (
        <p className="text-center text-sm italic" style={{ color: "var(--text-muted)" }}>
          No philosophers found for this filter.
        </p>
      ) : (
        <div className="space-y-10">
          {allGroups.map((group, groupIdx) => {
            const groupPhilosophers = bySchool.get(group.school) ?? [];
            return (
              <div key={group.school} className="space-y-4">
                {/* School divider label */}
                <div className="flex items-center gap-4">
                  <div className="divider-gold flex-1" />
                  <div className="flex flex-col items-center gap-0.5">
                    <span
                      className="text-[10px] font-semibold tracking-[0.25em] uppercase"
                      style={{ color: "var(--accent)", opacity: 0.75 }}
                    >
                      {group.label}
                    </span>
                    {group.subtitle && (
                      <span
                        className="text-[9px] tracking-[0.15em] uppercase"
                        style={{ color: "var(--text-muted)", opacity: 0.7 }}
                      >
                        {group.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="divider-gold flex-1" />
                </div>

                {/* Horizontal carousel */}
                <div
                  className="no-scrollbar flex items-stretch gap-5 overflow-x-auto pb-3 pt-2"
                  style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
                >
                  {groupPhilosophers.map((phil, i) => (
                    <div
                      key={phil._id}
                      className="w-72 flex-shrink-0 animate-fade-up"
                      style={{
                        animationDelay: `${(groupIdx * 150 + i * 80)}ms`,
                        opacity: 0,
                        scrollSnapAlign: "start",
                      } as React.CSSProperties}
                    >
                      <PhilosopherCard
                        id={phil._id}
                        name={phil.name}
                        slug={phil.slug}
                        tagline={phil.tagline}
                        era={phil.era}
                        school={phil.school}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Footer note */}
          <p
            className="text-center text-xs"
            style={{ color: "var(--text-muted)", fontStyle: "italic" }}
          >
            More philosophers coming, Plato, Nagarjuna, Nietzsche, and beyond&hellip;
          </p>
        </div>
      )}
    </div>
  );
}
