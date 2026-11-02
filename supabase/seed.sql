-- Day-one data (2 Nov 2026). Run AFTER you have created your login user
-- (Supabase → Authentication → Users → Add user), then SQL Editor → paste → Run.
-- Bank and cash balances are 0 placeholders: set the real ones in the app
-- (Accounts → tap the account → Edit) before you start entering transactions.

do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
  com_cc uuid; boc_cc uuid; ndb_bank uuid;
begin
  if uid is null then raise exception 'Create your user in Authentication first'; end if;

  -- Credit cards: opening balance = −(limit − available credit) on 2 Nov.
  insert into accounts (user_id, name, type, institution, opening_balance, opening_date, credit_limit, billing_day, due_day, sort_order)
  values (uid, 'BOC CC', 'credit_card', 'BOC', -7737.34, '2026-11-02', 100000, 15, 5, 10) returning id into boc_cc;
  insert into accounts (user_id, name, type, institution, opening_balance, opening_date, credit_limit, billing_day, due_day, sort_order)
  values (uid, 'Com CC', 'credit_card', 'Commercial Bank', -35394.56, '2026-11-02', 100000, 15, 5, 11) returning id into com_cc;

  -- Bank accounts and cash: set real balances in the app.
  insert into accounts (user_id, name, type, institution, opening_balance, opening_date, sort_order) values
    (uid, 'Com Bank', 'bank', 'Commercial Bank', 0, '2026-11-02', 1),
    (uid, 'BOC Bank', 'bank', 'BOC',             0, '2026-11-02', 2);
  insert into accounts (user_id, name, type, institution, opening_balance, opening_date, sort_order)
  values (uid, 'NDB Bank', 'bank', 'NDB', 0, '2026-11-02', 3) returning id into ndb_bank;
  insert into accounts (user_id, name, type, opening_balance, opening_date, sort_order) values
    (uid, 'Cash', 'cash', 0, '2026-11-02', 4),
    (uid, 'Amma', 'loan', 0, '2026-11-02', 20);

  -- Galaxy Buds: 2 of 6 instalments already billed (Sep and Oct statements).
  insert into instalment_plans (user_id, name, card_account_id, total_price, months, monthly_amount, first_billing_month)
  values (uid, 'Galaxy Buds 4 Pro', com_cc, 52900, 6, 8817, '2026-09-01');

  -- Fixed monthly payments (accounts left blank where the sheet didn't say).
  insert into recurring_items (user_id, name, amount, pay_from_account_id, sort_order) values
    (uid, 'Netflix', 3468, null, 1),
    (uid, 'Spotify', 749, null, 2),
    (uid, 'F1', 1827, null, 3),
    (uid, 'Gemini', 1600, null, 4),
    (uid, 'Claude', 6075, null, 5),
    (uid, 'Phone', 11000, null, 6),
    (uid, 'Data', 1598, null, 7),
    (uid, 'Bus', 6000, ndb_bank, 8),
    (uid, 'Petrol', 1400, ndb_bank, 9),
    (uid, 'Koko', 3055, null, 10);

  -- Money owed to me.
  insert into receivables (user_id, who, description, amount, status) values
    (uid, 'RACSLIIT', 'RI dues', 101000, 'waiting'),
    (uid, 'CIMES', 'Expenses app — second half', 32500, 'waiting'),
    (uid, 'UQMS', 'Phase 2', 150000, 'quoted');
end $$;
