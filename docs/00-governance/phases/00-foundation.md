# Phase 00-foundation

## Tasks

- [x] Initialize strict TypeScript project
- [x] Add environment validation
- [x] Add logging/correlation IDs
- [x] Connect Supabase safely
- [x] Create design token shell
- [x] Create CI typecheck/lint/test/build

## Delivered

- Next.js 15 App Router shell with strict TypeScript
- Zod env validation (`src/config/env.ts`) with classified public/secret vars
- Structured JSON logger + `x-correlation-id` middleware on `/api/*`
- Supabase clients: browser, server (anon), admin (service role, `server-only`)
- Design tokens in `app/tokens.css` mapped through Tailwind
- CI workflow: `.github/workflows/ci.yml`
- Health endpoints:
  - `GET /api/health` — app up
  - `GET /api/health/db` — anon probe of `public.health_check` (no service-role)
- Migration: `supabase/migrations/20260903000000_health_check.sql`

## Out of scope (later phases)

- `/api/health/ai` — Phase 03 (Regolo gateway)
- Auth / RLS domain tables — Wave A / Phase 01+

## Security note

If Regolo or Supabase secrets were ever pasted into chat, rotate them in the provider dashboards and update `.env.local`. Never commit `.env.local`.

## Exit gate

Every listed task is testable and documented before phase completion.
