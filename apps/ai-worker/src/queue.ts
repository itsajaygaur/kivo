import type { IngestionMessage } from "@kivo/shared";
type ChunkRow = {
  id: string;
  content: string;
  document_id: string;
  version_id: string;
  collection_id: string | null;
  page: number | null;
};

const maxAttempts = 4;

export async function markFailed(
  env: Env,
  message: IngestionMessage,
  reason: string,
): Promise<void> {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE ingestion_job SET state='failed',error_code='indexing_failed',error_message=?,updated_at=? WHERE id=? AND organization_id=?",
    ).bind(reason.slice(0, 500), now, message.jobId, message.organizationId),
    env.DB.prepare(
      "UPDATE document_version SET status='failed',updated_at=? WHERE id=? AND organization_id=?",
    ).bind(now, message.versionId, message.organizationId),
    env.DB.prepare(
      "UPDATE document SET status='failed',updated_at=? WHERE id=? AND organization_id=?",
    ).bind(now, message.documentId, message.organizationId),
  ]);
}

async function deleteVectors(env: Env, ids: string[], documentId: string): Promise<boolean> {
  if (!ids.length) return true;
  try {
    await env.VECTOR_INDEX.deleteByIds(ids);
    return true;
  } catch (error) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "vector_purge_degraded",
        documentId,
        vectorCount: ids.length,
        message: error instanceof Error ? error.message : "Vectorize unavailable",
      }),
    );
    return false;
  }
}

export async function processIngestion(message: IngestionMessage, env: Env): Promise<void> {
  if (message.kind === "purge-document") {
    const ids = await env.DB.prepare(
      "SELECT vector_id FROM chunk WHERE organization_id=? AND document_id=?",
    )
      .bind(message.organizationId, message.documentId)
      .all<{ vector_id: string }>();
    await deleteVectors(
      env,
      ids.results.map(({ vector_id }) => vector_id),
      message.documentId,
    );
    // The chunk text itself must not outlive the document. The FTS delete trigger
    // keeps chunk_fts in sync; orphaned vectors are excluded by the D1 join at
    // query time even when the Vectorize delete above degraded.
    await env.DB.prepare("DELETE FROM chunk WHERE organization_id=? AND document_id=?")
      .bind(message.organizationId, message.documentId)
      .run();
    return;
  }
  const job = await env.DB.prepare(
    "SELECT state,attempts FROM ingestion_job WHERE id=? AND organization_id=?",
  )
    .bind(message.jobId, message.organizationId)
    .first<{ state: string; attempts: number }>();
  if (!job || job.state === "completed") return;
  const attempt = job.attempts + 1;
  await env.DB.prepare(
    "UPDATE ingestion_job SET state='indexing',attempts=?,started_at=COALESCE(started_at,?),updated_at=? WHERE id=? AND organization_id=?",
  )
    .bind(attempt, Date.now(), Date.now(), message.jobId, message.organizationId)
    .run();
  if (message.staleVectorIds?.length)
    await deleteVectors(env, message.staleVectorIds, message.documentId);
  const rows = await env.DB.prepare(
    "SELECT id,content,document_id,version_id,collection_id,page FROM chunk WHERE organization_id=? AND version_id=? ORDER BY ordinal",
  )
    .bind(message.organizationId, message.versionId)
    .all<ChunkRow>();
  try {
    // VECTORIZE_MODE=off is the explicit local-development escape hatch: Vectorize
    // is not emulated locally, so documents complete as FTS-only on purpose instead
    // of burning retries and being marked failed.
    for (
      let offset = 0;
      env.VECTORIZE_MODE !== "off" && offset < rows.results.length;
      offset += 25
    ) {
      const slice = rows.results.slice(offset, offset + 25);
      const output = (await env.AI.run(env.EMBEDDING_MODEL as never, {
        text: slice.map(({ content }) => content),
      })) as { data?: number[][] };
      const vectors = output.data;
      if (!vectors || vectors.length !== slice.length || vectors.some((vector) => !vector?.length))
        throw new Error("Embedding provider returned an unexpected batch shape");
      await env.VECTOR_INDEX.upsert(
        slice.map((chunk, i) => ({
          id: chunk.id,
          values: vectors[i]!,
          metadata: {
            organizationId: message.organizationId,
            documentId: chunk.document_id,
            versionId: chunk.version_id,
            collectionId: chunk.collection_id ?? "",
            page: chunk.page ?? 0,
          },
        })),
      );
      await env.DB.prepare(
        "UPDATE ingestion_job SET progress=?,updated_at=? WHERE id=? AND organization_id=?",
      )
        .bind(
          Math.round(((offset + slice.length) / Math.max(1, rows.results.length)) * 100),
          Date.now(),
          message.jobId,
          message.organizationId,
        )
        .run();
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Vector indexing failed";
    console.error(
      JSON.stringify({
        level: "error",
        event: "vector_index_failed",
        jobId: message.jobId,
        attempt,
        message: reason,
      }),
    );
    if (attempt >= maxAttempts) {
      // Terminal: record the failure honestly instead of reporting a
      // partially indexed document as ready.
      await markFailed(env, message, reason);
      return;
    }
    throw error;
  }
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE ingestion_job SET state='completed',progress=100,error_code=NULL,error_message=NULL,completed_at=?,updated_at=? WHERE id=? AND organization_id=?",
    ).bind(Date.now(), Date.now(), message.jobId, message.organizationId),
    env.DB.prepare(
      "UPDATE document_version SET status='ready',updated_at=? WHERE id=? AND organization_id=?",
    ).bind(Date.now(), message.versionId, message.organizationId),
    env.DB.prepare(
      "UPDATE document SET status='ready',current_version_id=?,updated_at=? WHERE id=? AND organization_id=?",
    ).bind(message.versionId, Date.now(), message.documentId, message.organizationId),
  ]);
}
