"use client";
import { useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  RotateCcw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
export function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState(false);
  const submit = () => {
    if (question.trim()) setAsked(true);
  };
  return (
    <div
      style={{
        height: "calc(100vh - 61px)",
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) 290px",
      }}
    >
      <section style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header
          style={{
            padding: "22px 28px",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h1 style={{ fontSize: 16, margin: 0 }}>Product knowledge</h1>
            <p className="muted" style={{ fontSize: 11, margin: "4px 0 0" }}>
              6 collections · 184 documents
            </p>
          </div>
          <button className="button-secondary" style={{ fontSize: 11 }}>
            <BookOpen size={13} />
            Scope sources
          </button>
        </header>
        <div
          style={{ flex: 1, overflow: "auto", padding: "38px max(24px, calc((100% - 760px)/2))" }}
        >
          {!asked ? (
            <div style={{ maxWidth: 650, margin: "12vh auto 0", textAlign: "center" }}>
              <div
                className="logo-mark"
                style={{ margin: "auto", width: 42, height: 42, borderRadius: 13 }}
              >
                K
              </div>
              <h2 style={{ fontSize: 26, letterSpacing: "-.045em", margin: "18px 0 8px" }}>
                What would you like to understand?
              </h2>
              <p className="muted">
                Ask across your workspace. Kivo will only use sources you can access.
              </p>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  marginTop: 32,
                  textAlign: "left",
                }}
              >
                {[
                  "Summarize our Q3 product strategy",
                  "How do we handle a P1 incident?",
                  "What did customers say about search?",
                  "Compare the latest security policies",
                ].map((x) => (
                  <button
                    key={x}
                    className="button-secondary"
                    onClick={() => setQuestion(x)}
                    style={{ justifyContent: "flex-start", fontSize: 12, padding: 12 }}
                  >
                    {x}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ maxWidth: 720, margin: "auto" }}>
              <div className="demo-question" style={{ width: "fit-content" }}>
                {question}
              </div>
              <div className="demo-answer" style={{ marginTop: 34 }}>
                <span className="ai-orb">K</span>
                <div>
                  <div className="answer-text" style={{ fontSize: 14 }}>
                    Our Q3 product strategy concentrates on <b>verified knowledge outcomes</b>{" "}
                    rather than increasing raw chat volume. The team committed to improving citation
                    precision, reducing time-to-first-answer below three seconds, and making
                    collection permissions visible at the point of use.{" "}
                    <span style={{ color: "var(--accent)" }}>[1]</span>
                    <br />
                    <br />
                    The operating metric is weekly verified answers: a teammate opens an answer and
                    confirms it against at least one cited source. This was chosen because it
                    couples usefulness with trust.{" "}
                    <span style={{ color: "var(--accent)" }}>[2]</span>
                  </div>
                  <div className="citation-card">
                    <b style={{ color: "var(--text)" }}>1 · Q3 product strategy</b> · page 6<br />
                    “Focus the roadmap on verifiable outcomes…”
                  </div>
                  <div className="citation-card">
                    <b style={{ color: "var(--text)" }}>2 · Product handbook</b> · page 4<br />
                    “Weekly verified answers measure useful, trusted knowledge…”
                  </div>
                  <div style={{ display: "flex", gap: 5, marginTop: 14 }}>
                    {[Copy, ThumbsUp, ThumbsDown, RotateCcw].map((Icon, i) => (
                      <button
                        key={i}
                        className="button-secondary"
                        style={{ padding: 7 }}
                        aria-label="Answer action"
                      >
                        <Icon size={13} />
                      </button>
                    ))}
                    <span className="muted" style={{ fontSize: 10, margin: "auto 0 auto auto" }}>
                      <Check size={11} style={{ display: "inline" }} /> High confidence · 2.1s
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px max(24px, calc((100% - 760px)/2)) 22px" }}>
          <div
            className="glass"
            style={{
              borderRadius: 14,
              padding: 8,
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="Ask anything in your knowledge base…"
              aria-label="Question"
              rows={2}
              style={{
                flex: 1,
                resize: "none",
                border: 0,
                outline: 0,
                background: "transparent",
                padding: 8,
                color: "var(--text)",
              }}
            />
            <button
              className="button-primary"
              onClick={submit}
              style={{ width: 34, height: 34, padding: 0 }}
              aria-label="Send"
            >
              <ArrowUp size={16} />
            </button>
          </div>
          <p className="muted" style={{ fontSize: 10, textAlign: "center", margin: "7px 0 0" }}>
            Kivo can make mistakes. Verify important claims in the cited source.
          </p>
        </div>
      </section>
      <aside
        style={{ borderLeft: "1px solid var(--line)", padding: 18, background: "var(--surface)" }}
      >
        <div style={{ fontWeight: 650, fontSize: 12, marginBottom: 16 }}>Conversation</div>
        <div className="side-link active">
          <Sparkles />
          <span>Q3 product strategy</span>
        </div>
        <div className="side-link">
          <BookOpen />
          <span>Sources in scope</span>
        </div>
        <div className="panel" style={{ padding: 14, marginTop: 20 }}>
          <div
            className="muted"
            style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".06em" }}
          >
            Evidence coverage
          </div>
          <div style={{ fontSize: 22, fontWeight: 680, margin: "8px 0" }}>94%</div>
          <div style={{ height: 5, borderRadius: 5, background: "var(--surface-2)" }}>
            <div
              style={{
                height: "100%",
                width: "94%",
                background: "var(--success)",
                borderRadius: 5,
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
