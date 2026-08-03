# Deployment

1. Create D1 `kivo-db`, private R2 `kivo-documents`, Vectorize `kivo-chunks` (1,024 dimensions, cosine), queues `kivo-ingestion` and `kivo-ingestion-dlq`, and an Analytics Engine dataset.
2. Replace placeholder D1 IDs in both `wrangler.jsonc` files. Keep the same resource names.
3. Store Better Auth, OAuth, encryption, and service secrets with `wrangler secret put`; do not place secrets in `vars`.
4. Apply migrations with `wrangler d1 migrations apply kivo-db --remote --config apps/web/wrangler.jsonc`.
5. Deploy the private worker first: `pnpm --filter @kivo/ai-worker build` then `wrangler deploy -c apps/ai-worker/wrangler.jsonc`.
6. Build and deploy web: `pnpm --filter @kivo/web build:worker && pnpm --filter @kivo/web deploy`.
7. Add an optional `DOCUMENTS` R2 binding to the web Worker if original-file retention is required. Without it, browser-extracted text is still indexed and searchable.
8. Verify `/api/v1/health`, authentication, a small upload, queue completion, hybrid search, citations, and purge.

Set `KIVO_DEMO_MODE=false` before public deployment. OAuth callback URLs use `/api/auth/callback/{provider}`. The default `workers.dev` host avoids domain cost.

For a complete local run, use `pnpm db:migrate:local`, `pnpm seed`, then `pnpm dev:cloudflare`. Both workers share `.wrangler/state`; Workers AI is remote while D1 and queues remain local. Vectorize is unavailable in Wrangler local mode, so the worker intentionally falls back to FTS5.
