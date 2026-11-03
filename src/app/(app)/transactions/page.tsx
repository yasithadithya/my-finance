import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { currentMonth, cycleSpan, dayLabel, daysIntoCycle, lkr, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import type { Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; account?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const ym = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const account = sp.account ?? "";
  const q = (sp.q ?? "").trim();
  const { start, end } = monthRange(ym);

  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (account) query = query.or(`from_account_id.eq.${account},to_account_id.eq.${account}`);
  if (q) query = query.ilike("note", `%${q.replace(/[%_]/g, "")}%`);

  const [{ data }, accounts] = await Promise.all([query, getAccounts({ includeArchived: true })]);
  const txns = (data ?? []) as Txn[];
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const spent = txns.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const income = txns.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0);
  const daysSoFar = daysIntoCycle(ym);
  const dailyAvg = daysSoFar > 0 ? spent / daysSoFar : 0;

  const groups = new Map<string, Txn[]>();
  for (const t of txns) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  const link = (p: { month?: string; account?: string }) => {
    const params = new URLSearchParams();
    params.set("month", p.month ?? ym);
    const acc = p.account ?? account;
    if (acc) params.set("account", acc);
    if (q) params.set("q", q);
    return `/transactions?${params}`;
  };

  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow">History</p>
        <h1 className="text-xl font-semibold">Transactions</h1>
      </header>

      <section className="hero p-4">
        <div className="flex items-center justify-between">
          <Link href={link({ month: shiftMonth(ym, -1) })} className="icon-tile" aria-label="Previous month"><ChevronLeft size={18} /></Link>
          <div className="text-center">
            <p className="font-semibold"><span className="text-accent">•</span> {monthLabel(ym)}</p>
            <p className="num mt-0.5 text-[11px] text-muted">{cycleSpan(ym)} · {txns.length} entries</p>
          </div>
          <Link href={link({ month: shiftMonth(ym, 1) })} className="icon-tile" aria-label="Next month"><ChevronRight size={18} /></Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-surface-2 px-3 py-2.5">
            <p className="eyebrow">Spent</p>
            <p className="num font-semibold text-out">{lkr(spent)}</p>
          </div>
          <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-right">
            <p className="eyebrow">Income</p>
            <p className="num font-semibold text-in">{lkr(income)}</p>
          </div>
        </div>
        {spent > 0 && <p className="num mt-2.5 text-xs text-muted">Daily average {lkr(dailyAvg)} / day</p>}
      </section>

      <form className="relative" action="/transactions">
        <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" />
        <input type="hidden" name="month" value={ym} />
        {account && <input type="hidden" name="account" value={account} />}
        <input name="q" defaultValue={q} placeholder="Search notes…" className="field pl-10" enterKeyHint="search" />
      </form>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        <Link href={link({ account: "" })} className="chip" data-on={!account}>All</Link>
        {accounts.filter((a) => !a.archived).map((a) => (
          <Link key={a.id} href={link({ account: a.id })} className="chip" data-on={account === a.id}>{a.name}</Link>
        ))}
      </div>

      {txns.length === 0 ? (
        <p className="card p-4 text-sm text-muted">{q ? `No transactions matching "${q}".` : "No transactions this month."}</p>
      ) : (
        [...groups.entries()].map(([date, list]) => {
          const net = list.reduce((s, t) => s + (t.kind === "income" ? Number(t.amount) : t.kind === "expense" ? -Number(t.amount) : 0), 0);
          return (
            <section key={date}>
              <div className="mb-1.5 flex items-center justify-between px-0.5">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="h-1.5 w-1.5 rounded-full bg-accent" />{dayLabel(date)}</h2>
                {net !== 0 && <span className={`num text-xs ${net < 0 ? "text-out" : "text-in"}`}>{net > 0 ? "+" : ""}{lkr(net)}</span>}
              </div>
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
