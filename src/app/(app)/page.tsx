import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, loadInstalmentMarks, loadPlans } from "@/lib/data";
import {
  dueStatementMonths,
  ensureStatements,
  instalmentPaid,
  instalmentsDueIn,
  instalmentsInMonth,
  interestThisMonth,
  unbilled,
  type StatementView,
} from "@/lib/statements";
import { buildReminders, loadChecklist, loadReceivables } from "@/lib/reminders";
import { currentMonth, dayIn, lkr, monthLabel, monthRange, num, ordinal, round2, shiftMonth, shortDate, todayColombo } from "@/lib/format";
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
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(6),
    loadChecklist(supabase, ym),
    loadReceivables(supabase),
    loadPlans(supabase),
    loadInstalmentMarks(supabase, dueStatementMonths(ym)),
  ]);
  // Statements first: they book any instalment interest the month summary should see.
  const statements = await ensureStatements(supabase, accounts, today);

  // Month by month, starting no earlier than the first account (nothing was tracked before).
  const firstYm = accounts.reduce((m, a) => (a.opening_date.slice(0, 7) < m ? a.opening_date.slice(0, 7) : m), ym);
  const fromYm = shiftMonth(ym, -(MONTHS - 1)) > firstYm ? shiftMonth(ym, -(MONTHS - 1)) : firstYm;
  const summaryRes = await supabase.from("monthly_summary").select("*").gte("month", `${fromYm}-01`).lte("month", start);
  const history: MonthRow[] = [];
  for (let m = fromYm; m <= ym; m = shiftMonth(m, 1)) {
    const s = (summaryRes.data ?? []).find((r) => String(r.month).slice(0, 7) === m);
    history.push(monthRow(m, s, instalmentsInMonth(plans, m)));
  }
  const thisMonth = history[history.length - 1];
  const lastMonth = history.length > 1 ? history[history.length - 2] : null;

  const reminders = buildReminders(today, statements, checklist, receivables);
  const owedToMe = receivables.filter((r) => r.shown_status !== "quoted").reduce((s, r) => s + r.outstanding, 0);
  const latestBill = new Map<string, StatementView>();
  for (const s of statements) if (!latestBill.has(s.account_id)) latestBill.set(s.account_id, s); // newest first

  const cards = accounts.filter((a) => a.type === "credit_card");
  const assets = accounts.filter((a) => !isDebtType(a.type)).reduce((t, a) => t + a.balance!, 0);
  const owed = accounts.filter((a) => isDebtType(a.type)).reduce((t, a) => t + Math.min(a.balance!, 0), 0); // ≤ 0
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
  const net = round2(assets + owed - fixedLeft);
  const money = accounts.filter((a) => !isDebtType(a.type));
  const loans = accounts.filter((a) => a.type === "loan" && a.balance !== 0);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const dueInstalments = instalmentsDueIn(ym, plans, cards, statements, marks);
  const instalmentsPaid = dueInstalments.filter(instalmentPaid).length;

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-medium text-muted">Can spend now</h1>
          <Link href="/pay" className="text-[13px] text-accent">Pay checklist</Link>
        </div>
        <p className={`mt-3 text-[2.5rem] font-medium ${canSpend < 0 ? "text-out" : ""}`}>
          <Amount value={canSpend} />
        </p>

        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-xs text-accent">How this is worked out</summary>
          <dl className="num mt-2 space-y-1.5">
            <Line label="In your accounts" value={spendable} />
            {cardsNow.map((c) => (
              <Line
                key={c.card.id}
                label={c.card.name}
                hint={c.later > 0 ? `${lkr(c.later)} in later instalments not counted` : undefined}
                value={-c.now}
              />
            ))}
            {fixedLeft > 0 && <Line label="Fixed payments still to pay" value={-fixedLeft} />}
            <Line label="Can spend now" value={canSpend} total />
          </dl>
        </details>

        <dl className="num mt-4 grid grid-cols-2 gap-x-3 border-t border-line pt-3 text-sm">
          <div className="min-w-0">
            <dt className="text-xs text-muted">Net position</dt>
            <dd className={`truncate font-medium ${net < 0 ? "text-out" : ""}`}>{lkr(net)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">Owed on cards and loans</dt>
            <dd className={`truncate ${owed < 0 ? "text-out" : ""}`}>{lkr(owed)}</dd>
          </div>
        </dl>
        <p className="mt-1 text-[11px] text-muted">Net position counts all debt in full, including later instalments, and fixed payments still to pay.</p>

        <div className="mt-6">
          <MonthRunway ym={ym} today={today} bills={statements} fixed={checklist} cards={cards} instalments={dueInstalments} animate />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">{monthLabel(ym)}</p>
          <dl className="num grid grid-cols-3 gap-x-3 text-sm">
            <Stat label="Money in" value={lkr(thisMonth.moneyIn)} tone="text-in" note={lastMonth && change(thisMonth.moneyIn, lastMonth.moneyIn, true)} />
            <Stat label="Money out" value={lkr(-thisMonth.out)} note={lastMonth && change(thisMonth.out, lastMonth.out, false)} />
            <Stat label="Left" value={lkr(thisMonth.left)} tone={thisMonth.left < 0 ? "text-out" : ""} note={lastMonth && change(thisMonth.left, lastMonth.left, true)} />
          </dl>
          {lastMonth && <p className="mt-1 text-[11px] text-muted">Compared with {monthLabel(lastMonth.ym).split(" ")[0]}</p>}
          <dl className="num mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <Stat label="Fixed" value={lkr(thisMonth.fixed)} small />
            <Stat label="Instalments" value={lkr(thisMonth.instalments)} small />
            <Stat label="Debts" value={lkr(thisMonth.debt)} small />
            <Stat label="Other" value={lkr(thisMonth.other)} small />
          </dl>
          {dueInstalments.length > 0 && (
            <Link href="/pay#instalments" className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-xs">
              <span className="min-w-0 truncate">
                Instalments due this month: {instalmentsPaid} of {dueInstalments.length} paid
              </span>
              <span className="shrink-0 text-accent">{instalmentsPaid < dueInstalments.length ? "Mark paid ›" : "View ›"}</span>
            </Link>
          )}
        </div>
      </section>

      <Reminders items={reminders} />

      {history.length > 1 && (
        <section>
          <div className="section-head">
            <h2>Month by month</h2>
            <Link href="/transactions">History</Link>
          </div>
          <div className="card overflow-hidden">
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="px-4 py-2 text-left font-normal">Month</th>
                  <th className="px-2 py-2 text-right font-normal">In</th>
                  <th className="px-2 py-2 text-right font-normal">Out</th>
                  <th className="px-4 py-2 text-right font-normal">Left</th>
                </tr>
              </thead>
              <tbody>
                {[...history].reverse().map((h) => (
                  <tr key={h.ym} className={`border-t border-line ${h.ym === ym ? "font-medium" : ""}`}>
                    <td className="px-4 py-2.5">{monthLabel(h.ym).replace(/ (\d{2})(\d{2})$/, " ’$2")}</td>
                    <td className="px-2 py-2.5 text-right text-in">{short(h.moneyIn)}</td>
                    <td className="px-2 py-2.5 text-right">{short(h.out)}</td>
                    <td className={`px-4 py-2.5 text-right ${h.left < 0 ? "text-out" : ""}`}>{short(h.left)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 px-1 text-xs text-muted">Out includes fixed payments, card bill payments, other spending, and each month&apos;s instalments (not the full price).</p>
        </section>
      )}

      {accounts.length === 0 && (
        <div className="card p-4 text-sm">
          No accounts yet. <Link href="/accounts/new" className="text-accent underline">Add your first account</Link> or run the seed SQL.
        </div>
      )}

      {cards.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Credit cards</h2>
            <Link href="/debts">Debts and payoff</Link>
          </div>
          <div className="space-y-2">
            {cards.map((c) => <CardTile key={c.id} card={c} bill={latestBill.get(c.id)} />)}
          </div>
        </section>
      )}

      {money.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Accounts</h2>
            <Link href="/accounts">All accounts</Link>
          </div>
          <ul className="ledger">
            {[...money, ...loans].map((a) => (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`} className="flex items-center justify-between px-4 py-3">
                  <span>{a.name}</span>
                  <span className={`num ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</span>
                </Link>
              </li>
            ))}
            {receivables.length > 0 && (
              <li>
                <Link href="/owed" className="flex items-center justify-between px-4 py-3">
                  <span>Owed to me</span>
                  <span className="num text-in">{lkr(owedToMe)}</span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      <section>
        <div className="section-head">
          <h2>Recent</h2>
          <Link href="/transactions">See all</Link>
        </div>
        {(recentRes.data ?? []).length === 0 ? (
          <p className="card p-4 text-sm text-muted">Nothing yet. Tap + to add your first transaction.</p>
        ) : (
          <ul className="ledger">
            {(recentRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

const MONTHS = 6;

interface MonthRow {
  ym: string;
  moneyIn: number;
  fixed: number;
  other: number;
  debt: number;
  instalments: number;
  out: number;
  left: number;
}

function monthRow(ym: string, s: Record<string, unknown> | undefined, instalments: number): MonthRow {
  const moneyIn = num(s?.money_in as number);
  const fixed = num(s?.fixed_spent as number);
  const other = num(s?.other_spent as number);
  const debt = num(s?.debt_payments as number);
  // A purchase on instalments counts only its instalment in each month, not the full price.
  const out = round2(fixed + other + instalments + debt);
  return { ym, moneyIn, fixed, other, debt, instalments, out, left: round2(moneyIn - out) };
}

/** "▲ Rs 1,200.00" against last month; green when the change is good. */
function change(now: number, before: number, upIsGood: boolean) {
  const d = round2(now - before);
  if (Math.abs(d) < 0.01) return <span className="text-muted">Same</span>;
  const good = d > 0 === upIsGood;
  return <span className={good ? "text-in" : "text-out"}>{d > 0 ? "▲" : "▼"} {lkr(Math.abs(d))}</span>;
}

/** Compact amount for the month table: 52,900 / 1.2M. */
function short(n: number) {
  const a = Math.abs(n);
  const s = a >= 1_000_000 ? `${(a / 1_000_000).toFixed(1)}M` : Math.round(a).toLocaleString("en-US");
  return (n < 0 ? "−" : "") + s;
}

function Line({ label, value, hint, total }: { label: string; value: number; hint?: string; total?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${total ? "border-t border-line pt-1.5 font-medium" : ""}`}>
      <dt className="min-w-0">
        <span className={total ? "" : "text-muted"}>{label}</span>
        {hint && <span className="block truncate text-[11px] text-muted">{hint}</span>}
      </dt>
      <dd className={`shrink-0 ${value < 0 ? "text-out" : ""}`}>{lkr(value)}</dd>
    </div>
  );
}

function Stat({ label, value, tone = "", small, note }: { label: string; value: string; tone?: string; small?: boolean; note?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`truncate ${small ? "text-muted" : `font-medium ${tone}`}`}>{value}</dd>
      {note && <dd className="truncate text-[11px]">{note}</dd>}
    </div>
  );
}

function CardTile({ card, bill }: { card: Account; bill?: StatementView }) {
  const owed = Math.max(-card.balance!, 0);
  const limit = card.credit_limit ?? 0;
  const available = limit ? limit - owed : null;
  const pct = limit ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
  const bar = pct >= 80 ? "bg-out" : pct >= 50 ? "bg-warn" : "bg-accent";
  return (
    <Link href={`/accounts/${card.id}`} className="card block p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{card.name}</span>
        <span className="num">{lkr(-owed)}</span>
      </div>
      {limit > 0 && (
        <>
          <div className="meter mt-3">
            <span className={bar} style={{ width: `${pct}%` }} />
          </div>
          <div className="num mt-1.5 flex justify-between text-xs text-muted">
            <span>{lkr(available)} available</span>
            <span>{pct}% of {lkr(limit)} used</span>
          </div>
        </>
      )}
      {bill ? (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="num text-muted">
            {bill.status === "paid"
              ? `${shortDate(bill.statement_date)} bill paid`
              : `Bill ${lkr(bill.remaining)}, due ${shortDate(bill.due_date)}`}
          </span>
          <StatusChip status={bill.status} days={bill.days_left} />
        </div>
      ) : (
        card.billing_day &&
        card.due_day && (
          <p className="mt-2 text-xs text-muted">Statement on the {ordinal(card.billing_day)}, due on the {ordinal(card.due_day)}</p>
        )
      )}
    </Link>
  );
}
