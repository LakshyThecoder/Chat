# RLS Testing

For every protected table:
- owner SELECT allowed
- non-owner SELECT denied
- owner INSERT allowed only where appropriate
- non-owner INSERT rejected
- UPDATE ownership enforced
- DELETE ownership enforced
- anon blocked from private data

Run database-level tests before release.
