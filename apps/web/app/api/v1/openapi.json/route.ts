const specification = {
  openapi: "3.1.0",
  info: {
    title: "Kivo API",
    version: "1.0.0",
    description: "Tenant-scoped document, retrieval, and conversation API.",
  },
  servers: [{ url: "/api/v1" }],
  security: [{ bearerAuth: [] }, { session: [] }],
  paths: {
    "/documents": {
      get: {
        summary: "List documents",
        responses: { "200": { description: "Cursor-paginated documents" } },
      },
      post: {
        summary: "Reserve an upload",
        parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
        responses: {
          "201": { description: "Upload reservation" },
          "409": { $ref: "#/components/responses/Problem" },
        },
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
    "/health": {
      get: { security: [], summary: "Readiness", responses: { "200": { description: "Healthy" } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer" },
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
