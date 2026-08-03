"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertCircle, ArrowUp, BookOpen, LoaderCircle, Sparkles, Square } from "lucide-react";

const suggestions = [
  "What is our north-star metric?",
  "Summarize the most important product decisions",
  "Which policies mention incident escalation?",
  "What knowledge is missing from these sources?",
];

export function ChatPanel() {
  const [question, setQuestion] = useState("");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/v1/chat" }), []);
  const { messages, sendMessage, status, error, stop } = useChat({ transport });
  const active = status === "submitted" || status === "streaming";

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = question.trim();
    if (!text || active) return;
    setQuestion("");
    void sendMessage({ text });
  }

  const latestSources = [...messages]
    .reverse()
    .flatMap((message) =>
      message.role === "assistant"
        ? message.parts.filter((part) => part.type === "source-document")
        : [],
    );

  return (
    <div className="chat-layout">
      <section className="chat-main">
        <header className="chat-header">
          <div>
            <h1>Ask Kivo</h1>
            <p className="muted">
              Answers use only indexed sources available to your workspace role.
            </p>
          </div>
        </header>
        <div className="chat-scroll" aria-live="polite">
          {!messages.length ? (
            <div className="chat-empty">
              <div className="logo-mark">K</div>
              <h2>What would you like to understand?</h2>
              <p className="muted">
                Ask across your workspace and inspect the sources behind the answer.
              </p>
              <div className="suggestion-grid">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    className="button-secondary"
                    onClick={() => setQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message) => {
                const text = message.parts
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join("");
                const sources = message.parts.filter((part) => part.type === "source-document");
                if (!text && !sources.length) return null;
                return (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role === "assistant" && <span className="ai-orb">K</span>}
                    <div>
                      {text && <div className="message-text">{text}</div>}
                      {!!sources.length && (
                        <div className="message-sources">
                          {sources.map((source, index) => (
                            <span className="citation-card" key={`${source.sourceId}:${index}`}>
                              <BookOpen size={12} /> {source.title ?? "Source"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
              {status === "submitted" && (
                <div className="message assistant">
                  <span className="ai-orb">K</span>
                  <div className="muted">
                    <LoaderCircle size={14} /> Finding evidence…
                  </div>
                </div>
              )}
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              <AlertCircle size={15} />
              {error.message}
            </div>
          )}
        </div>
        <form onSubmit={submit} className="chat-composer-wrap">
          <div className="glass chat-composer">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything in your knowledge base…"
              aria-label="Question"
              rows={2}
            />
            {active ? (
              <button
                type="button"
                className="button-secondary composer-send"
                onClick={() => stop()}
                aria-label="Stop answer"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                className="button-primary composer-send"
                disabled={!question.trim()}
                aria-label="Send"
              >
                <ArrowUp size={16} />
              </button>
            )}
          </div>
          <p className="muted">
            Kivo can make mistakes. Verify important claims in the cited source.
          </p>
        </form>
      </section>
      <aside className="chat-aside">
        <div className="panel-head">
          <h2>Current evidence</h2>
          <Sparkles size={14} className="muted" />
        </div>
        <div className="source-list">
          {latestSources.length ? (
            latestSources.map((source, index) => (
              <div className="source-item" key={`${source.sourceId}:${index}`}>
                <BookOpen size={14} />
                <span>{source.title ?? "Indexed source"}</span>
              </div>
            ))
          ) : (
            <p className="muted">Sources used by the latest answer will appear here.</p>
          )}
        </div>
      </aside>
    </div>
  );
}
