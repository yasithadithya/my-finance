-- Convert card purchases to instalment plans. Run once in Supabase: SQL Editor → paste → Run.
--
-- * A plan can point at the card purchase it was converted from. Deleting the
--   purchase deletes the plan.
-- * Transactions with instalment_plan_id set are the monthly interest charges of
--   plans with interest. The app books them on each statement day.
-- * The monthly summary no longer counts a converted purchase (or its interest
--   charges) as "other" spending. The app adds each month's instalment instead.

alter table instalment_plans
  add column purchase_txn_id uuid unique references transactions(id) on delete cascade;

create or replace view monthly_summary with (security_invoker = true) as
select
  date_trunc('month', t.date)::date as month,
  coalesce(sum(t.amount) filter (where t.kind = 'income'), 0)  as money_in,
  coalesce(sum(t.amount) filter (where t.kind = 'expense' and t.recurring_item_id is not null), 0) as fixed_spent,
  coalesce(sum(t.amount) filter (
    where t.kind = 'expense' and t.recurring_item_id is null and t.instalment_plan_id is null and p.id is null
  ), 0) as other_spent,
  coalesce(sum(t.amount) filter (where t.kind = 'transfer' and ta.type in ('credit_card', 'loan')), 0) as debt_payments
from transactions t
left join accounts ta on ta.id = t.to_account_id
left join instalment_plans p on p.purchase_txn_id = t.id
group by 1;
