# Free-tier capacity

Kivo deliberately stays below provider allocations: 8 GB R2, 400 MB D1, 4.5 million stored vector dimensions, 8,000 AI neurons/day, 80,000 dynamic requests/day, and 8,000 queue operations/day. Workspace defaults are 250 documents, 500 MB, 1,000 chunks per document, 25 members, 200 collections, 25 MB/300 pages per file, 100 OCR pages/month, and 2,000 search/chat requests per day.

Document, storage, member, collection, OCR-page, and daily-request limits are enforced before the corresponding write or AI call. Reaching a limit pauses that operation with an RFC 9457 response and reset guidance. Optional Resend and BYOK providers are never required for the core workflow.
