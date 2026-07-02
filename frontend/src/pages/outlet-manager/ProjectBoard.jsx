import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Plus, X, Calendar, ArrowLeft, Trash2, Save, Send } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("kb-styles")) {
  const s = document.createElement("style");
  s.id = "kb-styles";
  s.textContent = `
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .kb-card { transition:box-shadow 0.15s,transform 0.15s; cursor:grab; }
    .kb-card:hover { box-shadow:0 6px 20px rgba(0,0,0,0.12); transform:translateY(-2px); }
    .kb-col.drag-over { background:#EEF2FF !important; }
  `;
  document.head.appendChild(s);
}

const COLUMNS = [
  { key: "todo",        label: "To Do",      color: "#94A3B8", bg: "#F8FAFC" },
  { key: "in_progress", label: "In Progress", color: "#3B82F6", bg: "#EFF6FF" },
  { key: "review",      label: "Review",      color: "#F59E0B", bg: "#FFFBEB" },
  { key: "done",        label: "Done",        color: "#22C55E", bg: "#F0FDF4" },
];

const PRIORITY_META = {
  low:    { label: "Low",    color: "#64748B", bg: "#F1F5F9" },
  medium: { label: "Medium", color: "#D97706", bg: "#FEF3C7" },
  high:   { label: "High",   color: "#DC2626", bg: "#FEE2E2" },
  urgent: { label: "Urgent", color: "#7C3AED", bg: "#F5F3FF" },
};

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899"];
function avatarColor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function Avatar({ name, size = 26 }) {
  return (
    <div title={name} style={{ width: size, height: size, borderRadius: "50%", background: avatarColor(name || ""), color: "#fff", fontSize: size * 0.38, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

const inp = { width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none", boxSizing: "border-box", fontFamily: "inherit", background: "#fff" };
const sel = { ...inp, cursor: "pointer" };
const btnBase = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", cursor: "pointer", border: "none" };

function Field({ label, children }) {
  return (
    <div>
      <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{label}</p>
      {children}
    </div>
  );
}

// ── Skill pills multi-select ──────────────────────────────────────────────────
function SkillPicker({ skills, selected, onChange }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {skills.map(s => {
        const on = selected.includes(s.skill_id);
        return (
          <button key={s.skill_id} type="button" onClick={() => onChange(on ? selected.filter(id => id !== s.skill_id) : [...selected, s.skill_id])}
            style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "600", cursor: "pointer", border: `1.5px solid ${on ? s.color || "#6366F1" : "#E2E8F0"}`, background: on ? `${s.color || "#6366F1"}18` : "#fff", color: on ? s.color || "#6366F1" : "#64748B" }}>
            {s.name}
          </button>
        );
      })}
      {skills.length === 0 && <p style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>No skills in library yet</p>}
    </div>
  );
}

// ── Request Krewby Worker modal ───────────────────────────────────────────────
function KrewbyRequestModal({ task, skills, projectId, onClose }) {
  const [form, setForm] = useState({
    workers_count: 1,
    start_date: task?.due_date || "",
    end_date: "",
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  const taskSkillNames = (task?.required_skills || [])
    .map(id => skills.find(s => s.skill_id === id)?.name)
    .filter(Boolean);

  async function handleSubmit() {
    setSaving(true);
    try {
      await api.post("/api/flex/krewby-requests", {
        task_id: task?.task_id || null,
        project_id: Number(projectId),
        skills_needed: task?.required_skills || [],
        workers_count: Number(form.workers_count),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      });
      setSent(true);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "480px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", background: "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: "800" }}>Request Krewby Worker</p>
            <p style={{ fontSize: "12px", opacity: 0.75, marginTop: "2px" }}>Submit a casual worker request to Krewby admin</p>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}><X size={14} /></button>
        </div>

        {sent ? (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <p style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", marginBottom: "6px" }}>Request Sent!</p>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>Krewby admin will review and get back to you.</p>
            <button onClick={onClose} style={{ ...btnBase, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#fff", margin: "0 auto" }}>Close</button>
          </div>
        ) : (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Auto-filled info */}
            {task && (
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "12px 14px", border: "1px solid #E2E8F0" }}>
                <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Task</p>
                <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{task.title}</p>
                {taskSkillNames.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                    {taskSkillNames.map(name => (
                      <span key={name} style={{ fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "99px", background: "#EEF2FF", color: "#4338CA" }}>{name}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Field label="Number of Workers Needed">
              <input type="number" min={1} max={20} value={form.workers_count} onChange={e => setForm(f => ({ ...f, workers_count: e.target.value }))} style={inp} />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <Field label="Start Date">
                <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
              </Field>
              <Field label="End Date">
                <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
              </Field>
            </div>

            <Field label="Additional Notes">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any specific requirements or notes for Krewby admin..." rows={3} style={{ ...inp, resize: "vertical" }} />
            </Field>

            <div style={{ display: "flex", gap: "8px", paddingTop: "4px" }}>
              <button onClick={onClose} style={{ ...btnBase, background: "#F1F5F9", color: "#64748B", flex: 1, justifyContent: "center" }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving} style={{ ...btnBase, background: saving ? "#E2E8F0" : "linear-gradient(135deg,#4F46E5,#7C3AED)", color: saving ? "#94A3B8" : "#fff", flex: 2, justifyContent: "center" }}>
                <Send size={14} />{saving ? "Sending…" : "Submit Request"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Task modal ────────────────────────────────────────────────────────────────
function TaskModal({ task, skills, members, onClose, onSave, onDelete, projectId, onRequestKrewby }) {
  const isNew = !task?.task_id;
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium",
    assigned_to: task?.assigned_to || "",
    due_date: task?.due_date?.split("T")[0] || "",
    status: task?.status || "todo",
    required_skills: task?.required_skills || [],
  });
  const [saving, setSaving] = useState(false);

  // Filter members: if skills selected, only show staff with at least one matching skill
  const eligibleMembers = form.required_skills.length === 0
    ? members
    : members.filter(m => (m.skill_ids || []).some(id => form.required_skills.includes(id)));

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, assigned_to: form.assigned_to || null, due_date: form.due_date || null };
      let result;
      if (isNew) result = await api.post(`/api/flex/projects/${projectId}/tasks`, body);
      else result = await api.patch(`/api/flex/tasks/${task.task_id}`, body);
      onSave(result.task);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm("Delete this task?")) return;
    await api.delete(`/api/flex/tasks/${task.task_id}`);
    onDelete(task.task_id);
  }

  const assignedMember = members.find(m => String(m.user_id) === String(form.assigned_to));
  const noEligibleStaff = form.required_skills.length > 0 && eligibleMembers.length === 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "540px", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>{isNew ? "New Task" : "Edit Task"}</h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <Field label="Task Name *">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" style={inp} />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="More details (optional)" rows={3} style={{ ...inp, resize: "vertical" }} />
          </Field>

          <Field label="Skills Required for This Task">
            <SkillPicker skills={skills} selected={form.required_skills} onChange={v => {
              setForm(f => ({ ...f, required_skills: v, assigned_to: "" }));
            }} />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <Field label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={sel}>
                {Object.entries(PRIORITY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <Field label="Due Date">
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inp} />
            </Field>
          </div>

          {/* Assign to */}
          <Field label="Assign To">
            {noEligibleStaff ? (
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "8px", padding: "12px 14px" }}>
                <p style={{ fontSize: "12px", color: "#92400E", fontWeight: "600", marginBottom: "8px" }}>
                  No staff in your team has the required skills for this task.
                </p>
                <button type="button" onClick={() => onRequestKrewby({ ...task, ...form, task_id: task?.task_id })}
                  style={{ ...btnBase, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#fff", fontSize: "12px", padding: "6px 14px" }}>
                  Request Krewby Worker
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={sel}>
                  <option value="">— Unassigned —</option>
                  {eligibleMembers.map(m => <option key={m.user_id} value={m.user_id}>{m.full_name}</option>)}
                </select>
                {form.required_skills.length > 0 && (
                  <p style={{ fontSize: "11px", color: "#64748B" }}>Showing {eligibleMembers.length} staff with matching skills</p>
                )}
                {!form.assigned_to && (
                  <button type="button" onClick={() => onRequestKrewby({ ...task, ...form, task_id: task?.task_id })}
                    style={{ ...btnBase, background: "#F8FAFC", color: "#6366F1", border: "1.5px dashed #C7D2FE", fontSize: "12px", padding: "6px 14px", justifyContent: "center" }}>
                    Or request a Krewby casual worker
                  </button>
                )}
              </div>
            )}
          </Field>

          {!isNew && (
            <Field label="Status">
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={sel}>
                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </Field>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
          {!isNew ? (
            <button onClick={handleDelete} style={{ ...btnBase, background: "#FEE2E2", color: "#DC2626" }}>
              <Trash2 size={14} /> Delete
            </button>
          ) : <div />}
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={onClose} style={{ ...btnBase, background: "#F1F5F9", color: "#64748B" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{ ...btnBase, background: saving || !form.title.trim() ? "#E2E8F0" : "linear-gradient(135deg,#4F46E5,#7C3AED)", color: saving || !form.title.trim() ? "#94A3B8" : "#FFF" }}>
              <Save size={14} />{saving ? "Saving…" : isNew ? "Create Task" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ task, skills, onDragStart, onDragEnd, onClick }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const taskSkills = (task.required_skills || []).map(id => skills.find(s => s.skill_id === id)).filter(Boolean);

  return (
    <div className="kb-card" draggable
      onDragStart={e => { e.dataTransfer.setData("task_id", task.task_id); onDragStart(task.task_id); }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", userSelect: "none" }}>

      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", marginBottom: "8px", lineHeight: 1.4 }}>{task.title}</p>

      {/* Skill tags */}
      {taskSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" }}>
          {taskSkills.map(s => (
            <span key={s.skill_id} style={{ fontSize: "10px", fontWeight: "600", padding: "1px 7px", borderRadius: "99px", background: `${s.color || "#6366F1"}18`, color: s.color || "#6366F1", border: `1px solid ${s.color || "#6366F1"}33` }}>{s.name}</span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: pm.color, background: pm.bg, padding: "1px 7px", borderRadius: "99px" }}>{pm.label}</span>
          {task.due_date && (
            <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: overdue ? "#DC2626" : "#64748B", fontWeight: "600" }}>
              <Calendar size={10} />{new Date(task.due_date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
              {overdue && " ⚠"}
            </span>
          )}
        </div>
        {task.users && <Avatar name={task.users.full_name} size={24} />}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ProjectBoard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [taskModal, setTaskModal] = useState(null);
  const [krewbyModal, setKrewbyModal] = useState(null);
  const [dragOverCol, setDragOverCol] = useState(null);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    try {
      const [tasksRes, membersRes, skillsRes, projRes] = await Promise.all([
        api.get(`/api/flex/projects/${id}/tasks`),
        api.get(`/api/flex/projects/${id}/members`),
        api.get("/api/business/skills"),
        api.get("/api/projects"),
      ]);
      const proj = (projRes.projects || []).find(p => String(p.project_id) === String(id));
      setProject(proj || null);
      setTasks(tasksRes.tasks || []);
      setMembers(membersRes.members || []);
      setSkills(skillsRes.skills || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const tasksByCol = {};
  COLUMNS.forEach(c => { tasksByCol[c.key] = tasks.filter(t => t.status === c.key); });

  function handleDrop(e, colKey) {
    e.preventDefault();
    const task_id = Number(e.dataTransfer.getData("task_id"));
    setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, status: colKey } : t));
    api.patch(`/api/flex/tasks/${task_id}`, { status: colKey }).catch(console.error);
    setDragOverCol(null);
  }

  function handleTaskSave(task) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t.task_id === task.task_id);
      if (idx >= 0) { const next = [...prev]; next[idx] = task; return next; }
      return [task, ...prev];
    });
    setTaskModal(null);
  }

  function handleTaskDelete(task_id) {
    setTasks(prev => prev.filter(t => t.task_id !== task_id));
    setTaskModal(null);
  }

  return (
    <ManagerLayout title={project?.name || "Project Board"}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <button onClick={() => navigate("/outlet-manager/projects")} style={{ display: "flex", alignItems: "center", gap: "5px", background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px 12px", cursor: "pointer", fontSize: "12px", fontWeight: "600", color: "#64748B" }}>
          <ArrowLeft size={13} /> Projects
        </button>
        <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", flex: 1 }}>{project?.name || "…"}</h2>
        <button onClick={() => setTaskModal({ status: "todo" })} style={{ display: "flex", alignItems: "center", gap: "5px", background: "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#FFF", border: "none", borderRadius: "8px", padding: "8px 16px", cursor: "pointer", fontSize: "13px", fontWeight: "700" }}>
          <Plus size={14} /> Add Task
        </button>
      </div>

      {/* Kanban columns */}
      <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
        {COLUMNS.map(col => {
          const colTasks = tasksByCol[col.key] || [];
          const isDragOver = dragOverCol === col.key;
          return (
            <div key={col.key} className={`kb-col${isDragOver ? " drag-over" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.key); }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.key)}
              style={{ flex: 1, minWidth: "220px", background: isDragOver ? "#EEF2FF" : col.bg, border: `1.5px solid ${isDragOver ? "#6366F1" : col.color}33`, borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "420px" }}>

              {/* Column header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: col.color }} />
                  <span style={{ fontSize: "12px", fontWeight: "800", color: col.color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{col.label}</span>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", background: "#FFF", borderRadius: "99px", padding: "0 7px" }}>{colTasks.length}</span>
                </div>
                <button onClick={() => setTaskModal({ status: col.key })} style={{ background: "rgba(255,255,255,0.8)", border: "none", borderRadius: "6px", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}><Plus size={12} /></button>
              </div>

              {/* Cards */}
              {loading
                ? Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ height: "90px", borderRadius: "12px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />)
                : colTasks.map(task => (
                    <KanbanCard key={task.task_id} task={task} skills={skills}
                      onDragStart={() => {}}
                      onDragEnd={() => setDragOverCol(null)}
                      onClick={() => setTaskModal(task)}
                    />
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

      {/* Task modal */}
      {taskModal && (
        <TaskModal
          task={taskModal?.task_id ? taskModal : { ...taskModal }}
          skills={skills}
          members={members}
          projectId={id}
          onClose={() => setTaskModal(null)}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          onRequestKrewby={t => { setTaskModal(null); setKrewbyModal(t); }}
        />
      )}

      {/* Krewby request modal */}
      {krewbyModal && (
        <KrewbyRequestModal
          task={krewbyModal}
          skills={skills}
          projectId={id}
          onClose={() => setKrewbyModal(null)}
        />
      )}
    </ManagerLayout>
  );
}
