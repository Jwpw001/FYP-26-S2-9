import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Trash2, Check, X, Sparkles, Calendar, AlertTriangle, RefreshCw } from "lucide-react";

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
  const [branchInfo, setBranchInfo] = useState({ branch_id: null });
  const [operatingDays, setOperatingDays] = useState(null); // null = not loaded yet
  const [closedDateInfo, setClosedDateInfo] = useState({}); // { "YYYY-MM-DD": name } — closures + enabled public holidays
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("calendar");
  const [filterStatus, setFilter]   = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [deleting, setDeleting]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [calendarScope, setCalendarScope] = useState("week");
  const [dayOffset, setDayOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Round 3, Task 2 — template-based generation (deterministic, distinct from the AI weekly
  // scheduler below): fills the rolling horizon from branch_task_templates.
  const [templateGen, setTemplateGen] = useState({ running: false, result: null, error: "" });

  async function runTemplateGeneration() {
    setTemplateGen({ running: true, result: null, error: "" });
    try {
      const res = await api.post("/api/shifts/generate", {});
      setTemplateGen({ running: false, result: res, error: "" });
    } catch (e) {
      setTemplateGen({ running: false, result: null, error: e.message || "Generation failed." });
    }
  }

  // AI Weekly Schedule state — step: 'config' | 'generating' | 'preview' | 'creating' | 'done'
  const [weeklyAI, setWeeklyAI] = useState(null);
  const [weeklyReviewModal, setWeeklyReviewModal] = useState({ open: false, text: null, loading: false });
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

        // Fetch branch settings for operating days + closures/public holidays (Round 3, Task 3)
        api.get(`/api/business/branches/${oid}/settings`).then(r => {
          if (cancelled) return;
          if (r?.settings?.operating_days) {
            setOperatingDays(r.settings.operating_days.split("").map(Number));
          }
          const holidays = Array.isArray(r?.settings?.holidays) ? r.settings.holidays : [];
          const map = {};
          for (const h of holidays) {
            if (h?.date && h.enabled !== false) map[h.date] = h.name || "Closed";
          }
          setClosedDateInfo(map);
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
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // Re-fetch shifts whenever the AI assistant takes an action (create shift, add task, publish, etc.)
  useEffect(() => {
    if (!branchInfo?.branch_id) return;
    async function refresh() {
      const { data } = await supabase
        .from("shifts")
        .select("shift_id, title, shift_date, start_time, end_time, status, branch_id, shift_tasks ( task_id, status )")
        .eq("branch_id", branchInfo.branch_id)
        .order("shift_date", { ascending: false });
      if (data) setShifts(data);
    }
    window.addEventListener("krewby-ai-action", refresh);
    return () => window.removeEventListener("krewby-ai-action", refresh);
  }, [branchInfo]);

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
      difficultyByDay: {},
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
      const result = await api.post("/api/shifts/generate-week", {
        weekStart, weekEnd,
        preferences: { ...config, difficultyByDay: weeklyAI.difficultyByDay || {} },
      });
      setWeeklyAI(prev => ({ ...prev, step: "preview", schedule: result.schedule, accepted: new Set(result.schedule.map((_, i) => i)), missedCasuals: result.missedCasuals || [] }));
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

  async function runWeeklyReview() {
    if (!weeklyAI?.schedule || weeklyReviewModal.loading) return;
    setWeeklyReviewModal({ open: true, text: null, loading: true });
    try {
      const data = await api.post("/api/ai-assistant/weekly-review", {
        schedule: weeklyAI.schedule,
        branchStaff,
      });
      setWeeklyReviewModal({ open: true, text: data.review || "No review available.", loading: false });
    } catch {
      setWeeklyReviewModal({ open: true, text: "AI review unavailable. Please try again.", loading: false });
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

  function buildDayDate(offset) {
    const d = new Date(); d.setDate(d.getDate() + offset); return d;
  }

  function buildMonthCells(offset) {
    const base = new Date();
    const anchor = new Date(base.getFullYear(), base.getMonth() + offset, 1);
    const firstDow = (anchor.getDay() + 6) % 7;
    const gridStart = new Date(anchor); gridStart.setDate(1 - firstDow);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart); d.setDate(gridStart.getDate() + i);
      cells.push({ date: d, inMonth: d.getMonth() === anchor.getMonth() });
    }
    return { label: MONTH_NAMES[anchor.getMonth()] + " " + anchor.getFullYear(), cells };
  }

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const STATUS_COLORS = {
    draft:     { bg:"#F4F5F8", border:"#C9CDD6", dot:"#8B95A8", pillBg:"#E8EBF0", pillText:"#4B5563" },
    published: { bg:"#EFF3FF", border:"#B3C5F5", dot:"#2563EB", pillBg:"#DBE4FF", pillText:"#1D4ED8" },
    completed: { bg:"#ECFDF5", border:"#86EFAC", dot:"#22C55E", pillBg:"#D1FAE5", pillText:"#166534" },
    cancelled: { bg:"#FEF2F2", border:"#FECACA", dot:"#EF4444", pillBg:"#FFE0E0", pillText:"#991B1B" },
  };

  // Week stats
  let totalWeekShifts = 0, scheduledMinutes = 0, openSlots = 0, assignedTaskSlots = 0;
  weekDates.forEach((date, i) => {
    const dateStr = localDateStr(date);
    const dayShifts = shifts.filter(s => s.shift_date?.slice(0,10) === dateStr && s.status !== "cancelled");
    const isOff = operatingDays !== null && !operatingDays[i];
    if (!isOff && dayShifts.length === 0) openSlots++;
    dayShifts.forEach(sh => {
      totalWeekShifts++;
      const st = toHHMM(sh.start_time), et = toHHMM(sh.end_time);
      if (st && et) {
        const [sh2, sm2] = st.split(":").map(Number);
        const [eh2, em2] = et.split(":").map(Number);
        scheduledMinutes += Math.max(0, (eh2*60+em2) - (sh2*60+sm2));
      }
      assignedTaskSlots += (sh.shift_tasks||[]).filter(t => t.status === "assigned" || t.status === "done").length;
    });
  });
  const weekStats = [
    { label:"Total shifts",     value: String(totalWeekShifts) },
    { label:"Scheduled hours",  value: (Math.round(scheduledMinutes/6)/10)+"h" },
    { label:"Open slots",       value: String(openSlots) },
    { label:"Staff assigned",   value: String(assignedTaskSlots) },
  ];

  // Period navigation
  let periodLabel, onPrevPeriod, onNextPeriod, generateLabel;
  if (view === "list" || calendarScope === "week") {
    const ws = weekDates[0], we = weekDates[6];
    periodLabel = MONTH_NAMES[ws.getMonth()]+" "+ws.getDate()+" – "+(we.getMonth()!==ws.getMonth()?MONTH_NAMES[we.getMonth()]+" ":"")+we.getDate();
    onPrevPeriod = () => setWeekOffset(p => p-1);
    onNextPeriod = () => setWeekOffset(p => p+1);
    generateLabel = "Generate Week";
  } else if (calendarScope === "day") {
    const dd = buildDayDate(dayOffset);
    periodLabel = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dd.getDay()]+", "+MONTH_NAMES[dd.getMonth()]+" "+dd.getDate();
    onPrevPeriod = () => setDayOffset(p => p-1);
    onNextPeriod = () => setDayOffset(p => p+1);
    generateLabel = "Generate Day";
  } else {
    const mi = buildMonthCells(monthOffset);
    periodLabel = mi.label;
    onPrevPeriod = () => setMonthOffset(p => p-1);
    onNextPeriod = () => setMonthOffset(p => p+1);
    generateLabel = "Generate Month";
  }

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

        {/* ── Header ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"16px" }}>
          <div>
            <div style={{ fontSize:"28px", fontWeight:"800", letterSpacing:"-0.01em", color:"#1E293B" }}>Shifts</div>
            <div style={{ display:"flex", gap:"10px", marginTop:"12px", flexWrap:"wrap" }}>
              {weekStats.map(s => (
                <div key={s.label} style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"10px", padding:"9px 14px", minWidth:"96px" }}>
                  <div style={{ fontSize:"23px", fontWeight:"800", lineHeight:"1.1", color:"#1E293B" }}>{s.value}</div>
                  <div style={{ fontSize:"18px", color:"#64748B", fontWeight:"600", marginTop:"2px" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => goTo("/manager/shifts/new")}
            style={{ background:"#2563EB", color:"#fff", border:"none", borderRadius:"10px", padding:"11px 18px", fontSize:"21px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"7px", boxShadow:"0 4px 14px rgba(37,99,235,0.25)", flexShrink:0 }}>
            <span style={{ fontSize:"21px", lineHeight:"1" }}>+</span> Create Shift
          </button>
        </div>

        {/* ── Controls ── */}
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px", flexWrap:"wrap" }}>
          {/* Calendar/List toggle */}
          <div style={{ display:"flex", background:"#EFF1F4", borderRadius:"9px", padding:"3px", gap:"2px" }}>
            {[{v:"calendar",l:"Calendar"},{v:"list",l:"List"}].map(({v,l}) => (
              <button key={v} onClick={() => { setView(v); setSelectMode(false); setSelected(new Set()); }}
                style={{ padding:"6px 14px", borderRadius:"7px", fontSize:"19.5px", fontWeight:"700", border:"none", cursor:"pointer", transition:"all 0.15s",
                  background: view === v ? "#fff" : "transparent",
                  color: view === v ? "#1E293B" : "#64748B",
                  boxShadow: view === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                {l}
              </button>
            ))}
          </div>
          {/* Scope buttons (calendar only) */}
          {view === "calendar" && (
            <div style={{ display:"flex", background:"#EFF1F4", borderRadius:"9px", padding:"3px", gap:"2px" }}>
              {[{v:"day",l:"Day"},{v:"week",l:"Week"},{v:"month",l:"Month"}].map(({v,l}) => (
                <button key={v} onClick={() => setCalendarScope(v)}
                  style={{ padding:"6px 14px", borderRadius:"7px", fontSize:"19.5px", fontWeight:"700", border:"none", cursor:"pointer", transition:"all 0.15s",
                    background: calendarScope === v ? "#fff" : "transparent",
                    color: calendarScope === v ? "#1E293B" : "#64748B",
                    boxShadow: calendarScope === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {l}
                </button>
              ))}
            </div>
          )}
          {/* Divider */}
          <div style={{ width:"1px", height:"22px", background:"#E2E8F0", margin:"0 2px" }} />
          {/* Status filters */}
          {STATUS_CHIPS.map(chip => (
            <button key={chip.value} onClick={() => setFilter(chip.value)}
              style={{ padding:"7px 13px", borderRadius:"20px", fontSize:"19.5px", fontWeight:"700", cursor:"pointer", border:"1px solid", transition:"filter 0.15s",
                background: filterStatus === chip.value ? "#2563EB" : "#fff",
                color: filterStatus === chip.value ? "#fff" : "#4B5563",
                borderColor: filterStatus === chip.value ? "#2563EB" : "#E2E8F0" }}>
              {chip.label}
            </button>
          ))}
          {/* Select button */}
          <button onClick={() => { setSelectMode(p => !p); setSelected(new Set()); }}
            style={{ marginLeft:"auto", padding:"8px 14px", borderRadius:"9px", fontSize:"19.5px", fontWeight:"700", cursor:"pointer", border:"1px solid", transition:"all 0.15s",
              background: selectMode ? "#2563EB" : "#fff",
              color: selectMode ? "#fff" : "#4B5563",
              borderColor: selectMode ? "#2563EB" : "#E2E8F0" }}>
            {selectMode ? "Cancel" : "Select"}
          </button>
        </div>

        {/* ── Select mode bulk bar ── */}
        {selectMode && (
          <div style={{ marginBottom:"12px", background:"#EEF2FF", border:"1px solid #C7D2FE", borderRadius:"10px", padding:"10px 16px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ fontSize:"20px", fontWeight:"700", color:"#4338CA" }}>{selected.size} selected</div>
            {(() => {
              const hasDraft = [...selected].some(id => shifts.find(s => s.shift_id === id)?.status === "draft");
              return (
            <div style={{ display:"flex", gap:"8px", opacity: selected.size > 0 ? 1 : 0.4, pointerEvents: selected.size > 0 ? "auto" : "none" }}>
              <button onClick={publishSelected} disabled={publishing || !hasDraft}
                style={{ padding:"6px 12px", borderRadius:"7px", fontSize:"14.5px", fontWeight:"700", background:"#fff", border:"1px solid #C7D2FE", cursor: hasDraft ? "pointer" : "default", opacity: hasDraft ? 1 : 0.4 }}>
                {publishing ? "Publishing…" : "Publish"}
              </button>
              <button onClick={deleteSelected} disabled={deleting}
                style={{ padding:"6px 12px", borderRadius:"7px", fontSize:"19.5px", fontWeight:"700", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", cursor:"pointer" }}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
              );
            })()}
          </div>
        )}

        {/* ── Period navigation ── */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <button onClick={onPrevPeriod}
            style={{ width:"34px", height:"34px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"21px", color:"#64748B", transition:"background 0.15s" }}>
            ←
          </button>
          <div style={{ fontSize:"22px", fontWeight:"700", color:"#1E293B" }}>{periodLabel}</div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <button onClick={runTemplateGeneration} disabled={templateGen.running}
              title="Fill the rolling horizon from this branch's task templates"
              style={{ background:"#fff", color:"#334155", padding:"8px 14px", borderRadius:"9px", fontSize:"20px", fontWeight:"700", border:"1.5px solid #E2E8F0", cursor: templateGen.running ? "default" : "pointer", display:"flex", alignItems:"center", gap:"6px" }}>
              <RefreshCw size={13} /> {templateGen.running ? "Generating…" : "Generate from Templates"}
            </button>
            {(view === "list" || calendarScope === "week") && (
              <button onClick={() => openGenerateConfig(weekDates)}
                style={{ background:"linear-gradient(135deg,#8B5CF6,#6D28D9)", color:"#fff", padding:"8px 14px", borderRadius:"9px", fontSize:"20px", fontWeight:"700", border:"none", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px", transition:"filter 0.15s" }}>
                <Sparkles size={13} /> Generate Week
              </button>
            )}
            <button onClick={onNextPeriod}
              style={{ width:"34px", height:"34px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"21px", color:"#64748B", transition:"background 0.15s" }}>
              →
            </button>
          </div>
        </div>

        {(templateGen.result || templateGen.error) && (
          <div style={{ background: templateGen.error ? "#FEF2F2" : "#F0FDF4", border:`1px solid ${templateGen.error ? "#FECACA" : "#BBF7D0"}`, borderRadius:"10px", padding:"10px 14px", marginBottom:"14px", fontSize:"19px", color: templateGen.error ? "#991B1B" : "#166534", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px" }}>
            <span>
              {templateGen.error
                ? templateGen.error
                : `Generated ${templateGen.result.created_count} shift${templateGen.result.created_count === 1 ? "" : "s"}. ${templateGen.result.skipped.length} day${templateGen.result.skipped.length === 1 ? "" : "s"} skipped (already covered, closed, or no templates set).`}
            </span>
            <button onClick={() => setTemplateGen({ running:false, result:null, error:"" })} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", display:"flex" }}><X size={14} /></button>
          </div>
        )}

        {/* ── Main content ── */}
        {loading ? (
          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"32px" }}>
            {Array.from({length:5}).map((_,i) => (
              <div key={i} style={{ display:"flex", gap:"12px", marginBottom:"16px", alignItems:"center" }}>
                <Shimmer w="32px" h="32px" r="50%" />
                <div style={{ flex:1 }}>
                  <Shimmer w="60%" h="13px" r="6px" style={{ marginBottom:"6px" }} />
                  <Shimmer w="40%" h="11px" r="6px" />
                </div>
                <Shimmer w="70px" h="22px" r="100px" />
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          /* ── List view ── */
          <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"6px" }}>
            {weekDates.map((date, di) => {
              const dayShifts = getShiftsForDate(date).filter(s => filterStatus === "all" || s.status === filterStatus);
              if (dayShifts.length === 0) return null;
              return (
                <div key={di}>
                  <div style={{ padding:"12px 16px 4px", fontSize:"19px", fontWeight:"800", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                    {DAYS[di]} {date.getDate()}
                  </div>
                  {dayShifts.map(shift => {
                    const c = STATUS_COLORS[shift.status] || STATUS_COLORS.draft;
                    const isSelected = selected.has(shift.shift_id);
                    return (
                      <div key={shift.shift_id}
                        onClick={() => selectMode ? toggleSelect(shift.shift_id) : goTo(`/manager/shifts/${shift.shift_id}`)}
                        style={{ display:"flex", alignItems:"center", gap:"12px", padding:"11px 16px", borderRadius:"10px", cursor:"pointer", transition:"background 0.15s", background: isSelected ? "#EEF2FF" : "transparent" }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background="#F8FAFC"; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background="transparent"; }}>
                        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:c.dot, flexShrink:0 }} />
                        {selectMode && (
                          <div style={{ width:"16px", height:"16px", borderRadius:"4px", border:`1.5px solid ${isSelected?"#2563EB":"#D1D5DB"}`, background:isSelected?"#2563EB":"transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            {isSelected && <Check size={10} color="#fff" strokeWidth={3} />}
                          </div>
                        )}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:"20px", fontWeight:"700", color:"#1E293B" }}>{shift.title || "Shift"}</div>
                          <div style={{ fontSize:"18.5px", color:"#64748B" }}>{(shift.shift_tasks||[]).length} task{(shift.shift_tasks||[]).length!==1?"s":""}</div>
                        </div>
                        <div style={{ fontSize:"19.5px", fontWeight:"600", color:"#4B5563" }}>{toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</div>
                        <div style={{ fontSize:"17px", fontWeight:"800", textTransform:"uppercase", letterSpacing:"0.04em", color:c.pillText, background:c.pillBg, padding:"3px 8px", borderRadius:"6px" }}>
                          {shift.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {weekDates.every(date => getShiftsForDate(date).filter(s => filterStatus==="all"||s.status===filterStatus).length===0) && (
              <div style={{ padding:"48px 16px", textAlign:"center", color:"#94A3B8", fontSize:"20px" }}>No shifts scheduled this week.</div>
            )}
          </div>
        ) : calendarScope === "week" ? (
          /* ── Week calendar view ── */
          <div className="responsive-hscroll" style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", overflow:"hidden" }}>
            <div className="responsive-hscroll-inner" style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", "--hscroll-min-width": "720px" }}>
              {weekDates.map((date, i) => {
                const dayShifts = getShiftsForDate(date).filter(s => filterStatus==="all"||s.status===filterStatus);
                const isToday = date.toDateString() === new Date().toDateString();
                const isOff = operatingDays !== null && !operatingDays[i];
                return (
                  <div key={i} style={{ borderRight: i < 6 ? "1px solid #F0F2F5" : "none", minHeight:"420px", padding:"12px 9px",
                    background: isToday ? "color-mix(in srgb,#2563EB 7%,white)" : "transparent" }}>
                    <div onClick={() => { setCalendarScope("day"); const off = Math.round((new Date(date.getFullYear(),date.getMonth(),date.getDate()) - new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()))/86400000); setDayOffset(off); }}
                      style={{ textAlign:"center", marginBottom:"12px", cursor:"pointer" }}>
                      <div style={{ fontSize:"17.5px", fontWeight:"700", letterSpacing:"0.06em", color:"#64748B", textTransform:"uppercase" }}>{DAYS[i]}</div>
                      <div style={{ width:"28px", height:"28px", borderRadius:"50%", margin:"4px auto 0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", fontWeight:"800",
                        background: isToday ? "#2563EB" : "transparent",
                        color: isToday ? "#fff" : "#1E293B" }}>
                        {date.getDate()}
                      </div>
                      {isOff && <div style={{ fontSize:"17px", fontWeight:"700", color:"#94A3B8", letterSpacing:"0.06em", marginTop:"3px" }}>OFF</div>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                      {dayShifts.map(shift => {
                        const c = STATUS_COLORS[shift.status] || STATUS_COLORS.draft;
                        const isSelected = selected.has(shift.shift_id);
                        const initials = (shift.title||"S").slice(0,2).toUpperCase();
                        const tasks = shift.shift_tasks || [];
                        const doneTasks = tasks.filter(t => t.status==="done").length;
                        return (
                          <div key={shift.shift_id}
                            onClick={() => selectMode ? toggleSelect(shift.shift_id) : goTo(`/manager/shifts/${shift.shift_id}`)}
                            style={{ position:"relative", background:c.bg, border:`1.5px solid ${isSelected?"#2563EB":c.border}`, borderRadius:"10px", padding:"9px 10px", cursor:"pointer", transition:"box-shadow 0.15s,transform 0.15s", animation:"fadeSlideUp 0.25s ease" }}
                            onMouseEnter={e => { e.currentTarget.style.boxShadow="0 6px 14px rgba(20,20,30,0.1)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.transform="translateY(0)"; }}>
                            {selectMode && (
                              <div onClick={e => { e.stopPropagation(); toggleSelect(shift.shift_id); }}
                                style={{ position:"absolute", top:"7px", right:"7px", width:"15px", height:"15px", borderRadius:"4px", border:`1.5px solid ${isSelected?"#2563EB":"#CBD5E1"}`, background:isSelected?"#2563EB":"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                                {isSelected && <Check size={9} color="#fff" strokeWidth={3.5} />}
                              </div>
                            )}
                            <div style={{ fontSize:"16px", fontWeight:"800", letterSpacing:"0.05em", textTransform:"uppercase", color:c.pillText, background:c.pillBg, display:"inline-block", padding:"2px 6px", borderRadius:"5px", marginBottom:"6px" }}>
                              {shift.status}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                              <div style={{ width:"19px", height:"19px", borderRadius:"50%", background:c.dot, color:"#fff", fontSize:"9px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>{initials}</div>
                              <div style={{ minWidth:0 }}>
                                <div style={{ fontSize:"19px", fontWeight:"700", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"#1E293B" }}>{shift.title || "Shift"}</div>
                                <div style={{ fontSize:"17.5px", color:"#64748B", whiteSpace:"nowrap" }}>{tasks.length} task{tasks.length!==1?"s":""}</div>
                              </div>
                            </div>
                            <div style={{ fontSize:"17.5px", fontWeight:"600", color:"#4B5563", marginTop:"6px" }}>{toHHMM(shift.start_time)} – {toHHMM(shift.end_time)}</div>
                            {tasks.length > 0 && (
                              <div style={{ marginTop:"7px" }}>
                                <div style={{ fontSize:"16px", fontWeight:"700", color:"#64748B", marginBottom:"3px" }}>{doneTasks}/{tasks.length} done</div>
                                <div style={{ height:"4px", borderRadius:"2px", background:"#E2E8F0", overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${tasks.length>0?Math.round(doneTasks/tasks.length*100):0}%`, background:c.dot }} />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {!isOff && (
                        <div onClick={() => goTo(`/manager/shifts/new?date=${localDateStr(date)}`)}
                          style={{ textAlign:"center", padding:"7px", borderRadius:"8px", border:"1.5px dashed #D1D5DB", color:"#94A3B8", fontSize:"21px", cursor:"pointer", transition:"background 0.15s,border-color 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.background="#F8FAFC"; e.currentTarget.style.borderColor="#94A3B8"; }}
                          onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.borderColor="#D1D5DB"; }}>
                          +
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : calendarScope === "day" ? (() => {
          /* ── Day timeline view ── */
          const dayDate = buildDayDate(dayOffset);
          const dayDateStr = localDateStr(dayDate);
          const dayShifts = shifts.filter(s => s.shift_date?.slice(0,10) === dayDateStr && s.status !== "cancelled")
            .filter(s => filterStatus==="all"||s.status===filterStatus);
          const isToday = dayDate.toDateString() === new Date().toDateString();
          const isOff = operatingDays !== null && !operatingDays[(dayDate.getDay()+6)%7];
          const DAY_START = 6, DAY_END = 23, HOUR_W = 130;
          const toMin = t => { const [h,m] = (toHHMM(t)||"06:00").split(":").map(Number); return h*60+m; };
          const sorted = [...dayShifts].map(sh => {
            const sm = Math.max(0, toMin(sh.start_time) - DAY_START*60);
            const em = Math.min((DAY_END-DAY_START)*60, Math.max(sm+15, toMin(sh.end_time) - DAY_START*60));
            return { sh, sm, em };
          }).sort((a,b) => a.sm - b.sm);
          const laneEnds = [];
          sorted.forEach(item => {
            let lane = laneEnds.findIndex(end => end <= item.sm);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(item.em); }
            else laneEnds[lane] = item.em;
            item.lane = lane;
          });
          const laneCount = Math.max(1, laneEnds.length);
          const LANE_H = 68, LANE_GAP = 10;
          const timelineH = laneCount*(LANE_H+LANE_GAP)-LANE_GAP;
          const hours = [];
          for (let h = DAY_START; h < DAY_END; h++) {
            const disp = h%12===0?12:h%12, ap = h<12?"AM":"PM";
            hours.push(disp+" "+ap);
          }
          return (
            <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"20px" }}>
              <div style={{ textAlign:"center", marginBottom:"16px" }}>
                <div style={{ fontSize:"18px", fontWeight:"700", letterSpacing:"0.06em", color:"#64748B", textTransform:"uppercase" }}>
                  {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][dayDate.getDay()]}
                </div>
                <div style={{ width:"38px", height:"38px", borderRadius:"50%", margin:"5px auto 0", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"22px", fontWeight:"800",
                  background: isToday ? "#2563EB" : "transparent", color: isToday ? "#fff" : "#1E293B", border: isToday ? "none" : "1px solid #E2E8F0" }}>
                  {dayDate.getDate()}
                </div>
                {isOff && <div style={{ fontSize:"18px", fontWeight:"700", color:"#94A3B8", letterSpacing:"0.06em", marginTop:"5px" }}>OFF</div>}
              </div>
              <div style={{ overflowX:"auto", paddingBottom:"8px" }}>
                <div style={{ width: (DAY_END-DAY_START)*HOUR_W+"px" }}>
                  <div style={{ display:"flex", borderBottom:"1px solid #F0F2F5", paddingBottom:"6px", marginBottom:"0" }}>
                    {hours.map(hr => (
                      <div key={hr} style={{ width:HOUR_W+"px", flexShrink:0, textAlign:"center", fontSize:"18px", fontWeight:"700", color:"#94A3B8", borderRight:"1px solid #F0F2F5" }}>{hr}</div>
                    ))}
                  </div>
                  <div style={{ position:"relative", height:timelineH+"px", minHeight:"68px",
                    backgroundImage:"linear-gradient(to right,#F0F2F5 1px,transparent 1px)",
                    backgroundSize:HOUR_W+"px 100%", marginTop:"8px" }}>
                    {sorted.map(({sh, sm, em, lane}) => {
                      const c = STATUS_COLORS[sh.status] || STATUS_COLORS.draft;
                      const widthPx = Math.max(46, (em-sm)/60*HOUR_W - 4);
                      const leftPx = sm/60*HOUR_W;
                      const topPx = lane*(LANE_H+LANE_GAP);
                      const tasks = sh.shift_tasks || [];
                      const doneTasks = tasks.filter(t=>t.status==="done").length;
                      return (
                        <div key={sh.shift_id}
                          onClick={() => goTo(`/manager/shifts/${sh.shift_id}`)}
                          style={{ position:"absolute", left:leftPx+"px", top:topPx+"px", width:widthPx+"px", height:LANE_H+"px",
                            background:c.bg, border:`1.5px solid ${c.border}`, borderRadius:"9px", padding:"7px 9px",
                            cursor:"pointer", overflow:"hidden", transition:"box-shadow 0.15s", zIndex:2 }}
                          onMouseEnter={e => { e.currentTarget.style.boxShadow="0 6px 14px rgba(20,20,30,0.14)"; e.currentTarget.style.zIndex=6; }}
                          onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; e.currentTarget.style.zIndex=2; }}>
                          <div style={{ fontSize:"16px", fontWeight:"800", letterSpacing:"0.04em", textTransform:"uppercase", color:c.pillText }}>{sh.status}</div>
                          <div style={{ fontSize:"19px", fontWeight:"700", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", marginTop:"2px", color:"#1E293B" }}>{sh.title || "Shift"}</div>
                          <div style={{ fontSize:"17.5px", color:"#64748B", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{toHHMM(sh.start_time)} – {toHHMM(sh.end_time)}</div>
                          {tasks.length > 0 && (
                            <div style={{ fontSize:"17px", fontWeight:"700", color:"#64748B", marginTop:"3px" }}>{doneTasks}/{tasks.length} tasks</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              {!isOff && (
                <div onClick={() => goTo(`/manager/shifts/new?date=${dayDateStr}`)}
                  style={{ marginTop:"14px", textAlign:"center", padding:"9px", borderRadius:"9px", border:"1.5px dashed #D1D5DB", color:"#94A3B8", cursor:"pointer", fontSize:"20px", fontWeight:"600" }}>
                  + Add shift
                </div>
              )}
            </div>
          );
        })() : (() => {
          /* ── Month calendar view ── */
          const { cells } = buildMonthCells(monthOffset);
          const DOW_HEADERS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
          return (
            <div className="responsive-hscroll">
            <div className="responsive-hscroll-inner" style={{ "--hscroll-min-width": "630px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", marginBottom:"6px" }}>
                {DOW_HEADERS.map(d => (
                  <div key={d} style={{ textAlign:"center", fontSize:"18px", fontWeight:"700", letterSpacing:"0.05em", color:"#64748B", padding:"6px 0" }}>{d}</div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"5px" }}>
                {cells.map((cell, ci) => {
                  const dateStr = localDateStr(cell.date);
                  const cellShifts = shifts.filter(s => s.shift_date?.slice(0,10)===dateStr && s.status!=="cancelled")
                    .filter(s => filterStatus==="all"||s.status===filterStatus);
                  const isToday = cell.date.toDateString() === new Date().toDateString();
                  const preview = cellShifts.slice(0,2);
                  const moreCount = Math.max(0, cellShifts.length - 2);
                  // Round 3, Task 3: mark closures/public holidays and non-operating days distinctly.
                  const closedName = closedDateInfo[dateStr];
                  const dow = (cell.date.getDay() + 6) % 7; // Mon=0…Sun=6
                  const isNonOperating = Array.isArray(operatingDays) && operatingDays[dow] === 0;
                  return (
                    <div key={ci}
                      onClick={() => { const off = Math.round((new Date(cell.date.getFullYear(),cell.date.getMonth(),cell.date.getDate())-new Date(new Date().getFullYear(),new Date().getMonth(),new Date().getDate()))/86400000); setCalendarScope("day"); setDayOffset(off); }}
                      title={closedName || (isNonOperating ? "Non-operating day" : undefined)}
                      style={{ minHeight:"86px", border:`1px solid ${closedName ? "#FECACA" : "#E2E8F0"}`, borderRadius:"10px", padding:"7px", cursor:"pointer",
                        opacity: cell.inMonth ? 1 : 0.35, background: closedName ? "#FEF2F2" : isNonOperating ? "#F8FAFC" : "#fff", transition:"box-shadow 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.boxShadow="0 4px 10px rgba(0,0,0,0.08)"; }}
                      onMouseLeave={e => { e.currentTarget.style.boxShadow="none"; }}>
                      <div style={{ width:"22px", height:"22px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:"800",
                        background: isToday ? "#2563EB" : "transparent", color: isToday ? "#fff" : "#1E293B" }}>
                        {cell.date.getDate()}
                      </div>
                      {closedName && (
                        <div style={{ fontSize:"15px", fontWeight:"700", color:"#DC2626", marginTop:"3px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{closedName}</div>
                      )}
                      {preview.map((sh, pi) => {
                        const c = STATUS_COLORS[sh.status] || STATUS_COLORS.draft;
                        return (
                          <div key={pi} style={{ display:"flex", alignItems:"center", gap:"4px", marginTop:"4px" }}>
                            <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:c.dot, flexShrink:0 }} />
                            <div style={{ fontSize:"16.5px", fontWeight:"600", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", color:"#1E293B" }}>{sh.title || "Shift"}</div>
                          </div>
                        );
                      })}
                      {moreCount > 0 && (
                        <div style={{ fontSize:"15.5px", fontWeight:"700", color:"#64748B", marginTop:"2px" }}>+{moreCount} more</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            </div>
          );
        })()}
      </div>

      {/* ── Weekly AI Review Popup ─────────────────────────────────────────── */}
      {weeklyReviewModal.open && (
        <div style={{ position:"fixed",inset:0,zIndex:999999,background:"rgba(2,6,23,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
          onClick={() => setWeeklyReviewModal(s => ({ ...s, open:false }))}>
          <div style={{ background:"#fff",borderRadius:"20px",width:"min(94vw,540px)",maxHeight:"80vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.4)",overflow:"hidden",animation:"modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ background:"linear-gradient(135deg,#4F46E5,#7C3AED)",padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
              <div style={{ display:"flex",alignItems:"center",gap:"10px" }}>
                <div style={{ width:"30px",height:"30px",borderRadius:"9px",background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center" }}>
                  <Sparkles size={14} color="#fff" />
                </div>
                <div>
                  <p style={{ fontSize:"21px",fontWeight:"800",color:"#fff",margin:0,lineHeight:1 }}>AI Weekly Review</p>
                  <p style={{ fontSize:"17px",color:"rgba(255,255,255,0.65)",margin:0,marginTop:"3px" }}>Full-week schedule analysis</p>
                </div>
              </div>
              <button onClick={() => setWeeklyReviewModal(s => ({ ...s, open:false }))}
                style={{ width:"30px",height:"30px",borderRadius:"8px",border:"1px solid rgba(255,255,255,0.25)",background:"rgba(255,255,255,0.12)",color:"rgba(255,255,255,0.8)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center" }}>
                <X size={13} />
              </button>
            </div>
            {/* Body */}
            <div style={{ flex:1,overflowY:"auto",padding:"18px 20px" }}>
              {weeklyReviewModal.loading ? (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"14px",padding:"32px 0" }}>
                  <div style={{ width:"36px",height:"36px",borderRadius:"50%",border:"3px solid #E0E7FF",borderTopColor:"#6366F1",animation:"aiSpin 0.8s linear infinite" }} />
                  <p style={{ fontSize:"20px",color:"#94A3B8",margin:0 }}>Analysing your week…</p>
                </div>
              ) : (
                weeklyReviewModal.text?.split("\n").filter(l => l.trim()).map((line, i) => {
                  const isWarning = /⚠️|warning|conflict|leave|unfilled|not available|imbalanced|overload/i.test(line);
                  const isGood    = /✅|ready|fully|covered|great|all roles/i.test(line);
                  const isCrit    = /❌|critical|urgent|nobody/i.test(line);
                  const bg    = isCrit ? "#FEF2F2" : isWarning ? "#FFFBEB" : isGood ? "#F0FDF4" : "transparent";
                  const color = isCrit ? "#B91C1C" : isWarning ? "#92400E" : isGood ? "#065F46" : "#374151";
                  const icon  = isCrit ? "❌" : isWarning ? "⚠️" : isGood ? "✅" : "•";
                  return (
                    <div key={i} style={{ display:"flex",gap:"9px",marginBottom:"10px",alignItems:"flex-start",background:bg,borderRadius:"9px",padding:bg !== "transparent" ? "9px 11px" : "2px 0" }}>
                      <span style={{ fontSize:"20px",flexShrink:0,marginTop:"1px" }}>{icon}</span>
                      <p style={{ fontSize:"20px",color,fontWeight: bg !== "transparent" ? "600" : "400",lineHeight:1.55,margin:0 }}>
                        {line.replace(/^[-•·✅⚠️❌*]\s*/, "").trim()}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
            {/* Footer */}
            <div style={{ padding:"12px 20px",borderTop:"1.5px solid #F1F5F9",display:"flex",justifyContent:"flex-end",background:"#FAFBFE",flexShrink:0 }}>
              <button onClick={() => setWeeklyReviewModal(s => ({ ...s, open:false }))}
                style={{ padding:"7px 18px",borderRadius:"8px",border:"none",background:"#6366F1",color:"#fff",fontSize:"19px",fontWeight:"700",cursor:"pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
                    <div style={{ fontSize:"22px",fontWeight:"800",color:"#fff",letterSpacing:"-0.2px" }}>AI Weekly Schedule</div>
                    <div style={{ fontSize:"18px",color:"rgba(255,255,255,0.6)",fontWeight:"500",marginTop:"1px" }}>
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
                        <div style={{ fontSize:"22px",fontWeight:"800",color:"#fff",lineHeight:1 }}>{n}</div>
                        <div style={{ fontSize:"17px",color:"rgba(255,255,255,0.6)",fontWeight:"500",marginTop:"2px" }}>{label}</div>
                      </div>
                    ));
                  })()}
                  {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && (
                    <button onClick={runWeeklyReview} disabled={weeklyReviewModal.loading}
                      style={{ display:"flex",alignItems:"center",gap:"6px",padding:"7px 14px",borderRadius:"10px",border:"1px solid rgba(255,255,255,0.3)",background:"rgba(255,255,255,0.15)",backdropFilter:"blur(6px)",color:"#fff",fontSize:"19px",fontWeight:"700",cursor:"pointer",transition:"all 0.15s",flexShrink:0 }}>
                      {weeklyReviewModal.loading
                        ? <><span style={{ width:"10px",height:"10px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",display:"inline-block",animation:"aiSpin 0.7s linear infinite" }}/> Reviewing…</>
                        : <><Sparkles size={12}/> AI Review</>}
                    </button>
                  )}
                  {!["generating","creating"].includes(weeklyAI.step) && (
                    <button onClick={() => setWeeklyAI(null)} style={{ width:"32px",height:"32px",borderRadius:"8px",background:"rgba(255,255,255,0.12)",border:"1px solid rgba(255,255,255,0.2)",color:"rgba(255,255,255,0.8)",fontSize:"21px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}><X size={14} /></button>
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
                const sectionTitle = { fontSize:"21px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" };
                const sectionSub   = { fontSize:"19px",color:"#94A3B8",marginBottom:"16px" };
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
                                <div style={{ fontSize:"18px",fontWeight:"600",marginTop:"5px",color:active?"#6366F1":"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>
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
                                <span style={{ fontSize:"18px",fontWeight:"800",color:"#6366F1" }}>{i+1}</span>
                              </div>
                              <input value={name}
                                onChange={e => { const n=[...cfg.shiftNames]; n[i]=e.target.value; setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftNames:n}})); }}
                                style={{ flex:1,padding:"10px 14px",borderRadius:"9px",border:"1.5px solid #E2E8F0",fontSize:"21px",color:"#1E293B",outline:"none",fontFamily:"inherit",background:"#F8FAFC" }}
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
                              <p style={{ fontSize:"20px",color:"#94A3B8",textAlign:"center",padding:"16px 0" }}>No operating days found for this week</p>
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
                                        <div style={{ fontSize:"16px",fontWeight:"700",color:isOff?"#EF4444":"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"4px" }}>{DAY_LABELS[i]}</div>
                                        <div style={{ fontSize:"23px",fontWeight:"800",color:isOff?"#DC2626":"#1E293B",lineHeight:1 }}>{d.getDate()}</div>
                                        <div style={{ marginTop:"6px",fontSize:"20px",color:isOff?"#EF4444":"#CBD5E1" }}>{isOff?"✕":"·"}</div>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div style={{ marginTop:"12px",display:"flex",gap:"16px" }}>
                                  <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                                    <div style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#F8FAFC",border:"2px solid #E2E8F0" }}/>
                                    <span style={{ fontSize:"18px",color:"#94A3B8",fontWeight:"500" }}>Open</span>
                                  </div>
                                  <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                                    <div style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#FEF2F2",border:"2px solid #FCA5A5" }}/>
                                    <span style={{ fontSize:"18px",color:"#94A3B8",fontWeight:"500" }}>Closed</span>
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
                            <span style={{ fontSize:"18px",color:"#92400E",fontWeight:"500" }}>No skills configured. Add them in the Skills section first.</span>
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
                                  <span style={{ fontSize:"19px",fontWeight:"700",color:sc.text,textTransform:"uppercase",letterSpacing:"0.4px" }}>{shiftName || `Shift ${si+1}`}</span>
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
                                          style={{ padding:"9px 12px",borderRadius:"8px",border:"1.5px solid #E2E8F0",fontSize:"20px",color:"#1E293B",outline:"none",fontFamily:"inherit",background:"#F8FAFC" }}/>
                                      )}
                                      <div style={{ display:"flex",alignItems:"center",border:"1.5px solid #E2E8F0",borderRadius:"8px",background:"#F8FAFC",overflow:"hidden" }}>
                                        <button onClick={() => {
                                          const sr=[...(cfg.shiftRoles||[])];
                                          const updated=[...roles]; updated[j]={...updated[j],headcount:Math.max(1,r.headcount-1)};
                                          sr[si]=updated;
                                          setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                        }} style={{ width:"26px",height:"34px",border:"none",background:"none",color:sc.dot,fontSize:"21px",fontWeight:"700",cursor:"pointer",flexShrink:0 }}>−</button>
                                        <span style={{ flex:1,textAlign:"center",fontSize:"20px",fontWeight:"700",color:"#1E293B" }}>{r.headcount}</span>
                                        <button onClick={() => {
                                          const sr=[...(cfg.shiftRoles||[])];
                                          const updated=[...roles]; updated[j]={...updated[j],headcount:r.headcount+1};
                                          sr[si]=updated;
                                          setWeeklyAI(prev=>({...prev,config:{...prev.config,shiftRoles:sr}}));
                                        }} style={{ width:"26px",height:"34px",border:"none",background:"none",color:sc.dot,fontSize:"21px",fontWeight:"700",cursor:"pointer",flexShrink:0 }}>+</button>
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
                                }} style={{ padding:"6px 14px",borderRadius:"8px",border:`1.5px dashed ${sc.border}`,background:sc.bg,color:sc.text,fontSize:"18px",fontWeight:"700",cursor:"pointer",width:"100%" }}>
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

              {/* ── Difficulty step ── */}
              {weeklyAI.step === "difficulty" && (() => {
                const cfg = weeklyAI.config;
                const dbd = weeklyAI.difficultyByDay || {};
                const DIFF_LEVELS = ["any","junior","intermediate","senior","lead"];
                const DIFF_META = {
                  any:          { label:"Any",          bg:"#F1F5F9", border:"#CBD5E1", color:"#475569" },
                  junior:       { label:"Junior",       bg:"#F0FDF4", border:"#86EFAC", color:"#166534" },
                  intermediate: { label:"Intermediate", bg:"#EFF6FF", border:"#93C5FD", color:"#1D4ED8" },
                  senior:       { label:"Senior",       bg:"#FFF7ED", border:"#FCD34D", color:"#92400E" },
                  lead:         { label:"Lead",         bg:"#F5F3FF", border:"#C4B5FD", color:"#6D28D9" },
                };
                const DAY_COLORS = ["#6366F1","#8B5CF6","#EC4899","#F59E0B","#10B981","#3B82F6","#EF4444"];
                const shiftSlots = (cfg.shiftNames || []).map(name => ({ name }));

                const workingDays = Array.from({length:7}, (_,i) => {
                  const base = new Date(weeklyAI.weekStart + "T12:00:00Z");
                  base.setUTCDate(base.getUTCDate() + i);
                  const dateStr = base.toISOString().split("T")[0];
                  const d = new Date(dateStr + "T12:00:00Z");
                  return {
                    date: dateStr,
                    label: d.toLocaleDateString("en-SG",{weekday:"short",timeZone:"UTC"}),
                    day:   d.getUTCDate(),
                    month: d.toLocaleDateString("en-SG",{month:"short",timeZone:"UTC"}),
                  };
                }).filter(d => !(cfg.offDays || []).includes(d.date));

                const getDiff = (date, si, j) => dbd[date]?.[si]?.[j] || "any";

                const setDiff = (date, si, j, val) => {
                  setWeeklyAI(prev => {
                    const next = { ...(prev.difficultyByDay || {}) };
                    next[date] = { ...(next[date] || {}) };
                    next[date][si] = { ...(next[date][si] || {}), [j]: val };
                    return { ...prev, difficultyByDay: next };
                  });
                };

                return (
                  <div>
                    {/* Legend */}
                    <div style={{ display:"flex",alignItems:"center",gap:"8px",marginBottom:"20px",flexWrap:"wrap" }}>
                      <span style={{ fontSize:"18px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginRight:"4px" }}>Skill level:</span>
                      {DIFF_LEVELS.map(lvl => {
                        const m = DIFF_META[lvl];
                        return <span key={lvl} style={{ padding:"3px 10px",borderRadius:"100px",background:m.bg,border:`1.5px solid ${m.border}`,color:m.color,fontSize:"18px",fontWeight:"700" }}>{m.label}</span>;
                      })}
                      <span style={{ fontSize:"18px",color:"#94A3B8",marginLeft:"4px" }}>— click a role to cycle its required level</span>
                    </div>

                    {/* Calendar grid */}
                    <div style={{ display:"grid",gridTemplateColumns:`repeat(${workingDays.length},1fr)`,gap:"10px",alignItems:"start" }}>
                      {workingDays.map((day, di) => {
                        const color = DAY_COLORS[di % DAY_COLORS.length];
                        return (
                          <div key={day.date} style={{ display:"flex",flexDirection:"column",gap:"8px" }}>
                            <div style={{ textAlign:"center",paddingBottom:"8px",borderBottom:`2px solid ${color}33` }}>
                              <p style={{ fontSize:"17px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",margin:0 }}>{day.label}</p>
                              <p style={{ fontSize:"23px",fontWeight:"900",color:"#1E293B",margin:"2px 0 0",lineHeight:1 }}>{day.day}</p>
                              <p style={{ fontSize:"17px",color:"#94A3B8",margin:0 }}>{day.month}</p>
                            </div>

                            {shiftSlots.map((slot, si) => {
                              const roles = cfg.shiftRoles?.[si] || [];
                              return (
                                <div key={si} style={{ borderRadius:"12px",border:`1.5px solid ${color}33`,overflow:"hidden",background:"#fff",boxShadow:"0 1px 4px rgba(0,0,0,0.05)" }}>
                                  <div style={{ background:`${color}12`,borderBottom:`1px solid ${color}22`,padding:"7px 10px" }}>
                                    <p style={{ fontSize:"18px",fontWeight:"800",color,margin:0 }}>{slot.name}</p>
                                  </div>
                                  <div style={{ padding:"8px 10px",display:"flex",flexDirection:"column",gap:"6px" }}>
                                    {roles.length === 0 && <p style={{ fontSize:"18px",color:"#94A3B8",margin:0 }}>No roles</p>}
                                    {roles.map((r, j) => {
                                      const diff = getDiff(day.date, si, j);
                                      const dm = DIFF_META[diff];
                                      const nextDiff = DIFF_LEVELS[(DIFF_LEVELS.indexOf(diff)+1) % DIFF_LEVELS.length];
                                      return (
                                        <div key={j}>
                                          <p style={{ fontSize:"17px",fontWeight:"600",color:"#64748B",margin:"0 0 3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                                            {r.role_name || "Role"} ×{r.headcount}
                                          </p>
                                          <button
                                            title={`Next: ${nextDiff}`}
                                            onClick={() => setDiff(day.date, si, j, nextDiff)}
                                            style={{ width:"100%",padding:"4px 6px",borderRadius:"7px",border:`1.5px solid ${dm.border}`,background:dm.bg,color:dm.color,fontSize:"17px",fontWeight:"700",cursor:"pointer",textAlign:"center",transition:"all 0.12s" }}>
                                            {dm.label}
                                          </button>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
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
                    <p style={{ fontSize:"22px",fontWeight:"800",color:"#1E293B",marginBottom:"6px" }}>
                      {weeklyAI.step === "rescheduling" ? "Balancing workload…" : "Building your week…"}
                    </p>
                    <p style={{ fontSize:"20px",color:"#64748B",lineHeight:1.65,maxWidth:"300px" }}>
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
                  <p style={{ fontSize:"21px",fontWeight:"800",color:"#DC2626" }}>Generation failed</p>
                  <p style={{ fontSize:"20px",color:"#64748B",maxWidth:"360px",textAlign:"center",lineHeight:1.6 }}>{weeklyAI.message}</p>
                </div>
              )}

              {/* Done */}
              {weeklyAI.step === "done" && (
                <div style={{ display:"flex",flexDirection:"column",alignItems:"center",padding:"80px 20px",gap:"14px" }}>
                  <div style={{ width:"72px",height:"72px",borderRadius:"50%",background:"linear-gradient(135deg,#D1FAE5,#A7F3D0)",border:"2px solid #6EE7B7",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 8px 24px rgba(16,185,129,0.25)" }}><Check size={32} color="#059669" strokeWidth={3} /></div>
                  <p style={{ fontSize:"23px",fontWeight:"800",color:"#059669" }}>{weeklyAI.created} shift{weeklyAI.created!==1?"s":""} saved as draft!</p>
                  <p style={{ fontSize:"20px",color:"#64748B" }}>Review and publish them from the calendar view.</p>
                </div>
              )}

              {/* Missed casuals banner */}
              {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && weeklyAI.missedCasuals?.length > 0 && (
                <div style={{ margin:"0 0 16px",padding:"12px 16px",borderRadius:"12px",background:"#FFFBEB",border:"1.5px solid #FCD34D",display:"flex",alignItems:"flex-start",gap:"10px" }}>
                  <span style={{ fontSize:"21px",flexShrink:0,marginTop:"1px" }}>⚠️</span>
                  <div>
                    <p style={{ fontSize:"20px",fontWeight:"700",color:"#92400E",margin:0,marginBottom:"3px" }}>
                      {weeklyAI.missedCasuals.length === 1
                        ? `${weeklyAI.missedCasuals[0]} wasn't considered in this schedule`
                        : `${weeklyAI.missedCasuals.length} casual staff weren't considered in this schedule`}
                    </p>
                    <p style={{ fontSize:"19px",color:"#B45309",margin:0 }}>
                      {weeklyAI.missedCasuals.length > 1 && <><strong>{weeklyAI.missedCasuals.join(", ")}</strong> — </>}
                      They haven't submitted their availability for this week. Remind them to submit it, then regenerate.
                    </p>
                  </div>
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
                <button onClick={() => setWeeklyAI(null)} style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"20px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Cancel
                </button>
                <div style={{ flex:1 }} />
                <button onClick={() => setWeeklyAI(prev => ({ ...prev, step: "difficulty" }))}
                  style={{ padding:"10px 24px",borderRadius:"9px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"20px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",boxShadow:"0 4px 14px rgba(99,102,241,0.4)" }}>
                  Next: Set Difficulty →
                </button>
              </div>
            )}

            {weeklyAI.step === "difficulty" && (
              <div style={{ padding:"14px 24px",borderTop:"1px solid #E8EDF5",display:"flex",alignItems:"center",gap:"12px",background:"#fff",flexShrink:0 }}>
                <button onClick={() => setWeeklyAI(prev => ({ ...prev, step: "config" }))}
                  style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"20px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  ← Back
                </button>
                <div style={{ flex:1,fontSize:"19px",color:"#94A3B8" }}>Set required skill level for each role — AI will match staff accordingly</div>
                <button onClick={() => runGenerate(weeklyAI.weekStart, weeklyAI.weekEnd, weeklyAI.config)}
                  style={{ padding:"10px 24px",borderRadius:"9px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"20px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"8px",boxShadow:"0 4px 14px rgba(99,102,241,0.4)" }}>
                  <Sparkles size={13} /> Generate Schedule →
                </button>
              </div>
            )}

            {(weeklyAI.step === "preview" || weeklyAI.step === "creating") && (
              <div style={{ padding:"14px 24px",borderTop:"1px solid #E8EDF5",display:"flex",alignItems:"center",gap:"10px",background:"#fff",flexShrink:0 }}>
                <button onClick={() => setWeeklyAI(null)} style={{ padding:"9px 18px",borderRadius:"9px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"20px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Discard
                </button>
                {/* Reschedule button */}
                <button onClick={runReschedule} disabled={weeklyAI.step==="creating"}
                  style={{ padding:"9px 16px",borderRadius:"9px",border:"1.5px solid #C7D2FE",background:"#EEF2FF",fontSize:"20px",fontWeight:"700",color:"#4F46E5",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",transition:"all 0.15s" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                  </svg>
                  Reschedule
                </button>
                <div style={{ flex:1,fontSize:"19px",color:"#94A3B8" }}>
                  {weeklyAI.accepted?.size ?? 0} of {weeklyAI.schedule?.length} shifts selected
                </div>
                <button onClick={confirmWeeklySchedule} disabled={weeklyAI.step==="creating"||!weeklyAI.accepted?.size}
                  style={{ padding:"10px 22px",borderRadius:"9px",border:"none",fontSize:"20px",fontWeight:"700",cursor:!weeklyAI.accepted?.size?"not-allowed":"pointer",transition:"all 0.2s",whiteSpace:"nowrap",
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
        borderBottom: "1px solid #F1F5F9", fontSize: "20px", color: "#1E293B",
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
          <span style={{ fontSize: "17px", fontWeight: "700", color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 7px", borderRadius: "100px", whiteSpace: "nowrap" }}>
            Understaffed
          </span>
        )}
      </span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "18px", fontWeight: "600", textTransform: "capitalize", ...STATUS_STYLES[shift.status] }}>
          {shift.status}
        </span>
      </span>
      <button
        onClick={e => { e.stopPropagation(); onNav(); }}
        style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "19px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
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
      style={{ fontSize:"17px", fontWeight:"600", color:pillColor, background:pillBg, border:`1px solid ${pillBorder}`, padding:"2px 7px", borderRadius:"100px", whiteSpace:"nowrap", maxWidth:"100px", overflow:"hidden", textOverflow:"ellipsis", display:"flex", alignItems:"center", gap:"2px", cursor:"default", flexShrink:0, position:"relative" }}>
      <span style={{ flexShrink:0 }}>⚠</span>
      <span style={{ overflow:"hidden", textOverflow:"ellipsis" }}>{firstName}{winLabel}</span>
      {show && (
        <div style={{ position:"fixed", left:coord.x, top:coord.y, zIndex:9999999, background:"#0F172A", color:"#fff", fontSize:"18px", lineHeight:"1.6", padding:"9px 13px", borderRadius:"10px", maxWidth:"230px", whiteSpace:"normal", pointerEvents:"none", boxShadow:"0 8px 28px rgba(0,0,0,0.45)", width:"max-content" }}>
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
    if (rosterLoading) return <span style={{ fontSize:"17px", color:"#CBD5E1" }}>…</span>;
    if (!r) return null;

    if (r.is_on_leave)
      return <span style={{ fontSize:"17px", fontWeight:"600", color:"#DC2626", background:"#FEF2F2", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>On leave</span>;

    if (r.is_double_booked) {
      const b = r.double_booked_shift;
      const label = b ? `Booked ${b.start_time?.slice(0,5)}–${b.end_time?.slice(0,5)}` : "Double-booked";
      return <span style={{ fontSize:"17px", fontWeight:"600", color:"#B45309", background:"#FFFBEB", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{label}</span>;
    }

    if (s.type === "casual") {
      const { casual_available_today, casual_avail_from, casual_avail_to } = r;
      if (casual_available_today === false && !casual_avail_from)
        return <span style={{ fontSize:"17px", fontWeight:"600", color:"#94A3B8", background:"#F1F5F9", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>Not available</span>;
      if (casual_available_today === false && casual_avail_from)
        return <span style={{ fontSize:"17px", fontWeight:"600", color:"#D97706", background:"#FFFBEB", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{casual_avail_from?.slice(0,5)}–{casual_avail_to?.slice(0,5)}</span>;
      if (casual_available_today === true && (casual_avail_from || casual_avail_to))
        return <span style={{ fontSize:"17px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{casual_avail_from?.slice(0,5)}–{casual_avail_to?.slice(0,5)}</span>;
      if (casual_available_today === true)
        return <span style={{ fontSize:"17px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>Available</span>;
      return null;
    }

    const h = r.hours_this_week || 0;
    return <span style={{ fontSize:"17px", fontWeight:"600", color:"#059669", background:"#ECFDF5", padding:"1px 6px", borderRadius:"100px", whiteSpace:"nowrap" }}>{h > 0 ? `${h}h this week` : "Available"}</span>;
  }

  const filledColor = isFull ? accent.text : "#D97706";
  const filledBg    = isFull ? accent.bg   : "#FFFBEB";
  const filledBdr   = isFull ? accent.border : "#FDE68A";

  return (
    <div style={{ padding:"12px 14px", borderTop:"1px solid #F1F5F9" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <p style={{ fontSize:"17px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.3px" }}>Assign Staff</p>
        <span style={{ fontSize:"18px", fontWeight:"700", color:filledColor, background:filledBg, padding:"2px 8px", borderRadius:"100px", border:`1px solid ${filledBdr}` }}>
          {filled}/{headcount} filled
        </span>
      </div>

      {/* Selected pills */}
      {assigned.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:"5px", marginBottom:"10px" }}>
          {assigned.map(name => {
            const r = rosterData?.[name];
            const hasWarning = r && (
              r.is_on_leave ||
              r.is_double_booked ||
              (r.staff_type === "casual" && r.casual_available_today === false)
            );
            const warningTip = r?.is_on_leave ? "On leave"
              : r?.is_double_booked ? "Double-booked"
              : r?.staff_type === "casual" && r?.casual_available_today === false
              ? `Available ${r.casual_avail_from?.slice(0,5) || "?"}–${r.casual_avail_to?.slice(0,5) || "?"} (doesn't cover shift)`
              : null;
            return (
              <span key={name} title={warningTip || undefined}
                style={{ display:"flex", alignItems:"center", gap:"4px", padding:"3px 10px 3px 8px", borderRadius:"100px", background: hasWarning ? "#F59E0B" : accent.top, color:"#fff", fontSize:"19px", fontWeight:"600", border: hasWarning ? "1.5px solid #D97706" : "1.5px solid transparent" }}>
                <span style={{ width:"16px", height:"16px", borderRadius:"50%", background:"rgba(255,255,255,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:"700" }}>
                  {initials(name)}
                </span>
                {name}
                {hasWarning && <span style={{ fontSize:"17px", lineHeight:1 }}>⚠️</span>}
                <button onClick={() => toggle(name)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0", display:"flex", color:"rgba(255,255,255,0.8)", lineHeight:1 }}>
                  <X size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search */}
      {branchStaff.length > 0 && (
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search staff…"
          style={{ width:"100%", boxSizing:"border-box", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"19px", color:"#1E293B", outline:"none", marginBottom:"8px", background:"#F8FAFC" }}
        />
      )}

      {/* Staff list */}
      {branchStaff.length === 0 ? (
        <input
          style={{ width:"100%", boxSizing:"border-box", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"19px", color:"#1E293B", outline:"none" }}
          placeholder="Type staff names, comma-separated"
          value={assigned.join(", ")}
          onChange={e => onChange(e.target.value.split(",").map(x => x.trim()).filter(Boolean))}
        />
      ) : (
        <div style={{ maxHeight:"220px", overflowY:"auto", display:"flex", flexDirection:"column", gap:"2px" }}>
          {[{ label:"Regular", rows: regular }, { label:"Casual", rows: casual }].map(({ label, rows }) =>
            rows.length === 0 ? null : (
              <div key={label}>
                <p style={{ fontSize:"16px", fontWeight:"700", color:"#CBD5E1", textTransform:"uppercase", letterSpacing:"0.5px", padding:"4px 4px 2px" }}>{label}</p>
                {rows.map(({ name, type }) => {
                  const sel = assigned.includes(name);
                  const r   = rosterData?.[name];
                  const unavail = r && (r.is_on_leave || r.is_double_booked || (type === "casual" && r.casual_available_today === false));
                  return (
                    <button key={name} onClick={() => toggle(name)}
                      style={{ width:"100%", display:"flex", alignItems:"center", gap:"10px", padding:"7px 8px", borderRadius:"8px", border:"none", background:sel ? accent.bg : "transparent", cursor:"pointer", textAlign:"left", transition:"background 0.1s", opacity: unavail && !sel ? 0.6 : 1 }}>
                      <span style={{ width:"28px", height:"28px", borderRadius:"50%", background:sel ? accent.top : "#E2E8F0", color:sel ? "#fff" : "#64748B", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px", fontWeight:"700", flexShrink:0 }}>
                        {initials(name)}
                      </span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <span style={{ fontSize:"20px", fontWeight:"600", color:sel ? "#1E293B" : "#475569", display:"block", lineHeight:"1.2" }}>{name}</span>
                        <div style={{ marginTop:"2px" }}>{availBadge({ name, type })}</div>
                      </div>
                      <span style={{ fontSize:"17px", fontWeight:"600", padding:"2px 7px", borderRadius:"100px", background:type === "regular" ? "#EFF6FF" : "#F0FDF4", color:type === "regular" ? "#3B82F6" : "#10B981", flexShrink:0 }}>
                        {type === "regular" ? "Regular" : "Casual"}
                      </span>
                      {sel && <Check size={13} strokeWidth={3} color={accent.top} />}
                    </button>
                  );
                })}
              </div>
            )
          )}
          {allFiltered.length === 0 && <p style={{ fontSize:"19px", color:"#94A3B8", padding:"8px 4px" }}>No staff match "{search}"</p>}
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

  // AI shift review
  const [aiReview, setAiReview]           = useState(null);
  const [aiReviewLoading, setAiReviewLoading] = useState(false);

  async function runAiReview() {
    if (!draft) return;
    setAiReviewLoading(true);
    setAiReview(null);
    try {
      const roster = rosterData ? Object.values(rosterData) : [];
      const res = await api.post("/api/ai-assistant/shift-review", { shift: draft, roster });
      if (res.success) setAiReview(res.review);
      else setAiReview("⚠️ AI review unavailable right now.");
    } catch {
      setAiReview("⚠️ AI review unavailable right now.");
    } finally {
      setAiReviewLoading(false);
    }
  }

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
  function saveEdit(i)              { onEdit(i, draft); setEditingIdx(null); setDraft(null); setRosterData(null); setAiReview(null); }
  function cancelEdit()             { setEditingIdx(null); setDraft(null); setRosterData(null); setAiReview(null); }
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
    fontSize:"19px", color:"#1E293B", outline:"none", background:"#fff",
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
        <span style={{ fontSize:"19px",color:"#94A3B8" }}>
          Tap a card to <strong style={{color:"#1E293B"}}>select/deselect</strong> · click <strong style={{color:"#6366F1"}}>Edit</strong> to adjust
        </span>
        <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
          <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#6366F1",display:"inline-block" }}/>
          <span style={{ fontSize:"18px",color:"#64748B" }}>Selected</span>
          <span style={{ width:"10px",height:"10px",borderRadius:"3px",background:"#E2E8F0",border:"1px solid #CBD5E1",display:"inline-block",marginLeft:"6px" }}/>
          <span style={{ fontSize:"18px",color:"#64748B" }}>Deselected</span>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="responsive-hscroll">
      <div className="responsive-hscroll-inner" style={{ display:"grid", gridTemplateColumns:"repeat(7,minmax(0,1fr))", gap:"8px", marginBottom: editingIdx!==null?"20px":"0", "--hscroll-min-width": "980px" }}>
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
                <div style={{ fontSize:"16px",fontWeight:"700",color:colHasEdit?cc.text:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:"2px" }}>{dayAbbr}</div>
                <div style={{ fontSize:"23px",fontWeight:"900",color:colHasEdit?cc.text:"#1E293B",lineHeight:1,marginBottom:"1px" }}>{dayNum}</div>
                <div style={{ fontSize:"16px",color:"#94A3B8",fontWeight:"500" }}>{month}</div>
                <div style={{ marginTop:"5px",height:"3px",borderRadius:"3px",background:colHasEdit?cc.top:"#E2E8F0" }} />
              </div>

              {/* Empty column placeholder */}
              {entries.length===0 && (
                <div style={{ flex:1,minHeight:"60px",borderRadius:"10px",border:"1.5px dashed #E2E8F0",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAFBFE" }}>
                  <span style={{ fontSize:"18px",color:"#CBD5E1" }}>—</span>
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
                        <span style={{ fontSize:"17px",fontWeight:"800",color:checked||isEditing?cc.text:"#94A3B8",letterSpacing:"0.2px",background:checked||isEditing?cc.bg:"#F1F5F9",padding:"2px 6px",borderRadius:"4px" }}>
                          {s.start_time?.slice(0,5)}–{s.end_time?.slice(0,5)}
                        </span>
                        <div onClick={e=>{e.stopPropagation();onToggle(i);}}
                          style={{ width:"16px",height:"16px",borderRadius:"5px",border:`1.5px solid ${checked?cc.top:"#D1D5DB"}`,background:checked?cc.top:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0,transition:"all 0.15s" }}>
                          {checked && <Check size={9} color="#fff" strokeWidth={3.5} />}
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{ fontSize:"20px",fontWeight:"800",color:"#0F172A",lineHeight:1.25,marginBottom:"8px" }}>{s.title}</div>

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
                                <span style={{ fontSize:"18px",fontWeight:"700",color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{r.role_name||"Role"}</span>
                              </div>
                              <span style={{ fontSize:"17px",fontWeight:"700",color:ok?"#059669":"#D97706",whiteSpace:"nowrap",flexShrink:0 }}>
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
                                <span key={k} style={{ fontSize:"17px",fontWeight:"600",color:cc.text,background:cc.bg,border:`1px solid ${cc.border}`,padding:"2px 7px",borderRadius:"100px",whiteSpace:"nowrap",maxWidth:"70px",overflow:"hidden",textOverflow:"ellipsis" }}>
                                  {firstName}
                                </span>
                              );
                            })}
                            {allStaff.length>4 && (
                              <span style={{ fontSize:"17px",fontWeight:"600",color:"#64748B",background:"#F1F5F9",border:"1px solid #E2E8F0",padding:"2px 7px",borderRadius:"100px" }}>+{allStaff.length-4}</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Coverage summary */}
                      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"7px" }}>
                        <span style={{ fontSize:"17px",color:fullyStaffed?"#059669":totalSlots>0?"#D97706":"#94A3B8",fontWeight:"600" }}>
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
                        style={{ width:"100%",padding:"5px 0",borderRadius:"7px",border:`1px solid ${isEditing?cc.top:cc.border}`,background:isEditing?cc.top:cc.bg,color:isEditing?"#fff":cc.text,fontSize:"17px",fontWeight:"700",cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",justifyContent:"center",gap:"4px" }}>
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
              style={{ background:"#fff",borderRadius:"20px",width:"min(96vw,940px)",maxHeight:"88vh",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",overflow:"hidden",animation:"modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1)" }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background:`linear-gradient(135deg,${cc.top}18,${cc.top}08)`,borderBottom:`1.5px solid ${cc.border}`,padding:"18px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
                <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
                  <div style={{ width:"4px",height:"36px",borderRadius:"2px",background:cc.top,flexShrink:0 }} />
                  <div>
                    <p style={{ fontSize:"22px",fontWeight:"800",color:"#0F172A",lineHeight:1,marginBottom:"4px" }}>{draft.title || "Shift"}</p>
                    <p style={{ fontSize:"19px",color:"#64748B",fontWeight:"500" }}>
                      {schedule[editingIdx]?.date} &nbsp;·&nbsp; {draft.start_time?.slice(0,5)}–{draft.end_time?.slice(0,5)}
                    </p>
                  </div>
                </div>
                <button onClick={cancelEdit} style={{ width:"34px",height:"34px",borderRadius:"10px",border:"1.5px solid #E2E8F0",background:"#fff",color:"#64748B",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s" }}>
                  <X size={15} />
                </button>
              </div>

              {/* Body: two-column layout */}
              <div style={{ flex:1,display:"flex",overflow:"hidden" }}>

                {/* LEFT: shift details + roles */}
                <div style={{ flex:1,overflowY:"auto",padding:"22px",minWidth:0 }}>

                  {/* Basic fields */}
                  <p style={{ fontSize:"17px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>Shift details</p>
                  <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:"12px",marginBottom:"22px" }}>
                    {[
                      { label:"Title",      field:"title",      type:"text", val:draft.title },
                      { label:"Start time", field:"start_time", type:"time", val:draft.start_time },
                      { label:"End time",   field:"end_time",   type:"time", val:draft.end_time },
                    ].map(f => (
                      <div key={f.field}>
                        <p style={{ fontSize:"17px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"6px" }}>{f.label}</p>
                        <input type={f.type} value={f.val} onChange={e => setDraftField(f.field, e.target.value)} style={F} />
                      </div>
                    ))}
                  </div>

                  <div style={{ height:"1px",background:"#F1F5F9",marginBottom:"20px" }} />

                  {/* Roles */}
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px" }}>
                    <p style={{ fontSize:"17px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px" }}>Roles & Assigned Staff</p>
                    <button onClick={addRole}
                      style={{ padding:"4px 12px",borderRadius:"7px",border:`1.5px dashed ${cc.border}`,background:cc.bg,color:cc.text,fontSize:"18px",fontWeight:"700",cursor:"pointer" }}>
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
                            style={{ flex:1,border:"none",background:"transparent",fontSize:"20px",fontWeight:"700",color:cc.text,outline:"none",fontFamily:"inherit" }} />
                          {/* Difficulty pill */}
                          {(() => {
                            const diff = r.difficulty || "any";
                            const DIFF_CYCLE = ["any","intermediate","senior"];
                            const DIFF_STYLE = {
                              any:          { bg:"#F1F5F9", border:"#CBD5E1", color:"#64748B" },
                              intermediate: { bg:"#EFF6FF", border:"#BFDBFE", color:"#1D4ED8" },
                              senior:       { bg:"#F5F3FF", border:"#DDD6FE", color:"#6D28D9" },
                            };
                            const ds = DIFF_STYLE[diff];
                            return (
                              <button title="Skill level required — click to change" onClick={() => {
                                const next = DIFF_CYCLE[(DIFF_CYCLE.indexOf(diff)+1)%DIFF_CYCLE.length];
                                setRoleField(j, "difficulty", next);
                              }} style={{ padding:"3px 9px",borderRadius:"100px",border:`1.5px solid ${ds.border}`,background:ds.bg,color:ds.color,fontSize:"17px",fontWeight:"700",cursor:"pointer",flexShrink:0,whiteSpace:"nowrap" }}>
                                {diff === "any" ? "Any" : diff === "intermediate" ? "Mid+" : "Senior"}
                              </button>
                            );
                          })()}
                          <div style={{ display:"flex",alignItems:"center",gap:"6px",flexShrink:0 }}>
                            <span style={{ fontSize:"18px",color:"#94A3B8" }}>×</span>
                            <input
                              type="number" min="1" value={r.headcount}
                              onChange={e => setRoleField(j, "headcount", Number(e.target.value))}
                              style={{ width:"46px",padding:"4px 6px",borderRadius:"7px",border:`1.5px solid ${cc.border}`,fontSize:"20px",fontWeight:"700",textAlign:"center",outline:"none",background:"#fff",color:"#1E293B",fontFamily:"inherit" }} />
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

                {/* RIGHT: AI Review panel */}
                <div style={{ width:"300px",flexShrink:0,borderLeft:"1.5px solid #E0E7FF",display:"flex",flexDirection:"column",background:"#FAFBFF" }}>
                  {/* Panel header */}
                  <div style={{ background:"linear-gradient(135deg,#EEF2FF,#F5F3FF)",padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1.5px solid #E0E7FF",flexShrink:0 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:"8px" }}>
                      <div style={{ width:"26px",height:"26px",borderRadius:"8px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 6px rgba(99,102,241,0.3)" }}>
                        <Sparkles size={12} color="#fff" />
                      </div>
                      <div>
                        <p style={{ fontSize:"19px",fontWeight:"800",color:"#4F46E5",margin:0 }}>AI Review</p>
                        <p style={{ fontSize:"17px",color:"#818CF8",margin:0 }}>Assignments & suggestions</p>
                      </div>
                    </div>
                  </div>
                  {/* Review button */}
                  <div style={{ padding:"12px 16px",borderBottom:"1px solid #E0E7FF",flexShrink:0 }}>
                    <button
                      onClick={runAiReview}
                      disabled={aiReviewLoading || rosterLoading}
                      style={{ width:"100%",padding:"8px 14px",borderRadius:"8px",border:"none",background:aiReviewLoading?"#C7D2FE":"#6366F1",color:"#fff",fontSize:"19px",fontWeight:"700",cursor:aiReviewLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",transition:"background 0.15s" }}>
                      {aiReviewLoading
                        ? <><span style={{ width:"10px",height:"10px",borderRadius:"50%",border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",display:"inline-block",animation:"aiSpin 0.7s linear infinite" }}/> Reviewing…</>
                        : <><Sparkles size={11}/> {aiReview ? "Re-review shift" : "Review shift"}</>}
                    </button>
                  </div>
                  {/* Review content */}
                  <div style={{ flex:1,overflowY:"auto",padding:"14px 16px" }}>
                    {aiReview ? (
                      aiReview.split("\n").filter(l => l.trim()).map((line, i) => {
                        const isWarning = /⚠️|warning|conflict|leave|unfilled|not available/i.test(line);
                        const isGood    = /✅|good|fully|covered|great/i.test(line);
                        return (
                          <div key={i} style={{ display:"flex",gap:"8px",marginBottom:"9px",alignItems:"flex-start" }}>
                            <span style={{ fontSize:"20px",flexShrink:0,marginTop:"1px" }}>
                              {isWarning ? "⚠️" : isGood ? "✅" : "•"}
                            </span>
                            <p style={{ fontSize:"19px",color:isWarning?"#B45309":isGood?"#047857":"#374151",fontWeight:isWarning||isGood?"600":"400",lineHeight:1.55,margin:0 }}>
                              {line.replace(/^[-•·✅⚠️*]\s*/, "").trim()}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:"10px",textAlign:"center" }}>
                        <div style={{ width:"40px",height:"40px",borderRadius:"12px",background:"#EEF2FF",display:"flex",alignItems:"center",justifyContent:"center" }}>
                          <Sparkles size={18} color="#6366F1" />
                        </div>
                        <p style={{ fontSize:"19px",color:"#94A3B8",margin:0,lineHeight:1.6 }}>
                          Click <strong style={{color:"#6366F1"}}>Review shift</strong> to check assignments, spot conflicts, and get staff suggestions.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding:"14px 22px",borderTop:"1.5px solid #F1F5F9",display:"flex",justifyContent:"flex-end",gap:"10px",background:"#FAFBFE",flexShrink:0 }}>
                <button onClick={cancelEdit}
                  style={{ padding:"9px 20px",borderRadius:"10px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"20px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={() => saveEdit(editingIdx)}
                  style={{ padding:"9px 24px",borderRadius:"10px",border:"none",background:`linear-gradient(135deg,${cc.top},${cc2.top})`,color:"#fff",fontSize:"20px",fontWeight:"700",cursor:"pointer",boxShadow:`0 4px 14px ${cc.top}50`,display:"flex",alignItems:"center",gap:"7px" }}>
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
        padding: "10px 18px", borderRadius: "10px", fontSize: "21px",
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
        border: "none", borderRadius: "7px", fontSize: "20px",
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
        padding: "6px 13px", borderRadius: "100px", fontSize: "19px", fontWeight: "600",
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
        border: "1px solid #E2E8F0", fontSize: "21px",
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
        <span style={{ fontSize:"20px",fontWeight:"800",color:"#1E293B" }}>Staff Workload</span>
        <div style={{ display:"flex",gap:"16px",alignItems:"center" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"5px" }}>
            <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:coverPct===100?"#059669":coverPct>50?"#D97706":"#DC2626" }}/>
            <span style={{ fontSize:"19px",fontWeight:"600",color:"#475569" }}>Coverage: <strong style={{ color:coverPct===100?"#059669":"#D97706" }}>{filledSlots}/{totalSlots}</strong></span>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:"5px" }}>
            <div style={{ width:"8px",height:"8px",borderRadius:"50%",background:balanceColor }}/>
            <span style={{ fontSize:"19px",fontWeight:"600",color:"#475569" }}>Workload: <strong style={{ color:balanceColor }}>{balanceLabel}</strong></span>
          </div>
          {understaffedRoles > 0 && (
            <span style={{ fontSize:"18px",fontWeight:"700",color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",padding:"2px 9px",borderRadius:"100px" }}>
              {understaffedRoles} understaffed role{understaffedRoles!==1?"s":""}
            </span>
          )}
        </div>
      </div>

      {staffList.length === 0 ? (
        <div style={{ padding:"24px",textAlign:"center",color:"#94A3B8",fontSize:"20px" }}>
          No staff assigned yet — click <strong style={{ color:"#6366F1" }}>Edit</strong> on any shift card to assign staff.
        </div>
      ) : (
        <div style={{ padding:"12px 20px" }}>
          {/* Column headers */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 1fr 60px",gap:"12px",alignItems:"center",padding:"4px 0 8px",borderBottom:"1px solid #F1F5F9",marginBottom:"4px" }}>
            {["Staff Member","Shifts","Hours","Workload","Avg"].map(h=>(
              <span key={h} style={{ fontSize:"17px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>{h}</span>
            ))}
          </div>
          {staffList.map(({ name, shifts, hours }) => {
            const barPct = maxH > 0 ? (hours / maxH) * 100 : 0;
            const overloaded = hours > avgH * 1.3;
            const underloaded = hours < avgH * 0.7 && staffList.length > 1;
            const barColor = overloaded ? "#F59E0B" : underloaded ? "#94A3B8" : "#6366F1";
            return (
              <div key={name} style={{ display:"grid",gridTemplateColumns:"1fr 80px 80px 1fr 60px",gap:"12px",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F8FAFC" }}>
                <span style={{ fontSize:"20px",fontWeight:"600",color:"#1E293B",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{name}</span>
                <span style={{ fontSize:"19px",color:"#64748B" }}>{shifts} shift{shifts!==1?"s":""}</span>
                <div style={{ display:"flex",alignItems:"center",gap:"4px" }}>
                  <span style={{ fontSize:"20px",fontWeight:"700",color:"#1E293B" }}>{hours}h</span>
                  {overloaded && <span style={{ fontSize:"16px",fontWeight:"700",color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",padding:"1px 5px",borderRadius:"100px" }}>High</span>}
                  {underloaded && <span style={{ fontSize:"16px",fontWeight:"700",color:"#475569",background:"#F1F5F9",border:"1px solid #E2E8F0",padding:"1px 5px",borderRadius:"100px" }}>Low</span>}
                </div>
                <div style={{ height:"7px",borderRadius:"4px",background:"#F1F5F9",overflow:"hidden" }}>
                  <div style={{ height:"100%",width:`${barPct}%`,borderRadius:"4px",background:barColor,transition:"width 0.4s" }}/>
                </div>
                <span style={{ fontSize:"18px",color:overloaded?"#D97706":underloaded?"#94A3B8":"#64748B",fontWeight:"600",textAlign:"right" }}>
                  {avgH > 0 ? `${hours > avgH ? "+" : ""}${(hours - avgH).toFixed(1)}h` : "—"}
                </span>
              </div>
            );
          })}
          <div style={{ marginTop:"10px",display:"flex",gap:"16px" }}>
            <span style={{ fontSize:"18px",color:"#94A3B8" }}>Avg per staff: <strong style={{ color:"#1E293B" }}>{avgH.toFixed(1)}h</strong></span>
            <span style={{ fontSize:"18px",color:"#94A3B8" }}>Hour spread: <strong style={{ color:balanceColor }}>{spread.toFixed(1)}h</strong></span>
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
          <span style={{ fontSize:"20px",fontWeight:"800",color:"#1E293B" }}>AI Review</span>
          {state==="done" && review && (
            <span style={{ fontSize:"18px",fontWeight:"700",color:scoreColor,background:scoreBg,border:`1px solid ${scoreBorder}`,padding:"2px 9px",borderRadius:"100px" }}>
              Score: {review.score}/100
            </span>
          )}
        </div>
        {state !== "loading" && (
          <button onClick={getReview}
            style={{ padding:"6px 14px",borderRadius:"8px",border:"none",background:"linear-gradient(135deg,#4F46E5,#7C3AED)",color:"#fff",fontSize:"19px",fontWeight:"700",cursor:"pointer",display:"flex",alignItems:"center",gap:"6px",boxShadow:"0 2px 8px rgba(99,102,241,0.3)" }}>
            <Sparkles size={11}/>{state==="done"?"Re-review":"Get AI Review"}
          </button>
        )}
      </div>

      <div style={{ padding:"16px 20px" }}>
        {state === "idle" && (
          <p style={{ fontSize:"20px",color:"#94A3B8",textAlign:"center",padding:"12px 0" }}>
            Get an AI analysis of your schedule — coverage gaps, workload balance, and improvement tips.
          </p>
        )}
        {state === "loading" && (
          <div style={{ display:"flex",alignItems:"center",gap:"10px",padding:"12px 0" }}>
            <div style={{ width:"16px",height:"16px",borderRadius:"50%",border:"2px solid #EEF2FF",borderTopColor:"#6366F1",animation:"aiSpin 0.7s linear infinite",flexShrink:0 }}/>
            <span style={{ fontSize:"20px",color:"#6366F1",fontWeight:"600" }}>Analysing your schedule…</span>
          </div>
        )}
        {state === "done" && review && (
          <div>
            <div style={{ display:"flex",alignItems:"flex-start",gap:"14px",marginBottom:"14px" }}>
              <div style={{ width:"54px",height:"54px",borderRadius:"50%",background:scoreBg,border:`2px solid ${scoreBorder}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <span style={{ fontSize:"23px",fontWeight:"900",color:scoreColor }}>{review.score}</span>
              </div>
              <p style={{ fontSize:"20px",color:"#475569",lineHeight:1.6,paddingTop:"4px" }}>{review.summary}</p>
            </div>
            <div style={{ display:"flex",flexDirection:"column",gap:"6px" }}>
              {(review.flags || []).map((flag, i) => {
                const s = SEV[flag.severity] || SEV.info;
                return (
                  <div key={i} style={{ display:"flex",alignItems:"flex-start",gap:"8px",padding:"9px 12px",borderRadius:"9px",background:s.bg,border:`1px solid ${s.border}` }}>
                    <span style={{ fontSize:"20px",flexShrink:0,lineHeight:1.4 }}>{s.icon}</span>
                    <span style={{ fontSize:"19px",color:s.text,fontWeight:"500",lineHeight:1.5 }}>{flag.message}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {state === "error" && (
          <div style={{ textAlign:"center",padding:"12px 0",color:"#DC2626",fontSize:"20px" }}>
            Failed to get review.{" "}
            <button onClick={getReview} style={{ color:"#6366F1",background:"none",border:"none",cursor:"pointer",fontWeight:"700",fontSize:"20px" }}>Try again</button>
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
      <div onClick={() => setOpen(o => !o)} style={{ padding:"9px 32px 9px 12px",borderRadius:"8px",border:`1.5px solid ${open?"#6366F1":"#E2E8F0"}`,fontSize:"20px",color:value?"#1E293B":"#94A3B8",background:"#F8FAFC",cursor:"pointer",userSelect:"none",position:"relative",transition:"border-color 0.15s" }}>
        {value || placeholder}
        <svg style={{ position:"absolute",right:"10px",top:"50%",transform:`translateY(-50%) rotate(${open?"180deg":"0deg"})`,transition:"transform 0.15s",pointerEvents:"none" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 4l4 4 4-4" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      {open && (
        <div style={{ position:"absolute",top:"calc(100% + 4px)",left:0,right:0,background:"#fff",border:"1.5px solid #E2E8F0",borderRadius:"10px",boxShadow:"0 8px 24px rgba(0,0,0,0.12)",zIndex:9999,overflow:"hidden",maxHeight:"200px",overflowY:"auto" }}>
          {options.map(opt => (
            <div key={opt} onClick={() => { onChange(opt); setOpen(false); }}
              style={{ padding:"9px 14px",fontSize:"20px",cursor:"pointer",fontWeight:opt===value?"600":"400",color:opt===value?"#4F46E5":"#1E293B",background:opt===value?"#EEF2FF":"#fff",transition:"background 0.1s" }}
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

