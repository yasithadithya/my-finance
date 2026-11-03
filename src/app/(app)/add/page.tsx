import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAccounts } from "@/lib/data";
import { todayColombo } from "@/lib/format";
import TxnForm from "@/components/TxnForm";

export const dynamic = "force-dynamic";

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; kind?: string; to?: string; amount?: string }>;
}) {
  const { saved, kind, to, amount } = await searchParams;
  const accounts = await getAccounts();
  // Salary is paid into Com Bank, so income defaults there.
  const salaryAccountId = accounts.find((a) => a.type === "bank" && /^com\b/i.test(a.name))?.id;
  const defaultKind = kind === "income" || kind === "transfer" ? kind : undefined;
  return (
    <div>
      <header className="mb-5 flex items-center gap-3">
        <Link href="/" className="icon-tile" aria-label="Back"><ArrowLeft size={18} /></Link>
        <div>
          <p className="eyebrow">New entry</p>
          <h1 className="text-xl font-semibold leading-tight">Add Transaction</h1>
        </div>
      </header>
      {saved && <p className="mb-4 rounded-lg bg-in/10 px-3 py-2 text-sm text-in">Saved. Add the next one.</p>}
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          Add an account first: <Link href="/accounts/new" className="text-accent underline">new account</Link>.
        </p>
      ) : (
        <TxnForm key={saved ? Date.now() : "new"} accounts={accounts} today={todayColombo()} defaultKind={defaultKind} defaultTo={to ?? (defaultKind === "income" ? salaryAccountId : undefined)} salaryAccountId={salaryAccountId} defaultAmount={amount} />
      )}
    </div>
  );
}
