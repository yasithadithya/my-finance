import { round2, shiftMonth } from "@/lib/format";
import { billedThisMonth } from "@/lib/statements";
import type { InstalmentPlan } from "@/lib/types";

export interface Debt {
  id: string;
  name: string;
  balance: number; // owed, positive
  rate: number; // % a year
}

export interface PayoffResult {
  ok: boolean; // false if the budget never clears everything (within 30 years)
  months: number;
  debtFree: string | null; // "YYYY-MM"
  totalInterest: number;
  cleared: { id: string; name: string; month: string | null; interest: number }[];
  firstMonth: { name: string; pay: number }[]; // what to pay next month
}

/**
 * Month-by-month simulation. Each month: add interest, pay instalments that
 * get billed that month, then put the rest of the budget on one debt at a time
 * (avalanche = highest interest first, snowball = smallest balance first).
 */
export function planPayoff(
  debts: Debt[],
  plans: InstalmentPlan[],
  budget: number,
  method: "avalanche" | "snowball",
  startYm: string,
): PayoffResult {
  const bal = new Map(debts.map((d) => [d.id, d.balance]));
  const interest = new Map(debts.map((d) => [d.id, 0]));
  const cleared = new Map<string, string>();
  const firstMonth = new Map<string, number>();
  let k = 0;
  const MAX = 360;

  const instalmentsLeft = (ym: string) => plans.some((p) => billedThisMonth(p, ym) > 0);

  for (k = 1; k <= MAX; k++) {
    const ym = shiftMonth(startYm, k);
    const open = debts.filter((d) => bal.get(d.id)! > 0.005);
    if (!open.length && !instalmentsLeft(ym)) {
      k--;
      break;
    }
    for (const d of open) {
      const i = (bal.get(d.id)! * d.rate) / 1200;
      bal.set(d.id, bal.get(d.id)! + i);
      interest.set(d.id, interest.get(d.id)! + i);
    }
    let avail = budget;
    for (const p of plans) {
      const due = billedThisMonth(p, ym);
      if (due > 0) {
        avail -= due;
        if (k === 1) firstMonth.set(p.name, (firstMonth.get(p.name) ?? 0) + due);
      }
    }
    avail = Math.max(0, avail);
    const order = [...open].sort((a, b) =>
      method === "avalanche" ? b.rate - a.rate || bal.get(a.id)! - bal.get(b.id)! : bal.get(a.id)! - bal.get(b.id)! || b.rate - a.rate,
    );
    for (const d of order) {
      if (avail <= 0) break;
      const pay = Math.min(avail, bal.get(d.id)!);
      bal.set(d.id, bal.get(d.id)! - pay);
      avail -= pay;
      if (k === 1) firstMonth.set(d.name, (firstMonth.get(d.name) ?? 0) + pay);
      if (bal.get(d.id)! <= 0.005) cleared.set(d.id, ym);
    }
  }

  const ok = debts.every((d) => d.balance <= 0.005 || cleared.has(d.id)) && k <= MAX;
  const totalInterest = round2([...interest.values()].reduce((s, v) => s + v, 0));
  return {
    ok,
    months: Math.min(k, MAX),
    debtFree: ok ? shiftMonth(startYm, Math.max(k, 0)) : null,
    totalInterest,
    cleared: debts.map((d) => ({ id: d.id, name: d.name, month: cleared.get(d.id) ?? null, interest: round2(interest.get(d.id)!) })),
    firstMonth: [...firstMonth.entries()].map(([name, pay]) => ({ name, pay: round2(pay) })),
  };
}
