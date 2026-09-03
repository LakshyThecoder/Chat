# Failure Recovery

## AI timeout
Retry bounded times; fallback to safe deterministic path or review.

## Invalid model output
Reject schema; retry; then escalate.

## Tool timeout
Persist pending action with idempotency key; reconcile before retrying.

## Provider state conflict
Re-read and replan.

## Verification failure
Do not show success. Mark action as verification_failed and request review.

## Database outage
Do not attempt consequential provider mutation unless required state/audit guarantees are available.
