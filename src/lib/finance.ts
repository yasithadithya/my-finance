import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account } from "@/lib/types";
import { cardStatus, type CardStatus, type LedgerTxn, type PlanInput, type StoredStatement } from "@/lib/cards";
import { currentMonth, todayColombo } from "@/lib/format";

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  pay_from_account_id: string | null;
  due_day: number | null;
  active: boolean;
  sort_order: number;
}
export interface RecurringMark {
  id: string;
  recurring_item_id: string;
  month: string;
  transaction_id: string | null;
}

const n = (v: unknown) => Number(v ?? 0);

export function normaliseAccount(a: Record<string, unknown>): Account {
  return {
    ...(a as unknown as Account),
    opening_balance: n(a.opening_balance),
    credit_limit: a.credit_limit === null ? null : n(a.credit_limit),
    balance: n(a.balance),
  };
}

/** Accounts + credit card statement status for every card. Works with any Supabase client. */
export async function loadCards(supabase: SupabaseClient, today = todayColombo()) {
  const [accRes, planRes, stmtRes] = await Promise.all([
    supabase.from("account_balances").select("*").eq("archived", false).order("sort_order").order("name"),
    supabase.from("instalment_plans").select("*").order("created_at"),
    supabase.from("cc_statements").select("account_id, statement_date, statement_balance"),
  ]);
  if (accRes.error) throw new Error(accRes.error.message);
  const accounts = (accRes.data ?? []).map(normaliseAccount);
  const cards = accounts.filter((a) => a.type === "credit_card");
  const plans: PlanInput[] = (planRes.data ?? []).map((p) => ({
    ...p,
    total_price: n(p.total_price),
    monthly_amount: n(p.monthly_amount),
    months: n(p.months),
  }));
  const stored: StoredStatement[] = (stmtRes.data ?? []).map((s) => ({ ...s, statement_balance: n(s.statement_balance) }));

  let txns: LedgerTxn[] = [];
  if (cards.length) {
    const ids = cards.map((c) => c.id).join(",");
    const { data } = await supabase
      .from("transactions")
      .select("date, amount, from_account_id, to_account_id")
      .or(`from_account_id.in.(${ids}),to_account_id.in.(${ids})`);
    txns = (data ?? []).map((t) => ({ ...t, amount: n(t.amount) }));
  }

  const statuses: CardStatus[] = cards.map((c) =>
    cardStatus(
      {
        id: c.id, name: c.name, opening_balance: c.opening_balance, opening_date: c.opening_date,
        credit_limit: c.credit_limit, billing_day: c.billing_day, due_day: c.due_day, balance: c.balance!,
      },
      txns, plans, stored, today,
    ),
  );
  return { accounts, statuses, plans };
}

/** Fixed payments and which are ticked (D) for the given cycle. */
export async function loadRecurring(supabase: SupabaseClient, cycle = currentMonth()) {
  const [itemsRes, marksRes] = await Promise.all([
    supabase.from("recurring_items").select("*").order("sort_order").order("name"),
    supabase.from("recurring_marks").select("*").eq("month", `${cycle}-01`),
  ]);
  const items: RecurringItem[] = (itemsRes.data ?? []).map((i) => ({ ...i, amount: n(i.amount) }));
  const marks: RecurringMark[] = marksRes.data ?? [];
  return { items, marks };
}
