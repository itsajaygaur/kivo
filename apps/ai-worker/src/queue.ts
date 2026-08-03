import type { IngestionMessage } from "@kivo/shared";
type ChunkRow = {
  id: string;
  content: string;
  document_id: string;
  version_id: string;
  collection_id: string | null;
  page: number | null;
};
export async function processIngestion(message: IngestionMessage, env: Env): Promise<void> {
  if (message.kind === "purge-document") {
    const ids = await env.DB.prepare(
      "SELECT vector_id FROM chunk WHERE organization_id=? AND document_id=?",
    )
      .bind(message.organizationId, message.documentId)
      .all<{ vector_id: string }>();
    if (ids.results.length)
      await env.VECTOR_INDEX.deleteByIds(ids.results.map(({ vector_id }) => vector_id));
    return;
  }
  const job = await env.DB.prepare(
    "SELECT state FROM ingestion_job WHERE id=? AND organization_id=?",
  )
    .bind(message.jobId, message.organizationId)
    .first<{ state: string }>();
  if (!job || job.state === "completed") return;
  await env.DB.prepare(
    "UPDATE ingestion_job SET state='indexing',attempts=attempts+1,started_at=COALESCE(started_at,?),updated_at=? WHERE id=? AND organization_id=?",
  )
    .bind(Date.now(), Date.now(), message.jobId, message.organizationId)
    .run();
  const rows = await env.DB.prepare(
    "SELECT id,content,document_id,version_id,collection_id,page FROM chunk WHERE organization_id=? AND version_id=? ORDER BY ordinal",
  )
    .bind(message.organizationId, message.versionId)
    .all<ChunkRow>();
  for (let offset = 0; offset < rows.results.length; offset += 25) {
    const slice = rows.results.slice(offset, offset + 25);
    const output = (await env.AI.run(env.EMBEDDING_MODEL as never, {
      text: slice.map(({ content }) => content),
    })) as { data?: number[][] };
    await env.VECTOR_INDEX.upsert(
      slice.map((chunk, i) => ({
        id: chunk.id,
        values: output.data?.[i] ?? [],
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
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE ingestion_job SET state='completed',progress=100,completed_at=?,updated_at=? WHERE id=? AND organization_id=?",
    ).bind(Date.now(), Date.now(), message.jobId, message.organizationId),
    env.DB.prepare(
      "UPDATE document_version SET status='ready',updated_at=? WHERE id=? AND organization_id=?",
    ).bind(Date.now(), message.versionId, message.organizationId),
    env.DB.prepare(
      "UPDATE document SET status='ready',current_version_id=?,updated_at=? WHERE id=? AND organization_id=?",
    ).bind(message.versionId, Date.now(), message.documentId, message.organizationId),
  ]);
}
