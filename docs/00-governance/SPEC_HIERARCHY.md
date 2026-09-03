# Specification Hierarchy

When instructions conflict, use this order:

1. Safety/security invariants.
2. Agent Constitution.
3. Explicit current task.
4. Architecture contracts and ADRs.
5. Domain contracts.
6. API/WebMCP contracts.
7. Product/UX requirements.
8. Implementation preferences.

A lower-level document cannot override a higher-level safety or security invariant.

## Change protocol
Any change to a higher-level contract requires:
- reason,
- alternatives considered,
- impact,
- tests,
- ADR when the decision is architectural.
