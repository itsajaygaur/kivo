export const workspaceLimits = Object.freeze({
  fileBytes: 25 * 1024 * 1024,
  pagesPerFile: 300,
  documents: 250,
  storageBytes: 500 * 1024 * 1024,
  chunksPerDocument: 1_000,
  members: 25,
  collections: 200,
  ocrPagesPerMonth: 100,
  requestsPerDay: 2_000,
});
export const installationCeilings = Object.freeze({
  r2Bytes: 8 * 1024 ** 3,
  d1Bytes: 400 * 1024 ** 2,
  vectorDimensions: 4_500_000,
  aiNeuronsPerDay: 8_000,
  dynamicRequestsPerDay: 80_000,
  queueOperationsPerDay: 8_000,
});
export type WorkspaceUsage = {
  documents: number;
  storageBytes: number;
  members: number;
  ocrPages: number;
};
const limitByUsageKey = Object.freeze({
  documents: "documents",
  storageBytes: "storageBytes",
  members: "members",
  ocrPages: "ocrPagesPerMonth",
} as const satisfies Record<keyof WorkspaceUsage, keyof typeof workspaceLimits>);

export function quotaViolation(
  usage: WorkspaceUsage,
  addition: Partial<WorkspaceUsage>,
): string | null {
  // Explicit usage-to-limit pairs: the previous key-intersection loop silently
  // skipped any limit whose name did not match a usage field (e.g. OCR pages).
  for (const key of Object.keys(limitByUsageKey) as Array<keyof WorkspaceUsage>) {
    const used = usage[key] ?? 0;
    const added = addition[key] ?? 0;
    const limit = workspaceLimits[limitByUsageKey[key]];
    if (used + added > limit) return `${key} quota exceeded`;
  }
  return null;
}
