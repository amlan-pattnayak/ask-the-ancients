/**
 * Inline SVG icon set — replaces emoji icons throughout the app.
 * All icons accept className and size props. Default size: 20px.
 */

import type { CSSProperties } from "react";

interface IconProps {
  className?: string;
  size?: number;
  style?: CSSProperties;
}

const defaults = (props: IconProps) => ({
  width: props.size ?? 20,
  height: props.size ?? 20,
  fill: "none",
  viewBox: "0 0 24 24",
  strokeWidth: 1.6,
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: props.className,
});

export function IconColumns(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <rect x="3" y="3" width="3" height="18" rx="1" />
      <rect x="10.5" y="3" width="3" height="18" rx="1" />
      <rect x="18" y="3" width="3" height="18" rx="1" />
      <line x1="1.5" y1="3" x2="22.5" y2="3" />
      <line x1="1.5" y1="21" x2="22.5" y2="21" />
    </svg>
  );
}

export function IconScroll(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8Z" />
      <path d="M8 3a2 2 0 0 0-2 2v0a2 2 0 0 1-2 2H4" />
      <path d="M4 5v12a2 2 0 0 0 2 2" />
      <line x1="11" y1="8" x2="17" y2="8" />
      <line x1="11" y1="12" x2="17" y2="12" />
      <line x1="11" y1="16" x2="15" y2="16" />
    </svg>
  );
}

export function IconBookmark(p: IconProps & { filled?: boolean }) {
  return (
    <svg {...defaults(p)}>
      <path
        d="M5 3h14a1 1 0 0 1 1 1v17l-8-4-8 4V4a1 1 0 0 1 1-1Z"
        fill={p.filled ? "currentColor" : "none"}
      />
    </svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function IconSearch(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export function IconArrowLeft(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

export function IconMoreVertical(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconChevronDown(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconChevronRight(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function IconCopy(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function IconSend(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="m22 2-7 20-4-9-9-4 20-7Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

export function IconQuote(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
    </svg>
  );
}

export function IconHistory(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconTrash(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

export function IconEdit(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

export function IconAgora(p: IconProps) {
  return (
    <svg {...defaults(p)}>
      {/* Balance scale — fitting for philosophical comparison */}
      <path d="M12 3v18" />
      <path d="M4 6h16" />
      <path d="M6 6l-3 6a3 3 0 0 0 6 0L6 6Z" />
      <path d="M18 6l-3 6a3 3 0 0 0 6 0L18 6Z" />
      <path d="M9 21h6" />
    </svg>
  );
}
