import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";
import {
  Calendar, Clock, ChevronDown, ChevronUp, FileText,
  CheckCircle, AlertCircle, ChevronLeft, ChevronRight, SmilePlus
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
function fmtTime(t) { return t?.slice(0, 5) || "—"; }
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

  const [staffId,    setStaffId]    = useState(null);
  const [shifts,     setShifts]     = useState([]);
  const [timesheets, setTimesheets] = useState({});
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState("schedule"); // "schedule" | "reports"
  const [openForm,   setOpenForm]   = useState({});
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

  const today = now.toISOString().split("T")[0];

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

        const { data: assignments } = await supabase
          .from("shift_assignments")
          .select(`assignment_id, status, acknowledged,
            shifts ( shift_id, title, shift_date, start_time, end_time, status ),
            shift_roles ( role_name )`)
          .eq("staff_id", sid)
          .order("shift_id", { ascending: false });

        if (cancelled) return;
        setShifts((assignments || []).map(a => ({
          assignment_id: a.assignment_id,
          status:        a.status,
          acknowledged:  a.acknowledged,
          shift:         a.shifts,
          role_name:     a.shift_roles?.role_name || null,
        })));

        const { data: tsRows } = await supabase
          .from("timesheets")
          .select("timesheet_id, log_date, hours_worked, description, status, shift_id")
          .eq("staff_id", sid)
          .is("task_id", null)
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

  function tsKey(a) {
    const sid = a.shift?.shift_id;
    return sid != null ? `shift_${sid}` : `date_${a.shift?.shift_date}`;
  }

  async function acknowledge(a) {
    try {
      const { error } = await supabase
        .from("shift_assignments")
        .update({ acknowledged: true })
        .eq("assignment_id", a.assignment_id);
      if (error) throw error;
      setShifts(prev => prev.map(s =>
        s.assignment_id === a.assignment_id ? { ...s, acknowledged: true } : s
      ));
    } catch { showToast("Failed to acknowledge.", false); }
  }

  async function submitReport(a) {
    const d     = formData[a.assignment_id] || {};
    const hours = parseFloat(d.hours || "0");
    const desc  = (d.desc || "").trim();
    if (!hours || hours <= 0) { showToast("Please enter valid hours.", false); return; }
    if (!desc)                { showToast("Please describe what you did.", false); return; }

    setSubmitting(a.assignment_id);
    try {
      const { data: inserted, error } = await supabase
        .from("timesheets")
        .insert({ staff_id: staffId, log_date: a.shift?.shift_date, hours_worked: hours,
          description: desc, status: "pending", shift_id: a.shift?.shift_id ?? null })
        .select().single();
      if (error) throw error;

      setTimesheets(prev => ({ ...prev, [tsKey(a)]: inserted }));
      setOpenForm(prev => ({ ...prev, [a.assignment_id]: false }));
      setFormData(prev => ({ ...prev, [a.assignment_id]: { hours: "", desc: "" } }));
      showToast("Report submitted!");
    } catch { showToast("Failed to submit.", false); }
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
            {[["schedule","📅  Schedule"],["reports","📋  Reports"]].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:"8px 20px", borderRadius:"8px", border:"none", cursor:"pointer", fontSize:"13px",
                  fontWeight: tab===t ? "700" : "500",
                  background: tab===t ? "#FFF" : "transparent",
                  color:      tab===t ? "#1E293B" : "#64748B",
                  boxShadow:  tab===t ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  transition:"all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── SCHEDULE TAB ── */}
        {tab === "schedule" && (
          <ScheduleTab shifts={scheduleShifts} loading={loading} today={today} acknowledge={acknowledge} />
        )}

        {/* ── REPORTS TAB ── */}
        {tab === "reports" && (
          <ReportsTab
            shifts={reportShifts}
            allDoneCount={totalDone}
            loading={loading}
            timesheets={timesheets}
            tsKey={tsKey}
            openForm={openForm}
            setOpenForm={setOpenForm}
            formData={formData}
            setFormData={setFormData}
            submitting={submitting}
            submitReport={submitReport}
            reportFilter={reportFilter}
            setReportFilter={setReportFilter}
            month={month}
            setMonth={setMonth}
          />
        )}

      </div>

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
function ScheduleTab({ shifts, loading, today, acknowledge }) {
  if (loading) return <LoadingCards />;
  if (shifts.length === 0) return (
    <EmptyState icon={<Calendar size={40} color="#CBD5E1" />}
      title="No upcoming shifts" sub="Your manager will assign shifts when scheduled." />
  );

  // Group by date
  const groups = {};
  for (const a of shifts) {
    const d = a.shift.shift_date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(a);
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      {Object.entries(groups).map(([date, items], gi) => {
        const isToday = date === today;
        const d = new Date(date + "T00:00:00");
        const dayLabel = isToday ? "Today" : d.toLocaleDateString("en-SG", { weekday:"long", day:"numeric", month:"long" });
        return (
          <div key={date} style={{ animation:`fadeUp 0.3s ease ${gi*0.06}s both` }}>
            {/* Date heading */}
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
              <span style={{ fontSize:"13px", fontWeight:"700",
                color: isToday ? "#2563EB" : "#475569" }}>{dayLabel}</span>
              {isToday && <span style={{ padding:"2px 8px", borderRadius:"100px", fontSize:"10px", fontWeight:"700", background:"#DBEAFE", color:"#1D4ED8" }}>Today</span>}
              <div style={{ flex:1, height:"1px", background:"#F1F5F9" }} />
            </div>
            {/* Shift cards */}
            <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
              {items.map(a => {
                const s = a.shift;
                const duration = shiftDuration(s.start_time, s.end_time);
                return (
                  <div key={a.assignment_id} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"16px 20px",
                    display:"flex", alignItems:"center", gap:"16px" }}>
                    <DateBlock date={s.shift_date} highlight={isToday} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:"15px", fontWeight:"700", color:"#1E293B" }}>{s.title || "Shift"}</p>
                      <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"3px" }}>
                        <Clock size={12} color="#94A3B8" />
                        <span style={{ fontSize:"12px", color:"#64748B" }}>
                          {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                          {duration > 0 && <span style={{ color:"#CBD5E1" }}> · {fmtHours(duration)}</span>}
                        </span>
                      </div>
                      {a.role_name && <p style={{ fontSize:"11px", color:"#94A3B8", marginTop:"2px" }}>{a.role_name}</p>}
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"4px", flexShrink:0 }}>
                      <span style={{ padding:"3px 9px", borderRadius:"100px", fontSize:"10px", fontWeight:"700",
                        background: s.status==="published" ? "#DCFCE7" : "#F3F4F6",
                        color:      s.status==="published" ? "#166534" : "#6B7280" }}>
                        {s.status}
                      </span>
                      {!a.acknowledged && s.status==="published" && (
                        <button onClick={() => acknowledge(a)}
                          style={{ fontSize:"11px", fontWeight:"700", color:"#D97706", background:"#FFFBEB", border:"1.5px solid #FDE68A", padding:"3px 10px", borderRadius:"100px", cursor:"pointer" }}>
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
  );
}

// ── Reports Tab ───────────────────────────────────────────────────────────────
function ReportsTab({ shifts, allDoneCount, loading, timesheets, tsKey, openForm, setOpenForm, formData, setFormData, submitting, submitReport, reportFilter, setReportFilter, month, setMonth }) {

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
            const formOpen = !!openForm[a.assignment_id];
            const form     = formData[a.assignment_id] || { hours: duration > 0 ? String(duration) : "", desc: "" };
            const isSub    = submitting === a.assignment_id;

            return (
              <div key={a.assignment_id} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", overflow:"hidden",
                animation:`fadeUp 0.25s ease ${i*0.04}s both` }}>

                {/* Card body */}
                <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px" }}>
                  <DateBlock date={s.shift_date} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>{s.title || "Shift"}</p>
                    <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"2px" }}>
                      <Clock size={11} color="#94A3B8" />
                      <span style={{ fontSize:"12px", color:"#64748B" }}>
                        {fmtTime(s.start_time)} – {fmtTime(s.end_time)}
                        {duration > 0 && <span style={{ color:"#CBD5E1" }}> · {fmtHours(duration)}</span>}
                      </span>
                    </div>
                    {a.role_name && <p style={{ fontSize:"11px", color:"#94A3B8", marginTop:"1px" }}>{a.role_name}</p>}
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
                      <button onClick={() => setOpenForm(p => ({ ...p, [a.assignment_id]: !formOpen }))}
                        style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 16px", borderRadius:"9px",
                          border:"none", background:"#2563EB", color:"#FFF",
                          fontSize:"12px", fontWeight:"700", cursor:"pointer", transition:"all 0.15s" }}>
                        <FileText size={13} />
                        Submit Report
                        {formOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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
                      <button onClick={() => setOpenForm(p => ({ ...p, [a.assignment_id]: !formOpen }))}
                        style={{ padding:"5px 14px", borderRadius:"7px", border:"1.5px solid #FECACA",
                          background:"#FFF5F5", fontSize:"12px", fontWeight:"700", color:"#EF4444", cursor:"pointer", flexShrink:0 }}>
                        {formOpen ? "Cancel" : "Resubmit"}
                      </button>
                    )}
                  </div>
                )}

                {/* Inline submission form */}
                {formOpen && (
                  <div style={{ borderTop:"1px solid #E2E8F0", background:"#F8FAFC", padding:"16px 20px" }}>
                    <p style={{ fontSize:"12px", fontWeight:"700", color:"#1E293B", marginBottom:"12px" }}>
                      {ts?.status === "rejected" ? "Resubmit Report" : "Submit Work Report"}
                    </p>
                    <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", alignItems:"flex-end" }}>
                      <div>
                        <label style={{ display:"block", fontSize:"10px", fontWeight:"700", color:"#94A3B8", marginBottom:"4px", letterSpacing:"0.05em" }}>HOURS WORKED</label>
                        <input type="number" min="0.5" max="24" step="0.5" placeholder="e.g. 6"
                          value={form.hours}
                          onChange={e => setFormData(p => ({ ...p, [a.assignment_id]: { ...form, hours: e.target.value } }))}
                          style={{ padding:"8px 10px", border:"1.5px solid #E2E8F0", borderRadius:"8px", fontSize:"13px",
                            color:"#1E293B", outline:"none", background:"#FFF", width:"90px", boxSizing:"border-box" }} />
                      </div>
                      <div style={{ flex:1, minWidth:"180px" }}>
                        <label style={{ display:"block", fontSize:"10px", fontWeight:"700", color:"#94A3B8", marginBottom:"4px", letterSpacing:"0.05em" }}>WHAT DID YOU WORK ON?</label>
                        <input type="text" placeholder="Describe what you did…"
                          value={form.desc}
                          onChange={e => setFormData(p => ({ ...p, [a.assignment_id]: { ...form, desc: e.target.value } }))}
                          style={{ padding:"8px 10px", border:"1.5px solid #E2E8F0", borderRadius:"8px", fontSize:"13px",
                            color:"#1E293B", outline:"none", background:"#FFF", width:"100%", boxSizing:"border-box" }} />
                      </div>
                      <div style={{ display:"flex", gap:"6px" }}>
                        <button onClick={() => submitReport(a)} disabled={isSub}
                          style={{ padding:"8px 18px", borderRadius:"8px", background:"#2563EB", color:"#FFF", border:"none",
                            fontSize:"13px", fontWeight:"700", cursor: isSub ? "not-allowed":"pointer", opacity: isSub ? 0.7:1 }}>
                          {isSub ? "Submitting…" : "Submit"}
                        </button>
                        <button onClick={() => setOpenForm(p => ({ ...p, [a.assignment_id]: false }))}
                          style={{ padding:"8px 12px", borderRadius:"8px", background:"#F1F5F9", color:"#64748B",
                            border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
                          Cancel
                        </button>
                      </div>
                    </div>
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
