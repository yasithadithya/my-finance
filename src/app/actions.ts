"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AccountType, TxnKind } from "@/lib/types";
import { cycleOf, currentMonth, todayColombo } from "@/lib/format";

export type FormState = { error?: string } | undefined;

const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
};
const money = (fd: FormData, k: string) => {
  const v = str(fd, k);
  if (v === null) return null;
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};
const int = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === null ? null : parseInt(v, 10);
};

// ------------------------------------------------------------------ auth

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: str(fd, "email") ?? "",
    password: (fd.get("password") as string) ?? "",
  });
  if (error) return { error: error.message };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// ------------------------------------------------------------------ transactions

function readTxn(fd: FormData) {
  const kind = str(fd, "kind") as TxnKind | null;
  const amount = money(fd, "amount");
  const from = str(fd, "from_account_id");
  const to = str(fd, "to_account_id");
  const date = str(fd, "date");
  const note = str(fd, "note");

  if (!kind || !["expense", "income", "transfer"].includes(kind)) return { error: "Pick expense, income or transfer." };
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  if (!date) return { error: "Pick a date." };

  const row = {
    kind,
    amount,
    date,
    note,
    from_account_id: kind === "income" ? null : from,
    to_account_id: kind === "expense" ? null : to,
  };
  if (kind !== "income" && !row.from_account_id) return { error: "Pick the account the money comes from." };
  if (kind !== "expense" && !row.to_account_id) return { error: "Pick the account the money goes to." };
  if (kind === "transfer" && row.from_account_id === row.to_account_id) return { error: "From and To can't be the same account." };
  return { row };
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function createTxn(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readTxn(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert(parsed.row);
  if (error) return { error: error.message };
  revalidateAll();
  redirect(fd.get("again") ? "/add?saved=1" : "/");
}

export async function updateTxn(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const parsed = readTxn(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update(parsed.row).eq("id", id!);
  if (error) return { error: error.message };
  revalidateAll();
  redirect(`/transactions?month=${cycleOf(parsed.row.date)}`);
}

export async function deleteTxn(fd: FormData) {
  const id = str(fd, "id");
  const month = str(fd, "month");
  const supabase = await createClient();
  await supabase.from("recurring_marks").delete().eq("transaction_id", id!);
  await supabase.from("transactions").delete().eq("id", id!);
  revalidateAll();
  redirect(month ? `/transactions?month=${month}` : "/transactions");
}

// ------------------------------------------------------------------ accounts

function readAccount(fd: FormData) {
  const name = str(fd, "name");
  const type = str(fd, "type") as AccountType | null;
  if (!name) return { error: "Give the account a name." };
  if (!type) return { error: "Pick an account type." };

  const creditLimit = money(fd, "credit_limit");
  const available = money(fd, "available_credit");
  let opening = money(fd, "opening_balance") ?? 0;
  if ([creditLimit, available, opening].some((v) => Number.isNaN(v))) return { error: "Amounts must be numbers." };

  // For cards: "available credit" is what the bank app shows; owed = limit − available.
  if (type === "credit_card" && available !== null) {
    if (creditLimit === null) return { error: "Enter the credit limit to use available credit." };
    opening = -(creditLimit - available);
  }

  const billing = int(fd, "billing_day");
  const due = int(fd, "due_day");
  for (const d of [billing, due]) if (d !== null && (d < 1 || d > 31)) return { error: "Days must be 1–31." };

  return {
    row: {
      name,
      type,
      institution: str(fd, "institution"),
      opening_balance: opening,
      opening_date: str(fd, "opening_date") ?? undefined,
      credit_limit: type === "credit_card" ? creditLimit : null,
      billing_day: type === "credit_card" ? billing : null,
      due_day: type === "credit_card" ? due : null,
      interest_rate: money(fd, "interest_rate"),
      maturity_date: type === "fd" ? str(fd, "maturity_date") : null,
      archived: fd.get("archived") === "on",
      sort_order: int(fd, "sort_order") ?? 0,
    },
  };
}

export async function createAccount(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = readAccount(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert(parsed.row);
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/accounts");
}

export async function updateAccount(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const parsed = readAccount(fd);
  if ("error" in parsed) return { error: parsed.error };
  const supabase = await createClient();
  const { error } = await supabase.from("accounts").update(parsed.row).eq("id", id!);
  if (error) return { error: error.message };
  revalidateAll();
  redirect(`/accounts/${id}`);
}

// ------------------------------------------------------------------ card statements & instalments

export async function saveStatement(_: FormState, fd: FormData): Promise<FormState> {
  const account_id = str(fd, "account_id");
  const statement_date = str(fd, "statement_date");
  const due_date = str(fd, "due_date");
  const amount = money(fd, "statement_balance");
  if (!account_id || !statement_date || !due_date) return { error: "Missing card or dates." };
  if (amount === null || Number.isNaN(amount) || amount < 0) return { error: "Enter the statement amount (0 or more)." };
  const start = new Date(statement_date + "T00:00:00Z");
  start.setUTCMonth(start.getUTCMonth() - 1);
  start.setUTCDate(start.getUTCDate() + 1);
  const supabase = await createClient();
  const { error } = await supabase.from("cc_statements").upsert(
    {
      account_id,
      statement_date,
      period_start: start.toISOString().slice(0, 10),
      period_end: statement_date,
      statement_balance: amount,
      due_date,
      source: "edited",
    },
    { onConflict: "account_id,statement_date" },
  );
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/cards");
}

export async function clearStatement(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("cc_statements").delete().eq("account_id", str(fd, "account_id")!).eq("statement_date", str(fd, "statement_date")!);
  revalidateAll();
  redirect("/cards");
}

export async function createPlan(_: FormState, fd: FormData): Promise<FormState> {
  const name = str(fd, "name");
  const card = str(fd, "card_account_id");
  const total = money(fd, "total_price");
  const months = int(fd, "months");
  const first = str(fd, "first_billing_month"); // YYYY-MM
  if (!name || !card || !first) return { error: "Fill in name, card and first billing month." };
  if (!total || Number.isNaN(total) || total <= 0 || !months || months <= 0) return { error: "Enter the price and number of months." };
  const monthly = money(fd, "monthly_amount") || Math.round((total / months) * 100) / 100;
  const supabase = await createClient();
  const { error } = await supabase.from("instalment_plans").insert({
    name, card_account_id: card, total_price: total, months, monthly_amount: monthly, first_billing_month: `${first}-01`,
  });
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/cards");
}

export async function deletePlan(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("instalment_plans").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect("/cards");
}

// ------------------------------------------------------------------ fixed payments (the D tick)

export async function toggleRecurring(fd: FormData) {
  const itemId = str(fd, "item_id")!;
  const cycle = str(fd, "cycle") ?? currentMonth();
  const accountId = str(fd, "account_id");
  const month = `${cycle}-01`;
  const supabase = await createClient();

  const { data: mark } = await supabase.from("recurring_marks").select("*").eq("recurring_item_id", itemId).eq("month", month).maybeSingle();
  if (mark) {
    await supabase.from("recurring_marks").delete().eq("id", mark.id);
    if (mark.transaction_id) await supabase.from("transactions").delete().eq("id", mark.transaction_id);
  } else {
    const { data: item } = await supabase.from("recurring_items").select("*").eq("id", itemId).single();
    if (!item) return;
    const from = accountId ?? item.pay_from_account_id;
    let txnId: string | null = null;
    if (from) {
      const { data: txn } = await supabase
        .from("transactions")
        .insert({ kind: "expense", amount: item.amount, from_account_id: from, date: todayColombo(), note: item.name, recurring_item_id: item.id })
        .select("id")
        .single();
      txnId = txn?.id ?? null;
      if (accountId && !item.pay_from_account_id) {
        await supabase.from("recurring_items").update({ pay_from_account_id: accountId }).eq("id", item.id);
      }
    }
    await supabase.from("recurring_marks").insert({ recurring_item_id: itemId, month, transaction_id: txnId });
  }
  revalidateAll();
}

export async function saveRecurringItem(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  const amount = money(fd, "amount");
  if (!name) return { error: "Give it a name." };
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  const row = {
    name,
    amount,
    pay_from_account_id: str(fd, "pay_from_account_id"),
    due_day: int(fd, "due_day"),
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("recurring_items").update(row).eq("id", id)
    : await supabase.from("recurring_items").insert({ ...row, active: true });
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/pay?manage=1");
}

export async function setRecurringActive(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("recurring_items").update({ active: fd.get("active") === "true" }).eq("id", str(fd, "id")!);
  revalidateAll();
}

// ------------------------------------------------------------------ money owed to me

export async function saveReceivable(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const who = str(fd, "who");
  const amount = money(fd, "amount");
  if (!who) return { error: "Who owes you?" };
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  const row = {
    who,
    description: str(fd, "description"),
    amount,
    status: (str(fd, "status") ?? "waiting") as "waiting" | "quoted" | "partly_paid" | "paid",
    expected_date: str(fd, "expected_date"),
  };
  const supabase = await createClient();
  const { error } = id ? await supabase.from("receivables").update(row).eq("id", id) : await supabase.from("receivables").insert(row);
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/receivables");
}

export async function receivePayment(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "receivable_id")!;
  const amount = money(fd, "amount");
  const account = str(fd, "to_account_id");
  const date = str(fd, "date") ?? todayColombo();
  if (!amount || Number.isNaN(amount) || amount <= 0) return { error: "Enter the amount received." };
  if (!account) return { error: "Pick the account it went into." };
  const supabase = await createClient();
  const { data: rec } = await supabase.from("receivables").select("*").eq("id", id).single();
  if (!rec) return { error: "Not found." };
  const { error } = await supabase.from("transactions").insert({
    kind: "income", amount, to_account_id: account, date, note: `${rec.who}${rec.description ? " · " + rec.description : ""}`, receivable_id: id,
  });
  if (error) return { error: error.message };
  const { data: got } = await supabase.from("transactions").select("amount").eq("receivable_id", id);
  const received = (got ?? []).reduce((s, t) => s + Number(t.amount), 0);
  await supabase.from("receivables").update({ status: received >= Number(rec.amount) ? "paid" : "partly_paid" }).eq("id", id);
  revalidateAll();
  redirect("/receivables");
}

export async function deleteReceivable(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("receivables").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect("/receivables");
}

// ------------------------------------------------------------------ reconcile

export async function reconcile(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "account_id")!;
  const mode = str(fd, "mode"); // "balance" | "available"
  const value = money(fd, "value");
  if (value === null || Number.isNaN(value)) return { error: "Enter the number from your bank app." };
  const supabase = await createClient();
  const { data: acc } = await supabase.from("account_balances").select("*").eq("id", id).single();
  if (!acc) return { error: "Account not found." };
  const computed = Number(acc.balance);
  let actual = value;
  if (mode === "available") {
    if (!acc.credit_limit) return { error: "Set the card's credit limit first." };
    actual = -(Number(acc.credit_limit) - value);
  }
  const diff = Math.round((actual - computed) * 100) / 100;
  let adjustment: string | null = null;
  if (diff !== 0) {
    const { data: txn, error } = await supabase
      .from("transactions")
      .insert({
        kind: "adjustment",
        amount: Math.abs(diff),
        to_account_id: diff > 0 ? id : null,
        from_account_id: diff < 0 ? id : null,
        date: todayColombo(),
        note: "Reconcile adjustment",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    adjustment = txn.id;
  }
  await supabase.from("reconciliations").insert({ account_id: id, actual_balance: actual, computed_balance: computed, adjustment_txn_id: adjustment });
  revalidateAll();
  redirect(`/accounts/${id}?reconciled=${diff}`);
}

// ------------------------------------------------------------------ settings

export async function saveSetting(fd: FormData) {
  const key = str(fd, "key")!;
  const raw = str(fd, "value");
  const value = raw !== null && !Number.isNaN(Number(raw)) ? Number(raw) : raw;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  await supabase.from("settings").upsert({ user_id: auth.user!.id, key, value, updated_at: new Date().toISOString() });
  revalidateAll();
}

// ------------------------------------------------------------------ push notifications

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").upsert({ endpoint: sub.endpoint, subscription: sub }, { onConflict: "endpoint" });
  return { ok: !error, error: error?.message };
}

export async function removePushSubscription(endpoint: string) {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function sendTestPush() {
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("subscription");
  const { sendPush } = await import("@/lib/push");
  const results = await Promise.all(
    (data ?? []).map((r) => sendPush(r.subscription, { title: "My Expenses", body: "Notifications are working.", url: "/" })),
  );
  return { sent: results.filter((r) => r.ok).length, total: results.length };
}
