"use client";

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { usePrincipal } from "@/hooks/use-principal";
import { api, type Id } from "@/lib/convex";
import { createClientEvent, getOrCreateSessionId } from "@/lib/analytics/client";
import { readByokConfig, readSavedByokModels } from "@/lib/byok-storage";
import { detectCrisis, CRISIS_RESPONSE } from "@/lib/safety";
import ChatInput, { type ChatModelOption } from "./ChatInput";
import MessageBubble from "./MessageBubble";
import RenameThreadModal from "@/components/threads/RenameThreadModal";
import Navbar from "@/components/layout/Navbar";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconArrowLeft, IconEdit } from "@/components/ui/icons";

// Mirrors convex/chat.ts resolveCitationMarkers — keep in sync.
// Replaces [P1], [P2], [CIT:P1] etc. with "*WorkTitle · ChapterRef*" using
// the passage list that arrived via the stream sentinel.
function resolveCitationMarkersClient(
  text: string,
  passages: Array<{ workTitle: string; chapterRef: string }>,
): string {
  if (!passages.length) return text;
  return text
    .replace(/\[(?:CIT:)?([Pp]\d+(?:[,;\s]+(?:CIT:)?[Pp]\d+)*)\]/g, (_match, group) => {
      const refs = group.split(/[,;\s]+/).flatMap((part: string) => {
        const id = part.replace(/^CIT:/i, "").toUpperCase();
        const m = id.match(/^P(\d+)$/);
        if (!m) return [];
        const p = passages[parseInt(m[1], 10) - 1];
        if (!p) return [];
        const ref = [p.workTitle, p.chapterRef].filter(Boolean).join(" · ");
        return ref ? [`[*${ref}*]`] : [];
      });
      return refs.join(" ");
    })
    .replace(/  +/g, " ")
    .trim();
}

function getProviderLabel(modelId: string, endpoint?: string): string {
  const normalizedEndpoint = endpoint?.toLowerCase() ?? "";
  if (normalizedEndpoint.includes("openrouter.ai")) return "OpenRouter";
  if (normalizedEndpoint) return "Custom Endpoint";

  const prefix = modelId.split("/")[0]?.toLowerCase() ?? "";
  if (!prefix || prefix === modelId.toLowerCase()) return "Other";
  const map: Record<string, string> = {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    groq: "Groq",
    mistralai: "Mistral",
    cohere: "Cohere",
    xai: "xAI",
    meta: "Meta",
  };
  return map[prefix] ?? `${prefix.charAt(0).toUpperCase()}${prefix.slice(1)}`;
}

export default function ChatInterface() {
  const { getToken } = useAuth();
  const router = useRouter();
  const principal = usePrincipal();
  const isSignedIn = principal.principalType === "user";
  const params = useParams();
  const threadIdParam = typeof params.threadId === "string"
    ? params.threadId
    : Array.isArray(params.threadId)
      ? params.threadId[0]
      : "";
  const thread = useQuery(
    api.threads.getById,
    principal.isLoading || !threadIdParam
      ? "skip"
      : {
          threadId: threadIdParam as Id<"threads">,
          principalType: principal.principalType,
          principalId: principal.principalId,
        }
  );
  const messages = useQuery(
    api.messages.listByThread,
    principal.isLoading || !threadIdParam
      ? "skip"
      : {
          threadId: threadIdParam as Id<"threads">,
          principalType: principal.principalType,
          principalId: principal.principalId,
        }
  ) ?? [];
  const sendUserMessage = useMutation(api.messages.sendUserMessage);
  const sendUserMessageOnly = useMutation(api.messages.sendUserMessageOnly);
  const storeStreamedAssistantMessage = useMutation(api.messages.storeStreamedAssistantMessage);
  const renameThread = useMutation(api.threads.renameThread);
  const toggleBookmark = useMutation(api.bookmarks.toggle);
  const trackEvent = useMutation(api.analytics.trackEvent);
  const threadBookmarks = useQuery(
    api.bookmarks.listByThread,
    principal.isLoading || !threadIdParam ? "skip" : {
      threadId: threadIdParam as Id<"threads">,
      principalType: principal.principalType,
      principalId: principal.principalId,
    }
  ) ?? [];
  const philosopher = useQuery(api.philosophers.listActive)?.find(
    (p) => p._id === thread?.philosopherId
  );
  const bookmarkedMessageIds = new Set(
    threadBookmarks.map((bookmark) => bookmark.messageId).filter(Boolean)
  );

  // Guest-mode pending (non-streaming)
  const [pendingMessageId, setPendingMessageId] = useState<Id<"messages"> | null>(null);
  // BYOK streaming state
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [byokKeyMissing, setByokKeyMissing] = useState(false);
  const [savedByokModels, setSavedByokModels] = useState<Array<{ id: string; name: string; model: string; endpoint?: string }>>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("app-default");
  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [isRenamingThread, setIsRenamingThread] = useState(false);
  const [selectedCitationMessageId, setSelectedCitationMessageId] = useState<string | null>(null);
  const citationRailRef = useRef<HTMLDivElement>(null);
  const prevLatestCitationMessageIdRef = useRef<string | null>(null);
  const latestThreadRef = useRef<typeof thread>(thread);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latestThreadRef.current = thread;
  }, [thread]);

  // Auto-scroll to bottom when new messages arrive or stream updates.
  // Skip on initial load (only greeting visible) so the welcome message
  // isn't scrolled off the top of the viewport.
  useEffect(() => {
    if (messages.length > 0 || streamingContent !== null) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, streamingContent]);

  // Keep chat model options in sync with settings changes.
  useEffect(() => {
    function syncModelSelectionFromStorage() {
      const { models, activeByokModelId } = readSavedByokModels();
      setSavedByokModels(models);
      const nextDefault = activeByokModelId ? `byok:${activeByokModelId}` : "app-default";
      setSelectedModelId((current) => {
        if (current === "app-default") return nextDefault;
        const stillExists = current.startsWith("byok:") && models.some((m) => `byok:${m.id}` === current);
        return stillExists ? current : nextDefault;
      });
    }
    syncModelSelectionFromStorage();
    window.addEventListener("storage", syncModelSelectionFromStorage);
    return () => window.removeEventListener("storage", syncModelSelectionFromStorage);
  }, []);

  // Reset to app-default if signed out with a BYOK model selected.
  useEffect(() => {
    if (!isSignedIn && selectedModelId.startsWith("byok:")) {
      setSelectedModelId("app-default");
    }
  }, [isSignedIn, selectedModelId]);

  // Detect missing BYOK key on mount — show banner immediately rather than
  // only after the user's first failed send attempt.
  useEffect(() => {
    if (selectedModelId.startsWith("byok:") && !readByokConfig()) {
      setByokKeyMissing(true);
    } else {
      setByokKeyMissing(false);
    }
  }, [selectedModelId]);

  const philosopherName = philosopher?.name ?? "Chat";
  const threadTitle = thread?.title?.trim();
  const subtitle = philosopher ? `${philosopher.school} · ${philosopher.tagline}` : "";

  const greetingMessage = useMemo(() => {
    if (!philosopher) return null;
    return {
      _id: "greeting",
      role: "assistant" as const,
      content: philosopher.greeting,
      citations: [],
    };
  }, [philosopher]);

  const assistantMessagesWithCitations = useMemo(
    () =>
      messages.filter(
        (m) => m.role === "assistant" && Array.isArray(m.citations) && m.citations.length > 0
      ),
    [messages]
  );

  useEffect(() => {
    const latest = assistantMessagesWithCitations[assistantMessagesWithCitations.length - 1];
    if (!latest) {
      setSelectedCitationMessageId(null);
      prevLatestCitationMessageIdRef.current = null;
      return;
    }

    const selectedStillExists = selectedCitationMessageId
      ? assistantMessagesWithCitations.some((m) => m._id === selectedCitationMessageId)
      : false;

    // First load or after deletion: select latest.
    if (!selectedStillExists) {
      setSelectedCitationMessageId(latest._id);
      prevLatestCitationMessageIdRef.current = latest._id;
      return;
    }

    // New cited response arrived: only auto-advance if user was already on
    // the previous latest; otherwise preserve their manual selection.
    const previousLatest = prevLatestCitationMessageIdRef.current;
    if (previousLatest && latest._id !== previousLatest && selectedCitationMessageId === previousLatest) {
      setSelectedCitationMessageId(latest._id);
    }
    prevLatestCitationMessageIdRef.current = latest._id;
  }, [assistantMessagesWithCitations, selectedCitationMessageId]);

  const selectedCitationMessage = useMemo(
    () =>
      assistantMessagesWithCitations.find((m) => m._id === selectedCitationMessageId) ??
      assistantMessagesWithCitations[assistantMessagesWithCitations.length - 1] ??
      null,
    [assistantMessagesWithCitations, selectedCitationMessageId]
  );

  const selectedReplyPreview = useMemo(() => {
    if (!selectedCitationMessage?.content) return "";
    const compact = selectedCitationMessage.content.replace(/\s+/g, " ").trim();
    if (compact.length <= 90) return compact;
    return `${compact.slice(0, 90).trim()}…`;
  }, [selectedCitationMessage]);

  const selectedCitationIndex = useMemo(
    () => assistantMessagesWithCitations.findIndex((m) => m._id === selectedCitationMessage?._id),
    [assistantMessagesWithCitations, selectedCitationMessage]
  );

  // Whenever selected citations change, reset rail scroll so the top/header
  // is always visible and never appears "truncated".
  useEffect(() => {
    citationRailRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [selectedCitationMessageId]);

  function selectPreviousCitationSet() {
    if (selectedCitationIndex <= 0) return;
    const prev = assistantMessagesWithCitations[selectedCitationIndex - 1];
    if (prev) setSelectedCitationMessageId(prev._id);
  }

  function selectNextCitationSet() {
    if (selectedCitationIndex < 0 || selectedCitationIndex >= assistantMessagesWithCitations.length - 1) return;
    const next = assistantMessagesWithCitations[selectedCitationIndex + 1];
    if (next) setSelectedCitationMessageId(next._id);
  }

  const chatModelOptions = useMemo<ChatModelOption[]>(() => {
    const base: ChatModelOption[] = [
      {
        id: "app-default",
        label: "Groq",
        detail: "llama-3.3-70b · app default",
        provider: "App",
      },
    ];
    // BYOK models require sign-in
    if (!isSignedIn) return base;
    const saved = savedByokModels.map((m) => ({
      id: `byok:${m.id}`,
      label: m.name,
      detail: m.model,
      provider: getProviderLabel(m.model, m.endpoint),
    }));
    return [...base, ...saved];
  }, [savedByokModels, isSignedIn]);

  function emitClientEvent(
    eventName:
      | "message_sent"
      | "citation_opened"
      | "bookmark_added",
    properties: Record<string, unknown>
  ) {
    if (principal.isLoading || !principal.principalId) return;
    void trackEvent(
      createClientEvent({
        eventName,
        principalType: principal.principalType,
        principalId: principal.principalId,
        sessionId: getOrCreateSessionId(),
        properties,
      })
    );
  }

  function handleSelectCitations(messageId: string) {
    setSelectedCitationMessageId(messageId);
    const selectedMessage = messages.find((m) => m._id === messageId);
    const firstCitation = selectedMessage?.citations?.[0];
    if (!thread || !philosopher || !firstCitation) return;
    emitClientEvent("citation_opened", {
      threadId: thread._id,
      messageId,
      philosopherId: philosopher._id,
      philosopherSlug: philosopher.slug,
      sourceTextId: firstCitation.sourceTextId,
      workTitle: firstCitation.workTitle,
      chapterRef: firstCitation.chapterRef,
    });
  }

  async function handleSend(value: string) {
    if (principal.isLoading || !thread) return;
    const sendPrincipalType = principal.principalType;
    const sendPrincipalId = principal.principalId;
    const sendThreadId = thread._id;
    const mode = selectedModelId.startsWith("byok:") ? "byok" : "guest";

    emitClientEvent("message_sent", {
      threadId: sendThreadId,
      philosopherId: thread.philosopherId,
      philosopherSlug: philosopher?.slug ?? "unknown",
      mode,
      messageLength: value.length,
    });

    // ── Crisis pre-flight (client-side) ───────────────────────────────────────
    // Runs before any LLM call or rate-limit check. Stores both the user message
    // and the canned safe response directly — no Convex action, no quota consumed.
    if (detectCrisis(value)) {
      await sendUserMessageOnly({
        threadId: sendThreadId,
        principalType: sendPrincipalType,
        principalId: sendPrincipalId,
        content: value,
        mode,
      });
      await storeStreamedAssistantMessage({
        threadId: sendThreadId,
        principalType: sendPrincipalType,
        principalId: sendPrincipalId,
        content: CRISIS_RESPONSE,
        mode,
        crisisDetected: true,
        citations: undefined,
      });
      return;
    }

    if (selectedModelId.startsWith("byok:")) {
      // ── BYOK streaming path ────────────────────────────────────────────────
      const byok = readByokConfig();
      if (!byok) {
        setByokKeyMissing(true);
        return;
      }
      const modelId = selectedModelId.replace("byok:", "");
      const selectedSavedModel = byok.savedModels?.find((m) => m.id === modelId);
      setByokKeyMissing(false);

      // STX (U+0002) sentinel used by the route to delimit citation JSON
      const CITATION_SENTINEL = "\u0002";

      type CitationPayload = { workTitle: string; chapterRef: string; passage: string; sourceTextId: Id<"sourceTexts"> };
      let fullContent = "";
      let citations: CitationPayload[] = [];
      try {
        // Show thinking dots immediately — before any async work.
        setStreamingContent("");

        // Get the Convex-scoped JWT from Clerk's client-side cache (fast, no network call).
        // The server uses this token directly so it doesn't have to call Clerk's API.
        const convexToken = principal.principalType === "user"
          ? (await getToken({ template: "convex" })) ?? undefined
          : undefined;

        // Start the stream fetch and store the user message in parallel.
        const fetchPromise = fetch("/api/chat/stream", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(convexToken && { "Authorization": `Bearer ${convexToken}` }),
          },
          body: JSON.stringify({
            threadId: sendThreadId,
            content: value,
            anonId: sendPrincipalType === "anon" ? sendPrincipalId : undefined,
            byokKey: byok.key,
            byokModel: selectedSavedModel?.model ?? byok.model,
            byokEndpoint: selectedSavedModel?.endpoint ?? byok.customEndpoint,
          }),
        });

        // Store user message while the stream fetch is in flight.
        await sendUserMessageOnly({
          threadId: sendThreadId,
          principalType: sendPrincipalType,
          principalId: sendPrincipalId,
          content: value,
          mode,
        });

        const response = await fetchPromise;
        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          fullContent += decoder.decode(chunk, { stream: true });
          // Stop updating the display once the sentinel appears — citation
          // data should never be shown in the streaming bubble.
          if (!fullContent.includes(CITATION_SENTINEL)) {
            // Strip raw citation markers during streaming — they'll be replaced
            // with human-readable references once the full passage list arrives
            // at stream end via the sentinel payload.
            setStreamingContent(fullContent.replace(/\[(?:CIT:)?[Pp]\d+(?:[,;\s]+(?:CIT:)?[Pp]\d+)*\]/g, ""));
          }
        }

        // Extract and decode citation payload from the end of the stream
        const sentinelIdx = fullContent.indexOf(CITATION_SENTINEL);
        if (sentinelIdx >= 0) {
          const b64 = fullContent.slice(sentinelIdx + 1);
          fullContent = fullContent.slice(0, sentinelIdx).trimEnd();
          try {
            // Decode UTF-8 base64 → bytes → string (handles non-ASCII safely)
            const binaryStr = atob(b64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            citations = JSON.parse(new TextDecoder().decode(bytes)) as CitationPayload[];
          } catch { /* ignore malformed citation payload */ }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Inference failed.";
        fullContent = `⚠ ${msg}`;
      }

      // Resolve [P1]/[CIT:P1] citation markers using passage metadata from the sentinel.
      fullContent = resolveCitationMarkersClient(fullContent, citations);

      // Store the completed response + citations in Convex. If ownership changed
      // while streaming (e.g. anon -> user merge), retry with latest thread owner.
      const safeContent = fullContent || "I was unable to formulate a response.";
      try {
        await storeStreamedAssistantMessage({
          threadId: sendThreadId,
          principalType: sendPrincipalType,
          principalId: sendPrincipalId,
          content: safeContent,
          mode,
          crisisDetected: false,
          citations: citations.length > 0 ? citations : undefined,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Store streamed message failed.";
        const latestThread = latestThreadRef.current;
        const canRetryWithLatestOwner =
          latestThread &&
          (latestThread.principalType !== sendPrincipalType || latestThread.principalId !== sendPrincipalId) &&
          (message.includes("Thread not found") || message.includes("Unauthorized"));
        if (canRetryWithLatestOwner) {
          try {
            await storeStreamedAssistantMessage({
              threadId: latestThread._id,
              principalType: latestThread.principalType,
              principalId: latestThread.principalId,
              content: safeContent,
              mode,
              crisisDetected: false,
              citations: citations.length > 0 ? citations : undefined,
            });
          } catch (retryErr) {
            console.error("Failed to persist streamed assistant message after ownership retry.", retryErr);
          }
        } else {
          console.error("Failed to persist streamed assistant message.", err);
        }
      } finally {
        setStreamingContent(null);
      }
    } else {
      // ── Guest mode: Convex action path (with RAG + citations) ─────────────
      const messageId = await sendUserMessage({
        threadId: sendThreadId,
        principalType: sendPrincipalType,
        principalId: sendPrincipalId,
        content: value,
      });
      setPendingMessageId(messageId);
    }
  }

  async function handleRenameThread(title: string) {
    if (!thread || principal.isLoading) return;
    setIsRenamingThread(true);
    try {
      await renameThread({
        threadId: thread._id,
        principalType: principal.principalType,
        principalId: principal.principalId,
        title,
      });
      setRenameModalOpen(false);
    } finally {
      setIsRenamingThread(false);
    }
  }

  const isGuestPending =
    pendingMessageId !== null &&
    messages[messages.length - 1]?._id === pendingMessageId;
  const philosopherProfileHref = philosopher ? `/philosophers/${philosopher.slug}` : "/philosophers";

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/philosophers");
  }

  return (
    <div className="min-h-screen pb-24" style={{ background: "var(--bg-primary)" }}>
      <Navbar />
      <header
        className="sticky top-0 z-30 md:hidden"
        style={{
          borderBottom: "1px solid var(--border-strong)",
          background: "var(--bg-card)",
          boxShadow: "0 8px 20px rgba(2, 6, 23, 0.24)",
        }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Go back"
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
          >
            <IconArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <Link
              href={philosopherProfileHref}
              className="block truncate text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              {philosopherName}
            </Link>
            <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
              {threadTitle || "Conversation"}
            </p>
          </div>
          <Link
            href="/philosophers"
            className="text-[11px] underline underline-offset-2"
            style={{ color: "var(--text-muted)" }}
          >
            Philosophers
          </Link>
        </div>
      </header>
      <main className="mx-auto grid w-full max-w-[1600px] grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[minmax(0,1fr)_380px] md:gap-8 md:px-8">
        <section className="flex min-w-0 flex-col gap-4">
          <div
            className="rounded-2xl px-4 py-3"
            style={{ background: "var(--bg-card)", border: "1px solid var(--border-strong)" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={philosopherProfileHref} className="truncate text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {philosopherName}
                </Link>
                <p className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setRenameModalOpen(true)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg transition-colors duration-150"
                style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
                title="Rename conversation"
              >
                <IconEdit size={14} />
              </button>
            </div>
          </div>

          {greetingMessage && (
            <MessageBubble
              role="assistant"
              content={greetingMessage.content}
              philosopherName={philosopher?.name}
            mobileOnlyInlineCitations
            />
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message._id}
              messageId={message._id}
              role={message.role}
              content={message.content}
              citations={message.citations ?? []}
              philosopherName={philosopher?.name}
              isBookmarked={isSignedIn ? bookmarkedMessageIds.has(message._id) : false}
              onSelectCitations={handleSelectCitations}
              mobileOnlyInlineCitations
              onToggleBookmark={isSignedIn ? () => {
                if (!thread || message.role !== "assistant") return;
                void toggleBookmark({
                  principalType: principal.principalType,
                  principalId: principal.principalId,
                  threadId: thread._id,
                  messageId: message._id,
                }).then((result) => {
                  if (result?.inserted && philosopher) {
                    emitClientEvent("bookmark_added", {
                      threadId: thread._id,
                      messageId: message._id,
                      philosopherId: philosopher._id,
                      philosopherSlug: philosopher.slug,
                    });
                  }
                });
              } : undefined}
              onCopy={() => {
                void navigator.clipboard?.writeText(message.content ?? "");
              }}
            />
          ))}

          {/* BYOK streaming bubble — thinking dots while waiting for first token, cursor once streaming */}
          {streamingContent !== null && (
            <MessageBubble
              role="assistant"
              content={streamingContent}
              philosopherName={philosopher?.name}
              isThinking={streamingContent.length === 0}
              isStreaming={streamingContent.length > 0}
            mobileOnlyInlineCitations
            />
          )}

          {/* Guest mode pending bubble — cursor matches BYOK streaming UX */}
          {isGuestPending && (
            <MessageBubble
              role="assistant"
              content=""
              philosopherName={philosopher?.name}
              isStreaming
            mobileOnlyInlineCitations
            />
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </section>

        <aside className="hidden md:block md:pt-3">
          <div
            ref={citationRailRef}
            className="sticky top-[112px] z-20 overflow-y-auto rounded-2xl"
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-strong)",
              height: "calc(100dvh - 112px - 152px)",
            }}
          >
            <div
              className="sticky top-0 z-10 px-4 pb-3 pt-4"
              style={{
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.16em]"
                  style={{ color: "var(--accent)" }}
                >
                  Source Passages
                </p>
                {assistantMessagesWithCitations.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={selectPreviousCitationSet}
                      disabled={selectedCitationIndex <= 0}
                      className="rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      Prev
                    </button>
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {selectedCitationIndex + 1} / {assistantMessagesWithCitations.length}
                    </span>
                    <button
                      type="button"
                      onClick={selectNextCitationSet}
                      disabled={selectedCitationIndex < 0 || selectedCitationIndex >= assistantMessagesWithCitations.length - 1}
                      className="rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40"
                      style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {selectedReplyPreview && (
                <div
                  className="rounded-xl px-2.5 py-2"
                  style={{
                    background: "rgba(201, 151, 58, 0.08)",
                    border: "1px solid rgba(201, 151, 58, 0.22)",
                  }}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--accent)" }}>
                    Selected reply
                  </p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                    {selectedReplyPreview}
                  </p>
                </div>
              )}
            </div>

            {!selectedCitationMessage || !selectedCitationMessage.citations?.length ? (
              <p className="px-4 py-3 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Sources for the current conversation will appear here when a cited assistant message is available.
              </p>
            ) : (
              <div className="space-y-4 px-4 py-3">
                {selectedCitationMessage.citations.map((citation, idx) => (
                  <div
                    key={`${citation.chapterRef}-${idx}`}
                    className="space-y-1.5 border-b pb-3 last:border-b-0 last:pb-0"
                    style={{ borderColor: "var(--border)" }}
                  >
                    <p
                      className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: "var(--accent)" }}
                    >
                      {citation.workTitle}
                      {citation.chapterRef ? ` · ${citation.chapterRef}` : ""}
                    </p>
                    <p
                      className="text-sm italic leading-relaxed"
                      style={{
                        fontFamily: "var(--font-crimson-pro), Georgia, serif",
                        color: "var(--text-secondary)",
                      }}
                    >
                      &ldquo;{citation.passage}&rdquo;
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      <div className="fixed bottom-0 left-0 right-0" style={{ background: "var(--bg-card)" }}>
        {byokKeyMissing && selectedModelId.startsWith("byok:") && (
          <div
            className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
            style={{
              borderTop: "1px solid rgba(234, 179, 8, 0.25)",
              background: "rgba(234, 179, 8, 0.06)",
              color: "rgb(253, 224, 71)",
            }}
          >
            <span>Selected BYOK model needs an available API key. Add one in Settings.</span>
            <Link
              href="/settings"
              className="underline underline-offset-2 opacity-80 hover:opacity-100"
            >
              Settings
            </Link>
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          modelOptions={chatModelOptions}
          selectedModelId={selectedModelId}
          onSelectModel={setSelectedModelId}
          disabled={
            !thread ||
            principal.isLoading ||
            streamingContent !== null ||
            isGuestPending
          }
        />
      </div>

      <RenameThreadModal
        open={renameModalOpen}
        initialTitle={thread?.title}
        fallbackTitle={philosopher?.name ?? "Conversation"}
        isSaving={isRenamingThread}
        onClose={() => {
          if (!isRenamingThread) setRenameModalOpen(false);
        }}
        onSave={handleRenameThread}
      />
    </div>
  );
}
