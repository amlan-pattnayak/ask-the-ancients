"use client";

interface ToastProps {
  message: string;
  visible: boolean;
}

export default function Toast({ message, visible }: ToastProps) {
  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 px-4">
      <div
        className="rounded-full px-4 py-2 text-xs font-medium"
        style={{
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid rgba(201, 151, 58, 0.32)",
          color: "var(--text-primary)",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
        }}
      >
        {message}
      </div>
    </div>
  );
}
