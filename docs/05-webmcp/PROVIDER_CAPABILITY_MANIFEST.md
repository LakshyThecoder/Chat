# Provider Capability Manifest

Every provider should expose a machine-readable manifest internally for development/testing:

```json
{
  "provider": "flyright",
  "version": "1.0.0",
  "capabilities": [
    {
      "name": "submit_claim",
      "version": "1.0.0",
      "sideEffect": "HIGH_IMPACT"
    }
  ]
}
```

The WebMCP registration remains the browser-facing capability contract. The manifest is a development/test aid and must not become a second conflicting source of truth.
