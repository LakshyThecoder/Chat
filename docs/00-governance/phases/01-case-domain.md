# Phase 01-case-domain

## Tasks

- [x] Implement Case aggregate
- [x] Implement case state machine
- [x] Implement command/query interfaces
- [x] Implement case audit events

## Delivered

- Domain: `src/domain/cases/{state-machine,types,case-service}.ts`
- Application: create/transition commands + case queries
- Infrastructure: in-memory + Supabase repositories
- API: `GET/POST /api/cases`, `GET /api/cases/[caseId]`, `POST /api/cases/[caseId]/transition`
- UI: Command Center shell, cases list/new/detail with audit trail
- Migration: `20260903000100_profiles_and_cases.sql` (RLS on profiles/cases/case_events)
- Auth gate: API and case pages require Supabase session

## Notes

- `READY_FOR_REVIEW → EXECUTING` requires `autonomousExecutionAllowed` from the permission engine; API currently rejects client-supplied autonomy.
- Evidence upload, eligibility, WebMCP remain later waves.

## Exit gate

Every listed task is testable and documented before phase completion.
