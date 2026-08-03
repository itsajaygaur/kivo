# Threat model

Protected assets include private documents, identity/session material, model credentials, conversations, citations, API keys, and tenant metadata. Principal threats are IDOR, forged organization IDs, cross-collection leakage, prompt injection in sources, malicious uploads, replayed writes, credential theft, log disclosure, denial of wallet, and incomplete deletion.

Controls include server-derived tenant context, centralized RBAC, collection filtering before prompt assembly, MIME/signature/checksum and size validation, idempotency keys, strict origin/cookie policy, short-lived upload grants, hashed tokens, AES-GCM BYOK storage, structured redacted logging, quota circuit breakers, and idempotent multi-store purging. Source text is always delimited untrusted evidence and cannot override system instructions.

Security-sensitive changes require tenant-isolation tests and a purge-completeness test. Rotate `BETTER_AUTH_SECRET`, the service token, and encryption master key through staged re-encryption; never print them. Report vulnerabilities privately to the repository owner.
