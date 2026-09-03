# Background Jobs

## Jobs
- monitor case
- refresh provider state
- process follow-up
- send notification
- retry safe AI task
- cleanup expired upload sessions

## Rules
Jobs must be idempotent.
Every job has:
- job ID
- retry count
- backoff
- dead-letter behavior
- observability
