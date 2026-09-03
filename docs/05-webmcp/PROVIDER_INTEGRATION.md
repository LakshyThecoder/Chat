# Provider Integration Contract

Every provider implementation must include:
1. provider identity
2. capability manifest
3. state model
4. tool schemas
5. provider API/state store
6. fixtures
7. reset endpoint/operation for demo
8. error cases
9. verification queries
10. integration tests

Provider-specific code must not leak into generic case strategy logic.
