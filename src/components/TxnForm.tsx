"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createTxn, updateTxn } from "@/app/actions";
import type { Account, Txn, TxnKind } from "@/lib/types";

type Kind = Exclude<TxnKind, "adjustment">;
const KINDS: { value: Kind; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfer" },
];

const LAST_KEY = "me:last-accounts";
function readLast(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeLast(v: Record<string, string>) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify(v));
  } catch {}
}

export default function TxnForm({
  accounts,
  today,
  initial,
}: {
  accounts: Pick<Account, "id" | "name" | "type">[];
  today: string;
  initial?: Txn;
}) {
  const editing = !!initial;
  const [state, action, pending] = useActionState(editing ? updateTxn : createTxn, undefined);
  const [kind, setKind] = useState<Kind>((initial?.kind as Kind) ?? "expense");
  const [from, setFrom] = useState(initial?.from_account_id ?? "");
  const [to, setTo] = useState(initial?.to_account_id ?? "");
  const amountRef = useRef<HTMLInputElement>(null);

  // Pre-select the last accounts used (new transactions only).
  useEffect(() => {
    if (editing) return;
    const last = readLast();
    if (last.from && accounts.some((a) => a.id === last.from)) setFrom(last.from);
    if (last.to && accounts.some((a) => a.id === last.to)) setTo(last.to);
    amountRef.current?.focus();
  }, [editing, accounts]);

  const remember = () => writeLast({ from, to });

  const options = (
    <>
      <option value="" disabled>Choose account</option>
      {accounts.map((a) => (
        <option key={a.id} value={a.id}>{a.name}</option>
      ))}
    </>
  );

  return (
    <form action={action} onSubmit={remember} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />

      <div className="relative grid grid-cols-3 rounded-xl bg-surface p-1" role="radiogroup" aria-label="Type">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-surface-2 ring-1 ring-accent/60 transition-transform duration-200 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(${KINDS.findIndex((k) => k.value === kind) * 100}%)` }}
        />
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            role="radio"
            aria-checked={kind === k.value}
            onClick={() => setKind(k.value)}
            className={`relative rounded-lg py-2 text-sm font-medium transition-colors ${kind === k.value ? "text-text" : "text-muted"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      <div className="py-2">
        <label className="label" htmlFor="amount">Amount</label>
        <div className="flex items-baseline gap-3 border-b-2 border-line pb-2 transition-colors focus-within:border-accent">
          <span className="text-lg font-medium text-muted">Rs</span>
          <input
            ref={amountRef}
            id="amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            defaultValue={initial ? Number(initial.amount).toFixed(2) : ""}
            className={`money w-full min-w-0 bg-transparent text-[2.75rem] font-medium outline-none placeholder:text-surface-2 ${
              kind === "income" ? "text-in" : ""
            }`}
            required
          />
        </div>
      </div>

      {kind !== "income" && (
        <div>
          <label className="label" htmlFor="from">{kind === "transfer" ? "From" : "Paid with"}</label>
          <select id="from" name="from_account_id" className="field" value={from} onChange={(e) => setFrom(e.target.value)} required>
            {options}
          </select>
        </div>
      )}

      {kind !== "expense" && (
        <div>
          <label className="label" htmlFor="to">{kind === "transfer" ? "To" : "Into"}</label>
          <select id="to" name="to_account_id" className="field" value={to} onChange={(e) => setTo(e.target.value)} required>
            {options}
          </select>
          {kind === "transfer" && (
            <p className="mt-1.5 text-xs text-muted">Paying a card? From = the bank account, To = the card.</p>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="note">Note</label>
        <input id="note" name="note" defaultValue={initial?.note ?? ""} placeholder="e.g. dinner" className="field" autoComplete="off" />
      </div>

      <div>
        <label className="label" htmlFor="date">Date</label>
        <input id="date" name="date" type="date" defaultValue={initial?.date ?? today} className="field" required />
      </div>

      {state?.error && <p className="text-sm text-out">{state.error}</p>}

      <div className={editing ? "" : "grid grid-cols-2 gap-2"}>
        <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save"}</button>
        {!editing && (
          <button className="btn btn-ghost w-full" name="again" value="1" disabled={pending}>
            Save &amp; next
          </button>
        )}
      </div>
    </form>
  );
}
