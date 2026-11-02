import type { DB } from "@/lib/data";
import { toPlan } from "@/lib/data";
import { addDays, dayIn, daysBetween, monthsBetween, round2, shiftMonth } from "@/lib/format";
import type { Account, InstalmentPlan, Statement } from "@/lib/types";

// ------------------------------------------------------------------ instalments

/** How many instalments of the plan have been billed by the statement in month `ym` ("YYYY-MM"). */
export function billedCount(p: InstalmentPlan, ym: string): number {
  const n = monthsBetween(p.first_billing_month.slice(0, 7), ym) + 1;
  return Math.max(0, Math.min(p.months, n));
}

/**
 * The part of the plan the bank holds against the card but hasn't billed yet,
 * after the statement in month `ym`. The last instalment absorbs rounding.
 */
export function unbilled(p: InstalmentPlan, ym: string): number {
  const b = billedCount(p, ym);
  return b >= p.months ? 0 : Math.max(0, round2(p.total_price - b * p.monthly_amount));
}

/** The amount this plan adds to the statement in month `ym`. */
export function billedThisMonth(p: InstalmentPlan, ym: string): number {
  const b = billedCount(p, ym);
  if (b === 0 || monthsBetween(p.first_billing_month.slice(0, 7), ym) >= p.months) return 0;
  return b === p.months ? round2(p.total_price - (p.months - 1) * p.monthly_amount) : p.monthly_amount;
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
  instalments: number; // instalment amount billed on this statement
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
  const [txRes, stRes, plRes] = await Promise.all([txQ, stQ, plQ]);
  if (txRes.error) throw new Error(txRes.error.message);
  if (stRes.error) throw new Error(stRes.error.message);

  const txns = ((txRes.data ?? []) as Mini[]).map((t) => ({ ...t, amount: Number(t.amount) }));
  const plans = (plRes.data ?? []).map(toPlan);
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
