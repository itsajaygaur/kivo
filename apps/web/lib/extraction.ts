import { chunkText, sha256Bytes, type TextChunk } from "@kivo/shared";
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
  let text = "",
    pages: number | null = null;
  if (file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: true })
      .promise;
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
  } else if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const html = (await mammoth.convertToHtml({ arrayBuffer: buffer })).value;
    text = new DOMParser().parseFromString(html, "text/html").body.innerText;
  } else {
    text = new TextDecoder().decode(buffer);
    if (file.type === "text/html")
      text = new DOMParser().parseFromString(text, "text/html").body.textContent ?? "";
    if (file.type === "application/json") text = JSON.stringify(JSON.parse(text), null, 2);
  }
  const normalized = text.trim();
  return {
    text: normalized,
    pages,
    chunks: chunkText(normalized),
    checksum,
    needsOcr:
      file.type === "application/pdf" && normalized.replace(/<!--.*?-->/g, "").trim().length < 80,
  };
}
