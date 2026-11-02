import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { currentMonth, dayLabel, lkr, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import type { Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";
import MonthNav from "@/components/MonthNav";

/** "Today", "Yesterday" or the weekday name ("Monday"). */
function weekday(date: string) {
  const l = dayLabel(date);
  if (l === "Today" || l === "Yesterday") return l;
  return new Date(date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", timeZone: "UTC" });
}

const spentOn =(list: Txn[]) => list.filter((t) => t.kind === "expense").reduce((s, t) => s + Number(t.amount), 0);

export const dynamic = "force-dynamic";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; account?: string }>;
}) {
  const sp = await searchParams;
  const ym = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : currentMonth();
  const account = sp.account ?? "";
  const { start, end } = monthRange(ym);

  const supabase = await createClient();
  let q = supabase
    .from("transactions")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (account) q = q.or(`from_account_id.eq.${account},to_account_id.eq.${account}`);

  const [{ data }, accounts] = await Promise.all([q, getAccounts({ includeArchived: true })]);
  const txns = (data ?? []) as Txn[];
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const groups = new Map<string, Txn[]>();
  for (const t of txns) groups.set(t.date, [...(groups.get(t.date) ?? []), t]);

  const link = (m: string, acc = account) => `/transactions?month=${m}${acc ? `&account=${acc}` : ""}`;

  return (
    <div className="space-y-5">
      <MonthNav label={monthLabel(ym)} prev={link(shiftMonth(ym, -1))} next={link(shiftMonth(ym, 1))} />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link href={link(ym, "")} className="pill" aria-current={!account ? "true" : undefined}>All</Link>
        {accounts.filter((a) => !a.archived).map((a) => (
          <Link key={a.id} href={link(ym, a.id)} className="pill" aria-current={account === a.id ? "true" : undefined}>
            {a.name}
          </Link>
        ))}
      </div>

      {txns.length === 0 ? (
        <p className="card p-4 text-sm text-muted">
          No transactions this month. <Link href="/add" className="text-accent underline">Add one</Link>.
        </p>
      ) : (
        [...groups.entries()].map(([date, list]) => (
          <section key={date}>
            <div className="mb-2 flex items-end justify-between gap-3 px-1">
              <h2 className="flex items-baseline gap-2">
                <span className="font-serif text-2xl leading-none font-medium num">{Number(date.slice(8, 10))}</span>
                <span className="text-sm text-muted">{weekday(date)}</span>
              </h2>
              {spentOn(list) > 0 && <span className="num text-xs text-muted">Spent {lkr(spentOn(list))}</span>}
            </div>
            <ul className="ledger">
              {list.map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
