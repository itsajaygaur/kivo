# Kivo

**Answers grounded in your knowledge.** Kivo is a production-oriented, multi-tenant AI knowledge base built on Cloudflare. It ingests private documents, enforces collection permissions before retrieval, combines Vectorize and FTS5 results, reranks evidence, and streams cited answers.

## Stack

- Next.js 16.2, React 19.2, Tailwind CSS 4, Better Auth, AI SDK 7
- Cloudflare Workers via OpenNext, D1/FTS5, R2, Vectorize, Queues, Workers AI
- Drizzle ORM, Zod, TypeScript 7, Vitest, Playwright, Turborepo, pnpm

## Local development

Prerequisites: Node.js 24 LTS, Corepack, and a free Cloudflare account for binding-backed flows.

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm --filter @kivo/ai-worker cf-typegen
pnpm --filter @kivo/web cf-typegen
pnpm exec wrangler d1 migrations apply kivo-db --local --config apps/web/wrangler.jsonc
pnpm seed
pnpm dev
```

The UI runs in demo mode by default. Use `pnpm --filter @kivo/web preview` to exercise real local Cloudflare bindings. Never use demo mode in a public deployment.

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
