# Money Rules

## Representation
Use fixed precision/NUMERIC in database and integer minor units or decimal library in application code.

## Rules
- never use binary floating point for authoritative amounts
- currency is always explicit
- rounding policy is documented
- provider amount is preserved separately from computed amount
- model-suggested amount is never authoritative
