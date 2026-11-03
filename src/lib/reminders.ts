import type { CardStatus } from "@/lib/cards";
import type { RecurringItem, RecurringMark } from "@/lib/finance";
import { lkr, monthRange, currentMonth, daysLeftInMonth } from "@/lib/format";

export interface Reminder {
  key: string;
  level: "info" | "warn" | "danger";
  title: string;
  body: string;
  url: string;
  /** true when this is worth a push notification today (not just a banner) */
  push: boolean;
}

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function buildReminders(
  statuses: CardStatus[],
  recurring: { items: RecurringItem[]; marks: RecurringMark[] },
  today: string,
): Reminder[] {
  const out: Reminder[] = [];

  for (const s of statuses) {
    const name = s.card.name;
    if (s.lastClose && s.statement === null) {
      out.push({
        key: `stmt-missing-${s.card.id}`,
        level: "warn",
        title: `Enter your ${name} statement`,
        body: `The ${fmtDate(s.lastClose)} statement isn't known yet. Add the amount so dues are right.`,
        url: "/cards",
        push: false,
      });
      continue;
    }
    if (s.remainingDue === null || s.dueDate === null || s.daysToDue === null) continue;
    if (s.overdue) {
      out.push({
        key: `overdue-${s.card.id}`,
        level: "danger",
        title: `${name} payment is overdue`,
        body: `${lkr(s.remainingDue)} was due on ${fmtDate(s.dueDate)}. Pay it now to limit interest.`,
        url: "/cards",
        push: true,
      });
    } else if (s.remainingDue > 0) {
      const closedToday = s.lastClose === today || (s.lastClose && dayAfter(s.lastClose) === today);
      out.push({
        key: `due-${s.card.id}`,
        level: s.daysToDue <= 5 ? "warn" : "info",
        title: s.daysToDue === 0 ? `Pay ${name} today` : `Pay ${name} by ${fmtDate(s.dueDate)}`,
        body: `${lkr(s.remainingDue)} left on the ${fmtDate(s.lastClose!)} statement · ${s.daysToDue} day${s.daysToDue === 1 ? "" : "s"} to go.`,
        url: "/cards",
        push: Boolean(closedToday) || s.daysToDue <= 5,
      });
    }
  }

  // Fixed payments not yet ticked this cycle.
  const ticked = new Set(recurring.marks.map((m) => m.recurring_item_id));
  const open = recurring.items.filter((i) => i.active && !ticked.has(i.id));
  if (open.length) {
    const total = open.reduce((s, i) => s + i.amount, 0);
    const cycle = currentMonth();
    const left = daysLeftInMonth(cycle);
    const start = monthRange(cycle).start;
    const nearPayday = left <= 2 || today === start;
    out.push({
      key: "fixed-open",
      level: nearPayday ? "warn" : "info",
      title: `${open.length} fixed payment${open.length === 1 ? "" : "s"} not ticked`,
      body: `${lkr(total)} still to pay this cycle (${open.slice(0, 3).map((i) => i.name).join(", ")}${open.length > 3 ? "…" : ""}).`,
      url: "/pay",
      push: nearPayday,
    });
  }

  const order = { danger: 0, warn: 1, info: 2 };
  return out.sort((a, b) => order[a.level] - order[b.level]);
}

function dayAfter(d: string) {
  const x = new Date(d + "T00:00:00Z");
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}
