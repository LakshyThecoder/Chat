-- Theater hardening: audit trail, failure recovery, session supersession.
-- Service-role only. Do not expose these tables to anon/authenticated.

alter table public.theater_sessions
  add column if not exists superseded_at timestamptz;

alter table public.theater_work_items
  add column if not exists last_error jsonb,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists proposal_version integer not null default 0;

alter table public.theater_work_items
  drop constraint if exists theater_work_items_attempt_count_non_negative;

alter table public.theater_work_items
  add constraint theater_work_items_attempt_count_non_negative
  check (attempt_count >= 0);

alter table public.theater_work_items
  drop constraint if exists theater_work_items_proposal_version_non_negative;

alter table public.theater_work_items
  add constraint theater_work_items_proposal_version_non_negative
  check (proposal_version >= 0);

create table if not exists public.theater_audit_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.theater_sessions (id) on delete cascade,
  work_item_id uuid references public.theater_work_items (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint theater_audit_events_payload_is_object
    check (jsonb_typeof(payload) = 'object'),
  constraint theater_audit_events_type_len
    check (char_length(event_type) between 1 and 80)
);

create index if not exists theater_audit_events_session_created_idx
  on public.theater_audit_events (session_id, created_at);

create index if not exists theater_audit_events_item_idx
  on public.theater_audit_events (work_item_id, created_at);

create index if not exists theater_sessions_created_idx
  on public.theater_sessions (created_at);

alter table public.theater_audit_events enable row level security;

revoke all on public.theater_audit_events from anon, authenticated;
