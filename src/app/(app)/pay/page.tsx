import Link from "next/link";
import { Check, CreditCard, Package, Plus, Settings2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCards, loadRecurring } from "@/lib/finance";
import { currentMonth, cycleSpan, lkr, monthLabel } from "@/lib/format";
import { saveRecurringItem, setRecurringActive, toggleRecurring } from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import type { Account } from "@/lib/types";
import type { RecurringItem } from "@/lib/finance";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "—";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ manage?: string }> }) {
  const { manage } = await searchParams;
  const supabase = await createClient();
  const cycle = currentMonth();
  const [{ statuses, accounts }, { items, marks }] = await Promise.all([loadCards(supabase), loadRecurring(supabase, cycle)]);
  const payFrom = accounts.filter((a) => a.type !== "loan");
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ticked = new Map(marks.map((m) => [m.recurring_item_id, m]));
  const active = items.filter((i) => i.active);
  const done = active.filter((i) => ticked.has(i.id));
  const fixedTotal = active.reduce((s, i) => s + i.amount, 0);
  const fixedLeft = active.filter((i) => !ticked.has(i.id)).reduce((s, i) => s + i.amount, 0);
  const cardDue = statuses.reduce((s, c) => s + (c.remainingDue ?? 0), 0);
  const plans = statuses.flatMap((s) => s.plans.filter((p) => p.remainingMonths > 0).map((p) => ({ ...p, card: s.card.name })));

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="eyebrow">Pay this month</p>
          <h1 className="text-xl font-semibold">{monthLabel(cycle)}</h1>
          <p className="num text-[11px] text-faint">Pay cycle {cycleSpan(cycle)}</p>
        </div>
        <Link href={manage ? "/pay" : "/pay?manage=1"} className="chip" data-on={!!manage}><Settings2 size={14} /> {manage ? "Done" : "Manage"}</Link>
      </header>

      <section className="hero p-5">
        <p className="eyebrow">Still to pay</p>
        <p className="num mt-1 text-[2rem] font-semibold leading-tight text-accent">{lkr(fixedLeft + cardDue)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
            <p className="eyebrow">Card dues</p>
            <p className="num mt-0.5 text-sm font-semibold">{lkr(cardDue)}</p>
          </div>
          <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
            <p className="eyebrow">Fixed left</p>
            <p className="num mt-0.5 text-sm font-semibold">{lkr(fixedLeft)}</p>
          </div>
        </div>
      </section>

      {/* Card dues */}
      {statuses.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-0.5 font-semibold">Credit cards</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {statuses.map((s) => {
              const paid = s.remainingDue === 0;
              return (
                <li key={s.card.id} className="flex items-center gap-3 px-3.5 py-3">
                  <span className={`icon-tile ${paid ? "text-in" : s.overdue ? "text-out" : "text-accent"}`}>{paid ? <Check size={17} /> : <CreditCard size={16} />}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium ${paid ? "text-muted line-through" : ""}`}>{s.card.name}</p>
                    <p className="text-[11px] text-faint">
                      {s.statement === null ? "Statement amount needed" : paid ? `Statement ${fmt(s.lastClose)} paid` : `${s.overdue ? "Was due" : "Due"} ${fmt(s.dueDate)}`}
                    </p>
                  </div>
                  {s.statement === null ? (
                    <Link href="/cards" className="tag text-warn">Enter</Link>
                  ) : paid ? (
                    <span className="num text-sm text-muted">{lkr(s.statement)}</span>
                  ) : (
                    <Link href={`/add?kind=transfer&to=${s.card.id}&amount=${s.remainingDue}`} className="btn px-3 py-1.5 text-xs">Pay {lkr(s.remainingDue)}</Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Fixed payments */}
      <section>
        <div className="mb-2.5 px-0.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Fixed payments</h2>
            <span className="num text-xs text-accent">{done.length}/{active.length} done</span>
          </div>
          <p className="num text-[11px] text-faint">{lkr(fixedTotal - fixedLeft)} of {lkr(fixedTotal)} paid</p>
        </div>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent" style={{ width: `${active.length ? (done.length / active.length) * 100 : 0}%` }} />
        </div>
        {manage ? (
          <ManageList items={items} accounts={payFrom} />
        ) : active.length === 0 ? (
          <p className="card p-4 text-sm text-muted">No fixed payments yet. Tap Manage to add some.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {active.map((i) => {
              const mark = ticked.get(i.id);
              const acc = i.pay_from_account_id ? byId.get(i.pay_from_account_id) : null;
              return (
                <li key={i.id}>
                  <form action={toggleRecurring} className="flex items-center gap-3 px-3.5 py-3">
                    <input type="hidden" name="item_id" value={i.id} />
                    <input type="hidden" name="cycle" value={cycle} />
                    <button
                      className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg border ${mark ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface-2 text-transparent"}`}
                      aria-label={mark ? `Untick ${i.name}` : `Tick ${i.name} as paid`}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`font-medium ${mark ? "text-muted line-through" : ""}`}>{i.name}</p>
                      {mark ? (
                        <p className="text-[11px] text-faint">{mark.transaction_id ? `Paid · recorded from ${acc?.name ?? "account"}` : "Marked done"}</p>
                      ) : acc ? (
                        <p className="text-[11px] text-faint">From {acc.name}{i.due_day ? ` · day ${i.due_day}` : ""}</p>
                      ) : (
                        <select name="account_id" defaultValue="" className="mt-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[11px] text-muted">
                          <option value="">Just mark done</option>
                          {accounts.map((a) => <option key={a.id} value={a.id}>Pay from {a.name}</option>)}
                        </select>
                      )}
                    </div>
                    <span className={`num text-sm ${mark ? "text-muted" : ""}`}>{lkr(i.amount)}</span>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        {!manage && <p className="mt-2 px-0.5 text-[11px] text-faint">Ticking records the payment as an expense from the chosen account. Unticking removes it.</p>}
      </section>

      {/* Instalments */}
      {plans.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-0.5 font-semibold">Instalments</h2>
          <ul className="card divide-y divide-line overflow-hidden">
            {plans.map((p) => (
              <li key={p.plan.id} className="flex items-center gap-3 px-3.5 py-3">
                <span className="icon-tile text-accent"><Package size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.plan.name}</p>
                  <p className="text-[11px] text-faint">Billed on {p.card} · {p.billed}/{p.plan.months}{p.nextBilling ? ` · next ${fmt(p.nextBilling)}` : ""}</p>
                </div>
                <span className="num text-sm">{lkr(p.plan.monthly_amount)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 px-0.5 text-[11px] text-faint">Already part of the card dues above, not extra.</p>
        </section>
      )}
    </div>
  );
}

function ManageList({ items, accounts }: { items: RecurringItem[]; accounts: Account[] }) {
  return (
    <div className="space-y-2.5">
      {items.map((i) => (
        <details key={i.id} className={`card p-3.5 ${i.active ? "" : "opacity-60"}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between">
            <span className="font-medium">{i.name}{!i.active && <span className="tag ml-2">paused</span>}</span>
            <span className="num text-sm">{lkr(i.amount)}</span>
          </summary>
          <ItemForm item={i} accounts={accounts} />
          <form action={setRecurringActive} className="mt-2">
            <input type="hidden" name="id" value={i.id} />
            <input type="hidden" name="active" value={String(!i.active)} />
            <button className="w-full text-center text-xs text-muted underline">{i.active ? "Pause (stop showing it)" : "Resume"}</button>
          </form>
        </details>
      ))}
      <details className="card p-3.5" open={items.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Plus size={16} className="text-accent" /> New fixed payment</summary>
        <ItemForm accounts={accounts} />
      </details>
    </div>
  );
}

function ItemForm({ item, accounts }: { item?: RecurringItem; accounts: Account[] }) {
  return (
    <ActionForm action={saveRecurringItem} submit={item ? "Save" : "Add"} className="mt-3 space-y-2.5">
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
        <input name="name" defaultValue={item?.name} placeholder="Name" className="field" required />
        <input name="amount" defaultValue={item?.amount} inputMode="decimal" placeholder="Amount" className="field num" required />
      </div>
      <div className="grid grid-cols-[1.4fr_1fr] gap-2.5">
        <select name="pay_from_account_id" defaultValue={item?.pay_from_account_id ?? ""} className="field">
          <option value="">Pay from… (ask each time)</option>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input name="due_day" defaultValue={item?.due_day ?? ""} inputMode="numeric" placeholder="Day (opt.)" className="field num" />
      </div>
    </ActionForm>
  );
}
