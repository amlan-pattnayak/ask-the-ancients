import Link from "next/link";

interface WordmarkLogoProps {
  /** Visual size preset */
  size?: "sm" | "md" | "lg";
  /** Whether to wrap in a link to "/" */
  linked?: boolean;
  /** Extra class names on the outer element */
  className?: string;
}

const SIZE_MAP = {
  sm: { wordmark: "0.8rem",  rule: "w-5",  ornament: "0.5rem" },
  md: { wordmark: "1rem",    rule: "w-7",  ornament: "0.6rem" },
  lg: { wordmark: "1.5rem",  rule: "w-10", ornament: "0.7rem" },
};

export default function WordmarkLogo({
  size = "md",
  linked = true,
  className = "",
}: WordmarkLogoProps) {
  const s = SIZE_MAP[size];

  const inner = (
    <span className={`inline-flex flex-col items-center gap-1 ${className}`}>
      {/* Top ornamental rule */}
      <span className="flex items-center gap-2">
        <span
          className={`h-px ${s.rule} bg-gradient-to-r from-transparent`}
          style={{ backgroundImage: "linear-gradient(to right, transparent, rgba(201,151,58,0.55))" }}
        />
        <span style={{ color: "rgba(201,151,58,0.55)", fontSize: s.ornament, letterSpacing: "0.2em" }}>✦</span>
        <span
          className={`h-px ${s.rule} bg-gradient-to-l from-transparent`}
          style={{ backgroundImage: "linear-gradient(to left, transparent, rgba(201,151,58,0.55))" }}
        />
      </span>

      {/* Wordmark */}
      <span
        style={{
          fontFamily: "var(--font-crimson-pro), Georgia, serif",
          fontSize: s.wordmark,
          fontWeight: 300,
          color: "var(--text-primary)",
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
        }}
      >
        Ask the Ancients
      </span>

      {/* Bottom ornamental dots */}
      <span
        style={{
          color: "rgba(201,151,58,0.35)",
          fontSize: "0.35rem",
          letterSpacing: "0.35em",
        }}
      >
        ◆ ◆ ◆
      </span>
    </span>
  );

  if (!linked) return inner;

  return (
    <Link href="/" className="group transition-opacity duration-200 hover:opacity-80">
      {inner}
    </Link>
  );
}
