import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, loadInstalmentMarks, loadPlans } from "@/lib/data";
import {
  dueStatementMonths,
  ensureStatements,
  instalmentsDueIn,
  instalmentsInMonth,
  interestThisMonth,
  unbilled,
  type StatementView,
} from "@/lib/statements";
import { buildReminders, loadChecklist, loadReceivables } from "@/lib/reminders";
import { currentMonth, dayIn, lkr, monthLabel, monthRange, num, round2, shortDate, todayColombo } from "@/lib/format";
import { isDebtType, type Account, type Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";
import Reminders, { StatusChip } from "@/components/Reminders";
import Amount from "@/components/Amount";
import MonthRunway from "@/components/MonthRunway";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const ym = currentMonth();
  const today = todayColombo();
  const { start } = monthRange(ym);

  const [accounts, recentRes, checklist, receivables, plans, marks] = await Promise.all([
    loadAccounts(supabase),
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(3),
    loadChecklist(supabase, ym),
    loadReceivables(supabase),
    loadPlans(supabase),
    loadInstalmentMarks(supabase, dueStatementMonths(ym)),
  ]);
  // Statements first: they book any instalment interest the month summary should see.
  const statements = await ensureStatements(supabase, accounts, today);

  const summaryRes = await supabase.from("monthly_summary").select("*").eq("month", start);
  const thisMonth = monthRow((summaryRes.data ?? [])[0], instalmentsInMonth(plans, ym));

  const reminders = buildReminders(today, statements, checklist, receivables);
  const latestBill = new Map<string, StatementView>();
  for (const s of statements) if (!latestBill.has(s.account_id)) latestBill.set(s.account_id, s); // newest first

  const cards = accounts.filter((a) => a.type === "credit_card");
  const fixedLeft = checklist.filter((i) => !i.mark).reduce((t, i) => t + i.amount, 0);

  // ---- What you can spend right now
  // Money you can reach (fixed deposits are locked away), minus what each card
  // needs from you now, minus fixed payments still to pay this month. On a card
  // with instalments, only this month's instalment counts; later ones don't.
  const spendable = accounts.filter((a) => !isDebtType(a.type) && a.type !== "fd").reduce((t, a) => t + a.balance!, 0);
  const cardsNow = cards
    .map((c) => {
      const mine = plans.filter((p) => p.card_account_id === c.id);
      const later = mine.reduce((t, p) => t + unbilled(p, ym), 0);
      // This month's interest is booked on statement day; count it before then too.
      const statementDone = c.billing_day ? dayIn(ym, c.billing_day) <= today : false;
      const interest = statementDone ? 0 : mine.reduce((t, p) => t + interestThisMonth(p, ym), 0);
      const total = Math.max(0, -c.balance!);
      return { card: c, now: round2(Math.max(0, total - later) + interest), later: round2(Math.min(total, later)) };
    })
    .filter((c) => c.now > 0 || c.later > 0);
  const cardsDue = cardsNow.reduce((t, c) => t + c.now, 0);
  const canSpend = round2(spendable - cardsDue - fixedLeft);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const dueInstalments = instalmentsDueIn(ym, plans, cards, statements, marks);

  return (
    <div className="space-y-6">
      <section className="panel">
        <h1 className="text-sm font-medium text-muted">Can spend now</h1>
        <p className={`mt-2 text-[2.5rem] font-medium ${canSpend < 0 ? "text-out" : "text-accent"}`}>
          <Amount value={canSpend} />
        </p>

        <details className="mt-1 text-sm">
          <summary className="cursor-pointer text-xs text-muted">How?</summary>
          <dl className="num mt-2 space-y-1.5">
            <Line label="Accounts" value={spendable} />
            {cardsNow.map((c) => <Line key={c.card.id} label={c.card.name} value={-c.now} />)}
            {fixedLeft > 0 && <Line label="Fixed still to pay" value={-fixedLeft} />}
          </dl>
        </details>

        <div className="mt-5">
          <MonthRunway ym={ym} today={today} bills={statements} fixed={checklist} cards={cards} instalments={dueInstalments} animate />
        </div>

        <dl className="num mt-4 grid grid-cols-3 gap-x-3 border-t border-line pt-3 text-sm">
          <Stat label={`In · ${monthLabel(ym).split(" ")[0]}`} value={lkr(thisMonth.moneyIn)} tone="text-in" />
          <Stat label="Out" value={lkr(-thisMonth.out)} />
          <Stat label="Left" value={lkr(thisMonth.left)} tone={thisMonth.left < 0 ? "text-out" : ""} />
        </dl>
      </section>

      <Reminders items={reminders} />

      {accounts.length === 0 && (
        <div className="card p-4 text-sm">
          No accounts yet. <Link href="/accounts/new" className="text-accent underline">Add one</Link>.
        </div>
      )}

      {cards.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Cards</h2>
          </div>
          <ul className="ledger">
            {cards.map((c) => <CardRow key={c.id} card={c} bill={latestBill.get(c.id)} />)}
          </ul>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Recent</h2>
          <Link href="/transactions">All</Link>
        </div>
        {(recentRes.data ?? []).length === 0 ? (
          <p className="card p-4 text-sm text-muted">Nothing yet. Tap + to add one.</p>
        ) : (
          <ul className="ledger">
            {(recentRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

interface MonthRow {
  moneyIn: number;
  out: number;
  left: number;
}

function monthRow(s: Record<string, unknown> | undefined, instalments: number): MonthRow {
  const moneyIn = num(s?.money_in as number);
  // A purchase on instalments counts only its instalment in each month, not the full price.
  const out = round2(num(s?.fixed_spent as number) + num(s?.other_spent as number) + instalments + num(s?.debt_payments as number));
  return { moneyIn, out, left: round2(moneyIn - out) };
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="min-w-0 truncate text-muted">{label}</dt>
      <dd className={`shrink-0 ${value < 0 ? "text-out" : ""}`}>{lkr(value)}</dd>
    </div>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`truncate font-medium ${tone}`}>{value}</dd>
    </div>
  );
}

function CardRow({ card, bill }: { card: Account; bill?: StatementView }) {
  const owed = Math.max(-card.balance!, 0);
  const limit = card.credit_limit ?? 0;
  const pct = limit ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
  const bar = pct >= 80 ? "bg-out" : pct >= 50 ? "bg-warn" : "bg-accent";
  return (
    <li>
      <Link href={`/accounts/${card.id}`} className="block px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">{card.name}</span>
          {bill && <StatusChip status={bill.status} days={bill.days_left} />}
        </div>
        <div className="num mt-1 flex justify-between text-xs text-muted">
          <span>{bill && bill.status !== "paid" ? `Bill ${lkr(bill.remaining)} · ${shortDate(bill.due_date)}` : `Owes ${lkr(owed)}`}</span>
          {limit > 0 && <span>{pct}%</span>}
        </div>
        {limit > 0 && (
          <div className="meter mt-2">
            <span className={bar} style={{ width: `${pct}%` }} />
          </div>
        )}
      </Link>
    </li>
  );
}
