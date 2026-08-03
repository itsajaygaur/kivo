# Contributing

Use Node 24 and the pinned pnpm version. Create a focused branch, add tests for behavior changes, run `pnpm check && pnpm build`, and document changes that affect operations or security. Conventional commit prefixes are recommended (`feat:`, `fix:`, `docs:`, `chore:`). Never commit secrets, Cloudflare resource IDs, production exports, or document fixtures containing customer data.

Database changes must be backward compatible: expand, deploy readers/writers, migrate data, then contract in a later release. Tenant-owned queries must take `organization_id` explicitly and have a cross-tenant negative test.
