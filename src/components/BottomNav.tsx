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

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-accent" : "text-muted"}`}
              >
                <span
                  className={
                    it.primary
                      ? "grid h-9 w-9 place-items-center rounded-full bg-accent text-[#062a26]"
                      : "grid h-9 w-9 place-items-center"
                  }
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={it.icon} />
                  </svg>
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
