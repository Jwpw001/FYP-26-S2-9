import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { AlertTriangle, Clock, ChevronRight, CheckCircle2 } from "lucide-react";

// Round 6, Task 7a: gaps view — every unfilled task across the manager's branch, grouped by
// urgency. Order is deliberate (most urgent first); "Tomorrow" also absorbs today/overdue since
// the round spec only names these four buckets (see taskController.js's urgencyBucket for why).
const URGENCY_ORDER = ["Tomorrow", "This week", "Next week", "Later"];
const URGENCY_STYLE = {
  "Tomorrow":  { color: "#B91C1C", bg: "#FEF2F2", border: "#FECACA" },
  "This week": { color: "#B45309", bg: "#FFFBEB", border: "#FDE68A" },
  "Next week": { color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE" },
  "Later":     { color: "#475569", bg: "#F8FAFC", border: "#E2E8F0" },
};

function fmtDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function Shimmer({ h = "64px" }) {
  return <div style={{ width: "100%", height: h, borderRadius: "12px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

if (typeof document !== "undefined" && !document.getElementById("manager-gaps-styles")) {
  const style = document.createElement("style");
  style.id = "manager-gaps-styles";
  style.textContent = `@keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }`;
  document.head.appendChild(style);
}

export default function Gaps() {
  const navigate = useNavigate();
  const [gaps, setGaps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/shifts/gaps");
        if (!cancelled) setGaps(res.gaps || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Couldn't load unfilled tasks.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = URGENCY_ORDER.map(urgency => ({
    urgency,
    tasks: gaps.filter(g => g.urgency === urgency),
  })).filter(g => g.tasks.length > 0);

  return (
    <ManagerLayout title="Gaps">
      <div>
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Unfilled tasks</h2>
          <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
            Every open task on an upcoming shift, grouped by how soon it needs a person.
          </p>
        </div>

        {error && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "14px 18px", marginBottom: "20px", color: "#B91C1C", fontSize: "19px" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => <Shimmer key={i} />)}
          </div>
        ) : gaps.length === 0 ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "14px", padding: "40px", textAlign: "center" }}>
            <CheckCircle2 size={32} color="#22C55E" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: "21px", fontWeight: "700", color: "#166534" }}>No gaps right now</p>
            <p style={{ fontSize: "19px", color: "#64748B", marginTop: "4px" }}>Every upcoming task has someone assigned.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {grouped.map(({ urgency, tasks }) => {
              const style = URGENCY_STYLE[urgency];
              return (
                <div key={urgency}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <AlertTriangle size={16} color={style.color} />
                    <h3 style={{ fontSize: "21px", fontWeight: "800", color: style.color }}>{urgency}</h3>
                    <span style={{ fontSize: "17px", fontWeight: "700", color: style.color, background: style.bg, border: `1px solid ${style.border}`, borderRadius: "999px", padding: "2px 10px" }}>
                      {tasks.length}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {tasks.map(t => (
                      <button key={t.task_id} onClick={() => navigate(`/manager/shifts/${t.shift_id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "14px", background: "#FFF", border: `1.5px solid ${style.border}`, borderRadius: "12px", padding: "14px 18px", cursor: "pointer", textAlign: "left", width: "100%" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>
                            {t.title}
                            {t.skill && (
                              <span style={{ fontSize: "16px", fontWeight: "600", color: "#7C3AED", background: "#F5F3FF", borderRadius: "6px", padding: "2px 8px", marginLeft: "8px" }}>
                                {t.skill.name}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: "17px", color: "#64748B", marginTop: "2px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={13} />
                            {fmtDate(t.shift_date)} · {t.start_time?.slice(0, 5)}–{t.end_time?.slice(0, 5)}{t.shift_title ? ` · ${t.shift_title}` : ""}
                          </div>
                        </div>
                        <ChevronRight size={18} color="#94A3B8" />
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}
