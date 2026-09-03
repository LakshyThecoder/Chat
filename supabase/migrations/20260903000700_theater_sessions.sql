-- Resolution Theater demo sessions: three sandbox work items per visitor.
-- Service-role only. Tools mutate provider sandboxes and persist verification.

create table if not exists public.theater_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists theater_sessions_expires_idx
  on public.theater_sessions (expires_at);

create table if not exists public.theater_work_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.theater_sessions (id) on delete cascade,
  provider_id text not null,
  title text not null,
  identity jsonb not null,
  status text not null,
  counter jsonb,
  entitlement jsonb,
  proposal jsonb,
  approved_at timestamptz,
  denied_at timestamptz,
  approved_amount numeric(12,2),
  approved_currency text,
  verification jsonb,
  idempotency_key text,
  last_mutation_id text,
  last_mutation_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint theater_work_items_provider_check
    check (provider_id in ('flyright', 'streamly', 'electromart')),
  constraint theater_work_items_status_check
    check (status in (
      'UNINSPECTED',
      'INSPECTED',
      'ENTITLED',
      'PREPARED',
      'AWAITING_SIGNATURE',
      'APPROVED',
      'DENIED',
      'EXECUTED',
      'VERIFIED',
      'FAILED'
    )),
  constraint theater_work_items_identity_is_object
    check (jsonb_typeof(identity) = 'object'),
  constraint theater_work_items_decision_xor
    check (approved_at is null or denied_at is null),
  constraint theater_work_items_approved_amount_non_negative
    check (approved_amount is null or approved_amount >= 0),
  constraint theater_work_items_approved_currency_len
    check (approved_currency is null or char_length(approved_currency) = 3)
);

create index if not exists theater_work_items_session_idx
  on public.theater_work_items (session_id);

create index if not exists theater_work_items_provider_idx
  on public.theater_work_items (provider_id);

create index if not exists theater_work_items_status_idx
  on public.theater_work_items (status);

alter table public.theater_sessions enable row level security;
alter table public.theater_work_items enable row level security;

revoke all on public.theater_sessions from anon, authenticated;
revoke all on public.theater_work_items from anon, authenticated;

