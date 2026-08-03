# Kivo

**Answers grounded in your knowledge.** Kivo is a production-oriented, multi-tenant AI knowledge base built on Cloudflare. It ingests private documents, enforces collection permissions before retrieval, combines Vectorize and FTS5 results, reranks evidence, and streams cited answers.

**[Open the live Kivo demo](https://kivo-web.ajaypathak2527.workers.dev)** · [API health](https://kivo-web.ajaypathak2527.workers.dev/api/v1/health)

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
pnpm --filter @kivo/ai-worker cf-typegen
pnpm --filter @kivo/web cf-typegen
pnpm db:migrate:local
pnpm seed
pnpm dev:cloudflare
```

Open `http://localhost:8787`. This command builds the OpenNext worker, starts the web and AI workers together, shares one persistent local D1 database, and uses your authenticated Cloudflare account for Workers AI. Vectorize is not emulated locally, so retrieval automatically uses FTS5; deployed environments use both retrieval paths. `pnpm dev` remains available for marketing/UI-only work without Cloudflare bindings. Never use demo mode in a public deployment.

The primary workspace journeys are live: documents are extracted in the browser and persisted as chunks, queue ingestion updates status, search returns ranked passages, chat streams grounded answers with sources, and workspace/collection/member/audit/capacity screens read D1 data. OAuth/passkey access is used when `KIVO_DEMO_MODE` is disabled.

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
