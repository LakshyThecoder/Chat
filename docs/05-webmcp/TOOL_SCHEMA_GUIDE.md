# WebMCP Tool Schema Guide

## Inputs
Prefer small typed inputs.
Avoid allowing arbitrary provider-side query strings where a narrow identifier is sufficient.

## Outputs
Return structured application-friendly results where supported by the integration layer. Normalize provider responses before they enter the domain.

## Error handling
Tools should return deterministic error categories that Aegis can map to:
- validation
- authorization
- conflict
- unavailable
- duplicate
- internal

## Side effects
Side-effect class is mandatory metadata.
