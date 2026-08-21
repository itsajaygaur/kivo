"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { BookOpen, Search as SearchIcon } from "lucide-react";
import { api } from "@/lib/api-client";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";
import { Spinner } from "@/components/ui/spinner";
import { StatusStamp } from "@/components/ui/status-stamp";

type Collection = { id: string; name: string };
type SearchResult = {
  id: string;
  title: string;
  excerpt: string;
  page: number | null;
  score: number;
};

function SearchView() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
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

  const runSearch = useCallback(
    async (term: string, scope: string) => {
      if (term.trim().length < 2) return;
      setLoading(true);
      setError(null);
      try {
        const response = await api<{ data: SearchResult[] }>("/search", {
          method: "POST",
          body: JSON.stringify({
            query: term.trim(),
            limit: 12,
            collectionIds: scope ? [scope] : undefined,
          }),
        });
        setResults(response.data);
        setSearched(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Search failed.");
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setError, setResults, setSearched],
  );

  // Command-palette hand-off: /app/search?q=… runs the query on arrival.
  const initialQuery = params.get("q");
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length >= 2) void runSearch(initialQuery, "");
  }, [initialQuery, runSearch]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch(query, collectionId);
  }

  return (
    <div className="content">
      <div className="page-head">
        <div>
          <h1>Search</h1>
          <p>Hybrid semantic and full-text search across knowledge you can access.</p>
        </div>
      </div>
      <form onSubmit={submit} className="search-form">
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
          {loading ? <Spinner /> : <SearchIcon size={14} />}
          {loading ? "Searching…" : "Search"}
        </button>
      </form>
      {error && <Notice error>{error}</Notice>}
      {!searched && !error && (
        <EmptyState icon={SearchIcon} title="Search every indexed source at once">
          Results include matching passages, page numbers, and relevance.
        </EmptyState>
      )}
      {searched && !results.length && (
        <EmptyState title="No supported matches">
          Try broader wording or another collection.
        </EmptyState>
      )}
      {!!results.length && (
        <section className="search-results" aria-label="Search results">
          {results.map((result) => (
            <article className="search-result" key={result.id}>
              <header>
                <span>
                  <BookOpen size={14} /> {result.title}
                </span>
                <StatusStamp>{Math.round(result.score * 100)}% match</StatusStamp>
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

export default function Search() {
  return (
    <Suspense>
      <SearchView />
    </Suspense>
  );
}
