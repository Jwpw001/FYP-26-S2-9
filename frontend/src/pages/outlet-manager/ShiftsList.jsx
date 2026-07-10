import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Trash2, Check, X, Sparkles, Calendar, AlertTriangle } from "lucide-react";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-shifts-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-shifts-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes aiPulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.4; }
    }
    @keyframes aiSpin {
      from { transform: rotate(0deg); } to { transform: rotate(360deg); }
    }
    @keyframes cardSlideIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes progressFill {
      from { width: 0; } to { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280" },
  published: { background: "#DCFCE7", color: "#166534" },
  completed: { background: "#DBEAFE", color: "#1E40AF" },
  cancelled: { background: "#FEE2E2", color: "#991B1B" },
};

function Shimmer({ w = "100%", h = "16px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

export default function ShiftsList() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]         = useState([]);
  const [krewbyAssigned, setKrewbyAssigned] = useState([]); // [{ shift_id, role_id, status }]
  const [outletInfo, setOutletInfo] = useState({ outlet_id: null, open_time: null, close_time: null });
  const [skillOptions, setSkillOptions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("calendar");
  const [filterStatus, setFilter]   = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [deleting, setDeleting]     = useState(false);

  // AI Weekly Schedule state — step: 'generating' | 'preview' | 'creating' | 'done'
  const [weeklyAI, setWeeklyAI] = useState(null);

  // AI Create modal state
  // step: 'form' | 'recommending' | 'recommend' | 'assigning'
  const [aiCreate, setAiCreate] = useState(null);
  const [aiCreateForm, setAiCreateForm] = useState({ title: "", start_time: "", end_time: "", roles: [{ role_name: "", skill_id: "", headcount: 1 }] });
  const [aiCreateError, setAiCreateError] = useState("");
  const [aiCreateAssigning, setAiCreateAssigning] = useState(null); // staff_id being assigned

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [{ data: myStaff }, { data: skillRows }] = await Promise.all([
          supabase.from("staff").select("outlet_id").eq("user_id", userId).eq("is_active", true).limit(1),
          supabase.from("skills").select("skill_id, name").order("name"),
        ]);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;

        if (!cancelled) setSkillOptions(skillRows || []);

        const { data: outletData } = await supabase
          .from("outlets").select("open_time, close_time").eq("outlet_id", oid).single();
        if (!cancelled) {
          setOutletInfo({
            outlet_id: oid,
            open_time:  outletData?.open_time  ? String(outletData.open_time).slice(0, 5)  : null,
            close_time: outletData?.close_time ? String(outletData.close_time).slice(0, 5) : null,
          });
        }

        const { data: shiftRows } = await supabase
          .from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status, outlet_id, shift_roles ( role_id, headcount ), shift_assignments ( assignment_id )")
          .eq("outlet_id", oid)
          .order("shift_date", { ascending: false });

        // Auto-complete published shifts whose date has passed
        const today = new Date().toISOString().split("T")[0];
        const toComplete = (shiftRows || [])
          .filter(s => s.status === "published" && s.shift_date < today)
          .map(s => s.shift_id);
        if (toComplete.length > 0) {
          await supabase.from("shifts").update({ status: "completed" }).in("shift_id", toComplete);
          (shiftRows || []).forEach(s => {
            if (toComplete.includes(s.shift_id)) s.status = "completed";
          });
        }

        if (!cancelled) setShifts(shiftRows || []);

        // Load krewby requests for this outlet to factor into fill status
        const { data: krewbyRows } = await supabase
          .from("krewby_requests")
          .select("shift_id, role_id, status")
          .eq("outlet_id", oid)
          .in("status", ["assigned", "approved"]);
        if (!cancelled) setKrewbyAssigned(krewbyRows || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function getWeekDates() {
    const dates = [];
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  function toggleSelect(shiftId) {
    setSelected(prev => { const s = new Set(prev); s.has(shiftId) ? s.delete(shiftId) : s.add(shiftId); return s; });
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map(id => api.delete(`/api/shifts/${id}`)));
      setShifts(prev => prev.filter(s => !selected.has(s.shift_id)));
      setSelected(new Set());
      setSelectMode(false);
    } catch (err) {
      alert("Failed to delete some shifts: " + err.message);
    } finally {
      setDeleting(false);
    }
  }

  async function generateWeeklySchedule(weekDates) {
    const weekStart = weekDates[0].toISOString().split("T")[0];
    const weekEnd   = weekDates[6].toISOString().split("T")[0];
    setWeeklyAI({ step: "generating", weekStart, weekEnd });
    try {
      const result = await api.post("/api/shifts/generate-week", { weekStart, weekEnd });
      setWeeklyAI({ step: "preview", weekStart, weekEnd, schedule: result.schedule, accepted: new Set(result.schedule.map((_, i) => i)) });
    } catch (err) {
      setWeeklyAI({ step: "error", weekStart, weekEnd, message: err.message });
    }
  }

  async function confirmWeeklySchedule() {
    const { schedule, accepted, weekStart, weekEnd } = weeklyAI;
    const toCreate = schedule.filter((_, i) => accepted.has(i));
    setWeeklyAI(prev => ({ ...prev, step: "creating" }));
    try {
      await api.post("/api/shifts/confirm-week", { shifts: toCreate });
      setWeeklyAI(prev => ({ ...prev, step: "done", created: toCreate.length }));
      // Reload shifts
      const oid = outletInfo.outlet_id;
      if (oid) {
        const { data } = await supabase.from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status, outlet_id, shift_roles ( role_id, headcount ), shift_assignments ( assignment_id )")
          .eq("outlet_id", oid).order("shift_date", { ascending: false });
        if (data) setShifts(data.map(s => ({ ...s, shift_date: s.shift_date?.split("T")[0] ?? s.shift_date })));
      }
      setTimeout(() => setWeeklyAI(null), 2000);
    } catch (err) {
      setWeeklyAI(prev => ({ ...prev, step: "error", message: err.message }));
    }
  }

  async function openAiCreate(dateStr) {
    setAiCreateError("");
    setAiCreateForm({
      title: "",
      start_time: outletInfo.open_time || "09:00",
      end_time: outletInfo.close_time || "17:00",
      roles: [{ role_name: "", skill_id: "", headcount: 1 }],
    });
    setAiCreate({ step: "form", date: dateStr });
    // Refresh skills in case page-load fetch missed them
    const { data: freshSkills } = await supabase.from("skills").select("skill_id, name").order("name");
    if (freshSkills?.length) setSkillOptions(freshSkills);
  }

  async function handleAiCreateSubmit() {
    setAiCreateError("");
    const { title, start_time, end_time, roles } = aiCreateForm;
    if (!outletInfo.outlet_id) { setAiCreateError("Outlet not loaded yet. Please wait and try again."); return; }
    if (!start_time || !end_time) { setAiCreateError("Start and end time are required."); return; }
    if (end_time <= start_time) { setAiCreateError("End time must be after start time."); return; }
    if (roles.some(r => !r.role_name.trim())) { setAiCreateError("All roles must have a name."); return; }

    setAiCreate(prev => ({ ...prev, step: "recommending" }));
    try {
      // Create shift
      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .insert({
          outlet_id: outletInfo.outlet_id,
          title: title.trim() || null,
          shift_date: aiCreate.date,
          start_time,
          end_time,
          status: "draft",
          created_by: userId,
        })
        .select().single();
      if (shiftErr) throw shiftErr;

      // Create roles
      const roleRows = roles.map(r => ({
        shift_id: shift.shift_id,
        role_name: r.role_name.trim(),
        skill_id: r.skill_id ? Number(r.skill_id) : null,
        headcount: Number(r.headcount) || 1,
      }));
      const { error: roleErr } = await supabase.from("shift_roles").insert(roleRows);
      if (roleErr) throw roleErr;

      // Get AI recommendations
      const result = await api.post(`/api/recommendations/shift/${shift.shift_id}`);
      const newShift = { ...shift, shift_roles: [] };
      setShifts(prev => [newShift, ...prev]);
      setAiCreate({ step: "recommend", date: aiCreate.date, shift, recommendations: result.recommendations || [], assignedStaffIds: new Set() });
    } catch (err) {
      console.error(err);
      setAiCreateError(err?.message || "Failed to create shift. Please try again.");
      setAiCreate(prev => ({ ...prev, step: "form" }));
    }
  }

  async function handleAiCreateAssign(staffId, roleId, staffName) {
    const numStaffId = Number(staffId);
    const numRoleId = Number(roleId);
    setAiCreateAssigning(numStaffId);
    try {
      const { error: err } = await supabase.from("shift_assignments").insert({
        shift_id: aiCreate.shift.shift_id,
        role_id: numRoleId,
        staff_id: numStaffId,
        status: "assigned",
        acknowledged: false,
      });
      if (err) throw err;
      setAiCreate(prev => ({
        ...prev,
        assignedStaffIds: new Set([...prev.assignedStaffIds, numStaffId]),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setAiCreateAssigning(null);
    }
  }

  const weekDates = getWeekDates();

  const filtered = shifts.filter(s => filterStatus === "all" || s.status === filterStatus);

  function getFillStatus(shift) {
    const roles = shift.shift_roles || [];
    const totalNeeded = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
    if (totalNeeded === 0) return null;
    const krewbyCount = krewbyAssigned.filter(k => k.shift_id === shift.shift_id).length;
    const totalAssigned = (shift.shift_assignments?.length || 0) + krewbyCount;
    if (totalAssigned >= totalNeeded) return "full";
    return "partial";
  }

  function getShiftsForDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return shifts.filter(s => s.shift_date === dateStr && s.status !== "cancelled");
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const STATUS_CHIPS = [
    { value: "all",       label: "All" },
    { value: "draft",     label: "Draft" },
    { value: "published", label: "Published" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <ManagerLayout title="Tasks">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Tasks</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{shifts.length} total tasks</p>
          </div>
          <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {["list", "calendar"].map(v => (
              <ViewToggleBtn key={v} label={v === "list" ? "List" : "Calendar"} active={view === v} onClick={() => { setView(v); setSelectMode(false); setSelected(new Set()); }} />
            ))}
          </div>

          {/* Status chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {STATUS_CHIPS.map(chip => (
              <StatusChip key={chip.value} label={chip.label} active={filterStatus === chip.value} onClick={() => setFilter(chip.value)} status={chip.value} />
            ))}
          </div>

          <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
            {selectMode && selected.size > 0 && (
              <button onClick={deleteSelected} disabled={deleting}
                style={{ padding: "7px 14px", borderRadius: "9px", border: "none", background: "#EF4444", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                {deleting ? "Deleting…" : <><Trash2 size={13} /> Delete ({selected.size})</>}
              </button>
            )}
            <button onClick={() => { setSelectMode(p => !p); setSelected(new Set()); }}
              style={{ padding: "7px 14px", borderRadius: "9px", border: `1.5px solid ${selectMode ? "#6366F1" : "#E2E8F0"}`, background: selectMode ? "#EEF2FF" : "#fff", color: selectMode ? "#6366F1" : "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
              {selectMode ? "Cancel" : "Select"}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
              <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "14px 18px", gap: "8px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                <Shimmer w="80%" h="14px" r="6px" />
                <Shimmer w="60%" h="14px" r="6px" />
                <Shimmer w="70%" h="14px" r="6px" />
                <Shimmer w="50px" h="20px" r="100px" />
                <Shimmer w="70px" h="22px" r="100px" />
                <Shimmer w="58px" h="28px" r="7px" />
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          filtered.length === 0 ? (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px 40px", textAlign: "center" }}>
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><Calendar size={40} color="#CBD5E1" /></div>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#1E293B", marginBottom: "8px" }}>No tasks yet</p>
              <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>Create your first task to get started.</p>
              <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
            </div>
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
                <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
              </div>
              {filtered.map(shift => (
                <ShiftRow key={shift.shift_id} shift={shift} fill={getFillStatus(shift)} onNav={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)} />
              ))}
            </div>
          )
        ) : (
          /* Calendar view */
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <WeekNavBtn label="←" onClick={() => setWeekOffset(p => p - 1)} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>
                {fmtDateShort(weekDates[0])} – {fmtDateShort(weekDates[6])}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button onClick={() => generateWeeklySchedule(weekDates)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "9px", border: "none", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <Sparkles size={12} /> Generate Week
                </button>
                <WeekNavBtn label="→" onClick={() => setWeekOffset(p => p + 1)} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "400px" }}>
              {weekDates.map((date, i) => {
                const dayShifts = getShiftsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", padding: "10px", minHeight: "140px", background: isToday ? "#F0F7FF" : "transparent" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "3px" }}>{DAYS[i]}</span>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: isToday ? "#2563EB" : "transparent", color: isToday ? "#fff" : "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700" }}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {dayShifts.map(shift => {
                        const isSelected = selected.has(shift.shift_id);
                        return (
                          <div key={shift.shift_id}
                            style={{ padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "flex-start", gap: "5px", outline: isSelected ? "2px solid #6366F1" : "none", ...STATUS_STYLES[shift.status] }}
                            onClick={() => selectMode ? toggleSelect(shift.shift_id) : goTo(`/outlet-manager/shifts/${shift.shift_id}`)}>
                            {selectMode && (
                              <div style={{ width: "13px", height: "13px", borderRadius: "3px", border: `2px solid ${isSelected ? "#6366F1" : "rgba(0,0,0,0.25)"}`, background: isSelected ? "#6366F1" : "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                                {isSelected && <Check size={9} color="#fff" strokeWidth={4} />}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "1px" }}>{shift.title || "Task"}</p>
                              <p style={{ opacity: 0.75 }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</p>
                            </div>
                          </div>
                        );
                      })}
                      <div
                        style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", cursor: "pointer", padding: "3px", borderRadius: "6px", border: "1px dashed #E2E8F0", marginTop: dayShifts.length > 0 ? "2px" : 0 }}
                        onClick={() => openAiCreate(date.toISOString().split("T")[0])}>
                        <Sparkles size={13} />+
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Create Shift Modal ─────────────────────────────────────────── */}
      {aiCreate && (
        <div style={ms.overlay} onClick={() => aiCreate.step !== "recommending" && setAiCreate(null)}>
          <div style={ms.modal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={ms.header}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Sparkles size={15} color="#6366F1" />
                  <span style={ms.title}>
                    {aiCreate.step === "form" ? "AI-Powered Shift Creator" :
                     aiCreate.step === "recommending" ? "Creating & Analysing…" :
                     "AI Staff Suggestions"}
                  </span>
                </div>
                <p style={ms.sub}>{fmtDateLong(aiCreate.date)}</p>
              </div>
              {aiCreate.step !== "recommending" && (
                <button style={ms.closeBtn} onClick={() => setAiCreate(null)}><X size={18} /></button>
              )}
            </div>

            {/* Step 1: Form */}
            {aiCreate.step === "form" && (
              <div>
                {aiCreateError && <div style={ms.error}>{aiCreateError}</div>}

                <div style={ms.field}>
                  <label style={ms.label}>Shift Title (optional)</label>
                  <input style={ms.input} placeholder="e.g. Morning Shift"
                    value={aiCreateForm.title}
                    onChange={e => setAiCreateForm(p => ({ ...p, title: e.target.value }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={ms.label}>Start Time *</label>
                    <input style={ms.input} type="time"
                      value={aiCreateForm.start_time}
                      min={outletInfo.open_time || undefined}
                      max={outletInfo.close_time || undefined}
                      onChange={e => setAiCreateForm(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ms.label}>End Time *</label>
                    <input style={ms.input} type="time"
                      value={aiCreateForm.end_time}
                      min={aiCreateForm.start_time || outletInfo.open_time || undefined}
                      max={outletInfo.close_time || undefined}
                      onChange={e => setAiCreateForm(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
                {(outletInfo.open_time || outletInfo.close_time) && (
                  <p style={ms.hint}>Operating hours: {fmtTime(outletInfo.open_time)} – {fmtTime(outletInfo.close_time)}</p>
                )}

                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <label style={{ ...ms.label, marginBottom: 0 }}>Roles *</label>
                    <button style={ms.addRoleBtn} onClick={() => setAiCreateForm(p => ({ ...p, roles: [...p.roles, { role_name: "", skill_id: "", headcount: 1 }] }))}>
                      + Add Role
                    </button>
                  </div>
                  {aiCreateForm.roles.map((role, idx) => (
                    <div key={idx} style={ms.roleRow}>
                      <input style={ms.roleInput} placeholder="Role name (e.g. Cashier)"
                        value={role.role_name}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, role_name: e.target.value } : r) }))} />
                      <select style={ms.roleSelect}
                        value={role.skill_id}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, skill_id: e.target.value } : r) }))}>
                        <option value="">Any skill</option>
                        {skillOptions.map(sk => <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
                      </select>
                      <input style={ms.roleHC} type="number" min="1" max="20" placeholder="HC"
                        value={role.headcount}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, headcount: e.target.value } : r) }))} />
                      {aiCreateForm.roles.length > 1 && (
                        <button style={ms.removeRoleBtn} onClick={() => setAiCreateForm(p => ({ ...p, roles: p.roles.filter((_, i) => i !== idx) }))}><X size={13} /></button>
                      )}
                    </div>
                  ))}
                </div>

                <button style={ms.aiSubmitBtn} onClick={handleAiCreateSubmit}>
                  <Sparkles size={14} /> Create & Get AI Suggestions
                </button>
              </div>
            )}

            {/* Step 2: Loading */}
            {aiCreate.step === "recommending" && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ marginBottom: "14px", animation: "aiPulse 1.2s ease infinite", display: "flex", justifyContent: "center" }}><Sparkles size={32} color="#6366F1" /></div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#4338CA" }}>Creating shift and analysing staff…</p>
                <p style={{ fontSize: "13px", color: "#6D28D9", opacity: 0.7, marginTop: "6px" }}>Groq AI is picking the best people for your roles</p>
              </div>
            )}

            {/* Step 3: Recommendations */}
            {aiCreate.step === "recommend" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", color: "#64748B" }}>
                    Shift <strong>{aiCreate.shift.title || "created"}</strong> · {aiCreate.shift.start_time?.slice(0,5)} – {aiCreate.shift.end_time?.slice(0,5)}
                  </p>
                  <button style={ms.viewShiftBtn} onClick={() => { setAiCreate(null); goTo(`/outlet-manager/shifts/${aiCreate.shift.shift_id}`); }}>
                    View Shift →
                  </button>
                </div>

                {aiCreate.recommendations.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#64748B", padding: "20px 0", textAlign: "center" }}>No staff available to suggest for these roles.</p>
                ) : (
                  aiCreate.recommendations.map(rec => (
                    <div key={rec.role_id} style={{ marginBottom: "18px" }}>
                      <p style={ms.recRoleLabel}>{rec.role_name}</p>
                      {(rec.suggestions || []).map((sug, i) => {
                        const isAssigned = aiCreate.assignedStaffIds.has(Number(sug.staff_id));
                        return (
                          <div key={sug.staff_id} style={{
                            ...ms.sugRow,
                            borderColor: i === 0 ? "#A5B4FC" : "#E2E8F0",
                            background: isAssigned ? "#F0FDF4" : i === 0 ? "#F5F3FF" : "#FAFAFA",
                          }}>
                            <div style={{ ...ms.rankBadge, background: i === 0 ? "#6366F1" : "#CBD5E1" }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span style={ms.sugName}>{sug.name}</span>
                                <span style={{
                                  ...ms.confBadge,
                                  background: sug.confidence === "high" ? "#DCFCE7" : sug.confidence === "medium" ? "#FFFBEB" : "#FEE2E2",
                                  color: sug.confidence === "high" ? "#166534" : sug.confidence === "medium" ? "#92400E" : "#991B1B",
                                }}>{sug.confidence}</span>
                              </div>
                              <p style={ms.sugReason}>{sug.reason}</p>
                            </div>
                            <button
                              style={{
                                ...ms.assignBtn,
                                background: isAssigned ? "#22C55E" : i === 0 ? "#6366F1" : "#2563EB",
                                opacity: aiCreateAssigning === Number(sug.staff_id) ? 0.6 : 1,
                              }}
                              disabled={isAssigned || !!aiCreateAssigning}
                              onClick={() => handleAiCreateAssign(sug.staff_id, rec.role_id, sug.name)}
                            >
                              {isAssigned ? <><Check size={12} /> Assigned</> : aiCreateAssigning === Number(sug.staff_id) ? "…" : "Assign"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── AI Weekly Schedule Modal ───────────────────────────────────────── */}
      {weeklyAI && (
        <div style={{ position:"fixed",inset:0,zIndex:99999,background:"rgba(2,6,23,0.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
          onClick={() => !["generating","creating"].includes(weeklyAI.step) && setWeeklyAI(null)}>
          <div style={{ background:"#FAFBFE",borderRadius:"20px",width:"min(98vw,1400px)",maxHeight:"92vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",overflow:"hidden",animation:"modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
            onClick={e => e.stopPropagation()}>

            {/* ── Header ── */}
            <div style={{ background:"linear-gradient(130deg,#312E81 0%,#4F46E5 45%,#7C3AED 100%)",padding:"20px 24px",position:"relative",overflow:"hidden",flexShrink:0 }}>
              <div style={{ position:"absolute",top:"-40px",right:"-40px",width:"160px",height:"160px",borderRadius:"50%",background:"rgba(255,255,255,0.05)",pointerEvents:"none" }} />
              <div style={{ position:"absolute",bottom:"-60px",left:"30%",width:"200px",height:"200px",borderRadius:"50%",background:"rgba(255,255,255,0.03)",pointerEvents:"none" }} />
              <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative" }}>
                <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                  <div style={{ width:"38px",height:"38px",borderRadius:"10px",background:"rgba(255,255,255,0.15)",backdropFilter:"blur(6px)",border:"1px solid rgba(255,255,255,0.2)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><Sparkles size={18} color="#fff" /></div>
                  <div>
                    <div style={{ fontSize:"15px",fontWeight:"800",color:"#fff",letterSpacing:"-0.2px" }}>AI Weekly Schedule</div>
                    <div style={{ fontSize:"11px",color:"rgba(255,255,255,0.6)",fontWeight:"500",marginTop:"1px" }}>
                      {weeklyAI.weekStart && new Date(weeklyAI.weekStart+"T00:00:00").toLocaleDateString("en-SG",{weekday:"short",day:"numeric",month:"short"})}
                      {" — "}
                      {weeklyAI.weekEnd && new Date(weeklyAI.weekEnd+"T00:00:00").toLocaleDateString("en-SG",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}
                    </div>
                  </div>
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                  {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && weeklyAI.schedule && (() => {
                    const staffSet = new Set(weeklyAI.schedule.flatMap(s => s.roles?.flatMap(r => r.assigned_staff||[]) || []));
                    return [
                      { n: weeklyAI.schedule.length,    label:"shifts" },
                      { n: weeklyAI.accepted?.size ?? 0, label:"selected" },
                      { n: staffSet.size,                label:"staff" },
                    ].map(({ n, label }) => (
                      <div key={label} style={{ textAlign:"center",background:"rgba(255,255,255,0.12)",borderRadius:"10px",padding:"5px 12px",backdropFilter:"blur(4px)",border:"1px solid rgba(255,255,255,0.15)" }}>
                        <div style={{ fontSize:"15px",fontWeight:"800",color:"#fff",lineHeight:1 }}>{n}</div>
                        <div style={{ fontSize:"10px",color:"rgba(255,255,255,0.6)",fontWeight:"500",marginTop:"2px" }}>{label}</div>
                      </div>
                    ));
                  })()}
                  {!["generating","creating"].includes(weeklyAI.step) && (
                    <button onClick={() => setWeeklyAI(null)} style={{ width:"32px",height:"32px",borderRadius:"8px",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.8)",fontSize:"14px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><X size={14} /></button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Body ── */}
            <div style={{ flex:1,overflowY:"auto",overflowX:"hidden",padding:"24px" }}>

              {/* Generating */}
              {weeklyAI.step === "generating" && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:"20px" }}>
                  <div style={{ position:"relative",width:"72px",height:"72px" }}>
                    <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #EEF2FF" }} />
                    <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#6366F1",animation:"aiSpin 0.85s linear infinite" }} />
                    <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}><Sparkles size={26} color="#6366F1" /></div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:"17px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" }}>Building your week…</p>
                    <p style={{ fontSize:"13px",color:"#64748B",lineHeight:1.65,maxWidth:"300px" }}>Analysing staff availability, outlet hours, and role templates to craft your schedule.</p>
                  </div>
                  <div style={{ width:"220px",height:"4px",borderRadius:"4px",background:"#E2E8F0",overflow:"hidden" }}>
                    <div style={{ height:"100%",borderRadius:"4px",background:"linear-gradient(90deg,#6366F1,#8B5CF6)",animation:"progressFill 2.2s ease-in-out infinite" }} />
                  </div>
                </div>
              )}

              {/* Error */}
              {weeklyAI.step === "error" && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 20px",gap:"14px" }}>
                  <div style={{ width:"64px",height:"64px",borderRadius:"50%",background:"#FEF2F2",border:"2px solid #FCA5A5",display:"flex",alignItems:"center",justifyContent:"center" }}><AlertTriangle size={28} color="#DC2626" /></div>
                  <p style={{ fontSize:"16px",fontWeight:"800",color:"#DC2626" }}>Generation failed</p>
                  <p style={{ fontSize:"13px",color:"#64748B",maxWidth:"360px",textAlign:"center",lineHeight:1.6 }}>{weeklyAI.message}</p>
                </div>
              )}

              {/* Done */}
              {weeklyAI.step === "done" && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 20px",gap:"14px" }}>
                  <div style={{ width:"72px",height:"72px",borderRadius:"50%",background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",border:"2px solid #6EE7B7",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(16,185,129,0.25)" }}><Check size={32} color="#059669" strokeWidth={3} /></div>
                  <p style={{ fontSize:"18px",fontWeight:"800",color:"#059669" }}>{weeklyAI.created} shift{weeklyAI.created!==1?"s":""} saved as draft!</p>
                  <p style={{ fontSize:"13px",color:"#64748B" }}>Review and publish them from the calendar view.</p>
                </div>
              )}

              {/* Preview */}
              {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && weeklyAI.schedule && (
                <WeeklySchedulePreview
                  schedule={weeklyAI.schedule}
                  accepted={weeklyAI.accepted}
                  onToggle={(i) => setWeeklyAI(prev => { const a = new Set(prev.accepted); a.has(i)?a.delete(i):a.add(i); return {...prev,accepted:a}; })}
                  onEdit={(i, updated) => setWeeklyAI(prev => { const s=[...prev.schedule]; s[i]=updated; return {...prev,schedule:s}; })}
                />
              )}
            </div>

            {/* ── Footer ── */}
            {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && (
              <div style={{ padding:"14px 24px",borderTop:"1px solid #E8EDF5",display:"flex",alignItems:"center",gap:"12px",background:"#fff",flexShrink:0 }}>
                <button onClick={() => setWeeklyAI(null)} style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Discard
                </button>
                <div style={{ flex:1,fontSize:"12px",color:"#94A3B8" }}>
                  {weeklyAI.accepted?.size ?? 0} of {weeklyAI.schedule?.length} shifts selected
                </div>
                <button onClick={confirmWeeklySchedule} disabled={weeklyAI.step==="creating"||!weeklyAI.accepted?.size}
                  style={{ padding:"10px 22px",borderRadius:"9px",border:"none",fontSize:"13px",fontWeight:"700",cursor:!weeklyAI.accepted?.size?"not-allowed":"pointer",transition:"all 0.2s",whiteSpace:"nowrap",
                    background:!weeklyAI.accepted?.size?"#E2E8F0":"linear-gradient(135deg,#4F46E5,#7C3AED)",
                    color:!weeklyAI.accepted?.size?"#94A3B8":"#fff",
                    boxShadow:!weeklyAI.accepted?.size?"none":"0 4px 14px rgba(99,102,241,0.4)",
                  }}>
                  {weeklyAI.step==="creating"
                    ? <span style={{ display:"flex",alignItems:"center",gap:"8px" }}><span style={{ width:"12px",height:"12px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.35)",borderTopColor:"#fff",animation:"aiSpin 0.7s linear infinite",display:"inline-block" }}/>Saving…</span>
                    : `Save ${weeklyAI.accepted?.size} shift${weeklyAI.accepted?.size!==1?"s":""} as Draft →`
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ShiftRow({ shift, fill, onNav }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNav}
      style={{
        display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px",
        padding: "13px 18px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s", cursor: "pointer",
      }}>
      <span style={{ fontWeight: "600" }}>{fmtDate(shift.shift_date)}</span>
      <span style={{ fontWeight: "500" }}>{shift.title || "Untitled Task"}</span>
      <span style={{ color: "#64748B" }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ color: "#64748B" }}>{shift.shift_roles?.length || 0} role{shift.shift_roles?.length !== 1 ? "s" : ""}</span>
        {fill === "full" && (
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E", flexShrink: 0, display: "inline-block" }} />
        )}
        {fill === "partial" && shift.status === "published" && (
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 7px", borderRadius: "100px", whiteSpace: "nowrap" }}>
            Understaffed
          </span>
        )}
      </span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", ...STATUS_STYLES[shift.status] }}>
          {shift.status}
        </span>
      </span>
      <button
        onClick={e => { e.stopPropagation(); onNav(); }}
        style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
        View →
      </button>
    </div>
  );
}

// ── Weekly Schedule Preview (editable) ─────────────────────────────────────────
const DAY_ACCENT = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];

function WeeklySchedulePreview({ schedule, accepted, onToggle, onEdit }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft]           = useState(null);

  function startEdit(i)             { setDraft(JSON.parse(JSON.stringify(schedule[i]))); setEditingIdx(i); }
  function saveEdit(i)              { onEdit(i, draft); setEditingIdx(null); setDraft(null); }
  function cancelEdit()             { setEditingIdx(null); setDraft(null); }
  function setDraftField(f, v)      { setDraft(d => ({ ...d, [f]: v })); }
  function setRoleField(j, f, v)    { setDraft(d => { const r=[...d.roles]; r[j]={...r[j],[f]:v}; return {...d,roles:r}; }); }
  function addRole()                { setDraft(d => ({ ...d, roles:[...d.roles,{role_name:"",headcount:1,assigned_staff:[]}] })); }
  function removeRole(j)            { setDraft(d => ({ ...d, roles:d.roles.filter((_,k)=>k!==j) })); }

  // Build 7-col grid anchored to the first date in schedule
  const firstDate = schedule.map(s=>s.date).sort()[0] || new Date().toISOString().split("T")[0];
  const cols = Array.from({length:7}, (_,i) => {
    const d = new Date(firstDate+"T00:00:00"); d.setDate(d.getDate()+i);
    return d.toISOString().split("T")[0];
  });
  const byDate = {};
  schedule.forEach((s,i) => { if(!byDate[s.date]) byDate[s.date]=[]; byDate[s.date].push({shift:s,idx:i}); });

  const F = { // form input base style
    padding:"8px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0",
    fontSize:"12px", color:"#1E293B", outline:"none", background:"#fff",
    width:"100%", boxSizing:"border-box", fontFamily:"inherit",
  };

  // Color palette per column
  const COL_COLORS = [
    {top:"#6366F1",bg:"#EEF2FF",border:"#C7D2FE",text:"#4F46E5"},
    {top:"#8B5CF6",bg:"#F5F3FF",border:"#DDD6FE",text:"#6D28D9"},
    {top:"#EC4899",bg:"#FDF2F8",border:"#FBCFE8",text:"#BE185D"},
    {top:"#F59E0B",bg:"#FFFBEB",border:"#FDE68A",text:"#B45309"},
    {top:"#10B981",bg:"#ECFDF5",border:"#A7F3D0",text:"#047857"},
    {top:"#3B82F6",bg:"#EFF6FF",border:"#BFDBFE",text:"#1D4ED8"},
    {top:"#EF4444",bg:"#FEF2F2",border:"#FECACA",text:"#B91C1C"},
  ];

  return (
    <div>
      {/* Hint bar */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px" }}>
        <span style={{ fontSize:"12px",color:"#94A3B8" }}>
          Tap a card to <strong style={{color:"#1E293B"}}>select/deselect</strong> · click <strong style={{color:"#6366F1"}}>Edit</strong> to adjust
        </span>
        <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
          <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#6366F1",display:"inline-block" }}/>
          <span style={{ fontSize:"11px",color:"#64748B" }}>Selected</span>
          <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#E2E8F0",border:"1px solid #CBD5E1",display:"inline-block",marginLeft:"6px" }}/>
          <span style={{ fontSize:"11px",color:"#64748B" }}>Deselected</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", gap:"8px", marginBottom: editingIdx!==null?"20px":"0" }}>
        {cols.map((dateKey, di) => {
          const d       = new Date(dateKey+"T00:00:00");
          const dayAbbr = d.toLocaleDateString("en-SG",{weekday:"short"});
          const dayNum  = d.getDate();
          const month   = d.toLocaleDateString("en-SG",{month:"short"});
          const entries = byDate[dateKey] || [];
          const cc      = COL_COLORS[di];
          const colHasEdit = entries.some(e=>e.idx===editingIdx);

          return (
            <div key={dateKey} style={{ display:"flex",flexDirection:"column",gap:"6px",animation:`cardSlideIn 0.28s ease both`,animationDelay:`${di*0.04}s` }}>

              {/* Day header pill */}
              <div style={{
                borderRadius:"10px",
                background: colHasEdit ? cc.bg : "#fff",
                border:`1.5px solid ${colHasEdit ? cc.border : "#E8EDF5"}`,
                padding:"8px 4px 7px",
                textAlign:"center",
                boxShadow: colHasEdit ? `0 0 0 2px ${cc.border}` : "none",
                transition:"all 0.18s",
              }}>
                <div style={{ fontSize:"9px",fontWeight:"700",color:colHasEdit?cc.text:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:"2px" }}>{dayAbbr}</div>
                <div style={{ fontSize:"20px",fontWeight:"900",color:colHasEdit?cc.text:"#1E293B",lineHeight:1,marginBottom:"1px" }}>{dayNum}</div>
                <div style={{ fontSize:"9px",color:"#94A3B8",fontWeight:"500" }}>{month}</div>
                <div style={{ marginTop:"5px",height:"3px",borderRadius:"3px",background:colHasEdit?cc.top:"#E2E8F0" }} />
              </div>

              {/* Empty column placeholder */}
              {entries.length===0 && (
                <div style={{ flex:1,minHeight:"60px",borderRadius:"10px",border:"1.5px dashed #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAFBFE" }}>
                  <span style={{ fontSize:"11px",color:"#CBD5E1" }}>—</span>
                </div>
              )}

              {/* Shift cards */}
              {entries.map(({shift:s, idx:i}) => {
                const checked    = accepted.has(i);
                const isEditing  = editingIdx===i;

                return (
                  <div key={i}
                    onClick={() => { if(!isEditing) onToggle(i); }}
                    style={{
                      borderRadius:"10px",
                      border:`1.5px solid ${isEditing?cc.top:checked?cc.border:"#E8EDF5"}`,
                      background: isEditing ? cc.bg : checked ? "#fff" : "#FAFBFE",
                      cursor:"pointer",
                      transition:"all 0.18s",
                      overflow:"hidden",
                      boxShadow: isEditing
                        ? `0 0 0 2px ${cc.border}, 0 4px 12px rgba(0,0,0,0.06)`
                        : checked
                        ? "0 2px 8px rgba(99,102,241,0.1)"
                        : "0 1px 3px rgba(0,0,0,0.04)",
                    }}>

                    {/* Colored top stripe */}
                    <div style={{ height:"3px", background: checked||isEditing ? cc.top : "#E2E8F0", transition:"background 0.18s" }} />

                    <div style={{ padding:"8px 8px 6px" }}>
                      {/* Top row: time + checkbox */}
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px" }}>
                        <span style={{ fontSize:"9px",fontWeight:"800",color:checked||isEditing?cc.text:"#64748B",letterSpacing:"0.2px" }}>
                          {s.start_time}–{s.end_time}
                        </span>
                        {/* Checkbox */}
                        <div onClick={e=>{e.stopPropagation();onToggle(i);}}
                          style={{ width:"14px",height:"14px",borderRadius:"4px",border:`1.5px solid ${checked?cc.top:"#D1D5DB"}`,background:checked?cc.top:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
                          {checked && <Check size={8} color="#fff" strokeWidth={4} />}
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{ fontSize:"11px",fontWeight:"700",color:"#0F172A",lineHeight:1.3,marginBottom:"5px" }}>{s.title}</div>

                      {/* Role chips */}
                      <div style={{ display:"flex",flexDirection:"column",gap:"2px",marginBottom:"6px" }}>
                        {(s.roles||[]).map((r,j)=>(
                          <div key={j} style={{ fontSize:"9px",color:"#475569",lineHeight:1.4,display:"flex",alignItems:"center",gap:"3px" }}>
                            <span style={{ width:"4px",height:"4px",borderRadius:"50%",background:cc.top,flexShrink:0 }}/>
                            <span style={{ fontWeight:"600" }}>{r.role_name}</span>
                            <span style={{ color:"#94A3B8" }}>×{r.headcount}</span>
                          </div>
                        ))}
                      </div>

                      {/* Staff avatars row */}
                      {(() => {
                        const allStaff = (s.roles||[]).flatMap(r=>r.assigned_staff||[]);
                        if(!allStaff.length) return null;
                        return (
                          <div style={{ display:"flex",flexWrap:"wrap",gap:"2px",marginBottom:"6px" }}>
                            {allStaff.slice(0,3).map((name,k)=>(
                              <div key={k} style={{ width:"18px",height:"18px",borderRadius:"50%",background:cc.bg,border:`1.5px solid ${cc.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px",fontWeight:"800",color:cc.text }}>
                                {name.trim()[0]?.toUpperCase()}
                              </div>
                            ))}
                            {allStaff.length>3 && <div style={{ width:"18px",height:"18px",borderRadius:"50%",background:"#F1F5F9",border:"1.5px solid #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"7px",fontWeight:"700",color:"#64748B" }}>+{allStaff.length-3}</div>}
                          </div>
                        );
                      })()}

                      {/* Edit / Done button */}
                      <button onClick={e=>{e.stopPropagation(); isEditing?cancelEdit():startEdit(i);}}
                        style={{ width:"100%",padding:"4px 0",borderRadius:"6px",border:`1px solid ${isEditing?"#FECACA":cc.border}`,background:isEditing?"#FEF2F2":cc.bg,color:isEditing?"#DC2626":cc.text,fontSize:"9px",fontWeight:"700",cursor:"pointer",transition:"all 0.15s" }}>
                        {isEditing?<><X size={9} /> Close</>:"✎ Edit"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Edit drawer ── */}
      {editingIdx!==null && draft && (() => {
        const cc = COL_COLORS[cols.indexOf(schedule[editingIdx]?.date) % COL_COLORS.length];
        return (
          <div style={{ borderRadius:"14px",border:`1.5px solid ${cc.border}`,background:"#fff",boxShadow:`0 8px 28px rgba(0,0,0,0.08)`,overflow:"hidden",animation:"cardSlideIn 0.2s ease" }}
            onClick={e=>e.stopPropagation()}>

            {/* Drawer header */}
            <div style={{ background:cc.bg,borderBottom:`1px solid ${cc.border}`,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                <div style={{ width:"6px",height:"22px",borderRadius:"3px",background:cc.top }} />
                <div>
                  <p style={{ fontSize:"13px",fontWeight:"800",color:cc.text,lineHeight:1 }}>Editing shift</p>
                  <p style={{ fontSize:"11px",color:"#64748B",marginTop:"2px" }}>{schedule[editingIdx]?.date}</p>
                </div>
              </div>
              <button onClick={cancelEdit} style={{ width:"28px",height:"28px",borderRadius:"8px",border:`1px solid ${cc.border}`,background:"#fff",color:"#64748B",fontSize:"12px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}><X size={12} /></button>
            </div>

            <div style={{ padding:"16px" }}>
              {/* Basic fields */}
              <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"10px",marginBottom:"16px" }}>
                {[
                  {label:"Shift title", field:"title",      type:"text", val:draft.title},
                  {label:"Start",       field:"start_time", type:"time", val:draft.start_time},
                  {label:"End",         field:"end_time",   type:"time", val:draft.end_time},
                ].map(f=>(
                  <div key={f.field}>
                    <p style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"5px" }}>{f.label}</p>
                    <input type={f.type} value={f.val} onChange={e=>setDraftField(f.field,e.target.value)} style={F} />
                  </div>
                ))}
              </div>

              {/* Roles */}
              <p style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"8px" }}>Roles & Assigned Staff</p>
              <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"12px" }}>
                {draft.roles.map((r,j)=>(
                  <div key={j} style={{ display:"grid",gridTemplateColumns:"1.5fr 56px 2fr 30px",gap:"6px",alignItems:"center" }}>
                    <input style={F} placeholder="Role name" value={r.role_name} onChange={e=>setRoleField(j,"role_name",e.target.value)}/>
                    <input type="number" min="1" style={{...F,textAlign:"center"}} value={r.headcount} onChange={e=>setRoleField(j,"headcount",Number(e.target.value))}/>
                    <input style={F} placeholder="Staff, comma-separated" value={(r.assigned_staff||[]).join(", ")} onChange={e=>setRoleField(j,"assigned_staff",e.target.value.split(",").map(x=>x.trim()).filter(Boolean))}/>
                    <button onClick={()=>removeRole(j)} style={{ width:"30px",height:"30px",borderRadius:"7px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><X size={16} /></button>
                  </div>
                ))}
              </div>

              <div style={{ display:"flex",gap:"8px" }}>
                <button onClick={addRole} style={{ padding:"7px 14px",borderRadius:"8px",border:`1.5px solid ${cc.border}`,background:cc.bg,color:cc.text,fontSize:"12px",fontWeight:"700",cursor:"pointer" }}>+ Add Role</button>
                <button onClick={()=>saveEdit(editingIdx)} style={{ padding:"7px 20px",borderRadius:"8px",border:"none",background:`linear-gradient(135deg,${cc.top},${COL_COLORS[(cols.indexOf(schedule[editingIdx]?.date)+1)%COL_COLORS.length].top})`,color:"#fff",fontSize:"12px",fontWeight:"700",cursor:"pointer",boxShadow:"0 3px 10px rgba(0,0,0,0.15)" }}>Save changes</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function CreateShiftBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#1D4ED8" : "#2563EB", color: "#FFFFFF", border: "none",
        padding: "10px 18px", borderRadius: "10px", fontSize: "14px",
        fontWeight: "600", cursor: "pointer", transition: "background 0.15s",
      }}>
      + Create Task
    </button>
  );
}

function ViewToggleBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 16px", background: active ? "#FFFFFF" : "transparent",
        border: "none", borderRadius: "7px", fontSize: "13px",
        fontWeight: active ? "600" : "500", color: active ? "#1E293B" : "#64748B",
        cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function StatusChip({ label, active, onClick, status }) {
  const statusMap = {
    all:       { activeBg: "#EFF6FF", activeBorder: "#2563EB", activeColor: "#2563EB" },
    draft:     { activeBg: "#F9FAFB", activeBorder: "#9CA3AF", activeColor: "#374151" },
    published: { activeBg: "#F0FDF4", activeBorder: "#22C55E", activeColor: "#166534" },
    completed: { activeBg: "#EFF6FF", activeBorder: "#3B82F6", activeColor: "#1E40AF" },
    cancelled: { activeBg: "#FEF2F2", activeBorder: "#EF4444", activeColor: "#991B1B" },
  };
  const m = statusMap[status] || statusMap.all;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px", borderRadius: "100px", fontSize: "12px", fontWeight: "600",
        cursor: "pointer",
        border: active ? `1.5px solid ${m.activeBorder}` : "1.5px solid #E2E8F0",
        background: active ? m.activeBg : "#FFFFFF",
        color: active ? m.activeColor : "#64748B",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function WeekNavBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        background: hovered ? "#EFF6FF" : "#F8FAFC",
        border: "1px solid #E2E8F0", fontSize: "14px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        color: hovered ? "#2563EB" : "#64748B", transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateShort(d) {
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function fmtDateLong(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const ms = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  modal: { background: "#FFFFFF", borderRadius: "18px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", animation: "modalIn 0.25s ease both" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "16px", fontWeight: "800", color: "#4338CA" },
  sub: { fontSize: "12px", color: "#6D28D9", opacity: 0.8, marginTop: "3px" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", color: "#94A3B8", cursor: "pointer", padding: "2px 6px", lineHeight: 1 },
  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "9px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "14px" },
  field: { marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  hint: { fontSize: "12px", color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "7px", padding: "6px 10px", marginTop: "6px" },
  addRoleBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  roleRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" },
  roleInput: { flex: 2, minWidth: 0, padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  roleSelect: { flex: 1.5, minWidth: 0, padding: "9px 8px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  roleHC: { width: "62px", flexShrink: 0, padding: "9px 8px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  removeRoleBtn: { background: "none", border: "none", fontSize: "13px", color: "#EF4444", cursor: "pointer", padding: "4px", flexShrink: 0 },
  aiSubmitBtn: { marginTop: "22px", width: "100%", padding: "12px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#FFF", cursor: "pointer", letterSpacing: "0.01em" },
  viewShiftBtn: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" },
  recRoleLabel: { fontSize: "11px", fontWeight: "700", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" },
  sugRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", marginBottom: "6px" },
  rankBadge: { width: "22px", height: "22px", borderRadius: "50%", color: "#FFF", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sugName: { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  confBadge: { fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "100px" },
  sugReason: { fontSize: "12px", color: "#64748B", marginTop: "2px", lineHeight: 1.4 },
  assignBtn: { border: "none", borderRadius: "7px", padding: "7px 13px", fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" },
};
