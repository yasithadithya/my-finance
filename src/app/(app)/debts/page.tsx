import Amount from "@/components/Amount";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, toPlan } from "@/lib/data";
import { unbilled, billedCount, leftToPay } from "@/lib/statements";
import { planPayoff, type Debt } from "@/lib/payoff";
import { currentMonth, lkr, monthLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DebtsPage({ searchParams }: { searchParams: Promise<{ budget?: string; method?: string }> }) {
  const sp = await searchParams;
  const ym = currentMonth();
  const supabase = await createClient();
  const [accounts, plRes] = await Promise.all([loadAccounts(supabase), supabase.from("instalment_plans").select("*")]);

  const debtAccounts = accounts.filter((a) => (a.type === "credit_card" || a.type === "loan") && a.balance! < 0);
  const plans = (plRes.data ?? []).map(toPlan).filter((p) => unbilled(p, ym) > 0 && debtAccounts.some((a) => a.id === p.card_account_id));

  // A card's debt minus the instalments the bank holds = the part that can carry interest.
  const debts: Debt[] = debtAccounts.map((a) => {
    const held = plans.filter((p) => p.card_account_id === a.id).reduce((s, p) => s + unbilled(p, ym), 0);
    return { id: a.id, name: a.name, balance: Math.max(0, -a.balance! - held), rate: a.interest_rate ?? 0 };
  });
  const totalOwed = debtAccounts.reduce((s, a) => s - a.balance!, 0);
  const totalHeld = plans.reduce((s, p) => s + unbilled(p, ym), 0);

  const budget = Number((sp.budget ?? "").replace(/,/g, ""));
  const method = sp.method === "snowball" ? "snowball" : "avalanche";
  const plan = budget > 0 ? planPayoff(debts, plans, budget, method, ym) : null;

  return (
    <div className="space-y-5">
      <header>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted">‹ Home</Link>
        <h1 className="mt-1 font-serif text-[1.75rem] leading-tight font-medium">Debts</h1>
        <p className="mt-2 text-[2.25rem] font-medium text-out"><Amount value={-totalOwed} /></p>
        {totalHeld > 0 && <p className="num text-xs text-muted">{lkr(totalHeld)} of it is instalments, billed month by month</p>}
      </header>

      {debtAccounts.length === 0 ? (
        <p className="card p-4 text-sm">No debts. Nice.</p>
      ) : (
        <ul className="ledger">
          {debtAccounts.map((a) => {
            const d = debts.find((x) => x.id === a.id)!;
            return (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate">{a.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {a.interest_rate ? `${a.interest_rate}% a year` : "No interest rate set"}
                      {d.balance < -a.balance! - 0.005 && ` · ${lkr(d.balance)} outside instalments`}
                    </span>
                  </span>
                  <span className="num shrink-0 text-out">{lkr(a.balance)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {plans.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-muted">Instalments running</h2>
          <ul className="ledger text-sm">
            {plans.map((p) => (
              <li key={p.id} className="num flex justify-between px-4 py-2.5">
                <span>{p.name} · {billedCount(p, ym)}/{p.months}</span>
                <span>{lkr(p.monthly_amount)}/mo · {lkr(leftToPay(p, ym))} left</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {debtAccounts.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-medium">Payoff planner</h2>
          <form className="space-y-3">
            <div>
              <label className="label" htmlFor="budget">I can put this toward debt each month</label>
              <input id="budget" name="budget" inputMode="decimal" defaultValue={sp.budget ?? ""} placeholder="e.g. 25000" className="field num" required />
            </div>
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1 text-sm">
              {(["avalanche", "snowball"] as const).map((m) => (
                <label key={m} className="cursor-pointer rounded-lg py-2 text-center font-medium text-muted has-checked:bg-surface-2 has-checked:text-text has-checked:ring-1 has-checked:ring-accent/60">
                  <input type="radio" name="method" value={m} defaultChecked={method === m} className="sr-only" />
                  {m === "avalanche" ? "Highest interest first" : "Smallest first"}
                </label>
              ))}
            </div>
            <button className="btn w-full">Plan it</button>
          </form>

          {plan && (
            <div className="mt-4 space-y-3 border-t border-line pt-4">
              {plan.ok ? (
                <p>
                  Debt-free in <strong>{plan.months} month{plan.months === 1 ? "" : "s"}</strong>, by{" "}
                  <strong>{monthLabel(plan.debtFree!)}</strong>.
                </p>
              ) : (
                <p className="text-out">That budget doesn&apos;t clear the debt. Interest or instalments grow faster than you pay. Try a bigger amount.</p>
              )}
              <p className="num text-sm text-muted">Interest along the way: {lkr(plan.totalInterest)}</p>
              <ul className="divide-y divide-line text-sm">
                {plan.cleared.map((c) => (
                  <li key={c.id} className="num flex justify-between py-2">
                    <span>{c.name}</span>
                    <span className="text-muted">{c.month ? `paid off ${monthLabel(c.month)}` : "not cleared"}</span>
                  </li>
                ))}
              </ul>
              {plan.firstMonth.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted">Next month, pay</p>
                  <ul className="num space-y-1 text-sm">
                    {plan.firstMonth.map((f) => (
                      <li key={f.name} className="flex justify-between">
                        <span>{f.name}</span>
                        <span>{lkr(f.pay)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {debts.some((d) => !d.rate && d.balance > 0) && (
                <p className="text-xs text-muted">Debts without an interest rate are treated as 0%. Set rates on the account (Edit account).</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
