import Link from "next/link";
import { AlertTriangle, CalendarClock, CreditCard, Package, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCards } from "@/lib/finance";
import { currentMonth, lkr } from "@/lib/format";
import { createPlan, deletePlan, saveStatement, clearStatement } from "@/app/actions";
import ActionForm from "@/components/ActionForm";
import type { CardStatus } from "@/lib/cards";

export const dynamic = "force-dynamic";

const fmt = (d: string | null) =>
  d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "—";

export default async function CardsPage() {
  const supabase = await createClient();
  const { statuses, accounts } = await loadCards(supabase);
  const cards = accounts.filter((a) => a.type === "credit_card");

  return (
    <div className="space-y-6">
      <header>
        <Link href="/more" className="text-sm text-muted">‹ More</Link>
        <p className="eyebrow mt-1">Statements & dues</p>
        <h1 className="text-xl font-semibold">Credit Cards</h1>
      </header>

      {statuses.length === 0 && (
        <p className="card p-4 text-sm text-muted">
          No credit cards yet. <Link href="/accounts/new" className="text-accent underline">Add one</Link>.
        </p>
      )}

      {statuses.map((s) => <CardBlock key={s.card.id} s={s} />)}

      {cards.length > 0 && (
        <details className="card p-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Plus size={16} className="text-accent" /> Add instalment plan</summary>
          <ActionForm action={createPlan} submit="Add plan" className="mt-4 space-y-3">
            <div>
              <label className="label">What did you buy?</label>
              <input name="name" className="field" placeholder="e.g. Galaxy Buds 4 Pro" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Card</label>
                <select name="card_account_id" className="field">
                  {cards.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">First billed in</label>
                <input name="first_billing_month" type="month" defaultValue={currentMonth()} className="field" required />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Total price</label>
                <input name="total_price" inputMode="decimal" className="field num" required />
              </div>
              <div>
                <label className="label">Months</label>
                <input name="months" inputMode="numeric" className="field num" required />
              </div>
              <div>
                <label className="label">Per month</label>
                <input name="monthly_amount" inputMode="decimal" placeholder="auto" className="field num" />
              </div>
            </div>
            <p className="text-xs text-muted">The bank holds the whole remaining amount on the card, so this never adds debt. It only shows how much is billed on each statement.</p>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

function CardBlock({ s }: { s: CardStatus }) {
  const pct = s.utilisation ?? 0;
  const bar = pct >= 80 ? "bg-out" : pct >= 50 ? "bg-warn" : "bg-accent";
  const missing = s.lastClose && s.statement === null;
  const payHref = `/add?kind=transfer&to=${s.card.id}${s.remainingDue ? `&amount=${s.remainingDue}` : ""}`;

  return (
    <section className="space-y-2.5">
      <div className="hero p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="icon-tile text-accent"><CreditCard size={17} /></span>
            <div>
              <p className="text-lg font-semibold">{s.card.name}</p>
              {s.card.credit_limit && <p className="num text-[11px] text-faint">{lkr(s.card.credit_limit)} limit · {pct}% used</p>}
            </div>
          </div>
          <Link href={`/accounts/${s.card.id}`} className="tag">History</Link>
        </div>

        {missing ? (
          <div className="mt-4 rounded-xl border border-warn/30 bg-warn/10 p-3.5">
            <p className="flex items-center gap-2 text-sm font-semibold text-warn"><AlertTriangle size={15} /> Enter the {fmt(s.lastClose)} statement</p>
            <p className="mt-1 text-xs text-muted">This statement closed before you started tracking, so the app can&apos;t work it out. Type the amount from the bank&apos;s statement (0 if fully paid).</p>
            <StatementForm s={s} />
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="eyebrow">{s.overdue ? "Overdue" : "Due"} · {fmt(s.dueDate)}</p>
                <p className={`num text-3xl font-semibold ${s.overdue ? "text-out" : s.remainingDue ? "text-text" : "text-in"}`}>
                  {s.remainingDue ? lkr(s.remainingDue) : "Paid"}
                </p>
              </div>
              {s.daysToDue !== null && s.remainingDue ? (
                <span className={`tag ${s.overdue ? "text-out" : s.daysToDue <= 5 ? "text-warn" : ""}`}>
                  {s.overdue ? `${-s.daysToDue}d late` : s.daysToDue === 0 ? "today" : `${s.daysToDue}d left`}
                </span>
              ) : null}
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <dl className="num mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <Stat label={`Statement ${fmt(s.lastClose)}`} value={lkr(s.statement)} note={s.statementSource === "entered" ? "entered" : "calculated"} />
              <Stat label="Paid since" value={lkr(s.paidSinceClose)} right />
              <Stat label={`Unbilled → ${fmt(s.nextClose)}`} value={lkr(s.unbilled)} />
              <Stat label="Instalments held" value={lkr(s.held)} right />
              <Stat label="Owed in total" value={lkr(s.owedNow)} />
              <Stat label="Available" value={lkr(s.available)} right tone="text-accent" />
            </dl>
            <Link href={payHref} className="btn mt-4 w-full text-sm">Pay {s.remainingDue ? lkr(s.remainingDue) : "card"}</Link>
            <details className="mt-3">
              <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-xs text-muted"><Pencil size={12} /> Statement amount different?</summary>
              <div className="mt-2 rounded-xl bg-surface-2 p-3.5">
                <p className="text-xs text-muted">If the bank statement shows a different amount (interest, fees), enter it here. It replaces the calculated figure.</p>
                <StatementForm s={s} />
                {s.statementSource === "entered" && (
                  <form action={clearStatement} className="mt-2">
                    <input type="hidden" name="account_id" value={s.card.id} />
                    <input type="hidden" name="statement_date" value={s.lastClose!} />
                    <button className="w-full text-center text-xs text-muted underline">Use the calculated amount again</button>
                  </form>
                )}
              </div>
            </details>
          </>
        )}
        {s.card.billing_day && s.card.due_day && (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
            <CalendarClock size={12} /> Statement on day {s.card.billing_day} · payment due on day {s.card.due_day}
          </p>
        )}
      </div>

      {s.plans.length > 0 && (
        <ul className="card divide-y divide-line overflow-hidden">
          {s.plans.map((p) => (
            <li key={p.plan.id} className="flex items-center gap-3 px-3.5 py-3">
              <span className="icon-tile text-accent"><Package size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{p.plan.name}</p>
                <div className="mt-1.5 flex gap-1">
                  {Array.from({ length: p.plan.months }).map((_, i) => (
                    <span key={i} className={`h-1.5 flex-1 rounded-full ${i < p.billed ? "bg-accent" : "bg-surface-3"}`} />
                  ))}
                </div>
                <p className="num mt-1 text-[11px] text-faint">
                  {p.billed}/{p.plan.months} billed · {lkr(p.plan.monthly_amount)}/mo{p.nextBilling ? ` · next ${fmt(p.nextBilling)}` : " · done"}
                </p>
              </div>
              <div className="text-right">
                <p className="num text-sm font-semibold">{lkr(p.held)}</p>
                <p className="text-[10px] text-faint">left</p>
              </div>
              <form action={deletePlan}>
                <input type="hidden" name="id" value={p.plan.id} />
                <button className="p-1 text-faint" aria-label={`Delete ${p.plan.name}`}><Trash2 size={15} /></button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function StatementForm({ s }: { s: CardStatus }) {
  return (
    <ActionForm action={saveStatement} submit="Save statement" className="mt-3 space-y-2.5">
      <input type="hidden" name="account_id" value={s.card.id} />
      <input type="hidden" name="statement_date" value={s.lastClose ?? ""} />
      <input type="hidden" name="due_date" value={s.dueDate ?? ""} />
      <input name="statement_balance" inputMode="decimal" placeholder="Statement amount" defaultValue={s.statementSource === "entered" ? s.statement ?? "" : ""} className="field num" required />
    </ActionForm>
  );
}

function Stat({ label, value, note, right, tone = "" }: { label: string; value: string; note?: string; right?: boolean; tone?: string }) {
  return (
    <div className={right ? "text-right" : ""}>
      <dt className="text-[11px] text-muted">{label}{note && <span className="ml-1 text-faint">({note})</span>}</dt>
      <dd className={`font-medium ${tone}`}>{value}</dd>
    </div>
  );
}
