# Flyright Tools

## Provider
Flyright simulator.

## Tools
- get_booking
- get_flight_status
- get_policy
- calculate_compensation
- submit_claim
- get_claim_status
- request_follow_up

## Required implementation rule
Each tool is backed by persistent provider state and has a test proving the expected state behavior.

## Mutation rule
Mutation tools require idempotency and a post-action verification read.

## Demo rule
Provider is clearly labeled as simulated. The simulated state transition is nevertheless real and persisted.
