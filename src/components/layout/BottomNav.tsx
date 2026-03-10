"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconColumns, IconHistory, IconBookmark, IconSettings, IconAgora } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/philosophers", label: "Philosophers", Icon: IconColumns },
  { href: "/history",      label: "History",      Icon: IconHistory },
  { href: "/compare",      label: "Agora",         Icon: IconAgora },
  { href: "/bookmarks",    label: "Saved",         Icon: IconBookmark },
  { href: "/settings",     label: "Settings",      Icon: IconSettings },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[70] md:hidden"
      style={{
        background: "var(--bg-card)",
        borderTop: "1px solid var(--border)",
        boxShadow: "0 -10px 28px rgba(2, 6, 23, 0.45)",
      }}
    >
      <div className="grid w-full grid-cols-5 px-2 pb-safe">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="group flex flex-col items-center gap-0.5 px-1 py-2.5"
            >
              {/* Icon container — pill highlight when active */}
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200"
                style={active ? {
                  background: "rgba(201, 151, 58, 0.12)",
                  color: "var(--accent)",
                } : {
                  color: "var(--text-muted)",
                }}
              >
                <Icon size={18} />
              </span>

              {/* Label */}
              <span
                className="text-[11px] font-medium tracking-wide transition-colors duration-200"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
