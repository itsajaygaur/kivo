"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, File, FileText, Search, Trash2, Upload, X } from "lucide-react";
import { api, ApiError, formatBytes, formatRelativeTime } from "@/lib/api-client";
import { detectMimeType, extractDocument } from "@/lib/extraction";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { StatusStamp } from "@/components/ui/status-stamp";

type DocumentRow = {
  id: string;
  title: string;
  filename: string;
  mimeType: string;
  bytes: number;
  status: string;
  progress: number;
  collectionId: string | null;
  collectionName: string | null;
  updatedAt: number;
};

type Collection = { id: string; name: string };
type Reservation = {
  documentId: string;
  versionId: string;
  upload: { method: "PUT"; url: string } | null;
};

function titleFromFilename(filename: string) {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .trim() || filename
  );
}

function pageForOffset(text: string, offset: number): number | null {
  const markers = [...text.slice(0, offset).matchAll(/\[KIVO_PAGE:(\d+)\]/g)];
  const latest = markers.at(-1)?.[1];
  return latest ? Number(latest) : null;
}

export function DocumentsView() {
  const [open, setOpen] = useState(false);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [documentResponse, collectionResponse] = await Promise.all([
        api<{ data: DocumentRow[]; nextCursor: string | null }>("/documents"),
        api<{ data: Collection[] }>("/collections"),
      ]);
      setDocuments(documentResponse.data);
      setNextCursor(documentResponse.nextCursor ?? null);
      setCollections(collectionResponse.data);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    try {
      const response = await api<{ data: DocumentRow[]; nextCursor: string | null }>(
        `/documents?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setDocuments((current) => {
        const seen = new Set(current.map(({ id }) => id));
        return [...current, ...response.data.filter(({ id }) => !seen.has(id))];
      });
      setNextCursor(response.nextCursor ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load more documents.");
    }
  }, [nextCursor]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!documents.some(({ status }) => ["queued", "indexing", "extracting"].includes(status)))
      return;
    const timer = window.setInterval(() => void load(), 2_500);
    return () => window.clearInterval(timer);
  }, [documents, load]);

  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? documents.filter(
          ({ title, filename, collectionName }) =>
            title.toLowerCase().includes(needle) ||
            filename.toLowerCase().includes(needle) ||
            collectionName?.toLowerCase().includes(needle),
        )
      : documents;
  }, [documents, query]);

  async function uploadOne(file: File) {
    setUploadStatus(`Extracting ${file.name}…`);
    const extracted = await extractDocument(file);
    if (extracted.needsOcr)
      throw new Error(
        `${file.name} appears to be scanned. OCR is not available in this deployment.`,
      );
    if (!extracted.chunks.length) throw new Error(`${file.name} did not contain readable text.`);

    const reservation = await api<Reservation>("/documents", {
      method: "POST",
      headers: { "idempotency-key": `${extracted.checksum}:${file.name}` },
      body: JSON.stringify({
        filename: file.name,
        title: titleFromFilename(file.name),
        mimeType: detectMimeType(file),
        bytes: file.size,
        checksum: extracted.checksum,
        collectionId: collectionId || null,
      }),
    });

    try {
      if (reservation.upload) {
        setUploadStatus(`Storing ${file.name}…`);
        const upload = await fetch(reservation.upload.url, {
          method: "PUT",
          headers: {
            "content-type": detectMimeType(file),
            "x-content-sha256": extracted.checksum,
          },
          body: file,
        });
        if (!upload.ok) {
          const body = (await upload.json().catch(() => null)) as { detail?: string } | null;
          throw new ApiError(body?.detail ?? "Could not store the original file.", upload.status);
        }
      }

      setUploadStatus(`Indexing ${file.name}…`);
      await api("/chunks", {
        method: "POST",
        body: JSON.stringify({
          documentId: reservation.documentId,
          versionId: reservation.versionId,
          checksum: extracted.checksum,
          pages: extracted.pages,
          extractedCharacters: extracted.text.length,
          chunks: extracted.chunks.map((chunk) => ({
            ...chunk,
            page: pageForOffset(extracted.text, chunk.startOffset),
          })),
        }),
      });
    } catch (cause) {
      // Remove the reservation so a failed ingestion does not strand a document
      // in "extracting" while counting against the workspace quota.
      await api(`/documents/${reservation.documentId}`, { method: "DELETE" }).catch(() => {});
      throw cause;
    }
  }

  async function choose(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    setError(null);
    const failures: string[] = [];
    try {
      for (const file of Array.from(list))
        try {
          await uploadOne(file);
        } catch (cause) {
          failures.push(cause instanceof Error ? cause.message : `${file.name} failed to upload.`);
        }
      if (failures.length) setError(failures.join(" "));
      else setOpen(false);
    } finally {
      await load().catch(() => {});
      setUploading(false);
      setUploadStatus(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(document: DocumentRow) {
    try {
      await api(`/documents/${document.id}`, { method: "DELETE" });
      setDocuments((current) => current.filter(({ id }) => id !== document.id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the document.");
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>
            {loading
              ? "Loading knowledge…"
              : `${documents.length}${nextCursor ? "+" : ""} documents in this workspace`}
          </p>
        </div>
        <button className="button-primary" onClick={() => setOpen(true)}>
          <Upload size={14} />
          Upload documents
        </button>
      </div>
      {error && <Notice error>{error}</Notice>}
      <div className="doc-toolbar">
        <label className="search-trigger doc-search">
          <Search size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents"
            aria-label="Search documents"
          />
        </label>
      </div>
      <section className="panel table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Collection</th>
              <th>Size</th>
              <th>Status</th>
              <th>Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleDocuments.map((document) => (
              <tr key={document.id}>
                <td>
                  <div className="doc-cell">
                    <span className="file-icon">
                      <FileText size={14} />
                    </span>
                    <div>
                      {document.title}
                      <div className="muted doc-subname">{document.filename}</div>
                    </div>
                  </div>
                </td>
                <td>{document.collectionName ?? "Unsorted"}</td>
                <td className="muted">{formatBytes(document.bytes)}</td>
                <td>
                  <StatusStamp failed={document.status === "failed"}>
                    {document.status === "ready" ? (
                      <CheckCircle2 size={10} />
                    ) : (
                      <Spinner size={10} />
                    )}
                    {document.status === "indexing"
                      ? `Indexing ${document.progress}%`
                      : document.status}
                  </StatusStamp>
                </td>
                <td className="muted">{formatRelativeTime(document.updatedAt)}</td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${document.title}`}
                    onClick={() => setDeleting(document)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !visibleDocuments.length && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {nextCursor && (
          <div className="load-more">
            <button className="button-secondary" onClick={() => void loadMore()}>
              Load more documents
            </button>
          </div>
        )}
      </section>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        dismissable={!uploading}
        label="Upload documents"
      >
        <div className="upload-head">
          <div>
            <h2>Add knowledge</h2>
            <p className="muted">Files are extracted locally, then securely indexed.</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="icon-button"
            aria-label="Close upload"
            disabled={uploading}
          >
            <X size={14} />
          </button>
        </div>
        <label className="field-label" htmlFor="upload-collection">
          Collection
        </label>
        <select
          id="upload-collection"
          value={collectionId}
          onChange={(event) => setCollectionId(event.target.value)}
          className="field-input"
        >
          <option value="">Unsorted</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <button onClick={() => input.current?.click()} className="upload-drop" disabled={uploading}>
          <span>
            <span className="feature-icon upload-drop-icon">
              {uploading ? <Spinner size={17} /> : <Upload size={17} />}
            </span>
            <b>{uploadStatus ?? "Choose files to upload"}</b>
            <span className="muted">PDF, DOCX, TXT, MD, HTML, CSV, JSON · up to 25 MB</span>
          </span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept=".pdf,.docx,.txt,.md,.mdx,.html,.csv,.json"
          onChange={(event) => void choose(event.target.files)}
        />
        <div className="upload-note muted">
          <File size={12} /> Originals are stored when private object storage is configured.
        </div>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete document"
        description={`Delete “${deleting?.title ?? ""}”? This removes it from future answers.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (deleting) await remove(deleting);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
