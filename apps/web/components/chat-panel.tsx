"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import {
  AlertCircle,
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  LoaderCircle,
  RotateCcw,
  Sparkles,
  Square,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, type FormEvent } from "react";

const MessageResponse = dynamic(
  () => import("@/components/ai-elements/message").then((module) => module.MessageResponse),
  { ssr: false },
);

const suggestions = [
  "What is our north-star metric?",
  "Summarize the most important product decisions",
  "Which policies mention incident escalation?",
  "What knowledge is missing from these sources?",
];

type SourcePart = Extract<UIMessage["parts"][number], { type: "source-document" }>;

function getMessageText(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getUniqueSources(message: UIMessage): SourcePart[] {
  const seen = new Set<string>();

  return message.parts.filter((part): part is SourcePart => {
    if (part.type !== "source-document") return false;
    const key = (part.title ?? part.sourceId).trim().toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/v1/chat" }), []);
  const { messages, sendMessage, regenerate, status, error, stop } = useChat({ transport });
  const active = status === "submitted" || status === "streaming";
  const latestMessage = messages.at(-1);
  const latestAssistantHasText =
    latestMessage?.role === "assistant" && Boolean(getMessageText(latestMessage).trim());
  const waitingForAnswer =
    status === "submitted" || (status === "streaming" && !latestAssistantHasText);

  const latestSources = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message || message.role !== "assistant") continue;
      const sources = getUniqueSources(message);
      if (sources.length) return sources;
    }
    return [];
  }, [messages]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const text = question.trim();
    if (!text || active) return;
    setQuestion("");
    void sendMessage({ text });
  }

  async function copyAnswer(messageId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      window.setTimeout(() => setCopiedMessageId(null), 1800);
    } catch {
      setCopiedMessageId(null);
    }
  }

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
          {active && (
            <span className="chat-live-status">
              <span aria-hidden="true" /> Answering
            </span>
          )}
        </header>

        <Conversation aria-busy={active}>
          {!messages.length ? (
            <ConversationContent className="chat-empty-shell">
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
            </ConversationContent>
          ) : (
            <ConversationContent className="message-list">
              {messages.map((message, index) => {
                const text = getMessageText(message);
                const sources = getUniqueSources(message);
                const isLatest = index === messages.length - 1;
                const isStreaming = message.role === "assistant" && isLatest && active;
                if (!text && !sources.length) return null;

                return (
                  <article key={message.id} className={`message ${message.role}`}>
                    {message.role === "assistant" && <span className="ai-orb">K</span>}
                    <div className="message-body">
                      {text &&
                        (message.role === "assistant" ? (
                          <MessageResponse
                            isAnimating={isStreaming}
                            mode={isStreaming ? "streaming" : "static"}
                            parseIncompleteMarkdown
                          >
                            {text}
                          </MessageResponse>
                        ) : (
                          <div className="message-text">{text}</div>
                        ))}

                      {!!sources.length && (
                        <div className="message-sources" aria-label="Sources">
                          {sources.map((source) => (
                            <span className="citation-card" key={source.sourceId}>
                              <BookOpen size={13} />
                              <span>{source.title ?? "Source"}</span>
                            </span>
                          ))}
                        </div>
                      )}

                      {message.role === "assistant" && text && !isStreaming && (
                        <div className="message-actions">
                          <button
                            type="button"
                            onClick={() => void copyAnswer(message.id, text)}
                            aria-label="Copy answer"
                            title="Copy answer"
                          >
                            {copiedMessageId === message.id ? (
                              <Check size={14} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                          {isLatest && (
                            <button
                              type="button"
                              onClick={() => void regenerate({ messageId: message.id })}
                              aria-label="Regenerate answer"
                              title="Regenerate answer"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {waitingForAnswer && (
                <div className="message assistant thinking-state" role="status">
                  <span className="ai-orb">K</span>
                  <div className="thinking-copy">
                    <span>
                      <span className="spin" aria-hidden="true">
                        <LoaderCircle size={15} />
                      </span>
                      Finding relevant evidence
                    </span>
                    <small>Kivo is reading your indexed sources…</small>
                  </div>
                </div>
              )}

              {error && (
                <div className="notice error chat-error" role="alert">
                  <AlertCircle size={15} />
                  <span>{error.message}</span>
                  <button type="button" onClick={() => void regenerate()}>
                    Try again
                  </button>
                </div>
              )}
            </ConversationContent>
          )}
          {!!messages.length && (
            <ConversationScrollButton
              aria-label="Scroll to latest message"
              title="Latest message"
            />
          )}
        </Conversation>

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
                title="Stop answer"
              >
                <Square size={14} />
              </button>
            ) : (
              <button
                className="button-primary composer-send"
                disabled={!question.trim()}
                aria-label="Send"
                title="Send"
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
            latestSources.map((source) => (
              <div className="source-item" key={source.sourceId}>
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
