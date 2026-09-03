-- Infrastructure probe table for Aegis /api/health/db
-- Safe for anon SELECT: contains no user data.

create table if not exists public.health_check (
  id bigint generated always as identity primary key,
  checked_at timestamptz not null default now()
);

alter table public.health_check enable row level security;

comment on table public.health_check is 'Infrastructure probe table for Aegis /api/health/db';

drop policy if exists health_check_select_public on public.health_check;

create policy health_check_select_public
  on public.health_check
  for select
  to anon, authenticated
  using (true);
