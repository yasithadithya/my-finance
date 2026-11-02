import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { lkr, ordinal } from "@/lib/format";
import type { RecurringItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const supabase = await createClient();
  const [{ data }, accounts] = await Promise.all([
    supabase.from("recurring_items").select("*").order("active", { ascending: false }).order("sort_order").order("name"),
    getAccounts({ includeArchived: true }),
  ]);
  const items = (data ?? []) as RecurringItem[];
  const byId = new Map(accounts.map((a) => [a.id, a.name]));
  const total = items.filter((i) => i.active).reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="space-y-5">
      <header>
        <Link href="/pay" className="inline-flex items-center gap-1 text-sm text-muted">‹ Pay</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="font-serif text-[1.75rem] leading-tight font-medium">Fixed payments</h1>
          <Link href="/pay/items/new" className="btn px-3 py-2 text-sm">+ New</Link>
        </div>
        <p className="num text-sm text-muted">{lkr(total)} a month</p>
      </header>

      {items.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet.</p>
      ) : (
        <ul className="ledger">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={`/pay/items/${i.id}`} className={`flex items-center justify-between gap-3 px-4 py-3 ${i.active ? "" : "text-muted"}`}>
                <span className="min-w-0">
                  <span className="block truncate">{i.name}{!i.active && " (off)"}</span>
                  <span className="block truncate text-xs text-muted">
                    {i.due_day ? `Due the ${ordinal(i.due_day)}` : "Any day"}
                    {i.pay_from_account_id ? ` · ${byId.get(i.pay_from_account_id) ?? "—"}` : " · ask each time"}
                    {i.end_month ? ` · until ${i.end_month.slice(0, 7)}` : ""}
                  </span>
                </span>
                <span className="num shrink-0">{lkr(i.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
