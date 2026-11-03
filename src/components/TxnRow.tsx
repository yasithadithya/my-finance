import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Scale } from "lucide-react";
import { lkr, timeColombo } from "@/lib/format";
import type { Account, Txn } from "@/lib/types";

export default function TxnRow({ t, byId, showTime = true }: { t: Txn; byId: Map<string, Account>; showTime?: boolean }) {
  const from = t.from_account_id ? byId.get(t.from_account_id)?.name ?? "—" : null;
  const to = t.to_account_id ? byId.get(t.to_account_id)?.name ?? "—" : null;
  const amount = Number(t.amount);

  let value: string, tone: string, Icon = ArrowUpRight, iconTone = "text-out", tags: string[];
  if (t.kind === "income") {
    value = "+" + lkr(amount); tone = "text-in"; Icon = ArrowDownLeft; iconTone = "text-in"; tags = [to!];
  } else if (t.kind === "transfer") {
    value = lkr(amount); tone = "text-text"; Icon = ArrowLeftRight; iconTone = "text-accent"; tags = [`${from} → ${to}`];
  } else if (t.kind === "adjustment") {
    value = (to ? "+" : "−") + lkr(amount); tone = "text-muted"; Icon = Scale; iconTone = "text-muted"; tags = [from ?? to!, "adjust"];
  } else {
    value = "−" + lkr(amount); tone = "text-out"; tags = [from!];
  }
  const title = t.note || (t.kind === "transfer" ? "Transfer" : t.kind === "income" ? "Income" : "Expense");

  return (
    <li>
      <Link href={`/transactions/${t.id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-surface-2">
        <span className={`icon-tile ${iconTone}`}><Icon size={17} /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          <span className="mt-0.5 flex gap-1.5 overflow-hidden">
            {tags.map((tg) => <span key={tg} className="tag truncate">{tg}</span>)}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className={`num block text-[15px] font-medium ${tone}`}>{value}</span>
          {showTime && <span className="num block text-[10px] text-faint">{timeColombo(t.created_at)}</span>}
        </span>
      </Link>
    </li>
  );
}
