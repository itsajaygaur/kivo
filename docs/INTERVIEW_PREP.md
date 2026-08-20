# Kivo — Interview Prep

A complete walkthrough of what this project is, how it works, why it was built this way, and how to
talk about it. Everything below is verified against the code in this repository.

---

## 1. The pitch

### 15 seconds

> Kivo is a multi-tenant AI knowledge base. You upload your team's documents, ask questions in plain
> English, and get a streamed answer with citations back to the exact document, version, and page —
> and it never shows you evidence you aren't allowed to see. It runs entirely on Cloudflare's edge
> platform.

### 60 seconds

> Kivo is a production-oriented RAG (retrieval-augmented generation) application. The problem it
> solves: teams have knowledge scattered across PDFs, Word docs, and Markdown, and generic chatbots
> either don't know that content or hallucinate about it.
>
> Architecturally it's two Cloudflare Workers. A public Worker runs a Next.js app and owns identity,
> authorization, quotas, uploads, and the REST API. A second, private Worker owns everything
> AI-adjacent — embeddings, retrieval, reranking, OCR, generation, and the queue consumer. The only
> way to reach the private Worker is through a Cloudflare service binding with a shared token; it has
> no public route at all.
>
> Data lives in D1 (Cloudflare's SQLite), with a Vectorize index for semantic search and SQLite FTS5
> for keyword search. A question hits both indexes, results are fused with reciprocal-rank fusion,
> reranked with a cross-encoder, filtered against the user's collection permissions, and only then
> assembled into a bounded prompt. The answer streams back token by token with structured citations.

### 3 minutes — the deep version

Add to the above:

- **Ingestion is client-side-first.** PDF and DOCX parsing happens in the browser (pdf.js and
  mammoth), not in the Worker. Workers have tight CPU allocations; a 300-page PDF would blow through
  them. The browser extracts and chunks the text, POSTs the chunks with a checksum that must match
  the upload reservation, and the Worker enqueues an embedding job. A scanned PDF with no text layer
  falls back to rendering pages to canvas and running them through a vision model for OCR.
- **Authorization is enforced twice.** Once in the public Worker (which computes the caller's
  accessible collection IDs from the _session_, never from request JSON), and again in the private
  Worker before any chunk is allowed into a prompt. Tenant ID is never accepted from the client.
- **Everything is designed to fail closed.** No service token → 503, not "skip auth". Reranker
  returns garbage → keep the fusion candidates and log a degradation event, not zero results.
  Embedding batch has the wrong shape → the job is recorded as failed rather than the document being
  marked "ready" while half-indexed.
- **It's built to sit inside free-tier ceilings.** Per-workspace quotas and per-day request budgets
  are enforced _before_ the spend happens, so a runaway loop pauses a feature instead of generating a
  bill.

---

## 2. Live surface area

| Thing       | Where                                                                   |
| ----------- | ----------------------------------------------------------------------- |
| App         | `https://kivo.ajaygaur.in` (also `kivo-web.ajaypathak2527.workers.dev`) |
| Public demo | `/demo` — creates an explicit read-only demo session                    |
| Health      | `/api/v1/health`                                                        |
| OpenAPI 3.1 | `/api/v1/openapi.json`                                                  |

**Scale of the codebase:** ~8,000 lines of hand-written TypeScript/SQL (excluding generated
Cloudflare type files and the lockfile), across 2 apps and 2 shared packages in a pnpm + Turborepo
monorepo.

---

## 3. Stack — and be ready to justify each choice

| Layer          | Choice                                       | Why (the answer they want)                                                                                 |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Framework      | Next.js 16.2 + React 19.2                    | Server components for the shell, one deploy target for UI + API                                            |
| Deploy         | OpenNext → Cloudflare Workers                | Runs Next.js on Workers so app and data bindings live in the same runtime — no cross-network hop to the DB |
| DB             | Cloudflare D1 (SQLite)                       | Bound directly to the Worker; sub-millisecond local reads; free tier is generous                           |
| Keyword search | SQLite FTS5 (BM25)                           | Free, colocated with the data, no extra service                                                            |
| Vector search  | Cloudflare Vectorize                         | 1,024-dim, cosine, with a metadata index on `organizationId` for tenant filtering                          |
| Blob           | R2 (optional binding)                        | Originals, private only. **Not bound in the live deployment** — text-only indexing still works             |
| Async          | Cloudflare Queues + DLQ                      | Embedding is slow and retryable; it must not block the upload response                                     |
| Models         | Workers AI                                   | No third-party key needed for the core path                                                                |
| Auth           | Better Auth 1.6 + Drizzle adapter            | Email/password, optional GitHub/Google OAuth, passkeys, org plugin for the data model                      |
| API layer      | Next route handler (web), Hono 4 (AI worker) | Hono is tiny and fast for a Worker with a handful of internal routes                                       |
| Validation     | Zod 4                                        | Every request body is parsed at the boundary; contracts live in `packages/shared`                          |
| ORM            | Drizzle                                      | **Only** for Better Auth's adapter. All app queries are hand-written prepared SQL                          |
| Tests          | Vitest + Playwright                          | Unit/integration + 8 browser e2e journeys                                                                  |
| Tooling        | TypeScript 7, Turborepo, pnpm, Prettier      | `tsc --noEmit` doubles as lint (ESLint's TS toolchain doesn't yet support TS 7)                            |

### Models in use (`apps/ai-worker/wrangler.jsonc`)

| Role       | Model                                        |
| ---------- | -------------------------------------------- |
| Embedding  | `@cf/baai/bge-m3` (1,024 dims, multilingual) |
| Reranking  | `@cf/baai/bge-reranker-base` (cross-encoder) |
| Generation | `@cf/openai/gpt-oss-20b`                     |
| OCR        | `@cf/meta/llama-3.2-11b-vision-instruct`     |

---

## 4. Architecture — draw this on the whiteboard

```
   Browser
   ├─ pdf.js / mammoth extraction + chunking
   └─ AI SDK useChat (SSE)
        │
        ▼
   ┌──────────────────────────────┐
   │  kivo-web  (public Worker)   │   Next.js via OpenNext
   │  auth · RBAC · quotas ·      │
   │  uploads · REST API · admin  │
   └──┬────────┬─────────┬────────┘
      │        │         │  service binding (only ingress)
      ▼        ▼         ▼
    D1/FTS5   R2      ┌──────────────────────────────┐
      ▲     (opt)     │ kivo-ai-worker (private)     │
      │               │ embed · hybrid retrieve ·    │
      │  Queue ──────▶│ rerank · OCR · generate ·    │
      │               │ queue consumer + DLQ         │
      └───────────────┴──┬──────────┬────────────────┘
                         ▼          ▼
                     Vectorize   Workers AI
```

**Say this out loud:** "Two Workers, one trust boundary. The AI bindings — Vectorize, Workers AI —
are only bound to the private Worker. `workers_dev` is `false` on it, so it has no public URL. The
public Worker reaches it through a Cloudflare service binding, which is an in-process RPC-style call
inside Cloudflare's network, and it presents a shared `INTERNAL_SERVICE_TOKEN` compared in constant
time. If the token is missing on either side, the call is refused — 503, never 'proceed without
auth'."

---

## 5. The four ADRs (in `docs/ARCHITECTURE.md`)

Memorize these — "what were your key decisions?" is nearly guaranteed.

1. **ADR-001 — Cloudflare-native persistence.** Minimizes cost and network boundaries. D1, R2,
   Vectorize, Queues are all bound directly to the Worker.
2. **ADR-002 — Client-side extraction.** PDF/DOCX parsing runs in the browser, keeping it out of the
   Worker's CPU allocation.
3. **ADR-003 — Two Workers.** Keeps AI bindings private and lets the two halves deploy
   independently.
4. **ADR-004 — FTS5 is derived state.** D1 rows and R2 originals are authoritative; the FTS index can
   always be rebuilt from `chunk`.

---

## 6. Walk the ingestion path (end to end)

Be able to narrate this without notes.

1. **Reserve.** Browser hashes the file (SHA-256) and `POST /api/v1/documents` with filename, MIME
   type, byte count, checksum, and an `Idempotency-Key` header (required — 400 without it).
   - Replay: if that idempotency key already exists, the original reservation is returned with
     `replayed: true`. No duplicate document.
   - Dedupe: `UNIQUE(organization_id, checksum)` → 409 if the same bytes are already indexed. If a
     _trashed_ document holds that slot, it's hard-deleted first so re-uploading a deleted file works.
   - Quotas: document count and storage bytes are checked against `workspace_settings` before
     anything is written.
   - Writes `document`, `document_version`, and `ingestion_job` rows in one `D1.batch()`.
2. **Upload original (optional).** `PUT /api/v1/uploads/:documentId/:versionId`. The grant expires
   after 10 minutes (enforced, not just advertised). Byte length **and** SHA-256 must match the
   reservation, and the checksum must also be echoed in `x-content-sha256`. Only then does it land in
   private R2.
3. **Extract + chunk in the browser.** `apps/web/lib/extraction.ts`.
   - PDF → pdf.js, page by page, injecting `[KIVO_PAGE:n]` markers so citations can report a page.
     > 300 pages is rejected.
   - DOCX → mammoth raw text. HTML → a hand-written tag stripper that also drops `<script>`/`<style>`
     content and decodes entities (so untrusted HTML becomes inert plain text — there's a test for it).
   - If a PDF yields <80 characters, it's treated as scanned: pages are rendered to canvas at 1.5×,
     JPEG-encoded, and sent to `/api/v1/ocr` (which enforces a monthly page budget).
   - Chunking: 1,600-character target, 240-character overlap, snapping to a paragraph or sentence
     boundary if one falls past 60% of the target, carrying the last Markdown heading forward.
4. **Submit chunks.** `POST /api/v1/chunks` with the version's checksum (must match — otherwise 422:
   "the extracted text does not belong to this upload"). Existing chunks for the version are
   `DELETE`d then `INSERT`ed in batches of 50, and the version flips to `queued`.
5. **Enqueue.** A message goes onto `kivo-ingestion` carrying **identifiers only** — never document
   text. Any superseded vector IDs ride along as `staleVectorIds`.
6. **Consume.** The AI Worker embeds chunks in batches of 25, upserts to Vectorize with tenant
   metadata, writes progress percentages to `ingestion_job`, and finally flips job / version /
   document to `ready` in one batch.
   - Failure: retry with exponential backoff `min(900, 2^attempt × 10)` seconds, up to 4 attempts,
     then `state='failed'` with an error code and message. A DLQ consumer catches anything that still
     escapes, so no document is left stuck in "indexing" forever.

**Document status machine:** `uploading → extracting → queued → indexing → ready` (or `failed`, or
`trashed`).

---

## 7. Walk the query path (end to end)

1. `POST /api/v1/chat` or `/search` on the public Worker.
2. `can(role, "chat:use")` → then a **daily request budget** counter is atomically incremented
   (`INSERT … ON CONFLICT DO UPDATE … RETURNING`, so concurrent requests can't race past the limit).
   Over 2,000/day → 429.
3. The server computes `accessibleCollectionIds` from the session: unrestricted collections, plus
   restricted ones the user is explicitly granted, plus everything if owner/admin. If the client asked
   for a collection outside that set → 403.
4. Request is re-parsed through the Zod contract with `organizationId` **overwritten from the
   session**, then forwarded over the service binding.
5. In the AI Worker (`retrieval.ts`):
   - Embed the query with bge-m3 → Vectorize `query(topK: 20, filter: { organizationId })`.
   - In parallel path, FTS5: query terms sanitized, quoted, capped at 24 terms, `OR`-joined,
     `bm25()` ranked, `LIMIT 30`, scoped by `organization_id`.
   - **Reciprocal-rank fusion** (`k = 60`), taking the top 20. Duplicate IDs _within_ one list only
     count once, so a list can't inflate its own result past genuine cross-list agreement.
   - Hydrate from D1 with a join that enforces: same org, document not soft-deleted, and
     `chunk.version_id = document.current_version_id` (superseded versions can't leak).
   - Drop anything outside the authorized collections — **this is the second authorization check**.
   - Cross-encoder rerank; scores clamped to [0,1]. If the reranker errors or returns an empty
     response, the RRF candidates are kept and a `rerank_degraded` event is logged.
   - `boundedEvidence(24,000 chars)` then slice to the requested limit (default 10).
6. Generation (`generation.ts`): system instruction + last 8 turns of history + a user message
   containing the evidence blocks and the question. Evidence is wrapped in `<evidence n>` … `</evidence n>`
   delimiters, and the system prompt explicitly says everything inside is untrusted document text and
   must never be followed as instructions.
7. The response streams as the AI SDK UI message protocol: `source-document` parts first (so the UI
   can render sources immediately), then `text-start` / `text-delta` / `text-end`.

**Zero results is a first-class answer:** "I couldn't find a supported answer in the documents you can
access."

---

## 8. Multi-tenancy and security — the strongest part of the story

`docs/THREAT_MODEL.md` names the threats: IDOR, forged organization IDs, cross-collection leakage,
prompt injection in sources, malicious uploads, replayed writes, credential theft, log disclosure,
denial of wallet, and incomplete deletion.

Controls actually implemented:

- **Server-derived tenant context.** `organizationId` comes from `requireActor()`, which reads the
  Better Auth session, checks the user isn't suspended, and resolves an active membership joined
  against a non-suspended, non-deleted organization. Request JSON never supplies a tenant.
- **Every tenant row carries `organization_id`**, and every query binds it.
- **Centralized RBAC** in `packages/shared/src/rbac.ts`: 4 roles (owner / admin / editor / viewer)
  against 11 permissions, plus `canAccessCollection` for per-collection ACLs.
- **Authorization before retrieval, and again before evidence enters the prompt.**
- **Fail-closed service auth** between Workers with a timing-safe (constant-time) digest comparison.
- **Platform admin requires a verified email** — being on the `PLATFORM_ADMIN_EMAILS` allowlist isn't
  enough, because anyone could sign up with that address via password auth.
- **Read-only demo sessions.** The public demo uses a deny-by-default guard: only `GET` on
  workspace/documents/collections/usage and `POST` on search/chat are permitted. No mutations, no
  member or audit data, no OCR (which costs money), and the seeded owner's identity is masked.
- **Hashed invitation tokens** (only the SHA-256 hash is stored), 7-day expiry.
- **Short-lived upload grants** (10 min), size + checksum verified server-side.
- **Open-redirect protection**: `safeReturnTo()` allowlists post-auth destinations.
- **Strict CSP** plus `X-Frame-Options: DENY`, `nosniff`, HSTS, `Referrer-Policy`, `Permissions-Policy`,
  and COOP, set in `next.config.ts`.
- **RFC 9457 `application/problem+json`** for every error, with a top-level handler so an unexpected
  throw becomes a clean 500 rather than a stack trace.
- **Structured, redacted JSON logs.** Document contents never appear in logs.
- **Complete deletion.** Delete → soft-delete the row, immediately remove the R2 original, enqueue a
  purge that deletes the Vectorize entries and the D1 chunk rows; FTS follows via trigger.

### Be honest about the limits (this earns credibility)

- Chunk text is **client-supplied by workspace editors** and is not re-derived server-side from the
  uploaded file. An editor can therefore influence retrieved evidence. Documented, not hidden.
- Prompt-injection delimiting **reduces but does not eliminate** the risk.
- BYOK provider keys and bearer API keys are **designed, not implemented** — the `api_key` table and
  `apiKeys:manage` permission are reserved.

---

## 9. Data model (14 app tables + 5 auth tables)

Auth: `user`, `session`, `account`, `verification`, `passkey`.

Tenancy: `organization`, `member`, `invitation`, `workspace_settings`, `collection`,
`collection_member`.

Content: `document` → `document_version` → `chunk` (+ `chunk_fts` virtual table).

Operations: `ingestion_job`, `usage_daily`, `audit_log`, `lifecycle_job`.

Chat (schema present, not yet wired at runtime): `conversation`, `message`, `citation`, `feedback`,
`api_key`.

**Constraints worth naming in an interview:**

- `UNIQUE(organization_id, checksum)` on `document` — content-addressed dedupe.
- `UNIQUE(document_id, version)` and `UNIQUE(version_id, ordinal)` — deterministic chunk identity;
  chunk IDs are literally `${versionId}:${ordinal}`, which is also the Vectorize vector ID. That's why
  a re-index can compute exactly which vectors are now stale.
- `UNIQUE(organization_id, idempotency_key)` on `ingestion_job`.
- `usage_daily` is keyed `(organization_id, day)` and updated with an atomic upsert.
- `chunk_fts` is an FTS5 virtual table kept in sync by three triggers (insert / delete / update).

**Migrations:** hand-written SQL, applied by D1 in lexical order. Drizzle-kit is deliberately _not_ in
the toolchain — `schema.ts` exists only so Better Auth's adapter can read/write the auth tables; the
SQL files are the source of truth. There's a test (`packages/db/src/migrations.test.ts`) that applies
every migration plus the seed against `node:sqlite` and asserts the FTS triggers stay in sync through
re-indexing, purging, and cascade deletes.

---

## 10. Free-tier / cost engineering ("denial of wallet")

Two tiers of limits, both in `packages/shared/src/quotas.ts`:

**Per workspace:** 25 MB/file · 300 pages/file · 250 documents · 500 MB storage · 1,000 chunks/doc ·
25 members · 200 collections · 100 OCR pages/month · 2,000 search+chat requests/day.

**Installation ceilings (kept under provider allocations):** 8 GB R2 · 400 MB D1 · 4.5M stored vector
dimensions · 8,000 AI neurons/day · 80,000 dynamic requests/day · 8,000 queue ops/day.

The line to deliver: _"Reaching a limit pauses that feature with a 429 and reset guidance. It never
enables paid overages. That's a deliberate product decision, not a missing feature."_

---

## 11. Reliability and failure handling (interviewers love this section)

| Failure                           | Behavior                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Vectorize unavailable             | FTS5 still answers; logs `vector_retrieval_degraded` — deliberately not a _silent_ fallback |
| Reranker empty/errors             | Keep RRF candidates; log `rerank_degraded`                                                  |
| Embedding batch shape wrong       | Throw → retry → after 4 attempts record `failed` honestly                                   |
| Queue retries exhausted           | DLQ consumer marks the job failed so it surfaces in the UI                                  |
| Generation stream dies mid-answer | Append an explicit truncation notice — a partial answer is never presented as complete      |
| Generation emits no text          | Retry once synchronously, then fall back to a plain "try again" message                     |
| Service token unset               | 503 on both sides                                                                           |
| R2 not bound                      | Upload PUT returns 503; extracted text is still indexed and searchable                      |

That table maps almost one-to-one to `docs/RUNBOOK.md`.

---

## 12. Testing and CI/CD

- **Unit (Vitest):** RBAC grants, RRF determinism and the duplicate-ID case, evidence budgeting,
  quota enforcement, chunking, AES-GCM round-trip, SSE decoding across three Workers AI payload
  shapes and across byte boundaries, HTML sanitization, redirect allowlisting.
- **Migration tests** against `node:sqlite`: seed applies after every migration; FTS triggers stay in
  sync through delete-then-insert re-indexing, purge, and cascade delete. One test exists purely to
  _document why_ `INSERT OR REPLACE` must not be used.
- **Tenant-isolation integration tests:** never surface another org's chunks via FTS; drop vector
  matches from another org; exclude unauthorized collections; exclude soft-deleted documents; exclude
  superseded versions.
- **Service-auth tests:** fails closed with no token, wrong token, missing header; `/health` stays open.
- **E2E (Playwright, 8 journeys):** marketing page, demo session creation, collection editing,
  invitations, document upload with chunk submission, search, streamed chat with sources, and the
  empty-stream recovery path.
- **CI:** format check → `tsc --noEmit` lint → typecheck → test → build → Worker bundle dry run →
  migrate + seed verification. Plus a separate Playwright job, weekly CodeQL, and Dependabot.
- **Deploy:** `workflow_dispatch` only — production deploys are deliberately manual. It runs the full
  `pnpm check`, applies D1 migrations remotely, deploys the **AI Worker first**, then the web Worker.

---

## 13. Question bank

**"Why RAG instead of fine-tuning?"**
Documents change daily; fine-tuning can't keep up and can't cite. RAG gives freshness, attribution,
and per-user access control at query time — a fine-tuned model can't forget what one user isn't
allowed to see.

**"Why hybrid search instead of just vectors?"**
Dense embeddings are great at paraphrase and terrible at exact tokens — error codes, product SKUs,
acronyms, names. BM25 is the reverse. RRF fuses them by rank rather than score, so I don't have to
normalize two incomparable scoring scales. It's a well-understood, tuning-free baseline.

**"What is reciprocal-rank fusion, concretely?"**
Each list contributes `1/(k + rank)` to each document, `k = 60`. Documents that appear high in both
lists win. It only needs ordering, not calibrated scores. My implementation additionally dedupes IDs
_within_ a list so one source can't stack its own votes.

**"Why rerank on top of that?"**
Bi-encoders embed query and document independently; a cross-encoder reads them together and is much
more accurate — but it's too slow to run over the whole corpus. So: cheap recall from two indexes,
expensive precision over ~20 candidates. Classic retrieve-then-rerank.

**"How do you prevent one tenant seeing another's data?"**
Three layers. Tenant ID comes only from the verified session. Every query binds `organization_id`, and
Vectorize is queried with a metadata filter on it. Then the AI Worker re-checks collection grants
before evidence goes into the prompt. And there are integration tests that specifically assert each of
those boundaries.

**"How do you handle prompt injection from a document?"**
Evidence is wrapped in numbered `<evidence n>` delimiters and the system prompt states that everything
inside them is untrusted text that must never be treated as instructions. I'm explicit in the threat
model that this mitigates rather than eliminates the risk — the real containment is that the model has
no tools and no write access, so the blast radius of a successful injection is a bad answer, not a
bad action.

**"Why chunk at 1,600 characters with 240 overlap?"**
Big enough to hold a coherent idea, small enough that a cross-encoder and the context budget can
handle ten of them. The overlap stops a fact from being severed at a boundary. And I snap to paragraph
or sentence boundaries when one is available past 60% of the target, so chunks rarely cut mid-sentence.

**"Why do extraction in the browser?"**
Worker CPU time is metered and capped. Parsing a 300-page PDF server-side is exactly the workload that
doesn't belong there, and it would also have meant shipping the whole file to the edge before knowing
whether it was even parseable. Cost of the trade-off: the extracted text is client-supplied, so I
verify the file checksum against the reservation and I've documented in the threat model that a
workspace editor can influence indexed text.

**"How do you make uploads idempotent?"**
`Idempotency-Key` is required on the reservation; a repeat returns the original reservation with
`replayed: true`. Chunk submission is idempotent by construction — re-posting a version's chunks
replaces them. And `ingestion_job` has a unique constraint on `(organization_id, idempotency_key)` so
the database enforces it rather than the application hoping.

**"What was the hardest bug?"**
Chunk re-indexing used `INSERT OR REPLACE`. SQLite's REPLACE conflict resolution doesn't fire the
`AFTER DELETE` trigger the way a real `DELETE` does, so the FTS5 index kept the old rows. Stale text
stayed searchable after a document was re-indexed — a correctness bug that looked like a caching
problem and was actually a leak. Fix was an explicit `DELETE` + `INSERT`, and I wrote a migration test
whose entire job is to document why REPLACE must never come back.

**"What would you do next?"**
In order: (1) persist conversations, messages, and citations — the tables exist but chat doesn't write
to them yet, so there's no answer history or feedback loop; (2) build the actual RAG evaluation
harness — `docs/RAG_EVALUATION.md` defines the release gates (Recall@10 ≥ 0.85, correct
document/version attribution, grounded refusal, zero cross-tenant leakage) but there's no runner yet;
(3) a scheduled Worker to enforce the `retention_days` setting via `lifecycle_job`, which is currently
stored but not acted on; (4) bearer API keys; (5) server-side re-derivation of chunk text to close the
client-trust gap.

**"What would you change if traffic went 100×?"**
D1 is a single-region SQLite; at that point the FTS path becomes the bottleneck and I'd move keyword
search into a dedicated service or shard by tenant. I'd cache query embeddings — identical questions
re-embed today. I'd batch reranker calls and consider dropping the reranker for short queries where
RRF ordering is already decisive. And I'd move usage accounting into Durable Objects so counters don't
contend on a single D1 row per tenant per day.

---

## 14. How to talk about having built it with Claude Code

Don't hide it and don't lead with it. If asked directly:

> I used Claude Code heavily — it's how I work now. The way I'd frame it: I made the architectural
> decisions and I own every one of them. Two Workers with the AI bindings private, hybrid retrieval
> with RRF instead of pure vector, client-side extraction to protect Worker CPU, FTS5 as derived
> state — those are choices I can defend, including the trade-offs each one cost me.
>
> The most valuable thing I did was run an adversarial audit pass over the whole project and fix what
> it found: the FTS5 trigger leak, demo sessions that could mutate data, platform admin that didn't
> require a verified email, ingestion that reported partially-indexed documents as ready. Knowing
> what to look for and being able to tell a real finding from a false one is the skill that matters.

**Then be ready to back it up.** The one thing that will sink you is not being able to explain your
own code. Before the interview, be able to answer without looking:

- What happens between clicking "upload" and the document becoming searchable? (§6)
- What happens between typing a question and the first token appearing? (§7)
- Where exactly is authorization enforced, and why twice? (§8)
- Why RRF, why rerank, why those chunk sizes? (§13)

If they ask a question you genuinely don't know, say so and reason from the architecture out loud.
That reads far better than a confident wrong answer.

---

## 15. Glossary — don't get caught out

| Term                 | Meaning                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| **RAG**              | Retrieval-augmented generation: fetch relevant text, put it in the prompt, generate a grounded answer |
| **Chunk**            | A ~1,600-character slice of a document; the unit of retrieval                                         |
| **Embedding**        | A 1,024-dim vector representing meaning; similar text → nearby vectors                                |
| **BM25**             | Classic keyword relevance ranking; what SQLite FTS5's `bm25()` computes                               |
| **FTS5**             | SQLite's full-text search extension; here a virtual table kept in sync by triggers                    |
| **RRF**              | Reciprocal-rank fusion; merges ranked lists via `1/(k + rank)`                                        |
| **Bi-encoder**       | Embeds query and document separately — fast, less precise                                             |
| **Cross-encoder**    | Reads query and document together — slow, more precise; used for reranking                            |
| **Service binding**  | Cloudflare's Worker-to-Worker call, inside their network, no public internet hop                      |
| **DLQ**              | Dead-letter queue; where messages go after retries are exhausted                                      |
| **Idempotency key**  | Client-supplied token making a retried write safe to replay                                           |
| **RFC 9457**         | The `application/problem+json` error format standard                                                  |
| **Soft delete**      | Marking a row deleted (`deleted_at`) instead of removing it                                           |
| **Denial of wallet** | An attack that runs up your cloud bill rather than taking you offline                                 |

---

## 16. Two-minute demo script

1. Open `/demo` → "this creates an explicit, read-only demo session; the app doesn't bypass auth for
   anonymous visitors."
2. Documents page → "statuses come from the ingestion job; the progress number is written by the
   queue consumer as it embeds batches of 25."
3. Collections → "restricted collections have explicit member ACLs; that ACL is what gets computed
   server-side and passed into retrieval."
4. Search → "hybrid: vector plus BM25, fused and reranked. Every result carries document, version, and
   page."
5. Chat → ask something answerable, point at the sources rendering _before_ the text streams. Then ask
   something not in the corpus: "it refuses instead of inventing — that's the evidence-only system
   instruction doing its job."
6. `/api/v1/health` and `/api/v1/openapi.json` → "the API is documented and the deployment reports
   which bindings are actually live."

---

## 17. Numbers cheat-sheet

```
Chunking      1,600 chars target · 240 overlap · boundary snap past 60%
Retrieval     Vectorize topK 20 · FTS5 LIMIT 30 · RRF k=60 → top 20 → rerank → 24,000-char budget → 10
Embedding     bge-m3, 1,024 dims, cosine, batches of 25
Queue         batch 10 · 5s timeout · 3 retries · backoff min(900, 2^n × 10)s · DLQ
Ingestion     4 attempts before terminal failure
Quotas        25MB/file · 300 pages · 250 docs · 500MB · 25 members · 200 collections
              100 OCR pages/month · 2,000 requests/day
Ceilings      8GB R2 · 400MB D1 · 4.5M vector dims · 8k neurons/day · 80k requests/day
Chat history  last 8 turns sent to the model · 50-message contract cap (truncated, not rejected)
Uploads       10-minute grant expiry · SHA-256 + byte-length verified
Invitations   7-day expiry · only the token hash is stored
Roles         4 roles × 11 permissions
Tests         8 Playwright journeys + unit/integration suites
Code          ~8,000 lines of hand-written TS/SQL
```
