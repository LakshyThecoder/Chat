# Incident Runbook

## P0
Potential unauthorized high-impact action or data isolation failure.
1. Disable mutation execution.
2. Preserve audit data.
3. Identify affected cases/users.
4. Rotate secrets if relevant.
5. Reproduce.
6. Patch + test.
7. Re-enable only after security gate.

## P1
Core workflow broken or provider mutation verification failing.
Pause affected capability; preserve user data; investigate.

## P2
Non-critical UI or analytics issue.
Document and schedule.
