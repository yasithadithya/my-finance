import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { lkr, todayColombo } from "@/lib/format";
import type { Txn } from "@/lib/types";
import AccountForm from "@/components/AccountForm";
import TxnRow from "@/components/TxnRow";
import ActionForm from "@/components/ActionForm";
import { reconcile } from "@/app/actions";
import { Scale } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; reconciled?: string }>;
}) {
  const { id } = await params;
  const { edit, reconciled } = await searchParams;
  const accounts = await getAccounts({ includeArchived: true });
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const supabase = await createClient();
  const { data: lastRec } = await supabase.from("reconciliations").select("date").eq("account_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const { data } = await supabase
    .from("transactions")
    .select("*")
    .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const isCard = account.type === "credit_card";
  const owed = Math.max(-account.balance!, 0);

  return (
    <div className="space-y-5">
      <Link href="/accounts" className="text-sm text-muted">‹ Accounts</Link>
      <header className="hero p-5">
        <p className="eyebrow">{account.institution ?? account.type.replace("_", " ")}</p>
        <h1 className="text-xl font-semibold">{account.name}</h1>
        <p className={`num mt-1 text-3xl font-semibold ${account.balance! < 0 ? "text-out" : "text-accent"}`}>{lkr(account.balance)}</p>
        {isCard && account.credit_limit ? (
          <p className="num text-sm text-muted">
            {lkr(account.credit_limit - owed)} available of {lkr(account.credit_limit)}
          </p>
        ) : null}
        <p className="num mt-1 text-xs text-muted">
          Opening {lkr(account.opening_balance)} on {account.opening_date}
        </p>
      </header>

      {reconciled !== undefined && (
        <p className={`rounded-lg px-3 py-2 text-sm ${Number(reconciled) === 0 ? "bg-in/10 text-in" : "bg-warn/10 text-warn"}`}>
          {Number(reconciled) === 0 ? "Matches your bank exactly." : `Adjusted by ${lkr(Number(reconciled))} to match your bank.`}
        </p>
      )}

      <details className="card p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between">
          <span className="flex items-center gap-2 font-semibold"><Scale size={16} className="text-accent" /> Reconcile with bank</span>
          <span className="text-[11px] text-faint">{lastRec ? `last ${lastRec.date}` : "never"}</span>
        </summary>
        <p className="mt-2 text-xs text-muted">Type the number your bank app shows. If it differs, the app adds an adjustment so the balances match.</p>
        <ActionForm action={reconcile} submit="Reconcile" className="mt-3 space-y-2.5">
          <input type="hidden" name="account_id" value={id} />
          {isCard ? (
            <select name="mode" defaultValue="available" className="field">
              <option value="available">Available credit (what the bank app shows)</option>
              <option value="balance">Amount owed (enter as negative)</option>
            </select>
          ) : (
            <input type="hidden" name="mode" value="balance" />
          )}
          <input name="value" inputMode="decimal" placeholder={isCard ? "e.g. 92262.66" : "Balance in bank app"} className="field num" required />
        </ActionForm>
      </details>

      {edit ? (
        <section className="card p-4">
          <AccountForm initial={account} today={todayColombo()} />
        </section>
      ) : (
        <Link href={`/accounts/${id}?edit=1`} className="btn btn-ghost w-full">Edit account</Link>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Latest transactions</h2>
          <Link href={`/transactions?account=${id}`} className="text-xs text-accent">By month</Link>
        </div>
        {(data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="card divide-y divide-line overflow-hidden">
            {(data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
