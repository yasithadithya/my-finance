import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, toPlan } from "@/lib/data";
import { billedCount, ensureStatements, hasInterest, leftToPay, totalPayable, unbilled } from "@/lib/statements";
import { currentMonth, lkr, ordinal, shortDate, todayColombo } from "@/lib/format";
import type { Reconciliation, Txn } from "@/lib/types";
import { deletePlan, deleteStatement } from "@/app/actions";
import AccountForm from "@/components/AccountForm";
import TxnRow from "@/components/TxnRow";
import Amount from "@/components/Amount";
import { StatusChip } from "@/components/Reminders";
import { PlanForm, ReconcileForm, StatementForm } from "@/components/Forms";
import PageHeader from "@/components/PageHeader";
import { Icon, ICONS } from "@/components/Icons";

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
    <div className="page-in space-y-6">
      <PageHeader title={account.name} back={{ href: "/accounts", label: "Accounts" }}>
        <p className={`mt-2 text-[2.5rem] ${account.balance! < 0 ? "text-out" : ""}`}><Amount value={account.balance!} /></p>
        {isCard && account.credit_limit ? (
          <p className="num mt-1 text-[0.9375rem] text-muted">
            {lkr(account.credit_limit - owed)} available of {lkr(account.credit_limit)}
          </p>
        ) : null}
        {isCard && held > 0 && (
          <p className="num text-[0.8125rem] text-muted">{lkr(held)} of that is instalments not billed yet</p>
        )}
        <p className="num mt-1 text-[0.8125rem] text-muted">
          Opening {lkr(account.opening_balance)} on {account.opening_date}
        </p>
      </PageHeader>

      {sp.reconciled && (
        <p className="notice bg-in/12 text-in">Reconciled. The balance now matches your bank.</p>
      )}

      {sp.edit ? (
        <section className="card p-4">
          <AccountForm initial={account} today={today} />
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/accounts/${id}?edit=1`} className="btn btn-ghost w-full">
            <Icon d={ICONS.edit} size={18} /> Edit
          </Link>
          <Link href={`/accounts/${id}?reconcile=1#reconcile`} className="btn btn-ghost w-full">
            <Icon d={ICONS.scale} size={18} /> Reconcile
          </Link>
        </div>
      )}

      {sp.reconcile && (
        <section id="reconcile" className="card p-4">
          <h2 className="mb-3 px-1 text-[1.0625rem] font-semibold">Reconcile with your bank</h2>
          <ReconcileForm account={account} />
        </section>
      )}

      {isCard && (
        <section id="statements">
          <div className="section-head">
            <h2>Statements</h2>
            <Link href={`/accounts/${id}?stmt=new#statements`} className="link">+ Add past statement</Link>
          </div>
          {(sp.stmt === "new" || editingStmt) && (
            <div className="card mb-2 p-4">
              <StatementForm key={editingStmt?.id ?? "new"} cardId={id} initial={editingStmt} today={today} />
            </div>
          )}
          {!account.billing_day || !account.due_day ? (
            <p className="card p-5 text-[0.9375rem] text-muted">Set the statement day and due day (Edit account) to get statements.</p>
          ) : myStatements.length === 0 ? (
            <p className="card p-5 text-[0.9375rem] text-muted">The first statement appears on the {ordinal(account.billing_day)}. Add an older one if a bill is still due.</p>
          ) : (
            <ul className="ledger">
              {myStatements.map((s) => (
                <li key={s.id} className="px-4 py-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-[0.9375rem] font-medium">{shortDate(s.statement_date)} statement</span>
                      <span className="block text-[0.8125rem] text-muted">
                        Due {shortDate(s.due_date)}
                        {s.instalments > 0 && ` · incl. ${lkr(s.instalments)} instalment`}
                        {s.source === "edited" && " · edited"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="num block font-semibold">{lkr(s.statement_balance)}</span>
                      <StatusChip status={s.status} days={s.days_left} />
                    </span>
                  </div>
                  {s.paid > 0 && <p className="num mt-1 text-xs text-muted">{lkr(s.paid)} paid · {lkr(s.remaining)} left</p>}
                  <div className="mt-2 flex gap-5 text-[0.8125rem]">
                    <Link href={`/accounts/${id}?stmt=${s.id}#statements`} className="link">Correct amount</Link>
                    {s.source === "edited" && (
                      <form action={deleteStatement}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="account_id" value={id} />
                        <button className="font-semibold text-muted">{s.statement_date >= account.opening_date ? "Reset to auto" : "Delete"}</button>
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
            <h2>Instalment plans</h2>
            <Link href={`/accounts/${id}?plan=new#plans`} className="link">+ Add plan</Link>
          </div>
          {(sp.plan === "new" || editingPlan) && (
            <div className="card mb-2 p-4">
              <PlanForm key={editingPlan?.id ?? "new"} cardId={id} initial={editingPlan} thisMonth={ym} />
            </div>
          )}
          {plans.length === 0 ? (
            <p className="card p-5 text-[0.9375rem] text-muted">
              None. To convert a purchase, open it from Latest transactions and tap Convert to instalments. The bank holds the full
              amount against the card; a plan tells statements how much is billed each month.
            </p>
          ) : (
            <ul className="ledger">
              {plans.map((p) => {
                const done = billedCount(p, ym);
                return (
                  <li key={p.id} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[0.9375rem] font-medium">{p.name}</span>
                      <span className="num shrink-0 font-semibold">{lkr(p.monthly_amount)}/mo</span>
                    </div>
                    <div className="meter mt-2">
                      <div className="h-full bg-accent" style={{ width: `${Math.round((done / p.months) * 100)}%` }} />
                    </div>
                    <div className="num mt-1.5 flex justify-between text-xs text-muted">
                      <span>{done} of {p.months} billed{hasInterest(p) ? ` · ${p.interest_rate}% a year` : " · 0%"}</span>
                      <span>{lkr(leftToPay(p, ym))} left of {lkr(totalPayable(p))}</span>
                    </div>
                    <div className="mt-2 flex gap-5 text-[0.8125rem]">
                      <Link href={`/accounts/${id}?plan=${p.id}#plans`} className="link">Edit</Link>
                      {p.purchase_txn_id && <Link href={`/transactions/${p.purchase_txn_id}`} className="link">Purchase</Link>}
                      <form action={deletePlan}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="card_account_id" value={id} />
                        <button className="font-semibold text-muted">Delete</button>
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
          <h2>Latest transactions</h2>
          <Link href={`/transactions?account=${id}`} className="link">By month</Link>
        </div>
        {(txRes.data ?? []).length === 0 ? (
          <p className="card p-5 text-[0.9375rem] text-muted">No transactions yet.</p>
        ) : (
          <ul className="ledger">
            {(txRes.data as Txn[]).map((t) => <TxnRow key={t.id} t={t} byId={byId} />)}
          </ul>
        )}
      </section>

      {recs.length > 0 && (
        <section>
          <div className="section-head"><h2>Reconciled</h2></div>
          <ul className="ledger text-sm">
            {recs.map((r) => {
              const diff = Number(r.actual_balance) - Number(r.computed_balance);
              return (
                <li key={r.id} className="num flex justify-between px-4 py-3.5">
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
