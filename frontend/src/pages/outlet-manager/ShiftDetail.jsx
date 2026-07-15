import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { Sparkles, X, AlertTriangle, Users, Trash2, Calendar, Clock, MapPin, Plus, Tag, Check } from "lucide-react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";

if (typeof document !== "undefined" && !document.getElementById("mgr-shift-detail-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-shift-detail-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes modalIn { from { opacity:0; transform:scale(0.95) translateY(12px); } to { opacity:1; transform:scale(1) translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes aiPulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }
    @keyframes aiPanelIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background:"#F3F4F6", color:"#6B7280" },
  published: { background:"#DCFCE7", color:"#166534" },
  completed: { background:"#DBEAFE", color:"#1E40AF" },
  cancelled: { background:"#FEE2E2", color:"#991B1B" },
};

const TASK_STATUS_STYLES = {
  open:     { background:"#FEF3C7", color:"#92400E", label:"Open" },
  assigned: { background:"#DCFCE7", color:"#166534", label:"Assigned" },
  done:     { background:"#DBEAFE", color:"#1E40AF", label:"Done" },
};

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

export default function ShiftDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const goTo = useGoTo();
  const user = getUser();

  const [shift, setShift]         = useState(null);
  const [tasks, setTasks]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast]         = useState(null);

  // Add task form
  const [showTaskForm, setShowTaskForm]   = useState(false);
  const [taskForm, setTaskForm]           = useState({ title: "", skill_id: "", start_time: "", end_time: "" });
  const [skillOptions, setSkillOptions]   = useState([]);
  const [savingTask, setSavingTask]       = useState(false);

  // Assign modal
  const [assignModal, setAssignModal]             = useState(null); // { task }
  const [candidates, setCandidates]               = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [assigning, setAssigning]                 = useState(false);

  // Conflict modal
  const [conflictModal, setConflictModal] = useState(null);

  // Confirm modal
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmBusy, setConfirmBusy]   = useState(false);

  // AI panel
  const [aiPanel, setAiPanel]     = useState(null);
  const [aiAssigning, setAiAssigning] = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function reloadTasks() {
    const res = await api.get(`/api/shifts/${id}`);
    if (res.success) setTasks(res.shift?.shift_tasks || []);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [res, { data: skillsData }] = await Promise.all([
          api.get(`/api/shifts/${id}`),
          supabase.from("skills").select("skill_id, name").order("name"),
        ]);
        if (!cancelled && res.success) {
          setShift(res.shift);
          setTasks(res.shift?.shift_tasks || []);
          setSkillOptions(skillsData || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled && searchParams.get("assign") === "1") runAiRecommend();
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Add task ─────────────────────────────────────────────────────────────────
  async function addTask() {
    if (!taskForm.title.trim()) { showToast("Task title is required.", "error"); return; }
    setSavingTask(true);
    try {
      const res = await api.post(`/api/shifts/${id}/tasks`, {
        title: taskForm.title.trim(),
        skill_id: taskForm.skill_id ? Number(taskForm.skill_id) : null,
        start_time: taskForm.start_time || null,
        end_time: taskForm.end_time || null,
      });
      if (!res.success) throw new Error(res.message);
      await reloadTasks();
      setTaskForm({ title: "", skill_id: "", start_time: "", end_time: "" });
      setShowTaskForm(false);
      showToast(`Task "${res.task.title}" added.`);
    } catch (err) {
      showToast("Failed to add task.", "error");
    } finally { setSavingTask(false); }
  }

  // ── Delete task ───────────────────────────────────────────────────────────────
  function deleteTask(task) {
    setConfirmModal({
      title: "Delete this task?",
      body: <>Delete <strong>{task.title}</strong>? Any assignment will also be removed.</>,
      confirmLabel: "Delete Task",
      danger: true,
      onConfirm: async () => {
        await api.delete(`/api/shifts/tasks/${task.task_id}`);
        setTasks(prev => prev.filter(t => t.task_id !== task.task_id));
        showToast("Task deleted.");
      },
    });
  }

  // ── Open assign modal ─────────────────────────────────────────────────────────
  async function openAssignModal(task) {
    setAssignModal({ task });
    setLoadingCandidates(true);
    setCandidates([]);
    try {
      const { data: staffRows } = await supabase
        .from("staff")
        .select("staff_id, staff_type, user_id")
        .eq("outlet_id", shift.outlet_id)
        .eq("is_active", true);

      const userIds  = (staffRows || []).map(s => s.user_id).filter(Boolean);
      const staffIds = (staffRows || []).map(s => s.staff_id);

      let userMap = {};
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users").select("user_id, full_name, email, role").in("user_id", userIds);
        (userRows || []).forEach(u => { userMap[u.user_id] = u; });
      }

      let skillMap = {};
      if (userIds.length > 0) {
        const { data: skillRows } = await supabase
          .from("user_skill_tags").select("user_id, skill_id").in("user_id", userIds);
        (skillRows || []).forEach(r => {
          if (!skillMap[r.user_id]) skillMap[r.user_id] = [];
          skillMap[r.user_id].push(r.skill_id);
        });
      }

      const { data: leaveRows } = await supabase
        .from("availability").select("staff_id").eq("status", "approved")
        .lte("start_date", shift.shift_date).gte("end_date", shift.shift_date);
      const onLeaveIds = new Set((leaveRows || []).map(l => l.staff_id));

      // Double-booking: staff already on another task on same date
      const { data: otherRows } = await supabase
        .from("task_assignments")
        .select("staff_id, shifts!inner(shift_date)")
        .neq("shift_id", Number(id));
      const doubleBookedIds = new Set(
        (otherRows || [])
          .filter(a => a.shifts?.shift_date === shift.shift_date)
          .map(a => a.staff_id)
      );

      // Already assigned to any task in THIS shift
      const assignedStaffIds = new Set(
        tasks.flatMap(t => t.task_assignments || []).map(a => a.staff_id).filter(Boolean)
      );

      const result = (staffRows || []).map(staff => {
        const u = userMap[staff.user_id] || {};
        if (u.role === "outlet_manager") return null;
        if (assignedStaffIds.has(staff.staff_id)) return null;

        const skillIds  = skillMap[staff.user_id] || [];
        const hasSkill  = !task.skill_id || skillIds.includes(task.skill_id);
        const isOnLeave = onLeaveIds.has(staff.staff_id);
        const isDouble  = doubleBookedIds.has(staff.staff_id);

        let score = 0;
        if (hasSkill)    score += 10;
        if (!isOnLeave)  score += 5;
        if (!isDouble)   score += 3;

        return {
          staff_id: staff.staff_id,
          full_name: u.full_name || u.email || "Unknown",
          email: u.email || "",
          staff_type: staff.staff_type,
          hasSkill, isOnLeave, isDouble, score,
        };
      }).filter(Boolean).sort((a, b) => b.score - a.score);

      setCandidates(result);
    } catch (err) {
      console.error(err);
    } finally { setLoadingCandidates(false); }
  }

  // ── Assign staff ──────────────────────────────────────────────────────────────
  async function assignStaff(staffId, taskId) {
    setAssigning(true);
    try {
      const res = await api.post(`/api/shifts/tasks/${taskId}/assign`, { staff_id: staffId });
      if (!res.success) throw new Error(res.message);
      await reloadTasks();
      setAssignModal(null); setCandidates([]);
      showToast("Staff assigned successfully.");
    } catch (err) {
      showToast(err.message || "Failed to assign staff.", "error");
    } finally { setAssigning(false); }
  }

  // ── Unassign staff ────────────────────────────────────────────────────────────
  function unassignStaff(task) {
    const assignee = task.task_assignments?.[0];
    const name = assignee?.staff?.users?.full_name || "this staff member";
    const doUnassign = async () => {
      await api.delete(`/api/shifts/tasks/${task.task_id}/assign`);
      await reloadTasks();
      showToast("Assignment removed.");
    };
    if (shift.status === "published") {
      setConfirmModal({
        title: "Remove assignment?",
        body: <><strong>{name}</strong> may have already seen their schedule. Remove them from this task anyway?</>,
        confirmLabel: "Remove",
        danger: true,
        onConfirm: doUnassign,
      });
    } else {
      doUnassign();
    }
  }

  // ── AI ────────────────────────────────────────────────────────────────────────
  async function runAiRecommend() {
    setAiPanel({ loading: true });
    try {
      const result = await api.post(`/api/recommendations/shift/${id}`);
      setAiPanel({ recommendations: result.recommendations || [] });
    } catch {
      showToast("AI recommendation failed.", "error");
      setAiPanel(null);
    }
  }

  async function aiAssignStaff(staffId, taskId, staffName) {
    setAiAssigning(Number(staffId));
    try {
      const res = await api.post(`/api/shifts/tasks/${taskId}/assign`, { staff_id: Number(staffId) });
      if (!res.success) throw new Error(res.message);
      await reloadTasks();
      setAiPanel(null);
      showToast(`${staffName} assigned successfully.`);
    } catch (err) {
      showToast(err.message || "Failed to assign staff.", "error");
    } finally { setAiAssigning(null); }
  }

  // ── Publish ───────────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true);
    const warnings = tasks
      .filter(t => t.status === "open")
      .map(t => `"${t.title}" has no staff assigned`);

    const allAssignedIds = tasks.flatMap(t => t.task_assignments || []).map(a => a.staff_id).filter(Boolean);
    const hardBlocks = [];

    if (allAssignedIds.length > 0) {
      const { data: leaveRows } = await supabase
        .from("availability").select("staff_id").eq("status", "approved")
        .lte("start_date", shift.shift_date).gte("end_date", shift.shift_date)
        .in("staff_id", allAssignedIds);
      (leaveRows || []).forEach(l => {
        const task = tasks.find(t => t.task_assignments?.[0]?.staff_id === l.staff_id);
        const name = task?.task_assignments?.[0]?.staff?.users?.full_name || "A staff member";
        hardBlocks.push(`${name} has approved leave on this date`);
      });
    }

    setPublishing(false);
    if (hardBlocks.length > 0 || warnings.length > 0) {
      setConflictModal({ hardBlocks, warnings }); return;
    }
    await doPublish();
  }

  async function doPublish() {
    setPublishing(true);
    const { error } = await supabase.from("shifts").update({ status: "published" }).eq("shift_id", id);
    setPublishing(false);
    if (error) { showToast("Failed to publish.", "error"); return; }
    setShift(prev => ({ ...prev, status: "published" }));
    showToast("Shift published successfully!");
    setConflictModal(null);
  }

  async function handleUnpublish() {
    await supabase.from("shifts").update({ status: "draft" }).eq("shift_id", id);
    setShift(prev => ({ ...prev, status: "draft" }));
    showToast("Shift moved back to draft.");
  }

  function handleCancelShift() {
    setConfirmModal({
      title: "Cancel this shift?",
      body: <>Mark <strong>{shift?.title || "this shift"}</strong> as cancelled.</>,
      confirmLabel: "Cancel Shift", danger: true,
      onConfirm: async () => {
        await supabase.from("shifts").update({ status: "cancelled" }).eq("shift_id", id);
        setShift(prev => ({ ...prev, status: "cancelled" }));
        showToast("Shift cancelled.");
      },
    });
  }

  function handleDelete() {
    setConfirmModal({
      title: "Delete this shift?",
      body: <>Permanently delete <strong>{shift?.title || "this shift"}</strong> and all its tasks.</>,
      confirmLabel: "Delete Shift", danger: true,
      onConfirm: async () => {
        await supabase.from("shifts").delete().eq("shift_id", id);
        goTo("/outlet-manager/shifts");
      },
    });
  }

  // ── Loading / not found ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <ManagerLayout title="Shift Detail">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Shimmer w="120px" h="14px" />
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" }}>
            <Shimmer w="200px" h="22px" r="6px" />
            <div style={{ marginTop: "10px" }}><Shimmer w="300px" h="14px" /></div>
          </div>
          {[1,2,3].map(i => (
            <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
              <Shimmer w="160px" h="16px" />
              <div style={{ marginTop: "12px" }}><Shimmer w="100%" h="48px" r="10px" /></div>
            </div>
          ))}
        </div>
      </ManagerLayout>
    );
  }

  if (!shift) return <ManagerLayout title="Shift Detail"><div style={s.empty}>Shift not found.</div></ManagerLayout>;

  const totalTasks    = tasks.length;
  const assignedTasks = tasks.filter(t => t.status === "assigned" || t.status === "done").length;
  const isFullyStaffed = totalTasks > 0 && assignedTasks >= totalTasks;

  return (
    <ManagerLayout title="Shift Detail">
      <button style={s.back} onClick={() => goTo("/outlet-manager/shifts")}>← Back to Shifts</button>

      {/* ── Shift header card ── */}
      <div style={s.shiftCard}>
        <div style={s.shiftCardTop}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={s.shiftTitleRow}>
              <h2 style={s.shiftTitle}>{shift.title || "Untitled Shift"}</h2>
              <span style={{ ...s.badge, ...STATUS_STYLES[shift.status] }}>{shift.status}</span>
            </div>
            <div style={s.shiftMetaRow}>
              <span style={s.shiftMetaPill}><Calendar size={11} /> {fmtDate(shift.shift_date)}</span>
              <span style={s.shiftMetaPill}><Clock size={11} /> {toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</span>
              {shift.outlets?.name && <span style={s.shiftMetaPill}><MapPin size={11} /> {shift.outlets.name}</span>}
              {shift.deadline && (
                <span style={{ ...s.shiftMetaPill, background:"#FFFBEB", color:"#D97706", border:"1px solid #FDE68A" }}>
                  <Calendar size={11} /> Due {new Date(shift.deadline).toLocaleDateString("en-SG", { day:"numeric", month:"short" })}
                </span>
              )}
            </div>
          </div>
          <div style={s.shiftActions}>
            {shift.status === "draft" && (
              <button style={s.deleteIconBtn} onClick={handleDelete} title="Delete shift">
                <Trash2 size={15} />
              </button>
            )}
            {shift.status !== "completed" && shift.status !== "cancelled" && (
              <button style={s.aiBtn}
                onClick={aiPanel ? () => setAiPanel(null) : runAiRecommend}
                disabled={aiPanel?.loading}>
                {aiPanel?.loading
                  ? <span style={{ animation:"aiPulse 1.2s ease infinite" }}><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}} />Thinking…</span>
                  : aiPanel
                    ? <><X size={14} style={{verticalAlign:"middle",marginRight:4}} />Close AI</>
                    : <><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}} />Smart Recommend</>}
              </button>
            )}
            {shift.status === "draft" && (
              <>
                <button
                  style={{ ...s.publishBtn, ...(!isFullyStaffed && totalTasks > 0 ? { background: "#D97706" } : {}) }}
                  onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Checking…" : "Publish Shift"}
                </button>
                <button style={s.cancelShiftBtn} onClick={handleCancelShift}>Cancel</button>
              </>
            )}
            {shift.status === "published" && (
              <>
                <button style={s.unpublishBtn} onClick={handleUnpublish}>Move to Draft</button>
                <button style={s.cancelShiftBtn} onClick={handleCancelShift}>Cancel Shift</button>
              </>
            )}
          </div>
        </div>

        {/* Staffing progress */}
        <div style={s.staffingSummary}>
          <div style={s.staffingBar}>
            <div style={{
              ...s.staffingFill,
              width: totalTasks > 0 ? `${Math.min(100,(assignedTasks/totalTasks)*100)}%` : "0%",
              background: isFullyStaffed ? "#22C55E" : "#F59E0B",
            }} />
          </div>
          <span style={s.staffingText}>
            {assignedTasks}/{totalTasks} tasks filled{isFullyStaffed && totalTasks > 0 ? " · Ready ✓" : ""}
          </span>
        </div>
      </div>

      {/* ── AI Panel ── */}
      {aiPanel && !aiPanel.loading && (
        <div style={s.aiPanel}>
          <div style={s.aiPanelHeader}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <span style={s.aiIcon}>✦</span>
              <span style={s.aiPanelTitle}>AI Staff Recommendations</span>
            </div>
            <span style={s.aiPanelSub}>Powered by Groq · Click Assign to apply</span>
          </div>
          {(aiPanel.recommendations || []).length === 0 ? (
            <p style={{ fontSize:"13px", color:"#64748B", padding:"12px 0" }}>All tasks are staffed — nothing to recommend.</p>
          ) : (aiPanel.recommendations || []).map(rec => (
            <div key={rec.task_id || rec.role_id} style={s.aiRoleBlock}>
              <p style={s.aiRoleName}>{rec.task_name || rec.role_name}</p>
              {(rec.suggestions || []).map((sug, i) => (
                <div key={sug.staff_id} style={{ ...s.aiSugRow, borderColor: i===0?"#A5B4FC":"#E2E8F0", background: i===0?"#F5F3FF":"#FAFAFA" }}>
                  <div style={{ ...s.aiRank, background: i===0?"#6366F1":"#CBD5E1" }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                      <p style={s.aiSugName}>{sug.name}</p>
                      <span style={{ ...s.confBadge, background: sug.confidence==="high"?"#DCFCE7":sug.confidence==="medium"?"#FFFBEB":"#FEE2E2", color: sug.confidence==="high"?"#166534":sug.confidence==="medium"?"#92400E":"#991B1B" }}>{sug.confidence}</span>
                    </div>
                    <p style={s.aiSugReason}>{sug.reason}</p>
                  </div>
                  <button
                    style={{ ...s.aiAssignBtn, opacity: aiAssigning===sug.staff_id ? 0.6 : 1, background: i===0?"#6366F1":"#2563EB" }}
                    disabled={!!aiAssigning}
                    onClick={() => aiAssignStaff(sug.staff_id, rec.task_id || rec.role_id, sug.name)}>
                    {aiAssigning===sug.staff_id ? "…" : "Assign"}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Tasks section header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" }}>
        <h3 style={{ ...s.sectionTitle, margin:0 }}>Tasks ({totalTasks})</h3>
        {shift.status !== "completed" && shift.status !== "cancelled" && (
          <button
            onClick={() => { setShowTaskForm(v => !v); setTaskForm({ title:"", skill_id:"", start_time:"", end_time:"" }); }}
            style={{ background: showTaskForm?"#F1F5F9":"#2563EB", color: showTaskForm?"#64748B":"#FFF", border:"none", padding:"8px 16px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
            {showTaskForm ? "Cancel" : "+ Add Task"}
          </button>
        )}
      </div>

      {/* ── Add task inline form ── */}
      {showTaskForm && (
        <div style={{ background:"#F8FAFC", border:"1.5px solid #BFDBFE", borderRadius:"14px", padding:"20px", marginBottom:"20px" }}>
          <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", marginBottom:"16px" }}>New Task</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 180px 100px 100px", gap:"12px", marginBottom:"16px" }}>
            <div>
              <label style={s.formLabel}>Task Name *</label>
              <input style={s.formInput} placeholder="e.g. Cashier, Barista, Kitchen…"
                value={taskForm.title}
                onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label style={s.formLabel}>Required Skill (optional)</label>
              <select style={s.formInput} value={taskForm.skill_id}
                onChange={e => setTaskForm(p => ({ ...p, skill_id: e.target.value }))}>
                <option value="">No specific skill</option>
                {skillOptions.map(sk => <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
              </select>
            </div>
            <div>
              <label style={s.formLabel}>Start (opt.)</label>
              <input style={s.formInput} type="time" value={taskForm.start_time}
                onChange={e => setTaskForm(p => ({ ...p, start_time: e.target.value }))} />
            </div>
            <div>
              <label style={s.formLabel}>End (opt.)</label>
              <input style={s.formInput} type="time" value={taskForm.end_time}
                onChange={e => setTaskForm(p => ({ ...p, end_time: e.target.value }))} />
            </div>
          </div>
          <button onClick={addTask} disabled={savingTask}
            style={{ background: savingTask?"#93C5FD":"#2563EB", color:"#FFF", border:"none", padding:"9px 22px", borderRadius:"9px", fontSize:"14px", fontWeight:"700", cursor: savingTask?"default":"pointer" }}>
            {savingTask ? "Adding…" : "Add Task"}
          </button>
        </div>
      )}

      {/* ── Task cards ── */}
      {tasks.length === 0 ? (
        <div style={{ textAlign:"center", padding:"48px 20px", background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px" }}>
          <div style={{ marginBottom:"12px", opacity:0.4 }}><Tag size={36} color="#64748B" /></div>
          <p style={{ fontSize:"15px", fontWeight:"600", color:"#64748B", marginBottom:"4px" }}>No tasks yet</p>
          <p style={{ fontSize:"13px", color:"#94A3B8" }}>Click "+ Add Task" above to define the work for this shift.</p>
        </div>
      ) : (
        tasks.map(task => {
          const assignee = task.task_assignments?.[0];
          const st = TASK_STATUS_STYLES[task.status] || TASK_STATUS_STYLES.open;
          const staffName = assignee?.staff?.users?.full_name || null;
          const taskStart = task.start_time ? toHHMM(task.start_time) : null;
          const taskEnd   = task.end_time   ? toHHMM(task.end_time)   : null;

          return (
            <div key={task.task_id} style={{ ...s.taskCard, animation:"fadeSlideUp 0.3s ease both" }}>
              <div style={s.taskCardLeft}>
                <div style={s.taskCardTop}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                      <p style={s.taskTitle}>{task.title}</p>
                      <span style={{ ...s.taskStatusBadge, background: st.background, color: st.color }}>{st.label}</span>
                    </div>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginTop:"5px" }}>
                      {task.skills?.name && (
                        <span style={s.skillTag}><Tag size={10} /> {task.skills.name}</span>
                      )}
                      {taskStart && (
                        <span style={s.timeTag}><Clock size={10} /> {taskStart} – {taskEnd || "?"}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:"6px", alignItems:"center", flexShrink:0 }}>
                    {!assignee && shift.status !== "completed" && shift.status !== "cancelled" && (
                      <button style={s.assignBtn} onClick={() => openAssignModal(task)}>
                        Assign Staff
                      </button>
                    )}
                    {shift.status !== "completed" && shift.status !== "cancelled" && (
                      <button style={s.deleteTaskBtn} onClick={() => deleteTask(task)} title="Delete task">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Assignee row */}
                {assignee ? (
                  <div style={s.assigneeRow}>
                    <div style={s.assigneeAvatar}>
                      {staffName?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={s.assigneeName}>{staffName || "Unknown"}</p>
                      <p style={s.assigneeEmail}>{assignee.staff?.users?.email || ""}</p>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      {assignee.acknowledged
                        ? <span style={s.ackTagYes}><Check size={10} /> Acknowledged</span>
                        : <span style={s.ackTagNo}>Pending</span>}
                      {shift.status !== "completed" && shift.status !== "cancelled" && (
                        <button style={s.removeAssigneeBtn}
                          title="Remove assignment"
                          onClick={() => unassignStaff(task)}
                          onMouseEnter={e => e.currentTarget.style.color="#EF4444"}
                          onMouseLeave={e => e.currentTarget.style.color="#94A3B8"}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={s.emptyAssignee}>No staff assigned — click Assign Staff to fill this task.</div>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ── Assign Staff Modal ── */}
      {assignModal && (
        <div style={s.modalOverlay} onClick={() => setAssignModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Assign Staff — {assignModal.task.title}</h3>
              <button style={s.closeBtn} onClick={() => setAssignModal(null)}><X size={18} /></button>
            </div>
            {assignModal.task.skills?.name && (
              <p style={s.modalSubtitle}>Required skill: <strong>{assignModal.task.skills.name}</strong></p>
            )}
            {loadingCandidates ? (
              <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginTop:"12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="56px" r="10px" />)}
              </div>
            ) : candidates.length === 0 ? (
              <div style={s.empty}>No available staff found.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginTop:"12px" }}>
                {candidates.map((c, i) => {
                  const isTop = i < 3 && c.hasSkill && !c.isOnLeave && !c.isDouble;
                  const isUnavailable = c.isOnLeave || c.isDouble;
                  return (
                    <div key={c.staff_id} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:`1px solid ${isTop?"#BFDBFE":"#E2E8F0"}`, background: isTop?"#F0F7FF":"#FAFAFA", opacity: isUnavailable?0.6:1 }}>
                      <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"#2563EB", color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"700", flexShrink:0 }}>
                        {c.full_name[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                          <p style={{ fontSize:"13px", fontWeight:"600", color:"#1E293B" }}>{c.full_name}</p>
                          {isTop && <span style={{ fontSize:"10px", fontWeight:"700", color:"#1D4ED8", background:"#DBEAFE", padding:"2px 6px", borderRadius:"100px" }}>Recommended</span>}
                        </div>
                        <div style={{ display:"flex", gap:"5px", flexWrap:"wrap", marginTop:"3px" }}>
                          {!c.hasSkill    && <span style={s.warningTag}>Missing skill</span>}
                          {c.isOnLeave    && <span style={s.warningTag}>On leave</span>}
                          {c.isDouble     && <span style={s.warningTag}>Double-booked</span>}
                          {c.hasSkill && !c.isOnLeave && !c.isDouble && (
                            <span style={s.okTag}>{c.staff_type === "regular" ? "Regular staff" : "Casual staff"}</span>
                          )}
                        </div>
                      </div>
                      <button
                        style={{ background:"#2563EB", border:"none", borderRadius:"7px", padding:"7px 14px", fontSize:"12px", fontWeight:"600", color:"#FFF", cursor:"pointer", flexShrink:0, opacity: assigning?0.6:1 }}
                        onClick={() => assignStaff(c.staff_id, assignModal.task.task_id)}
                        disabled={assigning}>
                        {assigning ? "…" : "Assign"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Conflict Modal ── */}
      {conflictModal && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modal, maxWidth:"480px" }}>
            <div style={s.modalHeader}>
              <h3 style={{ ...s.modalTitle, color:"#991B1B", display:"flex", alignItems:"center", gap:"6px" }}><AlertTriangle size={18} /> Publish Conflicts</h3>
              <button style={s.closeBtn} onClick={() => setConflictModal(null)}><X size={18} /></button>
            </div>
            {conflictModal.hardBlocks.length > 0 && (
              <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"10px", padding:"14px 16px", marginBottom:"12px" }}>
                <p style={{ fontSize:"12px", fontWeight:"700", color:"#991B1B", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.04em" }}>Cannot publish:</p>
                {conflictModal.hardBlocks.map((b, i) => <p key={i} style={{ fontSize:"13px", color:"#7F1D1D", marginBottom:"4px" }}>• {b}</p>)}
              </div>
            )}
            {conflictModal.warnings.length > 0 && (
              <div style={{ background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"10px", padding:"14px 16px", marginBottom:"12px" }}>
                <p style={{ fontSize:"12px", fontWeight:"700", color:"#92400E", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.04em" }}>Warnings:</p>
                {conflictModal.warnings.map((w, i) => <p key={i} style={{ fontSize:"13px", color:"#78350F", marginBottom:"4px" }}>• {w}</p>)}
              </div>
            )}
            <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"16px" }}>
              <button style={s.cancelConflictBtn} onClick={() => setConflictModal(null)}>Cancel</button>
              {conflictModal.hardBlocks.length === 0 && (
                <button style={{ background:"#D97706", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" }}
                  onClick={doPublish} disabled={publishing}>
                  {publishing ? "Publishing…" : "Publish Anyway"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div style={s.modalOverlay} onClick={() => !confirmBusy && setConfirmModal(null)}>
          <div style={{ ...s.modal, maxWidth:"400px", textAlign:"center" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:"48px", height:"48px", borderRadius:"50%", margin:"0 auto 14px", background: confirmModal.danger?"#FEF2F2":"#EFF6FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <AlertTriangle size={22} color={confirmModal.danger?"#EF4444":"#2563EB"} />
            </div>
            <h3 style={{ fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"8px" }}>{confirmModal.title}</h3>
            <p style={{ fontSize:"13.5px", color:"#64748B", lineHeight:1.6, marginBottom:"22px" }}>{confirmModal.body}</p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button style={s.cancelConflictBtn} onClick={() => setConfirmModal(null)} disabled={confirmBusy}>Cancel</button>
              <button
                style={{ background: confirmModal.danger?"#EF4444":"#2563EB", border:"none", borderRadius:"9px", padding:"8px 18px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer", opacity: confirmBusy?0.6:1 }}
                disabled={confirmBusy}
                onClick={async () => {
                  setConfirmBusy(true);
                  try { await confirmModal.onConfirm(); setConfirmModal(null); }
                  finally { setConfirmBusy(false); }
                }}>
                {confirmBusy ? "Working…" : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", zIndex:9999, background: toast.type==="success"?"#22C55E":"#EF4444", color:"#FFF", padding:"12px 20px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.15)", animation:"toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"long", year:"numeric", month:"long", day:"numeric" });
}

function toHHMM(t) {
  if (!t) return "";
  const s = String(t);
  if (s.includes("T")) return s.slice(11, 16); // ISO: "1970-01-01T08:00:00.000Z"
  return s.slice(0, 5);                         // already "HH:MM"
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer", marginBottom:"20px", padding:0 },
  empty: { textAlign:"center", padding:"40px", color:"#64748B", fontSize:"14px" },
  shiftCard: { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"22px 24px", marginBottom:"24px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  shiftCardTop: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"18px", flexWrap:"wrap", gap:"14px" },
  shiftTitleRow: { display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px", flexWrap:"wrap" },
  shiftTitle: { fontSize:"20px", fontWeight:"800", color:"#0F172A", letterSpacing:"-0.3px" },
  badge: { display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"700", textTransform:"capitalize" },
  shiftMetaRow: { display:"flex", flexWrap:"wrap", gap:"6px" },
  shiftMetaPill: { display:"inline-flex", alignItems:"center", gap:"5px", fontSize:"12px", color:"#475569", background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"100px", padding:"3px 10px", fontWeight:"500" },
  shiftActions: { display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" },
  deleteIconBtn: { display:"flex", alignItems:"center", justifyContent:"center", width:"34px", height:"34px", background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"9px", color:"#EF4444", cursor:"pointer", padding:0, flexShrink:0 },
  publishBtn: { background:"#2563EB", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" },
  unpublishBtn: { background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"9px", padding:"8px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  cancelShiftBtn: { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"9px", padding:"8px 14px", fontSize:"13px", fontWeight:"600", color:"#991B1B", cursor:"pointer" },
  staffingSummary: { display:"flex", alignItems:"center", gap:"12px" },
  staffingBar: { flex:1, height:"6px", background:"#F1F5F9", borderRadius:"100px", overflow:"hidden" },
  staffingFill: { height:"100%", borderRadius:"100px", transition:"width 0.3s ease" },
  staffingText: { fontSize:"13px", color:"#64748B", fontWeight:"500", whiteSpace:"nowrap" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1E293B", marginBottom:"14px" },
  formLabel: { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" },
  formInput: { display:"block", width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px", color:"#1E293B", background:"#FFF", boxSizing:"border-box" },
  // Task card
  taskCard: { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"18px 20px", marginBottom:"12px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" },
  taskCardLeft: { flex:1 },
  taskCardTop: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"12px", gap:"10px" },
  taskTitle: { fontSize:"15px", fontWeight:"700", color:"#0F172A" },
  taskStatusBadge: { fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", letterSpacing:"0.02em" },
  skillTag: { display:"inline-flex", alignItems:"center", gap:"4px", fontSize:"11px", fontWeight:"600", color:"#6D28D9", background:"#EDE9FE", border:"1px solid #DDD6FE", borderRadius:"100px", padding:"2px 8px" },
  timeTag: { display:"inline-flex", alignItems:"center", gap:"4px", fontSize:"11px", fontWeight:"500", color:"#0369A1", background:"#F0F9FF", border:"1px solid #BAE6FD", borderRadius:"100px", padding:"2px 8px" },
  assignBtn: { background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"7px", padding:"5px 12px", fontSize:"12px", fontWeight:"600", color:"#1D4ED8", cursor:"pointer" },
  deleteTaskBtn: { display:"flex", alignItems:"center", justifyContent:"center", width:"28px", height:"28px", background:"none", border:"1px solid #E2E8F0", borderRadius:"7px", color:"#CBD5E1", cursor:"pointer", padding:0, flexShrink:0 },
  assigneeRow: { display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:"10px" },
  assigneeAvatar: { width:"30px", height:"30px", borderRadius:"50%", background:"#22C55E", color:"#FFF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"700", flexShrink:0 },
  assigneeName: { fontSize:"13px", fontWeight:"600", color:"#1E293B" },
  assigneeEmail: { fontSize:"11px", color:"#64748B" },
  ackTagYes: { display:"inline-flex", alignItems:"center", gap:"4px", fontSize:"11px", color:"#059669", fontWeight:"600", background:"#ECFDF5", padding:"2px 7px", borderRadius:"100px" },
  ackTagNo: { fontSize:"11px", color:"#D97706", fontWeight:"500", background:"#FFFBEB", padding:"2px 7px", borderRadius:"100px" },
  removeAssigneeBtn: { background:"none", border:"none", fontSize:"13px", color:"#94A3B8", cursor:"pointer", padding:"2px 5px", lineHeight:1 },
  emptyAssignee: { fontSize:"12px", color:"#94A3B8", padding:"8px 0 2px", fontStyle:"italic" },
  // Modal
  modalOverlay: { position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" },
  modal: { background:"#FFF", borderRadius:"16px", padding:"28px", width:"100%", maxWidth:"560px", maxHeight:"80vh", overflowY:"auto", animation:"modalIn 0.25s ease both", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  modalHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" },
  modalTitle: { fontSize:"17px", fontWeight:"700", color:"#1E293B" },
  modalSubtitle: { fontSize:"13px", color:"#64748B", marginBottom:"14px" },
  closeBtn: { background:"none", border:"none", fontSize:"18px", color:"#94A3B8", cursor:"pointer", padding:"2px 6px", lineHeight:1 },
  warningTag: { fontSize:"10px", fontWeight:"600", color:"#991B1B", background:"#FEE2E2", padding:"2px 6px", borderRadius:"100px" },
  okTag: { fontSize:"10px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"2px 6px", borderRadius:"100px" },
  cancelConflictBtn: { background:"#F1F5F9", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer" },
  // AI panel
  aiBtn: { background:"linear-gradient(135deg,#6366F1,#8B5CF6)", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" },
  aiPanel: { background:"linear-gradient(135deg,#F5F3FF,#EEF2FF)", border:"1.5px solid #C4B5FD", borderRadius:"14px", padding:"20px", marginBottom:"24px", animation:"aiPanelIn 0.3s ease both" },
  aiPanelHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px", flexWrap:"wrap", gap:"6px" },
  aiIcon: { fontSize:"16px", color:"#6366F1" },
  aiPanelTitle: { fontSize:"15px", fontWeight:"700", color:"#4338CA" },
  aiPanelSub: { fontSize:"11px", color:"#7C3AED", opacity:0.7 },
  aiRoleBlock: { marginBottom:"16px" },
  aiRoleName: { fontSize:"12px", fontWeight:"700", color:"#6D28D9", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"8px" },
  aiSugRow: { display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px", borderRadius:"10px", border:"1px solid #E2E8F0", marginBottom:"6px" },
  aiRank: { width:"22px", height:"22px", borderRadius:"50%", color:"#FFF", fontSize:"11px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  aiSugName: { fontSize:"13px", fontWeight:"600", color:"#1E293B" },
  confBadge: { fontSize:"10px", fontWeight:"700", padding:"2px 6px", borderRadius:"100px" },
  aiSugReason: { fontSize:"12px", color:"#64748B", marginTop:"2px", lineHeight:1.4 },
  aiAssignBtn: { border:"none", borderRadius:"7px", padding:"7px 14px", fontSize:"12px", fontWeight:"700", color:"#FFF", cursor:"pointer", flexShrink:0 },
};
