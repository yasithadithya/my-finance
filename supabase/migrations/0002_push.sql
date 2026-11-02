-- Phase 4: push notifications. Run once in Supabase: SQL Editor → paste → Run.
-- One row per device/browser that turned on reminders.

create table push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

alter table push_subscriptions enable row level security;
create policy push_subscriptions_owner on push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
