export const workspaceLimits = Object.freeze({
  fileBytes: 25 * 1024 * 1024,
  pagesPerFile: 300,
  documents: 250,
  storageBytes: 500 * 1024 * 1024,
  chunksPerDocument: 1_000,
  members: 25,
  ocrPagesPerMonth: 100,
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
export function quotaViolation(
  usage: WorkspaceUsage,
  addition: Partial<WorkspaceUsage>,
): string | null {
  for (const key of Object.keys(workspaceLimits) as Array<keyof typeof workspaceLimits>) {
    if (!(key in usage)) continue;
    const used = usage[key as keyof WorkspaceUsage] ?? 0;
    const added = addition[key as keyof WorkspaceUsage] ?? 0;
    const limit = workspaceLimits[key];
    if (used + added > limit) return `${key} quota exceeded`;
  }
  return null;
}
