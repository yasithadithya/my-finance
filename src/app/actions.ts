"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { addDays, dayIn, monthRange, round2, shiftMonth, todayColombo } from "@/lib/format";
import { sendToSubscriptions, type PushSub } from "@/lib/push";
import type { AccountType, TxnKind } from "@/lib/types";

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
  redirect(`/transactions?month=${parsed.row.date.slice(0, 7)}`);
}

export async function deleteTxn(fd: FormData) {
  const id = str(fd, "id");
  const month = str(fd, "month");
  const supabase = await createClient();
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
      interest_rate: ["fd", "credit_card", "loan", "savings"].includes(type) ? money(fd, "interest_rate") : null,
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

const isYm = (v: string | null): v is string => !!v && /^\d{4}-\d{2}$/.test(v);
const isDate = (v: string | null): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

// ------------------------------------------------------------------ fixed payments (the D tick)

/** Tick a fixed payment for a month. Records the expense unless account is "none". */
export async function tickRecurring(fd: FormData) {
  const itemId = str(fd, "item_id");
  const ym = str(fd, "month");
  const account = str(fd, "account_id");
  const amount = money(fd, "amount");
  const date = str(fd, "date") ?? todayColombo();
  if (!itemId || !isYm(ym) || !account) return;
  const supabase = await createClient();

  let txnId: string | null = null;
  if (account !== "none") {
    if (!amount || Number.isNaN(amount) || amount <= 0) return;
    const { data: item } = await supabase.from("recurring_items").select("name").eq("id", itemId).maybeSingle();
    const { data, error } = await supabase
      .from("transactions")
      .insert({ kind: "expense", amount, date, from_account_id: account, recurring_item_id: itemId, note: item?.name ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    txnId = data.id;
  }
  const { error } = await supabase
    .from("recurring_marks")
    .upsert({ recurring_item_id: itemId, month: monthRange(ym).start, transaction_id: txnId }, { onConflict: "recurring_item_id,month" });
  if (error) throw new Error(error.message);
  revalidateAll();
  redirect(`/pay?month=${ym}`);
}

/** Undo a D tick, and delete the expense it recorded. */
export async function untickRecurring(fd: FormData) {
  const markId = str(fd, "mark_id");
  const ym = str(fd, "month");
  const supabase = await createClient();
  const { data: mark } = await supabase.from("recurring_marks").select("transaction_id").eq("id", markId!).maybeSingle();
  await supabase.from("recurring_marks").delete().eq("id", markId!);
  if (mark?.transaction_id) await supabase.from("transactions").delete().eq("id", mark.transaction_id);
  revalidateAll();
  redirect(isYm(ym) ? `/pay?month=${ym}` : "/pay");
}

export async function saveRecurringItem(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const name = str(fd, "name");
  const amount = money(fd, "amount");
  const due = int(fd, "due_day");
  const end = str(fd, "end_month");
  if (!name) return { error: "Give it a name." };
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  if (due !== null && (Number.isNaN(due) || due < 1 || due > 31)) return { error: "Due day must be 1–31." };
  if (end && !isYm(end)) return { error: "Last month must look like 2027-03." };
  const row = {
    name,
    amount,
    due_day: due,
    pay_from_account_id: str(fd, "pay_from_account_id"),
    end_month: end ? monthRange(end).start : null,
    active: fd.get("active") === "on",
    sort_order: int(fd, "sort_order") ?? 0,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("recurring_items").update(row).eq("id", id)
    : await supabase.from("recurring_items").insert(row);
  if (error) return { error: error.message };
  revalidateAll();
  redirect("/pay/items");
}

export async function deleteRecurringItem(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("recurring_items").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect("/pay/items");
}

// ------------------------------------------------------------------ card statements

/** Pay a card bill: a transfer from a bank account into the card. */
export async function payStatement(fd: FormData) {
  const card = str(fd, "card_id");
  const from = str(fd, "from_account_id");
  const amount = money(fd, "amount");
  const date = str(fd, "date") ?? todayColombo();
  const back = str(fd, "back") ?? "/pay";
  if (!card || !from || !amount || Number.isNaN(amount) || amount <= 0 || card === from) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .insert({ kind: "transfer", amount, date, from_account_id: from, to_account_id: card, note: str(fd, "note") ?? "Card bill" });
  if (error) throw new Error(error.message);
  revalidateAll();
  redirect(back);
}

/** Add a statement by hand (e.g. one from before the app), or correct an auto one. */
export async function saveStatement(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const account = str(fd, "account_id");
  const sd = str(fd, "statement_date");
  const due = str(fd, "due_date");
  const amount = money(fd, "statement_balance");
  if (!account) return { error: "Missing card." };
  if (!isDate(sd) || !isDate(due)) return { error: "Pick the statement date and the due date." };
  if (due < sd) return { error: "The due date must be after the statement date." };
  if (amount === null || Number.isNaN(amount) || amount < 0) return { error: "Enter the amount due (0 or more)." };
  const row = {
    account_id: account,
    statement_date: sd,
    period_start: addDays(dayIn(shiftMonth(sd.slice(0, 7), -1), Number(sd.slice(8))), 1),
    period_end: sd,
    statement_balance: amount,
    due_date: due,
    source: "edited" as const,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("cc_statements").update(row).eq("id", id)
    : await supabase.from("cc_statements").upsert(row, { onConflict: "account_id,statement_date" });
  if (error) return { error: error.message };
  revalidateAll();
  redirect(`/accounts/${account}`);
}

export async function deleteStatement(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("cc_statements").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect(`/accounts/${str(fd, "account_id")}`);
}

// ------------------------------------------------------------------ instalment plans

export async function savePlan(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const card = str(fd, "card_account_id");
  const name = str(fd, "name");
  const total = money(fd, "total_price");
  const months = int(fd, "months");
  let monthly = money(fd, "monthly_amount");
  const first = str(fd, "first_billing_month");
  if (!card) return { error: "Missing card." };
  if (!name) return { error: "Give the plan a name." };
  if (total === null || Number.isNaN(total) || total <= 0) return { error: "Enter the total price." };
  if (months === null || Number.isNaN(months) || months < 1) return { error: "Enter the number of months." };
  if (!isYm(first)) return { error: "Pick the month of the first instalment." };
  if (monthly === null) monthly = round2(total / months);
  if (Number.isNaN(monthly) || monthly <= 0) return { error: "Monthly amount must be above 0." };
  const row = {
    card_account_id: card,
    name,
    total_price: total,
    months,
    monthly_amount: monthly,
    first_billing_month: monthRange(first).start,
    interest_rate: money(fd, "interest_rate") ?? 0,
  };
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("instalment_plans").update(row).eq("id", id)
    : await supabase.from("instalment_plans").insert(row);
  if (error) return { error: error.message };
  revalidateAll();
  redirect(`/accounts/${card}`);
}

export async function deletePlan(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("instalment_plans").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect(`/accounts/${str(fd, "card_account_id")}`);
}

// ------------------------------------------------------------------ money owed to me

export async function saveReceivable(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "id");
  const who = str(fd, "who");
  const amount = money(fd, "amount");
  const status = str(fd, "status");
  const expected = str(fd, "expected_date");
  if (!who) return { error: "Who owes you?" };
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  if (status && !["waiting", "quoted", "partly_paid", "paid"].includes(status)) return { error: "Unknown status." };
  const row = {
    who,
    description: str(fd, "description"),
    amount,
    status: status ?? "waiting",
    expected_date: isDate(expected) ? expected : null,
  };
  const supabase = await createClient();
  const res = id
    ? await supabase.from("receivables").update(row).eq("id", id).select("id").single()
    : await supabase.from("receivables").insert(row).select("id").single();
  if (res.error) return { error: res.error.message };
  revalidateAll();
  redirect(`/owed/${res.data.id}`);
}

export async function deleteReceivable(fd: FormData) {
  const supabase = await createClient();
  await supabase.from("receivables").delete().eq("id", str(fd, "id")!);
  revalidateAll();
  redirect("/owed");
}

/** Record money received against something owed to me (an income transaction). */
export async function receivePayment(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "receivable_id");
  const to = str(fd, "to_account_id");
  const amount = money(fd, "amount");
  const date = str(fd, "date");
  if (!id) return { error: "Missing item." };
  if (!to) return { error: "Pick the account the money went into." };
  if (amount === null || Number.isNaN(amount) || amount <= 0) return { error: "Enter an amount above 0." };
  if (!isDate(date)) return { error: "Pick a date." };
  const supabase = await createClient();
  const { data: r } = await supabase.from("receivables").select("who,description,amount").eq("id", id).maybeSingle();
  if (!r) return { error: "Item not found." };

  const { error } = await supabase.from("transactions").insert({
    kind: "income",
    amount,
    date,
    to_account_id: to,
    receivable_id: id,
    note: r.description ? `${r.who} — ${r.description}` : r.who,
  });
  if (error) return { error: error.message };

  const { data: got } = await supabase.from("transactions").select("amount").eq("receivable_id", id);
  const received = (got ?? []).reduce((s, t) => s + Number(t.amount), 0);
  await supabase
    .from("receivables")
    .update({ status: received >= Number(r.amount) - 0.005 ? "paid" : "partly_paid" })
    .eq("id", id);
  revalidateAll();
  redirect(`/owed/${id}`);
}

// ------------------------------------------------------------------ reconcile

/**
 * Compare what the bank says with what the app works out. Any difference is
 * booked as an adjustment so the balance matches again.
 */
export async function reconcile(_: FormState, fd: FormData): Promise<FormState> {
  const id = str(fd, "account_id");
  const actualIn = money(fd, "actual_balance");
  const available = money(fd, "available_credit");
  if (!id) return { error: "Missing account." };
  const supabase = await createClient();
  const { data: acc } = await supabase.from("account_balances").select("balance,credit_limit,type").eq("id", id).maybeSingle();
  if (!acc) return { error: "Account not found." };

  let actual = actualIn;
  if (acc.type === "credit_card" && available !== null) {
    if (Number.isNaN(available)) return { error: "Available credit must be a number." };
    if (acc.credit_limit === null) return { error: "Set the card's limit first, or enter the balance instead." };
    actual = round2(-(Number(acc.credit_limit) - available));
  }
  if (actual === null || Number.isNaN(actual)) return { error: "Enter the balance your bank shows." };

  const computed = round2(Number(acc.balance));
  const diff = round2(actual - computed);
  let adjustmentId: string | null = null;
  if (Math.abs(diff) >= 0.01) {
    const { data, error } = await supabase
      .from("transactions")
      .insert({
        kind: "adjustment",
        amount: Math.abs(diff),
        date: todayColombo(),
        from_account_id: diff < 0 ? id : null,
        to_account_id: diff > 0 ? id : null,
        note: "Reconcile",
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    adjustmentId = data.id;
  }
  const { error } = await supabase
    .from("reconciliations")
    .insert({ account_id: id, actual_balance: actual, computed_balance: computed, adjustment_txn_id: adjustmentId });
  if (error) return { error: error.message };
  revalidateAll();
  redirect(`/accounts/${id}?reconciled=1`);
}

// ------------------------------------------------------------------ push notifications

export async function savePushSubscription(sub: PushSub): Promise<{ error?: string }> {
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Bad subscription." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth }, { onConflict: "endpoint" });
  return error ? { error: error.message } : {};
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}

export async function sendTestPush(): Promise<{ error?: string; sent?: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("push_subscriptions").select("endpoint,p256dh,auth");
  if (error) return { error: error.message };
  if (!data?.length) return { error: "No device is subscribed yet." };
  try {
    const { sent, gone } = await sendToSubscriptions(data, { title: "My Expenses", body: "Notifications are working.", url: "/" });
    if (gone.length) await supabase.from("push_subscriptions").delete().in("endpoint", gone);
    return { sent };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Sending failed." };
  }
}
