import Link from "next/link";
import type { Reminder } from "@/lib/reminders";

const TONE = {
  out: "border-out/40 bg-out/10",
  warn: "border-warn/40 bg-warn/10",
  info: "border-line bg-surface",
};
const DOT = { out: "bg-out", warn: "bg-warn", info: "bg-accent" };

export default function Reminders({ items }: { items: Reminder[] }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-2">
      {items.map((r) => (
        <li key={r.key}>
          <Link href={r.href} className={`flex gap-3 rounded-xl border px-3.5 py-2.5 ${TONE[r.tone]}`}>
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[r.tone]}`} />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{r.title}</span>
              <span className="block text-xs text-muted">{r.body}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatusChip({ status, days }: { status: "paid" | "due" | "overdue"; days: number }) {
  const cls =
    status === "paid" ? "text-in border-in/40" : status === "overdue" ? "text-out border-out/40" : days <= 7 ? "text-warn border-warn/40" : "text-muted border-line";
  const text = status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : days === 0 ? "Due today" : `${days}d left`;
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${cls}`}>{text}</span>;
}
