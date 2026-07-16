import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import {
  Sparkles, X, AlertTriangle, Trash2, Calendar, Clock, MapPin,
  Tag, Check, Users, GripVertical, ChevronDown, ChevronUp, Search,
} from "lucide-react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";

if (typeof document !== "undefined" && !document.getElementById("sd2-styles")) {
  const style = document.createElement("style");
  style.id = "sd2-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0}to{background-position:600px 0} }
    @keyframes modalIn { from{opacity:0;transform:scale(0.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
    @keyframes aiPulse { 0%,100%{opacity:1}50%{opacity:0.45} }
    @keyframes panelIn { from{opacity:0;transform:translateX(28px)}to{opacity:1;transform:translateX(0)} }
    @keyframes dropPulse { 0%,100%{border-color:#93C5FD}50%{border-color:#2563EB} }
    @keyframes aiNoteIn { from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background:"#F3F4F6", color:"#6B7280" },
  published: { background:"#DCFCE7", color:"#166534" },
  completed: { background:"#DBEAFE", color:"#1E40AF" },
  cancelled: { background:"#FEE2E2", color:"#991B1B" },
};
const TASK_STATUS = {
  open:     { bg:"#FEF3C7", color:"#92400E", label:"Open" },
  assigned: { bg:"#DCFCE7", color:"#166534", label:"Assigned" },
  done:     { bg:"#DBEAFE", color:"#1E40AF", label:"Done" },
};

function Shimmer({ w="100%", h="16px", r="8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}
function toHHMM(t) {
  if (!t) return ""; const s=String(t);
  return s.includes("T") ? s.slice(11,16) : s.slice(0,5);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
}

export default function ShiftDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const goTo   = useGoTo();
  const user   = getUser();

  // ── Core state ─────────────────────────────────────────────────────────────
  const [shift, setShift]       = useState(null);
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast]       = useState(null);

  // ── Add-task form ──────────────────────────────────────────────────────────
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskForm, setTaskForm]         = useState({ title:"", skill_id:"", start_time:"", end_time:"" });
  const [skillOptions, setSkillOptions] = useState([]);
  const [savingTask, setSavingTask]     = useState(false);

  // ── Roster drawer ──────────────────────────────────────────────────────────
  const [rosterOpen, setRosterOpen]         = useState(false);
  const [roster, setRoster]                 = useState([]);
  const [loadingRoster, setLoadingRoster]   = useState(false);
  const [rosterSearch, setRosterSearch]     = useState("");
  const [rosterFilter, setRosterFilter]     = useState("all"); // all | available | skilled
  const [highlightTaskId, setHighlightTaskId] = useState(null);

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const [dragOverTaskId, setDragOverTaskId] = useState(null);
  const [droppingTaskId, setDroppingTaskId] = useState(null);

  // ── AI notes (per task, non-blocking) ─────────────────────────────────────
  const [aiNotes, setAiNotes] = useState({});

  // ── Modals ─────────────────────────────────────────────────────────────────
  const [conflictModal, setConflictModal] = useState(null);
  const [confirmModal, setConfirmModal]   = useState(null);
  const [confirmBusy, setConfirmBusy]     = useState(false);

  // ── AI Recommend panel ─────────────────────────────────────────────────────
  const [aiPanel, setAiPanel]     = useState(null);
  const [aiAssigning, setAiAssigning] = useState(null);

  // ─────────────────────────────────────────────────────────────────────────
  function showToast(msg, type="success") {
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
        const [res, { data: skills }] = await Promise.all([
          api.get(`/api/shifts/${id}`),
          supabase.from("skills").select("skill_id,name").order("name"),
        ]);
        if (!cancelled && res.success) {
          setShift(res.shift);
          setTasks(res.shift?.shift_tasks || []);
          setSkillOptions(skills || []);
        }
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  // ── Roster ─────────────────────────────────────────────────────────────────
  async function openRoster(taskId) {
    setHighlightTaskId(taskId || null);
    setRosterOpen(true);
    if (roster.length > 0) { await refreshRoster(); return; }
    setLoadingRoster(true);
    try {
      const res = await api.get(`/api/shifts/${id}/staff-roster`);
      if (res.success) setRoster(res.roster);
    } catch (err) { showToast(`Roster error: ${err.message}`, "error"); }
    finally { setLoadingRoster(false); }
  }

  async function refreshRoster() {
    try {
      const res = await api.get(`/api/shifts/${id}/staff-roster`);
      if (res.success) setRoster(res.roster);
    } catch {}
  }

  // ── Add task ───────────────────────────────────────────────────────────────
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
      setTaskForm({ title:"", skill_id:"", start_time:"", end_time:"" });
      setShowTaskForm(false);
      showToast(`Task "${res.task.title}" added.`);
    } catch { showToast("Failed to add task.", "error"); }
    finally { setSavingTask(false); }
  }

  // ── Delete task ────────────────────────────────────────────────────────────
  function deleteTask(task) {
    setConfirmModal({
      title: "Delete this task?",
      body: <>Delete <strong>{task.title}</strong>? Any assignment will also be removed.</>,
      confirmLabel: "Delete", danger: true,
      onConfirm: async () => {
        await api.delete(`/api/shifts/tasks/${task.task_id}`);
        setTasks(prev => prev.filter(t => t.task_id !== task.task_id));
        setAiNotes(prev => { const n={...prev}; delete n[task.task_id]; return n; });
        showToast("Task deleted.");
      },
    });
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────
  function handleDragStart(e, staff) {
    e.dataTransfer.setData("staff_id",   String(staff.staff_id));
    e.dataTransfer.setData("staff_name", staff.full_name);
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleDragOver(e, taskId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverTaskId(taskId);
  }

  function handleDragLeave(e, taskId) {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTaskId(null);
  }

  async function handleDrop(e, task) {
    e.preventDefault();
    setDragOverTaskId(null);
    const staffId   = e.dataTransfer.getData("staff_id");
    const staffName = e.dataTransfer.getData("staff_name");
    if (!staffId) return;
    if (task.task_assignments?.[0]) { showToast("This task already has an assignee.", "error"); return; }

    setDroppingTaskId(task.task_id);
    try {
      const res = await api.post(`/api/shifts/tasks/${task.task_id}/assign`, { staff_id: Number(staffId) });
      if (!res.success) throw new Error(res.message);
      await reloadTasks();
      await refreshRoster();
      showToast(`${staffName} assigned to "${task.title}"`);

      // AI validate — non-blocking
      setAiNotes(prev => ({ ...prev, [task.task_id]: { loading: true } }));
      api.post(`/api/shifts/tasks/${task.task_id}/validate-assignment`, {
        staff_id: Number(staffId), roster,
      }).then(aiRes => {
        if (aiRes.success) {
          setAiNotes(prev => ({ ...prev, [task.task_id]: {
            suitable: aiRes.suitable, message: aiRes.message,
            alternative: aiRes.alternative, loading: false, dismissed: false,
          }}));
        } else { setAiNotes(prev => ({ ...prev, [task.task_id]: null })); }
      }).catch(() => { setAiNotes(prev => ({ ...prev, [task.task_id]: null })); });
    } catch (err) { showToast(err.message || "Failed to assign.", "error"); }
    finally { setDroppingTaskId(null); }
  }

  // ── Unassign ───────────────────────────────────────────────────────────────
  function unassignStaff(task) {
    const name = task.task_assignments?.[0]?.staff?.users?.full_name || "this staff member";
    const doIt = async () => {
      await api.delete(`/api/shifts/tasks/${task.task_id}/assign`);
      await reloadTasks();
      await refreshRoster();
      setAiNotes(prev => { const n={...prev}; delete n[task.task_id]; return n; });
      showToast("Assignment removed.");
    };
    if (shift.status === "published") {
      setConfirmModal({
        title: "Remove assignment?",
        body: <><strong>{name}</strong> may have already seen their schedule. Remove them anyway?</>,
        confirmLabel: "Remove", danger: true, onConfirm: doIt,
      });
    } else { doIt(); }
  }

  // ── AI Recommend ───────────────────────────────────────────────────────────
  async function runAiRecommend() {
    setAiPanel({ loading: true });
    try {
      const result = await api.post(`/api/recommendations/shift/${id}`);
      setAiPanel({ recommendations: result.recommendations || [] });
    } catch { showToast("AI recommendation failed.", "error"); setAiPanel(null); }
  }

  async function aiAssignStaff(staffId, taskId, staffName) {
    setAiAssigning(Number(staffId));
    try {
      const res = await api.post(`/api/shifts/tasks/${taskId}/assign`, { staff_id: Number(staffId) });
      if (!res.success) throw new Error(res.message);
      await reloadTasks();
      await refreshRoster();
      setAiPanel(null);
      showToast(`${staffName} assigned.`);
    } catch (err) { showToast(err.message || "Failed.", "error"); }
    finally { setAiAssigning(null); }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true);
    const warnings = tasks.filter(t => t.status === "open").map(t => `"${t.title}" has no staff assigned`);
    const allIds   = tasks.flatMap(t => t.task_assignments||[]).map(a=>a.staff_id).filter(Boolean);
    const hardBlocks = [];
    if (allIds.length > 0) {
      const { data: leave } = await supabase.from("availability").select("staff_id").eq("status","approved")
        .lte("start_date", shift.shift_date).gte("end_date", shift.shift_date).in("staff_id", allIds);
      (leave||[]).forEach(l => {
        const task = tasks.find(t => t.task_assignments?.[0]?.staff_id === l.staff_id);
        const n    = task?.task_assignments?.[0]?.staff?.users?.full_name || "A staff member";
        hardBlocks.push(`${n} has approved leave on this date`);
      });
    }
    setPublishing(false);
    if (hardBlocks.length > 0 || warnings.length > 0) { setConflictModal({ hardBlocks, warnings }); return; }
    await doPublish();
  }

  async function doPublish() {
    setPublishing(true);
    const { error } = await supabase.from("shifts").update({ status:"published" }).eq("shift_id", id);
    setPublishing(false);
    if (error) { showToast("Failed to publish.", "error"); return; }
    setShift(p => ({ ...p, status:"published" }));
    showToast("Shift published!");
    setConflictModal(null);
  }

  async function handleUnpublish() {
    await supabase.from("shifts").update({ status:"draft" }).eq("shift_id", id);
    setShift(p => ({ ...p, status:"draft" }));
    showToast("Moved to draft.");
  }

  function handleCancelShift() {
    setConfirmModal({ title:"Cancel this shift?", body:<>Mark <strong>{shift?.title||"this shift"}</strong> as cancelled.</>, confirmLabel:"Cancel Shift", danger:true, onConfirm: async () => {
      await supabase.from("shifts").update({ status:"cancelled" }).eq("shift_id", id);
      setShift(p => ({ ...p, status:"cancelled" }));
      showToast("Shift cancelled.");
    }});
  }

  function handleDelete() {
    setConfirmModal({ title:"Delete this shift?", body:<>Permanently delete <strong>{shift?.title||"this shift"}</strong> and all its tasks.</>, confirmLabel:"Delete Shift", danger:true, onConfirm: async () => {
      await supabase.from("shifts").delete().eq("shift_id", id);
      goTo("/outlet-manager/shifts");
    }});
  }

  // ── Derived ────────────────────────────────────────────────────────────────
  const totalTasks    = tasks.length;
  const assignedTasks = tasks.filter(t => t.status==="assigned"||t.status==="done").length;
  const isFullyStaffed = totalTasks>0 && assignedTasks>=totalTasks;

  const activeTask = highlightTaskId ? tasks.find(t=>t.task_id===highlightTaskId) : null;

  // Filtered roster
  const filteredRoster = roster.filter(s => {
    if (rosterSearch && !s.full_name.toLowerCase().includes(rosterSearch.toLowerCase())) return false;
    if (rosterFilter==="available" && (s.is_on_leave||s.is_double_booked||s.already_assigned)) return false;
    if (rosterFilter==="skilled" && activeTask?.skill_id && !s.skills.some(sk=>sk.skill_id===activeTask.skill_id)) return false;
    return true;
  });

  const canAssign = shift?.status!=="completed" && shift?.status!=="cancelled";

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <ManagerLayout title="Shift Detail">
      <div style={{display:"flex",flexDirection:"column",gap:"16px"}}>
        <Shimmer w="120px" h="14px"/>
        <div style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:"14px",padding:"24px"}}><Shimmer w="200px" h="22px" r="6px"/><div style={{marginTop:"10px"}}><Shimmer w="300px" h="14px"/></div></div>
        {[1,2,3].map(i=><div key={i} style={{background:"#FFF",border:"1px solid #E2E8F0",borderRadius:"14px",padding:"20px"}}><Shimmer w="160px" h="16px"/><div style={{marginTop:"12px"}}><Shimmer w="100%" h="48px" r="10px"/></div></div>)}
      </div>
    </ManagerLayout>
  );

  if (!shift) return <ManagerLayout title="Shift Detail"><div style={s.empty}>Shift not found.</div></ManagerLayout>;

  return (
    <ManagerLayout title="Shift Detail">
      <button style={s.back} onClick={() => goTo("/outlet-manager/shifts")}>← Back to Shifts</button>

      {/* ── Shift header ── */}
      <div style={s.shiftCard}>
        <div style={s.shiftCardTop}>
          <div style={{flex:1,minWidth:0}}>
            <div style={s.shiftTitleRow}>
              <h2 style={s.shiftTitle}>{shift.title||"Untitled Shift"}</h2>
              <span style={{...s.badge,...STATUS_STYLES[shift.status]}}>{shift.status}</span>
            </div>
            <div style={s.shiftMetaRow}>
              <span style={s.metaPill}><Calendar size={11}/> {fmtDate(shift.shift_date)}</span>
              <span style={s.metaPill}><Clock size={11}/> {toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</span>
              {shift.outlets?.name && <span style={s.metaPill}><MapPin size={11}/> {shift.outlets.name}</span>}
              {shift.deadline && <span style={{...s.metaPill,background:"#FFFBEB",color:"#D97706",border:"1px solid #FDE68A"}}><Calendar size={11}/> Due {new Date(shift.deadline).toLocaleDateString("en-SG",{day:"numeric",month:"short"})}</span>}
            </div>
          </div>
          <div style={s.shiftActions}>
            {shift.status==="draft" && <button style={s.deleteIconBtn} onClick={handleDelete} title="Delete"><Trash2 size={15}/></button>}
            {canAssign && (
              <button style={s.aiBtn} onClick={aiPanel ? ()=>setAiPanel(null) : runAiRecommend} disabled={aiPanel?.loading}>
                {aiPanel?.loading ? <span style={{animation:"aiPulse 1.2s ease infinite"}}><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}}/>Thinking…</span>
                  : aiPanel ? <><X size={14} style={{verticalAlign:"middle",marginRight:4}}/>Close AI</>
                  : <><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}}/>Smart Recommend</>}
              </button>
            )}
            {shift.status==="draft" && <>
              <button style={{...s.publishBtn,...(!isFullyStaffed&&totalTasks>0?{background:"#D97706"}:{})}} onClick={handlePublish} disabled={publishing}>{publishing?"Checking…":"Publish Shift"}</button>
              <button style={s.cancelBtn} onClick={handleCancelShift}>Cancel</button>
            </>}
            {shift.status==="published" && <>
              <button style={s.unpublishBtn} onClick={handleUnpublish}>Move to Draft</button>
              <button style={s.cancelBtn} onClick={handleCancelShift}>Cancel Shift</button>
            </>}
          </div>
        </div>
        <div style={s.staffingRow}>
          <div style={s.staffingBar}><div style={{...s.staffingFill,width:totalTasks>0?`${Math.min(100,(assignedTasks/totalTasks)*100)}%`:"0%",background:isFullyStaffed?"#22C55E":"#F59E0B"}}/></div>
          <span style={s.staffingText}>{assignedTasks}/{totalTasks} tasks filled{isFullyStaffed&&totalTasks>0?" · Ready ✓":""}</span>
        </div>
      </div>

      {/* ── AI Recommend Panel ── */}
      {aiPanel && !aiPanel.loading && (
        <div style={s.aiPanel}>
          <div style={s.aiPanelHeader}>
            <div style={{display:"flex",alignItems:"center",gap:"8px"}}><span style={{fontSize:"16px",color:"#6366F1"}}>✦</span><span style={{fontSize:"15px",fontWeight:"700",color:"#4338CA"}}>AI Staff Recommendations</span></div>
            <span style={{fontSize:"11px",color:"#7C3AED",opacity:.7}}>Powered by Groq</span>
          </div>
          {(aiPanel.recommendations||[]).length===0
            ? <p style={{fontSize:"13px",color:"#64748B",padding:"12px 0"}}>All tasks are staffed.</p>
            : (aiPanel.recommendations||[]).map(rec=>(
              <div key={rec.task_id||rec.role_id} style={{marginBottom:"16px"}}>
                <p style={{fontSize:"12px",fontWeight:"700",color:"#6D28D9",textTransform:"uppercase",letterSpacing:".05em",marginBottom:"8px"}}>{rec.task_name||rec.role_name}</p>
                {(rec.suggestions||[]).map((sug,i)=>(
                  <div key={sug.staff_id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderRadius:"10px",border:`1px solid ${i===0?"#A5B4FC":"#E2E8F0"}`,background:i===0?"#F5F3FF":"#FAFAFA",marginBottom:"6px"}}>
                    <div style={{width:"22px",height:"22px",borderRadius:"50%",background:i===0?"#6366F1":"#CBD5E1",color:"#FFF",fontSize:"11px",fontWeight:"800",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                        <p style={{fontSize:"13px",fontWeight:"600",color:"#1E293B"}}>{sug.name}</p>
                        <span style={{fontSize:"10px",fontWeight:"700",padding:"2px 6px",borderRadius:"100px",background:sug.confidence==="high"?"#DCFCE7":sug.confidence==="medium"?"#FFFBEB":"#FEE2E2",color:sug.confidence==="high"?"#166534":sug.confidence==="medium"?"#92400E":"#991B1B"}}>{sug.confidence}</span>
                      </div>
                      <p style={{fontSize:"12px",color:"#64748B",marginTop:"2px",lineHeight:1.4}}>{sug.reason}</p>
                    </div>
                    <button style={{background:i===0?"#6366F1":"#2563EB",border:"none",borderRadius:"7px",padding:"7px 14px",fontSize:"12px",fontWeight:"700",color:"#FFF",cursor:"pointer",flexShrink:0,opacity:aiAssigning===sug.staff_id?.6:1}} disabled={!!aiAssigning}
                      onClick={()=>aiAssignStaff(sug.staff_id,rec.task_id||rec.role_id,sug.name)}>
                      {aiAssigning===sug.staff_id?"…":"Assign"}
                    </button>
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {/* ── Tasks section ── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
        <h3 style={{...s.sectionTitle,margin:0}}>Tasks ({totalTasks})</h3>
        <div style={{display:"flex",gap:"8px"}}>
          {canAssign && totalTasks>0 && (
            <button onClick={()=>openRoster(null)} style={{...s.rosterBtn,background:rosterOpen?"#EFF6FF":"#2563EB",color:rosterOpen?"#2563EB":"#FFF",border:rosterOpen?"1.5px solid #BFDBFE":"none"}}>
              <Users size={13}/> {rosterOpen?"Staff Roster Open":"Assign Staff"}
            </button>
          )}
          {canAssign && (
            <button onClick={()=>{setShowTaskForm(v=>!v);setTaskForm({title:"",skill_id:"",start_time:"",end_time:""});}}
              style={{background:showTaskForm?"#F1F5F9":"#0F172A",color:showTaskForm?"#64748B":"#FFF",border:"none",padding:"8px 16px",borderRadius:"9px",fontSize:"13px",fontWeight:"600",cursor:"pointer"}}>
              {showTaskForm?"Cancel":"+ Add Task"}
            </button>
          )}
        </div>
      </div>

      {/* ── Add task form ── */}
      {showTaskForm && (
        <div style={{background:"#F8FAFC",border:"1.5px solid #BFDBFE",borderRadius:"14px",padding:"20px",marginBottom:"20px"}}>
          <p style={{fontSize:"14px",fontWeight:"700",color:"#1E293B",marginBottom:"16px"}}>New Task</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 180px 100px 100px",gap:"12px",marginBottom:"16px"}}>
            <div><label style={s.formLabel}>Task Name *</label><input style={s.formInput} placeholder="e.g. Cashier, Barista…" value={taskForm.title} onChange={e=>setTaskForm(p=>({...p,title:e.target.value}))}/></div>
            <div><label style={s.formLabel}>Required Skill</label>
              <select style={s.formInput} value={taskForm.skill_id} onChange={e=>setTaskForm(p=>({...p,skill_id:e.target.value}))}>
                <option value="">No specific skill</option>
                {skillOptions.map(sk=><option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
              </select>
            </div>
            <div><label style={s.formLabel}>Start</label><input style={s.formInput} type="time" value={taskForm.start_time} onChange={e=>setTaskForm(p=>({...p,start_time:e.target.value}))}/></div>
            <div><label style={s.formLabel}>End</label><input style={s.formInput} type="time" value={taskForm.end_time} onChange={e=>setTaskForm(p=>({...p,end_time:e.target.value}))}/></div>
          </div>
          <button onClick={addTask} disabled={savingTask} style={{background:savingTask?"#93C5FD":"#2563EB",color:"#FFF",border:"none",padding:"9px 22px",borderRadius:"9px",fontSize:"14px",fontWeight:"700",cursor:savingTask?"default":"pointer"}}>
            {savingTask?"Adding…":"Add Task"}
          </button>
        </div>
      )}

      {/* ── Task cards ── */}
      {tasks.length===0 ? (
        <div style={{textAlign:"center",padding:"48px 20px",background:"#FFF",border:"1px solid #E2E8F0",borderRadius:"14px"}}>
          <div style={{marginBottom:"12px",opacity:.4}}><Tag size={36} color="#64748B"/></div>
          <p style={{fontSize:"15px",fontWeight:"600",color:"#64748B",marginBottom:"4px"}}>No tasks yet</p>
          <p style={{fontSize:"13px",color:"#94A3B8"}}>Click "+ Add Task" to define the work for this shift.</p>
        </div>
      ) : tasks.map(task=>{
        const assignee   = task.task_assignments?.[0];
        const st         = TASK_STATUS[task.status]||TASK_STATUS.open;
        const staffName  = assignee?.staff?.users?.full_name||null;
        const taskStart  = toHHMM(task.start_time);
        const taskEnd    = toHHMM(task.end_time);
        const isDragOver = dragOverTaskId===task.task_id;
        const isDropping = droppingTaskId===task.task_id;
        const isHighlighted = highlightTaskId===task.task_id;
        const aiNote     = aiNotes[task.task_id];
        const isDropZone = rosterOpen && canAssign && !assignee;

        return (
          <div key={task.task_id}
            style={{
              ...s.taskCard,
              border: isDragOver ? "2px dashed #2563EB" : isHighlighted && rosterOpen ? "2px solid #6366F1" : "1px solid #E2E8F0",
              background: isDragOver ? "#EFF6FF" : "#FFF",
              animation: "fadeSlideUp 0.3s ease both",
              transition: "border-color 0.15s, background 0.15s",
            }}
            onDragOver={isDropZone ? e=>handleDragOver(e,task.task_id) : undefined}
            onDragLeave={isDropZone ? e=>handleDragLeave(e,task.task_id) : undefined}
            onDrop={isDropZone ? e=>handleDrop(e,task) : undefined}
          >
            <div style={s.taskCardTop}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
                  <p style={s.taskTitle}>{task.title}</p>
                  <span style={{...s.taskStatusBadge,background:st.bg,color:st.color}}>{st.label}</span>
                  {isDropZone && isDragOver && <span style={{fontSize:"11px",color:"#2563EB",fontWeight:"600"}}>Drop here →</span>}
                  {isDropZone && !isDragOver && !isDropping && <span style={{fontSize:"11px",color:"#94A3B8",fontStyle:"italic"}}>← drag staff here</span>}
                  {isDropping && <span style={{width:"14px",height:"14px",borderRadius:"50%",border:"2px solid #E2E8F0",borderTopColor:"#2563EB",animation:"spin .7s linear infinite",display:"inline-block"}}/>}
                </div>
                <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"5px"}}>
                  {task.skills?.name && <span style={s.skillTag}><Tag size={10}/> {task.skills.name}</span>}
                  {taskStart && <span style={s.timeTag}><Clock size={10}/> {taskStart} – {taskEnd||"?"}</span>}
                </div>
              </div>
              <div style={{display:"flex",gap:"6px",alignItems:"center",flexShrink:0}}>
                {!assignee && canAssign && (
                  <button style={s.assignBtn} onClick={()=>openRoster(task.task_id)}>
                    <Users size={12}/> Assign
                  </button>
                )}
                {canAssign && <button style={s.deleteTaskBtn} onClick={()=>deleteTask(task)} title="Delete task"><Trash2 size={13}/></button>}
              </div>
            </div>

            {/* Assignee */}
            {assignee ? (
              <div style={s.assigneeRow}>
                <div style={s.assigneeAvatar}>{staffName?.[0]?.toUpperCase()||"?"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={s.assigneeName}>{staffName||"Unknown"}</p>
                  <p style={s.assigneeEmail}>{assignee.staff?.users?.email||""}</p>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  {assignee.acknowledged
                    ? <span style={s.ackYes}><Check size={10}/> Acknowledged</span>
                    : <span style={s.ackNo}>Pending</span>}
                  {canAssign && (
                    <button style={s.removeBtn} title="Remove assignment" onClick={()=>unassignStaff(task)}
                      onMouseEnter={e=>e.currentTarget.style.color="#EF4444"}
                      onMouseLeave={e=>e.currentTarget.style.color="#94A3B8"}>
                      <X size={14}/>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={s.emptyAssignee}>
                {isDropZone ? "Drag a staff card from the roster panel to assign →" : "No staff assigned."}
              </div>
            )}

            {/* AI Note */}
            {aiNote && !aiNote.dismissed && (
              <div style={{...s.aiNote, borderColor: aiNote.loading?"#E2E8F0":aiNote.suitable?"#A7F3D0":"#FDE68A", background: aiNote.loading?"#F8FAFC":aiNote.suitable?"#F0FDF4":"#FFFBEB", animation:"aiNoteIn 0.3s ease both"}}>
                {aiNote.loading ? (
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <span style={{width:"12px",height:"12px",borderRadius:"50%",border:"2px solid #E2E8F0",borderTopColor:"#6366F1",animation:"spin .7s linear infinite",display:"inline-block",flexShrink:0}}/>
                    <span style={{fontSize:"12px",color:"#94A3B8"}}>AI is evaluating this assignment…</span>
                  </div>
                ) : (
                  <div style={{display:"flex",alignItems:"flex-start",gap:"8px"}}>
                    <span style={{fontSize:"14px",flexShrink:0,marginTop:"1px"}}>{aiNote.suitable?"✅":"⚠️"}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:"12px",color:"#1E293B",lineHeight:1.5}}>{aiNote.message}</p>
                      {aiNote.alternative && (
                        <p style={{fontSize:"11px",color:"#92400E",marginTop:"4px",fontWeight:"600"}}>
                          💡 Consider <strong>{aiNote.alternative.name}</strong> — {aiNote.alternative.reason}
                        </p>
                      )}
                    </div>
                    <button style={{background:"none",border:"none",color:"#94A3B8",cursor:"pointer",padding:"2px",flexShrink:0,lineHeight:1}}
                      onClick={()=>setAiNotes(prev=>({...prev,[task.task_id]:{...prev[task.task_id],dismissed:true}}))}>
                      <X size={13}/>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Staff Roster Drawer ── */}
      {rosterOpen && (
        <>
          <div style={{position:"fixed",inset:0,zIndex:200,background:"rgba(15,23,42,0.25)"}} onClick={()=>setRosterOpen(false)}/>
          <div style={{position:"fixed",top:0,right:0,bottom:0,width:"360px",background:"#FFF",boxShadow:"-6px 0 32px rgba(0,0,0,0.14)",zIndex:201,display:"flex",flexDirection:"column",animation:"panelIn 0.25s ease both"}}>

            {/* Header */}
            <div style={{padding:"18px 20px 14px",borderBottom:"1px solid #F1F5F9",flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <div>
                  <h3 style={{fontSize:"15px",fontWeight:"700",color:"#0F172A"}}>Staff Roster</h3>
                  {activeTask && <p style={{fontSize:"12px",color:"#6366F1",marginTop:"2px",fontWeight:"600"}}>Assigning: {activeTask.title}</p>}
                </div>
                <button style={{background:"none",border:"none",cursor:"pointer",color:"#94A3B8",display:"flex",padding:"4px"}} onClick={()=>setRosterOpen(false)}><X size={18}/></button>
              </div>
              <div style={{position:"relative",marginBottom:"10px"}}>
                <Search size={13} style={{position:"absolute",left:"10px",top:"50%",transform:"translateY(-50%)",color:"#94A3B8",pointerEvents:"none"}}/>
                <input placeholder="Search staff…" value={rosterSearch} onChange={e=>setRosterSearch(e.target.value)}
                  style={{width:"100%",padding:"7px 10px 7px 30px",border:"1.5px solid #E2E8F0",borderRadius:"9px",fontSize:"13px",color:"#1E293B",background:"#FAFAFA",boxSizing:"border-box",outline:"none"}}/>
              </div>
              <div style={{display:"flex",gap:"6px"}}>
                {[{v:"all",l:"All"},
                  {v:"available",l:"Available"},
                  ...(activeTask?.skill_id ? [{v:"skilled",l:"Has Skill"}] : [])
                ].map(f=>(
                  <button key={f.v} onClick={()=>setRosterFilter(f.v)}
                    style={{fontSize:"11px",fontWeight:"600",padding:"4px 10px",borderRadius:"100px",border:"none",cursor:"pointer",background:rosterFilter===f.v?"#1E293B":"#F1F5F9",color:rosterFilter===f.v?"#FFF":"#64748B"}}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Hint */}
            <div style={{padding:"10px 20px",background:"#F0F7FF",borderBottom:"1px solid #DBEAFE",flexShrink:0}}>
              <p style={{fontSize:"11px",color:"#1D4ED8",fontWeight:"600"}}>🖱 Drag a card onto a task to assign</p>
            </div>

            {/* Staff list */}
            <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
              {loadingRoster ? (
                <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                  {[1,2,3,4].map(i=><Shimmer key={i} h="72px" r="10px"/>)}
                </div>
              ) : filteredRoster.length===0 ? (
                <div style={{textAlign:"center",padding:"32px 0",color:"#94A3B8",fontSize:"13px"}}>No staff match this filter.</div>
              ) : filteredRoster.map(staff=>{
                const isUnavailable = staff.is_on_leave||staff.is_double_booked;
                const isAssigned    = staff.already_assigned;
                const hasSkill      = !activeTask?.skill_id || staff.skills.some(sk=>sk.skill_id===activeTask.skill_id);
                const quality       = !isUnavailable && !isAssigned && hasSkill;

                return (
                  <div key={staff.staff_id}
                    draggable={!isUnavailable && !isAssigned}
                    onDragStart={!isUnavailable && !isAssigned ? e=>handleDragStart(e,staff) : undefined}
                    style={{
                      display:"flex",alignItems:"center",gap:"10px",
                      padding:"10px 12px",borderRadius:"10px",marginBottom:"8px",
                      border:`1.5px solid ${quality?"#BFDBFE":isUnavailable||isAssigned?"#F1F5F9":"#E2E8F0"}`,
                      background: quality?"#F0F7FF":isUnavailable||isAssigned?"#F8FAFC":"#FFF",
                      opacity: isUnavailable||isAssigned ? .55 : 1,
                      cursor: isUnavailable||isAssigned ? "not-allowed" : "grab",
                      transition:"box-shadow 0.15s",
                    }}
                    onMouseEnter={e=>{ if(!isUnavailable&&!isAssigned) e.currentTarget.style.boxShadow="0 2px 10px rgba(0,0,0,0.10)"; }}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>

                    {/* Drag handle */}
                    {!isUnavailable && !isAssigned && (
                      <GripVertical size={14} color="#CBD5E1" style={{flexShrink:0}}/>
                    )}

                    {/* Avatar */}
                    <div style={{width:"32px",height:"32px",borderRadius:"50%",background:quality?"#2563EB":isUnavailable?"#EF4444":"#94A3B8",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"700",flexShrink:0}}>
                      {staff.full_name[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:"5px",flexWrap:"wrap"}}>
                        <p style={{fontSize:"13px",fontWeight:"600",color:"#1E293B"}}>{staff.full_name}</p>
                        {quality && activeTask?.skill_id && <span style={{fontSize:"9px",fontWeight:"700",color:"#059669",background:"#ECFDF5",padding:"2px 5px",borderRadius:"100px"}}>✓ Skilled</span>}
                      </div>
                      <div style={{display:"flex",gap:"4px",flexWrap:"wrap",marginTop:"3px"}}>
                        {staff.is_on_leave     && <span style={s.badgeRed}>On leave</span>}
                        {staff.is_double_booked && <span style={s.badgeRed}>Double-booked</span>}
                        {isAssigned            && <span style={s.badgeGray}>Already assigned</span>}
                        {!isUnavailable && !isAssigned && (
                          <>
                            <span style={s.badgeGray}>{staff.staff_type==="casual"?"Casual":"Regular"}</span>
                            <span style={{...s.badgeGray,color:staff.hours_this_week>=40?"#DC2626":"#64748B"}}>{staff.hours_this_week}h this week</span>
                            {staff.staff_type==="casual" && staff.casual_available_today===false && <span style={s.badgeYellow}>No avail. declared</span>}
                          </>
                        )}
                        {staff.skills.length>0 && (
                          <span style={s.badgePurple}>{staff.skills.map(sk=>sk.name).slice(0,2).join(", ")}{staff.skills.length>2?` +${staff.skills.length-2}`:""}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{padding:"12px 16px",borderTop:"1px solid #F1F5F9",flexShrink:0,background:"#FAFAFA"}}>
              <p style={{fontSize:"11px",color:"#94A3B8",textAlign:"center"}}>
                {roster.filter(r=>!r.is_on_leave&&!r.is_double_booked&&!r.already_assigned).length} staff available · {roster.filter(r=>r.already_assigned).length} already assigned
              </p>
            </div>
          </div>
        </>
      )}

      {/* ── Conflict Modal ── */}
      {conflictModal && (
        <div style={s.overlay}>
          <div style={{...s.modal,maxWidth:"480px"}}>
            <div style={s.modalHeader}>
              <h3 style={{...s.modalTitle,color:"#991B1B",display:"flex",alignItems:"center",gap:"6px"}}><AlertTriangle size={18}/> Publish Conflicts</h3>
              <button style={s.closeBtn} onClick={()=>setConflictModal(null)}><X size={18}/></button>
            </div>
            {conflictModal.hardBlocks.length>0 && <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"10px",padding:"14px 16px",marginBottom:"12px"}}>
              <p style={{fontSize:"12px",fontWeight:"700",color:"#991B1B",marginBottom:"8px",textTransform:"uppercase"}}>Cannot publish:</p>
              {conflictModal.hardBlocks.map((b,i)=><p key={i} style={{fontSize:"13px",color:"#7F1D1D",marginBottom:"4px"}}>• {b}</p>)}
            </div>}
            {conflictModal.warnings.length>0 && <div style={{background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"14px 16px",marginBottom:"12px"}}>
              <p style={{fontSize:"12px",fontWeight:"700",color:"#92400E",marginBottom:"8px",textTransform:"uppercase"}}>Warnings:</p>
              {conflictModal.warnings.map((w,i)=><p key={i} style={{fontSize:"13px",color:"#78350F",marginBottom:"4px"}}>• {w}</p>)}
            </div>}
            <div style={{display:"flex",gap:"8px",justifyContent:"flex-end",marginTop:"16px"}}>
              <button style={s.ghostBtn} onClick={()=>setConflictModal(null)}>Cancel</button>
              {conflictModal.hardBlocks.length===0 && <button style={{background:"#D97706",border:"none",borderRadius:"9px",padding:"8px 16px",fontSize:"13px",fontWeight:"700",color:"#FFF",cursor:"pointer"}} onClick={doPublish} disabled={publishing}>{publishing?"Publishing…":"Publish Anyway"}</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm Modal ── */}
      {confirmModal && (
        <div style={s.overlay} onClick={()=>!confirmBusy&&setConfirmModal(null)}>
          <div style={{...s.modal,maxWidth:"400px",textAlign:"center"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:"48px",height:"48px",borderRadius:"50%",margin:"0 auto 14px",background:confirmModal.danger?"#FEF2F2":"#EFF6FF",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <AlertTriangle size={22} color={confirmModal.danger?"#EF4444":"#2563EB"}/>
            </div>
            <h3 style={{fontSize:"17px",fontWeight:"800",color:"#1E293B",marginBottom:"8px"}}>{confirmModal.title}</h3>
            <p style={{fontSize:"13.5px",color:"#64748B",lineHeight:1.6,marginBottom:"22px"}}>{confirmModal.body}</p>
            <div style={{display:"flex",gap:"10px",justifyContent:"center"}}>
              <button style={s.ghostBtn} onClick={()=>setConfirmModal(null)} disabled={confirmBusy}>Cancel</button>
              <button style={{background:confirmModal.danger?"#EF4444":"#2563EB",border:"none",borderRadius:"9px",padding:"8px 18px",fontSize:"13px",fontWeight:"700",color:"#FFF",cursor:"pointer",opacity:confirmBusy?.6:1}}
                disabled={confirmBusy} onClick={async()=>{ setConfirmBusy(true); try{await confirmModal.onConfirm();setConfirmModal(null);}finally{setConfirmBusy(false);} }}>
                {confirmBusy?"Working…":confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div style={{position:"fixed",bottom:"28px",right:rosterOpen?"388px":"28px",zIndex:9999,background:toast.type==="success"?"#22C55E":"#EF4444",color:"#FFF",padding:"12px 20px",borderRadius:"10px",fontSize:"14px",fontWeight:"600",boxShadow:"0 4px 20px rgba(0,0,0,0.15)",animation:"toastIn 0.3s ease both",transition:"right 0.25s ease"}}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

const s = {
  back: {background:"none",border:"none",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer",marginBottom:"20px",padding:0},
  empty: {textAlign:"center",padding:"40px",color:"#64748B",fontSize:"14px"},
  shiftCard: {background:"#FFF",border:"1px solid #E2E8F0",borderRadius:"16px",padding:"22px 24px",marginBottom:"24px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"},
  shiftCardTop: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"18px",flexWrap:"wrap",gap:"14px"},
  shiftTitleRow: {display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px",flexWrap:"wrap"},
  shiftTitle: {fontSize:"20px",fontWeight:"800",color:"#0F172A",letterSpacing:"-0.3px"},
  badge: {display:"inline-block",padding:"3px 10px",borderRadius:"100px",fontSize:"11px",fontWeight:"700",textTransform:"capitalize"},
  shiftMetaRow: {display:"flex",flexWrap:"wrap",gap:"6px"},
  metaPill: {display:"inline-flex",alignItems:"center",gap:"5px",fontSize:"12px",color:"#475569",background:"#F1F5F9",border:"1px solid #E2E8F0",borderRadius:"100px",padding:"3px 10px",fontWeight:"500"},
  shiftActions: {display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center"},
  deleteIconBtn: {display:"flex",alignItems:"center",justifyContent:"center",width:"34px",height:"34px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"9px",color:"#EF4444",cursor:"pointer",padding:0,flexShrink:0},
  publishBtn: {background:"#2563EB",border:"none",borderRadius:"9px",padding:"8px 16px",fontSize:"13px",fontWeight:"700",color:"#FFF",cursor:"pointer"},
  unpublishBtn: {background:"#F8FAFC",border:"1px solid #E2E8F0",borderRadius:"9px",padding:"8px 14px",fontSize:"13px",fontWeight:"600",color:"#1E293B",cursor:"pointer"},
  cancelBtn: {background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:"9px",padding:"8px 14px",fontSize:"13px",fontWeight:"600",color:"#991B1B",cursor:"pointer"},
  staffingRow: {display:"flex",alignItems:"center",gap:"12px"},
  staffingBar: {flex:1,height:"6px",background:"#F1F5F9",borderRadius:"100px",overflow:"hidden"},
  staffingFill: {height:"100%",borderRadius:"100px",transition:"width 0.3s ease"},
  staffingText: {fontSize:"13px",color:"#64748B",fontWeight:"500",whiteSpace:"nowrap"},
  sectionTitle: {fontSize:"15px",fontWeight:"700",color:"#1E293B"},
  rosterBtn: {display:"flex",alignItems:"center",gap:"6px",padding:"8px 16px",borderRadius:"9px",fontSize:"13px",fontWeight:"600",cursor:"pointer"},
  formLabel: {display:"block",fontSize:"12px",fontWeight:"600",color:"#64748B",marginBottom:"6px"},
  formInput: {display:"block",width:"100%",padding:"9px 12px",border:"1.5px solid #E2E8F0",borderRadius:"9px",fontSize:"14px",color:"#1E293B",background:"#FFF",boxSizing:"border-box"},
  taskCard: {background:"#FFF",border:"1px solid #E2E8F0",borderRadius:"14px",padding:"18px 20px",marginBottom:"12px",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"},
  taskCardTop: {display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px",gap:"10px"},
  taskTitle: {fontSize:"15px",fontWeight:"700",color:"#0F172A"},
  taskStatusBadge: {fontSize:"10px",fontWeight:"700",padding:"2px 8px",borderRadius:"100px"},
  skillTag: {display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"11px",fontWeight:"600",color:"#6D28D9",background:"#EDE9FE",border:"1px solid #DDD6FE",borderRadius:"100px",padding:"2px 8px"},
  timeTag: {display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"11px",fontWeight:"500",color:"#0369A1",background:"#F0F9FF",border:"1px solid #BAE6FD",borderRadius:"100px",padding:"2px 8px"},
  assignBtn: {display:"flex",alignItems:"center",gap:"5px",background:"#EFF6FF",border:"1px solid #BFDBFE",borderRadius:"7px",padding:"5px 12px",fontSize:"12px",fontWeight:"600",color:"#1D4ED8",cursor:"pointer"},
  deleteTaskBtn: {display:"flex",alignItems:"center",justifyContent:"center",width:"28px",height:"28px",background:"none",border:"1px solid #E2E8F0",borderRadius:"7px",color:"#CBD5E1",cursor:"pointer",padding:0,flexShrink:0},
  assigneeRow: {display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",background:"#F0FDF4",border:"1px solid #BBF7D0",borderRadius:"10px"},
  assigneeAvatar: {width:"30px",height:"30px",borderRadius:"50%",background:"#22C55E",color:"#FFF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:"700",flexShrink:0},
  assigneeName: {fontSize:"13px",fontWeight:"600",color:"#1E293B"},
  assigneeEmail: {fontSize:"11px",color:"#64748B"},
  ackYes: {display:"inline-flex",alignItems:"center",gap:"4px",fontSize:"11px",color:"#059669",fontWeight:"600",background:"#ECFDF5",padding:"2px 7px",borderRadius:"100px"},
  ackNo: {fontSize:"11px",color:"#D97706",fontWeight:"500",background:"#FFFBEB",padding:"2px 7px",borderRadius:"100px"},
  removeBtn: {background:"none",border:"none",fontSize:"13px",color:"#94A3B8",cursor:"pointer",padding:"2px 5px",lineHeight:1},
  emptyAssignee: {fontSize:"12px",color:"#94A3B8",padding:"8px 0 2px",fontStyle:"italic"},
  aiNote: {marginTop:"10px",padding:"10px 12px",borderRadius:"10px",border:"1px solid #E2E8F0"},
  aiPanel: {background:"linear-gradient(135deg,#F5F3FF,#EEF2FF)",border:"1.5px solid #C4B5FD",borderRadius:"14px",padding:"20px",marginBottom:"24px"},
  aiPanelHeader: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px",flexWrap:"wrap",gap:"6px"},
  aiBtn: {background:"linear-gradient(135deg,#6366F1,#8B5CF6)",border:"none",borderRadius:"9px",padding:"8px 16px",fontSize:"13px",fontWeight:"700",color:"#FFF",cursor:"pointer"},
  overlay: {position:"fixed",inset:0,background:"rgba(15,23,42,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"},
  modal: {background:"#FFF",borderRadius:"16px",padding:"28px",width:"100%",maxWidth:"560px",maxHeight:"80vh",overflowY:"auto",animation:"modalIn 0.25s ease both",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"},
  modalHeader: {display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"},
  modalTitle: {fontSize:"17px",fontWeight:"700",color:"#1E293B"},
  closeBtn: {background:"none",border:"none",fontSize:"18px",color:"#94A3B8",cursor:"pointer",padding:"2px 6px"},
  ghostBtn: {background:"#F1F5F9",border:"none",borderRadius:"9px",padding:"8px 16px",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer"},
  badgeRed: {fontSize:"10px",fontWeight:"600",color:"#991B1B",background:"#FEE2E2",padding:"2px 6px",borderRadius:"100px"},
  badgeYellow: {fontSize:"10px",fontWeight:"600",color:"#92400E",background:"#FFFBEB",padding:"2px 6px",borderRadius:"100px"},
  badgeGray: {fontSize:"10px",fontWeight:"500",color:"#64748B",background:"#F1F5F9",padding:"2px 6px",borderRadius:"100px"},
  badgePurple: {fontSize:"10px",fontWeight:"600",color:"#6D28D9",background:"#EDE9FE",padding:"2px 6px",borderRadius:"100px"},
};
