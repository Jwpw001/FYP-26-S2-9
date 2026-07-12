import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";
import { Calendar, Clock, ChevronDown, ChevronUp } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-tasks-styles")) {
  const style = document.createElement("style");
  style.id = "casual-tasks-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const PRIORITY_MAP = {
  urgent: { bg: "#FEE2E2", color: "#991B1B" },
  high:   { bg: "#FFEDD5", color: "#9A3412" },
  medium: { bg: "#FEF9C3", color: "#854D0E" },
  low:    { bg: "#DCFCE7", color: "#166534" },
};

const STATUS_MAP = {
  todo:        { bg: "#F1F5F9", color: "#475569", label: "To Do" },
  in_progress: { bg: "#DBEAFE", color: "#1E40AF", label: "In Progress" },
  done:        { bg: "#DCFCE7", color: "#166534", label: "Done" },
};

const STATUS_SEQ = ["todo", "in_progress", "done"];

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

export default function CasualTasks() {
  const user   = getUser();
  const userId = user?.user_id;

  const [tasks,          setTasks]          = useState([]);
  const [staffId,        setStaffId]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState("upcoming");
  const [saving,         setSaving]         = useState(null);
  const [logOpen,        setLogOpen]        = useState({});
  const [logData,        setLogData]        = useState({});
  const [taskTimesheets, setTaskTimesheets] = useState({});
  const [logSaving,      setLogSaving]      = useState(null);
  const [toast,          setToast]          = useState(null);

  const today = new Date().toISOString().split("T")[0];

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), ok ? 3000 : 5000);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: staffRows } = await supabase
          .from("staff").select("staff_id").eq("user_id", userId).limit(1);
        const sid = staffRows?.[0]?.staff_id || null;
        if (!cancelled) setStaffId(sid);

        const { data: taskRows, error } = await supabase
          .from("tasks")
          .select("task_id, title, description, status, priority, due_date, created_at")
          .eq("assigned_to", userId)
          .order("due_date", { ascending: true, nullsFirst: false });

        if (error) throw error;
        if (!cancelled) setTasks(taskRows || []);

        if (sid && taskRows?.length) {
          const taskIds = taskRows.map(t => t.task_id);
          const { data: tsRows } = await supabase
            .from("timesheets")
            .select("timesheet_id, task_id, log_date, hours_worked, description, status")
            .eq("staff_id", sid)
            .in("task_id", taskIds)
            .order("log_date", { ascending: false });

          if (!cancelled) {
            const grouped = {};
            for (const ts of (tsRows || [])) {
              if (!grouped[ts.task_id]) grouped[ts.task_id] = [];
              grouped[ts.task_id].push(ts);
            }
            setTaskTimesheets(grouped);
          }
        }
      } catch (err) {
        console.error(err);
        showToast("Failed to load tasks.", false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function updateStatus(task, newStatus) {
    setSaving(task.task_id);
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("task_id", task.task_id);
      if (error) throw error;
      setTasks(prev => prev.map(t => t.task_id === task.task_id ? { ...t, status: newStatus } : t));
      showToast(newStatus === "done" ? "Task marked as done!" : `Status updated to ${STATUS_MAP[newStatus].label}.`);
    } catch (err) {
      showToast("Failed to update status.", false);
    } finally {
      setSaving(null);
    }
  }

  async function logHours(taskId) {
    const d     = logData[taskId] || {};
    const date  = d.date || today;
    const hours = parseFloat(d.hours || "0");
    const desc  = d.desc || "";

    if (!hours || hours <= 0) { showToast("Please enter a valid number of hours.", false); return; }
    if (!staffId)             { showToast("Staff record not found.", false); return; }

    setLogSaving(taskId);
    try {
      const { data: inserted, error } = await supabase
        .from("timesheets")
        .insert({ staff_id: staffId, task_id: taskId, log_date: date, hours_worked: hours, description: desc, status: "pending" })
        .select().single();
      if (error) throw error;

      setTaskTimesheets(prev => ({ ...prev, [taskId]: [inserted, ...(prev[taskId] || [])] }));
      setLogData(prev => ({ ...prev, [taskId]: { date: today, hours: "", desc: "" } }));
      setLogOpen(prev => ({ ...prev, [taskId]: false }));
      showToast("Hours logged!");
    } catch (err) {
      showToast("Failed to log hours.", false);
    } finally {
      setLogSaving(null);
    }
  }

  const filtered = tasks.filter(t => {
    if (filter === "upcoming") return t.status !== "done";
    if (filter === "past")     return t.status === "done";
    return true;
  });

  return (
    <CasualLayout title="Tasks">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Tasks</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${filtered.length} task${filtered.length !== 1 ? "s" : ""} ${filter === "upcoming" ? "active" : filter === "past" ? "completed" : "total"}`}
            </p>
          </div>
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {["upcoming", "past", "all"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{
                  padding: "7px 16px", background: filter === f ? "#FFF" : "transparent",
                  border: "none", borderRadius: "7px", fontSize: "13px",
                  fontWeight: filter === f ? "600" : "500",
                  color: filter === f ? "#1E293B" : "#64748B",
                  cursor: "pointer",
                  boxShadow: filter === f ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div style={{ flex: 1 }}>
                    <Shimmer w="200px" h="16px" r="6px" />
                    <div style={{ marginTop: "8px" }}><Shimmer w="140px" h="12px" r="5px" /></div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                    <Shimmer w="72px" h="22px" r="100px" />
                    <Shimmer w="60px" h="22px" r="100px" />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
                  <Shimmer w="80px" h="34px" r="8px" />
                  <Shimmer w="100px" h="34px" r="8px" />
                  <Shimmer w="70px" h="34px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "12px" }}><Calendar size={40} color="#CBD5E1" /></div>
            <p style={{ fontSize: "17px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {filter === "upcoming" ? "No active tasks" : filter === "past" ? "No completed tasks" : "No tasks assigned"}
            </p>
            <p style={{ fontSize: "13px", color: "#64748B" }}>
              {filter === "upcoming" ? "You're all caught up! Your manager will assign tasks when needed." : "No tasks found for this period."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((task, i) => (
              <TaskCard
                key={task.task_id}
                task={task}
                idx={i}
                today={today}
                saving={saving}
                logOpen={!!logOpen[task.task_id]}
                logEntry={logData[task.task_id] || { date: today, hours: "", desc: "" }}
                timesheets={taskTimesheets[task.task_id] || []}
                logSaving={logSaving}
                onStatusChange={updateStatus}
                onToggleLog={() => setLogOpen(prev => ({ ...prev, [task.task_id]: !prev[task.task_id] }))}
                onLogChange={(field, val) => setLogData(prev => ({ ...prev, [task.task_id]: { ...(prev[task.task_id] || { date: today, hours: "", desc: "" }), [field]: val } }))}
                onLogSubmit={() => logHours(task.task_id)}
              />
            ))}
          </div>
        )}

      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.ok ? "#22C55E" : "#EF4444",
          color: "#FFF", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </CasualLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function TaskCard({ task, idx, today, saving, logOpen, logEntry, timesheets, logSaving, onStatusChange, onToggleLog, onLogChange, onLogSubmit }) {
  const isSaving    = saving === task.task_id;
  const isLogSaving = logSaving === task.task_id;
  const priority    = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
  const statusStyle = STATUS_MAP[task.status]    || STATUS_MAP.todo;
  const totalHours  = timesheets.reduce((s, ts) => s + parseFloat(ts.hours_worked || 0), 0);
  const isOverdue   = task.due_date && task.due_date < today && task.status !== "done";

  return (
    <div style={{
      background: "#FFF",
      border: `1px solid ${isOverdue ? "#FECACA" : "#E2E8F0"}`,
      borderRadius: "16px", overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      animation: `fadeSlideUp 0.3s ease ${idx * 0.06}s both`,
    }}>

      <div style={{ padding: "20px 22px" }}>

        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", lineHeight: 1.3 }}>{task.title}</p>
            {task.description && (
              <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", lineHeight: 1.5 }}>{task.description}</p>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-end", flexShrink: 0 }}>
            <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "700", background: statusStyle.bg, color: statusStyle.color }}>
              {statusStyle.label}
            </span>
            <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: priority.bg, color: priority.color, textTransform: "capitalize" }}>
              {task.priority}
            </span>
          </div>
        </div>

        {/* Meta row */}
        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "16px" }}>
          {task.due_date && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Calendar size={13} color={isOverdue ? "#EF4444" : "#94A3B8"} />
              <span style={{ fontSize: "12px", color: isOverdue ? "#EF4444" : "#64748B", fontWeight: isOverdue ? "600" : "400" }}>
                {isOverdue ? "Overdue · " : "Due "}{fmtDate(task.due_date)}
              </span>
            </div>
          )}
          {totalHours > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <Clock size={13} color="#94A3B8" />
              <span style={{ fontSize: "12px", color: "#64748B" }}>{fmtHours(totalHours)} logged</span>
            </div>
          )}
        </div>

        {/* Status buttons + Log Hours toggle */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", paddingTop: "14px", borderTop: "1px solid #F1F5F9", alignItems: "center" }}>
          {STATUS_SEQ.map(s => (
            <button key={s}
              onClick={() => task.status !== s && onStatusChange(task, s)}
              disabled={isSaving}
              style={{
                padding: "7px 13px", borderRadius: "8px", border: "none",
                fontSize: "12px", fontWeight: "600", transition: "all 0.15s",
                cursor: task.status === s || isSaving ? "default" : "pointer",
                opacity: isSaving ? 0.6 : 1,
                background: task.status === s ? STATUS_MAP[s].bg : "#F8FAFC",
                color: task.status === s ? STATUS_MAP[s].color : "#94A3B8",
                boxShadow: task.status === s ? `0 0 0 2px ${STATUS_MAP[s].color}33` : "none",
              }}>
              {STATUS_MAP[s].label}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          <button onClick={onToggleLog}
            style={{
              display: "flex", alignItems: "center", gap: "5px",
              padding: "7px 13px", borderRadius: "8px",
              border: `1.5px solid ${logOpen ? "#BFDBFE" : "#E2E8F0"}`,
              background: logOpen ? "#EFF6FF" : "#FFF",
              color: logOpen ? "#2563EB" : "#475569",
              fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s",
            }}>
            <Clock size={13} />
            Log Hours
            {logOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Log Hours panel */}
      {logOpen && (
        <div style={{ borderTop: "1px solid #E2E8F0", background: "#F8FAFC", padding: "16px 22px" }}>
          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", marginBottom: "12px" }}>Log Hours</p>

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748B", marginBottom: "4px" }}>DATE</label>
              <input type="date" value={logEntry.date || today}
                onChange={e => onLogChange("date", e.target.value)}
                style={{ padding: "7px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FFF" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748B", marginBottom: "4px" }}>HOURS</label>
              <input type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 2.5"
                value={logEntry.hours || ""}
                onChange={e => onLogChange("hours", e.target.value)}
                style={{ padding: "7px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FFF", width: "90px" }} />
            </div>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <label style={{ display: "block", fontSize: "11px", fontWeight: "700", color: "#64748B", marginBottom: "4px" }}>DESCRIPTION (optional)</label>
              <input type="text" placeholder="What did you work on?"
                value={logEntry.desc || ""}
                onChange={e => onLogChange("desc", e.target.value)}
                style={{ padding: "7px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none", background: "#FFF", width: "100%", boxSizing: "border-box" }} />
            </div>
            <button onClick={onLogSubmit} disabled={isLogSaving}
              style={{ padding: "7px 18px", borderRadius: "8px", background: "#2563EB", color: "#FFF", border: "none", fontSize: "13px", fontWeight: "600", cursor: isLogSaving ? "not-allowed" : "pointer", opacity: isLogSaving ? 0.7 : 1, whiteSpace: "nowrap" }}>
              {isLogSaving ? "Saving…" : "Submit"}
            </button>
          </div>

          {/* Previous entries */}
          {timesheets.length > 0 && (
            <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", marginBottom: "8px", letterSpacing: "0.05em" }}>PREVIOUS ENTRIES</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {timesheets.slice(0, 5).map(ts => (
                  <div key={ts.timesheet_id} style={{ display: "flex", gap: "12px", alignItems: "center", fontSize: "12px" }}>
                    <span style={{ color: "#64748B", minWidth: "90px" }}>{fmtDate(ts.log_date)}</span>
                    <span style={{ fontWeight: "700", color: "#1E293B", minWidth: "48px" }}>{fmtHours(parseFloat(ts.hours_worked))}</span>
                    {ts.description && (
                      <span style={{ color: "#94A3B8", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ts.description}</span>
                    )}
                    <span style={{ marginLeft: "auto", padding: "1px 8px", borderRadius: "100px", fontSize: "10px", fontWeight: "700", flexShrink: 0,
                      background: ts.status === "approved" ? "#DCFCE7" : ts.status === "rejected" ? "#FEE2E2" : "#F1F5F9",
                      color:      ts.status === "approved" ? "#166534" : ts.status === "rejected" ? "#991B1B" : "#64748B",
                    }}>{ts.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

function fmtHours(h) {
  if (!h || h <= 0) return "0h";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}
