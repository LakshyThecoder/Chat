-- Unused return is an eligibility input, not a seeded win.
alter table public.electromart_orders
  add column if not exists return_opened boolean not null default false;
