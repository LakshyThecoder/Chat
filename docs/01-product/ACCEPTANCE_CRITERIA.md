# Acceptance Criteria

## Primary case
Given the FlyRight cancellation fixture:
- Upload completes.
- Facts are extracted into schema-valid objects.
- Every displayed important fact has provenance.
- Timeline is coherent.
- Policy is attached/versioned.
- Eligibility result matches deterministic rules.
- Requested amount is calculated deterministically.
- Claim preview contains only verified facts.
- Permission engine requires approval under configured threshold.
- WebMCP tool executes with valid typed input.
- Provider state changes.
- Aegis reads provider state and verifies the mutation.
- Case transitions to Submitted.
- Audit trail records the action.

## Security
A direct client request attempting to submit without permission must fail.

## Reliability
A duplicate submission must not create two claims.
