import {
  boundedEvidence,
  reciprocalRankFusion,
  type Citation,
  type RankedChunk,
  type SearchRequest,
} from "@kivo/shared";
type VectorMatch = { id: string; score: number };
type ChunkRow = {
  id: string;
  document_id: string;
  version_id: string;
  collection_id: string | null;
  content: string;
  page: number | null;
  title: string;
};
async function embed(env: Env, text: string): Promise<number[]> {
  const result = (await env.AI.run(env.EMBEDDING_MODEL as never, { text: [text] })) as {
    data?: number[][];
  };
  if (!result.data?.[0]) throw new Error("Embedding provider returned no vector");
  return result.data[0];
}
export async function retrieve(env: Env, request: SearchRequest): Promise<RankedChunk[]> {
  const vectorResult = await env.VECTOR_INDEX.query(await embed(env, request.query), {
    topK: 30,
    returnMetadata: "all",
    filter: { organizationId: request.organizationId },
  });
  const words = request.query
    .replace(/["'*:()]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `"${word}"`)
    .join(" OR ");
  const fts = words
    ? await env.DB.prepare(
        "SELECT chunk_id AS id,bm25(chunk_fts) AS rank FROM chunk_fts WHERE chunk_fts MATCH ? AND organization_id=? ORDER BY rank LIMIT 30",
      )
        .bind(words, request.organizationId)
        .all<{ id: string; rank: number }>()
    : { results: [] };
  const fused = reciprocalRankFusion([
    (vectorResult.matches as VectorMatch[]).map(({ id }) => ({ id })),
    (fts.results ?? []).map(({ id }) => ({ id })),
  ]).slice(0, 20);
  if (!fused.length) return [];
  const rows = await env.DB.prepare(
    `SELECT c.id,c.document_id,c.version_id,c.collection_id,c.content,c.page,d.title FROM chunk c JOIN document d ON d.id=c.document_id AND d.organization_id=c.organization_id WHERE c.organization_id=? AND c.id IN (${fused.map(() => "?").join(",")}) AND d.deleted_at IS NULL`,
  )
    .bind(request.organizationId, ...fused.map(({ id }) => id))
    .all<ChunkRow>();
  const byId = new Map((rows.results ?? []).map((row) => [row.id, row]));
  let candidates = fused.flatMap((item, rank) => {
    const row = byId.get(item.id);
    if (
      !row ||
      (request.collectionIds?.length &&
        (!row.collection_id || !request.collectionIds.includes(row.collection_id)))
    )
      return [];
    return [
      {
        id: row.id,
        chunkId: row.id,
        documentId: row.document_id,
        versionId: row.version_id,
        collectionId: row.collection_id ?? "",
        title: row.title,
        content: row.content,
        excerpt: row.content.slice(0, 420),
        page: row.page,
        score: Math.min(1, item.score * 30),
        rank,
      } satisfies RankedChunk,
    ];
  });
  if (candidates.length > 1)
    try {
      const ranked = (await env.AI.run(env.RERANK_MODEL as never, {
        query: request.query,
        contexts: candidates.map(({ content }) => ({ text: content })),
      })) as { response?: Array<{ id: number; score: number }> };
      const scores = ranked.response ?? [];
      candidates = scores.flatMap((entry) =>
        candidates[entry.id] ? [{ ...candidates[entry.id]!, score: entry.score }] : [],
      );
    } catch {
      /* RRF is the degradation path. */
    }
  return boundedEvidence(candidates, 24_000).slice(0, request.limit);
}
export function toCitations(chunks: readonly RankedChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    id: crypto.randomUUID(),
    chunkId: chunk.chunkId,
    documentId: chunk.documentId,
    versionId: chunk.versionId,
    title: chunk.title,
    excerpt: chunk.excerpt,
    page: chunk.page,
    score: chunk.score,
  }));
}
