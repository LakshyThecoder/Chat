# Architecture

When this skill applies:
- Preserve module boundaries and dependency direction.
- Use ports/adapters for Regolo, Supabase, storage, providers and WebMCP.
- Prefer modular monolith until measured scale requires extraction.
- Record significant structural decisions as ADRs.


## Required outputs
Before implementation: relevant assumptions, contracts, risks.
After implementation: tests run, docs updated, residual risks.

## Escalation rule
If a request conflicts with Aegis invariants, do not “make it work anyway.” Explain the conflict and propose the safest compliant implementation.
