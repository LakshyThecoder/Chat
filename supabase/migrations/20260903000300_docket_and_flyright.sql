-- Docket engines + FlyRight provider sandbox.
-- No Aegis user cases, facts, eligibility, or approvals are seeded.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Case intake fields (locator is user-supplied, not a preloaded win)
-- ---------------------------------------------------------------------------

alter table public.cases
  add column if not exists booking_locator text,
  add column if not exists passenger_last_name text;

create index if not exists cases_user_status_idx on public.cases (user_id, status);

-- ---------------------------------------------------------------------------
-- Versioned provider policies (read by eligibility; not user-owned)
-- ---------------------------------------------------------------------------

create table if not exists public.provider_policies (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  policy_key text not null,
  version text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (provider, policy_key, version)
);

create index if not exists provider_policies_provider_idx
  on public.provider_policies (provider);

alter table public.provider_policies enable row level security;

-- Catalog is readable (like a published airline policy page). Writes are service-only.
drop policy if exists provider_policies_select_authenticated on public.provider_policies;
create policy provider_policies_select_authenticated
  on public.provider_policies
  for select
  to authenticated
  using (true);

revoke insert, update, delete on public.provider_policies from anon, authenticated;

insert into public.provider_policies (provider, policy_key, version, title, body)
values (
  'flyright',
  'carrier_cancel_unused_fare',
  '2026.09',
  'FlyRight unused-fare refund on carrier cancellation',
  'If FlyRight cancels a flight and the ticket remains unused, the passenger is entitled to a cash refund of the fare paid for that booking. Scheduled, flown, or on-time flights are not eligible under this policy. Compensation is the fare recorded on the booking, not an estimate.'
)
on conflict (provider, policy_key, version) do nothing;

-- ---------------------------------------------------------------------------
-- User autonomy policy
-- ---------------------------------------------------------------------------

create table if not exists public.autonomy_policies (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  investigate_allowed boolean not null default true,
  prepare_allowed boolean not null default true,
  high_impact_ask_above_cents integer not null default 10000
    check (high_impact_ask_above_cents >= 0),
  kill_switch boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.autonomy_policies enable row level security;

drop policy if exists autonomy_policies_select_own on public.autonomy_policies;
drop policy if exists autonomy_policies_insert_own on public.autonomy_policies;
drop policy if exists autonomy_policies_update_own on public.autonomy_policies;

create policy autonomy_policies_select_own on public.autonomy_policies
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy autonomy_policies_insert_own on public.autonomy_policies
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy autonomy_policies_update_own on public.autonomy_policies
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.autonomy_policies to authenticated;

-- ---------------------------------------------------------------------------
-- Eligibility decisions (engine-owned amount)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.eligibility_outcome as enum (
    'eligible',
    'ineligible',
    'uncertain'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.eligibility_decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  outcome public.eligibility_outcome not null,
  amount numeric(12,2),
  currency text not null default 'EUR',
  rule_ids text[] not null default '{}',
  policy_id uuid references public.provider_policies (id),
  reasons text[] not null default '{}',
  inputs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint eligibility_amount_non_negative check (amount is null or amount >= 0),
  constraint eligibility_currency_len check (char_length(currency) = 3)
);

create index if not exists eligibility_decisions_case_idx
  on public.eligibility_decisions (case_id, created_at desc);

alter table public.eligibility_decisions enable row level security;

drop policy if exists eligibility_decisions_select_own on public.eligibility_decisions;
drop policy if exists eligibility_decisions_insert_own on public.eligibility_decisions;

create policy eligibility_decisions_select_own on public.eligibility_decisions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy eligibility_decisions_insert_own on public.eligibility_decisions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = (select auth.uid())
    )
  );

grant select, insert on public.eligibility_decisions to authenticated;

-- ---------------------------------------------------------------------------
-- Action intents, approvals, verifications
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.action_risk_class as enum (
    'READ',
    'PREPARE',
    'MUTATE',
    'HIGH_IMPACT'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.action_intent_status as enum (
    'PROPOSED',
    'APPROVAL_REQUIRED',
    'APPROVED',
    'REJECTED',
    'EXECUTING',
    'PROVIDER_CONFIRMED',
    'VERIFIED',
    'COMPLETED',
    'FAILED',
    'CONFLICT'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.action_intents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  idempotency_key text not null,
  tool_name text not null,
  risk_class public.action_risk_class not null,
  status public.action_intent_status not null default 'PROPOSED',
  payload jsonb not null default '{}'::jsonb,
  amount numeric(12,2),
  currency text not null default 'EUR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index if not exists action_intents_case_idx
  on public.action_intents (case_id, created_at desc);

alter table public.action_intents enable row level security;

drop policy if exists action_intents_select_own on public.action_intents;
drop policy if exists action_intents_insert_own on public.action_intents;
drop policy if exists action_intents_update_own on public.action_intents;

create policy action_intents_select_own on public.action_intents
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy action_intents_insert_own on public.action_intents
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = (select auth.uid())
    )
  );

create policy action_intents_update_own on public.action_intents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update on public.action_intents to authenticated;

create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  action_intent_id uuid not null references public.action_intents (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  decision text not null check (decision in ('approved', 'denied')),
  created_at timestamptz not null default now()
);

create index if not exists approvals_intent_idx on public.approvals (action_intent_id);

alter table public.approvals enable row level security;

drop policy if exists approvals_select_own on public.approvals;
drop policy if exists approvals_insert_own on public.approvals;

create policy approvals_select_own on public.approvals
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy approvals_insert_own on public.approvals
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.approvals to authenticated;

create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  action_intent_id uuid not null references public.action_intents (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  expected jsonb not null,
  observed jsonb not null,
  matched boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists verifications_intent_idx on public.verifications (action_intent_id);

alter table public.verifications enable row level security;

drop policy if exists verifications_select_own on public.verifications;
drop policy if exists verifications_insert_own on public.verifications;

create policy verifications_select_own on public.verifications
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy verifications_insert_own on public.verifications
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.verifications to authenticated;

-- ---------------------------------------------------------------------------
-- FlyRight sandbox (airline UAT catalog — look up, do not auto-attach to Aegis)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.flyright_flight_status as enum (
    'SCHEDULED',
    'ON_TIME',
    'CANCELLED',
    'FLOWN'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.flyright_claim_status as enum (
    'OPEN',
    'UNDER_REVIEW',
    'NEEDS_INFORMATION',
    'ACCEPTED',
    'REJECTED'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.flyright_bookings (
  id uuid primary key default gen_random_uuid(),
  locator text not null unique,
  last_name text not null,
  passenger_first_name text not null,
  flight_number text not null,
  origin text not null,
  destination text not null,
  departure_at timestamptz not null,
  fare_paid numeric(12,2) not null check (fare_paid >= 0),
  currency text not null default 'EUR' check (char_length(currency) = 3),
  flight_status public.flyright_flight_status not null,
  cancelled_by_carrier boolean not null default false,
  ticket_unused boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists flyright_bookings_lookup_idx
  on public.flyright_bookings (locator, last_name);

alter table public.flyright_bookings enable row level security;

-- No authenticated policies: lookups go through the server provider adapter.
revoke all on public.flyright_bookings from anon, authenticated;

create table if not exists public.flyright_claims (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.flyright_bookings (id) on delete restrict,
  locator text not null,
  last_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  status public.flyright_claim_status not null default 'OPEN',
  idempotency_key text not null unique,
  aegis_case_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists flyright_claims_booking_idx on public.flyright_claims (booking_id);
create index if not exists flyright_claims_locator_idx on public.flyright_claims (locator);

alter table public.flyright_claims enable row level security;
revoke all on public.flyright_claims from anon, authenticated;

-- Sandbox bookings (airline test catalog). Not Aegis cases.
insert into public.flyright_bookings (
  locator,
  last_name,
  passenger_first_name,
  flight_number,
  origin,
  destination,
  departure_at,
  fare_paid,
  currency,
  flight_status,
  cancelled_by_carrier,
  ticket_unused
)
values
  (
    'FR1842',
    'MOREAU',
    'Camille',
    'FR1842',
    'CDG',
    'FCO',
    '2026-08-21T06:40:00+00:00',
    183.40,
    'EUR',
    'CANCELLED',
    true,
    true
  ),
  (
    'FR2201',
    'KLEIN',
    'Jonas',
    'FR2201',
    'AMS',
    'BER',
    '2026-09-12T09:15:00+00:00',
    94.00,
    'EUR',
    'SCHEDULED',
    false,
    true
  ),
  (
    'FR0999',
    'BERG',
    'Ingrid',
    'FR0999',
    'OSL',
    'LGW',
    '2026-07-02T14:05:00+00:00',
    210.00,
    'EUR',
    'CANCELLED',
    true,
    true
  )
on conflict (locator) do nothing;

insert into public.flyright_claims (
  booking_id,
  locator,
  last_name,
  amount,
  currency,
  status,
  idempotency_key
)
select
  b.id,
  b.locator,
  b.last_name,
  b.fare_paid,
  b.currency,
  'UNDER_REVIEW',
  'flyright:FR0999:existing-claim'
from public.flyright_bookings b
where b.locator = 'FR0999'
on conflict (idempotency_key) do nothing;
