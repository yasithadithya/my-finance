-- Phases 2–4: settings and push subscriptions.
-- Run in Supabase SQL Editor after 0001 (and 0002).

create table if not exists settings (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, key)
);

create table if not exists push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  subscription  jsonb not null,
  created_at    timestamptz not null default now()
);

alter table settings enable row level security;
alter table push_subscriptions enable row level security;
create policy settings_owner on settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_owner on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
