# WebMCP System Specification

## Current web primitive
The current WebMCP specification exposes `document.modelContext` with methods including:
- `registerTool()`
- `getTools()`
- `executeTool()`
and `toolchange` events.

Treat the live WebMCP specification as authoritative. Do not copy stale examples that use deprecated/non-current entry points.

## Provider role
A provider website exposes structured capabilities for agents.

## Aegis role
Aegis discovers/understands capabilities, checks permissions, executes typed calls and verifies resulting provider state.

## Tool categories
READ — observe
PREPARE — draft/create reversible preparation
MUTATE — change state
HIGH_IMPACT — consequential financial/cancellation/settlement action

## Tool contract
Each tool must define:
- name
- title where useful
- description
- JSON schema
- side-effect classification
- expected auth context
- idempotency strategy where mutating
- deterministic return/error semantics

## Verification rule
After mutation:
tool result
→ provider state read
→ expected state transition verified
→ Aegis action confirmed.

## Compatibility
Any shim for browser differences must live in `infrastructure/webmcp/`.
