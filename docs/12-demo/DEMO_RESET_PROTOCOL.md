# Demo Reset Protocol

Use the on-page **Fresh desk** control, or `POST /api/demo/theater/session`.

That:
1. Invalidates the previous theater cookie/session.
2. Issues a new FlyRight booking and Streamly subscription.
3. Re-attaches the shared FR0999 / BERG blocked row.
4. Leaves prior sandbox rows in place (append-oriented; do not hand-edit provider tables during a live demo).

Wait a few seconds between resets (rate limit). Then:
1. Confirm three work items.
2. File without signature → `APPROVAL_REQUIRED`.
3. Do not reset again unless the desk is dirty.
