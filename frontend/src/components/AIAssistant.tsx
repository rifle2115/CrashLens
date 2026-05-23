"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { getActiveSessionId, chatWithAI, type ChatMessage } from "@/lib/api";

const QUICK_PROMPTS = [
  "Summarize the key issues",
  "What caused the critical errors?",
  "Suggest fixes for the top errors",
  "Are there any recurring patterns?",
];

function BotIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
      <line x1="12" y1="3" x2="12" y2="7" />
      <circle cx="9" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "#58a6ff",
            animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`@keyframes bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-6px)}}`}</style>
    </div>
  );
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSessionId(getActiveSessionId());
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Open from anywhere via window.dispatchEvent(new CustomEvent("crashlens:open-ai"))
  useEffect(() => {
    const handler = (e: Event) => {
      setSessionId(getActiveSessionId());
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) setPendingPrompt(prompt);
    };
    window.addEventListener("crashlens:open-ai", handler);
    return () => window.removeEventListener("crashlens:open-ai", handler);
  }, []);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const snapshot = messages;
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    // Add empty assistant bubble to stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    try {
      await chatWithAI(msg, snapshot, sessionId, (chunk) => {
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return [...prev.slice(0, -1), { role: "assistant", content: last.content + chunk }];
          }
          return prev;
        });
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Request failed";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.content === "") {
          return [...prev.slice(0, -1), { role: "assistant", content: `Sorry — ${detail}` }];
        }
        return prev;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, sessionId]);

  // Fire a queued prompt once the panel is open and the session is resolved
  useEffect(() => {
    if (open && pendingPrompt) {
      send(pendingPrompt);
      setPendingPrompt(null);
    }
  }, [open, pendingPrompt, send]);

  const isEmpty = messages.length === 0;

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            bottom: 90,
            right: 24,
            width: 390,
            height: "min(540px, calc(100vh - 110px))",
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 12px 48px rgba(0,0,0,0.6)",
            zIndex: 1000,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 18px",
              borderBottom: "1px solid #21262d",
              background: "#0d1117",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg, #1f6feb, #58a6ff)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                flexShrink: 0,
              }}
            >
              <BotIcon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#e6edf3" }}>
                CrashLens AI
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#484f58",
                fontSize: 22,
                lineHeight: 1,
                padding: "2px 4px",
                display: "flex",
              }}
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              scrollbarWidth: "thin",
              scrollbarColor: "#30363d transparent",
            }}
          >
            {/* Welcome state */}
            {isEmpty && (
              <div style={{ color: "#8b949e", padding: "20px 4px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg, #1f6feb22, #58a6ff22)", border: "1px solid #1f6feb44", display: "flex", alignItems: "center", justifyContent: "center", color: "#58a6ff", flexShrink: 0 }}>
                    <BotIcon size={18} />
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 13.5, color: "#e6edf3" }}>CrashLens AI</p>
                    <p style={{ margin: 0, fontSize: 11.5, color: "#484f58" }}>Powered by Groq</p>
                  </div>
                </div>
                {sessionId ? (
                  <>
                    <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.6 }}>
                      Log loaded. Pick a question or type your own:
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {QUICK_PROMPTS.map((p) => (
                        <button key={p} onClick={() => send(p)} disabled={loading}
                          style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: "#21262d", border: "1px solid #30363d", color: "#e6edf3", cursor: "pointer", textAlign: "left" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7 }}>
                    Upload a log file first, then I can analyze it for you.
                  </p>
                )}
              </div>
            )}

            {/* Message bubbles */}
            {messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.role === "user" ? "flex-end" : "flex-start",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: "#484f58",
                    paddingLeft: msg.role === "assistant" ? 4 : 0,
                    paddingRight: msg.role === "user" ? 4 : 0,
                  }}
                >
                  {msg.role === "user" ? "You" : "CrashLens AI"}
                </div>
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "10px 14px",
                    borderRadius:
                      msg.role === "user"
                        ? "14px 14px 4px 14px"
                        : "14px 14px 14px 4px",
                    background: msg.role === "user" ? "#1f6feb" : "#21262d",
                    color: msg.role === "user" ? "#fff" : "#e6edf3",
                    fontSize: 13,
                    lineHeight: 1.65,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {/* Dots only while the first token hasn't arrived yet */}
            {loading && messages[messages.length - 1]?.content === "" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
                <TypingDots />
                <span style={{ fontSize: 11, color: "#484f58" }}>thinking…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick prompts — show only when there are messages and session is active */}
          {!isEmpty && sessionId && !loading && (
            <div
              style={{
                padding: "0 14px 10px",
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 20,
                    fontSize: 11.5,
                    background: "transparent",
                    border: "1px solid #30363d",
                    color: "#8b949e",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div
            style={{
              padding: "10px 14px 14px",
              borderTop: "1px solid #21262d",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={
                sessionId
                  ? "Ask anything about your logs…"
                  : "Upload a log to start analyzing…"
              }
              disabled={!sessionId && isEmpty}
              style={{
                flex: 1,
                padding: "9px 13px",
                borderRadius: 10,
                background: "#0d1117",
                border: "1px solid #30363d",
                color: "#e6edf3",
                fontSize: 13,
                outline: "none",
                opacity: !sessionId && isEmpty ? 0.5 : 1,
              }}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background:
                  loading || !input.trim()
                    ? "#21262d"
                    : "linear-gradient(135deg, #1f6feb, #388bfd)",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                color: loading || !input.trim() ? "#484f58" : "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <SendIcon />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
