# Operations runbook

Health checks: web `/api/v1/health`, AI `/health` through service binding, D1 read, queue depth/DLQ, recent error rate, p95 latency, R2 operations, Vectorize mutations, and daily AI neurons.

For failed ingestion, inspect the job and redacted exception, verify that the version and chunks still belong to the recorded tenant, fix the cause, then requeue the same identifiers. Jobs are idempotent. Never paste source contents into incident systems.

If usage approaches an installation ceiling, pause the affected capability and surface the reset time. Do not turn on paid overages. During a suspected tenant leak, disable AI/search, preserve audit metadata, revoke sessions and keys, determine affected IDs, and notify owners. Deletion removes vectors, R2 versions, D1 chunks/metadata, then records a content-free completion event.
