# Streamly Tools

## Provider
Streamly simulator.

## Tools
- get_subscription
- get_billing_history
- get_cancellation_policy
- cancel_subscription
- request_refund
- get_case_status

## Required implementation rule
Each tool is backed by persistent provider state and has a test proving the expected state behavior.

## Mutation rule
Mutation tools require idempotency and a post-action verification read.

## Demo rule
Provider is clearly labeled as simulated. The simulated state transition is nevertheless real and persisted.
