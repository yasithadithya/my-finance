import Link from "next/link";
import { AlertTriangle, BellRing, ChevronRight, ArrowDownLeft, ArrowUpRight, CalendarDays, CreditCard, Landmark, Receipt, Repeat, ShoppingBag } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCards, loadRecurring } from "@/lib/finance";
import { buildReminders } from "@/lib/reminders";
import type { CardStatus } from "@/lib/cards";
import { currentMonth, cycleSpan, daysLeftInMonth, lkr, monthLabel, monthRange, todayColombo } from "@/lib/format";
import { isDebtType, type Account, type Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";

export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await createClient();
  const ym = currentMonth();
  const { start, end } = monthRange(ym);

  const [{ accounts, statuses }, recurring, cycleRes, recentRes] = await Promise.all([
    loadCards(supabase),
    loadRecurring(supabase, ym),
    supabase.from("transactions").select("amount, kind, to_account_id, recurring_item_id").gte("date", start).lt("date", end),
    supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(5),
  ]);

  // This pay cycle (30th → 29th): money in, fixed, debt payments, other spending.
  const typeOf = new Map(accounts.map((a) => [a.id, a.type]));
  let moneyIn = 0, fixed = 0, other = 0, debt = 0;
  for (const t of cycleRes.data ?? []) {
    const amt = Number(t.amount);
    if (t.kind === "income") moneyIn += amt;
    else if (t.kind === "expense" && t.recurring_item_id) fixed += amt;
    else if (t.kind === "expense") other += amt;
    else if (t.kind === "transfer" && isDebtType(typeOf.get(t.to_account_id) ?? "bank")) debt += amt;
  }
  const left = moneyIn - fixed - other - debt;
  const daysLeft = daysLeftInMonth(ym);
  const perDay = daysLeft > 0 && left > 0 ? left / daysLeft : 0;

  const assets = accounts.filter((a) => !isDebtType(a.type)).reduce((t, a) => t + a.balance!, 0);
  const owed = accounts.filter((a) => isDebtType(a.type)).reduce((t, a) => t + Math.min(a.balance!, 0), 0);
  const cards = accounts.filter((a) => a.type === "credit_card");
  const money = accounts.filter((a) => !isDebtType(a.type));
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const net = assets + owed;
  const reminders = buildReminders(statuses, recurring, todayColombo());
  const statusById = new Map(statuses.map((st) => [st.card.id, st]));

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">LKR (Rs)</p>
          <h1 className="text-xl font-semibold">My Expenses</h1>
        </div>
        <span className="chip"><CalendarDays size={14} /> {monthLabel(ym)}</span>
      </header>

      {/* Net position */}
      <section className="hero p-5">
        <p className="eyebrow">Net position</p>
        <p className={`num mt-1 text-[2.1rem] font-semibold leading-tight ${net < 0 ? "text-out" : "text-accent"}`}>{lkr(net)}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-in" /> <span className="num text-text">{lkr(assets)}</span> in accounts</span>
          <span className="flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 rounded-full bg-out" /> <span className="num text-text">{lkr(-owed)}</span> owed</span>
        </div>
      </section>

      {reminders.length > 0 && (
        <section className="space-y-2">
          {reminders.slice(0, 3).map((r) => (
            <Link
              key={r.key}
              href={r.url}
              className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
                r.level === "danger" ? "border-out/40 bg-out/10" : r.level === "warn" ? "border-warn/30 bg-warn/10" : "border-line bg-surface"
              }`}
            >
              <span className={r.level === "danger" ? "text-out" : r.level === "warn" ? "text-warn" : "text-accent"}>
                {r.level === "info" ? <BellRing size={18} /> : <AlertTriangle size={18} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{r.title}</span>
                <span className="num block text-xs text-muted">{r.body}</span>
              </span>
              <ChevronRight size={16} className="text-faint" />
            </Link>
          ))}
        </section>
      )}

      {accounts.length === 0 && (
        <div className="card p-4 text-sm">
          No accounts yet. <Link href="/accounts/new" className="text-accent underline">Add your first account</Link> or run the seed SQL.
        </div>
      )}

      {/* This month */}
      <section className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><CalendarDays size={16} className="text-accent" /> {monthLabel(ym)}</h2>
            <p className="num mt-0.5 text-[11px] text-faint">Pay cycle {cycleSpan(ym)}</p>
          </div>
          <span className="eyebrow">{daysLeft} days left</span>
        </div>
        <ul className="space-y-2.5 text-sm">
          <Line Icon={ArrowDownLeft} tone="text-in" label="Money in" value={moneyIn} plus />
          <Line Icon={Repeat} label="Fixed payments" value={-fixed} />
          <Line Icon={CreditCard} label="Debt payments" value={-debt} />
          <Line Icon={ShoppingBag} tone="text-out" label="Spent" value={-other} />
        </ul>
        <div className="mt-4 flex items-end justify-between rounded-xl bg-surface-2 px-3.5 py-3">
          <div>
            <p className="font-semibold">Left this month</p>
            <p className="text-xs text-muted">{perDay > 0 ? "Safe to spend per day" : left < 0 ? "Over by this much" : "Nothing left to spread"}</p>
          </div>
          <div className="text-right">
            <p className={`num text-lg font-semibold ${left < 0 ? "text-out" : "text-accent"}`}>{lkr(left)}</p>
            {perDay > 0 && <p className="num text-xs text-muted">{lkr(perDay)} / day</p>}
          </div>
        </div>
      </section>

      {/* Credit cards */}
      {cards.length > 0 && (
        <section>
          <SectionHead title="Credit Cards" right={`${cards.length} active`} />
          <div className="space-y-2.5">
            {cards.map((c) => <CardTile key={c.id} card={c} status={statusById.get(c.id)} />)}
          </div>
        </section>
      )}

      {/* Accounts */}
      {money.length > 0 && (
        <section>
          <SectionHead title="Accounts" right={lkr(assets)} href="/accounts" />
          <div className="grid grid-cols-2 gap-2.5">
            {money.map((a) => (
              <Link key={a.id} href={`/accounts/${a.id}`} className="card p-3.5">
                <p className="flex items-center gap-1.5 truncate text-xs text-muted"><Landmark size={12} /> {a.name}</p>
                <p className={`num mt-1.5 text-[15px] font-semibold ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</p>
                {a.institution && <p className="mt-0.5 truncate text-[11px] text-faint">{a.institution}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recent */}
      <section>
        <SectionHead title="Recent transactions" right="View all" href="/transactions" accent />
        {(recentRes.data ?? []).length === 0 ? (
          <div className="card flex items-center gap-3 p-4 text-sm text-muted"><Receipt size={18} /> Nothing yet. Tap + to add your first transaction.</div>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {(recentRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHead({ title, right, href, accent }: { title: string; right?: string; href?: string; accent?: boolean }) {
  const r = <span className={`num text-xs ${accent ? "text-accent" : "text-muted"}`}>{right}</span>;
  return (
    <div className="mb-2.5 flex items-baseline justify-between px-0.5">
      <h2 className="font-semibold">{title}</h2>
      {href ? <Link href={href}>{r}</Link> : r}
    </div>
  );
}

function Line({ Icon, label, value, tone = "text-muted", plus }: { Icon: typeof ArrowUpRight; label: string; value: number; tone?: string; plus?: boolean }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`grid h-7 w-7 place-items-center rounded-lg bg-surface-2 ${tone}`}><Icon size={14} /></span>
      <span className="flex-1 text-muted">{label}</span>
      <span className={`num ${value > 0 && plus ? "text-in" : value < 0 ? "text-text" : "text-faint"}`}>{value > 0 && plus ? "+" : ""}{lkr(value)}</span>
    </li>
  );
}

function CardTile({ card, status }: { card: Account; status?: CardStatus }) {
  const owed = Math.max(-card.balance!, 0);
  const limit = card.credit_limit ?? 0;
  const available = limit ? limit - owed : null;
  const pct = limit ? Math.min(100, Math.round((owed / limit) * 100)) : 0;
  const tone = pct >= 80 ? "out" : pct >= 50 ? "warn" : "accent";
  const bar = { out: "bg-out", warn: "bg-warn", accent: "bg-accent" }[tone];
  const badge = { out: "text-out", warn: "text-warn", accent: "text-accent" }[tone];
  return (
    <Link href="/cards" className="card block p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="icon-tile text-accent"><CreditCard size={17} /></span>
          <div>
            <p className="font-semibold">{card.name}</p>
            {limit > 0 && <p className="num text-[11px] text-faint">{lkr(limit)} limit</p>}
          </div>
        </div>
        {limit > 0 && <span className={`tag ${badge}`}>{pct}% used</span>}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-2">
        <div>
          <p className="eyebrow">Owed</p>
          <p className="num text-lg font-semibold">{lkr(owed)}</p>
        </div>
        {available !== null && (
          <div className="text-right">
            <p className="eyebrow">Available</p>
            <p className="num text-lg font-semibold text-accent">{lkr(available)}</p>
          </div>
        )}
      </div>
      {limit > 0 && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      )}
      {status?.dueDate && status.remainingDue !== null ? (
        <p className={`num mt-2.5 flex items-center gap-1.5 text-[11px] ${status.overdue ? "text-out" : status.remainingDue > 0 ? "text-warn" : "text-muted"}`}>
          <CalendarDays size={12} />
          {status.remainingDue > 0
            ? `${lkr(status.remainingDue)} ${status.overdue ? "overdue since" : "due"} ${fmtDay(status.dueDate)}`
            : `Statement paid · next closes ${fmtDay(status.nextClose)}`}
        </p>
      ) : card.billing_day && card.due_day ? (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
          <CalendarDays size={12} /> Statement on the {ordinal(card.billing_day)} · due on the {ordinal(card.due_day)}
        </p>
      ) : null}
    </Link>
  );
}

function fmtDay(d: string | null) {
  return d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }) : "";
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
