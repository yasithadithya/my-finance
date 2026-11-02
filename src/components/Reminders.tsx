import Link from "next/link";
import type { Reminder } from "@/lib/reminders";

const BAR = { out: "bg-out", warn: "bg-warn", info: "bg-accent" };

export default function Reminders({ items }: { items: Reminder[] }) {
  if (!items.length) return null;
  return (
    <ul className="ledger">
      {items.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className="relative flex items-center gap-3 py-3 pr-4 pl-5">
            <span className={`absolute inset-y-2.5 left-0 w-[3px] rounded-r-full ${BAR[r.tone]}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted">{r.body}</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted" aria-hidden>
              <path d="m9 6 6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatusChip({ status, days }: { status: "paid" | "due" | "overdue"; days: number }) {
  const cls =
    status === "paid"
      ? "bg-in/15 text-in"
      : status === "overdue"
        ? "bg-out/15 text-out"
        : days <= 7
          ? "bg-warn/15 text-warn"
          : "bg-surface-2 text-muted";
  const text = status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : days === 0 ? "Due today" : `${days}d left`;
  return <span className={`chip ${cls}`}>{text}</span>;
}
