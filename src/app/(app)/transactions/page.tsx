import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { currentMonth, dayLabel, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import type { Txn } from "@/lib/types";
import TxnRow from "@/components/TxnRow";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href={link(shiftMonth(ym, -1))} className="btn btn-ghost px-3 py-2" aria-label="Previous month">‹</Link>
        <h1 className="text-lg font-semibold">{monthLabel(ym)}</h1>
        <Link href={link(shiftMonth(ym, 1))} className="btn btn-ghost px-3 py-2" aria-label="Next month">›</Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 text-sm">
        <Link href={link(ym, "")} className={`shrink-0 rounded-full border px-3 py-1 ${!account ? "border-accent text-accent" : "border-line text-muted"}`}>All</Link>
        {accounts.filter((a) => !a.archived).map((a) => (
          <Link key={a.id} href={link(ym, a.id)} className={`shrink-0 rounded-full border px-3 py-1 ${account === a.id ? "border-accent text-accent" : "border-line text-muted"}`}>
            {a.name}
          </Link>
        ))}
      </div>

      {txns.length === 0 ? (
        <p className="text-sm text-muted">No transactions this month.</p>
      ) : (
        [...groups.entries()].map(([date, list]) => (
          <section key={date}>
            <h2 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{dayLabel(date)}</h2>
            <ul className="card divide-y divide-line">
              {list.map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
