import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { Plus, X, Calendar, ArrowLeft, Trash2, Save, Send, Pencil } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("kb-styles")) {
  const s = document.createElement("style");
  s.id = "kb-styles";
  s.textContent = `
    @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes cardDrop { from{opacity:0;transform:scale(0.95) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes slotIn { from{opacity:0;transform:scaleY(0.6)} to{opacity:1;transform:scaleY(1)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .kb-card { transition:box-shadow 0.15s ease,transform 0.15s ease,border-color 0.15s ease,opacity 0.15s ease; cursor:grab; animation:cardDrop 0.18s ease both; }
    .kb-card:hover { box-shadow:0 4px 12px rgba(15,23,42,0.08); transform:translateY(-1px); border-color:#D8DCE3 !important; }
    .kb-card:active { cursor:grabbing; }
    .kb-card.kb-dragging { opacity:0.35; transform:scale(0.97); box-shadow:none !important; border-style:dashed !important; }
    .kb-col { transition:background-color 0.18s ease,border-color 0.18s ease; }
    .kb-slot { border-radius:10px; border:2px dashed #A5B4FC; background:rgba(99,102,241,0.06); animation:slotIn 0.15s ease both; transform-origin:top; flex-shrink:0; }
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
  medium: { label: "Medium", color: "#B45309", bg: "#FEF3C7" },
  high:   { label: "High",   color: "#B91C1C", bg: "#FEE2E2" },
  urgent: { label: "Urgent", color: "#6D28D9", bg: "#F5F3FF" },
};

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899"];
function avatarColor(name = "") {
  let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

// Skills have no stored color, so derive a stable one per skill_id
const SKILL_COLORS = ["#6366F1","#0EA5E9","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316","#84CC16"];
function skillColor(skill) {
  return skill?.color || SKILL_COLORS[Math.abs(Number(skill?.skill_id) || 0) % SKILL_COLORS.length];
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
        const c = skillColor(s);
        return (
          <button key={s.skill_id} type="button" onClick={() => onChange(on ? selected.filter(id => id !== s.skill_id) : [...selected, s.skill_id])}
            style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "600", cursor: "pointer", border: `1.5px solid ${on ? c : "#E2E8F0"}`, background: on ? `${c}18` : "#fff", color: on ? c : "#64748B" }}>
            {s.name}
          </button>
        );
      })}
      {skills.length === 0 && <p style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>No skills in library yet</p>}
    </div>
  );
}

// ── Assignee multi-select ─────────────────────────────────────────────────────
function MemberPicker({ members, selected, onChange, requiredSkillIds = [], skillNameMap = {} }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
      {members.map(m => {
        const on = selected.includes(String(m.user_id));
        const matchedIds = requiredSkillIds.filter(id => (m.skill_ids || []).includes(id));
        const matchedNames = matchedIds.map(id => skillNameMap[id]).filter(Boolean);
        return (
          <button key={m.user_id} type="button"
            title={matchedNames.length ? `Covers: ${matchedNames.join(", ")}` : undefined}
            onClick={() => onChange(on ? selected.filter(id => id !== String(m.user_id)) : [...selected, String(m.user_id)])}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "4px 10px 4px 4px", borderRadius: "99px", fontSize: "12px", fontWeight: "600", cursor: "pointer", border: `1.5px solid ${on ? "#6366F1" : "#E2E8F0"}`, background: on ? "#EEF2FF" : "#fff", color: on ? "#4338CA" : "#64748B" }}>
            <Avatar name={m.full_name} size={18} />{m.full_name}
            {requiredSkillIds.length > 0 && (
              <span style={{ fontSize: "10px", fontWeight: "800", color: on ? "#6366F1" : "#94A3B8" }}>{matchedIds.length}/{requiredSkillIds.length}</span>
            )}
          </button>
        );
      })}
      {members.length === 0 && <p style={{ fontSize: "12px", color: "#94A3B8", fontStyle: "italic" }}>No eligible staff</p>}
    </div>
  );
}

// ── Request Krewby Worker modal ───────────────────────────────────────────────
// The underlying krewby_requests table is shift-shaped (requires a date + start/end
// time), but the manager shouldn't have to think in shift terms for a task request —
// so time is a fixed default and everything else is carried straight from the task.
const DEFAULT_REQUEST_START = "09:00";
const DEFAULT_REQUEST_END   = "18:00";

function KrewbyRequestModal({ task, skills, onClose }) {
  const todayISO = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    workers_count: 1,
    date_needed: task?.due_date?.split("T")[0] || todayISO,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const taskSkillNames = (task?.required_skills || [])
    .map(id => skills.find(s => s.skill_id === id)?.name)
    .filter(Boolean);
  const priorityMeta = PRIORITY_META[task?.priority] || PRIORITY_META.medium;

  async function handleSubmit() {
    setSaving(true); setError("");
    try {
      const noteParts = [];
      if (task?.description) noteParts.push(`Description: ${task.description}`);
      if (task?.priority) noteParts.push(`Priority: ${priorityMeta.label}`);
      if (form.notes.trim()) noteParts.push(form.notes.trim());

      await api.post("/api/flex/krewby-requests", {
        task_id:       task?.task_id || null,
        role_name:     task?.title || "Untitled task",
        shift_date:    form.date_needed,
        start_time:    DEFAULT_REQUEST_START,
        end_time:      DEFAULT_REQUEST_END,
        workers_count: Number(form.workers_count),
        skill_id:      task?.required_skills?.[0] || null,
        notes:         noteParts.join("\n") || null,
      });
      setSent(true);
    } catch (e) { setError(e.message || "Failed to submit request."); }
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
            {/* Auto-filled info — carried straight from the task */}
            {task && (
              <div style={{ background: "#F8FAFC", borderRadius: "10px", padding: "12px 14px", border: "1px solid #E2E8F0", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Task</p>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{task.title}</p>
                </div>
                {task.description && (
                  <p style={{ fontSize: "12px", color: "#475569", lineHeight: 1.5 }}>{task.description}</p>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px", background: priorityMeta.bg, color: priorityMeta.color }}>{priorityMeta.label} priority</span>
                  {task.due_date && (
                    <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "99px", background: "#F1F5F9", color: "#475569" }}>
                      Due {new Date(task.due_date.split("T")[0] + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {taskSkillNames.map(name => (
                    <span key={name} style={{ fontSize: "10px", fontWeight: "600", padding: "2px 8px", borderRadius: "99px", background: "#EEF2FF", color: "#4338CA" }}>{name}</span>
                  ))}
                </div>
              </div>
            )}

            <Field label="Number of Workers Needed">
              <input type="number" min={1} max={20} value={form.workers_count} onChange={e => setForm(f => ({ ...f, workers_count: e.target.value }))} style={inp} />
            </Field>

            <Field label="Due Date">
              <input type="date" value={form.date_needed} min={todayISO} onChange={e => setForm(f => ({ ...f, date_needed: e.target.value }))} style={inp} />
            </Field>

            <Field label="Additional Notes">
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any specific requirements or notes for Krewby admin..." rows={3} style={{ ...inp, resize: "vertical" }} />
            </Field>

            {error && <p style={{ fontSize: "12px", fontWeight: "600", color: "#DC2626", margin: 0 }}>{error}</p>}

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

// ── Task detail (read-only) view ────────────────────────────────────────────────
function TaskDetailBody({ task, skills, onEdit, onDelete }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const col = COLUMNS.find(c => c.key === task.status) || COLUMNS[0];
  const taskSkills = (task.required_skills || []).map(id => skills.find(s => s.skill_id === id)).filter(Boolean);
  const assignees = task.assignees || [];
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";

  function DetailLabel({ children }) {
    return <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>{children}</p>;
  }

  return (
    <>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Status / priority / due date */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: col.color, background: col.bg, padding: "4px 10px", borderRadius: "6px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: col.color }} />{col.label}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: pm.color, background: pm.bg, padding: "4px 10px", borderRadius: "6px" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: pm.color }} />{pm.label} priority
          </span>
          {task.due_date && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: overdue ? "#DC2626" : "#64748B", background: overdue ? "#FEF2F2" : "#F8FAFC", padding: "4px 10px", borderRadius: "6px" }}>
              <Calendar size={11} />{new Date(task.due_date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" })}{overdue ? " · Overdue" : ""}
            </span>
          )}
        </div>

        <div>
          <DetailLabel>Description</DetailLabel>
          <p style={{ fontSize: "13px", color: task.description ? "#334155" : "#B4BAC6", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{task.description || "No description added."}</p>
        </div>

        {taskSkills.length > 0 && (
          <div>
            <DetailLabel>Skills Required</DetailLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {taskSkills.map(s => {
                const c = skillColor(s);
                return (
                  <span key={s.skill_id} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", padding: "4px 10px", borderRadius: "6px", background: "#F8FAFC", color: "#475569", border: "1px solid #EEF1F5" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />{s.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <DetailLabel>Assigned To</DetailLabel>
          {assignees.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {assignees.map(a => (
                <div key={a.user_id} style={{ display: "flex", alignItems: "center", gap: "9px" }}>
                  <Avatar name={a.full_name} size={26} />
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{a.full_name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: "13px", color: "#B4BAC6" }}>No one assigned yet.</p>
          )}
        </div>
      </div>

      <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between" }}>
        <button onClick={onDelete} style={{ ...btnBase, background: "#FEE2E2", color: "#DC2626" }}>
          <Trash2 size={14} /> Delete
        </button>
        <button onClick={onEdit} style={{ ...btnBase, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#FFF" }}>
          <Pencil size={14} /> Edit
        </button>
      </div>
    </>
  );
}

// ── Task modal ────────────────────────────────────────────────────────────────
function TaskModal({ task, skills, members, onClose, onSave, onDelete, projectId, onRequestKrewby }) {
  const isNew = !task?.task_id;
  const [mode, setMode] = useState(isNew ? "edit" : "view");
  const [form, setForm] = useState({
    title: task?.title || "",
    description: task?.description || "",
    priority: task?.priority || "medium",
    assignee_ids: (task?.assignees || []).map(a => String(a.user_id)),
    due_date: task?.due_date?.split("T")[0] || "",
    status: task?.status || "todo",
    required_skills: task?.required_skills || [],
  });
  const [saving, setSaving] = useState(false);

  // Filter members: if skills selected, show anyone who covers at least one — the team
  // as a whole (not necessarily one person) needs to cover every required skill.
  const eligibleMembers = form.required_skills.length === 0
    ? members
    : members.filter(m => form.required_skills.some(id => (m.skill_ids || []).includes(id)));

  const skillNameMap = Object.fromEntries(skills.map(s => [s.skill_id, s.name]));
  const selectedMembers = members.filter(m => form.assignee_ids.includes(String(m.user_id)));
  const coveredSkillIds = new Set(selectedMembers.flatMap(m => m.skill_ids || []));
  const missingSkills = form.required_skills.filter(id => !coveredSkillIds.has(id)).map(id => skillNameMap[id]).filter(Boolean);

  async function handleSave() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, assignee_ids: form.assignee_ids.map(Number), due_date: form.due_date || null };
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

  const noEligibleStaff = form.required_skills.length > 0 && eligibleMembers.length === 0;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "540px", maxHeight: "88vh", overflow: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", animation: "fadeUp 0.2s ease" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
          <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", lineHeight: 1.4 }}>
            {mode === "view" ? task.title : (isNew ? "New Task" : "Edit Task")}
          </h3>
          <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}><X size={14} /></button>
        </div>

        {mode === "view" ? (
          <TaskDetailBody task={task} skills={skills} onEdit={() => setMode("edit")} onDelete={handleDelete} />
        ) : (
        <>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <Field label="Task Name *">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What needs to be done?" style={inp} />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="More details (optional)" rows={3} style={{ ...inp, resize: "vertical" }} />
          </Field>

          <Field label="Skills Required for This Task">
            <SkillPicker skills={skills} selected={form.required_skills} onChange={v => {
              setForm(f => ({ ...f, required_skills: v, assignee_ids: [] }));
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
                <MemberPicker members={eligibleMembers} selected={form.assignee_ids} onChange={v => setForm(f => ({ ...f, assignee_ids: v }))}
                  requiredSkillIds={form.required_skills} skillNameMap={skillNameMap} />
                {form.required_skills.length > 0 && (
                  <p style={{ fontSize: "11px", color: "#64748B" }}>Showing {eligibleMembers.length} staff with at least one matching skill — pick as many as needed to cover them all</p>
                )}
                {form.required_skills.length > 0 && form.assignee_ids.length > 0 && (
                  missingSkills.length === 0 ? (
                    <p style={{ fontSize: "11px", color: "#16A34A", fontWeight: "700" }}>✓ Selected team covers every required skill</p>
                  ) : (
                    <p style={{ fontSize: "11px", color: "#D97706", fontWeight: "700" }}>Still missing: {missingSkills.join(", ")}</p>
                  )
                )}
                {(form.required_skills.length === 0 ? form.assignee_ids.length === 0 : missingSkills.length > 0) && (
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

        <div style={{ padding: "14px 24px", borderTop: "1px solid #F1F5F9", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => isNew ? onClose() : setMode("view")} style={{ ...btnBase, background: "#F1F5F9", color: "#64748B" }}>Cancel</button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()} style={{ ...btnBase, background: saving || !form.title.trim() ? "#E2E8F0" : "linear-gradient(135deg,#4F46E5,#7C3AED)", color: saving || !form.title.trim() ? "#94A3B8" : "#FFF" }}>
              <Save size={14} />{saving ? "Saving…" : isNew ? "Create Task" : "Save"}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

// ── Kanban Card ───────────────────────────────────────────────────────────────
function KanbanCard({ task, skills, isDragging, onDragStart, onDragEnd, onClick, style }) {
  const pm = PRIORITY_META[task.priority] || PRIORITY_META.medium;
  const overdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
  const taskSkills = (task.required_skills || []).map(id => skills.find(s => s.skill_id === id)).filter(Boolean);
  const assignees = task.assignees || [];

  return (
    <div className={`kb-card${isDragging ? " kb-dragging" : ""}`} draggable
      onDragStart={e => {
        e.dataTransfer.setData("task_id", task.task_id);
        e.dataTransfer.effectAllowed = "move";
        // Custom drag ghost: a tilted clone of the card (the browser default is a washed-out screenshot)
        const node = e.currentTarget;
        const rect = node.getBoundingClientRect();
        const ghost = node.cloneNode(true);
        ghost.className = ""; // drop kb-card so its mount animation/transition can't affect the captured drag image
        ghost.style.cssText += `position:fixed;top:-${rect.height + 40}px;left:0;width:${rect.width}px;margin:0;transform:rotate(3deg);box-shadow:0 16px 36px rgba(15,23,42,0.22);opacity:1;border:1px solid #C7D2FE;pointer-events:none;animation:none;`;
        document.body.appendChild(ghost);
        e.dataTransfer.setDragImage(ghost, e.clientX - rect.left, e.clientY - rect.top);
        requestAnimationFrame(() => ghost.remove());
        onDragStart(task.task_id, rect.height);
      }}
      onDragEnd={onDragEnd}
      onClick={onClick}
      style={{ background: "#FFF", border: "1px solid #E5E7EB", borderRadius: "10px", padding: "13px 14px", boxShadow: "0 1px 2px rgba(15,23,42,0.04)", userSelect: "none", ...style }}>

      <p style={{ fontSize: "13.5px", fontWeight: "600", color: "#0F172A", marginBottom: taskSkills.length > 0 ? "9px" : "11px", lineHeight: 1.45, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{task.title}</p>

      {/* Skill tags */}
      {taskSkills.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", marginBottom: "11px" }}>
          {taskSkills.map(s => {
            const c = skillColor(s);
            return (
              <span key={s.skill_id} style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "10.5px", fontWeight: "600", padding: "2px 8px 2px 6px", borderRadius: "5px", background: "#F8FAFC", color: "#475569", border: "1px solid #EEF1F5" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: c, flexShrink: 0 }} />{s.name}
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
              <Calendar size={11} />{new Date(task.due_date + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
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
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [draggingHeight, setDraggingHeight] = useState(90);

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
    setDragOverCol(null);
    const task = tasks.find(t => t.task_id === task_id);
    if (!task || task.status === colKey) return;
    setTasks(prev => prev.map(t => t.task_id === task_id ? { ...t, status: colKey } : t));
    api.patch(`/api/flex/tasks/${task_id}`, { status: colKey }).catch(console.error);
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
          const draggingTask = tasks.find(t => t.task_id === draggingTaskId);
          const isValidDropTarget = draggingTask && draggingTask.status !== col.key;
          const isDragOver = dragOverCol === col.key && isValidDropTarget;
          return (
            <div key={col.key} className="kb-col"
              onDragOver={e => {
                e.preventDefault();
                if (isValidDropTarget) e.dataTransfer.dropEffect = "move";
                if (dragOverCol !== col.key) setDragOverCol(col.key);
              }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null); }}
              onDrop={e => handleDrop(e, col.key)}
              style={{
                flex: 1, minWidth: "220px", borderRadius: "14px", padding: "14px", display: "flex", flexDirection: "column", gap: "10px", minHeight: "420px",
                background: isDragOver ? "#EEF4FF" : col.bg,
                border: isDragOver ? "1.5px dashed #818CF8" : `1.5px solid ${col.color}33`,
              }}>

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
                : colTasks.map((task, i) => (
                    <KanbanCard key={task.task_id} task={task} skills={skills}
                      isDragging={draggingTaskId === task.task_id}
                      style={{ animationDelay: `${Math.min(i, 6) * 0.03}s` }}
                      onDragStart={(taskId, height) => { setDraggingTaskId(taskId); setDraggingHeight(height); }}
                      onDragEnd={() => { setDragOverCol(null); setDraggingTaskId(null); }}
                      onClick={() => setTaskModal(task)}
                    />
                  ))
              }
              {isDragOver && <div className="kb-slot" style={{ height: `${draggingHeight}px` }} />}
              {!loading && colTasks.length === 0 && !isDragOver && (
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
          onClose={() => setKrewbyModal(null)}
        />
      )}
    </ManagerLayout>
  );
}
