"use client";

import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, BookOpen, LoaderCircle, Search as SearchIcon, Sparkles } from "lucide-react";
import { api } from "@/lib/api-client";

type Collection = { id: string; name: string };
type SearchResult = {
  id: string;
  title: string;
  excerpt: string;
  page: number | null;
  score: number;
};

export default function Search() {
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<{ data: Collection[] }>("/collections")
      .then(({ data }) => setCollections(data))
      .catch(() => undefined);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const response = await api<{ data: SearchResult[] }>("/search", {
        method: "POST",
        body: JSON.stringify({
          query: query.trim(),
          limit: 12,
          collectionIds: collectionId ? [collectionId] : undefined,
        }),
      });
      setResults(response.data);
      setSearched(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p>Hybrid semantic and full-text search across knowledge you can access.</p>
        </div>
      </div>
      <form onSubmit={(event) => void submit(event)} className="search-form glass">
        <SearchIcon size={18} className="muted" />
        <input
          autoFocus
          aria-label="Search knowledge"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “incident escalation policy”"
        />
        <select
          aria-label="Limit search to collection"
          value={collectionId}
          onChange={(event) => setCollectionId(event.target.value)}
        >
          <option value="">All collections</option>
          {collections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
        <button className="button-primary" disabled={loading || query.trim().length < 2}>
          {loading ? <LoaderCircle size={14} /> : <Sparkles size={14} />}
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      {error && (
        <div className="notice error" role="alert">
          <AlertCircle size={15} />
          {error}
        </div>
      )}
      {!searched && !error && (
        <div className="empty-state">
          <div className="feature-icon">
            <SearchIcon size={18} />
          </div>
          <h2>Search every indexed source at once</h2>
          <p className="muted">Results include matching passages, page numbers, and relevance.</p>
        </div>
      )}
      {searched && !results.length && (
        <div className="empty-state">
          <h2>No supported matches</h2>
          <p className="muted">Try broader wording or another collection.</p>
        </div>
      )}
      {!!results.length && (
        <section className="search-results" aria-label="Search results">
          {results.map((result) => (
            <article className="panel search-result" key={result.id}>
              <header>
                <span>
                  <BookOpen size={14} /> {result.title}
                </span>
                <span className="status">{Math.round(result.score * 100)}% match</span>
              </header>
              <p>{result.excerpt}</p>
              <div className="muted">{result.page ? `Page ${result.page}` : "Extracted text"}</div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
