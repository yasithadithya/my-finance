"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, CreditCard, Delete, NotebookPen, Wallet } from "lucide-react";
import { createTxn, updateTxn } from "@/app/actions";
import type { Account, Txn, TxnKind } from "@/lib/types";

type Kind = Exclude<TxnKind, "adjustment">;
type Acc = Pick<Account, "id" | "name" | "type" | "balance" | "credit_limit">;

const KINDS: { value: Kind; label: string; on: string }[] = [
  { value: "expense", label: "Expense", on: "bg-out/15 text-out" },
  { value: "income", label: "Income", on: "bg-in/15 text-in" },
  { value: "transfer", label: "Transfer", on: "bg-accent/15 text-accent" },
];
const QUICK = [100, 500, 1000, 5000];

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

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function shiftDay(date: string, delta: number) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function AccountChips({ accounts, value, onPick, name }: { accounts: Acc[]; value: string; onPick: (id: string) => void; name: string }) {
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
        {accounts.map((a) => (
          <button key={a.id} type="button" className="chip" data-on={value === a.id} onClick={() => onPick(a.id)}>
            {a.type === "credit_card" ? <CreditCard size={13} /> : <Wallet size={13} />}
            {a.name}
          </button>
        ))}
      </div>
    </>
  );
}

export default function TxnForm({
  accounts,
  today,
  initial,
  defaultKind,
  defaultTo,
  salaryAccountId,
  defaultAmount,
}: {
  accounts: Acc[];
  today: string;
  initial?: Txn;
  defaultKind?: Kind;
  defaultTo?: string;
  salaryAccountId?: string;
  defaultAmount?: string;
}) {
  const editing = !!initial;
  const [state, action, pending] = useActionState(editing ? updateTxn : createTxn, undefined);
  const [kind, setKind] = useState<Kind>((initial?.kind as Kind) ?? defaultKind ?? "expense");
  const [from, setFrom] = useState(initial?.from_account_id ?? "");
  const [to, setTo] = useState(initial?.to_account_id ?? defaultTo ?? "");
  const [amount, setAmount] = useState(initial ? Number(initial.amount).toFixed(2) : defaultAmount && Number(defaultAmount) > 0 ? String(Number(defaultAmount)) : "");
  const yesterday = shiftDay(today, -1);
  const [date, setDate] = useState(initial?.date ?? today);
  const [pickDate, setPickDate] = useState(!!initial && initial.date !== today && initial.date !== yesterday);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) return;
    const last = readLast();
    if (defaultKind === "transfer" && defaultTo && salaryAccountId) setFrom(salaryAccountId);
    else if (last.from && accounts.some((a) => a.id === last.from)) setFrom(last.from);
    if (!defaultTo && last.to && accounts.some((a) => a.id === last.to)) setTo(last.to);
    amountRef.current?.focus();
  }, [editing, accounts, defaultTo, defaultKind, salaryAccountId]);

  const amt = Number(amount.replace(/,/g, "")) || 0;
  const addQuick = (n: number) => setAmount(String(Math.round((amt + n) * 100) / 100));

  // Card utilisation after this transaction (spending on a card, or paying one off).
  const cardPreview = useMemo(() => {
    const id = kind === "expense" ? from : kind === "transfer" ? to : "";
    const card = accounts.find((a) => a.id === id && a.type === "credit_card" && a.credit_limit);
    if (!card) return null;
    const owedNow = Math.max(-(card.balance ?? 0), 0);
    const owedAfter = Math.max(owedNow + (kind === "expense" ? amt : -amt), 0);
    const pct = Math.min(100, Math.round((owedAfter / card.credit_limit!) * 100));
    return { name: card.name, pct, owedAfter };
  }, [kind, from, to, amt, accounts]);

  const remember = () => writeLast({ from, to });

  return (
    <form action={action} onSubmit={remember} className="space-y-5">
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="date" value={date} />

      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1">
        {KINDS.map((k) => (
          <button
            key={k.value}
            type="button"
            onClick={() => { setKind(k.value); if (k.value === "income" && !editing && salaryAccountId) setTo(salaryAccountId); }}
            className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${kind === k.value ? k.on : "text-faint"}`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {/* Amount */}
      <section className="hero px-4 pb-4 pt-5">
        <p className="eyebrow text-center">Amount</p>
        <div className="mt-1 flex items-center justify-center gap-2">
          <span className={`num text-xl ${kind === "expense" ? "text-out" : kind === "income" ? "text-in" : "text-muted"}`}>
            {kind === "expense" ? "−Rs" : kind === "income" ? "+Rs" : "Rs"}
          </span>
          <input
            ref={amountRef}
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
            style={{ width: `${Math.max(amount.length, 4) + 0.6}ch` }}
            className="num min-w-0 max-w-[14rem] bg-transparent text-[2.6rem] font-semibold leading-none outline-none placeholder:text-faint"
            aria-label="Amount in rupees"
            required
          />
          {amount && (
            <button type="button" onClick={() => setAmount("")} className="icon-tile h-8 w-8 text-muted" aria-label="Clear amount">
              <Delete size={15} />
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {QUICK.map((n) => (
            <button key={n} type="button" onClick={() => addQuick(n)} className="num rounded-lg border border-line bg-surface-2 py-2 text-xs font-medium text-muted active:bg-surface-3">
              +{n >= 1000 ? `${n / 1000}k` : n}
            </button>
          ))}
        </div>
      </section>

      {/* Accounts */}
      {kind !== "income" && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow flex items-center gap-1.5"><Wallet size={12} /> {kind === "transfer" ? "From" : "Paid with"}</p>
          </div>
          <AccountChips accounts={accounts} value={from} onPick={setFrom} name="from_account_id" />
        </section>
      )}
      {kind !== "expense" && (
        <section>
          <p className="eyebrow mb-2 flex items-center gap-1.5"><Wallet size={12} /> {kind === "transfer" ? "To" : "Into"}</p>
          <AccountChips accounts={accounts} value={to} onPick={setTo} name="to_account_id" />
          {kind === "transfer" && <p className="mt-2 text-xs text-muted">Paying a card? From = the bank account, To = the card.</p>}
        </section>
      )}

      {/* Note */}
      <section>
        <p className="eyebrow mb-2 flex items-center gap-1.5"><NotebookPen size={12} /> Note</p>
        <input name="note" defaultValue={initial?.note ?? ""} placeholder="What was this for?" className="field" autoComplete="off" />
      </section>

      {/* Date */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow flex items-center gap-1.5"><CalendarDays size={12} /> Date</p>
          <span className="num text-xs text-muted">
            {new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className="chip justify-center" data-on={!pickDate && date === today} onClick={() => { setDate(today); setPickDate(false); }}>Today</button>
          <button type="button" className="chip justify-center" data-on={!pickDate && date === yesterday} onClick={() => { setDate(yesterday); setPickDate(false); }}>Yesterday</button>
          <button type="button" className="chip justify-center" data-on={pickDate} onClick={() => setPickDate(true)}>Other</button>
        </div>
        {pickDate && <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="field mt-2" aria-label="Pick a date" />}
      </section>

      {/* Card utilisation preview */}
      {cardPreview && (
        <section className="card flex items-center gap-3 p-3.5">
          <span className="icon-tile text-accent"><CreditCard size={16} /></span>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted">{cardPreview.name} after this</span>
              <span className={`num ${cardPreview.pct >= 80 ? "text-out" : cardPreview.pct >= 50 ? "text-warn" : "text-accent"}`}>{cardPreview.pct}% used</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div
                className={`h-full rounded-full ${cardPreview.pct >= 80 ? "bg-out" : cardPreview.pct >= 50 ? "bg-warn" : "bg-accent"}`}
                style={{ width: `${Math.max(cardPreview.pct, 2)}%` }}
              />
            </div>
            <p className="num mt-1 text-[11px] text-faint">Owes Rs {fmt(cardPreview.owedAfter)}</p>
          </div>
        </section>
      )}

      {state?.error && <p className="rounded-lg bg-out/10 px-3 py-2 text-sm text-out">{state.error}</p>}

      <div className={editing ? "" : "grid grid-cols-[1fr_1.4fr] gap-2.5"}>
        {!editing && (
          <button className="btn btn-ghost w-full" name="again" value="1" disabled={pending}>Save &amp; next</button>
        )}
        <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save changes" : "Save"}</button>
      </div>
    </form>
  );
}
