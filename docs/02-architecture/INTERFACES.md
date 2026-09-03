# Core Interfaces

```ts
interface AIProvider {
  generate<T>(request: StructuredGenerationRequest): Promise<StructuredResult<T>>;
}

interface CapabilityProvider {
  listCapabilities(context: CapabilityContext): Promise<Capability[]>;
  executeCapability(request: CapabilityExecutionRequest): Promise<CapabilityResult>;
}

interface PermissionEngine {
  evaluate(input: PermissionInput): PermissionDecision;
}

interface ProviderStateReader {
  readCaseState(input: ProviderStateQuery): Promise<ProviderState>;
}

interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}
```

Concrete adapters must implement these interfaces without leaking infrastructure details into the domain.
