// Credit card statement maths. Pure functions: no database access.
//
// Model:
// - A card's balance (from the ledger) is negative when you owe money.
// - The bank holds the whole remaining 0% instalment amount against the card,
//   so the balance already includes instalments that are not billed yet ("held").
// - Statement closes on billing_day; the amount due is what you owed at the close,
//   minus instalments still held after that close.
// - Anything paid into the card after the close counts toward that statement.

export interface CardInput {
  id: string;
  name: string;
  opening_balance: number;
  opening_date: string;
  credit_limit: number | null;
  billing_day: number | null;
  due_day: number | null;
  balance: number; // current ledger balance
}
export interface LedgerTxn {
  date: string;
  amount: number;
  from_account_id: string | null;
  to_account_id: string | null;
}
export interface PlanInput {
  id: string;
  name: string;
  card_account_id: string;
  total_price: number;
  months: number;
  monthly_amount: number;
  first_billing_month: string; // YYYY-MM-01
}
export interface StoredStatement {
  account_id: string;
  statement_date: string;
  statement_balance: number;
}

export interface PlanStatus {
  plan: PlanInput;
  billed: number;
  remainingMonths: number;
  held: number;
  nextBilling: string | null;
}

export interface CardStatus {
  card: CardInput;
  owedNow: number;
  available: number | null;
  utilisation: number | null; // 0–100
  lastClose: string | null;
  nextClose: string | null;
  dueDate: string | null;
  daysToDue: number | null;
  statement: number | null; // null = unknown, needs entering
  statementSource: "computed" | "entered" | null;
  paidSinceClose: number;
  remainingDue: number | null;
  unbilled: number | null;
  held: number;
  overdue: boolean;
  plans: PlanStatus[];
}

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Date in month y-m on `day`, clamped to the month's length. */
export function dayIn(y: number, m: number, day: number): string {
  // normalise month overflow
  const d = new Date(Date.UTC(y, m - 1, 1));
  const yy = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
  return `${yy}-${pad(mm)}-${pad(Math.min(day, lastDay(yy, mm)))}`;
}

const ym = (date: string) => [Number(date.slice(0, 4)), Number(date.slice(5, 7))] as const;

/** Most recent statement close on or before `today`. */
export function lastCloseOn(today: string, billingDay: number): string {
  const [y, m] = ym(today);
  const thisMonth = dayIn(y, m, billingDay);
  return thisMonth <= today ? thisMonth : dayIn(y, m - 1, billingDay);
}

export function nextCloseAfter(today: string, billingDay: number): string {
  const [y, m] = ym(today);
  const thisMonth = dayIn(y, m, billingDay);
  return thisMonth > today ? thisMonth : dayIn(y, m + 1, billingDay);
}

/** First due date strictly after the close date. */
export function dueAfter(close: string, dueDay: number): string {
  const [y, m] = ym(close);
  const same = dayIn(y, m, dueDay);
  return same > close ? same : dayIn(y, m + 1, dueDay);
}

export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

export function planStatus(plan: PlanInput, billingDay: number, asOf: string): PlanStatus {
  const [fy, fm] = ym(plan.first_billing_month);
  let billed = 0;
  let nextBilling: string | null = null;
  for (let k = 0; k < plan.months; k++) {
    const d = dayIn(fy, fm + k, billingDay);
    if (d <= asOf) billed++;
    else {
      nextBilling = d;
      break;
    }
  }
  const remainingMonths = plan.months - billed;
  return { plan, billed, remainingMonths, held: r2(remainingMonths * plan.monthly_amount), nextBilling };
}

function balanceAt(card: CardInput, txns: LedgerTxn[], date: string): number {
  let b = card.opening_balance;
  for (const t of txns) {
    if (t.date > date) continue;
    if (t.to_account_id === card.id) b += t.amount;
    if (t.from_account_id === card.id) b -= t.amount;
  }
  return r2(b);
}

export function cardStatus(
  card: CardInput,
  txns: LedgerTxn[],
  plans: PlanInput[],
  stored: StoredStatement[],
  today: string,
): CardStatus {
  const owedNow = r2(Math.max(-card.balance, 0));
  const limit = card.credit_limit;
  const available = limit ? r2(limit - owedNow) : null;
  const utilisation = limit ? Math.min(100, Math.round((owedNow / limit) * 100)) : null;
  const myPlans = plans.filter((p) => p.card_account_id === card.id);
  const billingDay = card.billing_day;

  const base: CardStatus = {
    card, owedNow, available, utilisation,
    lastClose: null, nextClose: null, dueDate: null, daysToDue: null,
    statement: null, statementSource: null, paidSinceClose: 0, remainingDue: null, unbilled: null,
    held: 0, overdue: false,
    plans: billingDay ? myPlans.map((p) => planStatus(p, billingDay, today)) : [],
  };
  if (!billingDay || !card.due_day) return base;

  const close = lastCloseOn(today, billingDay);
  const due = dueAfter(close, card.due_day);
  const heldAt = (d: string) => r2(myPlans.reduce((s, p) => s + planStatus(p, billingDay, d).held, 0));
  const heldNow = heldAt(today);

  const mine = txns.filter((t) => t.from_account_id === card.id || t.to_account_id === card.id);
  const paidSinceClose = r2(
    mine.filter((t) => t.to_account_id === card.id && t.date > close && t.date <= today).reduce((s, t) => s + t.amount, 0),
  );

  const entered = stored.find((s) => s.account_id === card.id && s.statement_date === close);
  let statement: number | null = null;
  let statementSource: CardStatus["statementSource"] = null;
  if (entered) {
    statement = r2(entered.statement_balance);
    statementSource = "entered";
  } else if (close >= card.opening_date) {
    statement = r2(Math.max(-balanceAt(card, mine, close) - heldAt(close), 0));
    statementSource = "computed";
  }

  const remainingDue = statement === null ? null : r2(Math.max(statement - paidSinceClose, 0));
  const unbilled = remainingDue === null ? null : r2(Math.max(owedNow - heldNow - remainingDue, 0));

  return {
    ...base,
    lastClose: close,
    nextClose: nextCloseAfter(today, billingDay),
    dueDate: due,
    daysToDue: daysBetween(today, due),
    statement,
    statementSource,
    paidSinceClose,
    remainingDue,
    unbilled,
    held: heldNow,
    overdue: remainingDue !== null && remainingDue > 0 && today > due,
  };
}
