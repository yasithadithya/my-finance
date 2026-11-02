import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, toPlan } from "@/lib/data";
import { billedCount, ensureStatements, unbilled } from "@/lib/statements";
import { currentMonth, lkr, ordinal, shortDate, todayColombo } from "@/lib/format";
import type { Reconciliation, Txn } from "@/lib/types";
import { deletePlan, deleteStatement } from "@/app/actions";
import AccountForm from "@/components/AccountForm";
import TxnRow from "@/components/TxnRow";
import Amount from "@/components/Amount";
import { StatusChip } from "@/components/Reminders";
import { PlanForm, ReconcileForm, StatementForm } from "@/components/Forms";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string; plan?: string; stmt?: string; reconcile?: string; reconciled?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const accounts = await loadAccounts(supabase, { includeArchived: true });
  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const today = todayColombo();
  const ym = currentMonth();
  const isCard = account.type === "credit_card";

  const [txRes, recRes, plRes, statements] = await Promise.all([
    supabase
      .from("transactions")
      .select("*")
      .or(`from_account_id.eq.${id},to_account_id.eq.${id}`)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(30),
    supabase.from("reconciliations").select("*").eq("account_id", id).order("created_at", { ascending: false }).limit(5),
    isCard ? supabase.from("instalment_plans").select("*").eq("card_account_id", id).order("first_billing_month") : Promise.resolve({ data: [] }),
    isCard ? ensureStatements(supabase, accounts, today) : Promise.resolve([]),
  ]);
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const plans = (plRes.data ?? []).map(toPlan);
  const myStatements = statements.filter((s) => s.account_id === id).slice(0, 12);
  const recs = (recRes.data ?? []) as Reconciliation[];
  const held = plans.reduce((s, p) => s + unbilled(p, ym), 0);

  const owed = Math.max(-account.balance!, 0);
  const editingPlan = sp.plan && sp.plan !== "new" ? plans.find((p) => p.id === sp.plan) : undefined;
  const editingStmt = sp.stmt && sp.stmt !== "new" ? myStatements.find((s) => s.id === sp.stmt) : undefined;

  return (
    <div className="space-y-6">
      <header>
        <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-muted">‹ Accounts</Link>
        <h1 className="mt-1 font-serif text-[1.75rem] leading-tight font-medium">{account.name}</h1>
        <p className={`mt-2 text-[2.25rem] font-medium ${account.balance! < 0 ? "text-out" : ""}`}><Amount value={account.balance!} /></p>
        {isCard && account.credit_limit ? (
          <p className="num text-sm text-muted">
            {lkr(account.credit_limit - owed)} available of {lkr(account.credit_limit)}
          </p>
        ) : null}
        {isCard && held > 0 && (
          <p className="num text-xs text-muted">{lkr(held)} of that is instalments not billed yet</p>
        )}
        <p className="num mt-1 text-xs text-muted">
          Opening {lkr(account.opening_balance)} on {account.opening_date}
        </p>
      </header>

      {sp.reconciled && (
        <p className="rounded-xl bg-in/10 px-3.5 py-2.5 text-sm text-in">Reconciled. The balance now matches your bank.</p>
      )}

      {sp.edit ? (
        <section className="card p-4">
          <AccountForm initial={account} today={today} />
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/accounts/${id}?edit=1`} className="btn btn-ghost w-full">Edit account</Link>
          <Link href={`/accounts/${id}?reconcile=1#reconcile`} className="btn btn-ghost w-full">Reconcile</Link>
        </div>
      )}

      {sp.reconcile && (
        <section id="reconcile" className="card p-4">
          <h2 className="mb-3 font-medium">Reconcile with your bank</h2>
          <ReconcileForm account={account} />
        </section>
      )}

      {isCard && (
        <section id="statements">
          <div className="section-head">
            <h2 className="text-sm font-medium text-muted">Statements</h2>
            <Link href={`/accounts/${id}?stmt=new#statements`} className="text-xs text-accent">+ Add past statement</Link>
          </div>
          {(sp.stmt === "new" || editingStmt) && (
            <div className="card mb-2 p-4">
              <StatementForm key={editingStmt?.id ?? "new"} cardId={id} initial={editingStmt} today={today} />
            </div>
          )}
          {!account.billing_day || !account.due_day ? (
            <p className="text-sm text-muted">Set the statement day and due day (Edit account) to get statements.</p>
          ) : myStatements.length === 0 ? (
            <p className="text-sm text-muted">The first statement appears on the {ordinal(account.billing_day)}. Add an older one if a bill is still due.</p>
          ) : (
            <ul className="ledger">
              {myStatements.map((s) => (
                <li key={s.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block">{shortDate(s.statement_date)} statement</span>
                      <span className="block text-xs text-muted">
                        Due {shortDate(s.due_date)}
                        {s.instalments > 0 && ` · incl. ${lkr(s.instalments)} instalment`}
                        {s.source === "edited" && " · edited"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block">{lkr(s.statement_balance)}</span>
                      <StatusChip status={s.status} days={s.days_left} />
                    </span>
                  </div>
                  {s.paid > 0 && <p className="num mt-1 text-xs text-muted">{lkr(s.paid)} paid · {lkr(s.remaining)} left</p>}
                  <div className="mt-1.5 flex gap-4 text-xs">
                    <Link href={`/accounts/${id}?stmt=${s.id}#statements`} className="text-accent">Correct amount</Link>
                    {s.source === "edited" && (
                      <form action={deleteStatement}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="account_id" value={id} />
                        <button className="text-muted">{s.statement_date >= account.opening_date ? "Reset to auto" : "Delete"}</button>
                      </form>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isCard && (
        <section id="plans">
          <div className="section-head">
            <h2 className="text-sm font-medium text-muted">Instalment plans</h2>
            <Link href={`/accounts/${id}?plan=new#plans`} className="text-xs text-accent">+ Add plan</Link>
          </div>
          {(sp.plan === "new" || editingPlan) && (
            <div className="card mb-2 p-4">
              <PlanForm key={editingPlan?.id ?? "new"} cardId={id} initial={editingPlan} thisMonth={ym} />
            </div>
          )}
          {plans.length === 0 ? (
            <p className="text-sm text-muted">None. The bank holds the full amount against the card; a plan tells statements how much is billed each month.</p>
          ) : (
            <ul className="ledger">
              {plans.map((p) => {
                const done = billedCount(p, ym);
                return (
                  <li key={p.id} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate">{p.name}</span>
                      <span className="num shrink-0">{lkr(p.monthly_amount)}/mo</span>
                    </div>
                    <div className="meter mt-2">
                      <div className="h-full bg-accent" style={{ width: `${Math.round((done / p.months) * 100)}%` }} />
                    </div>
                    <div className="num mt-1.5 flex justify-between text-xs text-muted">
                      <span>{done} of {p.months} billed</span>
                      <span>{lkr(unbilled(p, ym))} left of {lkr(p.total_price)}</span>
                    </div>
                    <div className="mt-1.5 flex gap-4 text-xs">
                      <Link href={`/accounts/${id}?plan=${p.id}#plans`} className="text-accent">Edit</Link>
                      <form action={deletePlan}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="card_account_id" value={id} />
                        <button className="text-muted">Delete</button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section>
        <div className="section-head">
          <h2 className="text-sm font-medium text-muted">Latest transactions</h2>
          <Link href={`/transactions?account=${id}`} className="text-xs text-accent">By month</Link>
        </div>
        {(txRes.data ?? []).length === 0 ? (
          <p className="text-sm text-muted">No transactions yet.</p>
        ) : (
          <ul className="ledger">
            {(txRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>

      {recs.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-muted">Reconciled</h2>
          <ul className="ledger text-sm">
            {recs.map((r) => {
              const diff = Number(r.actual_balance) - Number(r.computed_balance);
              return (
                <li key={r.id} className="num flex justify-between px-4 py-2.5">
                  <span>{shortDate(r.date)}</span>
                  <span className={Math.abs(diff) < 0.01 ? "text-in" : "text-muted"}>
                    {Math.abs(diff) < 0.01 ? "Matched" : `Adjusted ${diff > 0 ? "+" : ""}${lkr(diff)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
