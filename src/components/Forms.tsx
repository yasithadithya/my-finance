"use client";

import { useActionState, useState } from "react";
import {
  receivePayment,
  reconcile,
  savePlan,
  saveReceivable,
  saveRecurringItem,
  saveStatement,
} from "@/app/actions";
import type { Account, InstalmentPlan, RecurringItem, Receivable, Statement } from "@/lib/types";

type Opt = Pick<Account, "id" | "name">;

function Err({ state }: { state: { error?: string } | undefined }) {
  return state?.error ? <p className="text-sm text-out">{state.error}</p> : null;
}

// ------------------------------------------------------------------ fixed payment

export function RecurringForm({ initial, accounts }: { initial?: RecurringItem; accounts: Opt[] }) {
  const [state, action, pending] = useActionState(saveRecurringItem, undefined);
  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={initial?.name} placeholder="e.g. Netflix" className="field" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" inputMode="decimal" defaultValue={initial?.amount ?? ""} className="field num" required />
        </div>
        <div>
          <label className="label" htmlFor="due_day">Due day (optional)</label>
          <input id="due_day" name="due_day" inputMode="numeric" defaultValue={initial?.due_day ?? ""} placeholder="1–31" className="field num" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="pay_from">Usually paid with</label>
        <select id="pay_from" name="pay_from_account_id" className="field" defaultValue={initial?.pay_from_account_id ?? ""}>
          <option value="">Ask each time</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <p className="mt-1.5 text-xs text-muted">With an account set, the D tick records the payment in one tap.</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="end_month">Last month (optional)</label>
          <input id="end_month" name="end_month" type="month" defaultValue={initial?.end_month?.slice(0, 7) ?? ""} className="field" />
        </div>
        <div>
          <label className="label" htmlFor="sort_order">Order</label>
          <input id="sort_order" name="sort_order" inputMode="numeric" defaultValue={initial?.sort_order ?? 0} className="field num" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={initial ? initial.active : true} className="h-4 w-4" /> Active
      </label>
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : initial ? "Save" : "Add fixed payment"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ instalment plan

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const toNum = (v: string) => Number(v.replace(/,/g, ""));

export function PlanForm({
  cardId,
  initial,
  thisMonth,
  purchase,
}: {
  cardId: string;
  initial?: InstalmentPlan;
  thisMonth: string;
  /** Converting an existing card purchase: pre-fills the name, price and first statement. */
  purchase?: { id: string; name: string; amount: number; firstMonth: string };
}) {
  const [state, action, pending] = useActionState(savePlan, undefined);
  const [total, setTotal] = useState(String(initial?.total_price ?? purchase?.amount ?? ""));
  const [months, setMonths] = useState(String(initial?.months ?? ""));
  const [rate, setRate] = useState(String(initial?.interest_rate ?? 0));
  const [monthly, setMonthly] = useState(initial ? String(initial.monthly_amount) : "");

  // Preview of what each month will be.
  const p = toNum(total), n = parseInt(months, 10), r = toNum(rate) || 0;
  let each = monthly.trim() ? toNum(monthly) : NaN;
  if (!monthly.trim() && p > 0 && n > 0) each = r > 0 ? (p * (r / 1200)) / (1 - Math.pow(1 + r / 1200, -n)) : p / n;
  const preview = p > 0 && n > 0 && each > 0
    ? `${n} × Rs ${nf.format(each)}${r > 0 ? ` · Rs ${nf.format(Math.max(0, each * n - p))} interest` : " · no interest"}`
    : null;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="card_account_id" value={cardId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      {purchase && <input type="hidden" name="purchase_txn_id" value={purchase.id} />}
      <div>
        <label className="label" htmlFor="plan_name">What you bought</label>
        <input id="plan_name" name="name" defaultValue={initial?.name ?? purchase?.name} placeholder="e.g. Galaxy Buds" className="field" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="total_price">Price</label>
          <input id="total_price" name="total_price" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} className="field num" required />
        </div>
        <div>
          <label className="label" htmlFor="months">Months</label>
          <input id="months" name="months" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="e.g. 6" className="field num" required />
        </div>
        <div>
          <label className="label" htmlFor="interest_rate">Interest (% a year)</label>
          <input id="interest_rate" name="interest_rate" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} className="field num" />
        </div>
        <div>
          <label className="label" htmlFor="monthly_amount">Monthly</label>
          <input id="monthly_amount" name="monthly_amount" inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="auto" className="field num" />
        </div>
      </div>
      <p className="text-xs text-muted">
        0% for interest-free plans. Leave Monthly empty to work it out, or enter the amount your bank quoted.
      </p>
      <div>
        <label className="label" htmlFor="first_billing_month">First billed on the statement of</label>
        <input id="first_billing_month" name="first_billing_month" type="month" defaultValue={initial?.first_billing_month.slice(0, 7) ?? purchase?.firstMonth ?? thisMonth} className="field" required />
      </div>
      {preview && <p className="num rounded-xl bg-surface-2 px-3.5 py-2.5 text-sm">{preview}</p>}
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>
        {pending ? "Saving…" : initial ? "Save plan" : purchase ? "Convert to instalments" : "Add plan"}
      </button>
    </form>
  );
}

// ------------------------------------------------------------------ statement (manual / correction)

export function StatementForm({ cardId, initial, today }: { cardId: string; initial?: Statement; today: string }) {
  const [state, action, pending] = useActionState(saveStatement, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="account_id" value={cardId} />
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="statement_date">Statement date</label>
          <input id="statement_date" name="statement_date" type="date" defaultValue={initial?.statement_date ?? today} className="field" required readOnly={!!initial} />
        </div>
        <div>
          <label className="label" htmlFor="due_date">Due date</label>
          <input id="due_date" name="due_date" type="date" defaultValue={initial?.due_date ?? ""} className="field" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="statement_balance">Amount due</label>
        <input id="statement_balance" name="statement_balance" inputMode="decimal" defaultValue={initial?.statement_balance ?? ""} className="field num" required />
        {!initial && <p className="mt-1.5 text-xs text-muted">For a statement from before you started the app, enter what&apos;s still left to pay.</p>}
      </div>
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : "Save statement"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ money owed to me

export function ReceivableForm({ initial }: { initial?: Receivable }) {
  const [state, action, pending] = useActionState(saveReceivable, undefined);
  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="who">Who</label>
          <input id="who" name="who" defaultValue={initial?.who} className="field" required />
        </div>
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <input id="amount" name="amount" inputMode="decimal" defaultValue={initial?.amount ?? ""} className="field num" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="description">For</label>
        <input id="description" name="description" defaultValue={initial?.description ?? ""} placeholder="e.g. Phase 2" className="field" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="status">Status</label>
          <select id="status" name="status" className="field" defaultValue={initial?.status === "quoted" ? "quoted" : "waiting"}>
            <option value="waiting">Waiting</option>
            <option value="quoted">Quoted (not confirmed)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="expected_date">Expected by</label>
          <input id="expected_date" name="expected_date" type="date" defaultValue={initial?.expected_date ?? ""} className="field" />
        </div>
      </div>
      <p className="text-xs text-muted">Partly paid and paid are set for you when you record money received.</p>
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : initial ? "Save" : "Add"}</button>
    </form>
  );
}

export function ReceiveForm({ id, outstanding, accounts, today }: { id: string; outstanding: number; accounts: Opt[]; today: string }) {
  const [state, action, pending] = useActionState(receivePayment, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="receivable_id" value={id} />
      <div>
        <label className="label" htmlFor="to">Into</label>
        <select id="to" name="to_account_id" className="field" defaultValue={accounts[0]?.id ?? ""} required>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="recv_amount">Amount</label>
          <input id="recv_amount" name="amount" inputMode="decimal" defaultValue={outstanding.toFixed(2)} className="field num" required />
        </div>
        <div>
          <label className="label" htmlFor="recv_date">Date</label>
          <input id="recv_date" name="date" type="date" defaultValue={today} className="field" required />
        </div>
      </div>
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : "Record money received"}</button>
    </form>
  );
}

// ------------------------------------------------------------------ reconcile

export function ReconcileForm({ account }: { account: Account }) {
  const [state, action, pending] = useActionState(reconcile, undefined);
  const isCard = account.type === "credit_card";
  const isDebt = isCard || account.type === "loan";
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="account_id" value={account.id} />
      {isCard && account.credit_limit ? (
        <div>
          <label className="label" htmlFor="available_credit">Available credit your bank app shows</label>
          <input id="available_credit" name="available_credit" inputMode="decimal" className="field num" required />
        </div>
      ) : (
        <div>
          <label className="label" htmlFor="actual_balance">Balance your bank shows</label>
          <input id="actual_balance" name="actual_balance" inputMode="decimal" className="field num" required />
          {isDebt && <p className="mt-1.5 text-xs text-muted">Money you owe is negative, e.g. −25000.</p>}
        </div>
      )}
      <p className="text-xs text-muted">Any difference is added as an adjustment dated today, so the app matches your bank.</p>
      <Err state={state} />
      <button className="btn w-full" disabled={pending}>{pending ? "Checking…" : "Reconcile"}</button>
    </form>
  );
}
