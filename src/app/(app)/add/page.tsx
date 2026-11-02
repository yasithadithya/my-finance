import Link from "next/link";
import { getAccounts } from "@/lib/data";
import { todayColombo } from "@/lib/format";
import TxnForm from "@/components/TxnForm";

export const dynamic = "force-dynamic";

export default async function AddPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const accounts = await getAccounts();
  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Add transaction</h1>
      {saved && <p className="mb-3 rounded-lg bg-surface-2 px-3 py-2 text-sm text-in">Saved. Add the next one.</p>}
      {accounts.length === 0 ? (
        <p className="text-sm text-muted">
          Add an account first: <Link href="/accounts/new" className="text-accent underline">new account</Link>.
        </p>
      ) : (
        <TxnForm key={saved ? Date.now() : "new"} accounts={accounts} today={todayColombo()} />
      )}
    </div>
  );
}
