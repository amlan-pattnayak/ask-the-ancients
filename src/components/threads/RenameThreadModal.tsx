"use client";

import { useState } from "react";
import { IconClose } from "@/components/ui/icons";

interface RenameThreadModalProps {
  open: boolean;
  initialTitle?: string;
  fallbackTitle: string;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (title: string) => Promise<void> | void;
}

export default function RenameThreadModal({
  open,
  initialTitle,
  fallbackTitle,
  isSaving = false,
  onClose,
  onSave,
}: RenameThreadModalProps) {
  const derivedInitial = open ? (initialTitle?.trim() || `${fallbackTitle} chat`) : "";
  const [value, setValue] = useState(derivedInitial);

  // Reset value when modal opens with new props
  const [prevOpen, setPrevOpen] = useState(open);
  if (open && !prevOpen) {
    setValue(initialTitle?.trim() || `${fallbackTitle} chat`);
  }
  if (open !== prevOpen) {
    setPrevOpen(open);
  }

  if (!open) return null;

  async function handleSave() {
    const trimmed = value.trim();
    if (!trimmed || isSaving) return;
    await onSave(trimmed);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(2, 6, 23, 0.72)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-4"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-strong)",
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Rename conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-md p-1 transition-colors duration-150 disabled:opacity-40"
            style={{ color: "var(--text-muted)" }}
          >
            <IconClose size={14} />
          </button>
        </div>

        <input
          autoFocus
          value={value}
          maxLength={120}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSave();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="Conversation title"
          className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-primary)",
          }}
        />

        <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Keep it short and recognizable.
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 disabled:opacity-40"
            style={{
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!value.trim() || isSaving}
            className="rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-40"
            style={{
              background: "var(--accent)",
              color: "var(--color-navy)",
            }}
          >
            {isSaving ? "Saving..." : "Save name"}
          </button>
        </div>
      </div>
    </div>
  );
}
