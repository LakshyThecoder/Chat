# RLS Strategy

## Baseline
Every exposed user-owned table has RLS.

## User ownership
A user can read/write only their own:
- cases
- evidence
- documents
- claims
- permissions
- notifications

## Server-only tables
Provider capability metadata and system jobs may be restricted to service/server roles.

## Test requirement
For every protected table:
- authenticated owner can perform intended action
- different user cannot
- anon cannot
- service role can only be used server-side
