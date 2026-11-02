import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts } from "@/lib/data";
import { ensureStatements, type StatementView } from "@/lib/statements";
import { loadChecklist, type ChecklistItem } from "@/lib/reminders";
import { currentMonth, dayIn, lkr, monthLabel, monthRange, ordinal, shiftMonth, shortDate, todayColombo } from "@/lib/format";
import { isDebtType, type Account } from "@/lib/types";
import { payStatement, tickRecurring, untickRecurring } from "@/app/actions";
import { StatusChip } from "@/components/Reminders";

export const dynamic = "force-dynamic";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const now = currentMonth();
  const ym = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : now;
  const { start, end } = monthRange(ym);
  const today = todayColombo();

  const supabase = await createClient();
  const accounts = await loadAccounts(supabase);
  const [statements, checklist] = await Promise.all([ensureStatements(supabase, accounts, today), loadChecklist(supabase, ym)]);

  // This month: every unpaid bill plus the ones due this month. Other months: bills due in that month.
  const bills = statements
    .filter((s) => (s.due_date >= start && s.due_date < end) || (ym === now && s.status !== "paid"))
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
  const cards = accounts.filter((a) => a.type === "credit_card");
  const cardsWithoutBill = cards.filter((c) => !bills.some((b) => b.account_id === c.id));
  const payFrom = accounts.filter((a) => !isDebtType(a.type));
  const byId = new Map(accounts.map((a) => [a.id, a]));

  const fixedLeft = checklist.filter((i) => !i.mark).reduce((s, i) => s + i.amount, 0);
  const fixedDone = checklist.filter((i) => i.mark).reduce((s, i) => s + i.amount, 0);
  const billsLeft = bills.reduce((s, b) => s + b.remaining, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href={`/pay?month=${shiftMonth(ym, -1)}`} className="btn btn-ghost px-3 py-2" aria-label="Previous month">‹</Link>
        <h1 className="text-lg font-semibold">Pay · {monthLabel(ym)}</h1>
        <Link href={`/pay?month=${shiftMonth(ym, 1)}`} className="btn btn-ghost px-3 py-2" aria-label="Next month">›</Link>
      </div>

      <section className="card p-4">
        <p className="text-sm text-muted">Still to pay</p>
        <p className="num text-3xl font-semibold">{lkr(fixedLeft + billsLeft)}</p>
        <p className="num mt-1 text-xs text-muted">
          {lkr(billsLeft)} card bills · {lkr(fixedLeft)} fixed · {lkr(fixedDone)} ticked
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">Card bills</h2>
        {bills.length === 0 && cards.length === 0 && <p className="text-sm text-muted">No credit cards.</p>}
        {bills.length > 0 && (
          <ul className="card divide-y divide-line">
            {bills.map((s) => <BillRow key={s.id} s={s} payFrom={payFrom} today={today} ym={ym} />)}
          </ul>
        )}
        {ym === now && cardsWithoutBill.length > 0 && (
          <p className="mt-2 text-xs text-muted">
            No bill yet for {cardsWithoutBill.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/accounts/${c.id}#statements`} className="text-accent underline">{c.name}</Link>
              </span>
            ))}
            . Statements appear on their statement day; add an older one from the card page.
          </p>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted">Fixed payments</h2>
          <Link href="/pay/items" className="text-xs text-accent">Manage</Link>
        </div>
        {checklist.length === 0 ? (
          <p className="text-sm text-muted">
            No fixed payments. <Link href="/pay/items/new" className="text-accent underline">Add one</Link>.
          </p>
        ) : (
          <ul className="card divide-y divide-line">
            {checklist.map((i) => <ItemRow key={i.id} item={i} ym={ym} today={today} now={now} payFrom={payFrom} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function AccountOptions({ list }: { list: Account[] }) {
  return <>{list.map((a) => <option key={a.id} value={a.id}>{a.name} · {lkr(a.balance)}</option>)}</>;
}

function BillRow({ s, payFrom, today, ym }: { s: StatementView; payFrom: Account[]; today: string; ym: string }) {
  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate font-medium">{s.card_name}</span>
          <span className="block text-xs text-muted">
            Statement {shortDate(s.statement_date)} · due {shortDate(s.due_date)}
            {s.instalments > 0 && <> · incl. {lkr(s.instalments)} instalment</>}
          </span>
        </span>
        <span className="text-right">
          <span className="num block">{lkr(s.status === "paid" ? s.statement_balance : s.remaining)}</span>
          <StatusChip status={s.status} days={s.days_left} />
        </span>
      </div>
      {s.paid > 0 && s.status !== "paid" && (
        <p className="num mt-1 text-xs text-muted">{lkr(s.paid)} paid of {lkr(s.statement_balance)}</p>
      )}
      {s.status !== "paid" && payFrom.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-accent">Pay this bill</summary>
          <form action={payStatement} className="mt-2 grid grid-cols-2 gap-2">
            <input type="hidden" name="card_id" value={s.account_id} />
            <input type="hidden" name="note" value={`${s.card_name} bill`} />
            <input type="hidden" name="back" value={`/pay?month=${ym}`} />
            <select name="from_account_id" className="field col-span-2" defaultValue={payFrom[0].id}>
              <AccountOptions list={payFrom} />
            </select>
            <input name="amount" inputMode="decimal" defaultValue={s.remaining.toFixed(2)} className="field num" aria-label="Amount" />
            <input name="date" type="date" defaultValue={today} className="field" aria-label="Date" />
            <button className="btn col-span-2">Record payment</button>
          </form>
        </details>
      )}
    </li>
  );
}

function ItemRow({
  item,
  ym,
  today,
  now,
  payFrom,
  byId,
}: {
  item: ChecklistItem;
  ym: string;
  today: string;
  now: string;
  payFrom: Account[];
  byId: Map<string, Account>;
}) {
  const from = item.pay_from_account_id ? byId.get(item.pay_from_account_id) : undefined;
  const date = ym === now ? today : dayIn(ym, item.due_day ?? 1);
  const late = !item.mark && item.due_day && ym === now && dayIn(ym, item.due_day) < today;
  const info = (
    <span className="min-w-0">
      <span className={`block truncate ${item.mark ? "text-muted line-through" : ""}`}>{item.name}</span>
      <span className={`block truncate text-xs ${late ? "text-out" : "text-muted"}`}>
        {item.due_day ? `Due the ${ordinal(item.due_day)}` : "Any day"}
        {from ? ` · ${from.name}` : ""}
      </span>
    </span>
  );

  if (item.mark) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3">
        {info}
        <span className="flex items-center gap-3">
          <span className="num text-muted">{lkr(item.amount)}</span>
          <form action={untickRecurring}>
            <input type="hidden" name="mark_id" value={item.mark.id} />
            <input type="hidden" name="month" value={ym} />
            <button className="grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-[#062a26]" aria-label={`Undo ${item.name}`} title="Tap to undo">
              D
            </button>
          </form>
        </span>
      </li>
    );
  }

  const hidden = (
    <>
      <input type="hidden" name="item_id" value={item.id} />
      <input type="hidden" name="month" value={ym} />
    </>
  );
  const ring = "grid h-9 w-9 place-items-center rounded-full border-2 border-line text-sm font-bold text-muted";

  // One tap when the item has a default account; otherwise pick one first.
  if (from) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3">
        {info}
        <span className="flex items-center gap-3">
          <span className="num">{lkr(item.amount)}</span>
          <form action={tickRecurring}>
            {hidden}
            <input type="hidden" name="account_id" value={from.id} />
            <input type="hidden" name="amount" value={item.amount} />
            <input type="hidden" name="date" value={date} />
            <button className={ring} aria-label={`Mark ${item.name} paid`}>D</button>
          </form>
        </span>
      </li>
    );
  }

  return (
    <li className="px-4 py-3">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          {info}
          <span className="flex items-center gap-3">
            <span className="num">{lkr(item.amount)}</span>
            <span className={ring}>D</span>
          </span>
        </summary>
        <form action={tickRecurring} className="mt-3 grid grid-cols-2 gap-2">
          {hidden}
          <select name="account_id" className="field col-span-2" defaultValue="" required>
            <option value="" disabled>Paid with…</option>
            <AccountOptions list={payFrom} />
            {[...byId.values()].filter((a) => a.type === "credit_card").map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
            <option value="none">Just tick (don&apos;t record)</option>
          </select>
          <input name="amount" inputMode="decimal" defaultValue={item.amount.toFixed(2)} className="field num" aria-label="Amount" />
          <input name="date" type="date" defaultValue={date} className="field" aria-label="Date" />
          <button className="btn col-span-2">Mark paid</button>
        </form>
      </details>
    </li>
  );
}
