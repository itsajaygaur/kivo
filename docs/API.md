# API

The live OpenAPI 3.1 document is served at `/api/v1/openapi.json`. All application responses include a request ID; errors use `application/problem+json`. List endpoints use opaque cursors. Mutations accept `Idempotency-Key`. Session cookies and scoped bearer keys are supported. Chat streams the AI SDK UI message SSE protocol.

API keys are shown once, stored as SHA-256 hashes, scoped, revocable, and optionally expiring. Tenant identity always comes from the verified session/key—not request JSON.
