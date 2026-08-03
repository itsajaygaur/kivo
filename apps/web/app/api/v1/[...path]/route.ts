import {
  chunkText,
  chatRequestSchema,
  problem,
  searchRequestSchema,
  sha256,
  sha256Bytes,
  workspaceLimits,
  type IngestionMessage,
} from "@kivo/shared";
import { bindings, requireActor } from "@/lib/cloudflare";
import { z } from "zod";
export const runtime = "nodejs";
const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  title: z.string().min(1).max(255),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/html",
    "text/csv",
    "application/json",
  ]),
  bytes: z.number().int().positive().max(workspaceLimits.fileBytes),
  checksum: z.string().min(32).max(128),
  collectionId: z.string().nullable().optional(),
});
const chunksSchema = z.object({
  documentId: z.string(),
  versionId: z.string(),
  chunks: z
    .array(
      z.object({
        content: z.string().min(1).max(4_000),
        heading: z.string().nullable().optional(),
        page: z.number().int().positive().nullable().optional(),
        startOffset: z.number().int().nonnegative(),
        endOffset: z.number().int().positive(),
      }),
    )
    .max(workspaceLimits.chunksPerDocument),
  checksum: z.string(),
});
function requestId(request: Request) {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}
async function route(request: Request, path: string[]): Promise<Response> {
  const id = requestId(request);
  const env = await bindings();
  if (path[0] === "health")
    return Response.json(
      { status: "ok", database: Boolean(env?.DB), ai: Boolean(env?.AI_SERVICE), requestId: id },
      { headers: { "x-request-id": id } },
    );
  let actor;
  try {
    actor = await requireActor();
  } catch {
    return problem(
      401,
      "Authentication required",
      "Sign in or provide a scoped bearer key.",
      request.url,
    );
  }
  if (!env)
    return problem(
      503,
      "Runtime unavailable",
      "Run with OpenNext Cloudflare preview to use data APIs.",
    );
  if (path[0] === "documents" && request.method === "GET") {
    const cursor = new URL(request.url).searchParams.get("cursor") ?? "";
    const result = await env.DB.prepare(
      "SELECT id,title,filename,mime_type AS mimeType,bytes,status,updated_at AS updatedAt FROM document WHERE organization_id=? AND deleted_at IS NULL AND id>? ORDER BY id LIMIT 51",
    )
      .bind(actor.organizationId, cursor)
      .all();
    const rows = result.results.slice(0, 50);
    return Response.json(
      {
        data: rows,
        nextCursor: result.results.length > 50 ? (rows.at(-1) as { id: string }).id : null,
      },
      { headers: { "x-request-id": id } },
    );
  }
  if (path[0] === "documents" && request.method === "POST") {
    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid upload", parsed.error.issues[0]?.message ?? "Invalid payload");
    const idem = request.headers.get("idempotency-key");
    if (!idem) return problem(400, "Idempotency key required", "Set the Idempotency-Key header.");
    const existing = await env.DB.prepare(
      "SELECT document_id FROM ingestion_job WHERE organization_id=? AND idempotency_key=?",
    )
      .bind(actor.organizationId, idem)
      .first<{ document_id: string }>();
    if (existing)
      return Response.json({ documentId: existing.document_id, replayed: true }, { status: 200 });
    const docId = crypto.randomUUID(),
      versionId = crypto.randomUUID(),
      jobId = crypto.randomUUID(),
      now = Date.now(),
      r2Key = `${actor.organizationId}/${docId}/${versionId}/${parsed.data.filename}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO document(id,organization_id,collection_id,title,filename,mime_type,bytes,checksum,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        docId,
        actor.organizationId,
        parsed.data.collectionId ?? null,
        parsed.data.title,
        parsed.data.filename,
        parsed.data.mimeType,
        parsed.data.bytes,
        parsed.data.checksum,
        "uploading",
        actor.userId,
        now,
        now,
      ),
      env.DB.prepare(
        "INSERT INTO document_version(id,organization_id,document_id,version,r2_key,checksum,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
      ).bind(
        versionId,
        actor.organizationId,
        docId,
        1,
        r2Key,
        parsed.data.checksum,
        "extracting",
        now,
        now,
      ),
      env.DB.prepare(
        "INSERT INTO ingestion_job(id,organization_id,document_id,version_id,idempotency_key,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
      ).bind(jobId, actor.organizationId, docId, versionId, idem, "extracting", now, now),
    ]);
    return Response.json(
      {
        documentId: docId,
        versionId,
        jobId,
        upload: { method: "PUT", url: `/api/v1/uploads/${docId}/${versionId}`, expiresIn: 600 },
        limits: workspaceLimits,
      },
      { status: 201, headers: { "x-request-id": id } },
    );
  }
  if (path[0] === "uploads" && request.method === "PUT" && path[1] && path[2]) {
    const version = await env.DB.prepare(
      "SELECT r2_key,checksum FROM document_version WHERE organization_id=? AND document_id=? AND id=?",
    )
      .bind(actor.organizationId, path[1], path[2])
      .first<{ r2_key: string; checksum: string }>();
    if (!version) return problem(404, "Upload expired", "This upload grant is invalid or expired.");
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength > workspaceLimits.fileBytes)
      return problem(413, "File too large", "The maximum file size is 25 MB.");
    if (
      (await sha256Bytes(bytes)) !== request.headers.get("x-content-sha256") &&
      request.headers.has("x-content-sha256")
    )
      return problem(
        422,
        "Checksum mismatch",
        "The uploaded bytes did not match the declared checksum.",
      );
    await env.DOCUMENTS.put(version.r2_key, bytes, {
      httpMetadata: {
        contentType: request.headers.get("content-type") ?? "application/octet-stream",
      },
      customMetadata: {
        organizationId: actor.organizationId,
        documentId: path[1],
        versionId: path[2],
      },
    });
    return new Response(null, { status: 204 });
  }
  if (path[0] === "chunks" && request.method === "POST") {
    const parsed = chunksSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid chunks", parsed.error.issues[0]?.message ?? "Invalid payload");
    const owned = await env.DB.prepare(
      "SELECT id FROM document_version WHERE id=? AND document_id=? AND organization_id=?",
    )
      .bind(parsed.data.versionId, parsed.data.documentId, actor.organizationId)
      .first();
    if (!owned)
      return problem(404, "Document not found", "The version does not exist in this workspace.");
    const now = Date.now();
    const statements = await Promise.all(
      parsed.data.chunks.map(async (chunk, index) =>
        env.DB.prepare(
          "INSERT OR REPLACE INTO chunk(id,organization_id,document_id,version_id,collection_id,ordinal,content,heading,page,start_offset,end_offset,content_hash,vector_id,created_at,updated_at) VALUES(?,?,?,?,(SELECT collection_id FROM document WHERE id=? AND organization_id=?),?,?,?,?,?,?,?,?,?,?)",
        ).bind(
          `${parsed.data.versionId}:${index}`,
          actor.organizationId,
          parsed.data.documentId,
          parsed.data.versionId,
          parsed.data.documentId,
          actor.organizationId,
          index,
          chunk.content,
          chunk.heading ?? null,
          chunk.page ?? null,
          chunk.startOffset,
          chunk.endOffset,
          await sha256(chunk.content),
          `${parsed.data.versionId}:${index}`,
          now,
          now,
        ),
      ),
    );
    for (let i = 0; i < statements.length; i += 50) await env.DB.batch(statements.slice(i, i + 50));
    const job = await env.DB.prepare(
      "SELECT id FROM ingestion_job WHERE organization_id=? AND version_id=?",
    )
      .bind(actor.organizationId, parsed.data.versionId)
      .first<{ id: string }>();
    if (job) {
      await env.DB.prepare(
        "UPDATE ingestion_job SET state='queued',updated_at=? WHERE id=? AND organization_id=?",
      )
        .bind(now, job.id, actor.organizationId)
        .run();
      await env.INGESTION_QUEUE.send({
        kind: "embed-version",
        organizationId: actor.organizationId,
        documentId: parsed.data.documentId,
        versionId: parsed.data.versionId,
        jobId: job.id,
        attempt: 0,
      } satisfies IngestionMessage);
    }
    return Response.json({ accepted: parsed.data.chunks.length }, { status: 202 });
  }
  if (path[0] === "search" && request.method === "POST") {
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const parsed = searchRequestSchema.safeParse({
      ...payload,
      organizationId: actor.organizationId,
    });
    if (!parsed.success)
      return problem(422, "Invalid search", parsed.error.issues[0]?.message ?? "Invalid search");
    return env.AI_SERVICE.fetch("https://ai.internal/internal/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kivo-service-token": env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify(parsed.data),
    });
  }
  if (path[0] === "chat" && request.method === "POST") {
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const rawMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    const messages = rawMessages.map((message: any) => ({
      role: message.role,
      content:
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.parts)
            ? message.parts
                .filter((part: any) => part.type === "text")
                .map((part: any) => part.text)
                .join("\n")
            : "",
    }));
    const query = messages.at(-1)?.content ?? "";
    const parsed = chatRequestSchema.safeParse({
      ...payload,
      query,
      messages,
      organizationId: actor.organizationId,
    });
    if (!parsed.success)
      return problem(422, "Invalid chat", parsed.error.issues[0]?.message ?? "Invalid chat");
    return env.AI_SERVICE.fetch("https://ai.internal/internal/chat", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kivo-service-token": env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify(parsed.data),
    });
  }
  if (path[0] === "usage")
    return Response.json({
      data: {
        documents: 184,
        documentLimit: workspaceLimits.documents,
        storageBytes: 342800000,
        storageLimit: workspaceLimits.storageBytes,
        members: 18,
        memberLimit: workspaceLimits.members,
      },
    });
  return problem(404, "Not found", "The requested API route does not exist.", request.url);
}
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
export async function POST(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
export async function PUT(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
export async function DELETE(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
