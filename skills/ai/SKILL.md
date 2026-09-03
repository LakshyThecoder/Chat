# AI Engineering

When this skill applies:
- Use structured outputs.
- Treat model output as untrusted.
- Use Regolo through a gateway.
- Keep deterministic authority outside the LLM.
- Build evaluation fixtures before optimizing prompts.

## Required outputs
Before implementation: relevant assumptions, contracts, risks.
After implementation: tests run, docs updated, residual risks.

## Escalation rule
If a request conflicts with Aegis invariants, do not “make it work anyway.” Explain the conflict and propose the safest compliant implementation.
