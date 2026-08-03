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
import { handleAccountRoute } from "@/lib/account-api";
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
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#5b5bd6"),
});
const collectionUpdateSchema = collectionSchema
  .partial()
  .refine((value) => Object.keys(value).length, {
    message: "Provide at least one collection change.",
  });
const collectionMembersSchema = z.object({ memberIds: z.array(z.string()).max(250) });
const workspaceUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    retentionDays: z.number().int().min(1).max(3650).optional(),
  })
  .refine((value) => Object.keys(value).length, {
    message: "Provide at least one workspace change.",
  });
const invitationSchema = z.object({
  email: z.string().trim().email().max(255),
  role: z.enum(["admin", "editor", "viewer"]),
});
const memberRoleSchema = z.object({ role: z.enum(["owner", "admin", "editor", "viewer"]) });
const adminOrganizationSchema = z
  .object({
    suspended: z.boolean().optional(),
    maxDocuments: z.number().int().min(1).max(10_000).optional(),
    maxMembers: z.number().int().min(1).max(1_000).optional(),
    maxStorageBytes: z.number().int().min(1_048_576).max(109_951_162_777_600).optional(),
  })
  .refine((value) => Object.keys(value).length, { message: "Provide at least one change." });
const ocrSchema = z.object({ image: z.string().min(100).max(15_000_000) });

function requestId(request: Request) {
  return request.headers.get("cf-ray") ?? crypto.randomUUID();
}

function forbidden(permission: Permission) {
  return problem(403, "Permission denied", `Your workspace role does not grant ${permission}.`);
}

function demoSafeguard(actor: Actor) {
  return actor.isDemo
    ? problem(
        403,
        "Demo safeguard",
        "Shared demo visitors can explore documents, collections, search, and chat, but cannot change workspace access or platform settings.",
      )
    : null;
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

  const accountResponse = await handleAccountRoute(request, path, env);
  if (accountResponse) return accountResponse;

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
      `SELECT o.id,o.name,o.slug,u.name AS userName,u.email AS userEmail,
              s.retention_days AS retentionDays,s.max_documents AS maxDocuments,
              s.max_storage_bytes AS maxStorageBytes,s.max_members AS maxMembers
       FROM organization o JOIN user u ON u.id=?
       LEFT JOIN workspace_settings s ON s.organization_id=o.id
       WHERE o.id=? AND o.deleted_at IS NULL`,
    )
      .bind(actor.userId, actor.organizationId)
      .first();
    return Response.json({
      data: {
        ...row,
        role: actor.role,
        demo: actor.isDemo,
        platformAdmin: actor.isPlatformAdmin,
      },
    });
  }

  if (path[0] === "workspace" && request.method === "PATCH") {
    if (!can(actor.role, "workspace:update")) return forbidden("workspace:update");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const parsed = workspaceUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid workspace settings",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
      );
    if (parsed.data.slug) {
      const duplicate = await env.DB.prepare("SELECT id FROM organization WHERE slug=? AND id<>?")
        .bind(parsed.data.slug, actor.organizationId)
        .first();
      if (duplicate) return problem(409, "Slug unavailable", "Choose another workspace slug.");
    }
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE organization SET name=COALESCE(?,name),slug=COALESCE(?,slug),updated_at=? WHERE id=?",
      ).bind(parsed.data.name ?? null, parsed.data.slug ?? null, now, actor.organizationId),
      env.DB.prepare(
        "UPDATE workspace_settings SET retention_days=COALESCE(?,retention_days),updated_at=? WHERE organization_id=?",
      ).bind(parsed.data.retentionDays ?? null, now, actor.organizationId),
    ]);
    await writeAudit(
      env,
      actor,
      "workspace.updated",
      "workspace",
      actor.organizationId,
      parsed.data,
    );
    return Response.json({ data: { updated: true } });
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

    const [usage, configuredLimits] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS documents,COALESCE(SUM(bytes),0) AS storageBytes FROM document WHERE organization_id=? AND deleted_at IS NULL",
      )
        .bind(actor.organizationId)
        .first<{ documents: number; storageBytes: number }>(),
      env.DB.prepare(
        "SELECT max_documents AS documents,max_storage_bytes AS storageBytes FROM workspace_settings WHERE organization_id=?",
      )
        .bind(actor.organizationId)
        .first<{ documents: number; storageBytes: number }>(),
    ]);
    if ((usage?.documents ?? 0) >= (configuredLimits?.documents ?? workspaceLimits.documents))
      return problem(
        409,
        "Document quota reached",
        "Delete a document before uploading another one.",
      );
    if (
      (usage?.storageBytes ?? 0) + parsed.data.bytes >
      (configuredLimits?.storageBytes ?? workspaceLimits.storageBytes)
    )
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
    if (actor.isDemo && path[1] === "doc_handbook")
      return problem(
        403,
        "Demo fixture protected",
        "The sample handbook stays available for every demo visitor.",
      );
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
              ,COALESCE((SELECT json_group_array(cm.member_id) FROM collection_member cm
                         WHERE cm.organization_id=c.organization_id AND cm.collection_id=c.id),'[]') AS memberIds
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
      "INSERT INTO collection(id,organization_id,name,description,color,restricted,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        collectionId,
        actor.organizationId,
        parsed.data.name,
        parsed.data.description ?? null,
        parsed.data.color,
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

  if (path[0] === "collections" && path[1] && request.method === "PATCH") {
    if (!can(actor.role, "workspace:update")) return forbidden("workspace:update");
    if (actor.isDemo && path[1] === "col_product")
      return problem(
        403,
        "Demo fixture protected",
        "The sample collection stays available for every demo visitor.",
      );
    const parsed = collectionUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid collection",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
      );
    const existing = await env.DB.prepare(
      "SELECT id FROM collection WHERE id=? AND organization_id=? AND deleted_at IS NULL",
    )
      .bind(path[1], actor.organizationId)
      .first();
    if (!existing) return problem(404, "Collection not found", "The collection does not exist.");
    await env.DB.prepare(
      `UPDATE collection SET name=COALESCE(?,name),description=COALESCE(?,description),
       color=COALESCE(?,color),restricted=COALESCE(?,restricted),updated_at=?
       WHERE id=? AND organization_id=?`,
    )
      .bind(
        parsed.data.name ?? null,
        parsed.data.description ?? null,
        parsed.data.color ?? null,
        parsed.data.restricted === undefined ? null : parsed.data.restricted ? 1 : 0,
        Date.now(),
        path[1],
        actor.organizationId,
      )
      .run();
    await writeAudit(env, actor, "collection.updated", "collection", path[1], parsed.data);
    return Response.json({ data: { updated: true } });
  }

  if (path[0] === "collections" && path[1] && path[2] === "members" && request.method === "PUT") {
    if (!can(actor.role, "members:manage")) return forbidden("members:manage");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const parsed = collectionMembersSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid collection members",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
      );
    const collection = await env.DB.prepare(
      "SELECT id FROM collection WHERE id=? AND organization_id=? AND deleted_at IS NULL",
    )
      .bind(path[1], actor.organizationId)
      .first();
    if (!collection) return problem(404, "Collection not found", "The collection does not exist.");
    if (parsed.data.memberIds.length) {
      const placeholders = parsed.data.memberIds.map(() => "?").join(",");
      const owned = await env.DB.prepare(
        `SELECT id FROM member WHERE organization_id=? AND id IN (${placeholders})`,
      )
        .bind(actor.organizationId, ...parsed.data.memberIds)
        .all<{ id: string }>();
      if (owned.results.length !== new Set(parsed.data.memberIds).size)
        return problem(
          422,
          "Invalid member",
          "Every selected member must belong to this workspace.",
        );
    }
    const now = Date.now();
    await env.DB.prepare(
      "DELETE FROM collection_member WHERE organization_id=? AND collection_id=?",
    )
      .bind(actor.organizationId, path[1])
      .run();
    if (parsed.data.memberIds.length)
      await env.DB.batch(
        [...new Set(parsed.data.memberIds)].map((memberId) =>
          env.DB.prepare(
            "INSERT INTO collection_member(organization_id,collection_id,member_id,created_at,updated_at) VALUES(?,?,?,?,?)",
          ).bind(actor.organizationId, path[1], memberId, now, now),
        ),
      );
    await writeAudit(env, actor, "collection.members_updated", "collection", path[1], {
      memberCount: parsed.data.memberIds.length,
    });
    return Response.json({ data: { updated: true } });
  }

  if (path[0] === "collections" && path[1] && request.method === "DELETE") {
    if (!can(actor.role, "workspace:update")) return forbidden("workspace:update");
    if (actor.isDemo && path[1] === "col_product")
      return problem(
        403,
        "Demo fixture protected",
        "The sample collection stays available for every demo visitor.",
      );
    const existing = await env.DB.prepare(
      "SELECT id FROM collection WHERE id=? AND organization_id=? AND deleted_at IS NULL",
    )
      .bind(path[1], actor.organizationId)
      .first();
    if (!existing) return problem(404, "Collection not found", "The collection does not exist.");
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE collection SET deleted_at=?,updated_at=? WHERE id=? AND organization_id=?",
      ).bind(now, now, path[1], actor.organizationId),
      env.DB.prepare(
        "UPDATE document SET collection_id=NULL,updated_at=? WHERE collection_id=? AND organization_id=?",
      ).bind(now, path[1], actor.organizationId),
      env.DB.prepare(
        "UPDATE chunk SET collection_id=NULL,updated_at=? WHERE collection_id=? AND organization_id=?",
      ).bind(now, path[1], actor.organizationId),
      env.DB.prepare(
        "DELETE FROM collection_member WHERE collection_id=? AND organization_id=?",
      ).bind(path[1], actor.organizationId),
    ]);
    await writeAudit(env, actor, "collection.deleted", "collection", path[1]);
    return new Response(null, { status: 204 });
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
    const [documents, members, limits] = await Promise.all([
      env.DB.prepare(
        "SELECT COUNT(*) AS documents,COALESCE(SUM(bytes),0) AS storageBytes FROM document WHERE organization_id=? AND deleted_at IS NULL",
      )
        .bind(actor.organizationId)
        .first<{ documents: number; storageBytes: number }>(),
      env.DB.prepare("SELECT COUNT(*) AS members FROM member WHERE organization_id=?")
        .bind(actor.organizationId)
        .first<{ members: number }>(),
      env.DB.prepare(
        "SELECT max_documents AS documentLimit,max_storage_bytes AS storageLimit,max_members AS memberLimit FROM workspace_settings WHERE organization_id=?",
      )
        .bind(actor.organizationId)
        .first<{ documentLimit: number; storageLimit: number; memberLimit: number }>(),
    ]);
    return Response.json({
      data: {
        documents: documents?.documents ?? 0,
        documentLimit: limits?.documentLimit ?? workspaceLimits.documents,
        storageBytes: documents?.storageBytes ?? 0,
        storageLimit: limits?.storageLimit ?? workspaceLimits.storageBytes,
        members: members?.members ?? 0,
        memberLimit: limits?.memberLimit ?? workspaceLimits.members,
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
    const invitations = can(actor.role, "members:manage")
      ? await env.DB.prepare(
          `SELECT id,email,role,status,expires_at AS expiresAt,created_at AS createdAt
           FROM invitation WHERE organization_id=? AND status='pending' ORDER BY created_at DESC`,
        )
          .bind(actor.organizationId)
          .all()
      : { results: [] };
    return Response.json({ data: result.results, invitations: invitations.results });
  }

  if (path[0] === "members" && request.method === "POST" && !path[1]) {
    if (!can(actor.role, "members:manage")) return forbidden("members:manage");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid invitation",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
      );
    const limits = await env.DB.prepare(
      `SELECT s.max_members AS maxMembers,
              (SELECT COUNT(*) FROM member WHERE organization_id=?) AS memberCount
       FROM workspace_settings s WHERE s.organization_id=?`,
    )
      .bind(actor.organizationId, actor.organizationId)
      .first<{ maxMembers: number; memberCount: number }>();
    if ((limits?.memberCount ?? 0) >= (limits?.maxMembers ?? workspaceLimits.members))
      return problem(
        409,
        "Member limit reached",
        "Increase the member limit before inviting anyone else.",
      );
    const existingMember = await env.DB.prepare(
      `SELECT m.id FROM member m JOIN user u ON u.id=m.user_id
       WHERE m.organization_id=? AND lower(u.email)=lower(?)`,
    )
      .bind(actor.organizationId, parsed.data.email)
      .first();
    if (existingMember) return problem(409, "Already a member", "That email already has access.");
    const existingInvitation = await env.DB.prepare(
      "SELECT id FROM invitation WHERE organization_id=? AND lower(email)=lower(?) AND status='pending' AND expires_at>?",
    )
      .bind(actor.organizationId, parsed.data.email, Date.now())
      .first();
    if (existingInvitation)
      return problem(409, "Already invited", "A current invitation already exists for that email.");
    const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replaceAll("-", "");
    const tokenHash = await sha256(token);
    const invitationId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    await env.DB.prepare(
      "INSERT INTO invitation(id,organization_id,email,role,status,inviter_id,token_hash,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    )
      .bind(
        invitationId,
        actor.organizationId,
        parsed.data.email.toLowerCase(),
        parsed.data.role,
        "pending",
        actor.userId,
        tokenHash,
        expiresAt,
        now,
        now,
      )
      .run();
    await writeAudit(env, actor, "invitation.created", "invitation", invitationId, {
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
    });
    return Response.json(
      {
        data: {
          id: invitationId,
          email: parsed.data.email.toLowerCase(),
          role: parsed.data.role,
          expiresAt,
          inviteUrl: `${new URL(request.url).origin}/invite/${token}`,
        },
      },
      { status: 201 },
    );
  }

  if (path[0] === "members" && path[1] && request.method === "PATCH") {
    if (!can(actor.role, "members:manage")) return forbidden("members:manage");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const parsed = memberRoleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(422, "Invalid role", parsed.error.issues[0]?.message ?? "Invalid role.");
    const member = await env.DB.prepare(
      "SELECT id,user_id AS userId,role FROM member WHERE id=? AND organization_id=?",
    )
      .bind(path[1], actor.organizationId)
      .first<{ id: string; userId: string; role: Actor["role"] }>();
    if (!member) return problem(404, "Member not found", "That member does not exist.");
    if ((member.role === "owner" || parsed.data.role === "owner") && actor.role !== "owner")
      return problem(403, "Owner required", "Only an owner can change ownership.");
    if (member.role === "owner" && parsed.data.role !== "owner") {
      const owners = await env.DB.prepare(
        "SELECT COUNT(*) AS total FROM member WHERE organization_id=? AND role='owner'",
      )
        .bind(actor.organizationId)
        .first<{ total: number }>();
      if ((owners?.total ?? 0) <= 1)
        return problem(409, "Last owner", "Promote another owner before changing this role.");
    }
    await env.DB.prepare("UPDATE member SET role=?,updated_at=? WHERE id=? AND organization_id=?")
      .bind(parsed.data.role, Date.now(), member.id, actor.organizationId)
      .run();
    await writeAudit(env, actor, "member.role_updated", "member", member.id, {
      role: parsed.data.role,
    });
    return Response.json({ data: { updated: true } });
  }

  if (path[0] === "members" && path[1] && request.method === "DELETE") {
    if (!can(actor.role, "members:manage")) return forbidden("members:manage");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const member = await env.DB.prepare(
      "SELECT id,user_id AS userId,role FROM member WHERE id=? AND organization_id=?",
    )
      .bind(path[1], actor.organizationId)
      .first<{ id: string; userId: string; role: Actor["role"] }>();
    if (!member) return problem(404, "Member not found", "That member does not exist.");
    if (member.userId === actor.userId)
      return problem(
        409,
        "Cannot remove yourself",
        "Use workspace settings to leave this workspace.",
      );
    if (member.role === "owner" && actor.role !== "owner")
      return problem(403, "Owner required", "Only an owner can remove another owner.");
    await env.DB.prepare("DELETE FROM member WHERE id=? AND organization_id=?")
      .bind(member.id, actor.organizationId)
      .run();
    await writeAudit(env, actor, "member.removed", "member", member.id);
    return new Response(null, { status: 204 });
  }

  if (path[0] === "invitations" && path[1] && request.method === "DELETE") {
    if (!can(actor.role, "members:manage")) return forbidden("members:manage");
    const safeguarded = demoSafeguard(actor);
    if (safeguarded) return safeguarded;
    const invitation = await env.DB.prepare(
      "SELECT id FROM invitation WHERE id=? AND organization_id=? AND status='pending'",
    )
      .bind(path[1], actor.organizationId)
      .first();
    if (!invitation) return problem(404, "Invitation not found", "That invitation is not pending.");
    await env.DB.prepare("UPDATE invitation SET status='cancelled',updated_at=? WHERE id=?")
      .bind(Date.now(), path[1])
      .run();
    await writeAudit(env, actor, "invitation.cancelled", "invitation", path[1]);
    return new Response(null, { status: 204 });
  }

  if (path[0] === "audit" && request.method === "GET") {
    if (!can(actor.role, "workspace:read")) return forbidden("workspace:read");
    const result = await env.DB.prepare(
      `SELECT a.id,a.action,a.target_type AS targetType,a.target_id AS targetId,
              a.metadata_json AS metadata,a.created_at AS createdAt,
              COALESCE(u.name,'System') AS actorName
       FROM audit_log a LEFT JOIN user u ON u.id=a.actor_id
       WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT 100`,
    )
      .bind(actor.organizationId)
      .all();
    return Response.json({ data: result.results });
  }

  if (path[0] === "admin" && request.method === "GET" && !path[1]) {
    if (!actor.isPlatformAdmin)
      return problem(
        403,
        "Platform administrator required",
        "This page is limited to platform administrators.",
      );
    const result = await env.DB.prepare(
      `SELECT o.id,o.name,o.slug,o.suspended_at AS suspendedAt,o.created_at AS createdAt,
              s.max_documents AS maxDocuments,s.max_storage_bytes AS maxStorageBytes,
              s.max_members AS maxMembers,
              (SELECT COUNT(*) FROM member m WHERE m.organization_id=o.id) AS members,
              (SELECT COUNT(*) FROM document d WHERE d.organization_id=o.id AND d.deleted_at IS NULL) AS documents
       FROM organization o LEFT JOIN workspace_settings s ON s.organization_id=o.id
       WHERE o.deleted_at IS NULL ORDER BY o.created_at DESC LIMIT 250`,
    ).all();
    return Response.json({
      data: {
        health: {
          status: env.DB && env.AI_SERVICE ? "ok" : "degraded",
          database: Boolean(env.DB),
          ai: Boolean(env.AI_SERVICE),
          storage: Boolean(env.DOCUMENTS),
        },
        organizations: result.results,
      },
    });
  }

  if (path[0] === "admin" && path[1] === "organizations" && path[2] && request.method === "PATCH") {
    if (!actor.isPlatformAdmin)
      return problem(
        403,
        "Platform administrator required",
        "This action is limited to platform administrators.",
      );
    const parsed = adminOrganizationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return problem(
        422,
        "Invalid organization settings",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
      );
    const organization = await env.DB.prepare(
      "SELECT id FROM organization WHERE id=? AND deleted_at IS NULL",
    )
      .bind(path[2])
      .first();
    if (!organization) return problem(404, "Workspace not found", "That workspace does not exist.");
    const now = Date.now();
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE organization SET suspended_at=CASE WHEN ? IS NULL THEN suspended_at WHEN ?=1 THEN ? ELSE NULL END,updated_at=? WHERE id=?",
      ).bind(
        parsed.data.suspended === undefined ? null : parsed.data.suspended ? 1 : 0,
        parsed.data.suspended ? 1 : 0,
        now,
        now,
        path[2],
      ),
      env.DB.prepare(
        `UPDATE workspace_settings SET max_documents=COALESCE(?,max_documents),
         max_members=COALESCE(?,max_members),max_storage_bytes=COALESCE(?,max_storage_bytes),updated_at=?
         WHERE organization_id=?`,
      ).bind(
        parsed.data.maxDocuments ?? null,
        parsed.data.maxMembers ?? null,
        parsed.data.maxStorageBytes ?? null,
        now,
        path[2],
      ),
    ]);
    await env.DB.prepare(
      "INSERT INTO audit_log(id,organization_id,actor_id,action,target_type,target_id,metadata_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
    )
      .bind(
        crypto.randomUUID(),
        path[2],
        actor.userId,
        "platform.workspace_updated",
        "workspace",
        path[2],
        JSON.stringify(parsed.data),
        now,
      )
      .run();
    return Response.json({ data: { updated: true } });
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
export async function PATCH(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
export async function DELETE(request: Request, context: Context) {
  return route(request, (await context.params).path);
}
