import {
  can,
  chatRequestSchema,
  problem,
  searchRequestSchema,
  sha256,
  sha256Bytes,
  workspaceLimits,
  type IngestionMessage,
  type Permission,
} from "@kivo/shared";
import { bindings, requireActor, type Actor } from "@/lib/cloudflare";
import { z } from "zod";

export const runtime = "nodejs";

const acceptedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",
  "application/json",
] as const;

const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  mimeType: z.enum(acceptedMimeTypes),
  bytes: z.number().int().positive().max(workspaceLimits.fileBytes),
  checksum: z.string().length(64),
  collectionId: z.string().nullable().optional(),
});

const chunksSchema = z.object({
  documentId: z.string().min(1),
  versionId: z.string().min(1),
  pages: z.number().int().positive().max(workspaceLimits.pagesPerFile).nullable().optional(),
  extractedCharacters: z.number().int().nonnegative().optional(),
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
    .min(1)
    .max(workspaceLimits.chunksPerDocument),
  checksum: z.string().length(64),
});

const collectionSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(500).optional(),
  restricted: z.boolean().default(false),
});
const ocrSchema = z.object({ image: z.string().min(100).max(15_000_000) });

function requestId(request: Request) {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

function forbidden(permission: Permission) {
  return problem(403, "Permission denied", `Your workspace role does not grant ${permission}.`);
}

async function accessibleCollectionIds(env: Env, actor: Actor): Promise<string[]> {
  const result = await env.DB.prepare(
    `SELECT c.id FROM collection c
     WHERE c.organization_id=? AND c.deleted_at IS NULL AND (
       c.restricted=0 OR ? IN ('owner','admin') OR EXISTS (
         SELECT 1 FROM collection_member cm
         JOIN member m ON m.id=cm.member_id AND m.organization_id=cm.organization_id
         WHERE cm.organization_id=c.organization_id AND cm.collection_id=c.id AND m.user_id=?
       )
     ) ORDER BY c.name`,
  )
    .bind(actor.organizationId, actor.role, actor.userId)
    .all<{ id: string }>();
  return result.results.map(({ id }) => id);
}

async function writeAudit(
  env: Env,
  actor: Actor,
  action: string,
  targetType: string,
  targetId: string,
  metadata: Record<string, unknown> = {},
) {
  await env.DB.prepare(
    "INSERT INTO audit_log(id,organization_id,actor_id,action,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
  )
    .bind(
      crypto.randomUUID(),
      actor.organizationId,
      actor.userId,
      action,
      targetType,
      targetId,
      JSON.stringify(metadata),
      Date.now(),
    )
    .run();
}

async function route(request: Request, path: string[]): Promise<Response> {
  const id = requestId(request);
  const env = await bindings();
  if (path[0] === "health")
    return Response.json(
      {
        status: env?.DB && env?.AI_SERVICE ? "ok" : "degraded",
        database: Boolean(env?.DB),
        ai: Boolean(env?.AI_SERVICE),
        storage: Boolean(env?.DOCUMENTS),
        requestId: id,
      },
      { status: env?.DB ? 200 : 503, headers: { "x-request-id": id } },
    );
  if (!env)
    return problem(
      503,
      "Runtime unavailable",
      "Run pnpm --filter @kivo/web preview to use the Cloudflare-backed application.",
    );

  let actor: Actor;
  try {
    actor = await requireActor(request, env);
  } catch {
    return problem(
      401,
      "Authentication required",
      "Sign in to access this workspace.",
      request.url,
    );
  }

  if (path[0] === "workspace" && request.method === "GET") {
    const row = await env.DB.prepare(
      `SELECT o.id,o.name,o.slug,u.name AS userName,u.email AS userEmail
       FROM organization o JOIN user u ON u.id=?
       WHERE o.id=? AND o.deleted_at IS NULL`,
    )
      .bind(actor.userId, actor.organizationId)
      .first();
    return Response.json({ data: { ...row, role: actor.role } });
  }

  if (path[0] === "documents" && request.method === "GET" && !path[1]) {
    if (!can(actor.role, "documents:read")) return forbidden("documents:read");
    const cursor = new URL(request.url).searchParams.get("cursor") ?? "";
    const result = await env.DB.prepare(
      `SELECT d.id,d.title,d.filename,d.mime_type AS mimeType,d.bytes,d.status,
              d.collection_id AS collectionId,c.name AS collectionName,d.updated_at AS updatedAt,
              COALESCE(j.progress,CASE WHEN d.status='ready' THEN 100 ELSE 0 END) AS progress
       FROM document d
       LEFT JOIN collection c ON c.id=d.collection_id AND c.organization_id=d.organization_id
       LEFT JOIN ingestion_job j ON j.version_id=d.current_version_id AND j.organization_id=d.organization_id
       WHERE d.organization_id=? AND d.deleted_at IS NULL AND d.id>? AND (
         d.collection_id IS NULL OR c.restricted=0 OR ? IN ('owner','admin') OR EXISTS (
           SELECT 1 FROM collection_member cm JOIN member m ON m.id=cm.member_id
           WHERE cm.organization_id=d.organization_id AND cm.collection_id=d.collection_id AND m.user_id=?
         )
       ) ORDER BY d.id LIMIT 51`,
    )
      .bind(actor.organizationId, cursor, actor.role, actor.userId)
      .all();
    const rows = result.results.slice(0, 50);
    return Response.json(
      {
        data: rows,
        nextCursor: result.results.length > 50 ? (rows.at(-1) as { id: string }).id : null,
      },
      { headers: { "x-request-id": id, "cache-control": "no-store" } },
    );
  }

  if (path[0] === "documents" && request.method === "POST" && !path[1]) {
    if (!can(actor.role, "documents:write")) return forbidden("documents:write");
    const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid upload", parsed.error.issues[0]?.message ?? "Invalid payload");
    const idem = request.headers.get("idempotency-key")?.slice(0, 128);
    if (!idem) return problem(400, "Idempotency key required", "Set the Idempotency-Key header.");

    const allowed = await accessibleCollectionIds(env, actor);
    if (parsed.data.collectionId && !allowed.includes(parsed.data.collectionId))
      return problem(403, "Collection unavailable", "You cannot add documents to that collection.");

    const replay = await env.DB.prepare(
      `SELECT j.document_id AS documentId,j.version_id AS versionId,j.id AS jobId,v.r2_key AS r2Key
       FROM ingestion_job j JOIN document_version v ON v.id=j.version_id
       WHERE j.organization_id=? AND j.idempotency_key=?`,
    )
      .bind(actor.organizationId, idem)
      .first<{ documentId: string; versionId: string; jobId: string; r2Key: string }>();
    if (replay)
      return Response.json({
        ...replay,
        replayed: true,
        upload: env.DOCUMENTS
          ? { method: "PUT", url: `/api/v1/uploads/${replay.documentId}/${replay.versionId}` }
          : null,
      });

    const duplicate = await env.DB.prepare(
      "SELECT id FROM document WHERE organization_id=? AND checksum=? AND deleted_at IS NULL",
    )
      .bind(actor.organizationId, parsed.data.checksum)
      .first<{ id: string }>();
    if (duplicate)
      return problem(
        409,
        "Document already exists",
        "A document with the same contents is already indexed.",
      );

    const usage = await env.DB.prepare(
      "SELECT COUNT(*) AS documents,COALESCE(SUM(bytes),0) AS storageBytes FROM document WHERE organization_id=? AND deleted_at IS NULL",
    )
      .bind(actor.organizationId)
      .first<{ documents: number; storageBytes: number }>();
    if ((usage?.documents ?? 0) >= workspaceLimits.documents)
      return problem(
        409,
        "Document quota reached",
        "Delete a document before uploading another one.",
      );
    if ((usage?.storageBytes ?? 0) + parsed.data.bytes > workspaceLimits.storageBytes)
      return problem(
        409,
        "Storage quota reached",
        "This file would exceed the workspace storage limit.",
      );

    const docId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    const now = Date.now();
    const r2Key = `${actor.organizationId}/${docId}/${versionId}/${parsed.data.filename}`;
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO document(id,organization_id,collection_id,title,filename,mime_type,bytes,checksum,status,current_version_id,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      ).bind(
        docId,
        actor.organizationId,
        parsed.data.collectionId ?? null,
        parsed.data.title,
        parsed.data.filename,
        parsed.data.mimeType,
        parsed.data.bytes,
        parsed.data.checksum,
        "extracting",
        versionId,
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
    await writeAudit(env, actor, "document.created", "document", docId, {
      filename: parsed.data.filename,
      originalStored: Boolean(env.DOCUMENTS),
    });
    return Response.json(
      {
        documentId: docId,
        versionId,
        jobId,
        upload: env.DOCUMENTS
          ? { method: "PUT", url: `/api/v1/uploads/${docId}/${versionId}`, expiresIn: 600 }
          : null,
        limits: workspaceLimits,
      },
      { status: 201, headers: { "x-request-id": id } },
    );
  }

  if (path[0] === "documents" && request.method === "DELETE" && path[1]) {
    if (!can(actor.role, "documents:delete")) return forbidden("documents:delete");
    const document = await env.DB.prepare(
      `SELECT d.id,d.current_version_id AS versionId,v.r2_key AS r2Key
       FROM document d LEFT JOIN document_version v ON v.id=d.current_version_id
       WHERE d.id=? AND d.organization_id=? AND d.deleted_at IS NULL`,
    )
      .bind(path[1], actor.organizationId)
      .first<{ id: string; versionId: string; r2Key: string | null }>();
    if (!document) return problem(404, "Document not found", "The document does not exist.");
    await env.DB.prepare(
      "UPDATE document SET status='trashed',deleted_at=?,updated_at=? WHERE id=? AND organization_id=?",
    )
      .bind(Date.now(), Date.now(), path[1], actor.organizationId)
      .run();
    if (env.DOCUMENTS && document.r2Key) await env.DOCUMENTS.delete(document.r2Key);
    await env.INGESTION_QUEUE.send({
      kind: "purge-document",
      organizationId: actor.organizationId,
      documentId: document.id,
      versionId: document.versionId,
      jobId: crypto.randomUUID(),
      attempt: 0,
    } satisfies IngestionMessage);
    await writeAudit(env, actor, "document.deleted", "document", document.id);
    return new Response(null, { status: 204 });
  }

  if (path[0] === "uploads" && request.method === "PUT" && path[1] && path[2]) {
    if (!can(actor.role, "documents:write")) return forbidden("documents:write");
    if (!env.DOCUMENTS)
      return problem(
        503,
        "Original storage unavailable",
        "The extracted text can still be indexed without R2.",
      );
    const version = await env.DB.prepare(
      `SELECT v.r2_key AS r2Key,v.checksum,d.bytes FROM document_version v
       JOIN document d ON d.id=v.document_id AND d.organization_id=v.organization_id
       WHERE v.organization_id=? AND v.document_id=? AND v.id=? AND d.deleted_at IS NULL`,
    )
      .bind(actor.organizationId, path[1], path[2])
      .first<{ r2Key: string; checksum: string; bytes: number }>();
    if (!version) return problem(404, "Upload expired", "This upload grant is invalid or expired.");
    const bytes = await request.arrayBuffer();
    if (bytes.byteLength !== version.bytes)
      return problem(422, "Size mismatch", "The uploaded bytes did not match the reservation.");
    const actualChecksum = await sha256Bytes(bytes);
    if (
      actualChecksum !== version.checksum ||
      request.headers.get("x-content-sha256") !== version.checksum
    )
      return problem(422, "Checksum mismatch", "The uploaded bytes did not match the reservation.");
    await env.DOCUMENTS.put(version.r2Key, bytes, {
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
    if (!can(actor.role, "documents:write")) return forbidden("documents:write");
    const parsed = chunksSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid chunks", parsed.error.issues[0]?.message ?? "Invalid payload");
    const owned = await env.DB.prepare(
      "SELECT id,checksum FROM document_version WHERE id=? AND document_id=? AND organization_id=?",
    )
      .bind(parsed.data.versionId, parsed.data.documentId, actor.organizationId)
      .first<{ id: string; checksum: string }>();
    if (!owned)
      return problem(404, "Document not found", "The version does not exist in this workspace.");
    if (owned.checksum !== parsed.data.checksum)
      return problem(
        422,
        "Checksum mismatch",
        "The extracted text does not belong to this upload.",
      );

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
    if (!job)
      return problem(409, "Ingestion job missing", "Create a new upload reservation and retry.");
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE document_version SET pages=?,extracted_characters=?,chunk_count=?,status='queued',updated_at=? WHERE id=? AND organization_id=?",
      ).bind(
        parsed.data.pages ?? null,
        parsed.data.extractedCharacters ??
          parsed.data.chunks.reduce((sum, chunk) => sum + chunk.content.length, 0),
        parsed.data.chunks.length,
        now,
        parsed.data.versionId,
        actor.organizationId,
      ),
      env.DB.prepare(
        "UPDATE document SET status='queued',updated_at=? WHERE id=? AND organization_id=?",
      ).bind(now, parsed.data.documentId, actor.organizationId),
      env.DB.prepare(
        "UPDATE ingestion_job SET state='queued',progress=0,updated_at=? WHERE id=? AND organization_id=?",
      ).bind(now, job.id, actor.organizationId),
    ]);
    await env.INGESTION_QUEUE.send({
      kind: "embed-version",
      organizationId: actor.organizationId,
      documentId: parsed.data.documentId,
      versionId: parsed.data.versionId,
      jobId: job.id,
      attempt: 0,
    } satisfies IngestionMessage);
    await writeAudit(env, actor, "document.queued", "document", parsed.data.documentId, {
      chunks: parsed.data.chunks.length,
    });
    return Response.json({ accepted: parsed.data.chunks.length }, { status: 202 });
  }

  if (path[0] === "collections" && request.method === "GET") {
    if (!can(actor.role, "documents:read")) return forbidden("documents:read");
    const allowed = await accessibleCollectionIds(env, actor);
    if (!allowed.length) return Response.json({ data: [] });
    const result = await env.DB.prepare(
      `SELECT c.id,c.name,c.description,c.color,c.restricted,COUNT(d.id) AS documentCount
       FROM collection c LEFT JOIN document d ON d.collection_id=c.id AND d.deleted_at IS NULL
       WHERE c.organization_id=? AND c.deleted_at IS NULL AND c.id IN (${allowed.map(() => "?").join(",")})
       GROUP BY c.id ORDER BY c.name`,
    )
      .bind(actor.organizationId, ...allowed)
      .all();
    return Response.json({ data: result.results });
  }

  if (path[0] === "collections" && request.method === "POST") {
    if (!can(actor.role, "workspace:update")) return forbidden("workspace:update");
    const parsed = collectionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid collection",
        parsed.error.issues[0]?.message ?? "Invalid payload",
      );
    const collectionId = crypto.randomUUID();
    const now = Date.now();
    await env.DB.prepare(
      "INSERT INTO collection(id,organization_id,name,description,restricted,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)",
    )
      .bind(
        collectionId,
        actor.organizationId,
        parsed.data.name,
        parsed.data.description ?? null,
        parsed.data.restricted ? 1 : 0,
        actor.userId,
        now,
        now,
      )
      .run();
    await writeAudit(env, actor, "collection.created", "collection", collectionId, {
      name: parsed.data.name,
    });
    return Response.json({ id: collectionId }, { status: 201 });
  }

  if (path[0] === "ocr" && request.method === "POST") {
    if (!can(actor.role, "documents:write")) return forbidden("documents:write");
    const parsed = ocrSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid OCR page", parsed.error.issues[0]?.message ?? "Invalid image");
    return env.AI_SERVICE.fetch("https://ai.internal/internal/ocr", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-kivo-service-token": env.INTERNAL_SERVICE_TOKEN ?? "",
      },
      body: JSON.stringify(parsed.data),
    });
  }

  if (path[0] === "search" && request.method === "POST") {
    if (!can(actor.role, "chat:use")) return forbidden("chat:use");
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const authorizedCollectionIds = await accessibleCollectionIds(env, actor);
    const suppliedCollectionIds = Array.isArray(payload?.collectionIds)
      ? payload.collectionIds.filter((value): value is string => typeof value === "string")
      : [];
    if (suppliedCollectionIds.some((value) => !authorizedCollectionIds.includes(value)))
      return problem(
        403,
        "Collection unavailable",
        "The requested search scope is not available to you.",
      );
    const requested = Array.isArray(payload?.collectionIds)
      ? payload.collectionIds.filter(
          (value): value is string =>
            typeof value === "string" && authorizedCollectionIds.includes(value),
        )
      : undefined;
    const parsed = searchRequestSchema.safeParse({
      ...payload,
      collectionIds: requested,
      authorizedCollectionIds,
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
    if (!can(actor.role, "chat:use")) return forbidden("chat:use");
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
    const authorizedCollectionIds = await accessibleCollectionIds(env, actor);
    const suppliedCollectionIds = Array.isArray(payload?.collectionIds)
      ? payload.collectionIds.filter((value): value is string => typeof value === "string")
      : [];
    if (suppliedCollectionIds.some((value) => !authorizedCollectionIds.includes(value)))
      return problem(
        403,
        "Collection unavailable",
        "The requested chat scope is not available to you.",
      );
    const requested = Array.isArray(payload?.collectionIds)
      ? payload.collectionIds.filter(
          (value): value is string =>
            typeof value === "string" && authorizedCollectionIds.includes(value),
        )
      : undefined;
    const parsed = chatRequestSchema.safeParse({
      ...payload,
      query: messages.at(-1)?.content ?? "",
      messages,
      collectionIds: requested,
      authorizedCollectionIds,
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

  if (path[0] === "usage" && request.method === "GET") {
    const [documents, members] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS documents,COALESCE(SUM(bytes),0) AS storageBytes FROM document WHERE organization_id=? AND deleted_at IS NULL",
      )
        .bind(actor.organizationId)
        .first<{ documents: number; storageBytes: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS members FROM member WHERE organization_id=?")
        .bind(actor.organizationId)
        .first<{ members: number }>(),
    ]);
    return Response.json({
      data: {
        documents: documents?.documents ?? 0,
        documentLimit: workspaceLimits.documents,
        storageBytes: documents?.storageBytes ?? 0,
        storageLimit: workspaceLimits.storageBytes,
        members: members?.members ?? 0,
        memberLimit: workspaceLimits.members,
      },
    });
  }

  if (path[0] === "members" && request.method === "GET") {
    if (!can(actor.role, "workspace:read")) return forbidden("workspace:read");
    const result = await env.DB.prepare(
      `SELECT m.id,u.name,u.email,m.role,m.created_at AS joinedAt
       FROM member m JOIN user u ON u.id=m.user_id
       WHERE m.organization_id=? ORDER BY m.created_at`,
    )
      .bind(actor.organizationId)
      .all();
    return Response.json({ data: result.results });
  }

  if (path[0] === "audit" && request.method === "GET") {
    if (!can(actor.role, "workspace:read")) return forbidden("workspace:read");
    const result = await env.DB.prepare(
      `SELECT id,action,target_type AS targetType,target_id AS targetId,metadata_json AS metadata,created_at AS createdAt
       FROM audit_log WHERE organization_id=? ORDER BY created_at DESC LIMIT 100`,
    )
      .bind(actor.organizationId)
      .all();
    return Response.json({ data: result.results });
  }

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
