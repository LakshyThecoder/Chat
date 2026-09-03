# Provider State Verification

## Rule
Tool success ≠ completed business action.

## Verification sequence
1. Tool returns.
2. Capture provider reference.
3. Re-read provider state.
4. Compare expected transition against actual state.
5. Persist verification result.
6. Only then confirm action completion.

## Conflict
If actual state differs:
- mark verification failed/conflict,
- do not display success,
- re-plan or request review.
