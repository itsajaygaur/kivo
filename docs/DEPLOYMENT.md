# Deployment

1. Create D1 `kivo-db`, private R2 `kivo-documents`, Vectorize `kivo-chunks` (1,024 dimensions, cosine), queues `kivo-ingestion` and `kivo-ingestion-dlq`, and an Analytics Engine dataset.
2. Replace placeholder D1 IDs in both `wrangler.jsonc` files. Keep the same resource names.
3. Store `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, encryption, and service secrets with `wrangler secret put`; do not place secrets in `vars`. Google and GitHub OAuth secrets are optional because email/password login works without them.
4. Apply migrations with `wrangler d1 migrations apply kivo-db --remote --config apps/web/wrangler.jsonc`.
5. Deploy the private worker first: `pnpm --filter @kivo/ai-worker build` then `wrangler deploy -c apps/ai-worker/wrangler.jsonc`.
6. Build and deploy web: `pnpm --filter @kivo/web build:worker && pnpm --filter @kivo/web run deploy`.
7. Add an optional `DOCUMENTS` R2 binding to the web Worker if original-file retention is required. Without it, browser-extracted text is still indexed and searchable.
8. Set `PLATFORM_ADMIN_EMAILS` to a comma-separated allowlist for the platform administration screen.
9. Verify `/api/v1/health`, email signup, workspace onboarding, a demo session, invitations, a small upload, queue completion, hybrid search, citations, and purge.

Set `KIVO_DEMO_MODE=true` only when the deployment should offer the explicit `/demo` entry point. Normal visitors still need a session; shared demo visitors are blocked from membership, workspace-setting, and platform-admin mutations. Set it to `false` for a private-only deployment. OAuth callback URLs use `/api/auth/callback/{provider}`. The default `workers.dev` host avoids domain cost.

For a complete local run, copy `.env.example` to `apps/web/.dev.vars`, use `pnpm db:migrate:local`, `pnpm seed`, then `pnpm dev:cloudflare`. Both workers share `.wrangler/state`; Workers AI is remote while D1 and queues remain local. Vectorize is unavailable in Wrangler local mode, so the worker intentionally falls back to FTS5.
