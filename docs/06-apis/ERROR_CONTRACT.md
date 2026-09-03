# Error Contract

```json
{
  "error": {
    "code": "PERMISSION_REQUIRED",
    "message": "Approval is required before this action can execute.",
    "requestId": "req_...",
    "retryable": false
  }
}
```

## Requirements
- stable code
- user-safe message
- request correlation
- retryability
- no stack trace
- no secret
