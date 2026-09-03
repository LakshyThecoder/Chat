# Command / Query Catalog

## Commands
CreateCase
UploadDocument
ConfirmExtractedFacts
AttachPolicy
EvaluateEligibility
CreateStrategy
PrepareClaim
RequestApproval
ApproveAction
DenyAction
ExecuteAction
VerifyAction
RequestFollowUp
ApproveFollowUp
CloseCase

## Queries
GetCase
ListCases
GetEvidence
GetTimeline
GetPolicy
GetStrategies
GetClaim
GetActionHistory
GetPermissions
GetCapabilities
GetProviderState

Commands mutate state; queries must remain side-effect free.
