import Link from "next/link";
import { HandCoins, Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { lkr, todayColombo } from "@/lib/format";
import { deleteReceivable, receivePayment, saveReceivable } from "@/app/actions";
import ActionForm from "@/components/ActionForm";

export const dynamic = "force-dynamic";

type Rec = { id: string; who: string; description: string | null; amount: number; status: string; expected_date: string | null };

const STATUS: Record<string, { label: string; tone: string }> = {
  waiting: { label: "Waiting", tone: "text-warn" },
  quoted: { label: "Quoted", tone: "text-muted" },
  partly_paid: { label: "Part paid", tone: "text-accent" },
  paid: { label: "Paid", tone: "text-in" },
};

export default async function ReceivablesPage() {
  const supabase = await createClient();
  const [{ data: recs }, { data: got }, accounts] = await Promise.all([
    supabase.from("receivables").select("*").order("created_at"),
    supabase.from("transactions").select("receivable_id, amount").not("receivable_id", "is", null),
    getAccounts(),
  ]);
  const receivedBy = new Map<string, number>();
  for (const t of got ?? []) receivedBy.set(t.receivable_id, (receivedBy.get(t.receivable_id) ?? 0) + Number(t.amount));
  const list = ((recs ?? []) as Rec[]).map((r) => {
    const received = receivedBy.get(r.id) ?? 0;
    return { ...r, amount: Number(r.amount), received, left: Math.max(Number(r.amount) - received, 0) };
  });
  const open = list.filter((r) => r.status !== "paid");
  const done = list.filter((r) => r.status === "paid");
  const outstanding = open.reduce((s, r) => s + r.left, 0);
  const confirmed = open.filter((r) => r.status !== "quoted").reduce((s, r) => s + r.left, 0);
  const into = accounts.filter((a) => a.type !== "credit_card" && a.type !== "loan");
  const today = todayColombo();

  return (
    <div className="space-y-6">
      <header>
        <Link href="/more" className="text-sm text-muted">‹ More</Link>
        <p className="eyebrow mt-1">Receivables</p>
        <h1 className="text-xl font-semibold">Money owed to me</h1>
      </header>

      <section className="hero p-5">
        <p className="eyebrow">Still to come in</p>
        <p className="num mt-1 text-[2rem] font-semibold leading-tight text-in">{lkr(outstanding)}</p>
        <p className="num mt-1 text-xs text-muted">{lkr(confirmed)} agreed · {lkr(outstanding - confirmed)} only quoted</p>
      </section>

      <details className="card p-4" open={list.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-2 font-semibold"><Plus size={16} className="text-accent" /> Add money owed</summary>
        <RecForm />
      </details>

      {open.length > 0 && (
        <ul className="space-y-2.5">
          {open.map((r) => (
            <li key={r.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="icon-tile text-accent"><HandCoins size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{r.who}</p>
                  {r.description && <p className="truncate text-xs text-muted">{r.description}</p>}
                  <p className="mt-1 flex items-center gap-2 text-[11px]">
                    <span className={`tag ${STATUS[r.status]?.tone}`}>{STATUS[r.status]?.label ?? r.status}</span>
                    {r.expected_date && <span className="text-faint">expected {r.expected_date}</span>}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{lkr(r.left)}</p>
                  {r.received > 0 && <p className="num text-[11px] text-faint">{lkr(r.received)} of {lkr(r.amount)} in</p>}
                </div>
              </div>
              {r.received > 0 && (
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full bg-in" style={{ width: `${(r.received / r.amount) * 100}%` }} />
                </div>
              )}
              <details className="mt-3">
                <summary className="btn w-full cursor-pointer list-none text-sm">Record money received</summary>
                <ActionForm action={receivePayment} submit="Save payment" className="mt-3 space-y-2.5">
                  <input type="hidden" name="receivable_id" value={r.id} />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input name="amount" defaultValue={r.left} inputMode="decimal" className="field num" aria-label="Amount received" required />
                    <input name="date" type="date" defaultValue={today} max={today} className="field" aria-label="Date received" />
                  </div>
                  <select name="to_account_id" defaultValue={into.find((a) => /^com\b/i.test(a.name))?.id ?? into[0]?.id} className="field" aria-label="Into account">
                    {into.map((a) => <option key={a.id} value={a.id}>Into {a.name}</option>)}
                  </select>
                </ActionForm>
              </details>
              <details className="mt-2">
                <summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-xs text-muted"><Pencil size={12} /> Edit</summary>
                <RecForm r={r} />
                <form action={deleteReceivable} className="mt-2">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="flex w-full items-center justify-center gap-1.5 text-xs text-out"><Trash2 size={12} /> Delete</button>
                </form>
              </details>
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-0.5 font-semibold text-muted">Received</h2>
          <ul className="card divide-y divide-line overflow-hidden opacity-70">
            {done.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-3.5 py-3">
                <span>{r.who}{r.description ? <span className="text-xs text-faint"> · {r.description}</span> : null}</span>
                <span className="num text-sm text-in">{lkr(r.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecForm({ r }: { r?: Rec }) {
  return (
    <ActionForm action={saveReceivable} submit={r ? "Save" : "Add"} className="mt-3 space-y-2.5">
      {r && <input type="hidden" name="id" value={r.id} />}
      <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
        <input name="who" defaultValue={r?.who} placeholder="Who" className="field" required />
        <input name="amount" defaultValue={r?.amount} inputMode="decimal" placeholder="Amount" className="field num" required />
      </div>
      <input name="description" defaultValue={r?.description ?? ""} placeholder="What for (optional)" className="field" />
      <div className="grid grid-cols-2 gap-2.5">
        <select name="status" defaultValue={r?.status ?? "waiting"} className="field">
          <option value="waiting">Waiting</option>
          <option value="quoted">Quoted, not agreed</option>
          <option value="partly_paid">Part paid</option>
          <option value="paid">Paid</option>
        </select>
        <input name="expected_date" type="date" defaultValue={r?.expected_date ?? ""} className="field" aria-label="Expected date" />
      </div>
    </ActionForm>
  );
}
