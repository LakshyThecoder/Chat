# Idempotency

## Scope
All consequential action endpoints and provider mutations.

## Key
Client or server derives a stable action intent key from:
- case
- action type
- target
- approved request
- authorization context

## Behavior
First execution persists result.
Repeat returns the existing action result rather than creating a duplicate side effect.
