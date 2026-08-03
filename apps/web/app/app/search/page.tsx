import { Search as SearchIcon, Sparkles } from "lucide-react";
export default function Search() {
  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p>Hybrid semantic and full-text search across authorized knowledge.</p>
        </div>
      </div>
      <div className="glass" style={{ borderRadius: 12, padding: 12, display: "flex", gap: 10 }}>
        <SearchIcon size={18} className="muted" />
        <input
          autoFocus
          aria-label="Search knowledge"
          placeholder="Try “incident escalation policy”"
          style={{
            flex: 1,
            border: 0,
            outline: 0,
            background: "transparent",
            fontSize: 15,
            color: "var(--text)",
          }}
        />
        <button className="button-primary">
          <Sparkles size={14} />
          Search
        </button>
      </div>
      <div style={{ textAlign: "center", marginTop: 110 }}>
        <div className="feature-icon" style={{ margin: "auto" }}>
          <SearchIcon size={18} />
        </div>
        <h2 style={{ fontSize: 17 }}>Search every source at once</h2>
        <p className="muted">
          Results include matching passages, page numbers, and why they ranked.
        </p>
      </div>
    </div>
  );
}
