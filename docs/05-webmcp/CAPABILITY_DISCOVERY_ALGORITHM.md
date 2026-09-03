# Capability Discovery Algorithm

1. Establish target provider origin/context.
2. Read available provider capabilities through the current WebMCP API.
3. Normalize metadata into `ProviderCapability`.
4. Filter disabled/incompatible capabilities.
5. Match requested operation to capability semantics.
6. Validate side-effect class.
7. Check authorization and permission policy.
8. Build typed arguments.
9. Execute.
10. Verify provider state if mutation.
11. Emit action/audit events.

Never select a capability based only on a free-form tool description when a typed schema or explicit semantic metadata is available.
