import Link from "next/link";
import type { Reminder } from "@/lib/reminders";
import { Icon, ICONS, RowChevron } from "@/components/Icons";

const TONE = {
  out: { cls: "bg-out/14 text-out", icon: ICONS.alert },
  warn: { cls: "bg-warn/16 text-warn", icon: ICONS.bell },
  info: { cls: "bg-accent/14 text-accent", icon: ICONS.bell },
};

export default function Reminders({ items }: { items: Reminder[] }) {
  if (!items.length) return null;
  return (
    <ul className="ledger">
      {items.map((r) => {
        const t = TONE[r.tone];
        return (
          <li key={r.key}>
            <Link href={r.href} className="flex items-center gap-3.5 px-4 py-3">
              <span className={`avatar ${t.cls}`} aria-hidden>
                <Icon d={t.icon} size={19} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold">{r.title}</span>
                <span className="block text-[0.8125rem] text-muted">{r.body}</span>
              </span>
              <RowChevron />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function StatusChip({ status, days }: { status: "paid" | "due" | "overdue"; days: number }) {
  const cls =
    status === "paid"
      ? "bg-in/14 text-in"
      : status === "overdue"
        ? "bg-out/14 text-out"
        : days <= 7
          ? "bg-warn/16 text-warn"
          : "bg-surface-2 text-muted";
  const text = status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : days === 0 ? "Due today" : `${days}d left`;
  return <span className={`chip ${cls}`}>{text}</span>;
}
