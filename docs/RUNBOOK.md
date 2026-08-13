# Operations runbook

Health checks: web `/api/v1/health`, AI `/health` through service binding, D1 read, queue depth/DLQ, recent error rate, p95 latency, R2 operations, Vectorize mutations, and daily AI neurons. Watch structured log events `vector_retrieval_degraded`, `rerank_degraded`, and `vector_index_failed` — each marks a silent-quality regression that previously had no signal.

Failed ingestion is terminal and visible: after retries are exhausted (or the message lands on `kivo-ingestion-dlq`), the job records `state='failed'` with `error_code`/`error_message`, and the document shows as failed. Inspect the recorded error, verify that the version and chunks still belong to the recorded tenant, fix the cause, then delete and re-upload the document (jobs short-circuit once completed). Never paste source contents into incident systems.

If usage approaches an installation ceiling, pause the affected capability and surface the reset time. Do not turn on paid overages. During a suspected tenant leak, disable AI/search, preserve audit metadata, revoke sessions, determine affected IDs, and notify owners. Deletion removes the R2 original immediately, then the purge consumer deletes Vectorize entries and the D1 chunk rows (the FTS index follows via trigger). Re-uploading a previously deleted file hard-deletes the trashed record first.
