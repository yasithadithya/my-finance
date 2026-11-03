import Link from "next/link";
import { CreditCard, HandCoins, Package, ShieldCheck, Target } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadCards } from "@/lib/finance";
import { currentMonth, lkr, monthLabel, shiftMonth } from "@/lib/format";
import { saveSetting } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const supabase = await createClient();
  const [{ statuses, accounts }, settingRes] = await Promise.all([
    loadCards(supabase),
    supabase.from("settings").select("value").eq("key", "payoff_months").maybeSingle(),
  ]);
  const months = Math.max(1, Number(settingRes.data?.value ?? 3));
  const loans = accounts.filter((a) => a.type === "loan" && a.balance! < 0);

  const rows = [
    ...statuses.map((s) => ({
      id: s.card.id, name: s.card.name, Icon: CreditCard,
      owed: s.owedNow, held: s.held, revolving: Math.max(s.owedNow - s.held, 0),
    })),
    ...loans.map((l) => ({ id: l.id, name: l.name, Icon: HandCoins, owed: -l.balance!, held: 0, revolving: -l.balance! })),
  ].filter((r) => r.owed > 0);

  const totalOwed = rows.reduce((s, r) => s + r.owed, 0);
  const held = rows.reduce((s, r) => s + r.held, 0);
  const toClear = rows.reduce((s, r) => s + r.revolving, 0);
  const perMonth = toClear / months;
  const instalmentsPerMonth = statuses.flatMap((s) => s.plans).filter((p) => p.remainingMonths > 0).reduce((s, p) => s + p.plan.monthly_amount, 0);
  const clearBy = monthLabel(shiftMonth(currentMonth(), months - 1));

  return (
    <div className="space-y-6">
      <header>
        <Link href="/more" className="text-sm text-muted">‹ More</Link>
        <p className="eyebrow mt-1">Debts & payoff</p>
        <h1 className="text-xl font-semibold">What you owe</h1>
      </header>

      {rows.length === 0 ? (
        <div className="hero flex items-center gap-3 p-5">
          <span className="icon-tile text-in"><ShieldCheck size={18} /></span>
          <div>
            <p className="font-semibold">Debt-free</p>
            <p className="text-xs text-muted">No card or loan balances right now.</p>
          </div>
        </div>
      ) : (
        <>
          <section className="hero p-5">
            <p className="eyebrow">Owed in total</p>
            <p className="num mt-1 text-[2rem] font-semibold leading-tight text-out">{lkr(totalOwed)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
                <p className="eyebrow">To clear</p>
                <p className="num mt-0.5 text-sm font-semibold">{lkr(toClear)}</p>
              </div>
              <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
                <p className="eyebrow">0% instalments</p>
                <p className="num mt-0.5 text-sm font-semibold">{lkr(held)}</p>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <h2 className="flex items-center gap-2 font-semibold"><Target size={16} className="text-accent" /> Payoff plan</h2>
            <form action={saveSetting} className="mt-3 flex items-center gap-2.5">
              <input type="hidden" name="key" value="payoff_months" />
              <span className="text-sm text-muted">Clear in</span>
              <input name="value" type="number" min={1} max={36} defaultValue={months} className="field num w-20 py-2 text-center" />
              <span className="text-sm text-muted">months</span>
              <button className="btn ml-auto px-3 py-2 text-sm">Update</button>
            </form>
            <div className="mt-4 flex items-end justify-between rounded-xl bg-surface-2 px-3.5 py-3">
              <div>
                <p className="font-semibold">Pay per month</p>
                <p className="text-xs text-muted">Cleared by the {clearBy} cycle</p>
              </div>
              <p className="num whitespace-nowrap text-xl font-semibold text-accent">{lkr(perMonth)}</p>
            </div>
            {instalmentsPerMonth > 0 && (
              <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted">
                <Package size={13} /> Plus {lkr(instalmentsPerMonth)} a month of 0% instalments, which pay down on their own schedule.
              </p>
            )}
            <p className="mt-2 text-[11px] text-faint">Any balance you leave on a card after its due date is charged interest by the bank. The plan doesn&apos;t include that.</p>
          </section>

          <section>
            <h2 className="mb-2.5 px-0.5 font-semibold">By account</h2>
            <ul className="card divide-y divide-line overflow-hidden">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/accounts/${r.id}`} className="flex items-center gap-3 px-3.5 py-3">
                    <span className="icon-tile text-accent"><r.Icon size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{r.name}</p>
                      <p className="num text-[11px] text-faint">
                        {r.held > 0 ? `${lkr(r.revolving)} to clear + ${lkr(r.held)} instalments` : `${Math.round((r.owed / totalOwed) * 100)}% of what you owe`}
                      </p>
                    </div>
                    <span className="num font-semibold text-out">{lkr(r.owed)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
