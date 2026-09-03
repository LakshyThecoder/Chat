# Permission Domain

## Action classes
READ
PREPARE
MUTATE
HIGH_IMPACT

## User policy dimensions
- action type
- provider/category
- monetary threshold
- automatic vs ask
- expiry
- emergency/kill-switch state

## Evaluation
Permission = authorized user + allowed case state + action policy + threshold + no global kill switch + valid capability.

The LLM never participates in the final authorization decision.
