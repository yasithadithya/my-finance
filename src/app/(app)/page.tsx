import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts } from "@/lib/data";
import { ensureStatements, type StatementView } from "@/lib/statements";
import { buildReminders, loadChecklist, loadReceivables } from "@/lib/reminders";
import { currentMonth, lkr, monthLabel, monthRange, num, ordinal, shortDate, todayColombo } from "@/lib/format";
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

  const [accounts, summaryRes, recentRes, checklist, receivables] = await Promise.all([
    loadAccounts(supabase),
    supabase.from("monthly_summary").select("*").eq("month", start).maybeSingle(),
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(6),
    loadChecklist(supabase, ym),
    loadReceivables(supabase),
  ]);
  const statements = await ensureStatements(supabase, accounts, today);
  const reminders = buildReminders(today, statements, checklist, receivables);
  const owedToMe = receivables.filter((r) => r.shown_status !== "quoted").reduce((s, r) => s + r.outstanding, 0);
  const latestBill = new Map<string, StatementView>();
  for (const s of statements) if (!latestBill.has(s.account_id)) latestBill.set(s.account_id, s); // newest first

  const s = summaryRes.data;
  const moneyIn = num(s?.money_in);
  const fixed = num(s?.fixed_spent);
  const other = num(s?.other_spent);
  const debt = num(s?.debt_payments);
  const out = fixed + other + debt;
  const left = moneyIn - out;

  const assets = accounts.filter((a) => !isDebtType(a.type)).reduce((t, a) => t + a.balance!, 0);
  const owed = accounts.filter((a) => isDebtType(a.type)).reduce((t, a) => t + Math.min(a.balance!, 0), 0);
  const cards = accounts.filter((a) => a.type === "credit_card");
  const money = accounts.filter((a) => !isDebtType(a.type));
  const loans = accounts.filter((a) => a.type === "loan" && a.balance !== 0);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-6">
      <section className="panel">
        <div className="flex items-baseline justify-between">
          <h1 className="text-sm font-medium text-muted">Net position</h1>
          <Link href="/pay" className="text-[13px] text-accent">Pay checklist</Link>
        </div>
        <p className={`mt-3 text-[2.5rem] font-medium ${assets + owed < 0 ? "text-out" : ""}`}>
          <Amount value={assets + owed} />
        </p>
        <dl className="num mt-2 flex gap-5 text-sm">
          <div>
            <dt className="text-xs text-muted">In accounts</dt>
            <dd>{lkr(assets)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Owed on cards and loans</dt>
            <dd className={owed < 0 ? "text-out" : ""}>{lkr(owed)}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <MonthRunway ym={ym} today={today} bills={statements} fixed={checklist} cards={cards} animate />
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">{monthLabel(ym)}</p>
          <dl className="num grid grid-cols-3 gap-x-3 text-sm">
            <Stat label="Money in" value={lkr(moneyIn)} tone="text-in" />
            <Stat label="Money out" value={lkr(-out)} />
            <Stat label="Left" value={lkr(left)} tone={left < 0 ? "text-out" : ""} />
          </dl>
          <dl className="num mt-3 grid grid-cols-3 gap-x-3 text-xs">
            <Stat label="Fixed" value={lkr(fixed)} small />
            <Stat label="Debts" value={lkr(debt)} small />
            <Stat label="Other" value={lkr(other)} small />
          </dl>
        </div>
      </section>

      <Reminders items={reminders} />

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

function Stat({ label, value, tone = "", small }: { label: string; value: string; tone?: string; small?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`truncate ${small ? "text-muted" : `font-medium ${tone}`}`}>{value}</dd>
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
