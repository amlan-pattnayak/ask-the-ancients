"use client";

import { IconClose, IconTrash } from "@/components/ui/icons";

interface DeleteThreadModalProps {
  open: boolean;
  threadTitle?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export default function DeleteThreadModal({
  open,
  threadTitle,
  isDeleting = false,
  onClose,
  onConfirm,
}: DeleteThreadModalProps) {
  if (!open) return null;

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
            Delete conversation
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-md p-1 transition-colors duration-150 disabled:opacity-40"
            style={{ color: "var(--text-muted)" }}
          >
            <IconClose size={14} />
          </button>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          {threadTitle
            ? `Are you sure you want to delete "${threadTitle}"? This cannot be undone.`
            : "Are you sure you want to delete this conversation? This cannot be undone."}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
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
            onClick={() => void onConfirm()}
            disabled={isDeleting}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-150 disabled:opacity-40"
            style={{
              background: "rgba(239, 68, 68, 0.9)",
              color: "white",
            }}
          >
            <IconTrash size={12} />
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}
