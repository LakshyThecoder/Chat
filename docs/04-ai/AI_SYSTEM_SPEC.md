# AI System Specification

## Provider
Regolo AI through an OpenAI-compatible gateway. Keep all provider-specific logic inside the gateway.

## Responsibilities
- document interpretation
- fact extraction
- timeline normalization
- policy concept mapping
- strategy proposal
- claim drafting
- provider message interpretation

## Non-responsibilities
- authorization
- permission
- money arithmetic
- final state mutation
- audit authority
- verification

## AI run lifecycle
INPUT_CAPTURED
→ CONTEXT_BUILT
→ MODEL_REQUESTED
→ OUTPUT_RECEIVED
→ SCHEMA_VALIDATED
→ DOMAIN_VALIDATED
→ ACCEPTED or REJECTED

## Context discipline
Only pass relevant verified facts, relevant untrusted content in explicit delimiters, policy references, capabilities and autonomy policy metadata.

## Reliability
Timeouts and invalid schemas are recoverable errors.
Repeated invalid output should escalate to human review rather than recursively retry forever.
