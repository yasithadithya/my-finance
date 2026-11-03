import Link from "next/link";
import { dayIn, daysInMonth, lkr, shortDate } from "@/lib/format";
import type { InstalmentDue, StatementView } from "@/lib/statements";
import type { ChecklistItem } from "@/lib/reminders";
import type { Account } from "@/lib/types";

type Tone = "in" | "out" | "warn" | "muted";
interface Event {
  date: string;
  label: string;
  amount?: number;
  kind: "bill" | "fixed" | "statement";
  tone: Tone;
  done: boolean;
}

const BG: Record<Tone, string> = { in: "bg-in", out: "bg-out", warn: "bg-warn", muted: "bg-muted" };

/** Card bills and fixed payments for one month, laid out on a strip of days. */
export default function MonthRunway({
  ym,
  today,
  bills,
  fixed,
  cards = [],
  instalments = [],
  animate = false,
}: {
  ym: string;
  today: string;
  bills: StatementView[];
  fixed: ChecklistItem[];
  /** Credit cards: their statement day is marked with a hollow diamond. */
  cards?: Pick<Account, "name" | "billing_day">[];
  /** Instalments due this month (those already on a bill are shown with the bill). */
  instalments?: InstalmentDue[];
  animate?: boolean;
}) {
  const n = daysInMonth(ym);
  const first = dayIn(ym, 1);
  const last = dayIn(ym, n);

  const events: Event[] = [];
  for (const b of bills) {
    if (b.due_date < first || b.due_date > last) continue;
    const done = b.status === "paid";
    const tone: Tone = done ? "in" : b.status === "overdue" ? "out" : b.days_left <= 7 ? "warn" : "muted";
    events.push({ date: b.due_date, label: `${b.card_name} bill`, amount: done ? b.statement_balance : b.remaining, kind: "bill", tone, done });
  }
  for (const i of instalments) {
    if (i.bill || !i.due_date || i.due_date < first || i.due_date > last) continue;
    const done = !!i.mark;
    const tone: Tone = done ? "in" : i.due_date < today ? "out" : "muted";
    events.push({ date: i.due_date, label: `${i.plan.name} instalment`, amount: i.amount, kind: "bill", tone, done });
  }
  for (const i of fixed) {
    if (!i.due_day) continue;
    const date = dayIn(ym, i.due_day);
    const done = !!i.mark;
    const tone: Tone = done ? "in" : date < today ? "out" : "muted";
    events.push({ date, label: i.name, amount: i.amount, kind: "fixed", tone, done });
  }
  for (const c of cards) {
    if (!c.billing_day) continue;
    const date = dayIn(ym, c.billing_day);
    events.push({ date, label: `${c.name} statement`, kind: "statement", tone: "muted", done: date < today });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));

  const eventDays = new Set(events.map((e) => Number(e.date.slice(8, 10))));
  const todayDay = today >= first && today <= last ? Number(today.slice(8, 10)) : today > last ? n + 1 : 0;
  const next = events.find((e) => !e.done && e.date >= today) ?? events.find((e) => !e.done);
  const pos = (d: string) => `${((Number(d.slice(8, 10)) - 0.5) / n) * 100}%`;

  return (
    <div className={animate ? "runway-fill" : undefined}>
      <Link href={`/pay?month=${ym}`} aria-label="Open the Pay checklist" className="block">
        <div className="runway" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }} aria-hidden>
          {Array.from({ length: n }, (_, i) => {
            const d = i + 1;
            const cls = d === todayDay ? "today" : d < todayDay ? "past" : "";
            return <span key={d} className={`day ${cls} ${eventDays.has(d) ? "event" : ""}`} style={{ "--i": i } as React.CSSProperties} />;
          })}
        </div>
        <div className="runway-marks" aria-hidden>
          {events.map((e, i) => (
            <span
              key={i}
              className={`mark ${e.kind === "statement" ? "statement" : e.kind === "fixed" ? `fixed ${BG[e.tone]}` : BG[e.tone]}`}
              style={{ left: pos(e.date) }}
            />
          ))}
        </div>
      </Link>

      <div className="flex items-baseline justify-between gap-3 text-xs text-muted">
        <span className="num">1</span>
        {next ? (
          <span className="min-w-0 truncate text-center">
            Next: <span className="text-text">{next.label}</span>
            {next.amount !== undefined && <span className="num"> {lkr(next.amount)}</span>} on {shortDate(next.date)}
          </span>
        ) : (
          <span className="text-center">{events.length ? "Nothing left to pay this month" : "No bills or fixed payments dated this month"}</span>
        )}
        <span className="num">{n}</span>
      </div>

      {events.length > 0 && (
        <ul className="sr-only">
          {events.map((e, i) => (
            <li key={i}>
              {e.kind === "statement"
                ? `${e.label}, ${shortDate(e.date)}`
                : `${e.label}, ${lkr(e.amount)}, ${shortDate(e.date)}, ${e.done ? "paid" : e.tone === "out" ? "overdue" : "not paid yet"}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
