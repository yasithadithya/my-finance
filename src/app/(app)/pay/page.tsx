import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { loadAccounts, loadInstalmentMarks, loadPlans } from "@/lib/data";
import {
  dueStatementMonths,
  ensureStatements,
  instalmentPaid,
  instalmentsDueIn,
  type InstalmentDue,
  type StatementView,
} from "@/lib/statements";
import { loadChecklist, type ChecklistItem } from "@/lib/reminders";
import { currentMonth, dayIn, lkr, monthLabel, monthRange, ordinal, shiftMonth, shortDate, todayColombo } from "@/lib/format";
import { isDebtType, type Account } from "@/lib/types";
import { markInstalment, payStatement, tickRecurring, unmarkInstalment, untickRecurring } from "@/app/actions";
import { StatusChip } from "@/components/Reminders";
import Amount from "@/components/Amount";
import MonthRunway from "@/components/MonthRunway";
import MonthNav from "@/components/MonthNav";
import PageHeader from "@/components/PageHeader";
import { Icon, ICONS } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function PayPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const now = currentMonth();
  const ym = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : now;
  const { start, end } = monthRange(ym);
  const today = todayColombo();

  const supabase = await createClient();
  const accounts = await loadAccounts(supabase);
  const [statements, checklist, plans, marks] = await Promise.all([
    ensureStatements(supabase, accounts, today),
    loadChecklist(supabase, ym),
    loadPlans(supabase),
    loadInstalmentMarks(supabase, dueStatementMonths(ym)),
  ]);

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

  // Instalments due this month. Once the statement is out the instalment is part
  // of that card bill; before that (and for future months) it's counted here.
  const instalments = instalmentsDueIn(ym, plans, cards, statements, marks);
  const instalmentsLeft = instalments.filter((i) => !i.bill && !i.mark).reduce((s, i) => s + i.amount, 0);
  const ticked = fixedDone + instalments.filter((i) => i.mark).reduce((s, i) => s + i.amount, 0);

  return (
    <div className="page-in space-y-6">
      <PageHeader title="Pay" action={<Link href="/pay/items" className="link px-2 text-sm">Manage</Link>}>
        <MonthNav label={monthLabel(ym)} prev={`/pay?month=${shiftMonth(ym, -1)}`} next={`/pay?month=${shiftMonth(ym, 1)}`} />
      </PageHeader>

      <section className="panel">
        <p className="text-[0.8125rem] font-semibold text-muted">Still to pay</p>
        <p className="mt-1.5 text-[2.375rem]">
          <Amount value={fixedLeft + billsLeft + instalmentsLeft} />
        </p>
        <div className="mt-5">
          <MonthRunway ym={ym} today={today} bills={statements} fixed={checklist} cards={cards} instalments={instalments} />
        </div>
        <dl className="num mt-4 grid grid-cols-2 gap-2">
          <PayStat label="Card bills" value={lkr(billsLeft)} />
          <PayStat label="Instalments not billed yet" value={lkr(instalmentsLeft)} />
          <PayStat label="Fixed" value={lkr(fixedLeft)} />
          <PayStat label="Ticked" value={lkr(ticked)} tone="text-in" />
        </dl>
      </section>

      {instalments.length > 0 && (
        <section id="instalments">
          <div className="section-head"><h2>Instalments</h2></div>
          <ul className="ledger">
            {instalments.map((i) => (
              <InstalmentRow key={`${i.plan.id}-${i.statement_date}`} i={i} today={today} ym={ym} payFrom={payFrom} />
            ))}
          </ul>
          <p className="hint mt-2 px-3">
            Must be paid each month until the plan ends. Tap the circle to mark one paid: pick the bank account to record the
            payment into the card, or &ldquo;Just tick&rdquo; if you paid it with the whole card bill. Paying the full card bill also marks it paid.
          </p>
        </section>
      )}

      <section>
        <div className="section-head"><h2>Card bills</h2></div>
        {bills.length === 0 && cards.length === 0 && <p className="card p-5 text-[0.9375rem] text-muted">No credit cards.</p>}
        {bills.length > 0 && (
          <ul className="ledger">
            {bills.map((s) => <BillRow key={s.id} s={s} payFrom={payFrom} today={today} ym={ym} />)}
          </ul>
        )}
        {ym === now && cardsWithoutBill.length > 0 && (
          <p className="hint mt-2 px-3">
            No bill yet for {cardsWithoutBill.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/accounts/${c.id}#statements`} className="link">{c.name}</Link>
              </span>
            ))}
            . Statements appear on their statement day; add an older one from the card page.
          </p>
        )}
      </section>

      <section>
        <div className="section-head">
          <h2>Fixed payments</h2>
          <Link href="/pay/items">Manage</Link>
        </div>
        {checklist.length === 0 ? (
          <p className="card p-5 text-[0.9375rem] text-muted">
            No fixed payments. <Link href="/pay/items/new" className="link">Add one</Link>
          </p>
        ) : (
          <ul className="ledger">
            {checklist.map((i) => <ItemRow key={i.id} item={i} ym={ym} today={today} now={now} payFrom={payFrom} byId={byId} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

function Check() {
  return <Icon d={ICONS.check} size={18} strokeWidth={2.6} />;
}

function PayStat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-3.5 py-3">
      <dt className="truncate text-[0.75rem] font-medium text-muted">{label}</dt>
      <dd className={`truncate text-[0.9375rem] font-semibold ${tone}`}>{value}</dd>
    </div>
  );
}

function AccountOptions({ list }: { list: Account[] }) {
  return <>{list.map((a) => <option key={a.id} value={a.id}>{a.name} · {lkr(a.balance)}</option>)}</>;
}

function InstalmentRow({ i, today, ym, payFrom }: { i: InstalmentDue; today: string; ym: string; payFrom: Account[] }) {
  const left = i.plan.months - i.no;
  const paid = instalmentPaid(i);
  const late = !paid && i.due_date !== null && i.due_date < today;
  const back = `/pay?month=${ym}`;
  const info = (
    <span className="min-w-0">
      <span className={`block truncate text-[0.9375rem] font-medium ${paid ? "text-muted line-through" : ""}`}>{i.plan.name}</span>
      <span className={`block truncate text-[0.8125rem] ${late ? "text-out" : "text-muted"}`}>
        {i.no} of {i.plan.months} · {i.card.name}
        {i.bill
          ? `, on the ${shortDate(i.statement_date)} bill`
          : `, billed ${shortDate(i.statement_date)}${i.due_date ? `, due ${shortDate(i.due_date)}` : ""}`}
        {left === 0 ? " · last one" : ` · ${left} more after this`}
      </span>
      {i.bill && !paid && <span className="mt-0.5 block"><StatusChip status={i.bill.status} days={i.bill.days_left} /></span>}
    </span>
  );

  // Ticked: tap the filled D to undo.
  if (i.mark) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3.5">
        {info}
        <span className="flex items-center gap-3">
          <span className="num text-muted">{lkr(i.amount)}</span>
          <form action={unmarkInstalment}>
            <input type="hidden" name="mark_id" value={i.mark.id} />
            <input type="hidden" name="back" value={back} />
            <button className="tick on" aria-label={`Undo ${i.plan.name}`} title="Tap to undo">
              <Check />
            </button>
          </form>
        </span>
      </li>
    );
  }

  // Paid through the full card bill: nothing to tick.
  if (paid) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3.5">
        {info}
        <span className="flex flex-col items-end gap-1">
          <span className="num text-muted">{lkr(i.amount)}</span>
          <span className="text-xs text-in">Paid with the bill</span>
        </span>
      </li>
    );
  }

  const ring = "tick";
  return (
    <li className="px-4 py-3.5">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          {info}
          <span className="flex items-center gap-3">
            <span className="num font-semibold">{lkr(i.amount)}</span>
            <span className={ring}><Check /></span>
          </span>
        </summary>
        <form action={markInstalment} className="mt-3 grid grid-cols-2 gap-2">
          <input type="hidden" name="plan_id" value={i.plan.id} />
          <input type="hidden" name="month" value={i.statement_date.slice(0, 7)} />
          <input type="hidden" name="no" value={i.no} />
          <input type="hidden" name="back" value={back} />
          <select name="account_id" className="field col-span-2" defaultValue={payFrom[0]?.id ?? "none"} required>
            {payFrom.length > 0 && <optgroup label="Paid into the card from"><AccountOptions list={payFrom} /></optgroup>}
            <option value="none">Just tick (paid with the card bill)</option>
          </select>
          <input name="amount" inputMode="decimal" defaultValue={i.amount.toFixed(2)} className="field num" aria-label="Amount" />
          <input name="date" type="date" defaultValue={today} className="field" aria-label="Date" />
          <button className="btn col-span-2">Mark paid</button>
        </form>
      </details>
    </li>
  );
}

function BillRow({ s, payFrom, today, ym }: { s: StatementView; payFrom: Account[]; today: string; ym: string }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[0.9375rem] font-semibold">{s.card_name}</span>
          <span className="block text-[0.8125rem] text-muted">
            Due {shortDate(s.due_date)}, statement {shortDate(s.statement_date)}
            {s.instalments > 0 && <>. Includes {lkr(s.instalments)} instalment</>}
          </span>
        </span>
        <span className="flex flex-col items-end gap-1">
          <span className="num text-[0.9375rem] font-semibold">{lkr(s.status === "paid" ? s.statement_balance : s.remaining)}</span>
          <StatusChip status={s.status} days={s.days_left} />
        </span>
      </div>
      {s.paid > 0 && s.status !== "paid" && (
        <p className="num mt-1 text-xs text-muted">{lkr(s.paid)} paid of {lkr(s.statement_balance)}</p>
      )}
      {s.status !== "paid" && payFrom.length > 0 && (
        <details className="mt-2">
          <summary className="btn btn-tonal btn-sm mt-1 cursor-pointer">Pay this bill</summary>
          <form action={payStatement} className="mt-3 grid grid-cols-2 gap-2">
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
      <span className={`block truncate text-[0.9375rem] font-medium ${item.mark ? "text-muted line-through" : ""}`}>{item.name}</span>
      <span className={`block truncate text-[0.8125rem] ${late ? "text-out" : "text-muted"}`}>
        {item.due_day ? `Due the ${ordinal(item.due_day)}` : "Any day"}
        {from ? `, from ${from.name}` : ""}
      </span>
    </span>
  );

  if (item.mark) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3.5">
        {info}
        <span className="flex items-center gap-3">
          <span className="num text-muted">{lkr(item.amount)}</span>
          <form action={untickRecurring}>
            <input type="hidden" name="mark_id" value={item.mark.id} />
            <input type="hidden" name="month" value={ym} />
            <button className="tick on" aria-label={`Undo ${item.name}`} title="Tap to undo">
              <Check />
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
  const ring = "tick";

  // One tap when the item has a default account; otherwise pick one first.
  if (from) {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-3.5">
        {info}
        <span className="flex items-center gap-3">
          <span className="num font-semibold">{lkr(item.amount)}</span>
          <form action={tickRecurring}>
            {hidden}
            <input type="hidden" name="account_id" value={from.id} />
            <input type="hidden" name="amount" value={item.amount} />
            <input type="hidden" name="date" value={date} />
            <button className={ring} aria-label={`Mark ${item.name} paid`}><Check /></button>
          </form>
        </span>
      </li>
    );
  }

  return (
    <li className="px-4 py-3.5">
      <details>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          {info}
          <span className="flex items-center gap-3">
            <span className="num font-semibold">{lkr(item.amount)}</span>
            <span className={ring}><Check /></span>
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
