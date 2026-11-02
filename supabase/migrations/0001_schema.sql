-- My Expenses — full schema (Phases 1–3).
-- Run once in Supabase: SQL Editor → paste → Run.
-- All money is LKR, numeric(12,2). Amounts in `transactions` are always positive;
-- from_account_id / to_account_id decide the direction.


-- ---------------------------------------------------------------- enums
create type account_type as enum ('bank', 'credit_card', 'cash', 'savings', 'fd', 'loan');
create type txn_kind     as enum ('expense', 'income', 'transfer', 'adjustment');
create type receivable_status as enum ('waiting', 'quoted', 'partly_paid', 'paid');

-- ---------------------------------------------------------------- accounts
create table accounts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null,
  type             account_type not null,
  institution      text,
  -- Positive = money you have. Negative = money you owe (credit cards, loans).
  opening_balance  numeric(12,2) not null default 0,
  opening_date     date not null default current_date,
  credit_limit     numeric(12,2),
  billing_day      smallint check (billing_day between 1 and 31),
  due_day          smallint check (due_day between 1 and 31),
  interest_rate    numeric(6,3),
  maturity_date    date,
  archived         boolean not null default false,
  sort_order       integer not null default 0,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------- recurring items (fixed monthly payments)
create table recurring_items (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                 text not null,
  amount               numeric(12,2) not null check (amount > 0),
  pay_from_account_id  uuid references accounts(id) on delete set null,
  due_day              smallint check (due_day between 1 and 31),
  active               boolean not null default true,
  end_month            date,
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- instalment plans
-- The bank holds the full remaining amount against the card, so the card's
-- balance already includes it. The plan only tells the statement logic how much
-- of that is billed each cycle — it never creates extra debt.
create table instalment_plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name                 text not null,
  card_account_id      uuid not null references accounts(id) on delete cascade,
  total_price          numeric(12,2) not null check (total_price > 0),
  months               smallint not null check (months > 0),
  monthly_amount       numeric(12,2) not null check (monthly_amount > 0),
  first_billing_month  date not null,
  interest_rate        numeric(6,3) not null default 0,
  created_at           timestamptz not null default now()
);

-- ---------------------------------------------------------------- receivables (money owed to me)
create table receivables (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  who            text not null,
  description    text,
  amount         numeric(12,2) not null check (amount > 0),
  status         receivable_status not null default 'waiting',
  expected_date  date,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- transactions (the ledger)
create table transactions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date                date not null default current_date,
  amount              numeric(12,2) not null check (amount > 0),
  kind                txn_kind not null,
  from_account_id     uuid references accounts(id) on delete restrict,
  to_account_id       uuid references accounts(id) on delete restrict,
  note                text,
  recurring_item_id   uuid references recurring_items(id) on delete set null,
  instalment_plan_id  uuid references instalment_plans(id) on delete set null,
  receivable_id       uuid references receivables(id) on delete set null,
  created_at          timestamptz not null default now(),
  constraint txn_has_account   check (from_account_id is not null or to_account_id is not null),
  constraint txn_not_self      check (from_account_id is null or to_account_id is null or from_account_id <> to_account_id),
  constraint txn_kind_shape    check (
    (kind = 'expense'    and from_account_id is not null and to_account_id is null) or
    (kind = 'income'     and from_account_id is null     and to_account_id is not null) or
    (kind = 'transfer'   and from_account_id is not null and to_account_id is not null) or
    (kind = 'adjustment' and (from_account_id is null) <> (to_account_id is null))
  )
);
create index transactions_date_idx on transactions (user_id, date desc);
create index transactions_from_idx on transactions (from_account_id);
create index transactions_to_idx   on transactions (to_account_id);

-- ---------------------------------------------------------------- the D tick per month
create table recurring_marks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  recurring_item_id  uuid not null references recurring_items(id) on delete cascade,
  month              date not null,  -- first day of the month
  transaction_id     uuid references transactions(id) on delete set null,
  paid_at            timestamptz not null default now(),
  unique (recurring_item_id, month)
);

-- ---------------------------------------------------------------- credit card statements
create table cc_statements (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id         uuid not null references accounts(id) on delete cascade,
  statement_date     date not null,
  period_start       date not null,
  period_end         date not null,
  statement_balance  numeric(12,2) not null,  -- amount due (positive)
  due_date           date not null,
  source             text not null default 'auto' check (source in ('auto', 'edited')),
  created_at         timestamptz not null default now(),
  unique (account_id, statement_date)
);

-- ---------------------------------------------------------------- reconciliations
create table reconciliations (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id         uuid not null references accounts(id) on delete cascade,
  date               date not null default current_date,
  actual_balance     numeric(12,2) not null,
  computed_balance   numeric(12,2) not null,
  adjustment_txn_id  uuid references transactions(id) on delete set null,
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------- row-level security
do $$
declare t text;
begin
  foreach t in array array['accounts','recurring_items','instalment_plans','receivables',
                           'transactions','recurring_marks','cc_statements','reconciliations']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_owner', t);
  end loop;
end $$;

-- ---------------------------------------------------------------- views
-- Balance = opening + money in − money out. security_invoker makes RLS apply.
create view account_balances with (security_invoker = true) as
select
  a.*,
  a.opening_balance
    + coalesce((select sum(t.amount) from transactions t where t.to_account_id   = a.id), 0)
    - coalesce((select sum(t.amount) from transactions t where t.from_account_id = a.id), 0)
    as balance
from accounts a;

-- One row per month: what came in, what was spent, what went to debts.
create view monthly_summary with (security_invoker = true) as
select
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)  as money_in,
  coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.recurring_item_id is not null), 0) as fixed_spent,
  coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.recurring_item_id is null), 0)     as other_spent,
  coalesce(sum(t.amount) filter (where t.kind = 'transfer' and ta.type in ('credit_card', 'loan')), 0) as debt_payments
from transactions t
left join accounts ta on ta.id = t.to_account_id
group by 1;
