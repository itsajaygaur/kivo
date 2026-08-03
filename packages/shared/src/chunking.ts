export type TextChunk = {
  index: number;
  content: string;
  startOffset: number;
  endOffset: number;
  heading: string | null;
};
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .normalize("NFKC")
    .trim();
}
export function chunkText(input: string, target = 1_600, overlap = 240): TextChunk[] {
  const text = normalizeText(input);
  if (!text) return [];
  const chunks: TextChunk[] = [];
  let start = 0;
  let heading: string | null = null;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n\n", end), text.lastIndexOf(". ", end));
      if (boundary > start + target * 0.6) end = boundary + 1;
    }
    const content = text.slice(start, end).trim();
    const match = content.match(/^#{1,6}\s+(.+)$/m);
    if (match?.[1]) heading = match[1].trim();
    if (content)
      chunks.push({ index: chunks.length, content, startOffset: start, endOffset: end, heading });
    if (end === text.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
