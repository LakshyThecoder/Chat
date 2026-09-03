# Regolo Integration

## Purpose
AI inference through Regolo's OpenAI-compatible API.

## Current documentation facts
Regolo documents an OpenAI-compatible API and a model catalog with `/models` and `/model_group/info`. Model metadata includes capabilities such as reasoning, function calling and vision; exact model availability and pricing can change.

## Integration design
Create:
- `RegoloClient`
- `AIProvider`
- `ModelRouter`
- `AIUsageRecorder`

## Requirements
- configurable base URL
- API key server-only
- request timeout
- retry policy
- structured-output validation
- model capability check before routing
- usage metadata
