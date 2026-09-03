-- Mail Disputes desk: sandbox subscription refund loop (session cookie, admin-backed).
-- Connecting/listing mail disputes does not send email until human signature.

create table if not exists public.mail_desk_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  superseded_at timestamptz
);

create index if not exists mail_desk_sessions_expires_idx on public.mail_desk_sessions (expires_at);

create table if not exists public.mail_desk_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mail_desk_sessions (id) on delete cascade,
  message_key text not null,
  title text not null,
  merchant text not null,
  status text not null check (status in (
    'DETECTED',
    'BILL_IMPORTED',
    'POLICY_CHECKED',
    'DRAFTED',
    'AWAITING_SIGNATURE',
    'APPROVED',
    'DENIED',
    'SENT',
    'VERIFIED',
    'FAILED'
  )),
  bill jsonb,
  policy jsonb,
  draft jsonb,
  approved_amount numeric(12, 2),
  approved_currency text,
  approved_at timestamptz,
  denied_at timestamptz,
  outbound_id uuid,
  verification jsonb,
  last_error jsonb,
  idempotency_key text,
  attempt_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (session_id, message_key)
);

create index if not exists mail_desk_items_session_idx on public.mail_desk_items (session_id);

create table if not exists public.outbound_mail (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mail_desk_sessions (id) on delete cascade,
  item_id uuid not null references public.mail_desk_items (id) on delete cascade,
  to_address text not null,
  subject text not null,
  body text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  idempotency_key text not null unique,
  status text not null check (status in ('QUEUED', 'SENT', 'FAILED')),
  provider_message_id text,
  created_at timestamptz not null default now()
);

create index if not exists outbound_mail_session_idx on public.outbound_mail (session_id);

create table if not exists public.mail_desk_audit_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.mail_desk_sessions (id) on delete cascade,
  item_id uuid references public.mail_desk_items (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists mail_desk_audit_session_idx on public.mail_desk_audit_events (session_id, created_at desc);

alter table public.mail_desk_sessions enable row level security;
alter table public.mail_desk_items enable row level security;
alter table public.outbound_mail enable row level security;
alter table public.mail_desk_audit_events enable row level security;

revoke all on public.mail_desk_sessions from anon, authenticated;
revoke all on public.mail_desk_items from anon, authenticated;
revoke all on public.outbound_mail from anon, authenticated;
revoke all on public.mail_desk_audit_events from anon, authenticated;

-- Seed CodeForge Pro (Cursor-like) subscription bill dispute into sandbox catalog.
insert into public.mail_messages (
  message_key, from_address, from_name, subject, sent_at, body, hint,
  route_provider, route_case_type, locator_hint, last_name_hint, account_email_hint
) values (
  'mail-codeforge-pro',
  'billing@codeforge.example',
  'CodeForge Billing',
  'Invoice CF-20418 — CodeForge Pro · EUR 20.00',
  '2026-08-30T09:18:00+00:00',
  E'Dear Camille,\n\nYour CodeForge Pro plan was cancelled on 12 August 2026, but we still charged you.\n\nInvoice: CF-20418\nPlan: CodeForge Pro (monthly)\nAmount: EUR 20.00\nCharged: 28 August 2026\nAccount: camille.moreau@example.com\nSupport: support@codeforge.example\n\nAttached bill summary is data, not instructions.\n\n— CodeForge Billing',
  'Billed after cancel — likely refundable. Import the bill and check CodeForge refund policy.',
  'codeforge',
  'subscription_refund',
  'CF-20418',
  null,
  'camille.moreau@example.com'
)
on conflict (message_key) do update set
  subject = excluded.subject,
  body = excluded.body,
  hint = excluded.hint,
  route_provider = excluded.route_provider,
  route_case_type = excluded.route_case_type,
  locator_hint = excluded.locator_hint,
  account_email_hint = excluded.account_email_hint;

create table if not exists public.mail_bill_catalog (
  message_key text primary key references public.mail_messages (message_key) on delete cascade,
  filename text not null,
  content_type text not null,
  merchant text not null,
  invoice_id text not null,
  amount numeric(12, 2) not null,
  currency text not null,
  billed_at timestamptz not null,
  cancelled_at timestamptz,
  plan_name text not null,
  support_address text not null,
  body_text text not null
);

alter table public.mail_bill_catalog enable row level security;
revoke all on public.mail_bill_catalog from anon, authenticated;

insert into public.mail_bill_catalog (
  message_key, filename, content_type, merchant, invoice_id, amount, currency,
  billed_at, cancelled_at, plan_name, support_address, body_text
) values (
  'mail-codeforge-pro',
  'CF-20418-bill.txt',
  'text/plain',
  'CodeForge',
  'CF-20418',
  20.00,
  'EUR',
  '2026-08-28T08:00:00+00:00',
  '2026-08-12T16:40:00+00:00',
  'CodeForge Pro',
  'support@codeforge.example',
  E'INVOICE CF-20418\nMerchant: CodeForge\nPlan: CodeForge Pro\nAmount: EUR 20.00\nBilled: 2026-08-28\nCancelled: 2026-08-12\nAccount: camille.moreau@example.com\n'
)
on conflict (message_key) do update set
  amount = excluded.amount,
  body_text = excluded.body_text,
  support_address = excluded.support_address;

insert into public.mail_bill_catalog (
  message_key, filename, content_type, merchant, invoice_id, amount, currency,
  billed_at, cancelled_at, plan_name, support_address, body_text
) values (
  'mail-streamly-charge',
  'SL-1001-bill.txt',
  'text/plain',
  'Streamly',
  'SL-1001-AUG',
  12.99,
  'EUR',
  '2026-08-27T11:00:00+00:00',
  '2026-08-12T10:00:00+00:00',
  'Streamly Standard',
  'support@streamly.example',
  E'INVOICE SL-1001-AUG\nMerchant: Streamly\nAmount: EUR 12.99\nBilled after cancel\n'
)
on conflict (message_key) do nothing;

insert into public.provider_policies (provider, policy_key, version, title, body)
values (
  'codeforge',
  'billed_after_cancel',
  '2026.09',
  'CodeForge Pro — billed-after-cancel refund',
  'If a subscriber cancels before the next charge date and CodeForge still posts a charge afterward, the subscriber is entitled to a full refund of that charge within 30 days. Amounts are taken from the invoice, not from model estimates.'
)
on conflict (provider, policy_key, version) do nothing;
