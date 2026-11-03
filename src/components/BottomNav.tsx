"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheckBig, History, House, LayoutGrid, Plus } from "lucide-react";

const items = [
  { href: "/", label: "Home", Icon: House },
  { href: "/transactions", label: "History", Icon: History },
  { href: "/add", label: "Add", Icon: Plus, primary: true },
  { href: "/pay", label: "Pay", Icon: CircleCheckBig },
  { href: "/more", label: "More", Icon: LayoutGrid, also: ["/accounts", "/cards", "/debts", "/receivables"] },
];

export default function BottomNav() {
  const path = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, Icon, primary, also }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href) || (also ?? []).some((a) => path.startsWith(a));
          if (primary) {
            return (
              <li key={href} className="flex justify-center">
                <Link href={href} aria-label="Add transaction" className="-mt-5 grid h-14 w-14 place-items-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-8px_rgba(94,234,212,0.7)] ring-4 ring-bg">
                  <Icon size={26} strokeWidth={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={href}>
              <Link href={href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${active ? "text-accent" : "text-faint"}`}>
                <Icon size={21} strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
