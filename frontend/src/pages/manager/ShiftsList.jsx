import { useState, useEffect, useRef } from "react";
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
  const [branchInfo, setBranchInfo] = useState({ branch_id: null });
  const [operatingDays, setOperatingDays] = useState(null); // null = not loaded yet
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("calendar");
  const [filterStatus, setFilter]   = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [deleting, setDeleting]     = useState(false);
  const [publishing, setPublishing] = useState(false);

  // AI Weekly Schedule state — step: 'config' | 'generating' | 'preview' | 'creating' | 'done'
  const [weeklyAI, setWeeklyAI] = useState(null);
  const [branchStaff, setBranchStaff] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("branch_id").eq("user_id", userId).eq("is_active", true).limit(1);
        let oid = myStaff?.[0]?.branch_id;
        if (!oid) {
          const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
          oid = omRow?.[0]?.branch_id;
        }
        if (!oid || cancelled) return;

        if (!cancelled) setBranchInfo({ branch_id: oid });

        // Fetch branch settings for operating days
        api.get(`/api/business/branches/${oid}/settings`).then(r => {
          if (!cancelled && r?.settings?.operating_days) {
            setOperatingDays(r.settings.operating_days.split("").map(Number));
          }
        }).catch(() => {});

        const { data: shiftRows } = await supabase
          .from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status, branch_id, shift_tasks ( task_id, status )")
          .eq("branch_id", oid)
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

        // Load krewby requests for this branch to factor into fill status
        const { data: krewbyRows } = await supabase
          .from("krewby_requests")
          .select("shift_id, role_id, status")
          .eq("branch_id", oid)
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

  async function publishSelected() {
    const draftIds = shifts.filter(s => selected.has(s.shift_id) && s.status === "draft").map(s => s.shift_id);
    if (draftIds.length === 0) return;
    setPublishing(true);
    try {
      const { error } = await supabase.from("shifts").update({ status: "published" }).in("shift_id", draftIds);
      if (error) throw error;
      setShifts(prev => prev.map(s => draftIds.includes(s.shift_id) ? { ...s, status: "published" } : s));
      setSelected(new Set());
      setSelectMode(false);
    } catch (err) {
      alert("Failed to publish some shifts: " + err.message);
    } finally {
      setPublishing(false);
    }
  }

  async function openGenerateConfig(weekDates) {
    const weekStart  = localDateStr(weekDates[0]);
    const weekEnd    = localDateStr(weekDates[6]);
    const weekDateStrs = weekDates.map(d => localDateStr(d));

    const oid = branchInfo.branch_id;
    const [regularRes, casualPrefRes, tmplRes, skillsRes] = await Promise.all([
      oid ? supabase.from("staff").select("users(full_name)").eq("branch_id", oid).eq("is_active", true).eq("staff_type", "regular") : Promise.resolve({ data: [] }),
      oid ? supabase.from("casual_branch_preferences").select("user_id").eq("branch_id", oid) : Promise.resolve({ data: [] }),
      oid ? supabase.from("branch_role_templates").select("role_name, headcount").eq("branch_id", oid) : Promise.resolve({ data: [] }),
      oid ? api.get(`/api/business/branches/${oid}/skills`).catch(() => ({ skills: [] })) : Promise.resolve({ skills: [] }),
    ]);

    const casualUserIds = (casualPrefRes.data || []).map(r => r.user_id);
    const casualRes = casualUserIds.length > 0
      ? await supabase.from("staff").select("users(full_name)").in("user_id", casualUserIds).eq("staff_type", "casual").eq("is_active", true)
      : { data: [] };

    const allStaff = [
      ...(regularRes.data || []).map(s => ({ name: s.users?.full_name, type: "regular" })),
      ...(casualRes.data || []).map(s => ({ name: s.users?.full_name, type: "casual" })),
    ].filter(s => s.name);
    setBranchStaff(allStaff);

    const defaultOffDays = weekDates.filter((_, i) => operatingDays !== null && !operatingDays[i]).map(d => localDateStr(d));
    const preloadedRoles = (tmplRes.data || []).map(r => ({ role_name: r.role_name, headcount: r.headcount || 1 }));
    const branchSkills   = (skillsRes.skills || []).map(s => s.name).filter(Boolean);
    const defaultRole    = preloadedRoles.length > 0 ? preloadedRoles : [{ role_name: "", headcount: 1 }];

    setWeeklyAI({
      step: "config",
      weekStart, weekEnd,
      weekDateStrs,
      branchSkills,
      config: {
        shiftsPerDay: 2,
        shiftNames: ["Morning", "Evening"],
        offDays: defaultOffDays,
        // shiftRoles[i] = roles array for shift i
        shiftRoles: [defaultRole.map(r => ({...r})), defaultRole.map(r => ({...r}))],
      },
    });
  }

  async function runGenerate(weekStart, weekEnd, config) {
    setWeeklyAI(prev => ({ ...prev, step: "generating" }));
    try {
      const result = await api.post("/api/shifts/generate-week", { weekStart, weekEnd, preferences: config });
      setWeeklyAI(prev => ({ ...prev, step: "preview", schedule: result.schedule, accepted: new Set(result.schedule.map((_, i) => i)) }));
    } catch (err) {
      setWeeklyAI(prev => ({ ...prev, step: "error", message: err.message }));
    }
  }

  async function runReschedule() {
    const { schedule } = weeklyAI;
    setWeeklyAI(prev => ({ ...prev, step: "rescheduling" }));
    try {
      const result = await api.post("/api/shifts/reschedule-staff", { schedule });
      setWeeklyAI(prev => ({ ...prev, step: "preview", schedule: result.schedule, accepted: new Set(result.schedule.map((_, i) => i)) }));
    } catch (err) {
      setWeeklyAI(prev => ({ ...prev, step: "error", message: err.message }));
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
      const oid = branchInfo.branch_id;
      if (oid) {
        const { data } = await supabase.from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status, branch_id, shift_tasks ( task_id, status )")
          .eq("branch_id", oid).order("shift_date", { ascending: false });
        if (data) setShifts(data.map(s => ({ ...s, shift_date: s.shift_date?.split("T")[0] ?? s.shift_date })));
      }
      setTimeout(() => setWeeklyAI(null), 2000);
    } catch (err) {
      setWeeklyAI(prev => ({ ...prev, step: "error", message: err.message }));
    }
  }

  const weekDates = getWeekDates();

  const filtered = shifts.filter(s => filterStatus === "all" || s.status === filterStatus);

  function getFillStatus(shift) {
    const tasks = shift.shift_tasks || [];
    if (tasks.length === 0) return null;
    const assigned = tasks.filter(t => t.status === "assigned" || t.status === "done").length;
    if (assigned >= tasks.length) return "full";
    return "partial";
  }

  function getShiftsForDate(date) {
    const dateStr = localDateStr(date);
    return shifts.filter(s => s.shift_date?.slice(0, 10) === dateStr && s.status !== "cancelled");
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
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Shifts</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{filtered.length} total shifts</p>
          </div>
          <CreateShiftBtn onClick={() => goTo("/manager/shifts/new")} />
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
            {selectMode && selected.size > 0 && (() => {
              const draftCount = shifts.filter(s => selected.has(s.shift_id) && s.status === "draft").length;
              return (
                <>
                  {draftCount > 0 && (
                    <button onClick={publishSelected} disabled={publishing}
                      style={{ padding: "7px 14px", borderRadius: "9px", border: "none", background: "#F59E0B", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                      {publishing ? "Publishing…" : <><Check size={13} /> Publish ({draftCount})</>}
                    </button>
                  )}
                  <button onClick={deleteSelected} disabled={deleting}
                    style={{ padding: "7px 14px", borderRadius: "9px", border: "none", background: "#EF4444", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                    {deleting ? "Deleting…" : <><Trash2 size={13} /> Delete ({selected.size})</>}
                  </button>
                </>
              );
            })()}
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
              <CreateShiftBtn onClick={() => goTo("/manager/shifts/new")} />
            </div>
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
                <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
              </div>
              {filtered.map(shift => (
                <ShiftRow key={shift.shift_id} shift={shift} fill={getFillStatus(shift)} onNav={() => goTo(`/manager/shifts/${shift.shift_id}`)} />
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
                <button onClick={() => openGenerateConfig(weekDates)}
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
                const isOff = operatingDays !== null && !operatingDays[i];
                return (
                  <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", padding: "10px", minHeight: "140px", background: isOff ? "#F8F9FA" : isToday ? "#F0F7FF" : "transparent" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: isOff ? "#D1D5DB" : "#94A3B8", textTransform: "uppercase", marginBottom: "3px" }}>{DAYS[i]}</span>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: isToday && !isOff ? "#2563EB" : "transparent", color: isOff ? "#D1D5DB" : isToday ? "#fff" : "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700" }}>
                        {date.getDate()}
                      </div>
                      {isOff && <span style={{ fontSize: "9px", fontWeight: "600", color: "#D1D5DB", marginTop: "2px", letterSpacing: "0.3px" }}>OFF</span>}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {dayShifts.map(shift => {
                        const isSelected = selected.has(shift.shift_id);
                        return (
                          <div key={shift.shift_id}
                            style={{ padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", display: "flex", alignItems: "flex-start", gap: "5px", outline: isSelected ? "2px solid #6366F1" : "none", opacity: isOff ? 0.55 : 1, ...STATUS_STYLES[shift.status] }}
                            onClick={() => selectMode ? toggleSelect(shift.shift_id) : goTo(`/manager/shifts/${shift.shift_id}`)}>
                            {selectMode && (
                              <div style={{ width: "13px", height: "13px", borderRadius: "3px", border: `2px solid ${isSelected ? "#6366F1" : "rgba(0,0,0,0.25)"}`, background: isSelected ? "#6366F1" : "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: "1px" }}>
                                {isSelected && <Check size={9} color="#fff" strokeWidth={4} />}
                              </div>
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "1px" }}>{shift.title || "Task"}</p>
                              <p style={{ opacity: 0.75 }}>{toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</p>
                            </div>
                          </div>
                        );
                      })}
                      {!isOff && (
                        <div
                          style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", cursor: "pointer", padding: "3px", borderRadius: "6px", border: "1px dashed #E2E8F0", marginTop: dayShifts.length > 0 ? "2px" : 0 }}
                          onClick={() => goTo(`/manager/shifts/new?date=${date.toISOString().split("T")[0]}`)}>
                          +
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Weekly Schedule Modal ───────────────────────────────────────── */}
      {weeklyAI && (
        <div style={{ position:"fixed",inset:0,zIndex:99999,background:"rgba(2,6,23,0.8)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
          onClick={() => !["generating","creating","rescheduling"].includes(weeklyAI.step) && setWeeklyAI(null)}>
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

              {/* Config */}
              {weeklyAI.step === "config" && (() => {
                const cfg = weeklyAI.config;
                const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
                const SHIFT_DEFAULTS = ["Morning","Afternoon","Evening","Night"];
                const sectionCard = { background:"#fff",borderRadius:"16px",border:"1.5px solid #E8EDF5",padding:"24px 28px",boxShadow:"0 1px 4px rgba(0,0,0,0.04)" };
                const sectionTitle = { fontSize:"14px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" };
                const sectionSub   = { fontSize:"12px",color:"#94A3B8",marginBottom:"16px" };
                return (
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",height:"100%" }}>

                    {/* LEFT column */}
                    <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>

                      {/* Shifts per day */}
                      <div style={sectionCard}>
                        <p style={sectionTitle}>How many shifts per day?</p>
                        <p style={sectionSub}>Divide your working hours into equal time slots</p>
                        <div style={{ display:"flex",gap:"10px" }}>
                          {[1,2,3].map(n => {
                            const active = cfg.shiftsPerDay === n;
                            return (
                              <button key={n} onClick={() => {
                                const names = Array.from({length:n}, (_,i) => cfg.shiftNames[i] || SHIFT_DEFAULTS[i] || `Shift ${i+1}`);
                                const shiftRoles = Array.from({length:n}, (_,i) =>
                                  cfg.shiftRoles?.[i] ? [...cfg.shiftRoles[i]] : (cfg.shiftRoles?.[0] || [{role_name:"",headcount:1}]).map(r=>({...r}))
                                );
                                setWeeklyAI(prev => ({ ...prev, config: { ...prev.config, shiftsPerDay: n, shiftNames: names, shiftRoles } }));
                              }}
                                style={{ flex:1,padding:"20px 10px",borderRadius:"12px",border:`2px solid ${active?"#6366F1":"#E2E8F0"}`,background:active?"#EEF2FF":"#F8FAFC",color:active?"#4F46E5":"#94A3B8",cursor:"pointer",transition:"all 0.15s",textAlign:"center" }}>
                                <div style={{ fontSize:"28px",fontWeight:"900",lineHeight:1,color:active?"#4F46E5":"#1E293B" }}>{n}</div>
                                <div style={{ fontSize:"11px",fontWeight:"600",marginTop:"5px",color:active?"#6366F1":"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>
                                  {n===1?"single":n===2?"split":"triple"}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Shift names */}
                      <div style={{ ...sectionCard, flex:1 }}>
                        <p style={sectionTitle}>Name your shifts</p>
                        <p style={sectionSub}>Customise how each shift appears in the schedule</p>
                        <div style={{ display:"flex",flexDirection:"column",gap:"10px" }}>
                          {cfg.shiftNames.map((name, i) => (
                            <div key={i} style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                              <div style={{ width:"28px",height:"28px",borderRadius:"8px",background:"#EEF2FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                <span style={{ fontSize:"11px",fontWeight:"800",color:"#6366F1" }}>{i+1}</span>
                              </div>
                              <input value={name}
                                onChange={e => { const n=[...cfg.shiftNames]; n[i]=e.target.value; setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftNames:n}})); }}
                                style={{ flex:1,padding:"10px 14px",borderRadius:"9px",border:"1.5px solid #E2E8F0",fontSize:"14px",color:"#1E293B",outline:"none",fontFamily:"inherit",background:"#F8FAFC" }}
                                placeholder={SHIFT_DEFAULTS[i] || "Shift name"} />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* RIGHT column */}
                    <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>

                      {/* Days off — only operating days shown */}
                      {(() => {
                        const operatingEntries = weeklyAI.weekDateStrs
                          .map((dateStr, i) => ({ dateStr, i }))
                          .filter(({ i }) => !operatingDays || operatingDays[i]);
                        return (
                          <div style={sectionCard}>
                            <p style={sectionTitle}>Close a day this week?</p>
                            <p style={sectionSub}>Toggle any operating day off — AI will skip it</p>
                            {operatingEntries.length === 0 ? (
                              <p style={{ fontSize:"13px",color:"#94A3B8",textAlign:"center",padding:"16px 0" }}>No operating days found for this week</p>
                            ) : (
                              <>
                                <div style={{ display:"grid",gridTemplateColumns:`repeat(${operatingEntries.length},1fr)`,gap:"8px" }}>
                                  {operatingEntries.map(({ dateStr, i }) => {
                                    const isOff = cfg.offDays.includes(dateStr);
                                    const d = new Date(dateStr+"T00:00:00");
                                    return (
                                      <button key={dateStr} onClick={() => {
                                        const offs = isOff ? cfg.offDays.filter(x=>x!==dateStr) : [...cfg.offDays, dateStr];
                                        setWeeklyAI(prev=>({...prev,config:{...prev.config,offDays:offs}}));
                                      }}
                                        style={{ padding:"12px 4px",borderRadius:"12px",border:`2px solid ${isOff?"#FCA5A5":"#E2E8F0"}`,background:isOff?"#FEF2F2":"#F8FAFC",cursor:"pointer",transition:"all 0.15s",textAlign:"center" }}>
                                        <div style={{ fontSize:"9px",fontWeight:"700",color:isOff?"#EF4444":"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px" }}>{DAY_LABELS[i]}</div>
                                        <div style={{ fontSize:"18px",fontWeight:"800",color:isOff?"#DC2626":"#1E293B",lineHeight:1 }}>{d.getDate()}</div>
                                        <div style={{ marginTop:"6px",fontSize:"13px",color:isOff?"#EF4444":"#CBD5E1" }}>{isOff?"✕":"·"}</div>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div style={{ marginTop:"12px",display:"flex",gap:"16px" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                                    <div style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#F8FAFC",border:"2px solid #E2E8F0" }}/>
                                    <span style={{ fontSize:"11px",color:"#94A3B8",fontWeight:"500" }}>Open</span>
                                  </div>
                                  <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                                    <div style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#FEF2F2",border:"2px solid #FCA5A5" }}/>
                                    <span style={{ fontSize:"11px",color:"#94A3B8",fontWeight:"500" }}>Closed</span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* Roles & headcounts — per shift */}
                      <div style={{ ...sectionCard, flex:1 }}>
                        <p style={sectionTitle}>Roles & Headcounts</p>
                        <p style={sectionSub}>Set roles and staff count for each shift independently</p>
                        {weeklyAI.branchSkills.length === 0 && (
                          <div style={{ padding:"10px 12px",borderRadius:"8px",background:"#FFFBEB",border:"1.5px solid #FDE68A",marginBottom:"12px",display:"flex",gap:"8px",alignItems:"center" }}>
                            <AlertTriangle size={13} color="#D97706" style={{ flexShrink:0 }} />
                            <span style={{ fontSize:"11px",color:"#92400E",fontWeight:"500" }}>No skills configured. Add them in the Skills section first.</span>
                          </div>
                        )}
                        <div style={{ display:"flex",flexDirection:"column",gap:"16px" }}>
                          {cfg.shiftNames.map((shiftName, si) => {
                            const roles = cfg.shiftRoles?.[si] || [];
                            const SHIFT_COLORS = [
                              {bg:"#EEF2FF",border:"#C7D2FE",text:"#4F46E5",dot:"#6366F1"},
                              {bg:"#F5F3FF",border:"#DDD6FE",text:"#6D28D9",dot:"#8B5CF6"},
                              {bg:"#FDF2F8",border:"#FBCFE8",text:"#BE185D",dot:"#EC4899"},
                            ];
                            const sc = SHIFT_COLORS[si % SHIFT_COLORS.length];
                            return (
                              <div key={si}>
                                {/* Shift label */}
                                <div style={{ display:"flex",alignItems:"center",gap:"7px",marginBottom:"8px" }}>
                                  <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:sc.dot,flexShrink:0 }}/>
                                  <span style={{ fontSize:"12px",fontWeight:"700",color:sc.text,textTransform:"uppercase",letterSpacing:"0.4px" }}>{shiftName || `Shift ${si+1}`}</span>
                                </div>
                                {/* Role rows */}
                                <div style={{ display:"flex",flexDirection:"column",gap:"6px",marginBottom:"6px" }}>
                                  {roles.map((r, j) => (
                                    <div key={j} style={{ display:"grid",gridTemplateColumns:"1fr 80px 32px",gap:"6px",alignItems:"center" }}>
                                      {weeklyAI.branchSkills.length > 0 ? (
                                        <SkillSelect
                                          value={r.role_name}
                                          options={weeklyAI.branchSkills}
                                          onChange={name => {
                                            const sr=[...(cfg.shiftRoles||[])];
                                            const updated=[...roles]; updated[j]={...updated[j],role_name:name};
                                            sr[si]=updated;
                                            setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                          }}
                                        />
                                      ) : (
                                        <input value={r.role_name} placeholder="Role / skill"
                                          onChange={e => {
                                            const sr=[...(cfg.shiftRoles||[])];
                                            const updated=[...roles]; updated[j]={...updated[j],role_name:e.target.value};
                                            sr[si]=updated;
                                            setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                          }}
                                          style={{ padding:"9px 12px",borderRadius:"8px",border:"1.5px solid #E2E8F0",fontSize:"13px",color:"#1E293B",outline:"none",fontFamily:"inherit",background:"#F8FAFC" }}/>
                                      )}
                                      <div style={{ display:"flex",alignItems:"center",border:"1.5px solid #E2E8F0",borderRadius:"8px",background:"#F8FAFC",overflow:"hidden" }}>
                                        <button onClick={() => {
                                          const sr=[...(cfg.shiftRoles||[])];
                                          const updated=[...roles]; updated[j]={...updated[j],headcount:Math.max(1,r.headcount-1)};
                                          sr[si]=updated;
                                          setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                        }} style={{ width:"26px",height:"34px",border:"none",background:"none",color:sc.dot,fontSize:"16px",fontWeight:"700",cursor:"pointer",flexShrink:0 }}>−</button>
                                        <span style={{ flex:1,textAlign:"center",fontSize:"13px",fontWeight:"700",color:"#1E293B" }}>{r.headcount}</span>
                                        <button onClick={() => {
                                          const sr=[...(cfg.shiftRoles||[])];
                                          const updated=[...roles]; updated[j]={...updated[j],headcount:r.headcount+1};
                                          sr[si]=updated;
                                          setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                        }} style={{ width:"26px",height:"34px",border:"none",background:"none",color:sc.dot,fontSize:"16px",fontWeight:"700",cursor:"pointer",flexShrink:0 }}>+</button>
                                      </div>
                                      <button onClick={() => {
                                        const sr=[...(cfg.shiftRoles||[])];
                                        const updated=roles.filter((_,k)=>k!==j);
                                        sr[si]=updated.length>0?updated:[{role_name:"",headcount:1}];
                                        setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                      }} style={{ width:"32px",height:"34px",borderRadius:"8px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                        <X size={13}/>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                                <button onClick={() => {
                                  const sr=[...(cfg.shiftRoles||[])];
                                  sr[si]=[...roles,{role_name:"",headcount:1}];
                                  setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                }} style={{ padding:"6px 14px",borderRadius:"8px",border:`1.5px dashed ${sc.border}`,background:sc.bg,color:sc.text,fontSize:"11px",fontWeight:"700",cursor:"pointer",width:"100%" }}>
                                  + Add Role to {shiftName || `Shift ${si+1}`}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Generating / Rescheduling */}
              {(weeklyAI.step === "generating" || weeklyAI.step === "rescheduling") && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"80px 20px",gap:"20px" }}>
                  <div style={{ position:"relative",width:"72px",height:"72px" }}>
                    <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid #EEF2FF" }} />
                    <div style={{ position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#6366F1",animation:"aiSpin 0.85s linear infinite" }} />
                    <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center" }}><Sparkles size={26} color="#6366F1" /></div>
                  </div>
                  <div style={{ textAlign:"center" }}>
                    <p style={{ fontSize:"17px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" }}>
                      {weeklyAI.step === "rescheduling" ? "Balancing workload…" : "Building your week…"}
                    </p>
                    <p style={{ fontSize:"13px",color:"#64748B",lineHeight:1.65,maxWidth:"300px" }}>
                      {weeklyAI.step === "rescheduling"
                        ? "Redistributing staff evenly across all shifts using availability, skills, and fair rotation."
                        : "Analysing staff availability, branch hours, and role templates to craft your schedule."}
                    </p>
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
                  branchStaff={branchStaff}
                  weekStart={weeklyAI.weekStart}
                  onToggle={(i) => setWeeklyAI(prev => { const a = new Set(prev.accepted); a.has(i)?a.delete(i):a.add(i); return {...prev,accepted:a}; })}
                  onEdit={(i, updated) => setWeeklyAI(prev => { const s=[...prev.schedule]; s[i]=updated; return {...prev,schedule:s}; })}
                />
              )}
            </div>

            {/* ── Footer ── */}
            {weeklyAI.step === "config" && (
              <div style={{ padding:"14px 24px",borderTop:"1px solid #E8EDF5",display:"flex",alignItems:"center",gap:"12px",background:"#fff",flexShrink:0 }}>
                <button onClick={() => setWeeklyAI(null)} style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Cancel
                </button>
                <div style={{ flex:1 }} />
                <button onClick={() => runGenerate(weeklyAI.weekStart, weeklyAI.weekEnd, weeklyAI.config)}
                  style={{ padding:"10px 24px",borderRadius:"9px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",boxShadow:"0 4px 14px rgba(99,102,241,0.4)" }}>
                  <Sparkles size={13} /> Generate Week →
                </button>
              </div>
            )}

            {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && (
              <div style={{ padding:"14px 24px",borderTop:"1px solid #E8EDF5",display:"flex",alignItems:"center",gap:"10px",background:"#fff",flexShrink:0 }}>
                <button onClick={() => setWeeklyAI(null)} style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Discard
                </button>
                {/* Reschedule button */}
                <button onClick={runReschedule} disabled={weeklyAI.step==="creating"}
                  style={{ padding:"9px 16px",borderRadius:"9px",border:"1.5px solid #C7D2FE",background:"#EEF2FF",fontSize:"13px",fontWeight:"700",color:"#4F46E5",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",transition:"all 0.15s" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  Reschedule
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
      <span style={{ color: "#64748B" }}>{toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ color: "#64748B" }}>{shift.shift_tasks?.length || 0} task{shift.shift_tasks?.length !== 1 ? "s" : ""}</span>
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

// ── Warning Pill with hover tooltip ────────────────────────────────────────────
function WarnPill({ firstName, winLabel, pillBg, pillColor, pillBorder, tip }) {
  const [show, setShow]   = useState(false);
  const [coord, setCoord] = useState({ x: 0, y: 0 });
  const ref = useRef(null);

  return (
    <span ref={ref}
      onMouseEnter={() => {
        const r = ref.current?.getBoundingClientRect();
        if (r) setCoord({ x: Math.min(r.left, window.innerWidth - 240), y: r.bottom + 8 });
        setShow(true);
      }}
      onMouseLeave={() => setShow(false)}
      style={{ fontSize:"10px", fontWeight:"600", color:pillColor, background:pillBg, border:`1px solid ${pillBorder}`, padding:"2px 7px", borderRadius:"100px", whiteSpace:"nowrap", maxWidth:"100px", overflow:"hidden", textOverflow:"ellipsis", display:"flex", alignItems:"center", gap:"2px", cursor:"default", flexShrink:0, position:"relative" }}>
      <span style={{ flexShrink:0 }}>⚠</span>
      <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{firstName}{winLabel}</span>
      {show && (
        <div style={{ position:"fixed", left:coord.x, top:coord.y, zIndex:9999999, background:"#0F172A", color:"#fff", fontSize:"11px", lineHeight:"1.6", padding:"9px 13px", borderRadius:"10px", maxWidth:"230px", whiteSpace:"normal", pointerEvents:"none", boxShadow:"0 8px 28px rgba(0,0,0,0.45)", width:"max-content" }}>
          <div style={{ position:"absolute", top:"-5px", left:"14px", width:"9px", height:"9px", background:"#0F172A", transform:"rotate(45deg)", borderRadius:"2px" }} />
          {tip}
        </div>
      )}
    </span>
  );
}

// ── Staff Roster Picker ─────────────────────────────────────────────────────────
function StaffRosterPicker({ branchStaff, rosterData, rosterLoading, assigned, headcount, accent, onChange }) {
  const [search, setSearch] = useState("");
  const filled = assigned.length;
  const isFull = filled >= headcount;

  // Sort staff: available first, then partial/booked, then unavailable
  function availRank(s) {
    const r = rosterData?.[s.name];
    if (!r) return 2;
    if (r.is_on_leave) return 4;
    if (r.is_double_booked) return 3;
    if (s.type === "casual") {
      if (r.casual_available_today === false) return 3;
      if (r.casual_available_today === null) return 2;
    }
    return 1;
  }

  const allFiltered = branchStaff
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => availRank(a) - availRank(b));
  const regular = allFiltered.filter(s => s.type === "regular");
  const casual  = allFiltered.filter(s => s.type === "casual");

  function toggle(name) {
    onChange(assigned.includes(name) ? assigned.filter(n => n !== name) : [...assigned, name]);
  }

  function initials(name) {
    return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  }

  function availBadge(s) {
    const r = rosterData?.[s.name];
    if (rosterLoading) return <span style={{ fontSize:"10px", color:"#CBD5E1" }}>…</span>;
    if (!r) return null;

    if (r.is_on_leave)
      return <span style={{ fontSize:"10px", fontWeight:"600", color:"#DC2626", background:"#FEF2F2", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>On leave</span>;

    if (r.is_double_booked) {
      const b = r.double_booked_shift;
      const label = b ? `Booked ${b.start_time?.slice(0,5)}–${b.end_time?.slice(0,5)}` : "Double-booked";
      return <span style={{ fontSize:"10px", fontWeight:"600", color:"#B45309", background:"#FFFBEB", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{label}</span>;
    }

    if (s.type === "casual") {
      const { casual_available_today, casual_avail_from, casual_avail_to } = r;
      if (casual_available_today === false && !casual_avail_from)
        return <span style={{ fontSize:"10px", fontWeight:"600", color:"#94A3B8", background:"#F1F5F9", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>Not available</span>;
      if (casual_available_today === false && casual_avail_from)
        return <span style={{ fontSize:"10px", fontWeight:"600", color:"#D97706", background:"#FFFBEB", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{casual_avail_from?.slice(0,5)}–{casual_avail_to?.slice(0,5)}</span>;
      if (casual_available_today === true && (casual_avail_from || casual_avail_to))
        return <span style={{ fontSize:"10px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{casual_avail_from?.slice(0,5)}–{casual_avail_to?.slice(0,5)}</span>;
      if (casual_available_today === true)
        return <span style={{ fontSize:"10px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>Available</span>;
      return null;
    }

    const h = r.hours_this_week || 0;
    return <span style={{ fontSize:"10px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{h > 0 ? `${h}h this week` : "Available"}</span>;
  }

  const filledColor = isFull ? accent.text : "#D97706";
  const filledBg    = isFull ? accent.bg   : "#FFFBEB";
  const filledBdr   = isFull ? accent.border : "#FDE68A";

  return (
    <div style={{ padding:"12px 14px", borderTop:"1px solid #F1F5F9" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <p style={{ fontSize:"10px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.3px" }}>Assign Staff</p>
        <span style={{ fontSize:"11px", fontWeight:"700", color:filledColor, background:filledBg, padding:"2px 8px", borderRadius:"100px", border:`1px solid ${filledBdr}` }}>
          {filled}/{headcount} filled
        </span>
      </div>

      {/* Selected pills */}
      {assigned.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"10px" }}>
          {assigned.map(name => (
            <span key={name} style={{ display:"flex", alignItems:"center", gap:"4px", padding:"3px 10px 3px 8px", borderRadius:"100px", background:accent.top, color:"#fff", fontSize:"12px", fontWeight:"600" }}>
              <span style={{ width:"16px", height:"16px", borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"8px", fontWeight:"700" }}>
                {initials(name)}
              </span>
              {name}
              <button onClick={() => toggle(name)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0", display:"flex", color:"rgba(255,255,255,0.8)", lineHeight:1 }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      {branchStaff.length > 0 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search staff…"
          style={{ width:"100%", boxSizing:"border-box", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"12px", color:"#1E293B", outline:"none", marginBottom:"8px", background:"#F8FAFC" }}
        />
      )}

      {/* Staff list */}
      {branchStaff.length === 0 ? (
        <input
          style={{ width:"100%", boxSizing:"border-box", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"12px", color:"#1E293B", outline:"none" }}
          placeholder="Type staff names, comma-separated"
          value={assigned.join(", ")}
          onChange={e => onChange(e.target.value.split(",").map(x => x.trim()).filter(Boolean))}
        />
      ) : (
        <div style={{ maxHeight:"220px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"2px" }}>
          {[{ label:"Regular", rows: regular }, { label:"Casual", rows: casual }].map(({ label, rows }) =>
            rows.length === 0 ? null : (
              <div key={label}>
                <p style={{ fontSize:"9px", fontWeight:"700", color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.5px", padding:"4px 4px 2px" }}>{label}</p>
                {rows.map(({ name, type }) => {
                  const sel = assigned.includes(name);
                  const r   = rosterData?.[name];
                  const unavail = r && (r.is_on_leave || r.is_double_booked || (type === "casual" && r.casual_available_today === false));
                  return (
                    <button key={name} onClick={() => toggle(name)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:"10px", padding:"7px 8px", borderRadius:"8px", border:"none", background:sel ? accent.bg : "transparent", cursor:"pointer", textAlign:"left", transition:"background 0.1s", opacity: unavail && !sel ? 0.6 : 1 }}>
                      <span style={{ width:"28px", height:"28px", borderRadius:"50%", background:sel ? accent.top : "#E2E8F0", color:sel ? "#fff" : "#64748B", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"700", flexShrink:0 }}>
                        {initials(name)}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:"13px", fontWeight:"600", color:sel ? "#1E293B" : "#475569", display:"block", lineHeight:"1.2" }}>{name}</span>
                        <div style={{ marginTop:"2px" }}>{availBadge({ name, type })}</div>
                      </div>
                      <span style={{ fontSize:"10px", fontWeight:"600", padding:"2px 7px", borderRadius:"100px", background:type === "regular" ? "#EFF6FF" : "#F0FDF4", color:type === "regular" ? "#3B82F6" : "#10B981", flexShrink:0 }}>
                        {type === "regular" ? "Regular" : "Casual"}
                      </span>
                      {sel && <Check size={13} strokeWidth={3} color={accent.top} />}
                    </button>
                  );
                })}
              </div>
            )
          )}
          {allFiltered.length === 0 && <p style={{ fontSize:"12px", color:"#94A3B8", padding:"8px 4px" }}>No staff match "{search}"</p>}
        </div>
      )}
    </div>
  );
}

// ── Weekly Schedule Preview (editable) ─────────────────────────────────────────
const DAY_ACCENT = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];

function WeeklySchedulePreview({ schedule, accepted, branchStaff = [], weekStart, onToggle, onEdit }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [draft, setDraft]           = useState(null);
  const [rosterData, setRosterData]         = useState(null);    // edit popup: name -> roster info
  const [rosterLoading, setRosterLoading]   = useState(false);
  const [allRosterData, setAllRosterData]   = useState({});     // cards: "date|start|end" -> { name -> info }

  // Fetch roster for every shift in the schedule once on mount (for card warnings)
  useEffect(() => {
    if (!schedule || schedule.length === 0) return;
    const seen = new Set();
    const fetches = schedule
      .filter(s => s.date && s.start_time && s.end_time)
      .filter(s => {
        const k = `${s.date}|${s.start_time.slice(0,5)}|${s.end_time.slice(0,5)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map(async s => {
        const key = `${s.date}|${s.start_time.slice(0,5)}|${s.end_time.slice(0,5)}`;
        try {
          const params = new URLSearchParams({ date: s.date, start_time: s.start_time.slice(0,5), end_time: s.end_time.slice(0,5) });
          const res = await api.get(`/api/shifts/roster-preview?${params}`);
          if (res?.roster) {
            const map = {};
            res.roster.forEach(r => { map[r.full_name] = r; });
            return [key, map];
          }
        } catch {}
        return null;
      });
    Promise.all(fetches).then(results => {
      const combined = {};
      results.forEach(r => { if (r) combined[r[0]] = r[1]; });
      setAllRosterData(combined);
    });
  }, [schedule]);

  async function startEdit(i) {
    setDraft(JSON.parse(JSON.stringify(schedule[i])));
    setEditingIdx(i);
    const s = schedule[i];
    if (s?.date && s?.start_time && s?.end_time) {
      setRosterLoading(true);
      setRosterData(null);
      try {
        const params = new URLSearchParams({
          date:       s.date,
          start_time: s.start_time.slice(0, 5),
          end_time:   s.end_time.slice(0, 5),
        });
        const res = await api.get(`/api/shifts/roster-preview?${params}`);
        if (res?.roster) {
          const map = {};
          res.roster.forEach(r => { map[r.full_name] = r; });
          setRosterData(map);
        }
      } catch (e) {
        console.error("previewRoster error", e);
      } finally {
        setRosterLoading(false);
      }
    }
  }
  function saveEdit(i)              { onEdit(i, draft); setEditingIdx(null); setDraft(null); setRosterData(null); }
  function cancelEdit()             { setEditingIdx(null); setDraft(null); setRosterData(null); }
  function setDraftField(f, v)      { setDraft(d => ({ ...d, [f]: v })); }
  function setRoleField(j, f, v)    { setDraft(d => { const r=[...d.roles]; r[j]={...r[j],[f]:v}; return {...d,roles:r}; }); }
  function addRole()                { setDraft(d => ({ ...d, roles:[...d.roles,{role_name:"",headcount:1,assigned_staff:[]}] })); }
  function removeRole(j)            { setDraft(d => ({ ...d, roles:d.roles.filter((_,k)=>k!==j) })); }

  // Build 7-col grid anchored to Monday of the week (UTC-safe, no timezone shift)
  // Use weekStart prop so the grid is always Mon–Sun regardless of which days have shifts
  const anchorDate = weekStart || schedule.map(s=>s.date).sort()[0] || new Date().toISOString().split("T")[0];
  const [_fy,_fm,_fd] = anchorDate.split("-").map(Number);
  const cols = Array.from({length:7}, (_,i) =>
    new Date(Date.UTC(_fy, _fm-1, _fd+i)).toISOString().split("T")[0]
  );
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
          const d       = new Date(dateKey+"T12:00:00Z"); // noon UTC — safe in any timezone
          const dayAbbr = d.toLocaleDateString("en-SG",{weekday:"short"});
          const dayNum  = d.getUTCDate();
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
                const allStaff   = (s.roles||[]).flatMap(r=>r.assigned_staff||[]);
                const totalSlots = (s.roles||[]).reduce((a,r)=>a+(r.headcount||1),0);
                const filled     = allStaff.length;
                const fullyStaffed = filled >= totalSlots && totalSlots > 0;

                return (
                  <div key={i}
                    onClick={() => { if(!isEditing) onToggle(i); }}
                    style={{
                      borderRadius:"12px",
                      border:`1.5px solid ${isEditing?cc.top:checked?cc.border:"#E8EDF5"}`,
                      background: isEditing ? cc.bg : checked ? "#fff" : "#FAFBFE",
                      cursor:"pointer",
                      transition:"all 0.18s",
                      overflow:"hidden",
                      boxShadow: isEditing
                        ? `0 0 0 2px ${cc.border}, 0 4px 12px rgba(0,0,0,0.06)`
                        : checked
                        ? "0 2px 8px rgba(99,102,241,0.08)"
                        : "0 1px 3px rgba(0,0,0,0.03)",
                    }}>

                    {/* Colored top stripe */}
                    <div style={{ height:"4px", background: checked||isEditing ? cc.top : "#E8EDF5", transition:"background 0.18s" }} />

                    <div style={{ padding:"10px 10px 8px" }}>
                      {/* Time badge + checkbox */}
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"6px" }}>
                        <span style={{ fontSize:"10px",fontWeight:"800",color:checked||isEditing?cc.text:"#94A3B8",letterSpacing:"0.2px",background:checked||isEditing?cc.bg:"#F1F5F9",padding:"2px 6px",borderRadius:"4px" }}>
                          {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                        </span>
                        <div onClick={e=>{e.stopPropagation();onToggle(i);}}
                          style={{ width:"16px",height:"16px",borderRadius:"5px",border:`1.5px solid ${checked?cc.top:"#D1D5DB"}`,background:checked?cc.top:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
                          {checked && <Check size={9} color="#fff" strokeWidth={3.5} />}
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{ fontSize:"13px",fontWeight:"800",color:"#0F172A",lineHeight:1.25,marginBottom:"8px" }}>{s.title}</div>

                      {/* Role rows */}
                      <div style={{ display:"flex",flexDirection:"column",gap:"4px",marginBottom:"8px" }}>
                        {(s.roles||[]).map((r,j)=>{
                          const assignedCount = (r.assigned_staff||[]).length;
                          const need = r.headcount||1;
                          const ok = assignedCount >= need;
                          return (
                            <div key={j} style={{ background:ok?"#F0FDF4":"#FFF7ED",borderRadius:"6px",padding:"4px 7px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"4px" }}>
                              <div style={{ display:"flex",alignItems:"center",gap:"5px",minWidth:0 }}>
                                <span style={{ width:"5px",height:"5px",borderRadius:"50%",background:cc.top,flexShrink:0 }}/>
                                <span style={{ fontSize:"11px",fontWeight:"700",color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.role_name||"Role"}</span>
                              </div>
                              <span style={{ fontSize:"10px",fontWeight:"700",color:ok?"#059669":"#D97706",whiteSpace:"nowrap",flexShrink:0 }}>
                                {assignedCount}/{need}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      {/* Staff name pills */}
                      {allStaff.length > 0 && (() => {
                        const rKey = `${s.date}|${s.start_time?.slice(0,5)}|${s.end_time?.slice(0,5)}`;
                        const rMap = allRosterData[rKey] || {};
                        return (
                          <div style={{ display:"flex",flexWrap:"wrap",gap:"3px",marginBottom:"8px" }}>
                            {allStaff.slice(0,4).map((name,k) => {
                              const ri        = rMap[name];
                              const firstName = name.split(" ")[0];
                              const isPartial = ri?.staff_type === "casual" && ri.casual_available_today === false && (ri.casual_avail_from || ri.casual_avail_to);
                              const isNoAvail = ri?.staff_type === "casual" && ri.casual_available_today === false && !ri.casual_avail_from;
                              if (isPartial) {
                                const from = ri.casual_avail_from?.slice(0,5);
                                const to   = ri.casual_avail_to?.slice(0,5);
                                return (
                                  <WarnPill key={k}
                                    firstName={firstName}
                                    winLabel={` ${from}–${to}`}
                                    pillBg="#FFF7ED" pillColor="#B45309" pillBorder="#FDE68A"
                                    tip={`${name} is only available ${from}–${to}, which doesn't fully cover this shift (${s.start_time?.slice(0,5)}–${s.end_time?.slice(0,5)}). Consider adjusting their role or reassigning.`}
                                  />
                                );
                              }
                              if (isNoAvail) {
                                return (
                                  <WarnPill key={k}
                                    firstName={firstName}
                                    winLabel=""
                                    pillBg="#FEF2F2" pillColor="#DC2626" pillBorder="#FECACA"
                                    tip={`${name} has no availability submitted for this day. They may not be able to work this shift.`}
                                  />
                                );
                              }
                              return (
                                <span key={k} style={{ fontSize:"10px",fontWeight:"600",color:cc.text,background:cc.bg,border:`1px solid ${cc.border}`,padding:"2px 7px",borderRadius:"100px",whiteSpace:"nowrap",maxWidth:"70px",overflow:"hidden",textOverflow:"ellipsis" }}>
                                  {firstName}
                                </span>
                              );
                            })}
                            {allStaff.length>4 && (
                              <span style={{ fontSize:"10px",fontWeight:"600",color:"#64748B",background:"#F1F5F9",border:"1px solid #E2E8F0",padding:"2px 7px",borderRadius:"100px" }}>+{allStaff.length-4}</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Coverage summary */}
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"7px" }}>
                        <span style={{ fontSize:"10px",color:fullyStaffed?"#059669":totalSlots>0?"#D97706":"#94A3B8",fontWeight:"600" }}>
                          {totalSlots===0?"No roles":fullyStaffed?`Fully staffed (${filled})`:filled===0?"Unassigned":`${filled}/${totalSlots} assigned`}
                        </span>
                        {totalSlots > 0 && (
                          <div style={{ display:"flex",gap:"2px" }}>
                            {Array.from({length:totalSlots}).map((_,k)=>(
                              <div key={k} style={{ width:"6px",height:"6px",borderRadius:"2px",background:k<filled?cc.top:"#E2E8F0" }}/>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Edit button */}
                      <button onClick={e=>{e.stopPropagation(); startEdit(i);}}
                        style={{ width:"100%",padding:"5px 0",borderRadius:"7px",border:`1px solid ${isEditing?cc.top:cc.border}`,background:isEditing?cc.top:cc.bg,color:isEditing?"#fff":cc.text,fontSize:"10px",fontWeight:"700",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:"4px" }}>
                        ✎ Edit
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Stats + AI Review ── */}
      <ScheduleStatsPanel schedule={schedule} accepted={accepted} />
      <AIReviewPanel schedule={schedule} accepted={accepted} />

      {/* ── Edit popup modal ── */}
      {editingIdx !== null && draft && (() => {
        const cc  = COL_COLORS[cols.indexOf(schedule[editingIdx]?.date) % COL_COLORS.length];
        const cc2 = COL_COLORS[(cols.indexOf(schedule[editingIdx]?.date) + 1) % COL_COLORS.length];
        return (
          <div
            style={{ position:"fixed",inset:0,zIndex:999999,background:"rgba(2,6,23,0.65)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
            onClick={cancelEdit}>
            <div
              style={{ background:"#fff",borderRadius:"20px",width:"min(96vw,540px)",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",overflow:"hidden",animation:"modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background:`linear-gradient(135deg,${cc.top}18,${cc.top}08)`,borderBottom:`1.5px solid ${cc.border}`,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                  <div style={{ width:"4px",height:"36px",borderRadius:"2px",background:cc.top,flexShrink:0 }} />
                  <div>
                    <p style={{ fontSize:"15px",fontWeight:"800",color:"#0F172A",lineHeight:1,marginBottom:"4px" }}>{draft.title || "Shift"}</p>
                    <p style={{ fontSize:"12px",color:"#64748B",fontWeight:"500" }}>
                      {schedule[editingIdx]?.date} &nbsp;·&nbsp; {draft.start_time?.slice(0,5)}–{draft.end_time?.slice(0,5)}
                    </p>
                  </div>
                </div>
                <button onClick={cancelEdit} style={{ width:"34px",height:"34px",borderRadius:"10px",border:"1.5px solid #E2E8F0",background:"#fff",color:"#64748B",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s" }}>
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div style={{ flex:1,overflowY:"auto",padding:"22px" }}>

                {/* Basic fields */}
                <p style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>Shift details</p>
                <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"12px",marginBottom:"22px" }}>
                  {[
                    { label:"Title",      field:"title",      type:"text", val:draft.title },
                    { label:"Start time", field:"start_time", type:"time", val:draft.start_time },
                    { label:"End time",   field:"end_time",   type:"time", val:draft.end_time },
                  ].map(f => (
                    <div key={f.field}>
                      <p style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"6px" }}>{f.label}</p>
                      <input type={f.type} value={f.val} onChange={e => setDraftField(f.field, e.target.value)} style={F} />
                    </div>
                  ))}
                </div>

                <div style={{ height:"1px",background:"#F1F5F9",marginBottom:"20px" }} />

                {/* Roles */}
                <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px" }}>
                  <p style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px" }}>Roles & Assigned Staff</p>
                  <button onClick={addRole}
                    style={{ padding:"4px 12px",borderRadius:"7px",border:`1.5px dashed ${cc.border}`,background:cc.bg,color:cc.text,fontSize:"11px",fontWeight:"700",cursor:"pointer" }}>
                    + Add Role
                  </button>
                </div>

                <div style={{ display:"flex",flexDirection:"column",gap:"12px" }}>
                  {draft.roles.map((r, j) => (
                    <div key={j} style={{ border:`1.5px solid ${cc.border}`,borderRadius:"14px",overflow:"hidden" }}>
                      {/* Role header row */}
                      <div style={{ background:cc.bg,padding:"10px 14px",display:"flex",alignItems:"center",gap:"8px" }}>
                        <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:cc.top,flexShrink:0 }} />
                        <input
                          value={r.role_name}
                          placeholder="Role name"
                          onChange={e => setRoleField(j, "role_name", e.target.value)}
                          style={{ flex:1,border:"none",background:"transparent",fontSize:"13px",fontWeight:"700",color:cc.text,outline:"none",fontFamily:"inherit" }} />
                        <div style={{ display:"flex",alignItems:"center",gap:"6px",flexShrink:0 }}>
                          <span style={{ fontSize:"11px",color:"#94A3B8" }}>×</span>
                          <input
                            type="number" min="1" value={r.headcount}
                            onChange={e => setRoleField(j, "headcount", Number(e.target.value))}
                            style={{ width:"46px",padding:"4px 6px",borderRadius:"7px",border:`1.5px solid ${cc.border}`,fontSize:"13px",fontWeight:"700",textAlign:"center",outline:"none",background:"#fff",color:"#1E293B",fontFamily:"inherit" }} />
                        </div>
                        <button onClick={() => removeRole(j)}
                          style={{ width:"28px",height:"28px",borderRadius:"8px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                          <X size={12} />
                        </button>
                      </div>

                      {/* Staff picker — roster style */}
                      <StaffRosterPicker
                        branchStaff={branchStaff}
                        rosterData={rosterData}
                        rosterLoading={rosterLoading}
                        assigned={r.assigned_staff || []}
                        headcount={r.headcount || 1}
                        accent={cc}
                        onChange={staff => setRoleField(j, "assigned_staff", staff)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"14px 22px",borderTop:"1.5px solid #F1F5F9",display:"flex",justifyContent:"flex-end",gap:"10px",background:"#FAFBFE",flexShrink:0 }}>
                <button onClick={cancelEdit}
                  style={{ padding:"9px 20px",borderRadius:"10px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={() => saveEdit(editingIdx)}
                  style={{ padding:"9px 24px",borderRadius:"10px",border:"none",background:`linear-gradient(135deg,${cc.top},${cc2.top})`,color:"#fff",fontSize:"13px",fontWeight:"700",cursor:"pointer",boxShadow:`0 4px 14px ${cc.top}50`,display:"flex",alignItems:"center",gap:"7px" }}>
                  <Check size={14} strokeWidth={3} /> Save changes
                </button>
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

// ── Schedule Stats Panel ───────────────────────────────────────────────────────
function ScheduleStatsPanel({ schedule, accepted }) {
  const staffMap = {};
  let totalSlots = 0, filledSlots = 0, understaffedRoles = 0;

  schedule.forEach((shift, i) => {
    if (!accepted.has(i)) return;
    const [sh, sm] = (shift.start_time || "00:00").slice(0, 5).split(":").map(Number);
    const [eh, em] = (shift.end_time   || "00:00").slice(0, 5).split(":").map(Number);
    const hours = Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
    (shift.roles || []).forEach(role => {
      const need = role.headcount || 1;
      totalSlots += need;
      const assigned = (role.assigned_staff || []).length;
      filledSlots += Math.min(assigned, need);
      if (assigned < need) understaffedRoles++;
      (role.assigned_staff || []).forEach(name => {
        if (!staffMap[name]) staffMap[name] = { shifts: 0, hours: 0 };
        staffMap[name].shifts++;
        staffMap[name].hours += hours;
      });
    });
  });

  const staffList = Object.entries(staffMap)
    .map(([name, s]) => ({ name, shifts: s.shifts, hours: Math.round(s.hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours);

  const maxH = staffList.length > 0 ? staffList[0].hours : 1;
  const minH = staffList.length > 0 ? staffList[staffList.length - 1].hours : 0;
  const avgH = staffList.length > 0 ? staffList.reduce((a, s) => a + s.hours, 0) / staffList.length : 0;
  const spread = maxH - minH;
  const balanceColor = spread <= 2 ? "#059669" : spread <= 5 ? "#D97706" : "#DC2626";
  const balanceLabel = spread <= 2 ? "Balanced" : spread <= 5 ? "Slight imbalance" : "Imbalanced";
  const coverPct = totalSlots > 0 ? Math.round((filledSlots / totalSlots) * 100) : 0;

  return (
    <div style={{ marginTop:"20px",borderRadius:"14px",border:"1.5px solid #E8EDF5",background:"#fff",overflow:"hidden" }}>
      {/* Header */}
      <div style={{ padding:"12px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#FAFBFE" }}>
        <span style={{ fontSize:"13px",fontWeight:"800",color:"#1E293B" }}>Staff Workload</span>
        <div style={{ display:"flex",gap:"16px",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"5px" }}>
            <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:coverPct===100?"#059669":coverPct>50?"#D97706":"#DC2626" }}/>
            <span style={{ fontSize:"12px",fontWeight:"600",color:"#475569" }}>Coverage: <strong style={{ color:coverPct===100?"#059669":"#D97706" }}>{filledSlots}/{totalSlots}</strong></span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"5px" }}>
            <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:balanceColor }}/>
            <span style={{ fontSize:"12px",fontWeight:"600",color:"#475569" }}>Workload: <strong style={{ color:balanceColor }}>{balanceLabel}</strong></span>
          </div>
          {understaffedRoles > 0 && (
            <span style={{ fontSize:"11px",fontWeight:"700",color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",padding:"2px 9px",borderRadius:"100px" }}>
              {understaffedRoles} understaffed role{understaffedRoles!==1?"s":""}
            </span>
          )}
        </div>
      </div>

      {staffList.length === 0 ? (
        <div style={{ padding:"24px",textAlign:"center",color:"#94A3B8",fontSize:"13px" }}>
          No staff assigned yet — click <strong style={{ color:"#6366F1" }}>Edit</strong> on any shift card to assign staff.
        </div>
      ) : (
        <div style={{ padding:"12px 20px" }}>
          {/* Column headers */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 1fr 60px",gap:"12px",alignItems:"center",padding:"4px 0 8px",borderBottom:"1px solid #F1F5F9",marginBottom:"4px" }}>
            {["Staff Member","Shifts","Hours","Workload","Avg"].map(h=>(
              <span key={h} style={{ fontSize:"10px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>{h}</span>
            ))}
          </div>
          {staffList.map(({ name, shifts, hours }) => {
            const barPct = maxH > 0 ? (hours / maxH) * 100 : 0;
            const overloaded = hours > avgH * 1.3;
            const underloaded = hours < avgH * 0.7 && staffList.length > 1;
            const barColor = overloaded ? "#F59E0B" : underloaded ? "#94A3B8" : "#6366F1";
            return (
              <div key={name} style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 1fr 60px",gap:"12px",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"13px",fontWeight:"600",color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{name}</span>
                <span style={{ fontSize:"12px",color:"#64748B" }}>{shifts} shift{shifts!==1?"s":""}</span>
                <div style={{ display:"flex",alignItems:"center",gap:"4px" }}>
                  <span style={{ fontSize:"13px",fontWeight:"700",color:"#1E293B" }}>{hours}h</span>
                  {overloaded && <span style={{ fontSize:"9px",fontWeight:"700",color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",padding:"1px 5px",borderRadius:"100px" }}>High</span>}
                  {underloaded && <span style={{ fontSize:"9px",fontWeight:"700",color:"#475569",background:"#F1F5F9",border:"1px solid #E2E8F0",padding:"1px 5px",borderRadius:"100px" }}>Low</span>}
                </div>
                <div style={{ height:"7px",borderRadius:"4px",background:"#F1F5F9",overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${barPct}%`,borderRadius:"4px",background:barColor,transition:"width 0.4s" }}/>
                </div>
                <span style={{ fontSize:"11px",color:overloaded?"#D97706":underloaded?"#94A3B8":"#64748B",fontWeight:"600",textAlign:"right" }}>
                  {avgH > 0 ? `${hours > avgH ? "+" : ""}${(hours - avgH).toFixed(1)}h` : "—"}
                </span>
              </div>
            );
          })}
          <div style={{ marginTop:"10px",display:"flex",gap:"16px" }}>
            <span style={{ fontSize:"11px",color:"#94A3B8" }}>Avg per staff: <strong style={{ color:"#1E293B" }}>{avgH.toFixed(1)}h</strong></span>
            <span style={{ fontSize:"11px",color:"#94A3B8" }}>Hour spread: <strong style={{ color:balanceColor }}>{spread.toFixed(1)}h</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Review Panel ─────────────────────────────────────────────────────────────
function AIReviewPanel({ schedule, accepted }) {
  const [state, setState]   = useState("idle");
  const [review, setReview] = useState(null);

  const SEV = {
    warning: { bg:"#FFFBEB",border:"#FDE68A",text:"#92400E",icon:"⚠" },
    info:    { bg:"#EFF6FF",border:"#BFDBFE",text:"#1E40AF",icon:"ℹ" },
    success: { bg:"#ECFDF5",border:"#A7F3D0",text:"#065F46",icon:"✓" },
  };

  async function getReview() {
    const acceptedSchedule = schedule.filter((_, i) => accepted.has(i));
    if (acceptedSchedule.length === 0) return;
    setState("loading");
    try {
      const result = await api.post("/api/shifts/review-schedule", { schedule: acceptedSchedule });
      setReview(result.review);
      setState("done");
    } catch {
      setState("error");
    }
  }

  const scoreColor = review ? (review.score >= 80 ? "#059669" : review.score >= 60 ? "#D97706" : "#DC2626") : "#6366F1";
  const scoreBg    = review ? (review.score >= 80 ? "#ECFDF5" : review.score >= 60 ? "#FFFBEB" : "#FEF2F2") : "#EEF2FF";
  const scoreBorder= review ? (review.score >= 80 ? "#A7F3D0" : review.score >= 60 ? "#FDE68A" : "#FECACA") : "#C7D2FE";

  return (
    <div style={{ marginTop:"12px",borderRadius:"14px",border:"1.5px solid #E8EDF5",background:"#fff",overflow:"hidden" }}>
      <div style={{ padding:"12px 20px",borderBottom:"1px solid #F1F5F9",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#FAFBFE" }}>
        <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
          <Sparkles size={14} color="#6366F1" />
          <span style={{ fontSize:"13px",fontWeight:"800",color:"#1E293B" }}>AI Review</span>
          {state==="done" && review && (
            <span style={{ fontSize:"11px",fontWeight:"700",color:scoreColor,background:scoreBg,border:`1px solid ${scoreBorder}`,padding:"2px 9px",borderRadius:"100px" }}>
              Score: {review.score}/100
            </span>
          )}
        </div>
        {state !== "loading" && (
          <button onClick={getReview}
            style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"12px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",boxShadow:"0 2px 8px rgba(99,102,241,0.3)" }}>
            <Sparkles size={11}/>{state==="done"?"Re-review":"Get AI Review"}
          </button>
        )}
      </div>

      <div style={{ padding:"16px 20px" }}>
        {state === "idle" && (
          <p style={{ fontSize:"13px",color:"#94A3B8",textAlign:"center",padding:"12px 0" }}>
            Get an AI analysis of your schedule — coverage gaps, workload balance, and improvement tips.
          </p>
        )}
        {state === "loading" && (
          <div style={{ display:"flex",alignItems:"center",gap:"10px",padding:"12px 0" }}>
            <div style={{ width:"16px",height:"16px",borderRadius:"50%",border:"2px solid #EEF2FF",borderTopColor:"#6366F1",animation:"aiSpin 0.7s linear infinite",flexShrink:0 }}/>
            <span style={{ fontSize:"13px",color:"#6366F1",fontWeight:"600" }}>Analysing your schedule…</span>
          </div>
        )}
        {state === "done" && review && (
          <div>
            <div style={{ display:"flex",alignItems:"flex-start",gap:"14px",marginBottom:"14px" }}>
              <div style={{ width:"54px",height:"54px",borderRadius:"50%",background:scoreBg,border:`2px solid ${scoreBorder}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <span style={{ fontSize:"20px",fontWeight:"900",color:scoreColor }}>{review.score}</span>
              </div>
              <p style={{ fontSize:"13px",color:"#475569",lineHeight:1.6,paddingTop:"4px" }}>{review.summary}</p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {(review.flags || []).map((flag, i) => {
                const s = SEV[flag.severity] || SEV.info;
                return (
                  <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:"8px",padding:"9px 12px",borderRadius:"9px",background:s.bg,border:`1px solid ${s.border}` }}>
                    <span style={{ fontSize:"13px",flexShrink:0,lineHeight:1.4 }}>{s.icon}</span>
                    <span style={{ fontSize:"12px",color:s.text,fontWeight:"500",lineHeight:1.5 }}>{flag.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {state === "error" && (
          <div style={{ textAlign:"center",padding:"12px 0",color:"#DC2626",fontSize:"13px" }}>
            Failed to get review.{" "}
            <button onClick={getReview} style={{ color:"#6366F1",background:"none",border:"none",cursor:"pointer",fontWeight:"700",fontSize:"13px" }}>Try again</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SkillSelect({ value, options, onChange, placeholder = "Select a skill…" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);
  return (
    <div ref={ref} style={{ position:"relative", width:"100%" }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding:"9px 32px 9px 12px",borderRadius:"8px",border:`1.5px solid ${open?"#6366F1":"#E2E8F0"}`,fontSize:"13px",color:value?"#1E293B":"#94A3B8",background:"#F8FAFC",cursor:"pointer",userSelect:"none",position:"relative",transition:"border-color 0.15s" }}>
        {value || placeholder}
        <svg style={{ position:"absolute",right:"10px",top:"50%",transform:`translateY(-50%) rotate(${open?"180deg":"0deg"})`,transition:"transform 0.15s",pointerEvents:"none" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:"10px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:9999,overflow:"hidden",maxHeight:"200px",overflowY:"auto" }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              style={{ padding:"9px 14px",fontSize:"13px",cursor:"pointer",fontWeight:opt===value?"600":"400",color:opt===value?"#4F46E5":"#1E293B",background:opt===value?"#EEF2FF":"#fff",transition:"background 0.1s" }}
              onMouseEnter={e => { if (opt!==value) e.currentTarget.style.background="#F8FAFC"; }}
              onMouseLeave={e => { if (opt!==value) e.currentTarget.style.background="#fff"; }}>
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function toHHMM(t) {
  if (!t) return "";
  const s = String(t);
  if (s.includes("T")) return s.slice(11, 16);
  return s.slice(0, 5);
}

function localDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateShort(d) {
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

