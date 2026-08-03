export class DeterministicAI {
  async embed(texts: string[]): Promise<number[][]> {
    return Promise.all(
      texts.map(async (text) => {
        const hash = new Uint8Array(
          await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
        );
        return Array.from(
          { length: 1024 },
          (_, index) => (hash[index % hash.length]! - 127.5) / 127.5,
        );
      }),
    );
  }
  rerank(query: string, texts: string[]): number[] {
    const words = new Set(query.toLowerCase().split(/\W+/));
    return texts.map(
      (text) =>
        text
          .toLowerCase()
          .split(/\W+/)
          .filter((word) => words.has(word)).length,
    );
  }
  answer(evidence: string): string {
    return evidence
      ? "The fixture evidence supports this answer. [1]"
      : "I could not find a supported answer.";
  }
}

export class InMemoryVectorIndex {
  private readonly values = new Map<string, number[]>();
  upsert(id: string, vector: number[]): void {
    this.values.set(id, vector);
  }
  query(): string[] {
    return [...this.values.keys()].sort();
  }
  delete(id: string): void {
    this.values.delete(id);
  }
}
