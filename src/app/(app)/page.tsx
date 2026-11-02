import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts } from "@/lib/data";
import { ensureStatements, type StatementView } from "@/lib/statements";
import { buildReminders, loadChecklist, loadReceivables } from "@/lib/reminders";
import { currentMonth, lkr, monthLabel, monthRange, num, ordinal, shortDate, todayColombo } from "@/lib/format";
import { isDebtType, type Account, type Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";
import Reminders, { StatusChip } from "@/components/Reminders";

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
  const left = moneyIn - fixed - other - debt;

  const assets = accounts.filter((a) => !isDebtType(a.type)).reduce((t, a) => t + a.balance!, 0);
  const owed = accounts.filter((a) => isDebtType(a.type)).reduce((t, a) => t + Math.min(a.balance!, 0), 0);
  const cards = accounts.filter((a) => a.type === "credit_card");
  const money = accounts.filter((a) => !isDebtType(a.type));
  const loans = accounts.filter((a) => a.type === "loan" && a.balance !== 0);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  return (
    <div className="space-y-5">
      <header>
        <p className="text-sm text-muted">Net position</p>
        <p className={`num text-3xl font-semibold ${assets + owed < 0 ? "text-out" : ""}`}>{lkr(assets + owed)}</p>
        <p className="num mt-1 text-xs text-muted">
          {lkr(assets)} in accounts · {lkr(-owed)} owed
        </p>
      </header>

      <Reminders items={reminders} />

      {accounts.length === 0 && (
        <div className="card p-4 text-sm">
          No accounts yet. <Link href="/accounts/new" className="text-accent underline">Add your first account</Link> or run the seed SQL.
        </div>
      )}

      <section className="card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted">{monthLabel(ym)}</h2>
        <dl className="num space-y-1.5 text-sm">
          <Row label="Money in" value={moneyIn} tone="in" />
          <Row label="Fixed payments" value={-fixed} />
          <Row label="Debt payments" value={-debt} />
          <Row label="Spent" value={-other} />
          <div className="my-2 border-t border-line" />
          <Row label="Left this month" value={left} strong tone={left < 0 ? "out" : undefined} />
        </dl>
      </section>

      {cards.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-medium text-muted">Credit cards</h2>
            <Link href="/debts" className="text-xs text-accent">Debts &amp; payoff</Link>
          </div>
          <div className="space-y-2">
            {cards.map((c) => <CardTile key={c.id} card={c} bill={latestBill.get(c.id)} />)}
          </div>
        </section>
      )}

      {receivables.length > 0 && (
        <Link href="/owed" className="card flex items-center justify-between px-4 py-3">
          <span>Owed to me</span>
          <span className="num text-in">{lkr(owedToMe)}</span>
        </Link>
      )}

      {money.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Accounts</h2>
          <ul className="card divide-y divide-line">
            {[...money, ...loans].map((a) => (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`} className="flex items-center justify-between px-4 py-3">
                  <span>{a.name}</span>
                  <span className={`num ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Recent</h2>
          <Link href="/transactions" className="text-xs text-accent">See all</Link>
        </div>
        {(recentRes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">Nothing yet. Tap + to add your first transaction.</p>
        ) : (
          <ul className="card divide-y divide-line">
            {(recentRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: number; strong?: boolean; tone?: "in" | "out" }) {
  const color = tone === "in" ? "text-in" : tone === "out" ? "text-out" : "";
  return (
    <div className={`flex justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-muted"}>{label}</dt>
      <dd className={color}>{lkr(value)}</dd>
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
        <span className="num text-out">{lkr(-owed)}</span>
      </div>
      {limit > 0 && (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="num mt-1.5 flex justify-between text-xs text-muted">
            <span>{lkr(available)} available</span>
            <span>{pct}% of {lkr(limit)}</span>
          </div>
        </>
      )}
      {bill ? (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs">
          <span className="num text-muted">
            {bill.status === "paid"
              ? `${shortDate(bill.statement_date)} bill paid`
              : `Bill ${lkr(bill.remaining)} · due ${shortDate(bill.due_date)}`}
          </span>
          <StatusChip status={bill.status} days={bill.days_left} />
        </div>
      ) : (
        card.billing_day &&
        card.due_day && (
          <p className="mt-1 text-xs text-muted">Statement on the {ordinal(card.billing_day)} · due on the {ordinal(card.due_day)}</p>
        )
      )}
    </Link>
  );
}
