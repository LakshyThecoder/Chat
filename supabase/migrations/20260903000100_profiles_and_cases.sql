-- Profiles, cases, and append-only case audit events with RLS.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

do $$ begin
  create type public.case_status as enum (
    'DRAFT',
    'INVESTIGATING',
    'READY_FOR_REVIEW',
    'AWAITING_APPROVAL',
    'EXECUTING',
    'SUBMITTED',
    'UNDER_REVIEW',
    'NEEDS_INFORMATION',
    'RESOLVED',
    'FAILED',
    'CLOSED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  case_type text not null,
  title text not null,
  summary text,
  status public.case_status not null default 'DRAFT',
  amount_at_risk numeric(12,2),
  currency text not null default 'EUR',
  confidence numeric(4,3),
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cases_amount_non_negative check (amount_at_risk is null or amount_at_risk >= 0),
  constraint cases_currency_len check (char_length(currency) = 3)
);

create index if not exists cases_user_id_idx on public.cases (user_id);
create index if not exists cases_status_idx on public.cases (status);
create index if not exists cases_user_updated_idx on public.cases (user_id, updated_at desc);

alter table public.cases enable row level security;

drop policy if exists cases_select_own on public.cases;
drop policy if exists cases_insert_own on public.cases;
drop policy if exists cases_update_own on public.cases;

create policy cases_select_own on public.cases
  for select to authenticated
  using (user_id = auth.uid());

create policy cases_insert_own on public.cases
  for insert to authenticated
  with check (user_id = auth.uid());

create policy cases_update_own on public.cases
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null,
  from_status public.case_status,
  to_status public.case_status,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists case_events_case_id_idx on public.case_events (case_id, created_at asc);

alter table public.case_events enable row level security;

drop policy if exists case_events_select_own on public.case_events;
drop policy if exists case_events_insert_own on public.case_events;

create policy case_events_select_own on public.case_events
  for select to authenticated
  using (user_id = auth.uid());

create policy case_events_insert_own on public.case_events
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = auth.uid()
    )
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
