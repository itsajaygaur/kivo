import { chunkText, sha256Bytes, type TextChunk } from "@kivo/shared";
const mimeByExtension: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  mdx: "text/markdown",
  html: "text/html",
  htm: "text/html",
  csv: "text/csv",
  json: "application/json",
};
const acceptedMimeTypes = new Set(Object.values(mimeByExtension));
const pageMarker = (page: number) => `\n\n[KIVO_PAGE:${page}]\n\n`;

function extractedLength(value: string) {
  return value.replace(/\[KIVO_PAGE:\d+\]/g, "").trim().length;
}

function htmlToPlainText(source: string) {
  let output = "";
  let suppressed: "script" | "style" | null = null;
  for (let index = 0; index < source.length; index++) {
    const character = source[index];
    if (character === "<") {
      let quote: '"' | "'" | null = null;
      let end = index + 1;
      for (; end < source.length; end++) {
        const tagCharacter = source[end];
        if (quote) {
          if (tagCharacter === quote) quote = null;
        } else if (tagCharacter === '"' || tagCharacter === "'") quote = tagCharacter;
        else if (tagCharacter === ">") break;
      }
      if (end >= source.length) {
        if (!suppressed) output += character;
        continue;
      }
      const rawTag = source
        .slice(index + 1, end)
        .trim()
        .toLowerCase();
      const closing = rawTag.startsWith("/");
      const tagName = rawTag.replace(/^\//, "").match(/^[a-z0-9-]+/)?.[0];
      if (!closing && (tagName === "script" || tagName === "style")) suppressed = tagName;
      else if (closing && tagName === suppressed) suppressed = null;
      if (!suppressed) output += " ";
      index = end;
    } else if (!suppressed) output += character;
  }
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return output
    .replace(/&#(x?[0-9a-f]+);/gi, (_, value: string) => {
      const numeric = value.toLowerCase().startsWith("x")
        ? Number.parseInt(value.slice(1), 16)
        : Number.parseInt(value, 10);
      return Number.isFinite(numeric) && numeric > 0 && numeric <= 0x10ffff
        ? String.fromCodePoint(numeric)
        : "";
    })
    .replace(/&([a-z]+);/gi, (entity, name: string) => namedEntities[name.toLowerCase()] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}
export function detectMimeType(file: File): string {
  if (acceptedMimeTypes.has(file.type)) return file.type;
  return mimeByExtension[file.name.split(".").pop()?.toLowerCase() ?? ""] ?? "text/plain";
}
export type ExtractionResult = {
  text: string;
  pages: number | null;
  chunks: TextChunk[];
  checksum: string;
  needsOcr: boolean;
};
export async function extractDocument(file: File): Promise<ExtractionResult> {
  const buffer = await file.arrayBuffer();
  const checksum = await sha256Bytes(buffer);
  const type = detectMimeType(file);
  let text = "",
    pages: number | null = null;
  if (type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: true })
      .promise;
    if (pdf.numPages > 300) throw new Error("PDF exceeds the 300-page workspace limit.");
    pages = pdf.numPages;
    const output: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      output.push(
        `${pageMarker(pageNumber)}${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}`,
      );
    }
    text = output.join("");
    if (extractedLength(text) < 80) {
      const ocrOutput: string[] = [];
      try {
        for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 100); pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable for OCR.");
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          const image = canvas.toDataURL("image/jpeg", 0.86).split(",")[1];
          const response = await fetch("/api/v1/ocr", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ image }),
          });
          if (!response.ok) throw new Error("OCR is unavailable.");
          const result = (await response.json()) as { response?: string };
          if (result.response) ocrOutput.push(`${pageMarker(pageNumber)}${result.response}`);
        }
        if (ocrOutput.length) text = ocrOutput.join("");
      } catch {
        /* The caller receives needsOcr and can explain that OCR is unavailable. */
      }
    }
  } else if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    text = (await mammoth.extractRawText({ arrayBuffer: buffer })).value;
  } else {
    text = new TextDecoder().decode(buffer);
    if (type === "text/html") text = htmlToPlainText(text);
    if (type === "application/json") text = JSON.stringify(JSON.parse(text), null, 2);
  }
  const normalized = text.trim();
  return {
    text: normalized,
    pages,
    chunks: chunkText(normalized),
    checksum,
    needsOcr: type === "application/pdf" && extractedLength(normalized) < 80,
  };
}
