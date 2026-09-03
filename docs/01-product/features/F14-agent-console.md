# F14-agent-console

## Objective
Expose capability discovery, action and trust state.

## Required product outcome
The feature must produce a measurable user outcome, not merely a UI artifact.

## Preconditions
Read the case/state requirements in the domain docs.

## Happy path
Implement the smallest complete path through the application.

## Failure paths
At minimum cover:
- invalid input
- authorization failure
- domain state conflict
- external dependency failure
- user cancellation
- recovery/resume

## AI boundary
Document exactly where AI is allowed and what remains deterministic.

## WebMCP boundary
Document whether the feature discovers/executes capabilities or only consumes provider data.

## Permission
Document action risk classification and approval behavior.

## Audit
List every consequential event the feature emits.

## Tests
Required:
- unit
- integration
- failure
- permission
- E2E when user-facing.

## Definition of done
No hidden placeholder success; documentation and tests updated.
