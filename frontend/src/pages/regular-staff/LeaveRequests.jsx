import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { notifyUsers, getBranchManagerUserIds } from "../../lib/notify";
import StaffLayout from "../../components/layout/StaffLayout";
import { TreePalm, ChevronLeft, ChevronRight, X } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-leave-styles")) {
  const style = document.createElement("style");
  style.id = "staff-leave-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn { 0%{opacity:0;transform:scale(0.97)} 60%{transform:scale(1.01)} 100%{opacity:1;transform:scale(1)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .leave-day-cell:hover { border-color: #93C5FD !important; }
    .offday-day-cell:hover { border-color: #A78BFA !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const LEAVE_TYPES = ["annual", "medical", "emergency"];
const TYPE_COLORS = {
  annual:    { bg: "#DBEAFE", color: "#1D4ED8", border: "#BFDBFE", bar: "#2563EB" },
  medical:   { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0", bar: "#16A34A" },
  emergency: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA", bar: "#DC2626" },
};
const WEEK_HEADERS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildMonthCells(year, month) {
  const firstDay   = new Date(year, month - 1, 1);
  const daysInMo   = new Date(year, month, 0).getDate();
  const startDow   = (firstDay.getDay() + 6) % 7; // Mon=0, Sun=6
  const cells      = [];
  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, -i);
    cells.push({ dateStr: toDateStr(d), inMonth: false });
  }
  for (let d = 1; d <= daysInMo; d++) {
    cells.push({ dateStr: `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const prev = new Date(cells[cells.length - 1].dateStr + "T00:00:00");
    prev.setDate(prev.getDate() + 1);
    cells.push({ dateStr: toDateStr(prev), inMonth: false });
  }
  return cells;
}

function prevMonthOf(year, month) { return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }; }
function nextMonthOf(year, month) { return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }; }
function monthLabel(year, month) { return new Date(year, month - 1, 1).toLocaleDateString("en-SG", { month: "long", year: "numeric" }); }

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}
function getDays(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end + "T00:00:00") - new Date(start + "T00:00:00")) / 86400000) + 1;
}
function leaveBadge(status) {
  const map = { pending: { background: "#FFFBEB", color: "#D97706" }, approved: { background: "#DCFCE7", color: "#166534" }, rejected: { background: "#FEE2E2", color: "#991B1B" } };
  return map[status] || map.pending;
}

// ── Leave Month Calendar (range selection) ────────────────────────────────────
function LeaveMonthCalendar({ year, month, rangeStart, rangeEnd, hoverDate, onDayClick, onDayHover, onDayLeave, leaveRequests, shifts }) {
  const todayStr    = toDateStr(new Date());
  const cells       = buildMonthCells(year, month);
  const lo          = rangeStart && (rangeEnd || hoverDate) ? [rangeStart, rangeEnd || hoverDate].sort()[0] : null;
  const hi          = rangeStart && (rangeEnd || hoverDate) ? [rangeStart, rangeEnd || hoverDate].sort()[1] : null;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "5px" }}>
        {WEEK_HEADERS.map(h => (
          <div key={h} style={{ textAlign: "center", fontSize: "17px", fontWeight: "700", color: "#94A3B8", padding: "3px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
        {cells.map(({ dateStr, inMonth }) => {
          const isToday  = dateStr === todayStr;
          const isPast   = dateStr < todayStr;
          const isStart  = dateStr === rangeStart;
          const isEnd    = dateStr === rangeEnd;
          const inRange  = lo && hi && dateStr > lo && dateStr < hi;
          const isEndpoint = isStart || isEnd;

          const leaveHits = leaveRequests.filter(r => r.start_date <= dateStr && r.end_date >= dateStr && r.status !== "rejected");
          const shiftHit  = shifts.some(s => s.shifts?.shift_date === dateStr);

          let cellBg     = inMonth && !isPast ? "#FFF" : "#F8FAFC";
          let textColor  = inMonth ? (isPast ? "#CBD5E1" : "#1E293B") : "#CBD5E1";
          let borderCol  = isToday ? "#BFDBFE" : "#E2E8F0";
          let fw         = isToday ? "800" : "600";

          if (isEndpoint) { cellBg = "#2563EB"; textColor = "#FFF"; borderCol = "#1D4ED8"; }
          else if (inRange) { cellBg = "#DBEAFE"; borderCol = "#93C5FD"; }

          const clickable = inMonth && !isPast;

          return (
            <div key={dateStr}
              className={clickable ? "leave-day-cell" : ""}
              onClick={() => clickable && onDayClick(dateStr)}
              onMouseEnter={() => clickable && onDayHover && onDayHover(dateStr)}
              onMouseLeave={() => onDayLeave && onDayLeave()}
              style={{ minHeight: "58px", background: cellBg, border: `1.5px solid ${borderCol}`, borderRadius: "8px", cursor: clickable ? "pointer" : "default", opacity: !inMonth ? 0.35 : 1, transition: "border-color 0.1s, background 0.1s", padding: "5px 3px", boxSizing: "border-box" }}>
              <p style={{ fontSize: "20px", fontWeight: fw, color: textColor, textAlign: "center", marginBottom: "4px" }}>
                {new Date(dateStr + "T00:00:00").getDate()}
              </p>
              {shiftHit && inMonth && (
                <div style={{ height: "3px", borderRadius: "2px", background: isEndpoint ? "rgba(255,255,255,0.5)" : "#7C3AED", marginBottom: "2px" }} />
              )}
              {leaveHits.slice(0, 2).map((r, i) => {
                const bar = TYPE_COLORS[r.leave_type]?.bar || "#64748B";
                return <div key={i} style={{ height: "3px", borderRadius: "2px", background: isEndpoint ? "rgba(255,255,255,0.6)" : bar, marginBottom: "1px", opacity: r.status === "pending" ? 0.55 : 1 }} />;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Off Day Month Calendar (single date selection) ────────────────────────────
function OffDayMonthCalendar({ year, month, selectedDate, onDayClick, offDayRequests, shifts }) {
  const todayStr = toDateStr(new Date());
  const cells    = buildMonthCells(year, month);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "5px" }}>
        {WEEK_HEADERS.map(h => (
          <div key={h} style={{ textAlign: "center", fontSize: "17px", fontWeight: "700", color: "#94A3B8", padding: "3px 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "3px" }}>
        {cells.map(({ dateStr, inMonth }) => {
          const isToday    = dateStr === todayStr;
          const isPast     = dateStr <= todayStr;
          const isSelected = dateStr === selectedDate;
          const shiftHit   = shifts.some(s => s.shifts?.shift_date === dateStr);
          const offHit     = offDayRequests.find(r => r.requested_date === dateStr);
          const hasActive  = offHit && offHit.status !== "rejected";

          let cellBg    = inMonth && !isPast ? "#FFF" : "#F8FAFC";
          let textColor = inMonth ? (isPast ? "#CBD5E1" : "#1E293B") : "#CBD5E1";
          let borderCol = isToday ? "#DDD6FE" : "#E2E8F0";
          let fw        = isToday ? "800" : "600";

          if (isSelected) { cellBg = "#7C3AED"; textColor = "#FFF"; borderCol = "#6D28D9"; }

          const clickable = inMonth && !isPast && !hasActive;

          const offBarColor = offHit
            ? (offHit.status === "approved" ? "#22C55E" : offHit.status === "rejected" ? "#EF4444" : "#F59E0B")
            : null;

          return (
            <div key={dateStr}
              className={clickable ? "offday-day-cell" : ""}
              onClick={() => {
                if (!clickable) return;
                onDayClick(dateStr === selectedDate ? null : dateStr);
              }}
              title={offHit ? `Off day ${offHit.status}` : undefined}
              style={{ minHeight: "58px", background: cellBg, border: `1.5px solid ${borderCol}`, borderRadius: "8px", cursor: clickable ? "pointer" : hasActive ? "not-allowed" : "default", opacity: !inMonth ? 0.35 : 1, transition: "border-color 0.1s, background 0.1s", padding: "5px 3px", boxSizing: "border-box" }}>
              <p style={{ fontSize: "20px", fontWeight: fw, color: textColor, textAlign: "center", marginBottom: "4px" }}>
                {new Date(dateStr + "T00:00:00").getDate()}
              </p>
              {shiftHit && inMonth && (
                <div style={{ height: "3px", borderRadius: "2px", background: isSelected ? "rgba(255,255,255,0.5)" : "#7C3AED", marginBottom: "2px" }} />
              )}
              {offBarColor && inMonth && (
                <div style={{ height: "3px", borderRadius: "2px", background: isSelected ? "rgba(255,255,255,0.7)" : offBarColor }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Legend pill ───────────────────────────────────────────────────────────────
function LegendDot({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
      <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: color }} />
      <span style={{ fontSize: "18px", fontWeight: "600", color: "#64748B" }}>{label}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function LeaveRequests() {
  const user   = getUser();
  const userId = user?.user_id;

  const [activeTab, setActiveTab] = useState("leave");

  // Common
  const [myShifts,    setMyShifts]    = useState([]);
  const [staffId,     setStaffId]     = useState(null);
  const [branchId,    setBranchId]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [toast,       setToast]       = useState(null);
  const [workingDays, setWorkingDays] = useState(7);

  // Leave state
  const [requests,   setRequests]   = useState([]);
  const [filter,     setFilter]     = useState("all");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");
  const _now = new Date();
  const [leaveMonth, setLeaveMonth] = useState({ year: _now.getFullYear(), month: _now.getMonth() + 1 });
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd,   setRangeEnd]   = useState(null);
  const [hoverDate,  setHoverDate]  = useState(null);
  const [leaveForm,  setLeaveForm]  = useState({ leave_type: "annual", reason: "" });

  // Off day state
  const [offDayRequests, setOffDayRequests] = useState([]);
  const [loadingOffDay,  setLoadingOffDay]  = useState(true);
  const [offDaySaving,   setOffDaySaving]   = useState(false);
  const [offDayError,    setOffDayError]    = useState("");
  const [offMonth,       setOffMonth]       = useState({ year: _now.getFullYear(), month: _now.getMonth() + 1 });
  const [selectedOffDate, setSelectedOffDate] = useState(null);
  const [offDayReason,   setOffDayReason]   = useState("");

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", userId).limit(1);
      const sid = myStaff?.[0]?.staff_id;
      if (cancelled) return;
      setStaffId(sid || null);
      if (!sid) { setRequests([]); setLoading(false); setLoadingOffDay(false); return; }

      const { data: staffRow } = await supabase.from("staff").select("branch_id").eq("staff_id", sid).single();
      const oid = staffRow?.branch_id;
      setBranchId(oid || null);

      const [{ data: leaveData }, { data: offData }, { data: branchRow }, { data: assignments }, { data: approvedSwaps }] = await Promise.all([
        supabase.from("availability")
          .select("request_id, leave_type, start_date, end_date, reason, status, reviewed_at")
          .eq("staff_id", sid).order("start_date", { ascending: false }),
        supabase.from("off_day_requests")
          .select("id, requested_date, reason, status, created_at, reviewed_at")
          .eq("staff_id", sid).order("created_at", { ascending: false }),
        oid
          ? supabase.from("branches").select("working_days").eq("branch_id", oid).single()
          : Promise.resolve({ data: null }),
        supabase.from("task_assignments")
          .select("assignment_id, shift_id, shifts ( shift_id, title, shift_date, start_time, end_time, status )")
          .eq("staff_id", sid),
        supabase.from("swap_requests")
          .select("requester_assign")
          .eq("requester_id", sid)
          .eq("status", "approved"),
      ]);

      if (!cancelled) {
        const approvedIds = new Set((approvedSwaps || []).map(r => r.requester_assign));
        const visibleAssignments = (assignments || []).filter(a => !approvedIds.has(a.assignment_id));
        setMyShifts(visibleAssignments);
        setRequests(leaveData || []);
        setOffDayRequests(offData || []);
        const wd = branchRow?.working_days ?? 7;
        setWorkingDays(wd);
        if (wd < 6) setActiveTab("leave");
        setLoading(false);
        setLoadingOffDay(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Leave range logic ───────────────────────────────────────────────────────
  function handleLeaveDay(dateStr) {
    if (!rangeStart || rangeEnd) {
      setRangeStart(dateStr);
      setRangeEnd(null);
      setError("");
    } else if (dateStr === rangeStart) {
      setRangeStart(null);
    } else if (dateStr < rangeStart) {
      setRangeStart(dateStr);
      setRangeEnd(null);
    } else {
      setRangeEnd(dateStr);
    }
    setHoverDate(null);
  }

  async function handleLeaveSubmit() {
    if (!rangeStart || !rangeEnd) { setError("Select start and end dates on the calendar."); return; }
    const todayStr = toDateStr(new Date());
    if (rangeStart < todayStr) { setError("Start date cannot be in the past."); return; }
    if (!staffId) { setError("No staff record found."); return; }
    const overlap = requests.find(r => r.status !== "rejected" && rangeStart <= r.end_date && rangeEnd >= r.start_date);
    if (overlap) {
      setError(`Overlaps your ${overlap.status} ${overlap.leave_type} leave (${fmtDate(overlap.start_date)} → ${fmtDate(overlap.end_date)}).`);
      return;
    }
    setSaving(true); setError("");
    const { data, error: err } = await supabase.from("availability")
      .insert({ staff_id: staffId, leave_type: leaveForm.leave_type, start_date: rangeStart, end_date: rangeEnd, reason: leaveForm.reason.trim() || null, status: "pending" })
      .select().single();
    setSaving(false);
    if (err) { setError(err.message || "Failed to submit."); return; }
    setRequests(prev => [data, ...prev]);
    setRangeStart(null); setRangeEnd(null);
    setLeaveForm({ leave_type: "annual", reason: "" });
    showToast("Leave request submitted.");

    getBranchManagerUserIds(branchId).then(managerIds => notifyUsers(managerIds, {
      type: "leave_request",
      title: "New Leave Request",
      message: `${user?.full_name || "A staff member"} requested ${data.leave_type} leave (${fmtDate(data.start_date)} – ${fmtDate(data.end_date)}).`,
      relatedEntity: "availability",
      relatedId: data.request_id,
    })).catch(() => {});
  }

  // ── Off day logic ───────────────────────────────────────────────────────────
  async function handleOffDaySubmit() {
    if (!selectedOffDate) { setOffDayError("Please pick a date."); return; }
    const todayStr = toDateStr(new Date());
    if (selectedOffDate <= todayStr) { setOffDayError("Requested date must be in the future."); return; }
    const overlap = offDayRequests.find(r => r.status !== "rejected" && r.requested_date === selectedOffDate);
    if (overlap) { setOffDayError("You already have a request for that date."); return; }
    setOffDaySaving(true); setOffDayError("");
    const { data, error: err } = await supabase.from("off_day_requests")
      .insert({ staff_id: staffId, requested_date: selectedOffDate, reason: offDayReason.trim() || null, status: "pending" })
      .select().single();
    setOffDaySaving(false);
    if (err) { setOffDayError(err.message || "Failed to submit."); return; }
    setOffDayRequests(prev => [data, ...prev]);
    setSelectedOffDate(null);
    setOffDayReason("");
    showToast("Off day request submitted.");

    getBranchManagerUserIds(branchId).then(managerIds => notifyUsers(managerIds, {
      type: "off_day_request",
      title: "New Off Day Request",
      message: `${user?.full_name || "A staff member"} requested ${fmtDate(data.requested_date)} off.`,
      relatedEntity: "off_day_requests",
      relatedId: data.id,
    })).catch(() => {});
  }

  const FILTER_TABS = [
    { value: "all", label: "All" }, { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
  ];
  const filtered      = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount  = requests.filter(r => r.status === "pending").length;
  const pendingOffDay = offDayRequests.filter(r => r.status === "pending").length;

  return (
    <StaffLayout title="Leave & Off Day">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Top tab bar */}
        <div style={{ display: "flex", gap: "0", marginBottom: "28px", borderBottom: "2px solid #E2E8F0" }}>
          {[
            { key: "leave",  label: "Leave Requests",  badge: pendingCount },
            ...(workingDays >= 6 ? [{ key: "offday", label: "Off Day Requests", badge: pendingOffDay }] : []),
          ].map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: "10px 20px", background: "none", border: "none", borderBottom: activeTab === tab.key ? "2px solid #2563EB" : "2px solid transparent", marginBottom: "-2px", fontSize: "21px", fontWeight: activeTab === tab.key ? "700" : "500", color: activeTab === tab.key ? "#2563EB" : "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s" }}>
              {tab.label}
              {tab.badge > 0 && <span style={{ background: "#F59E0B", color: "#FFF", fontSize: "17px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── LEAVE TAB ── */}
        {activeTab === "leave" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Leave Requests</h2>
              <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>
                {pendingCount > 0 ? `${pendingCount} pending approval` : "No pending requests"} · tap two dates on the calendar to set your leave period
              </p>
            </div>

            {/* Month Calendar card */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px 20px", marginBottom: rangeStart ? "0" : "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderBottomLeftRadius: rangeStart ? "0" : "16px", borderBottomRightRadius: rangeStart ? "0" : "16px" }}>
              {/* Month nav */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <button onClick={() => setLeaveMonth(m => prevMonthOf(m.year, m.month))} style={navBtn}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B" }}>{monthLabel(leaveMonth.year, leaveMonth.month)}</span>
                <button onClick={() => setLeaveMonth(m => nextMonthOf(m.year, m.month))} style={navBtn}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                <LegendDot color="#7C3AED" label="Your Shift" />
                {LEAVE_TYPES.map(t => <LegendDot key={t} color={TYPE_COLORS[t].bar} label={t.charAt(0).toUpperCase() + t.slice(1)} />)}
              </div>

              {loading ? <Shimmer h="240px" r="12px" /> : (
                <LeaveMonthCalendar
                  year={leaveMonth.year} month={leaveMonth.month}
                  rangeStart={rangeStart} rangeEnd={rangeEnd} hoverDate={hoverDate}
                  onDayClick={handleLeaveDay}
                  onDayHover={d => !rangeEnd && setHoverDate(d)}
                  onDayLeave={() => setHoverDate(null)}
                  leaveRequests={requests}
                  shifts={myShifts}
                />
              )}
            </div>

            {/* Range form panel — slides in below calendar when range is being set */}
            {rangeStart && (
              <div style={{ background: rangeEnd ? "#F0F9FF" : "#FAFAFA", border: "1px solid #BFDBFE", borderTop: "none", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px", padding: "18px 20px", marginBottom: "20px", animation: "popIn 0.2s ease both" }}>
                {rangeEnd ? (
                  <>
                    {/* Range summary */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                      <div>
                        <p style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B" }}>
                          {fmtDate(rangeStart)} → {fmtDate(rangeEnd)}
                        </p>
                        <p style={{ fontSize: "19px", color: "#64748B", marginTop: "2px" }}>
                          {getDays(rangeStart, rangeEnd)} day{getDays(rangeStart, rangeEnd) !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <button onClick={() => { setRangeStart(null); setRangeEnd(null); setError(""); }}
                        style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "6px 12px", fontSize: "19px", fontWeight: "600", color: "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                        <X size={12} /> Clear
                      </button>
                    </div>

                    {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "9px", fontSize: "20px", marginBottom: "14px" }}>{error}</div>}

                    {/* Leave type pill buttons */}
                    <div style={{ marginBottom: "14px" }}>
                      <p style={lbl}>Leave Type</p>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {LEAVE_TYPES.map(t => {
                          const tc = TYPE_COLORS[t];
                          const active = leaveForm.leave_type === t;
                          return (
                            <button key={t} onClick={() => setLeaveForm(p => ({ ...p, leave_type: t }))}
                              style={{ flex: 1, padding: "9px 6px", border: `2px solid ${active ? tc.bar : "#E2E8F0"}`, background: active ? tc.bg : "#FFF", borderRadius: "10px", fontSize: "20px", fontWeight: "700", color: active ? tc.color : "#94A3B8", cursor: "pointer", transition: "all 0.15s" }}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Reason */}
                    <div style={{ marginBottom: "16px" }}>
                      <p style={lbl}>Reason <span style={{ fontWeight: "400", color: "#CBD5E1" }}>(optional)</span></p>
                      <textarea value={leaveForm.reason} onChange={e => setLeaveForm(p => ({ ...p, reason: e.target.value }))}
                        placeholder="e.g. Family trip, medical procedure…"
                        style={{ ...inp, minHeight: "72px", resize: "vertical" }} />
                    </div>

                    <button onClick={handleLeaveSubmit} disabled={saving}
                      style={{ width: "100%", padding: "12px", background: saving ? "#93C5FD" : "#2563EB", color: "#FFF", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", cursor: saving ? "default" : "pointer", transition: "background 0.15s" }}>
                      {saving ? "Submitting…" : `Submit ${leaveForm.leave_type.charAt(0).toUpperCase() + leaveForm.leave_type.slice(1)} Leave`}
                    </button>
                  </>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#2563EB", animation: "popIn 0.4s ease infinite alternate" }} />
                      <p style={{ fontSize: "21px", fontWeight: "600", color: "#1D4ED8" }}>
                        From <strong>{fmtDate(rangeStart)}</strong> — now tap the end date
                      </p>
                    </div>
                    <button onClick={() => setRangeStart(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", display: "flex" }}>
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Filter tabs */}
            <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
              {FILTER_TABS.map(t => (
                <button key={t.value} onClick={() => setFilter(t.value)}
                  style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "20px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Leave list */}
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                      <Shimmer w="140px" h="16px" r="6px" /><Shimmer w="70px" h="24px" r="100px" />
                    </div>
                    <Shimmer w="180px" h="13px" r="5px" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "48px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ marginBottom: "12px" }}><TreePalm size={36} color="#CBD5E1" /></div>
                <p style={{ fontSize: "22px", fontWeight: "600", color: "#94A3B8" }}>No {filter === "all" ? "" : filter + " "}leave requests</p>
                <p style={{ fontSize: "20px", color: "#CBD5E1", marginTop: "4px" }}>Tap dates on the calendar above to request leave.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filtered.map((r, i) => {
                  const tc = TYPE_COLORS[r.leave_type] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
                  return (
                    <div key={r.request_id}
                      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "19px", fontWeight: "700", background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                          {r.leave_type.charAt(0).toUpperCase() + r.leave_type.slice(1)} Leave
                        </span>
                        <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "19px", fontWeight: "600", ...leaveBadge(r.status) }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", padding: "12px 0", borderTop: "1px solid #F8FAFC" }}>
                        <InfoItem label="From"     value={fmtDate(r.start_date)} />
                        <InfoItem label="To"       value={fmtDate(r.end_date)} />
                        <InfoItem label="Duration" value={`${getDays(r.start_date, r.end_date)} day(s)`} />
                      </div>
                      {r.reason && <p style={{ fontSize: "20px", color: "#64748B", fontStyle: "italic", marginTop: "10px" }}>"{r.reason}"</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── OFF DAY TAB ── */}
        {activeTab === "offday" && (
          <div>
            <div style={{ marginBottom: "20px" }}>
              <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Off Day Requests</h2>
              <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>
                {pendingOffDay > 0 ? `${pendingOffDay} pending approval` : "No pending requests"} · tap a day to request it off
              </p>
            </div>

            {/* Off Day Month Calendar card */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px 20px", marginBottom: selectedOffDate ? "0" : "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", borderBottomLeftRadius: selectedOffDate ? "0" : "16px", borderBottomRightRadius: selectedOffDate ? "0" : "16px" }}>
              {/* Month nav */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <button onClick={() => setOffMonth(m => prevMonthOf(m.year, m.month))} style={navBtn}>
                  <ChevronLeft size={16} />
                </button>
                <span style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B" }}>{monthLabel(offMonth.year, offMonth.month)}</span>
                <button onClick={() => setOffMonth(m => nextMonthOf(m.year, m.month))} style={navBtn}>
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                <LegendDot color="#7C3AED" label="Your Shift" />
                <LegendDot color="#F59E0B" label="Pending" />
                <LegendDot color="#22C55E" label="Approved" />
                <LegendDot color="#EF4444" label="Rejected" />
              </div>

              {loadingOffDay ? <Shimmer h="240px" r="12px" /> : (
                <OffDayMonthCalendar
                  year={offMonth.year} month={offMonth.month}
                  selectedDate={selectedOffDate}
                  onDayClick={setSelectedOffDate}
                  offDayRequests={offDayRequests}
                  shifts={myShifts}
                />
              )}
            </div>

            {/* Off day form panel */}
            {selectedOffDate && (
              <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderTop: "none", borderBottomLeftRadius: "16px", borderBottomRightRadius: "16px", padding: "18px 20px", marginBottom: "20px", animation: "popIn 0.2s ease both" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div>
                    <p style={{ fontSize: "22px", fontWeight: "700", color: "#4C1D95" }}>
                      {new Date(selectedOffDate + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </p>
                    <p style={{ fontSize: "19px", color: "#7C3AED", marginTop: "2px" }}>Requesting this day off</p>
                  </div>
                  <button onClick={() => { setSelectedOffDate(null); setOffDayReason(""); setOffDayError(""); }}
                    style={{ background: "#EDE9FE", border: "none", borderRadius: "8px", padding: "6px", cursor: "pointer", display: "flex" }}>
                    <X size={15} color="#7C3AED" />
                  </button>
                </div>

                {offDayError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "9px", fontSize: "20px", marginBottom: "14px" }}>{offDayError}</div>}

                <div style={{ marginBottom: "16px" }}>
                  <p style={{ ...lbl, color: "#5B21B6" }}>Reason <span style={{ fontWeight: "400", color: "#C4B5FD" }}>(optional)</span></p>
                  <textarea value={offDayReason} onChange={e => setOffDayReason(e.target.value)}
                    placeholder="e.g. Family event, personal appointment…"
                    style={{ ...inp, minHeight: "72px", resize: "vertical", borderColor: "#DDD6FE" }} />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setSelectedOffDate(null); setOffDayReason(""); setOffDayError(""); }}
                    style={{ flex: 1, padding: "11px", background: "#EDE9FE", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "600", color: "#6D28D9", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleOffDaySubmit} disabled={offDaySaving}
                    style={{ flex: 2, padding: "11px", background: offDaySaving ? "#C4B5FD" : "#7C3AED", color: "#FFF", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", cursor: offDaySaving ? "default" : "pointer", transition: "background 0.15s" }}>
                    {offDaySaving ? "Submitting…" : "Submit Off Day Request"}
                  </button>
                </div>
              </div>
            )}

            {/* Off day list */}
            {loadingOffDay ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[0, 1, 2].map(i => <Shimmer key={i} h="80px" r="14px" />)}
              </div>
            ) : offDayRequests.length === 0 ? (
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "48px", textAlign: "center" }}>
                <TreePalm size={32} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: "22px", fontWeight: "600", color: "#94A3B8" }}>No off day requests yet</p>
                <p style={{ fontSize: "20px", color: "#CBD5E1", marginTop: "4px" }}>Tap a day on the calendar above to request it off.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {offDayRequests.map((r, i) => {
                  const date    = new Date(r.requested_date + "T00:00:00");
                  const dayName = date.toLocaleDateString("en-SG", { weekday: "long" });
                  const dateFmt = date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
                  const badge   = leaveBadge(r.status);
                  return (
                    <div key={r.id} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                      <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "10px", padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
                        <p style={{ fontSize: "17px", fontWeight: "700", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.05em" }}>Off Day</p>
                        <p style={{ fontSize: "21px", fontWeight: "800", color: "#4C1D95", marginTop: "2px" }}>{dayName}</p>
                        <p style={{ fontSize: "18px", color: "#6D28D9", marginTop: "1px" }}>{dateFmt}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: "120px" }}>
                        {r.reason
                          ? <p style={{ fontSize: "20px", color: "#475569", fontStyle: "italic" }}>"{r.reason}"</p>
                          : <p style={{ fontSize: "20px", color: "#CBD5E1" }}>No reason provided</p>}
                        <p style={{ fontSize: "18px", color: "#94A3B8", marginTop: "4px" }}>Submitted {new Date(r.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                      <span style={{ padding: "5px 14px", borderRadius: "100px", fontSize: "19px", fontWeight: "700", ...badge, flexShrink: 0 }}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </StaffLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "18px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "21px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}

const lbl    = { display: "block", fontSize: "19px", fontWeight: "600", color: "#64748B", marginBottom: "6px" };
const inp    = { display: "block", width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "21px", background: "#FFF", color: "#1E293B", boxSizing: "border-box" };
const navBtn = { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#475569" };
