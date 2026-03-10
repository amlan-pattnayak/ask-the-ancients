"use client";

import React, { useEffect, useState } from "react";
import { IconBookmark, IconCopy, IconQuote, IconChevronDown, IconCheck } from "@/components/ui/icons";

interface Citation {
  workTitle: string;
  chapterRef: string;
  passage: string;
}

interface MessageBubbleProps {
  messageId?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  philosopherName?: string;
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
  onCopy?: () => void;
  /** True while a BYOK stream is actively delivering tokens */
  isStreaming?: boolean;
  /** True while waiting for the Convex action response (guest mode) */
  isThinking?: boolean;
  /** Optional desktop citation-rail sync hook */
  onSelectCitations?: (messageId: string) => void;
  /** Keep inline citations mobile-only when desktop rail is active */
  mobileOnlyInlineCitations?: boolean;
  /** Extra action buttons rendered to the right of Copy in the action row */
  extraActions?: React.ReactNode;
}

function monogram(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0][0];
  return words[0][0] + words[words.length - 1][0];
}

/** Renders a string with *italic* spans for inline citation references. */
function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return (
        <em key={i} style={{ fontStyle: "italic", opacity: 0.85 }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    return part;
  });
}

function toParagraphs(content: string): string[] {
  const userParagraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (userParagraphs.length > 1) return userParagraphs;

  const compact = content.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (!compact) return [""];

  const sentences = compact
    .match(/[^.!?]+[.!?]+(?:["')\]]+)?|[^.!?]+$/g)
    ?.map((s) => s.trim())
    .filter(Boolean) ?? [compact];

  // Only auto-split long single-block responses.
  if (sentences.length < 4 || compact.length < 260) return [compact];

  const paragraphCount = sentences.length >= 8 ? 3 : 2;
  const paragraphs: string[] = [];
  let cursor = 0;
  for (let i = 0; i < paragraphCount; i++) {
    const remainingSentences = sentences.length - cursor;
    const remainingParagraphs = paragraphCount - i;
    const take = Math.ceil(remainingSentences / remainingParagraphs);
    paragraphs.push(sentences.slice(cursor, cursor + take).join(" "));
    cursor += take;
  }
  return paragraphs.filter(Boolean);
}

export default function MessageBubble({
  messageId,
  role,
  content,
  citations = [],
  philosopherName,
  isBookmarked = false,
  onToggleBookmark,
  onCopy,
  isStreaming = false,
  isThinking = false,
  onSelectCitations,
  mobileOnlyInlineCitations = false,
  extraActions,
}: MessageBubbleProps) {
  const [showCitations, setShowCitations] = useState(false);
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set());
  const [citationCharLimit, setCitationCharLimit] = useState(320);
  const [copied, setCopied] = useState(false);
  const isAssistant = role === "assistant";

  useEffect(() => {
    function recalcLimit() {
      setCitationCharLimit(window.innerWidth >= 768 ? 460 : 280);
    }
    recalcLimit();
    window.addEventListener("resize", recalcLimit);
    return () => window.removeEventListener("resize", recalcLimit);
  }, []);

  function handleCopy() {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function previewPassage(text: string): string {
    const clean = text.replace(/\s+/g, " ").trim();
    if (clean.length <= citationCharLimit) return clean;
    const cut = clean.slice(0, citationCharLimit);
    const lastSentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    const safeCut = lastSentence > citationCharLimit * 0.6 ? cut.slice(0, lastSentence + 1) : cut;
    return `${safeCut.trim()}…`;
  }

  function toggleCitationExpanded(index: number) {
    setExpandedCitations((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div
      className={`flex w-full animate-fade-up ${isAssistant ? "justify-start" : "justify-end"}`}
      style={{ opacity: 0 }}
    >
      <div className={`flex max-w-[86%] gap-3 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}>

        {/* Philosopher monogram — assistant only */}
        {isAssistant && (
          <div
            className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full self-start"
            style={{
              background: "radial-gradient(circle at 35% 35%, rgba(201,151,58,0.22), rgba(201,151,58,0.06))",
              border: "1px solid rgba(201, 151, 58, 0.2)",
              fontSize: "0.6rem",
              fontFamily: "var(--font-crimson-pro), Georgia, serif",
              color: "var(--accent-light)",
              letterSpacing: "0.05em",
              fontWeight: 500,
            }}
          >
            {philosopherName ? monogram(philosopherName) : "Φ"}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {/* Bubble */}
          <div
            className="rounded-2xl px-4 py-3.5"
            style={isAssistant ? {
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderTopLeftRadius: "4px",
            } : {
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-strong)",
              borderTopRightRadius: "4px",
            }}
          >
            {/* Assistant name */}
            {isAssistant && (
              <p
                className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em]"
                style={{ color: "var(--accent)", opacity: 0.85 }}
              >
                {philosopherName ?? "Philosopher"}
              </p>
            )}

            {/* Thinking animation */}
            {isThinking ? (
              <div className="flex items-center gap-1.5 py-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="animate-thinking h-1.5 w-1.5 rounded-full"
                    style={{
                      background: "var(--accent)",
                      animationDelay: `${i * 180}ms`,
                    }}
                  />
                ))}
              </div>
            ) : isAssistant ? (
              <div className="philosopher-text" style={{ color: "var(--text-primary)" }}>
                {toParagraphs(content).map((para, i, arr) => (
                  <p key={i} className={i < arr.length - 1 ? "mb-3" : ""}>
                    {renderInline(para.trim())}
                    {isStreaming && i === arr.length - 1 && (
                      <span
                        className="animate-cursor ml-0.5 inline-block h-[1.1em] w-0.5 align-text-bottom rounded-sm"
                        style={{ background: "var(--accent)" }}
                      />
                    )}
                  </p>
                ))}
              </div>
            ) : (
              <p
                className="text-sm leading-relaxed"
                style={{ color: "var(--text-primary)" }}
              >
                {content}
              </p>
            )}
          </div>

          {/* Citation accordion — assistant only */}
          {isAssistant && citations.length > 0 && (
            <div
              className={`rounded-xl overflow-hidden ${mobileOnlyInlineCitations ? "md:hidden" : ""}`}
              style={{ border: "1px solid var(--border-accent)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setShowCitations((p) => !p);
                  if (messageId && onSelectCitations) {
                    onSelectCitations(messageId);
                  }
                }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors duration-150"
                style={{
                  background: "rgba(201, 151, 58, 0.05)",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201, 151, 58, 0.09)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201, 151, 58, 0.05)"; }}
              >
                <IconQuote size={13} className="flex-shrink-0" style={{ color: "var(--accent)", opacity: 0.7 }} />
                <span className="flex-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {citations.length} source {citations.length === 1 ? "passage" : "passages"}
                </span>
                <span
                  className="inline-flex"
                  style={{
                    color: "var(--text-muted)",
                    transition: "transform 0.2s",
                    transform: showCitations ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <IconChevronDown size={13} />
                </span>
              </button>

              {showCitations && (
                <div
                  className="px-3.5 pb-3.5 pt-1 space-y-3"
                  style={{ background: "var(--bg-primary)" }}
                >
                  {citations.map((citation, idx) => (
                    <div key={`${citation.chapterRef}-${idx}`} className="pt-3 first:pt-1 space-y-1.5">
                      <p
                        className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                        style={{ color: "var(--accent)" }}
                      >
                        {citation.workTitle}
                        {citation.chapterRef ? ` · ${citation.chapterRef}` : ""}
                      </p>
                      {(() => {
                        const clean = citation.passage.replace(/\s+/g, " ").trim();
                        const isExpanded = expandedCitations.has(idx);
                        const clipped = previewPassage(clean);
                        const shouldShowToggle = clean.length > citationCharLimit;
                        return (
                          <>
                            <p
                              className="text-sm italic leading-relaxed"
                              style={{
                                fontFamily: "var(--font-crimson-pro), Georgia, serif",
                                color: "var(--text-secondary)",
                              }}
                            >
                              &ldquo;{isExpanded ? clean : clipped}&rdquo;
                            </p>
                            {shouldShowToggle && (
                              <button
                                type="button"
                                onClick={() => toggleCitationExpanded(idx)}
                                className="text-[11px] font-medium transition-colors duration-150"
                                style={{ color: "var(--accent)" }}
                              >
                                {isExpanded ? "Show less" : "Show more"}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action row — assistant only */}
          {isAssistant && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleBookmark}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150"
                style={{
                  color: isBookmarked ? "var(--accent)" : "var(--text-muted)",
                  background: isBookmarked ? "rgba(201,151,58,0.08)" : "transparent",
                  border: `1px solid ${isBookmarked ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                <IconBookmark size={12} filled={isBookmarked} />
                <span>{isBookmarked ? "Saved" : "Save"}</span>
              </button>

              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-150"
                style={{
                  color: copied ? "var(--accent)" : "var(--text-muted)",
                  background: "transparent",
                  border: "1px solid var(--border)",
                }}
              >
                {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>

              {extraActions}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
