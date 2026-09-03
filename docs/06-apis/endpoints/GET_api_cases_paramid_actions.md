# GET /api/cases/:id/actions

## Purpose
List actions

## Authentication
Authenticated user unless explicitly documented otherwise.

## Authorization
Resource ownership must be checked server-side.

## Request
Validate all input at boundary.

## Response
Return a stable DTO. Do not expose raw database/provider objects.

## Errors
Use `docs/06-apis/ERROR_CONTRACT.md`.

## Idempotency
Required for POSTs that can cause consequential state changes.

## Audit
Document emitted events before implementation.

## Tests
- auth
- authz
- validation
- success
- failure
- idempotency when applicable
