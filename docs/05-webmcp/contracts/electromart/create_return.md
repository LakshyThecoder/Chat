# electromart.create_return

## Side-effect class
MUTATE

## Purpose
Define the user/business capability this tool provides.

## Input schema
Must be JSON-schema-compatible and narrow.

## Preconditions
- authorization
- provider state
- required identifiers
- required evidence where applicable

## Permission
Mandatory server-side permission check immediately before execution.

## Idempotency
Mandatory. Use stable action intent key.

## Result
Stable normalized result.

## Verification
Required post-mutation state read.

## Errors
INVALID_ARGUMENT
UNAUTHORIZED
FORBIDDEN
CONFLICT
UNAVAILABLE
DUPLICATE_ACTION
INTERNAL_ERROR

## Tests
- valid
- invalid
- unauthorized
- provider conflict
- timeout/unavailable
- replay for mutations
