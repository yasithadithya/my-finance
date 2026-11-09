import Link from "next/link";
import { lkr } from "@/lib/format";
import type { Account, Txn } from "@/lib/types";

// Arrow glyphs: money in (down-left), out (up-right), moved between accounts, adjusted.
const GLYPH = {
  income: { d: "M17 7 7 17M7 9v8h8", cls: "bg-in/14 text-in" },
  expense: { d: "M7 17 17 7M9 7h8v8", cls: "bg-out/14 text-out" },
  transfer: { d: "M4 9h14l-3-3M20 15H6l3 3", cls: "bg-surface-2 text-muted" },
  adjustment: { d: "M5 12h14", cls: "bg-surface-2 text-muted" },
} as const;

export default function TxnRow({ t, byId }: { t: Txn; byId: Map<string, Account> }) {
  const from = t.from_account_id ? byId.get(t.from_account_id)?.name ?? "—" : null;
  const to = t.to_account_id ? byId.get(t.to_account_id)?.name ?? "—" : null;
  const amount = Number(t.amount);

  let sub: string, value: string, tone: string;
  if (t.kind === "income") {
    sub = `Into ${to}`; value = "+" + lkr(amount); tone = "text-in";
  } else if (t.kind === "transfer") {
    sub = `${from} → ${to}`; value = lkr(amount); tone = "text-muted";
  } else if (t.kind === "adjustment") {
    sub = `Balance adjusted on ${from ?? to}`; value = (to ? "+" : "−") + lkr(amount); tone = "text-muted";
  } else {
    sub = from ?? ""; value = "−" + lkr(amount); tone = "";
  }
  const title = t.note || (t.kind === "transfer" ? "Transfer" : t.kind === "income" ? "Income" : t.kind === "adjustment" ? "Adjustment" : "Expense");
  const g = GLYPH[t.kind as keyof typeof GLYPH] ?? GLYPH.expense;

  return (
    <li>
      <Link href={`/transactions/${t.id}`} className="flex items-center gap-3.5 px-4 py-3">
        <span className={`avatar ${g.cls}`} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d={g.d} />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium">{title}</span>
          <span className="block truncate text-[0.8125rem] text-muted">{sub}</span>
        </span>
        <span className={`num shrink-0 text-[0.9375rem] font-semibold ${tone}`}>{value}</span>
      </Link>
    </li>
  );
}
