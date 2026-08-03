"use client";
import { useRef, useState } from "react";
import {
  CheckCircle2,
  File,
  FileText,
  Filter,
  MoreHorizontal,
  Search,
  Upload,
  X,
} from "lucide-react";
type DocumentRow = [string, string, string, string, string];
const initial: DocumentRow[] = [
  ["Product handbook", "product-handbook.md", "Product & Engineering", "12.6 KB", "Ready"],
  ["Security architecture", "security-architecture.pdf", "Security", "8.4 MB", "Ready"],
  ["Customer research synthesis", "research-synthesis.docx", "Research", "3.8 MB", "Ready"],
  ["Incident response runbook", "incident-response.md", "Operations", "48 KB", "Ready"],
  ["Brand voice guide", "brand-voice.pdf", "Company", "2.1 MB", "Indexing"],
];
export function DocumentsView() {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<DocumentRow[]>(initial);
  const input = useRef<HTMLInputElement>(null);
  function choose(list: FileList | null) {
    if (!list) return;
    setFiles([
      ...Array.from(list).map(
        (f): DocumentRow => [
          f.name,
          f.name,
          "Unsorted",
          `${(f.size / 1024).toFixed(1)} KB`,
          `Extracting`,
        ],
      ),
      ...files,
    ]);
    setOpen(false);
  }
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p>184 documents · 342.8 MB of 500 MB</p>
        </div>
        <button className="button-primary" onClick={() => setOpen(true)}>
          <Upload size={14} />
          Upload documents
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <div className="search-trigger" style={{ width: 300 }}>
          <Search size={14} />
          <input
            placeholder="Search documents"
            style={{
              border: 0,
              outline: 0,
              background: "transparent",
              color: "var(--text)",
              width: "100%",
            }}
          />
        </div>
        <button className="button-secondary">
          <Filter size={13} />
          Filter
        </button>
      </div>
      <section className="panel">
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
            {files.map(([title, name, collection, size, status]) => (
              <tr key={title + name}>
                <td>
                  <div className="doc-cell">
                    <span className="file-icon">
                      <FileText size={14} />
                    </span>
                    <div>
                      {title}
                      <div className="muted" style={{ fontSize: 10, fontWeight: 400 }}>
                        {name}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{collection}</td>
                <td className="muted">{size}</td>
                <td>
                  <span
                    className="status"
                    style={status !== "Ready" ? { color: "var(--accent)" } : undefined}
                  >
                    {status === "Ready" ? (
                      <CheckCircle2 size={10} />
                    ) : (
                      <span className="eyebrow-dot" />
                    )}
                    {status}
                  </span>
                </td>
                <td className="muted">12 min ago</td>
                <td>
                  <MoreHorizontal size={14} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Upload documents"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "grid",
            placeItems: "center",
            background: "rgb(0 0 0/.42)",
            backdropFilter: "blur(5px)",
          }}
        >
          <div
            className="panel"
            style={{ width: "min(520px,90vw)", padding: 22, boxShadow: "0 30px 100px #0005" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18 }}>Add knowledge</h2>
                <p className="muted" style={{ fontSize: 12 }}>
                  Files are extracted locally before indexing.
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="button-secondary"
                style={{ padding: 7 }}
              >
                <X size={14} />
              </button>
            </div>
            <button
              onClick={() => input.current?.click()}
              style={{
                width: "100%",
                height: 210,
                border: "1px dashed var(--line)",
                borderRadius: 12,
                background: "var(--surface-2)",
                marginTop: 18,
                display: "grid",
                placeItems: "center",
              }}
            >
              <span>
                <span className="feature-icon" style={{ margin: "auto" }}>
                  <Upload size={17} />
                </span>
                <b style={{ display: "block", marginTop: 12 }}>Drop files here or browse</b>
                <span className="muted" style={{ display: "block", fontSize: 11, marginTop: 5 }}>
                  PDF, DOCX, TXT, MD, HTML, CSV, JSON · up to 25 MB
                </span>
              </span>
            </button>
            <input
              ref={input}
              type="file"
              multiple
              hidden
              accept=".pdf,.docx,.txt,.md,.mdx,.html,.csv,.json"
              onChange={(e) => choose(e.target.files)}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: 15,
                fontSize: 11,
              }}
            >
              <span className="muted">
                <File size={12} style={{ display: "inline" }} /> Originals remain private
              </span>
              <span>342.8 MB / 500 MB</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
