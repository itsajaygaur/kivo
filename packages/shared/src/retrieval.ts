export function reciprocalRankFusion<T extends { id: string }>(
  lists: readonly (readonly T[])[],
  k = 60,
): Array<T & { score: number }> {
  const scores = new Map<string, { item: T; score: number }>();
  for (const list of lists)
    list.forEach((item, index) => {
      const current = scores.get(item.id) ?? { item, score: 0 };
      current.score += 1 / (k + index + 1);
      scores.set(item.id, current);
    });
  return [...scores.values()]
    .sort((a, b) => b.score - a.score)
    .map(({ item, score }) => ({ ...item, score }));
}

export function boundedEvidence<T extends { content: string }>(
  chunks: readonly T[],
  maxCharacters = 24_000,
): T[] {
  const selected: T[] = [];
  let used = 0;
  for (const chunk of chunks) {
    if (used + chunk.content.length > maxCharacters) continue;
    selected.push(chunk);
    used += chunk.content.length;
  }
  return selected;
}
