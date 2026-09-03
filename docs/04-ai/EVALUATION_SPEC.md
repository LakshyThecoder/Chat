# AI Evaluation Specification

## Why
Aegis cannot rely on “it looked good once.”

## Evaluation sets
- clean receipt
- noisy invoice
- contradictory evidence
- missing policy
- prompt injection document
- ambiguous cancellation
- multiple transactions
- image screenshot

## Metrics
- extraction accuracy
- hallucinated-fact rate
- provenance coverage
- structured-output validity
- strategy usefulness
- unsafe-action proposal rate

## Release gate
No regression on critical hallucination/provenance/security suites.
