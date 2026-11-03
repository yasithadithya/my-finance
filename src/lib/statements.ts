import type { DB } from "@/lib/data";
import { toPlan } from "@/lib/data";
import { addDays, dayIn, daysBetween, monthsBetween, round2, shiftMonth } from "@/lib/format";
import type { Account, InstalmentMark, InstalmentPlan, Statement } from "@/lib/types";

// ------------------------------------------------------------------ instalments

// The purchase price (principal) is already part of the card's debt, so a plan
// never adds debt for it. Interest is different: the bank charges it month by
// month, so the app books each month's interest on the card on statement day.

export const hasInterest = (p: InstalmentPlan) => p.interest_rate > 0;

/** Principal billed each month. On a 0% plan this is the instalment itself. */
const principalEach = (p: InstalmentPlan) => (hasInterest(p) ? round2(p.total_price / p.months) : p.monthly_amount);

/** Which instalment (1…months) is on the statement in month `ym` ("YYYY-MM"), or 0 if none. */
export function instalmentNo(p: InstalmentPlan, ym: string): number {
  const n = monthsBetween(p.first_billing_month.slice(0, 7), ym) + 1;
  return n >= 1 && n <= p.months ? n : 0;
}

/** How many instalments of the plan have been billed by the statement in month `ym`. */
export function billedCount(p: InstalmentPlan, ym: string): number {
  const n = monthsBetween(p.first_billing_month.slice(0, 7), ym) + 1;
  return Math.max(0, Math.min(p.months, n));
}

/**
 * The principal the bank holds against the card but hasn't billed yet, after
 * the statement in month `ym`. The last instalment absorbs rounding.
 */
export function unbilled(p: InstalmentPlan, ym: string): number {
  const b = billedCount(p, ym);
  return b >= p.months ? 0 : Math.max(0, round2(p.total_price - b * principalEach(p)));
}

function principalThisMonth(p: InstalmentPlan, ym: string): number {
  const n = instalmentNo(p, ym);
  if (!n) return 0;
  return n === p.months ? round2(p.total_price - (p.months - 1) * principalEach(p)) : principalEach(p);
}

/** Interest charged with the instalment in month `ym` (0 on interest-free plans). */
export function interestThisMonth(p: InstalmentPlan, ym: string): number {
  if (!hasInterest(p) || !instalmentNo(p, ym)) return 0;
  return Math.max(0, round2(p.monthly_amount - principalThisMonth(p, ym)));
}

/** The full instalment (principal + interest) on the statement in month `ym`. */
export function billedThisMonth(p: InstalmentPlan, ym: string): number {
  return round2(principalThisMonth(p, ym) + interestThisMonth(p, ym));
}

/** Everything still to pay on the plan after the statement in month `ym`, interest included. */
export function leftToPay(p: InstalmentPlan, ym: string): number {
  const b = billedCount(p, ym);
  return hasInterest(p) ? round2((p.months - b) * p.monthly_amount) : unbilled(p, ym);
}

/** What the whole plan costs: the price, plus interest if any. */
export function totalPayable(p: InstalmentPlan): number {
  return hasInterest(p) ? round2(p.months * p.monthly_amount) : p.total_price;
}

/** Sum of all instalments billed on statements in month `ym`. */
export function instalmentsInMonth(plans: InstalmentPlan[], ym: string): number {
  return round2(plans.reduce((s, p) => s + billedThisMonth(p, ym), 0));
}

/** Fixed monthly instalment for `principal` over `months` at `rate` % a year (reducing balance). */
export function monthlyWithInterest(principal: number, months: number, rate: number): number {
  const r = rate / 1200;
  if (r <= 0) return round2(principal / months);
  return round2((principal * r) / (1 - Math.pow(1 + r, -months)));
}

/** First statement a purchase on `date` lands on, for a card that bills on `billingDay`. */
export function firstStatementMonth(date: string, billingDay: number | null): string {
  const ym = date.slice(0, 7);
  return billingDay && Number(date.slice(8, 10)) > billingDay ? shiftMonth(ym, 1) : ym;
}

// ------------------------------------------------------------------ instalments to pay in a month

export interface InstalmentDue {
  plan: InstalmentPlan;
  card: Account;
  no: number; // 1…months
  amount: number;
  statement_date: string;
  due_date: string | null;
  /** The card bill this instalment is part of, once the statement exists. */
  bill?: StatementView;
  /** Ticked as paid on the Pay tab. */
  mark?: InstalmentMark;
}

/** Paid if ticked, or if the whole card bill it's on has been paid. */
export const instalmentPaid = (i: InstalmentDue) => !!i.mark || i.bill?.status === "paid";

/** Statement months whose instalments can be due in month `ym`. */
export const dueStatementMonths = (ym: string) => [shiftMonth(ym, -1), ym];

/**
 * Instalments whose card bill is due in month `ym`. A statement in one month is
 * usually due early the next, so this looks at last month's and this month's statements.
 */
export function instalmentsDueIn(
  ym: string,
  plans: InstalmentPlan[],
  cards: Account[],
  bills: StatementView[],
  marks: InstalmentMark[] = [],
): InstalmentDue[] {
  const { start, end } = { start: `${ym}-01`, end: `${shiftMonth(ym, 1)}-01` };
  const out: InstalmentDue[] = [];
  for (const p of plans) {
    const card = cards.find((c) => c.id === p.card_account_id);
    if (!card) continue;
    for (const sm of dueStatementMonths(ym)) {
      const no = instalmentNo(p, sm);
      if (!no) continue;
      const known = card.billing_day && card.due_day;
      const sd = dayIn(sm, card.billing_day ?? 1);
      const due = known ? dueDateFor(sd, card.billing_day!, card.due_day!) : null;
      // Without statement/due days we can't place it; show it in its statement month.
      if (due ? due < start || due >= end : sm !== ym) continue;
      out.push({
        plan: p,
        card,
        no,
        amount: billedThisMonth(p, sm),
        statement_date: sd,
        due_date: due,
        bill: bills.find((b) => b.account_id === card.id && b.statement_date === sd),
        mark: marks.find((m) => m.plan_id === p.id && m.month.slice(0, 7) === sm),
      });
    }
  }
  return out.sort((a, b) => (a.due_date ?? a.statement_date).localeCompare(b.due_date ?? b.statement_date));
}

// ------------------------------------------------------------------ interest charges

type Charge = { id: string; date: string; amount: number; from_account_id: string; instalment_plan_id: string; note: string | null };

/**
 * Books the interest of plans with interest as card expenses on each statement
 * day that has passed, and removes charges that no longer fit the plan (after
 * an edit). Returns how much each card's balance changed.
 */
async function syncInterest(supabase: DB, cards: Account[], plans: InstalmentPlan[], today: string, uid?: string) {
  const delta = new Map<string, number>();
  if (!plans.length) return delta;
  let q = supabase
    .from("transactions")
    .select("id,date,amount,from_account_id,instalment_plan_id,note")
    .in("instalment_plan_id", plans.map((p) => p.id));
  if (uid) q = q.eq("user_id", uid);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const existing = ((data ?? []) as Charge[]).map((t) => ({ ...t, amount: Number(t.amount) }));

  const want: { plan: InstalmentPlan; card: Account; date: string; amount: number; note: string }[] = [];
  for (const p of plans) {
    const card = cards.find((c) => c.id === p.card_account_id);
    if (!card?.billing_day || !hasInterest(p)) continue;
    for (let n = 1; n <= p.months; n++) {
      const ym = shiftMonth(p.first_billing_month.slice(0, 7), n - 1);
      const sd = dayIn(ym, card.billing_day);
      if (sd > today) break;
      if (sd < card.opening_date) continue; // already in the opening balance
      const amount = interestThisMonth(p, ym);
      if (amount > 0) want.push({ plan: p, card, date: sd, amount, note: `${p.name} interest (${n}/${p.months})` });
    }
  }

  const bump = (card: string, by: number) => delta.set(card, round2((delta.get(card) ?? 0) + by));
  const inserts: Record<string, unknown>[] = [];
  const updates: PromiseLike<unknown>[] = [];
  const keep = new Set<string>();
  for (const w of want) {
    const t = existing.find((e) => e.instalment_plan_id === w.plan.id && e.date === w.date && !keep.has(e.id));
    if (!t) {
      inserts.push({
        ...(w.card.user_id ? { user_id: w.card.user_id } : {}),
        kind: "expense",
        amount: w.amount,
        date: w.date,
        from_account_id: w.card.id,
        instalment_plan_id: w.plan.id,
        note: w.note,
      });
      bump(w.card.id, -w.amount);
      continue;
    }
    keep.add(t.id);
    if (t.amount !== w.amount || t.from_account_id !== w.card.id || t.note !== w.note) {
      updates.push(supabase.from("transactions").update({ amount: w.amount, from_account_id: w.card.id, note: w.note }).eq("id", t.id));
      bump(t.from_account_id, t.amount);
      bump(w.card.id, -w.amount);
    }
  }
  const stale = existing.filter((e) => !keep.has(e.id));
  for (const s of stale) bump(s.from_account_id, s.amount);

  if (inserts.length) {
    const { error: e } = await supabase.from("transactions").insert(inserts);
    if (e) throw new Error(e.message);
  }
  if (stale.length) updates.push(supabase.from("transactions").delete().in("id", stale.map((s) => s.id)));
  await Promise.all(updates);
  return delta;
}

// ------------------------------------------------------------------ dates

/** Due date for a statement made on `sd`: the next `due_day` after the statement day. */
export function dueDateFor(sd: string, billingDay: number, dueDay: number): string {
  const ym = sd.slice(0, 7);
  return dueDay > billingDay ? dayIn(ym, dueDay) : dayIn(shiftMonth(ym, 1), dueDay);
}

/** Statement dates for a card from its opening date up to today. */
function statementDates(card: Account, today: string): string[] {
  const out: string[] = [];
  for (let ym = card.opening_date.slice(0, 7); ym <= today.slice(0, 7); ym = shiftMonth(ym, 1)) {
    const sd = dayIn(ym, card.billing_day!);
    if (sd >= card.opening_date && sd <= today) out.push(sd);
  }
  return out;
}

// ------------------------------------------------------------------ the main entry

type Mini = { date: string; amount: number; from_account_id: string | null; to_account_id: string | null };

export interface StatementView extends Statement {
  card_name: string;
  paid: number;
  remaining: number;
  status: "paid" | "due" | "overdue";
  days_left: number; // until due date (negative = overdue)
  instalments: number; // instalment amount (with interest) billed on this statement
}

/**
 * Makes sure every card has a statement for each billing day that has passed,
 * keeps "auto" statements in step with the ledger, and works out how much of
 * each one has been paid.
 *
 * Statement amount = what you owed at the end of the statement day
 *                  − instalments the bank holds but hasn't billed yet.
 * Paid = money into the card after the statement day, up to the next statement.
 */
export async function ensureStatements(supabase: DB, accounts: Account[], today: string, uid?: string): Promise<StatementView[]> {
  const cards = accounts.filter((a) => a.type === "credit_card" && !a.archived);
  if (!cards.length) return [];
  const ids = cards.map((c) => c.id);
  const list = ids.join(",");

  let txQ = supabase
    .from("transactions")
    .select("date,amount,from_account_id,to_account_id")
    .or(`from_account_id.in.(${list}),to_account_id.in.(${list})`);
  let stQ = supabase.from("cc_statements").select("*").in("account_id", ids).order("statement_date");
  let plQ = supabase.from("instalment_plans").select("*").in("card_account_id", ids);
  if (uid) {
    txQ = txQ.eq("user_id", uid);
    stQ = stQ.eq("user_id", uid);
    plQ = plQ.eq("user_id", uid);
  }
  const [stRes, plRes] = await Promise.all([stQ, plQ]);
  if (stRes.error) throw new Error(stRes.error.message);
  if (plRes.error) throw new Error(plRes.error.message);
  const plans = (plRes.data ?? []).map(toPlan);

  // Book any instalment interest that's due before reading the ledger, and keep
  // the balances the caller already loaded in step.
  const moved = await syncInterest(supabase, cards, plans, today, uid);
  for (const a of accounts) if (moved.has(a.id) && a.balance !== undefined) a.balance = round2(a.balance + moved.get(a.id)!);

  const txRes = await txQ;
  if (txRes.error) throw new Error(txRes.error.message);
  const txns = ((txRes.data ?? []) as Mini[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  const statements = ((stRes.data ?? []) as Statement[]).map((s) => ({ ...s, statement_balance: Number(s.statement_balance) }));

  const inserts: Omit<Statement, "id">[] = [];
  const updates: { id: string; statement_balance: number; period_start: string; due_date: string }[] = [];

  for (const card of cards) {
    if (!card.billing_day || !card.due_day) continue;
    const cardTx = txns.filter((t) => t.from_account_id === card.id || t.to_account_id === card.id);
    const cardPlans = plans.filter((p) => p.card_account_id === card.id);
    const balanceAt = (date: string) =>
      card.opening_balance +
      cardTx.reduce((s, t) => (t.date > date ? s : s + (t.to_account_id === card.id ? t.amount : -t.amount)), 0);

    const dates = statementDates(card, today);
    dates.forEach((sd, i) => {
      const ym = sd.slice(0, 7);
      const owed = Math.max(0, -balanceAt(sd));
      const held = cardPlans.reduce((s, p) => s + unbilled(p, ym), 0);
      const row = {
        statement_balance: Math.max(0, round2(owed - held)),
        period_start: i === 0 ? card.opening_date : addDays(dates[i - 1], 1),
        due_date: dueDateFor(sd, card.billing_day!, card.due_day!),
      };
      const existing = statements.find((s) => s.account_id === card.id && s.statement_date === sd);
      if (!existing) {
        inserts.push({
          ...row,
          ...(card.user_id ? { user_id: card.user_id } : {}),
          account_id: card.id,
          statement_date: sd,
          period_end: sd,
          source: "auto",
        });
      } else if (
        existing.source === "auto" &&
        (existing.statement_balance !== row.statement_balance || existing.period_start !== row.period_start || existing.due_date !== row.due_date)
      ) {
        updates.push({ id: existing.id, ...row });
        Object.assign(existing, row);
      }
    });
  }

  if (inserts.length) {
    const { data, error } = await supabase
      .from("cc_statements")
      .upsert(inserts, { onConflict: "account_id,statement_date", ignoreDuplicates: true })
      .select("*");
    if (error) throw new Error(error.message);
    for (const s of (data ?? []) as Statement[]) statements.push({ ...s, statement_balance: Number(s.statement_balance) });
  }
  await Promise.all(updates.map(({ id, ...row }) => supabase.from("cc_statements").update(row).eq("id", id)));

  // ---- payments against each statement
  const byCard = new Map(cards.map((c) => [c.id, c]));
  const views: StatementView[] = [];
  for (const card of cards) {
    const mine = statements.filter((s) => s.account_id === card.id).sort((a, b) => a.statement_date.localeCompare(b.statement_date));
    mine.forEach((s, i) => {
      const next = mine[i + 1]?.statement_date ?? "9999-12-31";
      const paid = round2(
        txns
          .filter((t) => t.to_account_id === card.id && t.date > s.statement_date && t.date <= next)
          .reduce((sum, t) => sum + t.amount, 0),
      );
      const remaining = Math.max(0, round2(s.statement_balance - paid));
      const days = daysBetween(today, s.due_date);
      const ym = s.statement_date.slice(0, 7);
      views.push({
        ...s,
        card_name: byCard.get(card.id)!.name,
        paid,
        remaining,
        status: remaining <= 0 ? "paid" : days < 0 ? "overdue" : "due",
        days_left: days,
        instalments: plans.filter((p) => p.card_account_id === card.id).reduce((sum, p) => sum + billedThisMonth(p, ym), 0),
      });
    });
  }
  return views.sort((a, b) => b.statement_date.localeCompare(a.statement_date));
}
