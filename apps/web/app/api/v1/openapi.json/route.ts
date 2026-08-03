const specification = {
  openapi: "3.1.0",
  info: {
    title: "Kivo API",
    version: "1.0.0",
    description: "Tenant-scoped document, retrieval, and conversation API.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ session: [] }],
  paths: {
    "/documents": {
      get: {
        summary: "List documents",
        responses: { "200": { description: "Cursor-paginated documents" } },
      },
      post: {
        summary: "Reserve a browser-extracted document upload",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        responses: {
          "201": { description: "Upload reservation" },
          "409": { $ref: "#/components/responses/Problem" },
        },
      },
    },
    "/documents/{documentId}": {
      delete: {
        summary: "Soft-delete a document and purge its vectors",
        responses: { "204": { description: "Deleted" } },
      },
    },
    "/chunks": {
      post: {
        summary: "Persist extracted chunks and queue indexing",
        responses: { "202": { description: "Queued for indexing" } },
      },
    },
    "/ocr": {
      post: {
        summary: "Transcribe a scanned PDF page for document ingestion",
        responses: { "200": { description: "Transcribed page" } },
      },
    },
    "/collections": {
      get: {
        summary: "List accessible collections",
        responses: { "200": { description: "Collections" } },
      },
      post: {
        summary: "Create a collection",
        responses: { "201": { description: "Collection created" } },
      },
    },
    "/collections/{collectionId}": {
      patch: {
        summary: "Update collection metadata",
        responses: { "200": { description: "Collection updated" } },
      },
      delete: {
        summary: "Delete a collection and unfile its documents",
        responses: { "204": { description: "Collection deleted" } },
      },
    },
    "/collections/{collectionId}/members": {
      put: {
        summary: "Replace the access list for a restricted collection",
        responses: { "200": { description: "Access list updated" } },
      },
    },
    "/search": {
      post: {
        summary: "Hybrid knowledge search",
        responses: { "200": { description: "Ranked passages with citations" } },
      },
    },
    "/chat": {
      post: {
        summary: "Stream a grounded answer",
        responses: {
          "200": { description: "AI SDK SSE stream", content: { "text/event-stream": {} } },
        },
      },
    },
    "/usage": {
      get: {
        summary: "Get quota and usage",
        responses: { "200": { description: "Current workspace usage" } },
      },
    },
    "/workspace": {
      get: {
        summary: "Get the active workspace and actor",
        responses: { "200": { description: "Workspace" } },
      },
      patch: {
        summary: "Update the active workspace profile and retention",
        responses: { "200": { description: "Workspace updated" } },
      },
    },
    "/workspaces": {
      get: {
        summary: "List the signed-in account's workspaces",
        responses: { "200": { description: "Workspaces" } },
      },
      post: {
        summary: "Create and activate a workspace",
        responses: { "201": { description: "Workspace created" } },
      },
    },
    "/workspaces/{workspaceId}/activate": {
      post: {
        summary: "Switch the active workspace",
        responses: { "204": { description: "Workspace activated" } },
      },
    },
    "/members": {
      get: { summary: "List workspace members", responses: { "200": { description: "Members" } } },
      post: {
        summary: "Create a seven-day member invitation",
        responses: { "201": { description: "Invitation link created" } },
      },
    },
    "/members/{memberId}": {
      patch: {
        summary: "Change a member role",
        responses: { "200": { description: "Role updated" } },
      },
      delete: {
        summary: "Remove a workspace member",
        responses: { "204": { description: "Member removed" } },
      },
    },
    "/invitations/{token}": {
      get: {
        security: [],
        summary: "Inspect an invitation",
        responses: { "200": { description: "Invitation" } },
      },
      post: {
        summary: "Accept an invitation as its intended email",
        responses: { "200": { description: "Invitation accepted" } },
      },
    },
    "/demo-session": {
      post: {
        security: [],
        summary: "Enter the optional public demo",
        responses: { "204": { description: "Demo cookie created" } },
      },
      delete: {
        security: [],
        summary: "Leave the public demo",
        responses: { "204": { description: "Demo cookie cleared" } },
      },
    },
    "/auth-capabilities": {
      get: {
        security: [],
        summary: "List enabled sign-in methods",
        responses: { "200": { description: "Authentication capabilities" } },
      },
    },
    "/admin": {
      get: {
        summary: "List platform health and organizations",
        responses: { "200": { description: "Platform administration data" } },
      },
    },
    "/admin/organizations/{workspaceId}": {
      patch: {
        summary: "Update platform quotas or suspension",
        responses: { "200": { description: "Organization updated" } },
      },
    },
    "/audit": {
      get: {
        summary: "List recent audit events",
        responses: { "200": { description: "Audit events" } },
      },
    },
    "/health": {
      get: { security: [], summary: "Readiness", responses: { "200": { description: "Healthy" } } },
    },
  },
  components: {
    securitySchemes: {
      session: { type: "apiKey", in: "cookie", name: "kivo.session_token" },
    },
    parameters: {
      IdempotencyKey: {
        name: "Idempotency-Key",
        in: "header",
        required: true,
        schema: { type: "string", maxLength: 128 },
      },
    },
    responses: {
      Problem: {
        description: "RFC 9457 problem",
        content: {
          "application/problem+json": {
            schema: { type: "object", required: ["title", "status", "detail"] },
          },
        },
      },
    },
  },
} as const;
export function GET() {
  return Response.json(specification, { headers: { "cache-control": "public, max-age=3600" } });
}
