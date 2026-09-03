# streamly.get_billing_history

## Side-effect class
READ

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
Normal authenticated read authorization.

## Idempotency
Not required unless provider API semantics require it.

## Result
Stable normalized result.

## Verification
Read verification where result semantics are consequential.

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
