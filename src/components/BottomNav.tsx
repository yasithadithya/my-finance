"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, ICONS } from "@/components/Icons";

const items = [
  { href: "/", label: "Home", icon: ICONS.home },
  { href: "/pay", label: "Pay", icon: ICONS.calendar },
  { href: "/transactions", label: "History", icon: ICONS.history },
  { href: "/accounts", label: "Accounts", icon: ICONS.wallet },
];

/** One UI style floating tab bar, with the add button as its own round button. */
export default function BottomNav() {
  const path = usePathname();
  const addActive = path.startsWith("/add");
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20"
      style={{ paddingBottom: "max(0.875rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto mx-auto flex max-w-md items-center gap-2.5 px-4">
        <ul className="navbar grid flex-1 grid-cols-4 rounded-full p-1.5">
          {items.map((it) => {
            const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
            return (
              <li key={it.href}>
                <Link
                  href={it.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center gap-0.5 rounded-full py-1.5 text-[11px] transition-colors ${
                    active ? "bg-accent/14 font-semibold text-accent" : "font-medium text-muted active:bg-surface-3"
                  }`}
                >
                  <Icon d={it.icon} size={22} strokeWidth={active ? 2.2 : 1.9} />
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/add"
          aria-label="Add transaction"
          aria-current={addActive ? "page" : undefined}
          className="grid h-[3.75rem] w-[3.75rem] shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-[0_8px_24px_-8px_rgb(3_129_254/0.7)] transition-transform active:scale-92"
        >
          <Icon d={ICONS.plus} size={26} strokeWidth={2.4} />
        </Link>
      </div>
    </nav>
  );
}
