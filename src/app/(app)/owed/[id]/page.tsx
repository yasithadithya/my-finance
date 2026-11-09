import Amount from "@/components/Amount";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts } from "@/lib/data";
import { loadReceivables } from "@/lib/reminders";
import { lkr, todayColombo } from "@/lib/format";
import { isDebtType, RECEIVABLE_STATUS_LABEL, type Txn } from "@/lib/types";
import { deleteReceivable } from "@/app/actions";
import { ReceivableForm, ReceiveForm } from "@/components/Forms";
import TxnRow from "@/components/TxnRow";

export const dynamic = "force-dynamic";

export default async function OwedItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const supabase = await createClient();
  const [all, accounts, txRes] = await Promise.all([
    loadReceivables(supabase),
    loadAccounts(supabase, { includeArchived: true }),
    supabase.from("transactions").select("*").eq("receivable_id", id).order("date", { ascending: false }),
  ]);
  const r = all.find((x) => x.id === id);
  if (!r) notFound();
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const into = accounts.filter((a) => !a.archived && !isDebtType(a.type)).map(({ id, name }) => ({ id, name }));

  return (
    <div className="page-in space-y-6">
      <PageHeader title={r.who} back={{ href: "/owed", label: "Owed to me" }}>
        {r.description && <p className="mt-1 text-[0.9375rem] text-muted">{r.description}</p>}
        <p className="mt-2 text-[2.5rem] text-in"><Amount value={r.outstanding} /></p>
        <p className="num mt-1 text-[0.8125rem] text-muted">
          {RECEIVABLE_STATUS_LABEL[r.shown_status]} · {lkr(r.received)} received of {lkr(r.amount)}
        </p>
      </PageHeader>

      {r.outstanding > 0 && into.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 px-1 text-[1.0625rem] font-semibold">Got paid?</h2>
          <ReceiveForm id={r.id} outstanding={r.outstanding} accounts={into} today={todayColombo()} />
        </section>
      )}

      {edit ? (
        <section className="card p-4">
          <ReceivableForm initial={r} />
        </section>
      ) : (
        <Link href={`/owed/${id}?edit=1`} className="btn btn-ghost w-full">Edit</Link>
      )}

      {(txRes.data ?? []).length > 0 && (
        <section>
          <div className="section-head"><h2>Received</h2></div>
          <ul className="ledger">
            {(txRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        </section>
      )}

      <form action={deleteReceivable}>
        <input type="hidden" name="id" value={r.id} />
        <button className="btn btn-ghost w-full text-out">Delete</button>
        <p className="mt-1.5 text-center text-xs text-muted">Money already received stays in your history.</p>
      </form>
    </div>
  );
}
