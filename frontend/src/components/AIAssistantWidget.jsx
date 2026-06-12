import { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";

// ─── module-level keyframe injection ───────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("ai-widget-styles")) {
  const s = document.createElement("style");
  s.id = "ai-widget-styles";
  s.textContent = `
    @keyframes aiSlideUp {
      from { opacity: 0; transform: translateY(24px) scale(0.96); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes aiBounceIn {
      0%   { transform: scale(0); opacity: 0; }
      60%  { transform: scale(1.15); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes aiPulseRing {
      0%   { transform: scale(1); opacity: 0.6; }
      100% { transform: scale(1.7); opacity: 0; }
    }
    @keyframes aiTypingDot {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30%            { transform: translateY(-5px); opacity: 1; }
    }
    @keyframes aiFadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .ai-msg { animation: aiFadeIn 0.25s ease both; }
    .ai-fab-pulse::before {
      content: "";
      position: absolute;
      inset: -4px;
      border-radius: 50%;
      background: #6366F1;
      animation: aiPulseRing 2s ease-out infinite;
    }
  `;
  document.head.appendChild(s);
}

const ACCENT = "#6366F1";
const ACCENT_DARK = "#4F46E5";
const SUGGESTIONS = [
  "Which shifts this week are understaffed?",
  "Show me pending leave requests",
  "Summarise pending swap requests",
  "Why was a worker recommended for the last shift?",
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 14px" }}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%", background: "#94A3B8", display: "inline-block",
            animation: `aiTypingDot 1.2s ${delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      className="ai-msg"
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        marginBottom: 10,
      }}
    >
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0, marginRight: 8, marginTop: 2,
        }}>K</div>
      )}
      <div style={{
        maxWidth: "78%",
        background: isUser ? `linear-gradient(135deg, ${ACCENT}, #8B5CF6)` : "#F1F5F9",
        color: isUser ? "#fff" : "#1E293B",
        padding: "9px 13px",
        borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
        fontSize: 13.5,
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        boxShadow: isUser ? "0 2px 8px rgba(99,102,241,0.25)" : "0 1px 4px rgba(0,0,0,0.06)",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AIAssistantWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm your Krewby AI Workforce Assistant 👋\n\nI can answer questions about your shifts, staff availability, leave requests, and more. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setHasNew(false);
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");

    const userMsg = { role: "user", content: question };
    const history = messages.filter((m) => m.role !== "system");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const conversationHistory = history.slice(-8).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const { answer } = await api.post("/ai-assistant/chat", {
        question,
        conversationHistory,
      });
      setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      if (!open) setHasNew(true);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        className={hasNew ? "ai-fab-pulse" : ""}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: open ? "#475569" : `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 20px rgba(99,102,241,0.45)",
          transition: "background 0.2s, transform 0.15s",
          zIndex: 9999,
          animation: "aiBounceIn 0.4s ease both",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title="AI Workforce Assistant"
      >
        {open ? (
          // X icon
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          // Sparkle/AI icon
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z" fill="#fff" />
            <path d="M19 16L19.8 18.2L22 19L19.8 19.8L19 22L18.2 19.8L16 19L18.2 18.2L19 16Z" fill="rgba(255,255,255,0.7)" />
          </svg>
        )}
        {hasNew && (
          <span style={{
            position: "absolute", top: 3, right: 3,
            width: 10, height: 10, borderRadius: "50%",
            background: "#F43F5E", border: "2px solid #fff",
          }} />
        )}
      </button>

      {/* Chat Panel */}
      {open && (
        <div style={{
          position: "fixed",
          bottom: 92,
          right: 28,
          width: 360,
          maxHeight: 520,
          background: "#fff",
          borderRadius: 18,
          boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          zIndex: 9998,
          animation: "aiSlideUp 0.28s ease both",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}>
          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #8B5CF6 100%)`,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#fff",
            }}>K</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AI Workforce Assistant</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>Read-only · Powered by Claude</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 14px 4px",
            display: "flex",
            flexDirection: "column",
          }}>
            {messages.map((m, i) => (
              <Message key={i} msg={m} />
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>K</div>
                <div style={{
                  background: "#F1F5F9", borderRadius: "16px 16px 16px 4px",
                  padding: "2px 4px",
                }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only when no conversation yet) */}
          {messages.length === 1 && (
            <div style={{ padding: "4px 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    background: "#F1F5F9",
                    border: "1px solid #E2E8F0",
                    borderRadius: 20,
                    padding: "5px 11px",
                    fontSize: 11.5,
                    color: "#475569",
                    cursor: "pointer",
                    transition: "background 0.15s, color 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = ACCENT;
                    e.currentTarget.style.color = "#fff";
                    e.currentTarget.style.borderColor = ACCENT;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#F1F5F9";
                    e.currentTarget.style.color = "#475569";
                    e.currentTarget.style.borderColor = "#E2E8F0";
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid #F1F5F9",
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}>
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Ask about shifts, staff, leave..."
              disabled={loading}
              style={{
                flex: 1,
                resize: "none",
                border: "1.5px solid #E2E8F0",
                borderRadius: 12,
                padding: "9px 12px",
                fontSize: 13,
                fontFamily: "inherit",
                outline: "none",
                background: "#F8FAFC",
                color: "#1E293B",
                lineHeight: 1.4,
                transition: "border-color 0.15s",
                overflow: "hidden",
              }}
              onFocus={(e) => (e.target.style.borderColor = ACCENT)}
              onBlur={(e) => (e.target.style.borderColor = "#E2E8F0")}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: input.trim() && !loading
                  ? `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`
                  : "#E2E8F0",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => { if (input.trim() && !loading) e.currentTarget.style.transform = "scale(1.1)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? "#fff" : "#94A3B8"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          {/* Footer note */}
          <div style={{
            textAlign: "center", fontSize: 10.5, color: "#94A3B8",
            paddingBottom: 8, paddingTop: 2,
          }}>
            Read-only assistant · Cannot perform system actions
          </div>
        </div>
      )}
    </>
  );
}
