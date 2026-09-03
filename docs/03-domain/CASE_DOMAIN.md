# Case Domain

## Aggregate
Case is the primary workflow aggregate.

## Required fields
- internal ID
- user ID
- provider ID
- case type
- lifecycle state
- monetary amount at risk
- currency
- confidence
- timestamps

## Invariants
- case belongs to one user
- currency must be valid
- amount must be non-negative
- lifecycle transitions must be explicit
- closed cases cannot execute new mutations
- claim amount cannot exceed the deterministic maximum established by domain rules without explicit override/review
