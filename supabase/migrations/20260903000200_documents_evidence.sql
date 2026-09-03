-- Documents + evidence facts + private storage bucket policies.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  filename text not null,
  content_type text not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 10485760),
  storage_path text not null,
  sha256 text not null,
  source text not null default 'upload',
  created_at timestamptz not null default now(),
  constraint documents_content_type_allowed check (
    content_type in (
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/webp',
      'text/plain'
    )
  )
);

create index if not exists documents_case_id_idx on public.documents (case_id);
create index if not exists documents_user_id_idx on public.documents (user_id);
create unique index if not exists documents_case_sha_uidx on public.documents (case_id, sha256);

alter table public.documents enable row level security;

drop policy if exists documents_select_own on public.documents;
drop policy if exists documents_insert_own on public.documents;

create policy documents_select_own on public.documents
  for select to authenticated
  using (user_id = auth.uid());

create policy documents_insert_own on public.documents
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = auth.uid()
    )
  );

create table if not exists public.evidence_facts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  document_id uuid references public.documents (id) on delete set null,
  fact_key text not null,
  fact_value text not null,
  confidence numeric(4,3),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists evidence_facts_case_id_idx on public.evidence_facts (case_id);

alter table public.evidence_facts enable row level security;

drop policy if exists evidence_facts_select_own on public.evidence_facts;
drop policy if exists evidence_facts_insert_own on public.evidence_facts;

create policy evidence_facts_select_own on public.evidence_facts
  for select to authenticated
  using (user_id = auth.uid());

create policy evidence_facts_insert_own on public.evidence_facts
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.cases c
      where c.id = case_id and c.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

drop policy if exists evidence_storage_select_own on storage.objects;
drop policy if exists evidence_storage_insert_own on storage.objects;

create policy evidence_storage_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy evidence_storage_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
