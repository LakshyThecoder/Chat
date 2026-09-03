# AgentRun Contract

## Purpose
bounded AI orchestration run

## Identity
Use an internal stable ID. Provider IDs are separate fields.

## Invariants
- Explicit lifecycle/state.
- No hidden mutation.
- Important fields have defined ownership.
- External inputs are validated.

## Serialization
Expose DTOs rather than raw persistence/domain objects.

## Audit
Mutations must emit an appropriate domain/application event.

## Tests
At least one invariant test and one invalid-input/state test.
