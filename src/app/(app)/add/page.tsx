import Link from "next/link";
import { getAccounts } from "@/lib/data";
import { todayColombo } from "@/lib/format";
import TxnForm from "@/components/TxnForm";
import PageHeader from "@/components/PageHeader";

export const dynamic = "force-dynamic";

export default async function AddPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const accounts = await getAccounts();
  return (
    <div className="page-in space-y-5">
      <PageHeader title="Add transaction" />
      {saved && (
        <p className="notice bg-in/12 font-medium text-in" role="status">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m5 12 5 5L20 7" /></svg>
          Saved. Add the next one.
        </p>
      )}
      {accounts.length === 0 ? (
        <p className="card p-5 text-[0.9375rem] text-muted">
          Add an account first: <Link href="/accounts/new" className="link">new account</Link>.
        </p>
      ) : (
        <TxnForm key={saved ? Date.now() : "new"} accounts={accounts} today={todayColombo()} />
      )}
    </div>
  );
}
