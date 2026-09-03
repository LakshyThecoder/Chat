# WebMCP Test Matrix

## Discovery
- expected tool appears
- malformed tool not accepted
- duplicate tool names handled
- toolchange/re-registration behavior covered where relevant

## Execution
- valid read
- valid mutation
- invalid arguments
- unauthorized action
- permission denied
- duplicate replay
- provider state conflict
- provider unavailable

## Verification
- success only after state read
- mismatch causes verification failure
- verification retry does not duplicate mutation
