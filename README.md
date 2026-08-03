# Kivo

**Answers grounded in your knowledge.** Kivo is a production-oriented, multi-tenant AI knowledge base built on Cloudflare. It ingests private documents, enforces collection permissions before retrieval, combines Vectorize and FTS5 results, reranks evidence, and streams cited answers.

**[Open the live Kivo demo](https://kivo-web.ajaypathak2527.workers.dev/demo)** · [Create an account](https://kivo-web.ajaypathak2527.workers.dev/sign-in) · [API health](https://kivo-web.ajaypathak2527.workers.dev/api/v1/health)

The application uses real D1/FTS5, Vectorize, Queues, Workers AI retrieval, and streamed generation. Extracted document text can be indexed without R2; configuring the optional private R2 binding also preserves original files.

## Stack

- Next.js 16.2, React 19.2, Tailwind CSS 4, Better Auth, AI SDK 7
- Cloudflare Workers via OpenNext, D1/FTS5, R2, Vectorize, Queues, Workers AI
- Drizzle ORM, Zod, TypeScript 7, Vitest, Playwright, Turborepo, pnpm

## Local development

Prerequisites: Node.js 24 LTS, Corepack, and a free Cloudflare account for binding-backed flows.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example apps/web/.dev.vars
pnpm --filter @kivo/ai-worker cf-typegen
pnpm --filter @kivo/web cf-typegen
pnpm db:migrate:local
pnpm seed
pnpm dev:cloudflare
```

Open `http://127.0.0.1:8787`. This command builds the OpenNext worker, starts the web and AI workers together, shares one persistent local D1 database, and uses your authenticated Cloudflare account for Workers AI. Vectorize is not emulated locally, so retrieval automatically uses FTS5; deployed environments use both retrieval paths. `pnpm dev` remains available for marketing/UI-only work without Cloudflare bindings. Keep `.dev.vars` private.

The primary workspace journeys are live: email/password authentication, optional OAuth and passkeys, account onboarding, workspace switching, member invitation links and roles, collection access lists, editable retention settings, audit history, platform quotas/suspension, document ingestion, hybrid search, and grounded streamed chat. `KIVO_DEMO_MODE=true` enables an explicit public demo session; it no longer bypasses authentication for every visitor. Shared demo visitors cannot change membership or platform settings.

## Repository

```text
apps/web         Next.js product, auth, REST API, upload and administration
apps/ai-worker   Private retrieval, inference, OCR and queue consumer Worker
packages/db      Drizzle schema, D1 migrations and deterministic seed
packages/shared  Contracts, security primitives, quotas, chunking and ranking
docs             Architecture, operations, security and deployment guidance
```

## Quality gates

Run `pnpm check` for formatting, types, tests, and linting; `pnpm build` for production bundles; and `pnpm test:e2e` for the browser acceptance suite. See [CONTRIBUTING.md](./CONTRIBUTING.md) and [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

Kivo is production-quality software with fail-closed portfolio-scale quotas. Free-tier capacity is finite; exceeding an internal limit pauses the affected feature instead of enabling billing.
