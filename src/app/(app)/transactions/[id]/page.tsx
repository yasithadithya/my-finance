import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { todayColombo } from "@/lib/format";
import { deleteTxn } from "@/app/actions";
import TxnForm from "@/components/TxnForm";
import type { Txn } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditTxnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, accounts] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
    getAccounts({ includeArchived: true }),
  ]);
  if (!data) notFound();
  const t = data as Txn;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Edit transaction</h1>
      {t.kind === "adjustment" ? (
        <p className="text-sm text-muted">Adjustments come from reconciling and can only be deleted.</p>
      ) : (
        <TxnForm accounts={accounts} today={todayColombo()} initial={t} />
      )}
      <form action={deleteTxn}>
        <input type="hidden" name="id" value={t.id} />
        <input type="hidden" name="month" value={t.date.slice(0, 7)} />
        <button className="btn btn-ghost w-full text-out">Delete transaction</button>
      </form>
    </div>
  );
}
