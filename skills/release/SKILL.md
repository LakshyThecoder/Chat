# Release Engineering

When this skill applies:
- Preflight environment variables and secrets.
- Run typecheck/lint/tests/build.
- Run WebMCP smoke test.
- Verify public live URL and resettable provider fixtures.
- Tag the exact submission commit.

## Required outputs
Before implementation: relevant assumptions, contracts, risks.
After implementation: tests run, docs updated, residual risks.

## Escalation rule
If a request conflicts with Aegis invariants, do not “make it work anyway.” Explain the conflict and propose the safest compliant implementation.
