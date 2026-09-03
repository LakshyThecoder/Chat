# System Architecture

## High-level topology

Browser
  ↓
Next.js UI
  ↓
Application API
  ↓
Domain services
  ├── CaseService
  ├── EvidenceService
  ├── PolicyService
  ├── EligibilityEngine
  ├── StrategyEngine
  ├── PermissionEngine
  ├── ActionService
  ├── VerificationService
  ├── MonitoringService
  └── AuditService
  ↓
Infrastructure
  ├── Supabase
  ├── Storage
  ├── Regolo AI Gateway
  ├── WebMCP Capability Adapter
  └── Provider Adapters

## Dependency rule
Outer layers depend inward; domain does not depend on concrete infrastructure.

## Command path
User intent
→ validate
→ authorize
→ load case
→ domain decision
→ permission
→ tool execution
→ provider verification
→ transaction/audit
→ response.

## Read path
User query
→ authorize
→ domain projection
→ DTO
→ UI.

## Async path
Case event
→ job
→ provider check
→ state reconciliation
→ audit/event
→ notification.
