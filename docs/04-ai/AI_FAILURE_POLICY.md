# AI Failure Policy

## Safe fallback hierarchy
1. Retry with same validated request.
2. Try configured fallback model.
3. Reduce task scope.
4. Request missing information.
5. Escalate to human review.

Never:
- fabricate
- skip permission
- execute unverified action
