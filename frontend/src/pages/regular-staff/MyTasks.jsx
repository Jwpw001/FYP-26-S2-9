import { useState, useEffect } from "react";
import StaffLayout from "../../components/layout/StaffLayout";
import { api } from "../../lib/api";
import { Calendar, Flag, FolderKanban, CheckCircle2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-tasks-styles")) {
  const style = document.createElement("style");
  style.id = "staff-tasks-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .staff-task-card { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
    .staff-task-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(15,23,42,0.1) !important; border-color: #C7D2FE !important; }
    .staff-task-select:focus { outline: none; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
  `;
  document.head.appendChild(style);
}

const STATUS_META = {
  todo:        { label: "To Do",       color: "#64748B", bg: "#F1F5F9" },
  in_progress: { label: "In Progress", color: "#1D4ED8", bg: "#DBEAFE" },
  review:      { label: "Review",      color: "#B45309", bg: "#FEF3C7" },
  done:        { label: "Done",        color: "#166534", bg: "#DCFCE7" },
};

const PRIORITY_META = {
  low:    { label: "Low",    color: "#64748B" },
  medium: { label: "Medium", color: "#B45309" },
  high:   { label: "High",   color: "#B91C1C" },
  urgent: { label: "Urgent", color: "#6D28D9" },
};

const TABS = [
  { value: "open", label: "Open" },
  { value: "all",  label: "All" },
  { value: "done", label: "Done" },
];

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("open");
  const [savingId, setSavingId] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/api/flex/my-tasks");
      setTasks(r.tasks || []);
    } catch { } finally { setLoading(false); }
  }

  async function updateStatus(task_id, status) {
    setSavingId(task_id);
    try {
      await api.patch(`/api/flex/tasks/${task_id}`, { status });
      setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, status } : t));
    } catch { } finally { setSavingId(null); }
  }

  const displayed = tasks.filter(t => {
    if (filter === "open") return t.status !== "done";
    if (filter === "done") return t.status === "done";
    return true;
  });
  const openCount = tasks.filter(t => t.status !== "done").length;
  const doneCount = tasks.filter(t => t.status === "done").length;

  const selStyle = { padding: "6px 10px", borderRadius: "8px", border: "1.5px solid transparent", fontSize: "11.5px", fontWeight: "700", cursor: "pointer", outline: "none", fontFamily: "inherit" };

  return (
    <StaffLayout title="My Tasks">
      <div style={{ padding: "28px 32px", animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", marginBottom: "4px", letterSpacing: "-0.01em" }}>My Tasks</h2>
            <p style={{ fontSize: "13px", color: "#64748B" }}>{openCount} open · {doneCount} completed across your projects</p>
          </div>
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {TABS.map(t => (
              <button key={t.value} onClick={() => setFilter(t.value)}
                style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "12.5px", fontWeight: filter === t.value ? "700" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: "150px", borderRadius: "16px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E8EDF5", borderRadius: "16px", padding: "72px", textAlign: "center" }}>
            <p style={{ fontSize: "36px", marginBottom: "12px", display: "flex", justifyContent: "center" }}><CheckCircle2 size={36} color="#16A34A" /></p>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>
              {filter === "done" ? "No completed tasks yet." : "Nothing assigned to you right now."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
            {displayed.map((t, i) => {
              const st = STATUS_META[t.status] || STATUS_META.todo;
              const pm = PRIORITY_META[t.priority] || PRIORITY_META.medium;
              const overdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
              const color = t.projects?.color || "#6366F1";
              return (
                <div key={t.task_id} className="staff-task-card"
                  style={{ background: "#fff", border: "1px solid #E8EDF5", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.35s ease ${i * 0.05}s both`, display: "flex", flexDirection: "column" }}>

                  <div style={{ height: "5px", background: `linear-gradient(90deg, ${color}, ${color}99)` }} />

                  <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
                    {t.projects && (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "8px" }}>
                        <FolderKanban size={12} color={color} />
                        <span style={{ fontSize: "11px", fontWeight: "700", color }}>{t.projects.name}</span>
                      </div>
                    )}

                    <p style={{ fontSize: "14.5px", fontWeight: "700", color: "#0F172A", marginBottom: "5px", lineHeight: 1.35 }}>{t.title}</p>
                    {t.description && (
                      <p style={{ fontSize: "12.5px", color: "#64748B", lineHeight: 1.55, marginBottom: "12px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{t.description}</p>
                    )}

                    <div style={{ flex: 1 }} />

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: "700", color: pm.color }}>
                        <Flag size={11} />{pm.label}
                      </span>
                      {t.due_date && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: "700", color: overdue ? "#DC2626" : "#94A3B8" }}>
                          <Calendar size={11} />{overdue ? "Overdue · " : ""}{new Date(t.due_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>

                    <select className="staff-task-select" value={t.status} disabled={savingId === t.task_id} onChange={e => updateStatus(t.task_id, e.target.value)}
                      style={{ ...selStyle, color: st.color, background: st.bg, width: "100%" }}>
                      {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
