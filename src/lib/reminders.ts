import type { DB } from "@/lib/data";
import { daysBetween, dayIn, lkr, monthRange, relDays, shortDate } from "@/lib/format";
import type { RecurringItem, RecurringMark, Receivable, ReceivableStatus } from "@/lib/types";
import type { StatementView } from "@/lib/statements";

// ------------------------------------------------------------------ fixed payments for a month

export interface ChecklistItem extends RecurringItem {
  mark: RecurringMark | null;
}

/** Active fixed payments for month "YYYY-MM", each with its D tick (if any). */
export async function loadChecklist(supabase: DB, ym: string, uid?: string): Promise<ChecklistItem[]> {
  const { start } = monthRange(ym);
  let iq = supabase.from("recurring_items").select("*").eq("active", true).order("sort_order").order("name");
  let mq = supabase.from("recurring_marks").select("*").eq("month", start);
  if (uid) {
    iq = iq.eq("user_id", uid);
    mq = mq.eq("user_id", uid);
  }
  const [items, marks] = await Promise.all([iq, mq]);
  if (items.error) throw new Error(items.error.message);
  const byItem = new Map(((marks.data ?? []) as RecurringMark[]).map((m) => [m.recurring_item_id, m]));
  return ((items.data ?? []) as RecurringItem[])
    .filter((i) => !i.end_month || i.end_month >= start)
    .map((i) => ({ ...i, amount: Number(i.amount), mark: byItem.get(i.id) ?? null }));
}

// ------------------------------------------------------------------ money owed to me

export interface ReceivableView extends Receivable {
  received: number;
  outstanding: number;
  shown_status: ReceivableStatus;
}

export async function loadReceivables(supabase: DB, uid?: string): Promise<ReceivableView[]> {
  let rq = supabase.from("receivables").select("*").order("created_at");
  let tq = supabase.from("transactions").select("receivable_id,amount").not("receivable_id", "is", null);
  if (uid) {
    rq = rq.eq("user_id", uid);
    tq = tq.eq("user_id", uid);
  }
  const [r, t] = await Promise.all([rq, tq]);
  if (r.error) throw new Error(r.error.message);
  const got = new Map<string, number>();
  for (const x of (t.data ?? []) as { receivable_id: string; amount: number }[]) {
    got.set(x.receivable_id, (got.get(x.receivable_id) ?? 0) + Number(x.amount));
  }
  return ((r.data ?? []) as Receivable[]).map((x) => {
    const amount = Number(x.amount);
    const received = got.get(x.id) ?? 0;
    const outstanding = Math.max(0, Math.round((amount - received) * 100) / 100);
    const shown_status: ReceivableStatus =
      outstanding <= 0 ? "paid" : received > 0 ? "partly_paid" : x.status === "paid" || x.status === "partly_paid" ? "waiting" : x.status;
    return { ...x, amount, received, outstanding, shown_status };
  });
}

// ------------------------------------------------------------------ reminders

export interface Reminder {
  key: string;
  tone: "out" | "warn" | "info";
  title: string;
  body: string;
  href: string;
  /** Worth a push notification today (not just a banner). */
  push: boolean;
}

/** Everything that needs attention today, most urgent first. */
export function buildReminders(
  today: string,
  statements: StatementView[],
  checklist: ChecklistItem[],
  receivables: ReceivableView[],
): Reminder[] {
  const out: Reminder[] = [];

  // Card bills: overdue, due within a week, or a statement just came out.
  for (const s of statements) {
    if (s.status === "paid") continue;
    const age = daysBetween(s.statement_date, today);
    if (s.days_left < 0) {
      out.push({
        key: `stmt-${s.id}`,
        tone: "out",
        title: `${s.card_name} bill is overdue`,
        body: `${lkr(s.remaining)} was due ${shortDate(s.due_date)}.`,
        href: "/pay",
        push: true,
      });
    } else if (s.days_left <= 7) {
      out.push({
        key: `stmt-${s.id}`,
        tone: "warn",
        title: `${s.card_name}: ${lkr(s.remaining)} due ${relDays(s.days_left)}`,
        body: `Statement of ${shortDate(s.statement_date)} · due ${shortDate(s.due_date)}.`,
        href: "/pay",
        push: [7, 3, 1, 0].includes(s.days_left),
      });
    } else if (age >= 0 && age <= 2) {
      out.push({
        key: `stmt-${s.id}`,
        tone: "info",
        title: `New ${s.card_name} statement: ${lkr(s.statement_balance)}`,
        body: `Due ${shortDate(s.due_date)}.`,
        href: "/pay",
        push: age === 0,
      });
    }
  }

  // Fixed payments not ticked yet, due within 3 days or already past.
  const ym = today.slice(0, 7);
  const pending = checklist.filter((i) => !i.mark && i.due_day && daysBetween(today, dayIn(ym, i.due_day)) <= 3);
  if (pending.length) {
    const late = pending.some((i) => dayIn(ym, i.due_day!) < today);
    const total = pending.reduce((s, i) => s + i.amount, 0);
    out.push({
      key: `fixed-${ym}`,
      tone: late ? "out" : "warn",
      title: `${pending.length} fixed payment${pending.length > 1 ? "s" : ""} to pay`,
      body: `${pending.map((i) => i.name).join(", ")} · ${lkr(total)}`,
      href: "/pay",
      push: true,
    });
  }

  // Money owed to me past its expected date.
  for (const r of receivables) {
    if (r.outstanding <= 0 || !r.expected_date || r.expected_date > today) continue;
    const late = daysBetween(r.expected_date, today);
    out.push({
      key: `recv-${r.id}`,
      tone: "info",
      title: `Follow up with ${r.who}`,
      body: `${lkr(r.outstanding)}${r.description ? ` for ${r.description}` : ""} was expected ${shortDate(r.expected_date)}.`,
      href: `/owed/${r.id}`,
      push: late % 7 === 0,
    });
  }

  const rank = { out: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}
