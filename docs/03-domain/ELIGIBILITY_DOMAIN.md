# Eligibility Domain

## Output
- eligible
- ineligible
- uncertain
- required evidence
- supporting rule IDs
- amount basis
- confidence

## Design
Deterministic rules are explicit and testable.
Model interpretation can supply candidate mappings from messy text to rule inputs.

## Example
If flight status = CANCELLED and purchase exists and claim window is open:
eligible may be true.
Actual compensation amount is calculated deterministically from configured policy rules.
