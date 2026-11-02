"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Home", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" },
  { href: "/pay", label: "Pay", icon: "M9 11l3 3 8-8M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h11" },
  { href: "/add", label: "Add", icon: "M12 5v14M5 12h14", primary: true },
  { href: "/transactions", label: "History", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/accounts", label: "Accounts", icon: "M3 7h18v12H3zM3 11h18M7 15h3" },
];

function Icon({ d, size = 22 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          if (it.primary) {
            return (
              <li key={it.href} className="relative flex justify-center">
                <Link
                  href={it.href}
                  aria-label="Add transaction"
                  aria-current={active ? "page" : undefined}
                  className="absolute -top-5 grid h-14 w-14 place-items-center rounded-full bg-accent text-on-accent ring-4 ring-bg transition-transform active:scale-95"
                >
                  <Icon d={it.icon} size={26} />
                </Link>
              </li>
            );
          }
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] transition-colors ${active ? "text-text" : "text-muted"}`}
              >
                <span
                  className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? "bg-accent/15 text-accent" : ""}`}
                >
                  <Icon d={it.icon} />
                </span>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
