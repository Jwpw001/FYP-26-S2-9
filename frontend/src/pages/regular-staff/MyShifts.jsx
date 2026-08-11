import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";
import {
  Calendar, Clock, FileText,
  CheckCircle, AlertCircle, ChevronLeft, ChevronRight, SmilePlus, X, Tag, User, Paperclip
} from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-tasks-styles")) {
  const style = document.createElement("style");
  style.id = "staff-tasks-styles";
  style.textContent = `
    @keyframes fadeUp   { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer  { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn   { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn  { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}
function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtTime(t) { return t?.slice(0, 5) || "—"; }
// API returns Prisma DateTime ISO strings for time fields ("1970-01-01T09:00:00.000Z")
function fmtApiTime(t) {
  if (!t) return "—";
  return t.includes("T") ? t.slice(11, 16) : t.slice(0, 5);
}
function fmtHours(h) {
  if (!h || h <= 0) return "0h";
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}
function shiftDuration(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
}
function shiftEnded(shiftDate, endTime) {
  if (!shiftDate || !endTime) return false;
  return new Date() >= new Date(`${shiftDate}T${endTime.slice(0, 5)}:00`);
}
function fmtFullDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday:"short", day:"numeric", month:"short", year:"numeric" });
}
function monthLabel(ym) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-SG", { month:"long", year:"numeric" });
}
function prevMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function getWeekStart(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d.toISOString().slice(0, 10);
}
function getWeekEnd(weekStart) {
  const d = new Date(weekStart + "T00:00:00");
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}
function fmtShortDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", { day:"numeric", month:"short" });
}

const REPORT_STATUS = {
  pending:  { bg:"#FEF3C7", color:"#92400E", label:"Pending Review", icon: Clock },
  approved: { bg:"#DCFCE7", color:"#166534", label:"Approved",       icon: CheckCircle },
  rejected: { bg:"#FEE2E2", color:"#991B1B", label:"Rejected",       icon: AlertCircle },
};

// ── Date block ────────────────────────────────────────────────────────────────
function DateBlock({ date, highlight = false }) {
  const d = date ? new Date(date + "T00:00:00") : null;
  return (
    <div style={{ width:"50px", minWidth:"50px", height:"54px", borderRadius:"10px", flexShrink:0,
      background: highlight ? "#2563EB" : "#F1F5F9",
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
      <span style={{ fontSize:"9px", fontWeight:"700", letterSpacing:"0.08em",
        color: highlight ? "#BFDBFE" : "#94A3B8" }}>
        {d ? d.toLocaleDateString("en-SG", { month:"short" }).toUpperCase() : ""}
      </span>
      <span style={{ fontSize:"19px", fontWeight:"800", lineHeight:1,
        color: highlight ? "#FFF" : "#1E293B" }}>
        {d ? d.getDate() : "—"}
      </span>
      <span style={{ fontSize:"9px", fontWeight:"600",
        color: highlight ? "#BFDBFE" : "#CBD5E1" }}>
        {d ? d.toLocaleDateString("en-SG", { weekday:"short" }).toUpperCase() : ""}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MyTasks({ Layout = StaffLayout }) {
  const user   = getUser();
  const userId = user?.user_id;
  // Round 3, Task 4: casual workers report actual worked hours as a from/to time; regular staff
  // keep the existing plain-hours flow unchanged, per the task's own instruction not to add a
  // new obligation for them.
  const isCasual = user?.role === "casual_staff";
  const [searchParams] = useSearchParams();

  const [staffId,    setStaffId]    = useState(null);
  const [shifts,     setShifts]     = useState([]);
  const [timesheets, setTimesheets] = useState({});
  const [loading,    setLoading]    = useState(true);
  // Deep-linkable via ?tab=reports (e.g. the Dashboard's "needs your hours" widget) so a manager
  // or staff member can land directly on the tab they need instead of always starting on Schedule.
  const [tab,        setTab]        = useState(searchParams.get("tab") === "reports" ? "reports" : "schedule"); // "schedule" | "reports"
  const [reportModalFor, setReportModalFor] = useState(null); // the assignment being reported, or null
  const [formData,   setFormData]   = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [toast,      setToast]      = useState(null);
  const [now,        setNow]        = useState(() => new Date());
  const [reportFilter, setReportFilter] = useState("all"); // all|pending|approved|rejected|none
  const [month,      setMonth]      = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const today = toLocalDateStr(now);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), ok ? 3000 : 5000);
  }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: staffRows } = await supabase
          .from("staff").select("staff_id").eq("user_id", userId).limit(1);
        const sid = staffRows?.[0]?.staff_id;
        if (!sid || cancelled) return;
        setStaffId(sid);

        const { assignments } = await api.get("/api/shifts/me/tasks");

        if (cancelled) return;
        setShifts((assignments || []).map(a => ({
          assignment_id: a.assignment_id,
          source:        "task_assignments",
          status:        a.status,
          acknowledged:  a.acknowledged,
          shift:         a.shifts,
          role_name:     a.shift_tasks?.title || null,
          // Round 3, Task 4: the task's own window, when set, is the "rostered" window a casual
          // worker's actual-hours entry pre-fills from — falls back to the shift's window below.
          task_start_time: a.shift_tasks?.start_time || null,
          task_end_time:   a.shift_tasks?.end_time || null,
        })));

        const { data: tsRows } = await supabase
          .from("timesheets")
          .select("timesheet_id, log_date, hours_worked, description, status, shift_id, evidence_path, evidence_name")
          .eq("staff_id", sid)
          .order("log_date", { ascending: false });

        if (!cancelled) {
          const map = {};
          for (const ts of (tsRows || [])) {
            const key = ts.shift_id != null ? `shift_${ts.shift_id}` : `date_${ts.log_date}`;
            map[key] = ts;
          }
          setTimesheets(map);
        }
      } catch (err) { console.error(err); showToast("Failed to load.", false); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function formKey(a) {
    return `${a.source}_${a.assignment_id}`;
  }

  // Pre-filled with the rostered TASK window (falling back to the shift's) so the common case
  // for a casual worker is one confirmation, not manual entry.
  function defaultFormFor(a) {
    const dur = shiftDuration(a.shift?.start_time, a.shift?.end_time);
    return {
      hours: dur > 0 ? String(dur) : "",
      startTime: (a.task_start_time || a.shift?.start_time || "").slice(0, 5),
      endTime:   (a.task_end_time || a.shift?.end_time || "").slice(0, 5),
      // Round 6, Task 3: defaults to 0, never a guess — an unset break means "none taken", not
      // "unknown". Never auto-extends startTime/endTime above either way.
      breakMinutes: "0",
      desc: "", file: null,
    };
  }

  function tsKey(a) {
    const sid = a.shift?.shift_id;
    return sid != null ? `shift_${sid}` : `date_${a.shift?.shift_date}`;
  }

  async function acknowledge(a) {
    try {
      const { error } = await supabase
        .from("task_assignments")
        .update({ acknowledged: true })
        .eq("assignment_id", a.assignment_id);
      if (error) throw error;
      setShifts(prev => prev.map(s =>
        s.assignment_id === a.assignment_id ? { ...s, acknowledged: true } : s
      ));

      if (a.shift?.branch_id) {
        api.post("/api/notifications/notify-my-managers", {
          type: "shift_acknowledged",
          title: "Shift Acknowledged",
          message: `${user?.full_name || "A staff member"} acknowledged ${a.role_name || "a task"} on ${a.shift?.shift_date}${a.shift?.title ? ` (${a.shift.title})` : ""}.`,
          related_entity: "task_assignments",
          related_id: a.shift?.shift_id,
        }).catch(() => {});
      }
    } catch (err) { console.error("Acknowledge failed:", err); showToast("Failed to acknowledge.", false); }
  }

  async function submitReport(a) {
    const d    = formData[formKey(a)] || {};
    const desc = (d.desc || "").trim();
    if (!desc) { showToast("Please describe what you did.", false); return; }

    const breakMinutes = Number(d.breakMinutes || 0);
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) { showToast("Break must be zero or a positive number.", false); return; }

    let hours = null;
    let spanMinutes = null;
    if (isCasual) {
      if (!d.startTime || !d.endTime) { showToast("Please enter both a start and end time.", false); return; }
      if (d.endTime <= d.startTime)   { showToast("End time must be after start time.", false); return; }
      const [sh, sm] = d.startTime.split(":").map(Number);
      const [eh, em] = d.endTime.split(":").map(Number);
      spanMinutes = (eh * 60 + em) - (sh * 60 + sm);
    } else {
      hours = parseFloat(d.hours || "0");
      if (!hours || hours <= 0) { showToast("Please enter valid hours.", false); return; }
      spanMinutes = hours * 60;
    }
    if (breakMinutes >= spanMinutes) { showToast("Break cannot be equal to or longer than the time worked.", false); return; }

    setSubmitting(formKey(a));
    try {
      const body = new FormData();
      body.append("log_date", a.shift?.shift_date || "");
      body.append("description", desc);
      body.append("break_minutes", String(breakMinutes));
      if (isCasual) {
        body.append("start_time", d.startTime);
        body.append("end_time", d.endTime);
      } else {
        body.append("hours_worked", String(hours));
      }
      if (a.shift?.shift_id != null) body.append("shift_id", String(a.shift.shift_id));
      if (d.file) body.append("evidence", d.file);

      const res = await api.post("/api/timesheets", body);
      if (!res.success) throw new Error(res.message);

      setTimesheets(prev => ({ ...prev, [tsKey(a)]: res.timesheet }));
      setReportModalFor(null);
      setFormData(prev => ({ ...prev, [formKey(a)]: { hours: "", breakMinutes: "0", desc: "", file: null } }));
      showToast("Report submitted!");
    } catch (err) { showToast(err.message || "Failed to submit.", false); }
    finally { setSubmitting(null); }
  }

  const isDone     = a => shiftEnded(a.shift?.shift_date, a.shift?.end_time);
  const isToday_   = a => a.shift?.shift_date === today;

  // Schedule: not yet ended
  const scheduleShifts = shifts
    .filter(a => a.shift && !isDone(a))
    .sort((a, b) => (a.shift.shift_date || "").localeCompare(b.shift.shift_date || "") ||
                    (a.shift.start_time || "").localeCompare(b.shift.start_time || ""));

  // Reports: ended, filtered by month + status
  const reportShifts = shifts
    .filter(a => {
      if (!a.shift || !isDone(a)) return false;
      if (!a.shift.shift_date.startsWith(month)) return false;
      if (reportFilter === "all") return true;
      const ts = timesheets[tsKey(a)];
      if (reportFilter === "none") return !ts;
      return ts?.status === reportFilter;
    })
    .sort((a, b) => (b.shift.shift_date || "").localeCompare(a.shift.shift_date || "") ||
                    (b.shift.start_time || "").localeCompare(a.shift.start_time || ""));

  const totalDone = shifts.filter(a => a.shift && isDone(a) && a.shift.shift_date.startsWith(month)).length;
  const pendingCount = shifts.filter(a => {
    if (!a.shift || !isDone(a)) return false;
    const ts = timesheets[tsKey(a)];
    return ts?.status === "pending";
  }).length;

  return (
    <Layout title="My Tasks">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        {/* Page header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#1E293B" }}>My Tasks</h2>
            <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
              {loading ? "Loading…" : `${scheduleShifts.length} upcoming · ${pendingCount > 0 ? `${pendingCount} pending review` : "0 pending"}`}
            </p>
          </div>

          {/* Tabs */}
          <div style={{ display:"flex", gap:"3px", background:"#F1F5F9", padding:"3px", borderRadius:"10px" }}>
            {[["schedule","Schedule",Calendar],["reports","Reports",FileText]].map(([t, label, Icon]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 18px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px",
                  fontWeight: tab===t ? "700" : "500",
                  background: tab===t ? "#FFF" : "transparent",
                  color:      tab===t ? "#1E293B" : "#64748B",
                  boxShadow:  tab===t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition:"all 0.15s" }}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (
          <ScheduleTab shifts={shifts} loading={loading} today={today} acknowledge={acknowledge} />
        )}

        {/* ── REPORTS TAB ── */}
        {tab === "reports" && (
          <ReportsTab
            shifts={reportShifts}
            allDoneCount={totalDone}
            loading={loading}
            timesheets={timesheets}
            tsKey={tsKey}
            formKey={formKey}
            onOpenReport={setReportModalFor}
            acknowledge={acknowledge}
            reportFilter={reportFilter}
            setReportFilter={setReportFilter}
            month={month}
            setMonth={setMonth}
          />
        )}

      </div>

      {reportModalFor && (
        <SubmitReportModal
          assignment={reportModalFor}
          existing={timesheets[tsKey(reportModalFor)]}
          isCasual={isCasual}
          form={formData[formKey(reportModalFor)] || defaultFormFor(reportModalFor)}
          // Merge against defaultFormFor, not {} — formData[key] is still undefined until the
          // FIRST onChange fires (the JSX line above only computes the pre-filled defaults for
          // display, it never writes them into state). Merging a patch like { desc } against {}
          // silently threw away the pre-filled startTime/endTime the instant a user typed
          // anything before touching the time fields — caught live: the "Actual time worked"
          // inputs visibly showed the rostered time, then reverted to blank the moment the
          // description was typed, so submitting used the (empty) fields shown just then.
          onChange={patch => setFormData(p => ({ ...p, [formKey(reportModalFor)]: { ...(p[formKey(reportModalFor)] || defaultFormFor(reportModalFor)), ...patch } }))}
          submitting={submitting === formKey(reportModalFor)}
          onSubmit={() => submitReport(reportModalFor)}
          onClose={() => setReportModalFor(null)}
        />
      )}

      {toast && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", zIndex:9999,
          background: toast.ok ? "#22C55E" : "#EF4444",
          color:"#FFF", padding:"12px 20px", borderRadius:"10px",
          fontSize:"14px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.15)",
          animation:"toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}

// ── Schedule Tab ──────────────────────────────────────────────────────────────
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function getWeekStartDate(d) {
  const date = new Date(d);
  const dow  = date.getDay(); // 0=Sun
  date.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
  date.setHours(0, 0, 0, 0);
  return date;
}

function fmtWeekRange(start) {
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const s = start.toLocaleDateString("en-SG", { month:"short", day:"numeric" });
  const e = end.toLocaleDateString("en-SG",   { month:"short", day:"numeric", year:"numeric" });
  return `${s} – ${e}`;
}

function ShiftWeekCalendar({ weekStart, shifts, onChipClick }) {
  const todayStr = toLocalDateStr(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", border:"1px solid #F1F5F9", borderRadius:"12px", overflow:"hidden" }}>
      {days.map((d, i) => {
        const dayStr    = toLocalDateStr(d);
        const isToday   = dayStr === todayStr;
        const dayShifts = (shifts || []).filter(a => a.shift?.shift_date === dayStr);
        return (
          <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", background: isToday ? "#EFF6FF" : "#FFF" }}>
            {/* Header */}
            <div style={{ padding:"10px 6px 8px", textAlign:"center", borderBottom:"1px solid #F1F5F9" }}>
              <p style={{ fontSize:"9px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"5px" }}>
                {DAY_LABELS[i]}
              </p>
              <div style={{ width:"28px", height:"28px", borderRadius:"50%", margin:"0 auto", background: isToday ? "#2563EB" : "transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
                <p style={{ fontSize:"13px", fontWeight: isToday ? "800" : "600", color: isToday ? "#FFF" : "#1E293B" }}>
                  {d.getDate()}
                </p>
              </div>
            </div>
            {/* Task chips */}
            <div style={{ padding:"5px 3px", minHeight:"60px", display:"flex", flexDirection:"column", gap:"3px" }}>
              {dayShifts.map(a => (
                <div key={a.assignment_id}
                  onClick={() => onChipClick && onChipClick(a)}
                  title={`${a.role_name || a.shift?.title || "Task"} · ${fmtTime(a.shift?.start_time)}–${fmtTime(a.shift?.end_time)}`}
                  style={{ borderLeft:"3px solid #7C3AED", background:"#EDE9FE", borderRadius:"0 5px 5px 0",
                    padding:"4px 6px", cursor:"pointer", transition:"background 0.1s", overflow:"hidden" }}
                  onMouseEnter={e => e.currentTarget.style.background="#DDD6FE"}
                  onMouseLeave={e => e.currentTarget.style.background="#EDE9FE"}>
                  <p style={{ fontSize:"10px", fontWeight:"700", color:"#4C1D95", whiteSpace:"nowrap",
                    overflow:"hidden", textOverflow:"ellipsis", lineHeight:"1.3" }}>
                    {a.role_name || a.shift?.title || "Task"}
                  </p>
                  <p style={{ fontSize:"9px", color:"#7C3AED", marginTop:"1px", opacity:0.85 }}>
                    {fmtTime(a.shift?.start_time)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleTab({ shifts, loading, today, acknowledge }) {
  const [weekStart,     setWeekStart]     = useState(() => getWeekStartDate(new Date()));
  const [selectedShift, setSelectedShift] = useState(null); // { shiftId, shiftMeta } for modal
  const [shiftTasks,    setShiftTasks]    = useState([]);
  const [loadingTasks,  setLoadingTasks]  = useState(false);

  async function handleChipClick(a) {
    const shiftId = a.shift?.shift_id;
    if (!shiftId) return;
    setSelectedShift(a.shift);
    setShiftTasks([]);
    setLoadingTasks(true);
    try {
      const { tasks } = await api.get(`/api/shifts/${shiftId}/tasks`);
      setShiftTasks(tasks || []);
    } catch (err) {
      console.error("Failed to load shift tasks:", err);
      setShiftTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }

  const weekStartStr = toLocalDateStr(weekStart);
  const weekEnd      = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const weekEndStr   = toLocalDateStr(weekEnd);

  const weekShifts = (shifts || [])
    .filter(a => { const d = a.shift?.shift_date; return d && d >= weekStartStr && d <= weekEndStr; })
    .sort((a,b) => (a.shift.shift_date).localeCompare(b.shift.shift_date) || (a.shift.start_time||"").localeCompare(b.shift.start_time||""));

  const weekGroups = {};
  for (const a of weekShifts) {
    const d = a.shift.shift_date;
    if (!weekGroups[d]) weekGroups[d] = [];
    weekGroups[d].push(a);
  }

  const navBtn = { background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"6px 10px", cursor:"pointer", display:"flex", alignItems:"center", color:"#475569" };

  if (loading) return <LoadingCards />;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>

      {/* ── Week strip calendar ── */}
      <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"16px 20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
          <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()-7); setWeekStart(d); }}>
            <ChevronLeft size={16}/>
          </button>
          <span style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B" }}>{fmtWeekRange(weekStart)}</span>
          <button style={navBtn} onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate()+7); setWeekStart(d); }}>
            <ChevronRight size={16}/>
          </button>
        </div>
        {loading ? <div style={{ height:"120px", background:"#F8FAFC", borderRadius:"12px" }}/> : <ShiftWeekCalendar weekStart={weekStart} shifts={shifts} onChipClick={handleChipClick} />}
      </div>

      {/* ── Task list for the week ── */}
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"14px" }}>
          <span style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>Tasks this week</span>
          <span style={{ fontSize:"12px", color:"#94A3B8" }}>· {weekShifts.length} task{weekShifts.length!==1?"s":""}</span>
        </div>

        {weekShifts.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"40px", textAlign:"center" }}>
            <Calendar size={28} color="#CBD5E1" style={{ margin:"0 auto 10px" }}/>
            <p style={{ fontSize:"14px", fontWeight:"600", color:"#64748B" }}>No tasks this week</p>
            <p style={{ fontSize:"12px", color:"#94A3B8", marginTop:"4px" }}>Use the arrows to navigate to other weeks.</p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
            {Object.entries(weekGroups).map(([date, items], gi) => {
              const isTodayGroup = date === today;
              const d = new Date(date + "T00:00:00");
              const dayLabel = isTodayGroup ? "Today" : d.toLocaleDateString("en-SG", { weekday:"long", day:"numeric", month:"long" });
              return (
                <div key={date} style={{ animation:`fadeUp 0.25s ease ${gi*0.05}s both` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                    <span style={{ fontSize:"13px", fontWeight:"700", color: isTodayGroup ? "#2563EB" : "#475569" }}>{dayLabel}</span>
                    {isTodayGroup && <span style={{ padding:"2px 8px", borderRadius:"100px", fontSize:"10px", fontWeight:"700", background:"#DBEAFE", color:"#1D4ED8" }}>Today</span>}
                    <div style={{ flex:1, height:"1px", background:"#F1F5F9" }}/>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                    {items.map(a => {
                      const s = a.shift;
                      const duration = shiftDuration(s.start_time, s.end_time);
                      const ended = shiftEnded(s.shift_date, s.end_time);
                      return (
                        <div key={`${a.source}_${a.assignment_id}`}
                          style={{ background:"#FFF", border:`1px solid ${isTodayGroup ? "#BFDBFE" : "#E2E8F0"}`,
                            borderRadius:"14px", padding:"16px 20px", display:"flex", alignItems:"center", gap:"16px",
                            opacity: ended ? 0.6 : 1 }}>
                          <DateBlock date={s.shift_date} highlight={isTodayGroup}/>
                          <div style={{ flex:1, minWidth:0 }}>
                            <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B" }}>{a.role_name || s.title || "Task"}</p>
                            {a.role_name && s.title && (
                              <p style={{ fontSize:"11px", color:"#94A3B8", fontWeight:"500", marginTop:"1px" }}>{s.title}</p>
                            )}
                            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginTop:"4px", flexWrap:"wrap" }}>
                              <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                                <Clock size={11} color="#CBD5E1"/>
                                <span style={{ fontSize:"12px", color:"#94A3B8" }}>
                                  {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                                  {duration > 0 && <span> · {fmtHours(duration)}</span>}
                                </span>
                              </div>
                              {s.branches?.name && (
                                <span style={{ fontSize:"11px", fontWeight:"600", color:"#2563EB", background:"#EFF6FF", padding:"2px 8px", borderRadius:"100px" }}>
                                  {s.branches.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px", flexShrink:0 }}>
                            <span style={{ padding:"3px 9px", borderRadius:"100px", fontSize:"10px", fontWeight:"700",
                              background: s.status==="published" ? "#DCFCE7" : "#F3F4F6",
                              color:      s.status==="published" ? "#166534" : "#6B7280" }}>
                              {s.status}
                            </span>
                            {!a.acknowledged && s.status==="published" && !ended && (
                              <button onClick={() => acknowledge(a)}
                                style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px",
                                  background:"#F59E0B", color:"#FFF", border:"none", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                                <CheckCircle size={13}/>
                                Acknowledge
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedShift && (
        <ShiftTasksModal
          shift={selectedShift}
          tasks={shiftTasks}
          loading={loadingTasks}
          onClose={() => setSelectedShift(null)}
        />
      )}
    </div>
  );
}

// ── Shift Tasks Modal ─────────────────────────────────────────────────────────
const DIFF_STYLES = {
  junior: { color:"#166534", bg:"#DCFCE7" },
  mid:    { color:"#1D4ED8", bg:"#DBEAFE" },
  senior: { color:"#92400E", bg:"#FEF3C7" },
  expert: { color:"#5B21B6", bg:"#EDE9FE" },
};

function ShiftTasksModal({ shift, tasks, loading, onClose }) {
  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1000 }} />

      {/* Panel */}
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1001,
        background:"#FFF", borderRadius:"20px", width:"min(540px,92vw)", maxHeight:"82vh",
        overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #F1F5F9", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"18px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" }}>
                {shift.title || "Shift"}
              </p>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
                <span style={{ fontSize:"13px", color:"#64748B", display:"flex", alignItems:"center", gap:"4px" }}>
                  <Calendar size={12} color="#94A3B8" />
                  {fmtFullDate(shift.shift_date)}
                </span>
                <span style={{ fontSize:"13px", color:"#64748B", display:"flex", alignItems:"center", gap:"4px" }}>
                  <Clock size={12} color="#94A3B8" />
                  {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                </span>
                {shift.branches?.name && (
                  <span style={{ fontSize:"11px", fontWeight:"700", color:"#2563EB", background:"#EFF6FF", padding:"2px 9px", borderRadius:"100px" }}>
                    {shift.branches.name}
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose}
              style={{ background:"#F1F5F9", border:"none", borderRadius:"8px", width:"32px", height:"32px",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                color:"#64748B", flexShrink:0 }}>
              <X size={15} />
            </button>
          </div>
          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", textTransform:"uppercase",
            letterSpacing:"0.07em", marginTop:"14px" }}>
            All Tasks · {loading ? "…" : tasks.length}
          </p>
        </div>

        {/* Task list */}
        <div style={{ overflowY:"auto", padding:"14px 24px 20px", flex:1 }}>
          {loading ? (
            <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
              {[1,2,3].map(i => <Shimmer key={i} h="68px" r="12px" />)}
            </div>
          ) : tasks.length === 0 ? (
            <div style={{ textAlign:"center", padding:"40px 0" }}>
              <Tag size={28} color="#CBD5E1" style={{ margin:"0 auto 10px" }} />
              <p style={{ fontSize:"14px", fontWeight:"600", color:"#64748B" }}>No tasks found</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {tasks.map((t, idx) => {
                const diff      = DIFF_STYLES[t.difficulty];
                const assignees = (t.task_assignments || [])
                  .map(ta => ta.staff?.users?.full_name)
                  .filter(Boolean);
                const timeStr = (t.start_time && t.end_time)
                  ? `${fmtApiTime(t.start_time)} – ${fmtApiTime(t.end_time)}`
                  : null;
                const initials = assignees[0]
                  ? assignees[0].split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()
                  : null;
                return (
                  <div key={t.task_id}
                    style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"12px",
                      padding:"13px 16px", display:"flex", flexDirection:"column", gap:"8px" }}>

                    {/* Title */}
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", lineHeight:"1.35" }}>
                      {t.title}
                    </p>

                    {/* Meta row */}
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"8px" }}>
                      {/* Left: badges + time */}
                      <div style={{ display:"flex", alignItems:"center", gap:"5px", flexWrap:"wrap", minWidth:0 }}>
                        {t.skills?.name && (
                          <span style={{ fontSize:"10px", fontWeight:"600", color:"#64748B",
                            background:"#F1F5F9", padding:"2px 8px", borderRadius:"100px", whiteSpace:"nowrap" }}>
                            {t.skills.name}
                          </span>
                        )}
                        {diff && (
                          <span style={{ fontSize:"10px", fontWeight:"700", color:diff.color,
                            background:diff.bg, padding:"2px 8px", borderRadius:"100px", textTransform:"capitalize", whiteSpace:"nowrap" }}>
                            {t.difficulty}
                          </span>
                        )}
                        {timeStr && (
                          <span style={{ fontSize:"10px", color:"#94A3B8", display:"flex", alignItems:"center",
                            gap:"3px", whiteSpace:"nowrap" }}>
                            <Clock size={10} color="#CBD5E1"/>
                            {timeStr}
                          </span>
                        )}
                      </div>

                      {/* Right: assignee */}
                      {assignees.length > 0 ? (
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                          <div style={{ width:"22px", height:"22px", borderRadius:"50%", background:"#EEF2FF",
                            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontSize:"8px", fontWeight:"800", color:"#4338CA" }}>{initials}</span>
                          </div>
                          <span style={{ fontSize:"12px", fontWeight:"600", color:"#334155", whiteSpace:"nowrap" }}>
                            {assignees[0]}
                            {assignees.length > 1 && <span style={{ color:"#94A3B8", fontWeight:"500" }}> +{assignees.length-1}</span>}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize:"11px", color:"#CBD5E1", fontWeight:"500",
                          border:"1px dashed #E2E8F0", padding:"2px 10px", borderRadius:"100px", flexShrink:0 }}>
                          Unassigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ shifts, allDoneCount, loading, timesheets, tsKey, formKey, onOpenReport, reportFilter, setReportFilter, month, setMonth, acknowledge }) {

  const STATUS_FILTERS = [
    ["all",      "All",           null,       null      ],
    ["none",     "Not Submitted", "#F1F5F9",  "#475569" ],
    ["pending",  "Pending",       "#FEF3C7",  "#92400E" ],
    ["approved", "Approved",      "#DCFCE7",  "#166534" ],
    ["rejected", "Rejected",      "#FEE2E2",  "#991B1B" ],
  ];

  return (
    <div>
      {/* Controls row */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px", marginBottom:"16px", flexWrap:"wrap" }}>
        {/* Month navigation */}
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <button onClick={() => setMonth(prevMonth(month))}
            style={{ width:"30px", height:"30px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#FFF", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", minWidth:"130px", textAlign:"center" }}>
            {monthLabel(month)}
          </span>
          <button onClick={() => setMonth(nextMonth(month))}
            style={{ width:"30px", height:"30px", borderRadius:"8px", border:"1px solid #E2E8F0", background:"#FFF", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"#64748B" }}>
            <ChevronRight size={15} />
          </button>
        </div>
        <span style={{ fontSize:"12px", color:"#94A3B8" }}>{shifts.length} of {allDoneCount} tasks</span>
      </div>

      {/* Status filter pills */}
      <div style={{ display:"flex", gap:"6px", marginBottom:"18px", flexWrap:"wrap" }}>
        {STATUS_FILTERS.map(([val, label, bg, color]) => {
          const active = reportFilter === val;
          return (
            <button key={val} onClick={() => setReportFilter(val)}
              style={{ padding:"6px 16px", borderRadius:"100px", border: active ? "none" : "1.5px solid #E2E8F0",
                background: active ? (bg || "#1E293B") : "#FFF",
                color:      active ? (color || "#FFF")  : "#64748B",
                fontSize:"13px", fontWeight:"600", cursor:"pointer", transition:"all 0.15s" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Cards */}
      {loading ? <LoadingCards /> : shifts.length === 0 ? (
        <EmptyState icon={<FileText size={40} color="#CBD5E1" />}
          title="No tasks found"
          sub={reportFilter === "none" ? "All tasks have been reported — great job!" : `No ${reportFilter === "all" ? "" : reportFilter} reports for this month.`} />
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
          {shifts.map((a, i) => {
            const s       = a.shift;
            const ts      = timesheets[tsKey(a)];
            const tsMeta  = ts ? REPORT_STATUS[ts.status] : null;
            const duration = shiftDuration(s.start_time, s.end_time);

            return (
              <div key={`${a.source}_${a.assignment_id}`} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", overflow:"hidden",
                animation:`fadeUp 0.25s ease ${i*0.04}s both` }}>

                {/* Card body */}
                <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px" }}>
                  <DateBlock date={s.shift_date} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>{a.role_name || s.title || "Task"}</p>
                    {a.role_name && s.title && (
                      <p style={{ fontSize:"11px", color:"#94A3B8", fontWeight:"500", marginTop:"1px" }}>{s.title}</p>
                    )}
                    <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"4px" }}>
                      <Clock size={11} color="#CBD5E1" />
                      <span style={{ fontSize:"12px", color:"#94A3B8" }}>
                        {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                        {duration > 0 && <span> · {fmtHours(duration)}</span>}
                      </span>
                    </div>
                    {!a.acknowledged && (
                      <button onClick={() => acknowledge(a)}
                        style={{ display:"inline-flex", alignItems:"center", gap:"5px", marginTop:"8px", padding:"5px 12px", borderRadius:"7px",
                          background:"#F59E0B", color:"#FFF", border:"none", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}>
                        <CheckCircle size={12}/>
                        Acknowledge
                      </button>
                    )}
                  </div>

                  {/* Right side */}
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px", flexShrink:0 }}>
                    {ts ? (
                      /* Already submitted */
                      <span style={{ padding:"4px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"700",
                        background: tsMeta?.bg, color: tsMeta?.color }}>
                        {tsMeta?.label}
                      </span>
                    ) : (
                      /* Not submitted */
                      <button onClick={() => onOpenReport(a)}
                        style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 16px", borderRadius:"9px",
                          border:"none", background:"#2563EB", color:"#FFF",
                          fontSize:"12px", fontWeight:"700", cursor:"pointer", transition:"all 0.15s" }}>
                        <FileText size={13} />
                        Submit Report
                      </button>
                    )}
                  </div>
                </div>

                {/* Submitted report summary */}
                {ts && (
                  <div style={{ padding:"12px 20px", borderTop:"1px solid #F8FAFC", background:"#FAFAFA",
                    display:"flex", alignItems:"flex-start", gap:"10px", flexWrap:"wrap" }}>
                    {tsMeta && <tsMeta.icon size={14} color={tsMeta.color} style={{ marginTop:"1px", flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <span style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B" }}>{fmtHours(parseFloat(ts.hours_worked))} reported</span>
                      {ts.description && (
                        <p style={{ fontSize:"12px", color:"#64748B", marginTop:"2px" }}>{ts.description}</p>
                      )}
                    </div>
                    {ts.status === "rejected" && (
                      <button onClick={() => onOpenReport(a)}
                        style={{ padding:"5px 14px", borderRadius:"7px", border:"1.5px solid #FECACA",
                          background:"#FFF5F5", fontSize:"12px", fontWeight:"700", color:"#EF4444", cursor:"pointer", flexShrink:0 }}>
                        Resubmit
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Submit Report Modal ────────────────────────────────────────────────────────
function SubmitReportModal({ assignment: a, existing, form, onChange, submitting, onSubmit, onClose, isCasual }) {
  const s = a.shift;
  const isResubmit = existing?.status === "rejected";
  const fileInputId = "report-evidence-input";

  return createPortal(
    <>
      <div onClick={onClose}
        style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:1000 }} />

      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:1001,
        background:"#FFF", borderRadius:"20px", width:"min(480px,92vw)", maxHeight:"88vh",
        overflow:"hidden", boxShadow:"0 24px 64px rgba(0,0,0,0.18)", display:"flex", flexDirection:"column" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px 16px", borderBottom:"1px solid #F1F5F9", flexShrink:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" }}>
            <div style={{ minWidth:0 }}>
              <p style={{ fontSize:"16px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" }}>
                {isResubmit ? "Resubmit Report" : "Submit Work Report"}
              </p>
              <p style={{ fontSize:"13px", color:"#64748B" }}>{a.role_name || s?.title || "Task"}</p>
              <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap", marginTop:"8px" }}>
                <span style={{ fontSize:"12px", color:"#94A3B8", display:"flex", alignItems:"center", gap:"4px" }}>
                  <Calendar size={12} color="#94A3B8" />
                  {fmtFullDate(s?.shift_date)}
                </span>
                <span style={{ fontSize:"12px", color:"#94A3B8", display:"flex", alignItems:"center", gap:"4px" }}>
                  <Clock size={12} color="#94A3B8" />
                  {fmtTime(s?.start_time)} – {fmtTime(s?.end_time)}
                </span>
              </div>
            </div>
            <button onClick={onClose}
              style={{ background:"#F1F5F9", border:"none", borderRadius:"8px", width:"32px", height:"32px",
                cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                color:"#64748B", flexShrink:0 }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Form */}
        <div style={{ padding:"20px 24px", overflowY:"auto", flex:1 }}>
          {isCasual ? (
            <div style={{ marginBottom:"16px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"6px", letterSpacing:"0.05em" }}>ACTUAL TIME WORKED</label>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <input type="time" value={form.startTime || ""}
                  onChange={e => onChange({ startTime: e.target.value })}
                  style={{ padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px",
                    color:"#1E293B", outline:"none", background:"#FFF", boxSizing:"border-box" }} />
                <span style={{ color:"#94A3B8" }}>–</span>
                <input type="time" value={form.endTime || ""}
                  onChange={e => onChange({ endTime: e.target.value })}
                  style={{ padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px",
                    color:"#1E293B", outline:"none", background:"#FFF", boxSizing:"border-box" }} />
              </div>
              <p style={{ fontSize:"11px", color:"#94A3B8", marginTop:"6px" }}>Pre-filled with your rostered time — change it if you actually worked different hours.</p>
            </div>
          ) : (
            <div style={{ marginBottom:"16px" }}>
              <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"6px", letterSpacing:"0.05em" }}>HOURS WORKED</label>
              <input type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 6"
                value={form.hours}
                onChange={e => onChange({ hours: e.target.value })}
                style={{ padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px",
                  color:"#1E293B", outline:"none", background:"#FFF", width:"120px", boxSizing:"border-box" }} />
            </div>
          )}

          {/* Round 6, Task 3 — same input style as HOURS WORKED above: a number input, plus
              preset pills for the common cases. Regular staff get this too (same shared form
              component), measured against their entered hours instead of a start/end span. */}
          <div style={{ marginBottom:"16px" }}>
            <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"6px", letterSpacing:"0.05em" }}>BREAK (MINUTES)</label>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
              {[0, 15, 30, 45, 60].map(m => (
                <button key={m} type="button" onClick={() => onChange({ breakMinutes: String(m) })}
                  style={{
                    padding:"6px 12px", borderRadius:"100px", fontSize:"13px", fontWeight:"700", cursor:"pointer",
                    border: `1.5px solid ${String(m) === String(form.breakMinutes) ? "#1E293B" : "#E2E8F0"}`,
                    background: String(m) === String(form.breakMinutes) ? "#1E293B" : "#FFF",
                    color: String(m) === String(form.breakMinutes) ? "#FFF" : "#64748B",
                  }}>
                  {m === 0 ? "None" : `${m}m`}
                </button>
              ))}
              <input type="number" min="0" step="5" placeholder="Custom"
                value={[0, 15, 30, 45, 60].includes(Number(form.breakMinutes)) ? "" : (form.breakMinutes ?? "")}
                onChange={e => onChange({ breakMinutes: e.target.value })}
                style={{ padding:"6px 10px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"13px",
                  color:"#1E293B", outline:"none", background:"#FFF", width:"80px", boxSizing:"border-box" }} />
            </div>
          </div>

          <div style={{ marginBottom:"16px" }}>
            <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"6px", letterSpacing:"0.05em" }}>WHAT DID YOU WORK ON?</label>
            <textarea rows={3} placeholder="Describe what you did…"
              value={form.desc}
              onChange={e => onChange({ desc: e.target.value })}
              style={{ padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px",
                color:"#1E293B", outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box", resize:"vertical", fontFamily:"inherit" }} />
          </div>

          <div>
            <label style={{ display:"block", fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"6px", letterSpacing:"0.05em" }}>
              PROOF OF EVIDENCE <span style={{ fontWeight:"500", textTransform:"none", letterSpacing:"normal" }}>(optional)</span>
            </label>
            <input id={fileInputId} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display:"none" }}
              onChange={e => onChange({ file: e.target.files?.[0] || null })} />
            {form.file ? (
              <div style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", background:"#F8FAFC" }}>
                <Paperclip size={14} color="#64748B" style={{ flexShrink:0 }} />
                <span style={{ fontSize:"13px", color:"#1E293B", flex:1, minWidth:0, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{form.file.name}</span>
                <button onClick={() => onChange({ file: null })}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", display:"flex", flexShrink:0 }}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label htmlFor={fileInputId}
                style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", padding:"14px 12px",
                  border:"1.5px dashed #D8D5CE", borderRadius:"9px", cursor:"pointer", color:"#64748B", fontSize:"13px", fontWeight:"600" }}>
                <Paperclip size={14} />
                Attach an image or file
              </label>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid #F1F5F9", display:"flex", gap:"10px", justifyContent:"flex-end", flexShrink:0 }}>
          <button onClick={onClose}
            style={{ padding:"9px 18px", borderRadius:"9px", background:"#F1F5F9", color:"#64748B",
              border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={onSubmit} disabled={submitting}
            style={{ padding:"9px 20px", borderRadius:"9px", background:"#2563EB", color:"#FFF", border:"none",
              fontSize:"13px", fontWeight:"700", cursor: submitting ? "not-allowed":"pointer", opacity: submitting ? 0.7:1 }}>
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function LoadingCards() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      {Array.from({length:3}).map((_,i) => (
        <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"18px 20px",
          display:"flex", gap:"14px", alignItems:"center" }}>
          <Shimmer w="50px" h="54px" r="10px" />
          <div style={{ flex:1 }}>
            <Shimmer w="160px" h="14px" r="6px" />
            <div style={{ marginTop:"8px" }}><Shimmer w="110px" h="11px" r="5px" /></div>
          </div>
          <Shimmer w="100px" h="32px" r="8px" />
        </div>
      ))}
    </div>
  );
}
function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"64px 40px", textAlign:"center" }}>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:"14px" }}>{icon}</div>
      <p style={{ fontSize:"16px", fontWeight:"700", color:"#1E293B", marginBottom:"6px" }}>{title}</p>
      <p style={{ fontSize:"13px", color:"#94A3B8" }}>{sub}</p>
    </div>
  );
}
