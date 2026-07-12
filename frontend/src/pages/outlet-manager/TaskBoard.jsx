import { useState, useEffect, useCallback } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { ClipboardList, Plus, X, Zap, AlertTriangle, CheckCircle } from "lucide-react";

// 0=Mon … 6=Sun (matches casual_weekly_availability.day_of_week)
function getDayIndex(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  const js = d.getDay(); // JS: 0=Sun, 1=Mon … 6=Sat
  return js === 0 ? 6 : js - 1;
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITY = {
  urgent: { bg: "#FEF2F2", color: "#991B1B", label: "Urgent" },
  high:   { bg: "#FFF7ED", color: "#9A3412", label: "High" },
  medium: { bg: "#FFFBEB", color: "#92400E", label: "Medium" },
  low:    { bg: "#F0FDF4", color: "#166534", label: "Low" },
};

const STATUS = {
  todo:        { bg: "#F1F5F9", color: "#475569", label: "To Do" },
  in_progress: { bg: "#DBEAFE", color: "#1E40AF", label: "In Progress" },
  done:        { bg: "#DCFCE7", color: "#166534", label: "Done" },
};

const EMPTY_FORM = { title: "", description: "", project_id: "", priority: "medium", due_date: "", assign_type: "regular", assigned_to: "" };

export default function TaskBoard() {
  const user = getUser();
  const [outletId, setOutletId] = useState(null);
  const [projects, setProjects] = useState([]);
  const [allStaff, setAllStaff] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showPanel, setShowPanel] = useState(false);

  const [form, setForm] = useState(EMPTY_FORM);
  const [autoResult, setAutoResult] = useState(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadTasks = useCallback(async (userIds) => {
    if (!userIds?.length) return;
    const { data } = await supabase
      .from("tasks")
      .select("task_id, title, description, status, priority, assigned_to, due_date, created_at")
      .in("assigned_to", userIds)
      .order("created_at", { ascending: false });
    setTasks(data || []);
  }, []);

  useEffect(() => {
    if (!user?.user_id) return;
    (async () => {
      const { data: om } = await supabase
        .from("outlet_managers")
        .select("outlet_id")
        .eq("user_id", user.user_id)
        .limit(1)
        .single();
      if (!om) { setLoading(false); return; }
      const oid = om.outlet_id;
      setOutletId(oid);

      const [{ data: projs }, { data: staffRows }] = await Promise.all([
        supabase.from("projects").select("project_id, name").eq("location_id", oid).eq("status", "active"),
        supabase.from("staff").select("user_id, users(full_name, role)").eq("outlet_id", oid),
      ]);

      const projList = projs || [];
      setProjects(projList);

      const staffList = (staffRows || [])
        .filter(r => r.users?.role !== "outlet_manager")
        .map(r => ({ user_id: r.user_id, full_name: r.users?.full_name || "Unknown", role: r.users?.role || "" }));
      setAllStaff(staffList);

      await loadTasks(staffList.map(s => s.user_id));

      if (projList.length === 1) {
        setForm(f => ({ ...f, project_id: String(projList[0].project_id) }));
      }
      setLoading(false);
    })();
  }, [user?.user_id]);

  const refreshTasks = useCallback(() => {
    loadTasks(allStaff.map(s => s.user_id));
  }, [allStaff, loadTasks]);

  // Smart casual auto-assign: hard filter (availability on day) → soft rank (fewest open tasks)
  const runAutoAssign = async () => {
    if (!form.due_date) { setAutoResult({ error: true, reason: "Set a due date first to check availability." }); return; }
    setAutoRunning(true);
    setAutoResult(null);

    const dayIdx = getDayIndex(form.due_date);
    const casuals = allStaff.filter(s => s.role === "outlet_casual_staff");

    if (!casuals.length) {
      setAutoResult({ error: true, reason: "No casual workers in this outlet." });
      setAutoRunning(false);
      return;
    }

    const { data: avail } = await supabase
      .from("casual_weekly_availability")
      .select("user_id")
      .in("user_id", casuals.map(c => c.user_id))
      .eq("day_of_week", dayIdx);

    const availIds = new Set((avail || []).map(a => a.user_id));
    const eligible = casuals.filter(c => availIds.has(c.user_id));

    if (!eligible.length) {
      const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const unavail = casuals.length - eligible.length;
      setAutoResult({
        error: true,
        reason: `${unavail} casual${unavail !== 1 ? "s" : ""} in pool — none have availability set for ${dayNames[dayIdx]}. Ask them to update their availability, or assign manually below.`,
      });
      setAutoRunning(false);
      return;
    }

    // Count open tasks per eligible casual
    const { data: openTasks } = await supabase
      .from("tasks")
      .select("assigned_to")
      .in("assigned_to", eligible.map(c => c.user_id))
      .in("status", ["todo", "in_progress"]);

    const taskCount = {};
    eligible.forEach(c => { taskCount[c.user_id] = 0; });
    (openTasks || []).forEach(t => { taskCount[t.assigned_to] = (taskCount[t.assigned_to] || 0) + 1; });

    const ranked = [...eligible].sort((a, b) => taskCount[a.user_id] - taskCount[b.user_id]);
    const winner = ranked[0];

    setAutoResult({ userId: winner.user_id, name: winner.full_name, openTasks: taskCount[winner.user_id] });
    setForm(f => ({ ...f, assigned_to: String(winner.user_id) }));
    setAutoRunning(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return showToast("Title is required", "error");
    if (!form.project_id) return showToast("Select a project", "error");
    if (!form.due_date) return showToast("Due date is required", "error");
    if (!form.assigned_to) return showToast("Assign to a staff member", "error");

    setCreating(true);
    const { data: task, error } = await supabase
      .from("tasks")
      .insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        project_id: parseInt(form.project_id),
        priority: form.priority,
        due_date: form.due_date,
        assigned_to: parseInt(form.assigned_to),
        created_by: user.user_id,
        status: "todo",
      })
      .select()
      .single();

    if (error) { showToast("Failed to create task", "error"); setCreating(false); return; }

    const assignee = allStaff.find(s => s.user_id === parseInt(form.assigned_to));
    await supabase.from("notifications").insert({
      recipient_id: parseInt(form.assigned_to),
      type: "task_assigned",
      title: "New task assigned",
      message: `You've been assigned: "${form.title.trim()}"${form.due_date ? ` — due ${form.due_date}` : ""}`,
      related_entity: "task",
      related_id: task.task_id,
      is_read: false,
    });

    showToast(`Task created · ${assignee?.full_name || "Staff"} notified`, "success");
    setShowPanel(false);
    setForm({ ...EMPTY_FORM, project_id: projects.length === 1 ? String(projects[0].project_id) : "" });
    setAutoResult(null);
    refreshTasks();
    setCreating(false);
  };

  const today = toLocalDateStr(new Date());
  const filtered = tasks.filter(t => filter === "all" || t.status === filter);
  const regularStaff = allStaff.filter(s => s.role === "regular_staff");
  const casualStaff = allStaff.filter(s => s.role === "outlet_casual_staff");

  if (loading) {
    return (
      <ManagerLayout title="Task Board">
        <div style={{ padding: 40, color: "#64748B" }}>Loading…</div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="Task Board">
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: "#64748B", margin: 0 }}>
            {tasks.length} task{tasks.length !== 1 ? "s" : ""} · {allStaff.length} staff member{allStaff.length !== 1 ? "s" : ""}
          </p>
          <button onClick={() => setShowPanel(true)} style={s.btnPrimary}>
            <Plus size={15} /> Create Task
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[["all", "All"], ["todo", "To Do"], ["in_progress", "In Progress"], ["done", "Done"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setFilter(k)}
              style={{ ...s.filterTab, ...(filter === k ? s.filterTabActive : {}) }}>
              {lbl}
              <span style={{ marginLeft: 5, fontSize: 11, opacity: 0.65 }}>
                {k === "all" ? tasks.length : tasks.filter(t => t.status === k).length}
              </span>
            </button>
          ))}
        </div>

        {/* Task grid */}
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            <ClipboardList size={36} style={{ opacity: 0.25, marginBottom: 14 }} />
            <p style={{ color: "#94A3B8", margin: 0, fontSize: 15 }}>
              {filter !== "all" ? `No "${STATUS[filter]?.label || filter}" tasks` : "No tasks yet"}
            </p>
            <p style={{ color: "#CBD5E1", fontSize: 13, marginTop: 6 }}>Click "Create Task" to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {filtered.map(task => {
              const assignee = allStaff.find(s => s.user_id === task.assigned_to);
              const overdue = task.due_date && task.due_date < today && task.status !== "done";
              const pri = PRIORITY[task.priority] || PRIORITY.medium;
              const sta = STATUS[task.status] || STATUS.todo;
              const isCasual = assignee?.role === "outlet_casual_staff";
              return (
                <div key={task.task_id} style={{ ...s.taskCard, borderLeft: `4px solid ${overdue ? "#EF4444" : "#E2E8F0"}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1E293B", margin: 0, lineHeight: 1.4 }}>
                      {task.title}
                    </h3>
                    <span style={{ ...s.badge, background: pri.bg, color: pri.color, flexShrink: 0 }}>{pri.label}</span>
                  </div>

                  {task.description && (
                    <p style={{ fontSize: 13, color: "#64748B", margin: "0 0 10px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {task.description}
                    </p>
                  )}

                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ ...s.badge, background: sta.bg, color: sta.color }}>{sta.label}</span>
                    {overdue && <span style={{ ...s.badge, background: "#FEF2F2", color: "#991B1B" }}>Overdue</span>}
                    {task.due_date && (
                      <span style={{ fontSize: 12, color: overdue ? "#EF4444" : "#94A3B8" }}>Due {task.due_date}</span>
                    )}
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: isCasual ? "#8B5CF6" : "#3B82F6", color: "#FFF", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {assignee?.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>{assignee?.full_name || "Unknown"}</span>
                    <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: "auto" }}>
                      {isCasual ? "Casual" : "Regular"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Task slide-in panel ── */}
      {showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} style={s.backdrop} />
          <div style={s.panel}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: "#1E293B", margin: 0 }}>Create Task</h2>
              <button onClick={() => setShowPanel(false)} style={s.iconBtn}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Title <span style={{ color: "#EF4444" }}>*</span></label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task title" style={s.input} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Optional details…" rows={3} style={{ ...s.input, resize: "vertical", minHeight: 72 }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={s.label}>Project <span style={{ color: "#EF4444" }}>*</span></label>
                <select value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} style={s.input}>
                  <option value="">Select…</option>
                  {projects.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
                </select>
                {projects.length === 0 && (
                  <p style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>No active projects for this outlet.</p>
                )}
              </div>
              <div>
                <label style={s.label}>Priority</label>
                <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={s.input}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Due Date <span style={{ color: "#EF4444" }}>*</span></label>
              <input type="date" value={form.due_date} min={today}
                onChange={e => { setForm(f => ({ ...f, due_date: e.target.value, assigned_to: "" })); setAutoResult(null); }}
                style={s.input} />
            </div>

            {/* Assign To */}
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Assign To <span style={{ color: "#EF4444" }}>*</span></label>

              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {[["regular", "Regular Staff"], ["casual", "Casual Worker"]].map(([k, lbl]) => (
                  <button key={k}
                    onClick={() => { setForm(f => ({ ...f, assign_type: k, assigned_to: "" })); setAutoResult(null); }}
                    style={{ ...s.typeTab, ...(form.assign_type === k ? s.typeTabActive : {}), flex: 1 }}>
                    {lbl}
                  </button>
                ))}
              </div>

              {form.assign_type === "regular" ? (
                <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={s.input}>
                  <option value="">Select staff member</option>
                  {regularStaff.map(st => <option key={st.user_id} value={st.user_id}>{st.full_name}</option>)}
                </select>
              ) : (
                <div>
                  <button onClick={runAutoAssign} disabled={autoRunning}
                    style={{ ...s.btnAuto, opacity: autoRunning ? 0.55 : 1 }}>
                    <Zap size={14} />
                    {autoRunning ? "Checking availability…" : "Auto-Assign Best Casual"}
                  </button>
                  {!form.due_date && (
                    <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 6 }}>Set a due date first to check availability.</p>
                  )}

                  {autoResult && !autoResult.error && (
                    <div style={s.autoSuccess}>
                      <CheckCircle size={15} style={{ color: "#16A34A", flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#166534" }}>{autoResult.name} selected</p>
                        <p style={{ margin: "2px 0 0", fontSize: 12, color: "#4ADE80" }}>
                          Available on that day · {autoResult.openTasks} open task{autoResult.openTasks !== 1 ? "s" : ""} (fewest in pool)
                        </p>
                      </div>
                    </div>
                  )}

                  {autoResult?.error && (
                    <div style={s.autoError}>
                      <AlertTriangle size={15} style={{ color: "#EF4444", flexShrink: 0, marginTop: 1 }} />
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#991B1B" }}>No eligible casual found</p>
                        <p style={{ margin: "2px 0 8px", fontSize: 12, color: "#DC2626" }}>{autoResult.reason}</p>
                        <label style={{ ...s.label, fontSize: 12 }}>Assign manually instead:</label>
                        <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={s.input}>
                          <option value="">Pick a casual</option>
                          {casualStaff.map(st => <option key={st.user_id} value={st.user_id}>{st.full_name}</option>)}
                        </select>
                      </div>
                    </div>
                  )}

                  {autoResult && !autoResult.error && (
                    <div style={{ marginTop: 10 }}>
                      <label style={{ ...s.label, fontSize: 12, color: "#94A3B8" }}>Override selection:</label>
                      <select value={form.assigned_to} onChange={e => setForm(f => ({ ...f, assigned_to: e.target.value }))} style={s.input}>
                        {casualStaff.map(st => <option key={st.user_id} value={st.user_id}>{st.full_name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowPanel(false); setAutoResult(null); }} style={s.btnCancel}>Cancel</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ ...s.btnPrimary, flex: 1, justifyContent: "center", opacity: creating ? 0.6 : 1 }}>
                {creating ? "Creating…" : "Create Task"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          ...s.toast,
          background: toast.type === "error" ? "#FEF2F2" : "#F0FDF4",
          borderColor: toast.type === "error" ? "#FECACA" : "#BBF7D0",
          color: toast.type === "error" ? "#991B1B" : "#166534",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

const s = {
  btnPrimary: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 18px", background: "#3B82F6", color: "#FFF",
    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  filterTab: {
    padding: "7px 14px", border: "1.5px solid #E2E8F0", borderRadius: 8,
    background: "#FFF", color: "#64748B", fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  filterTabActive: { background: "#EFF6FF", borderColor: "#93C5FD", color: "#1D4ED8" },
  emptyState: {
    textAlign: "center", padding: "72px 0",
    display: "flex", flexDirection: "column", alignItems: "center",
  },
  taskCard: {
    background: "#FFF",
    borderTop: "1.5px solid #E2E8F0",
    borderRight: "1.5px solid #E2E8F0",
    borderBottom: "1.5px solid #E2E8F0",
    borderLeft: "4px solid #E2E8F0",
    borderRadius: 12,
    padding: 16,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  badge: {
    display: "inline-flex", alignItems: "center",
    padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600,
  },
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 400 },
  panel: {
    position: "fixed", top: 0, right: 0, bottom: 0, width: 460,
    background: "#FFF", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)",
    zIndex: 401, padding: "24px 28px", overflowY: "auto", boxSizing: "border-box",
  },
  iconBtn: {
    background: "none", border: "none", color: "#64748B", cursor: "pointer",
    padding: 4, borderRadius: 8, display: "flex",
  },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 },
  input: {
    width: "100%", padding: "9px 12px",
    border: "1.5px solid #E2E8F0", borderRadius: 9,
    fontSize: 14, color: "#1E293B", background: "#FAFAFA",
    boxSizing: "border-box", outline: "none",
    fontFamily: "inherit",
  },
  typeTab: {
    padding: "8px 12px", border: "1.5px solid #E2E8F0",
    borderRadius: 8, background: "#F8FAFC", color: "#64748B",
    fontSize: 13, fontWeight: 500, cursor: "pointer",
  },
  typeTabActive: { background: "#EFF6FF", borderColor: "#93C5FD", color: "#1D4ED8" },
  btnAuto: {
    display: "inline-flex", alignItems: "center", gap: 6,
    padding: "9px 16px", background: "#7C3AED", color: "#FFF",
    border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  autoSuccess: {
    marginTop: 10, padding: "10px 12px",
    background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 9,
    display: "flex", alignItems: "flex-start", gap: 8,
  },
  autoError: {
    marginTop: 10, padding: "10px 12px",
    background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 9,
    display: "flex", alignItems: "flex-start", gap: 8,
  },
  btnCancel: {
    padding: "9px 18px", border: "1.5px solid #E2E8F0",
    background: "#FFF", color: "#64748B", borderRadius: 10,
    fontSize: 14, fontWeight: 500, cursor: "pointer",
  },
  toast: {
    position: "fixed", bottom: 28, right: 28,
    padding: "12px 20px",
    borderWidth: "1.5px", borderStyle: "solid", borderRadius: 10,
    fontSize: 14, fontWeight: 500,
    zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
  },
};
