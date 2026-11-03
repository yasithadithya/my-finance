import { createClient } from "@/lib/supabase/server";
import type { Account, InstalmentPlan } from "@/lib/types";

export type DB = Awaited<ReturnType<typeof createClient>>;

/**
 * All accounts with their calculated balance, in display order.
 * `uid` is only needed with the admin client (cron), which skips row-level security.
 */
export async function loadAccounts(supabase: DB, opts: { includeArchived?: boolean; uid?: string } = {}): Promise<Account[]> {
  let q = supabase.from("account_balances").select("*").order("sort_order").order("name");
  if (!opts.includeArchived) q = q.eq("archived", false);
  if (opts.uid) q = q.eq("user_id", opts.uid);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((a) => ({
    ...a,
    opening_balance: Number(a.opening_balance),
    credit_limit: a.credit_limit === null ? null : Number(a.credit_limit),
    interest_rate: a.interest_rate === null ? null : Number(a.interest_rate),
    balance: Number(a.balance),
  })) as Account[];
}

export async function getAccounts(opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
  return loadAccounts(await createClient(), opts);
}

export function toPlan(p: Record<string, unknown>): InstalmentPlan {
  return {
    ...(p as unknown as InstalmentPlan),
    total_price: Number(p.total_price),
    monthly_amount: Number(p.monthly_amount),
    months: Number(p.months),
    interest_rate: Number(p.interest_rate ?? 0),
    purchase_txn_id: (p.purchase_txn_id as string | null) ?? null,
  };
}

export async function loadPlans(supabase: DB, uid?: string): Promise<InstalmentPlan[]> {
  let q = supabase.from("instalment_plans").select("*").order("first_billing_month");
  if (uid) q = q.eq("user_id", uid);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(toPlan);
}
