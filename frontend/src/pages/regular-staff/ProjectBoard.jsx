import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";
import { X, Calendar, ArrowLeft } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-kb-styles")) {
  const s = document.createElement("style");
  s.id = "staff-kb-styles";
  s.textContent = `
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .staff-kb-card { transition:box-shadow 0.15s ease,transform 0.15s ease; cursor:pointer; }
    .staff-kb-card:hover { box-shadow:0 4px 12px rgba(15,23,42,0.08); transform:translateY(-1px); border-color:#D8DCE3 !important; }
  `;
  document.head.appendChild(s);
}

const COLUMNS = [
  { key: "todo",        label: "To Do",       color: "#94A3B8", bg: "#F8FAFC" },
  { key: "in_progress", label: "In Progress", color: "#3B82F6", bg: "#EFF6FF" },
  { key: "review",      label: "Review",      color: "#F59E0B", bg: "#FFFBEB" },
  { key: "done",        label: "Done",        color: "#22C55E", bg: "#F0FDF4" },
];

const PRIORITY_META = {
  low:    { label: "Low",    color: "#64748B", bg: "#F1F5F9" },
  medium: { label: "Medium", color: "#B45309", bg: "#FEF3C7" },
  high:   { label: "High",   color: "#B91C1C", bg: "#FEE2E2" },
  urgent: { label: "Urgent", color: "#6D28D9", bg: "#F5F3FF" },
};

const SKILL_COLORS = ["#6366F1","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#84CC16"];
function skillColor(skill) {
  return skill?.color || SKILL_COLORS[Math.abs(Number(skill?.skill_id) || 0) % SKILL_COLORS.length];
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899"];
function avatarColor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function Avatar({ name, size = 24 }) {
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(name || ""), color: "#fff", fontSize: size * 0.38, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

// ── Task detail (read-only, with self-status update) ────────────────────────
function TaskDetailModal({ task, skills, currentUserId, onClose, onStatusChange }) {
  const [saving, setSaving] = useState(false);
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const col = COLUMNS.find(c => c.key === task.status) || COLUMNS[0];
  const taskSkills = (task.required_skills || []).map(id => skills.find(s => s.skill_id === id)).filter(Boolean);
  const assignees = task.assignees || [];
  const isMine = assignees.some(a => String(a.user_id) === String(currentUserId));
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  async function handleStatusChange(status) {
    setSaving(true);
    try {
      await api.patch(`/api/flex/tasks/${task.task_id}`, { status });
      onStatusChange(task.task_id, status);
    } catch { } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "480px", maxHeight: "86vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", lineHeight: 1.4 }}>{task.title}</h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: col.color, background: col.bg, padding: "4px 10px", borderRadius: "6px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />{col.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: pm.color, background: pm.bg, padding: "4px 10px", borderRadius: "6px" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: pm.color }} />{pm.label} priority
            </span>
            {task.due_date && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: overdue ? "#DC2626" : "#64748B", background: overdue ? "#FEF2F2" : "#F8FAFC", padding: "4px 10px", borderRadius: "6px" }}>
                <Calendar size={11} />{new Date(task.due_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" })}{overdue ? " · Overdue" : ""}
              </span>
            )}
          </div>

          <div>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Description</p>
            <p style={{ fontSize: "13px", color: task.description ? "#334155" : "#B4BAC6", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.description || "No description added."}</p>
          </div>

          {taskSkills.length > 0 && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Skills Required</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {taskSkills.map(sk => {
                  const c = skillColor(sk);
                  return (
                    <span key={sk.skill_id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "6px", background: "#F8FAFC", color: "#475569", border: "1px solid #EEF1F5" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{sk.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Assigned To</p>
            {assignees.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {assignees.map(a => (
                  <div key={a.user_id} style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                    <Avatar name={a.full_name} size={26} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{a.full_name}{String(a.user_id) === String(currentUserId) ? " (you)" : ""}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#B4BAC6" }}>No one assigned yet.</p>
            )}
          </div>

          {isMine && (
            <div>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>Update Your Status</p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {COLUMNS.map(c => (
                  <button key={c.key} disabled={saving} onClick={() => handleStatusChange(c.key)}
                    style={{ padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", border: `1.5px solid ${task.status === c.key ? c.color : "#E2E8F0"}`, background: task.status === c.key ? c.bg : "#fff", color: task.status === c.key ? c.color : "#64748B" }}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanCard({ task, skills, onClick }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const taskSkills = (task.required_skills || []).map(id => skills.find(s => s.skill_id === id)).filter(Boolean);
  const assignees = task.assignees || [];

  return (
    <div className="staff-kb-card" onClick={onClick}
      style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "13px 14px", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", userSelect: "none" }}>
      <p style={{ fontSize: "13.5px", fontWeight: "600", color: "#0F172A", marginBottom: taskSkills.length > 0 ? "9px" : "11px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.title}</p>

      {taskSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "11px" }}>
          {taskSkills.map(sk => {
            const c = skillColor(sk);
            return (
              <span key={sk.skill_id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: "600", padding: "2px 8px 2px 6px", borderRadius: "5px", background: "#F8FAFC", color: "#475569", border: "1px solid #EEF1F5" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />{sk.name}
              </span>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "9px", borderTop: "1px solid #F1F3F6" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "600", color: pm.color }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pm.color, flexShrink: 0 }} />{pm.label}
          </span>
          {task.due_date && (
            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: "500", color: overdue ? "#DC2626" : "#94A3B8" }}>
              <Calendar size={11} />{new Date(task.due_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
            </span>
          )}
        </div>
        {assignees.length > 0 ? (
          <div style={{ display: "flex" }}>
            {assignees.slice(0, 3).map((a, i) => (
              <div key={a.user_id} style={{ marginLeft: i === 0 ? 0 : -7, border: "2px solid #FFF", borderRadius: "50%" }}>
                <Avatar name={a.full_name} size={22} />
              </div>
            ))}
            {assignees.length > 3 && (
              <div style={{ marginLeft: -7, width: 22, height: 22, borderRadius: "50%", border: "2px solid #FFF", background: "#EEF1F5", color: "#64748B", fontSize: "9px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center" }}>
                +{assignees.length - 3}
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: "10.5px", fontWeight: "500", color: "#CBD1D9" }}>Unassigned</span>
        )}
      </div>
    </div>
  );
}

export default function StaffProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = getUser();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [tasksRes, skillsRes, projRes] = await Promise.all([
        api.get(`/api/flex/projects/${id}/tasks`),
        api.get("/api/business/skills").catch(() => ({ skills: [] })),
        api.get("/api/projects").catch(() => ({ projects: [] })),
      ]);
      setTasks(tasksRes.tasks || []);
      setSkills(skillsRes.skills || []);
      setProject((projRes.projects || []).find(p => String(p.project_id) === String(id)) || null);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function handleStatusChange(task_id, status) {
    setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, status } : t));
    setSelectedTask(prev => prev && prev.task_id === task_id ? { ...prev, status } : prev);
  }

  const tasksByCol = {};
  COLUMNS.forEach(c => { tasksByCol[c.key] = tasks.filter(t => t.status === c.key); });

  return (
    <StaffLayout title={project?.name || "Project Board"}>
      <div style={{ padding: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <button onClick={() => navigate("/regular-staff/projects")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#64748B" }}>
            <ArrowLeft size={13} /> Projects
          </button>
          <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", flex: 1 }}>{project?.name || "…"}</h2>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start", overflowX: "auto" }}>
          {COLUMNS.map(col => {
            const colTasks = tasksByCol[col.key] || [];
            return (
              <div key={col.key} style={{ flex: "1 1 220px", minWidth: "220px", background: col.bg, border: `1.5px solid ${col.color}33`, borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "420px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: "12px", fontWeight: "800", color: col.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.label}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", background: "#FFF", borderRadius: "99px", padding: "0 7px" }}>{colTasks.length}</span>
                </div>

                {loading
                  ? Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ height: "90px", borderRadius: "12px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />)
                  : colTasks.map(task => (
                      <KanbanCard key={task.task_id} task={task} skills={skills} onClick={() => setSelectedTask(task)} />
                    ))
                }
                {!loading && colTasks.length === 0 && (
                  <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.4 }}>
                    <p style={{ fontSize: "12px", color: "#94A3B8" }}>No tasks here</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} skills={skills} currentUserId={user?.user_id}
          onClose={() => setSelectedTask(null)} onStatusChange={handleStatusChange} />
      )}
    </StaffLayout>
  );
}
