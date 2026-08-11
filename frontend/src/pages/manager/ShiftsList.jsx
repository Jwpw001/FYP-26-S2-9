import { useState, useEffect, useRef } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Trash2, Check, X, Calendar, AlertTriangle, RefreshCw } from "lucide-react";

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
  const [calendarScope, setCalendarScope] = useState("week");
  const [dayOffset, setDayOffset]   = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  // Round 3, Task 2 — template-based generation (deterministic, distinct from the AI weekly
  // scheduler below): fills the rolling horizon from branch_task_templates.
  const [templateGen, setTemplateGen] = useState({ running: false, result: null, error: "" });

  // Round 6, Task 4b/4c — shared by the manual multi-select "Publish" button and the new
  // "Publish week" button: fetch a preview (counts, unfilled-task warning) first, show a
  // confirmation, only then commit. confirming holds { shiftIds, preview } while the modal is open.
  const [bulkPublish, setBulkPublish] = useState({ confirming: null, previewing: false, running: false, result: null, error: "" });

  // Round 6, Task 4a — the calendar previously only fetched shifts once on mount; nothing
  // refetched after a mutating action (template generation, bulk publish), so the manager's
  // reasonable conclusion was that nothing happened. Extracted so every mutating action below can
  // call the same fetch the initial load and the existing krewby-ai-action listener already use.
  async function refreshShifts() {
    if (!branchInfo?.branch_id) return;
    const { data } = await supabase
      .from("shifts")
      .select("shift_id, title, shift_date, start_time, end_time, status, branch_id, shift_tasks ( task_id, status )")
      .eq("branch_id", branchInfo.branch_id)
      .order("shift_date", { ascending: false });
    if (data) setShifts(data);
  }

  async function runTemplateGeneration() {
    setTemplateGen({ running: true, result: null, error: "" });
    try {
      const res = await api.post("/api/shifts/generate", {});
      setTemplateGen({ running: false, result: res, error: "" });
      await refreshShifts();
    } catch (e) {
      setTemplateGen({ running: false, result: null, error: e.message || "Generation failed." });
    }
  }

  // AI Weekly Schedule state — step: 'config' | 'generating' | 'preview' | 'creating' | 'done'

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
    window.addEventListener("krewby-ai-action", refreshShifts);
    return () => window.removeEventListener("krewby-ai-action", refreshShifts);
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

  // Round 6, Task 4b — one shared bulk-publish path for both the manual multi-select bar and the
  // "Publish week" button below: fetch counts first (POST .../publish-bulk/preview, read-only),
  // show a confirmation stating them, only commit on explicit confirm. Reuses the single-shift
  // publish's underlying status transition + notification shape (updateShift), just batched
  // server-side — this is the one publish path, not a second one.
  async function startBulkPublish(shiftIds) {
    if (shiftIds.length === 0) return;
    setBulkPublish(prev => ({ ...prev, previewing: true, error: "" }));
    try {
      const preview = await api.post("/api/shifts/publish-bulk/preview", { shift_ids: shiftIds });
      setBulkPublish(prev => ({ ...prev, previewing: false, confirming: { shiftIds, preview } }));
    } catch (e) {
      setBulkPublish(prev => ({ ...prev, previewing: false, error: e.message || "Could not preview publish." }));
    }
  }

  async function confirmBulkPublish() {
    const { shiftIds } = bulkPublish.confirming;
    setBulkPublish(prev => ({ ...prev, confirming: null, running: true, result: null, error: "" }));
    try {
      const result = await api.post("/api/shifts/publish-bulk", { shift_ids: shiftIds });
      setBulkPublish(prev => ({ ...prev, running: false, result }));
      await refreshShifts();
      setSelected(new Set());
      setSelectMode(false);
    } catch (e) {
      setBulkPublish(prev => ({ ...prev, running: false, error: e.message || "Bulk publish failed." }));
    }
  }

  function publishSelected() {
    const draftIds = shifts.filter(s => selected.has(s.shift_id) && s.status === "draft").map(s => s.shift_id);
    startBulkPublish(draftIds);
  }

  function publishWeek() {
    const weekDateStrs = new Set(getWeekDates().map(d => d.toISOString().slice(0, 10)));
    const draftIds = shifts.filter(s => weekDateStrs.has(s.shift_date?.split("T")[0] ?? s.shift_date) && s.status === "draft").map(s => s.shift_id);
    startBulkPublish(draftIds);
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
              <button onClick={publishSelected} disabled={bulkPublish.previewing || bulkPublish.running || !hasDraft}
                style={{ padding:"6px 12px", borderRadius:"7px", fontSize:"14.5px", fontWeight:"700", background:"#fff", border:"1px solid #C7D2FE", cursor: hasDraft ? "pointer" : "default", opacity: hasDraft ? 1 : 0.4 }}>
                {bulkPublish.previewing ? "Checking…" : bulkPublish.running ? "Publishing…" : "Publish"}
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
            {calendarScope === "week" && shifts.some(s => {
              const dateStr = s.shift_date?.split("T")[0] ?? s.shift_date;
              return s.status === "draft" && weekDates.some(d => d.toISOString().slice(0, 10) === dateStr);
            }) && (
              <button onClick={publishWeek} disabled={bulkPublish.previewing || bulkPublish.running}
                title="Publish every draft shift in the currently viewed week"
                style={{ background:"#1C1B18", color:"#fff", padding:"8px 14px", borderRadius:"9px", fontSize:"20px", fontWeight:"700", border:"none", cursor: bulkPublish.previewing || bulkPublish.running ? "default" : "pointer", display:"flex", alignItems:"center", gap:"6px" }}>
                <Check size={13} /> {bulkPublish.previewing ? "Checking…" : bulkPublish.running ? "Publishing…" : "Publish Week"}
              </button>
            )}
            <button onClick={onNextPeriod}
              style={{ width:"34px", height:"34px", borderRadius:"9px", border:"1px solid #E2E8F0", background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"21px", color:"#64748B", transition:"background 0.15s" }}>
              →
            </button>
          </div>
        </div>

        {(templateGen.result || templateGen.error) && (
          <div style={{ background: templateGen.error ? "#FEF2F2" : "#F0FDF4", border:`1px solid ${templateGen.error ? "#FECACA" : "#BBF7D0"}`, borderRadius:"10px", padding:"10px 14px", marginBottom:"14px", fontSize:"19px", color: templateGen.error ? "#991B1B" : "#166534" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px" }}>
              <span>
                {templateGen.error
                  ? templateGen.error
                  : `Generated ${templateGen.result.created_count} shift${templateGen.result.created_count === 1 ? "" : "s"}${templateGen.result.auto_populated_count > 0 ? `, auto-filled ${templateGen.result.auto_populated_count} task${templateGen.result.auto_populated_count === 1 ? "" : "s"} with regular staff` : ""}. ${templateGen.result.skipped.length} day${templateGen.result.skipped.length === 1 ? "" : "s"} skipped (already covered, closed, or no templates set).`}
              </span>
              <button onClick={() => setTemplateGen({ running:false, result:null, error:"" })} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", display:"flex", flexShrink:0 }}><X size={14} /></button>
            </div>
            {templateGen.result?.data_gap_staff?.length > 0 && (
              <p style={{ marginTop:"6px", color:"#D97706" }}>
                ⚠ {templateGen.result.data_gap_staff.map(s => s.full_name || `Staff #${s.staff_id}`).join(", ")} — no contracted days on file, so they weren't auto-scheduled. Set their default work days to include them.
              </p>
            )}
          </div>
        )}

        {(bulkPublish.result || bulkPublish.error) && (
          <div style={{ background: bulkPublish.error ? "#FEF2F2" : "#F0FDF4", border:`1px solid ${bulkPublish.error ? "#FECACA" : "#BBF7D0"}`, borderRadius:"10px", padding:"10px 14px", marginBottom:"14px", fontSize:"19px", color: bulkPublish.error ? "#991B1B" : "#166534" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px" }}>
              <span>
                {bulkPublish.error
                  ? bulkPublish.error
                  : `Published ${bulkPublish.result.published_count} shift${bulkPublish.result.published_count === 1 ? "" : "s"}. ${bulkPublish.result.notified_count} staff member${bulkPublish.result.notified_count === 1 ? "" : "s"} notified.${bulkPublish.result.skipped_count > 0 ? ` ${bulkPublish.result.skipped_count} skipped (already published, cancelled, or completed).` : ""}`}
              </span>
              <button onClick={() => setBulkPublish(prev => ({ ...prev, result:null, error:"" }))} style={{ background:"none", border:"none", cursor:"pointer", color:"inherit", display:"flex", flexShrink:0 }}><X size={14} /></button>
            </div>
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
                        const filledTasks = tasks.filter(t => t.status==="assigned"||t.status==="done").length;
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
                                <div style={{ fontSize:"16px", fontWeight:"700", color:"#64748B", marginBottom:"3px" }}>{filledTasks}/{tasks.length} filled</div>
                                <div style={{ height:"4px", borderRadius:"2px", background:"#E2E8F0", overflow:"hidden" }}>
                                  <div style={{ height:"100%", width:`${tasks.length>0?Math.round(filledTasks/tasks.length*100):0}%`, background:c.dot }} />
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
                      const filledTasks = tasks.filter(t=>t.status==="assigned"||t.status==="done").length;
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
                            <div style={{ fontSize:"17px", fontWeight:"700", color:"#64748B", marginTop:"3px" }}>{filledTasks}/{tasks.length} filled</div>
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

      {/* ── Bulk publish: confirm, stating counts (Round 6, Task 4b) ─────────── */}
      {bulkPublish.confirming && (() => {
        const { shiftIds, preview } = bulkPublish.confirming;
        return (
          <div style={{ position:"fixed",inset:0,zIndex:999999,background:"rgba(2,6,23,0.55)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}
            onClick={() => setBulkPublish(prev => ({ ...prev, confirming: null }))}>
            <div style={{ background:"#fff",borderRadius:"20px",width:"min(94vw,440px)",boxShadow:"0 32px 80px rgba(0,0,0,0.4)",overflow:"hidden",animation:"modalIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",padding:"22px" }}
              onClick={e => e.stopPropagation()}>
              <p style={{ fontSize:"22px",fontWeight:"800",color:"#0F172A",margin:0,marginBottom:"8px" }}>
                Publish {preview.draft_count} shift{preview.draft_count === 1 ? "" : "s"}?
              </p>
              <p style={{ fontSize:"20px",color:"#475569",margin:0,marginBottom:preview.unfilled_shift_count > 0 ? "10px" : "18px" }}>
                {preview.staff_count} staff member{preview.staff_count === 1 ? "" : "s"} will be notified.
                {preview.non_draft_count > 0 && ` ${preview.non_draft_count} already-published/cancelled shift${preview.non_draft_count === 1 ? "" : "s"} will be skipped.`}
              </p>
              {preview.unfilled_shift_count > 0 && (
                <div style={{ display:"flex",alignItems:"flex-start",gap:"8px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:"10px",padding:"10px 12px",marginBottom:"18px" }}>
                  <AlertTriangle size={16} color="#B45309" style={{ flexShrink:0,marginTop:"2px" }} />
                  <p style={{ fontSize:"19px",color:"#92400E",margin:0 }}>
                    {preview.unfilled_shift_count} of {preview.draft_count} shifts have unfilled tasks. You can still publish a partial roster.
                  </p>
                </div>
              )}
              <div style={{ display:"flex",gap:"8px",justifyContent:"flex-end" }}>
                <button onClick={() => setBulkPublish(prev => ({ ...prev, confirming: null }))}
                  style={{ padding:"9px 16px",borderRadius:"9px",border:"1px solid #E2E8F0",background:"#fff",color:"#475569",fontSize:"20px",fontWeight:"700",cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={confirmBulkPublish} disabled={preview.draft_count === 0}
                  style={{ padding:"9px 18px",borderRadius:"9px",border:"none",background: preview.draft_count === 0 ? "#CBD5E1" : "#1C1B18",color:"#fff",fontSize:"20px",fontWeight:"700",cursor: preview.draft_count === 0 ? "default" : "pointer" }}>
                  Publish
                </button>
              </div>
            </div>
          </div>
        );
      })()}


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

