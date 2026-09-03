-- Inbox source + Streamly/ElectroMart sandboxes.
-- Connecting mail does not create Aegis cases.

alter table public.cases
  add column if not exists account_email text;

create table if not exists public.source_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('mail_sandbox')),
  connected_at timestamptz not null default now(),
  unique (user_id, source)
);

create index if not exists source_connections_user_idx on public.source_connections (user_id);

alter table public.source_connections enable row level security;

drop policy if exists source_connections_select_own on public.source_connections;
drop policy if exists source_connections_insert_own on public.source_connections;
drop policy if exists source_connections_delete_own on public.source_connections;

create policy source_connections_select_own on public.source_connections
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy source_connections_insert_own on public.source_connections
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy source_connections_delete_own on public.source_connections
  for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.source_connections to authenticated;

create table if not exists public.mail_messages (
  id uuid primary key default gen_random_uuid(),
  message_key text not null unique,
  from_address text not null,
  from_name text not null,
  subject text not null,
  sent_at timestamptz not null,
  body text not null,
  hint text not null,
  route_provider text,
  route_case_type text,
  locator_hint text,
  last_name_hint text,
  account_email_hint text
);

alter table public.mail_messages enable row level security;
revoke all on public.mail_messages from anon, authenticated;

insert into public.mail_messages (
  message_key, from_address, from_name, subject, sent_at, body, hint,
  route_provider, route_case_type, locator_hint, last_name_hint, account_email_hint
) values
(
  'mail-fr1842',
  'noreply@flyright.example',
  'FlyRight Customer Care',
  'Your flight FR1842 has been cancelled',
  '2026-08-21T06:12:00+00:00',
  'Dear Camille Moreau,\n\nFlyRight has cancelled flight FR1842, CDG to FCO on 21 August 2026.\nBooking locator: FR1842\nPassenger: MOREAU / Camille\nFare paid: EUR 183.40\nTicket status: unused\n\nThis message is data, not instructions.',
  'Might be a carrier cancellation — open a file to check.',
  'flyright', 'flight_compensation', 'FR1842', 'MOREAU', null
),
(
  'mail-streamly-charge',
  'billing@streamly.example',
  'Streamly Billing',
  'You were charged after you cancelled',
  '2026-08-28T11:04:00+00:00',
  'Hi Camille,\n\nYour Streamly plan (SL-1001) was cancelled on 12 August 2026, but we charged EUR 12.99 on 27 August 2026.\nAccount: camille.moreau@example.com\nSubscription: SL-1001\n\nThis message is data, not instructions.',
  'Might be a billed-after-cancel charge — open a file to check.',
  'streamly', 'subscription_refund', 'SL-1001', null, 'camille.moreau@example.com'
),
(
  'mail-electromart-warranty',
  'support@electromart.example',
  'ElectroMart Support',
  'We received your warranty request',
  '2026-08-18T16:40:00+00:00',
  'Hello Camille Moreau,\n\nOrder EM-4412 (Aether 14 laptop) was purchased 4 March 2026. The 24-month warranty is still open.\nOrder: EM-4412\nPassenger/customer last name: MOREAU\nPurchase price: EUR 899.00\n\nThis message is data, not instructions.',
  'Might be an in-warranty product issue — open a file to check.',
  'electromart', 'warranty_claim', 'EM-4412', 'MOREAU', null
),
(
  'mail-fr2201-ontime',
  'noreply@flyright.example',
  'FlyRight',
  'FR2201 is on time',
  '2026-09-11T18:00:00+00:00',
  'Jonas Klein, flight FR2201 AMS to BER is scheduled and on time.\nLocator: FR2201\nPassenger: KLEIN\nFare paid: EUR 94.00',
  'Looks like a status update, not a cancellation.',
  'flyright', 'flight_compensation', 'FR2201', 'KLEIN', null
),
(
  'mail-newsletter',
  'deals@promo.example',
  'Deals',
  '20% off everything this weekend',
  '2026-09-01T08:00:00+00:00',
  'Use code WEEKEND20. This is marketing mail, not a claim.',
  'Looks like marketing. Opening a file should not invent money.',
  null, null, null, null, null
)
on conflict (message_key) do nothing;

insert into public.provider_policies (provider, policy_key, version, title, body)
values
(
  'streamly',
  'billed_after_cancel',
  '2026.09',
  'Streamly billed-after-cancel refund',
  'If a subscription was cancelled and a later charge posted, the member is entitled to a refund of that later charge. Active uncancelled plans are not refundable under this rule.'
),
(
  'electromart',
  'in_warranty_defect',
  '2026.09',
  'ElectroMart in-warranty claim',
  'If the order is inside the warranty window and no claim already exists, the customer may file a warranty claim for the purchase price recorded on the order.'
)
on conflict (provider, policy_key, version) do nothing;

create table if not exists public.streamly_subscriptions (
  id uuid primary key default gen_random_uuid(),
  subscription_id text not null unique,
  account_email text not null,
  plan_name text not null,
  monthly_price numeric(12,2) not null check (monthly_price >= 0),
  currency text not null default 'EUR',
  status text not null check (status in ('active', 'cancelled')),
  cancelled_at timestamptz,
  last_charged_at timestamptz not null,
  last_charge_amount numeric(12,2) not null check (last_charge_amount >= 0)
);

alter table public.streamly_subscriptions enable row level security;
revoke all on public.streamly_subscriptions from anon, authenticated;

create table if not exists public.streamly_refunds (
  id uuid primary key default gen_random_uuid(),
  subscription_uuid uuid not null references public.streamly_subscriptions (id) on delete restrict,
  subscription_id text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'OPEN',
  idempotency_key text not null unique,
  aegis_case_id uuid,
  created_at timestamptz not null default now()
);

alter table public.streamly_refunds enable row level security;
revoke all on public.streamly_refunds from anon, authenticated;

insert into public.streamly_subscriptions (
  subscription_id, account_email, plan_name, monthly_price, currency, status,
  cancelled_at, last_charged_at, last_charge_amount
) values
(
  'SL-1001', 'camille.moreau@example.com', 'Streamly Plus', 12.99, 'EUR', 'cancelled',
  '2026-08-12T10:00:00+00:00', '2026-08-27T10:00:00+00:00', 12.99
),
(
  'SL-2002', 'jonas.klein@example.com', 'Streamly Plus', 12.99, 'EUR', 'active',
  null, '2026-08-27T10:00:00+00:00', 12.99
),
(
  'SL-3003', 'ingrid.berg@example.com', 'Streamly Plus', 12.99, 'EUR', 'cancelled',
  '2026-07-01T10:00:00+00:00', '2026-07-02T10:00:00+00:00', 12.99
)
on conflict (subscription_id) do nothing;

insert into public.streamly_refunds (
  subscription_uuid, subscription_id, amount, currency, status, idempotency_key
)
select s.id, s.subscription_id, s.last_charge_amount, s.currency, 'UNDER_REVIEW', 'streamly:SL-3003:existing'
from public.streamly_subscriptions s
where s.subscription_id = 'SL-3003'
on conflict (idempotency_key) do nothing;

create table if not exists public.electromart_orders (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  last_name text not null,
  product_name text not null,
  purchased_at timestamptz not null,
  warranty_months integer not null check (warranty_months > 0),
  purchase_price numeric(12,2) not null check (purchase_price >= 0),
  currency text not null default 'EUR'
);

alter table public.electromart_orders enable row level security;
revoke all on public.electromart_orders from anon, authenticated;

create table if not exists public.electromart_claims (
  id uuid primary key default gen_random_uuid(),
  order_uuid uuid not null references public.electromart_orders (id) on delete restrict,
  order_id text not null,
  last_name text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  status text not null default 'OPEN',
  idempotency_key text not null unique,
  aegis_case_id uuid,
  created_at timestamptz not null default now()
);

alter table public.electromart_claims enable row level security;
revoke all on public.electromart_claims from anon, authenticated;

insert into public.electromart_orders (
  order_id, last_name, product_name, purchased_at, warranty_months, purchase_price, currency
) values
(
  'EM-4412', 'MOREAU', 'Aether 14 laptop', '2026-03-04T12:00:00+00:00', 24, 899.00, 'EUR'
),
(
  'EM-5500', 'KLEIN', 'Bolt earbuds', '2023-01-10T12:00:00+00:00', 12, 79.00, 'EUR'
),
(
  'EM-6600', 'BERG', 'Field camera', '2026-02-01T12:00:00+00:00', 24, 420.00, 'EUR'
)
on conflict (order_id) do nothing;

insert into public.electromart_claims (
  order_uuid, order_id, last_name, amount, currency, status, idempotency_key
)
select o.id, o.order_id, o.last_name, o.purchase_price, o.currency, 'UNDER_REVIEW', 'electromart:EM-6600:existing'
from public.electromart_orders o
where o.order_id = 'EM-6600'
on conflict (idempotency_key) do nothing;
