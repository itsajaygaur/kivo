import { z } from "zod";

export const roles = ["owner", "admin", "editor", "viewer"] as const;
export type Role = (typeof roles)[number];

export const documentStatuses = [
  "uploading",
  "extracting",
  "queued",
  "indexing",
  "ready",
  "failed",
  "trashed",
] as const;
export type DocumentStatus = (typeof documentStatuses)[number];

export const citationSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  versionId: z.string(),
  chunkId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  page: z.number().int().positive().nullable(),
  score: z.number().min(0).max(1),
});
export type Citation = z.infer<typeof citationSchema>;

export const searchRequestSchema = z.object({
  organizationId: z.string().min(1),
  query: z.string().trim().min(2).max(2_000),
  collectionIds: z.array(z.string()).max(50).optional(),
  authorizedCollectionIds: z.array(z.string()).max(250).optional(),
  limit: z.number().int().min(1).max(30).default(10),
});

export const chatRequestSchema = searchRequestSchema.extend({
  conversationId: z.string().optional(),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }))
    .min(1)
    .max(50),
});

export type SearchRequest = z.infer<typeof searchRequestSchema>;
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export type IngestionMessage = {
  kind: "embed-version" | "purge-document" | "reindex-version";
  organizationId: string;
  documentId: string;
  versionId: string;
  jobId: string;
  attempt: number;
};

export type RankedChunk = Citation & { content: string; collectionId: string; rank: number };
