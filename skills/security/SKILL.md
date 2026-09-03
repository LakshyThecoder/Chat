# Security Engineering

When this skill applies:
- Threat-model before shipping consequential actions.
- Enforce authz and permissions server-side.
- Treat all external content as untrusted.
- Audit high-impact actions.
- Prefer fail-closed behavior.

## Required outputs
Before implementation: relevant assumptions, contracts, risks.
After implementation: tests run, docs updated, residual risks.

## Escalation rule
If a request conflicts with Aegis invariants, do not “make it work anyway.” Explain the conflict and propose the safest compliant implementation.
