-- Guest chamber sessions: one sandbox ticket per visitor, service-role only.
-- Catalog bookings stay readable through the FlyRight adapter; chamber tickets are issued copies.

alter table public.flyright_bookings
  add column if not exists issued_by text not null default 'catalog';

alter table public.flyright_bookings
  drop constraint if exists flyright_bookings_issued_by_check;

alter table public.flyright_bookings
  add constraint flyright_bookings_issued_by_check
  check (issued_by in ('catalog', 'chamber'));

create index if not exists flyright_bookings_issued_by_idx
  on public.flyright_bookings (issued_by);

create table if not exists public.chamber_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  booking_id uuid not null references public.flyright_bookings (id) on delete restrict,
  approved_at timestamptz,
  denied_at timestamptz,
  approved_amount numeric(12,2),
  approved_currency text,
  verification jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chamber_sessions_decision_xor check (
    approved_at is null or denied_at is null
  ),
  constraint chamber_sessions_approved_amount_non_negative check (
    approved_amount is null or approved_amount >= 0
  ),
  constraint chamber_sessions_approved_currency_len check (
    approved_currency is null or char_length(approved_currency) = 3
  )
);

create index if not exists chamber_sessions_booking_idx
  on public.chamber_sessions (booking_id);

create index if not exists chamber_sessions_expires_idx
  on public.chamber_sessions (expires_at);

alter table public.chamber_sessions enable row level security;
revoke all on public.chamber_sessions from anon, authenticated;
