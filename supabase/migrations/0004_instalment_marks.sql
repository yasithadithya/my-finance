-- Mark an instalment as paid (the D tick for instalments). Run once in Supabase: SQL Editor → paste → Run.
-- One row per plan per statement month. transaction_id is the payment into the
-- card, if one was recorded (null for "just tick").

create table instalment_marks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  plan_id         uuid not null references instalment_plans(id) on delete cascade,
  month           date not null,  -- first day of the statement month the instalment is billed on
  transaction_id  uuid references transactions(id) on delete set null,
  paid_at         timestamptz not null default now(),
  unique (plan_id, month)
);

alter table instalment_marks enable row level security;
create policy instalment_marks_owner on instalment_marks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
