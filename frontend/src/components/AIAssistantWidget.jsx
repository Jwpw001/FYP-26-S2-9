import { useState, useRef, useEffect, useCallback } from "react";
import { getUser } from "../utils/auth";

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

const ACCENT    = "#6366F1";
const BASE_URL  = import.meta.env.VITE_API_URL;

const SUGGESTIONS = {
  manager: [
    "Which shifts this week are understaffed?",
    "Show me pending leave requests",
    "Who has the most hours this week?",
    "Which staff members have barista skills?",
  ],
  business_owner: [
    "Which branch has the most understaffed shifts?",
    "Show me pending leave requests across all branches",
    "What is my total headcount across all branches?",
    "Which branch needs the most attention this week?",
  ],
};

const WELCOME = "Hi! I'm your Krewby AI Workforce Assistant.\n\nI can answer questions about your shifts, staff skills, timesheets, leave requests, and more. What would you like to know?";

function getToken() {
  try {
    const t = localStorage.getItem("token");
    if (t) return t;
    return JSON.parse(localStorage.getItem("user") || "{}").token || null;
  } catch {
    return null;
  }
}


const ACTION_META = {
  approve_leave:        { label: "Approve Leave",     color: "#22C55E", icon: "✓" },
  reject_leave:         { label: "Reject Leave",      color: "#EF4444", icon: "✕" },
  create_draft_shift:   { label: "Create Draft Shift", color: "#6366F1", icon: "+" },
  assign_staff_to_task: { label: "Assign Staff",       color: "#F59E0B", icon: "→" },
};

function describeAction(name, args) {
  if (name === "approve_leave")
    return `Approve ${args.staff_name}'s leave request\nDates: ${args.leave_dates}`;
  if (name === "reject_leave")
    return `Reject ${args.staff_name}'s leave request\nDates: ${args.leave_dates}${args.reason ? `\nReason: ${args.reason}` : ""}`;
  if (name === "create_draft_shift")
    return `Create draft shift: "${args.title}"\nDate: ${args.shift_date}  ·  ${args.start_time}–${args.end_time}`;
  if (name === "assign_staff_to_task")
    return `Assign ${args.staff_name} → "${args.task_name}"\nShift: ${args.shift_title}`;
  return JSON.stringify(args, null, 2);
}

function ActionCard({ msg, onConfirm, onCancel }) {
  const meta = ACTION_META[msg.name] || { label: msg.name, color: ACCENT, icon: "⚡" };
  const [busy, setBusy] = useState(false);

  if (msg.status === "cancelled") {
    return (
      <div style={{ marginBottom: 10, padding: "9px 13px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0", fontSize: 12.5, color: "#94A3B8" }}>
        Action cancelled.
      </div>
    );
  }

  if (msg.status === "done") {
    return (
      <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: "12px", background: "#F0FDF4", border: "1px solid #86EFAC", fontSize: 13, color: "#16A34A", fontWeight: 600 }}>
        ✓ {msg.result}
      </div>
    );
  }

  if (msg.status === "error") {
    return (
      <div style={{ marginBottom: 10, padding: "10px 14px", borderRadius: "12px", background: "#FEF2F2", border: "1px solid #FCA5A5", fontSize: 13, color: "#DC2626" }}>
        ✗ {msg.result}
      </div>
    );
  }

  return (
    <div className="ai-msg" style={{
      marginBottom: 10,
      padding: "12px 14px",
      borderRadius: "12px",
      background: "#FAFAFA",
      border: `1.5px solid ${meta.color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{
          width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
          background: meta.color, display: "flex", alignItems: "center",
          justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 800,
        }}>{meta.icon}</div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {meta.label}
        </span>
      </div>
      <p style={{ fontSize: 12.5, color: "#1E293B", whiteSpace: "pre-wrap", margin: "0 0 10px", lineHeight: 1.5 }}>
        {describeAction(msg.name, msg.args)}
      </p>
      <div style={{ display: "flex", gap: 7 }}>
        <button
          onClick={onCancel}
          style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
        >
          Cancel
        </button>
        <button
          onClick={async () => { setBusy(true); await onConfirm(); setBusy(false); }}
          disabled={busy}
          style={{ flex: 1.4, padding: "7px 0", borderRadius: 8, border: "none", background: meta.color, color: "#fff", fontSize: 12, fontWeight: 700, cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.7 : 1 }}
        >
          {busy ? "Working…" : "Confirm ✓"}
        </button>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "10px 14px" }}>
      {[0, 0.18, 0.36].map((delay, i) => (
        <span key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: "#94A3B8", display: "inline-block",
          animation: `aiTypingDot 1.2s ${delay}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

function Message({ msg, onConfirm, onCancel }) {
  if (msg.role === "tool_call") {
    return <ActionCard msg={msg} onConfirm={onConfirm} onCancel={onCancel} />;
  }
  const isUser = msg.role === "user";
  return (
    <div className="ai-msg" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 10 }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
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
  const user    = getUser();
  const role    = user?.role;
  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.manager;
  const storageKey  = `krewby_ai_chat_${user?.user_id || "guest"}`;
  const briefedKey  = `krewby_ai_briefed_${user?.user_id || "guest"}`;

  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [{ role: "assistant", content: WELCOME }];
  });
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [hasNew,   setHasNew]   = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const autoBriefRef = useRef(false);

  // Persist conversation to localStorage whenever messages change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(messages)); } catch {}
  }, [messages, storageKey]);

  // Auto-brief: on first open of the session with a fresh chat, fetch a proactive brief
  useEffect(() => {
    if (!open) return;
    if (autoBriefRef.current) return;
    if (messages.length !== 1) return;                          // only on fresh chat
    if (!["manager", "business_owner"].includes(role)) return;
    try { if (sessionStorage.getItem(briefedKey)) return; } catch {}

    autoBriefRef.current = true;
    try { sessionStorage.setItem(briefedKey, "1"); } catch {}

    setLoading(true);
    fetch(`${BASE_URL}/api/ai-assistant/brief`, {
      headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.content) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, briefedKey, role]); // messages.length intentionally omitted — we only want this on mount

  useEffect(() => {
    if (open) { setHasNew(false); setTimeout(() => inputRef.current?.focus(), 200); }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const clearChat = useCallback(() => {
    const fresh = [{ role: "assistant", content: WELCOME }];
    setMessages(fresh);
    autoBriefRef.current = false;
    try { sessionStorage.removeItem(briefedKey); } catch {}
    try { localStorage.setItem(storageKey, JSON.stringify(fresh)); } catch {}
  }, [storageKey, briefedKey]);

  async function handleConfirm(index) {
    const msg = messages[index];
    try {
      const resp = await fetch(`${BASE_URL}/api/ai-assistant/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ tool_name: msg.name, args: msg.args }),
      });
      const data = await resp.json();
      setMessages((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: data.success ? "done" : "error", result: data.message };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], status: "error", result: "Action failed. Please try again." };
        return updated;
      });
    }
  }

  function handleCancel(index) {
    setMessages((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: "cancelled" };
      return updated;
    });
  }

  async function send(text) {
    const question = (text || input).trim();
    if (!question || loading) return;
    setInput("");

    const userMsg = { role: "user", content: question };
    const history = messages.filter((m) => m.role !== "system" && m.role !== "tool_call");
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const conversationHistory = history.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const resp = await fetch(`${BASE_URL}/api/ai-assistant/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify({ question, conversationHistory }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Request failed");
      }

      // Add empty assistant bubble to stream into
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      setLoading(false);

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let fullText  = "";
      let gotToolCall = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);

            // Tool call: replace the empty assistant bubble with the action card
            if (parsed.tool_call) {
              gotToolCall = true;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "tool_call",
                  name: parsed.tool_call.name,
                  args: parsed.tool_call.args,
                  status: "pending",
                  result: null,
                };
                return updated;
              });
              break;
            }

            if (parsed.content) {
              fullText += parsed.content;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: fullText };
                return updated;
              });
            }
          } catch {}
        }

        if (gotToolCall) break;
      }

      if (!open) setHasNew(true);
    } catch {
      setLoading(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I'm having trouble connecting right now. Please try again in a moment." },
      ]);
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <>
      {/* FAB */}
      <button
        className={hasNew ? "ai-fab-pulse" : ""}
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "fixed", bottom: 28, right: 28,
          width: 54, height: 54, borderRadius: "50%",
          background: open ? "#475569" : `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
          border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
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

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 92, right: 28,
          width: 360, maxHeight: 520,
          background: "#fff", borderRadius: 18,
          boxShadow: "0 12px 48px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column",
          zIndex: 9998,
          animation: "aiSlideUp 0.28s ease both",
          overflow: "hidden",
          border: "1px solid #E2E8F0",
        }}>

          {/* Header */}
          <div style={{
            background: `linear-gradient(135deg, ${ACCENT} 0%, #8B5CF6 100%)`,
            padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 800, color: "#fff",
            }}>K</div>
            <div style={{ flex: 1 }}>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>AI Workforce Assistant</div>
              <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 11 }}>
                Read-only · Powered by GPT-4o mini
              </div>
            </div>
            <button
              onClick={clearChat}
              title="Clear chat"
              style={{
                background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8,
                padding: "5px 8px", cursor: "pointer",
                fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.03em",
              }}
            >
              Clear
            </button>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1, overflowY: "auto",
            padding: "14px 14px 4px",
            display: "flex", flexDirection: "column",
          }}>
            {messages.map((m, i) => (
              <Message
                key={i}
                msg={m}
                onConfirm={() => handleConfirm(i)}
                onCancel={() => handleCancel(i)}
              />
            ))}
            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
                }}>K</div>
                <div style={{ background: "#F1F5F9", borderRadius: "16px 16px 16px 4px", padding: "2px 4px" }}>
                  <TypingIndicator />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions — only on fresh chat */}
          {messages.length === 1 && (
            <div style={{ padding: "4px 14px 10px", display: "flex", flexWrap: "wrap", gap: 6 }}>
              {suggestions.map((s) => (
                <button key={s} onClick={() => send(s)} style={{
                  background: "#F1F5F9", border: "1px solid #E2E8F0",
                  borderRadius: 20, padding: "5px 11px",
                  fontSize: 11.5, color: "#475569", cursor: "pointer",
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
                >{s}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px", borderTop: "1px solid #F1F5F9",
            display: "flex", alignItems: "flex-end", gap: 8,
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
              placeholder="Ask about shifts, staff, timesheets…"
              disabled={loading}
              style={{
                flex: 1, resize: "none",
                border: "1.5px solid #E2E8F0", borderRadius: 12,
                padding: "9px 12px", fontSize: 13,
                fontFamily: "inherit", outline: "none",
                background: "#F8FAFC", color: "#1E293B",
                lineHeight: 1.4,
                transition: "border-color 0.15s",
                overflow: "hidden",
              }}
              onFocus={(e) => (e.target.style.borderColor = ACCENT)}
              onBlur={(e)  => (e.target.style.borderColor = "#E2E8F0")}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: input.trim() && !loading
                  ? `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`
                  : "#E2E8F0",
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                transition: "background 0.15s, transform 0.1s",
              }}
              onMouseEnter={(e) => { if (input.trim() && !loading) e.currentTarget.style.transform = "scale(1.1)"; }}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={input.trim() && !loading ? "#fff" : "#94A3B8"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

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
