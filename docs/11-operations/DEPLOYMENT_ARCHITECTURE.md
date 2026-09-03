# Deployment Architecture

## Required properties
- portable app
- environment separation
- managed database
- secure secret storage
- public demo URL
- resettable provider fixtures
- health checks

## Deployment sequence
build → migrate → smoke → WebMCP smoke → E2E → promote.
