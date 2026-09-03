# Phase 02-evidence

## Tasks

- [x] Secure upload path with type/size validation
- [x] Document metadata + content hash
- [x] Provenance-ready evidence_facts table
- [x] Evidence panel on case detail

## Delivered

- Migration `20260903000200_documents_evidence.sql`
- Domain validation: `src/domain/evidence/validation.ts`
- Upload command + API: `POST/GET /api/cases/[caseId]/evidence`
- Private Storage bucket `evidence` with per-user folder RLS
- Case workspace evidence list + upload form

## Remaining for full Phase 02 exit

- Fixture document → structured extracted facts (AI Phase 03)
- Provenance popover UI polish

## Exit gate

Every listed task is testable and documented before phase completion.
