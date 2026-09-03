# Electromart Tools

## Provider
Electromart simulator.

## Tools
- get_order
- get_return_policy
- get_warranty
- create_return
- submit_warranty_claim
- get_case_status

## Required implementation rule
Each tool is backed by persistent provider state and has a test proving the expected state behavior.

## Mutation rule
Mutation tools require idempotency and a post-action verification read.

## Demo rule
Provider is clearly labeled as simulated. The simulated state transition is nevertheless real and persisted.
