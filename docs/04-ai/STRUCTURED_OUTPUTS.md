# AI Structured Outputs

## Required schema families
- ExtractedCaseFacts
- TimelineDraft
- PolicyMapping
- StrategyProposal
- ClaimDraft
- ProviderStatusInterpretation

## Validation sequence
raw response
→ JSON parse
→ schema validation
→ semantic validation
→ provenance check
→ acceptance

## Semantic validation examples
- amount non-negative
- currency valid
- evidence IDs exist
- dates are parseable
- claim amount matches deterministic calculation
- referenced policy/version exists
