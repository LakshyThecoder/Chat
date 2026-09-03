# Case State Contract

## States
DRAFT
INVESTIGATING
READY_FOR_REVIEW
AWAITING_APPROVAL
EXECUTING
SUBMITTED
UNDER_REVIEW
NEEDS_INFORMATION
RESOLVED
FAILED
CLOSED

## Transition ownership
Only the domain/application command layer may transition a case.

## Preconditions
Each transition declares:
- current state
- required evidence
- required permission
- provider state requirements
- whether external action is involved

## Atomicity
A case transition tied to a provider mutation must not be marked successful before verification.
