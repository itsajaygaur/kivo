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
        `\n\n<!-- page:${pageNumber} -->\n\n${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}`,
      );
    }
    text = output.join("");
    if (text.replace(/<!--.*?-->/g, "").trim().length < 80) {
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
          if (result.response)
            ocrOutput.push(`\n\n<!-- page:${pageNumber} -->\n\n${result.response}`);
        }
        if (ocrOutput.length) text = ocrOutput.join("");
      } catch {
        /* The caller receives needsOcr and can explain that OCR is unavailable. */
      }
    }
  } else if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const mammoth = await import("mammoth");
    const html = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
    text = new DOMParser().parseFromString(html, "text/html").body.innerText;
  } else {
    text = new TextDecoder().decode(buffer);
    if (type === "text/html")
      text = new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
    if (type === "application/json") text = JSON.stringify(JSON.parse(text), null, 2);
  }
  const normalized = text.trim();
  return {
    text: normalized,
    pages,
    chunks: chunkText(normalized),
    checksum,
    needsOcr:
      type === "application/pdf" && normalized.replace(/<!--.*?-->/g, "").trim().length < 80,
  };
}
