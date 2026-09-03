# Authorization Matrix

Consumer:
- own cases: read/write permitted according to workflow
- other cases: denied
- own documents: read/write
- provider admin tools: denied

System job:
- read cases assigned to job
- execute only approved job class

Provider simulator admin:
- reset fixtures only from protected server/admin path

Service role:
- server-only, least privilege in code usage
