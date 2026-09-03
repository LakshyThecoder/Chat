# Database Schema

## users
id, display_name, created_at, updated_at

## profiles
user_id, locale, timezone, preferences

## cases
id, user_id, provider_id, type, status, amount_at_risk, currency, confidence, created_at, updated_at

## documents
id, case_id, storage_key, mime_type, size_bytes, content_hash, source_type, created_at

## evidence
id, case_id, document_id, fact_type, fact_value_json, provenance_json, confidence, verification_status, created_at

## timeline_events
id, case_id, occurred_at, event_type, source_ref, payload_json, verified

## policies
id, provider_id, version, effective_from, source_ref, content_ref, rules_json

## claims
id, case_id, requested_amount, currency, reason, status, provider_claim_id, created_at, updated_at

## permissions
id, user_id, action_type, threshold_amount, behavior, expires_at, updated_at

## agent_runs
id, case_id, status, model_id, prompt_version, started_at, finished_at

## agent_actions
id, case_id, agent_run_id, action_type, tool_name, input_hash, side_effect_class, status, provider_reference, verification_status, created_at

## provider_tools
id, provider_id, name, version, schema_json, side_effect_class, enabled

## resolutions
case_id, outcome, recovered_amount, currency, resolved_at

## notifications
id, user_id, case_id, type, status, created_at
