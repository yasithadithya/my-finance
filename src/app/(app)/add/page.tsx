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
      <h1 className="mb-5 font-serif text-2xl font-medium">Add transaction</h1>
      {saved && (
        <p className="mb-4 flex items-center gap-2 rounded-xl bg-in/10 px-3.5 py-2.5 text-sm text-in" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
          Saved. Add the next one.
        </p>
      )}
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
