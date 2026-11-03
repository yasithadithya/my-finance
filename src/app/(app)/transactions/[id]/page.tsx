import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts, toPlan } from "@/lib/data";
import { billedCount, firstStatementMonth, hasInterest, leftToPay, totalPayable } from "@/lib/statements";
import { currentMonth, lkr, monthLabel, shiftMonth, todayColombo } from "@/lib/format";
import { deletePlan, deleteTxn } from "@/app/actions";
import TxnForm from "@/components/TxnForm";
import { PlanForm } from "@/components/Forms";
import type { Txn } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditTxnPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ convert?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const [{ data }, accounts, planRes] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", id).maybeSingle(),
    getAccounts({ includeArchived: true }),
    supabase.from("instalment_plans").select("*").eq("purchase_txn_id", id).maybeSingle(),
  ]);
  if (!data) notFound();
  const t = data as Txn;
  const ym = currentMonth();
  const card = accounts.find((a) => a.id === t.from_account_id && a.type === "credit_card");
  const canConvert = t.kind === "expense" && !!card && !t.instalment_plan_id && !t.recurring_item_id;
  const plan = planRes.data ? toPlan(planRes.data) : null;
  const isCharge = !!t.instalment_plan_id;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-[1.75rem] leading-tight font-medium">Edit transaction</h1>

      {plan && (
        <section className="card p-4">
          <h2 className="font-medium">On instalments</h2>
          <p className="num mt-1 text-sm">
            {plan.months} × {lkr(plan.monthly_amount)}
            {hasInterest(plan) ? ` at ${plan.interest_rate}% a year (${lkr(totalPayable(plan))} in all)` : ", no interest"}
          </p>
          <p className="num mt-1 text-xs text-muted">
            {monthLabel(plan.first_billing_month.slice(0, 7))} to {monthLabel(shiftMonth(plan.first_billing_month.slice(0, 7), plan.months - 1))} statements
            · {billedCount(plan, ym)} of {plan.months} billed · {lkr(leftToPay(plan, ym))} left
          </p>
          <p className="mt-2 text-xs text-muted">
            The full amount stays on the card as debt. Each month counts only its instalment, and it shows on the Pay tab until the plan ends.
          </p>
          <div className="mt-3 flex gap-4 text-sm">
            <Link href={`/accounts/${plan.card_account_id}?plan=${plan.id}#plans`} className="text-accent">Edit plan</Link>
            <form action={deletePlan}>
              <input type="hidden" name="id" value={plan.id} />
              <input type="hidden" name="back" value={`/transactions/${t.id}`} />
              <button className="text-muted">Undo conversion</button>
            </form>
          </div>
        </section>
      )}

      {canConvert && !plan && (
        sp.convert ? (
          <section id="convert" className="card p-4">
            <h2 className="mb-1 font-medium">Convert to instalments</h2>
            <p className="mb-3 text-xs text-muted">The debt on {card!.name} stays as it is. Each statement bills one instalment.</p>
            <PlanForm
              cardId={card!.id}
              thisMonth={ym}
              purchase={{ id: t.id, name: t.note ?? "", amount: Number(t.amount), firstMonth: firstStatementMonth(t.date, card!.billing_day) }}
            />
          </section>
        ) : (
          <Link href={`/transactions/${t.id}?convert=1#convert`} className="btn btn-ghost w-full">Convert to instalments</Link>
        )
      )}

      {t.kind === "adjustment" ? (
        <p className="text-sm text-muted">Adjustments come from reconciling and can only be deleted.</p>
      ) : isCharge ? (
        <p className="text-sm text-muted">
          This is the monthly interest of an instalment plan. The app books it on the statement day.{" "}
          <Link href={`/accounts/${t.from_account_id}#plans`} className="text-accent underline">Change the plan</Link> to change it.
        </p>
      ) : (
        <TxnForm accounts={accounts} today={todayColombo()} initial={t} />
      )}
      {!isCharge && (
        <form action={deleteTxn}>
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="month" value={t.date.slice(0, 7)} />
          <button className="btn btn-ghost w-full text-out">{plan ? "Delete transaction and its plan" : "Delete transaction"}</button>
        </form>
      )}
    </div>
  );
}
