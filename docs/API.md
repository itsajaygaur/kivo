# API

The live OpenAPI 3.1 document is served at `/api/v1/openapi.json`. Errors use `application/problem+json`. Authentication uses session cookies (email/password, optional OAuth and passkeys); bearer API keys are on the roadmap but not yet implemented — the `api_key` table and `apiKeys:manage` permission are reserved for that work. Tenant identity always comes from the verified session — not request JSON.

`POST /documents` requires an `Idempotency-Key` header and replays the original reservation on retry. `POST /chunks` is idempotent by construction: re-posting a version's chunks replaces them atomically. The documents list is cursor-paginated (`?cursor=` echoes `nextCursor`). Search and chat draw from a per-workspace daily request budget, and OCR from a monthly page budget; exceeding either returns 429. Chat streams the AI SDK UI message SSE protocol.
