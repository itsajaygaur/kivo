# Deployment

1. Create D1 `kivo-db`, private R2 `kivo-documents` (optional), Vectorize `kivo-chunks` (1,024 dimensions, cosine), and queues `kivo-ingestion` and `kivo-ingestion-dlq`.
2. Create the Vectorize metadata index that tenant filtering depends on — without it, filtered queries fail and retrieval silently degrades to FTS5 only:
   `wrangler vectorize create-metadata-index kivo-chunks --property-name=organizationId --type=string`
3. Replace the D1 IDs in both `wrangler.jsonc` files with your own. Keep the same resource names.
4. Store `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `INTERNAL_SERVICE_TOKEN` with `wrangler secret put`; do not place secrets in `vars`. `INTERNAL_SERVICE_TOKEN` must be set to the same value on **both** Workers: the AI Worker fails closed (503) without it, and the web Worker refuses to call the AI service without it. Google and GitHub OAuth secrets are optional because email/password login works without them.
5. Apply migrations with `wrangler d1 migrations apply kivo-db --remote --config apps/web/wrangler.jsonc`.
6. Deploy the private worker first: `pnpm --filter @kivo/ai-worker build` then `wrangler deploy -c apps/ai-worker/wrangler.jsonc`. It consumes both the ingestion queue and its dead-letter queue (exhausted jobs are marked failed instead of disappearing).
7. Build and deploy web: `pnpm --filter @kivo/web build:worker && pnpm --filter @kivo/web run deploy`.
8. Add an optional `DOCUMENTS` R2 binding (`r2_buckets`) to the web Worker's `wrangler.jsonc` if original-file retention is required. Without it, browser-extracted text is still indexed and searchable, and the upload PUT endpoint returns 503.
9. Set `PLATFORM_ADMIN_EMAILS` to a comma-separated allowlist for the platform administration screen. Platform admin additionally requires the account's email to be verified (OAuth sign-ins are verified automatically).
10. Verify `/api/v1/health`, email signup, workspace onboarding, a demo session, invitations, a small upload, queue completion, hybrid search, citations, and purge.

Set `KIVO_DEMO_MODE=true` only when the deployment should offer the explicit `/demo` entry point. Normal visitors still need a session; shared demo visitors are read-only — they can browse documents, collections, usage, search, and chat, and cannot perform any mutation, read member or audit data, or trigger OCR. Set it to `false` for a private-only deployment. OAuth callback URLs use `/api/auth/callback/{provider}`. The default `workers.dev` host avoids domain cost.

For a complete local run, copy `.env.example` to `apps/web/.dev.vars` **and** `apps/ai-worker/.dev.vars` (both workers need `INTERNAL_SERVICE_TOKEN`; the AI worker also reads `VECTORIZE_MODE=off`), use `pnpm db:migrate:local`, `pnpm seed`, then `pnpm dev:cloudflare`. Both workers share `.wrangler/state`; Workers AI is remote while D1 and queues remain local. Vectorize is unavailable in Wrangler local mode; `VECTORIZE_MODE=off` makes ingestion and retrieval fall back to FTS5 deliberately instead of burning retries.

## Continuous deployment (Workers Builds)

Both Workers deploy from the connected Git repository. Because this is a pnpm monorepo, each Worker's **Settings → Build → Build configuration** must point at its own package; the defaults assume a single-app repository and will fail with `Missing entry-point to Worker script or to assets directory`, because the deploy step runs where no `wrangler.jsonc` exists.

For `kivo-web`:

| Setting                                 | Value                              |
| --------------------------------------- | ---------------------------------- |
| Root directory                          | `apps/web`                         |
| Build command                           | `pnpm build:worker`                |
| Deploy command (production branch)      | `npx opennextjs-cloudflare deploy` |
| Non-production branch (version) command | `npx wrangler versions upload`     |

`next build` alone is not deployable: only `build:worker` (`opennextjs-cloudflare build`) emits `.open-next/worker.js`, which `wrangler.jsonc` declares as `main`.

Two behaviours matter when changing these settings. Saved settings apply to the **next** build, whereas **retrying** a build uses whatever settings exist at retry time — so retry a build and inspect its own "Build settings" panel to confirm a change actually persisted. A retry also posts a fresh check run to the pull request, so a red check can be cleared without pushing a new commit.
