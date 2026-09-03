# Demo Failure Playbook

## If AI is slow
Use preloaded fixture and cached structured extraction while still indicating the true state.

## If provider tool fails
Do not display fake success. Switch to a tested secondary provider fixture if the submission plan supports it.

## If WebMCP discovery fails
Use the documented target browser environment and a preflight check. Do not claim WebMCP succeeded if it did not.

## If database is slow
Provider state remains source of truth for provider action; Aegis must not fabricate synchronization.

## Reset
Every demo provider has deterministic reset fixtures.
