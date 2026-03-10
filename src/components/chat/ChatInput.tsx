"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSend } from "@/components/ui/icons";

export interface ChatModelOption {
  id: string;
  label: string;
  detail?: string;
  provider?: string;
}

interface ChatInputProps {
  onSend: (value: string) => Promise<void>;
  disabled?: boolean;
  modelOptions?: ChatModelOption[];
  selectedModelId?: string;
  onSelectModel?: (id: string) => void;
}

export default function ChatInput({
  onSend,
  disabled,
  modelOptions = [],
  selectedModelId,
  onSelectModel,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [sending, setSending] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelMenuListRef = useRef<HTMLDivElement>(null);
  const modelTriggerRef = useRef<HTMLButtonElement>(null);

  const selectedModel = modelOptions.find((m) => m.id === selectedModelId) ?? modelOptions[0];
  const groupedModels = useMemo(() => {
    const groups = new Map<string, ChatModelOption[]>();
    for (const option of modelOptions) {
      const provider = option.provider?.trim() || "Other";
      const existing = groups.get(provider) ?? [];
      existing.push(option);
      groups.set(provider, existing);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "App") return -1;
      if (b === "App") return 1;
      return a.localeCompare(b);
    });
  }, [modelOptions]);
  const flatModels = useMemo(
    () => groupedModels.flatMap(([, options]) => options),
    [groupedModels]
  );
  const isDefaultModel = !selectedModel || selectedModel.id === "app-default";
  const triggerLabel = isDefaultModel
    ? "Groq · llama-3.3-70b"
    : selectedModel.label;
  const triggerHint = isDefaultModel ? "app default" : selectedModel.detail;

  const canSend = !disabled && !sending && value.trim().length > 0;

  async function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || sending || disabled) return;
    setSending(true);
    // Clear immediately so the UI feels responsive
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (!modelMenuOpen) return;
    function onDocClick(event: MouseEvent) {
      if (!modelMenuRef.current) return;
      if (!modelMenuRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [modelMenuOpen]);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const selectedIndex = flatModels.findIndex((m) => m.id === selectedModel?.id);
    setActiveMenuIndex(selectedIndex >= 0 ? selectedIndex : 0);
    const raf = window.requestAnimationFrame(() => modelMenuListRef.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, [flatModels, modelMenuOpen, selectedModel?.id]);

  useEffect(() => {
    if (!modelMenuOpen || !modelMenuListRef.current) return;
    const target = modelMenuListRef.current.querySelector<HTMLElement>(
      `[data-model-index="${activeMenuIndex}"]`
    );
    target?.scrollIntoView({ block: "nearest" });
  }, [activeMenuIndex, modelMenuOpen]);

  function selectModel(id: string) {
    onSelectModel?.(id);
    setModelMenuOpen(false);
    modelTriggerRef.current?.focus();
  }

  return (
    <div
      className="px-4 py-3"
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}
    >
      <div
        className="flex min-w-0 items-end gap-2 rounded-2xl px-4 py-2.5 transition-shadow duration-200"
        style={{
          background: "var(--bg-primary)",
          border: "1px solid var(--border-strong)",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "rgba(201, 151, 58, 0.4)";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(201, 151, 58, 0.06)";
        }}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.style.borderColor = "var(--border-strong)";
            e.currentTarget.style.boxShadow = "none";
          }
        }}
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Ask your question…"
          disabled={disabled || sending}
          rows={1}
          className="min-w-0 flex-1 resize-none bg-transparent text-sm leading-relaxed focus:outline-none"
          style={{
            color: "var(--text-primary)",
            minHeight: "24px",
            maxHeight: "120px",
            overflow: "auto",
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
          }}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-all duration-150"
          style={{
            background: canSend ? "var(--accent)" : "var(--bg-elevated)",
            color: canSend ? "var(--color-navy)" : "var(--text-muted)",
            cursor: canSend ? "pointer" : "default",
          }}
          aria-label="Send message"
        >
          <IconSend size={14} />
        </button>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 sm:mt-1">
        <div className="relative min-w-0 flex-1 sm:flex-none" ref={modelMenuRef}>
          <button
            ref={modelTriggerRef}
            type="button"
            onClick={() => setModelMenuOpen((v) => !v)}
            onKeyDown={(e) => {
              if (!flatModels.length) return;
              if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setModelMenuOpen(true);
              }
              if (e.key === "Escape") {
                setModelMenuOpen(false);
              }
            }}
            className="flex w-full items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] sm:mb-0.5 sm:w-auto"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", background: "var(--bg-elevated)" }}
            disabled={disabled || sending || modelOptions.length === 0}
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            aria-controls="chat-model-listbox"
          >
            <span
              className="max-w-[220px] truncate font-medium sm:max-w-[150px]"
              style={{ color: isDefaultModel ? "var(--text-primary)" : "var(--text-secondary)" }}
            >
              {triggerLabel}
            </span>
            {triggerHint && (
              <span className="max-w-[140px] truncate text-[10px] sm:hidden" style={{ color: "var(--text-muted)" }}>
                {triggerHint}
              </span>
            )}
            {triggerHint && (
              <span className="hidden max-w-[120px] truncate text-[10px] sm:inline" style={{ color: "var(--text-muted)" }}>
                {triggerHint}
              </span>
            )}
            <IconChevronDown size={12} />
          </button>
          {modelMenuOpen && modelOptions.length > 0 && (
            <div
              className="absolute bottom-full left-0 z-40 mb-2 w-full min-w-[16rem] overflow-hidden rounded-xl border sm:w-64"
              style={{
                borderColor: "var(--border-strong)",
                background: "var(--bg-card)",
                boxShadow: "0 12px 24px rgba(2, 6, 23, 0.28)",
              }}
            >
              <div
                className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: "var(--accent)", borderBottom: "1px solid var(--border)" }}
              >
                Available Models
              </div>
              <div
                ref={modelMenuListRef}
                id="chat-model-listbox"
                role="listbox"
                tabIndex={-1}
                aria-activedescendant={flatModels[activeMenuIndex] ? `chat-model-option-${flatModels[activeMenuIndex].id.replace(/[^a-zA-Z0-9_-]/g, "-")}` : undefined}
                onKeyDown={(e) => {
                  if (!flatModels.length) return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setActiveMenuIndex((i) => (i + 1) % flatModels.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setActiveMenuIndex((i) => (i - 1 + flatModels.length) % flatModels.length);
                    return;
                  }
                  if (e.key === "Home") {
                    e.preventDefault();
                    setActiveMenuIndex(0);
                    return;
                  }
                  if (e.key === "End") {
                    e.preventDefault();
                    setActiveMenuIndex(flatModels.length - 1);
                    return;
                  }
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    const selected = flatModels[activeMenuIndex];
                    if (selected) selectModel(selected.id);
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setModelMenuOpen(false);
                    modelTriggerRef.current?.focus();
                  }
                }}
                className="model-menu-scroll max-h-56 overflow-y-auto overscroll-contain p-1.5 pr-2"
                style={{
                  scrollPaddingTop: "6px",
                  scrollPaddingBottom: "6px",
                  scrollbarGutter: "stable",
                }}
              >
                {(() => {
                  let optionIndex = -1;
                  return groupedModels.map(([provider, options]) => (
                    <div key={provider} className="mb-1.5 last:mb-0">
                      <p
                        className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {provider}
                      </p>
                      {options.map((option) => {
                        optionIndex += 1;
                        const index = optionIndex;
                        const isActive = index === activeMenuIndex;
                        return (
                          <button
                            key={option.id}
                            id={`chat-model-option-${option.id.replace(/[^a-zA-Z0-9_-]/g, "-")}`}
                            data-model-index={index}
                            role="option"
                            aria-selected={selectedModel?.id === option.id}
                            type="button"
                            onMouseEnter={() => setActiveMenuIndex(index)}
                            onClick={() => selectModel(option.id)}
                            className="block w-full rounded-lg px-2.5 py-2 text-left"
                            style={{
                              background: isActive ? "var(--bg-elevated)" : "transparent",
                            }}
                          >
                            <p className="truncate text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                              {option.label}
                            </p>
                            {option.detail && (
                              <p className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                                {option.detail}
                              </p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </div>
        <p className="text-[10px] sm:hidden" style={{ color: "var(--text-muted)", opacity: 0.8 }}>
          Tap the model button to switch model
        </p>
      </div>

      <p
        className="mt-1.5 hidden text-center text-[10px] sm:block"
        style={{ color: "var(--text-muted)", opacity: 0.5 }}
      >
        Enter to send · Shift+Enter for new line
      </p>
    </div>
  );
}
