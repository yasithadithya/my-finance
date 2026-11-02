import Link from "next/link";
import { lkr } from "@/lib/format";
import type { Account, Txn } from "@/lib/types";

export default function TxnRow({ t, byId }: { t: Txn; byId: Map<string, Account> }) {
  const from = t.from_account_id ? byId.get(t.from_account_id)?.name ?? "—" : null;
  const to = t.to_account_id ? byId.get(t.to_account_id)?.name ?? "—" : null;
  const amount = Number(t.amount);

  let sub: string, value: string, tone: string;
  if (t.kind === "income") {
    sub = `into ${to}`; value = "+" + lkr(amount); tone = "text-in";
  } else if (t.kind === "transfer") {
    sub = `${from} → ${to}`; value = lkr(amount); tone = "text-muted";
  } else if (t.kind === "adjustment") {
    sub = `adjustment · ${from ?? to}`; value = (to ? "+" : "−") + lkr(amount); tone = "text-muted";
  } else {
    sub = from ?? ""; value = "−" + lkr(amount); tone = "";
  }
  const title = t.note || (t.kind === "transfer" ? "Transfer" : t.kind === "income" ? "Income" : "Expense");

  return (
    <li>
      <Link href={`/transactions/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate">{title}</span>
          <span className="block truncate text-xs text-muted">{sub}</span>
        </span>
        <span className={`num shrink-0 ${tone}`}>{value}</span>
      </Link>
    </li>
  );
}
