import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

if (typeof document !== "undefined" && !document.getElementById("staff-dash-styles")) {
  const style = document.createElement("style");
  style.id = "staff-dash-styles";
  style.textContent = `
    @keyframes fadeUp   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer  { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes toastIn  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

// Build 7-day strip anchored to Monday of the current week
function buildWeekStrip(assignmentsMap) {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7; // Mon=0
  const monOffset = -dow;
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + monOffset + i);
    const iso = d.toISOString().split("T")[0];
    const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
    const num = d.getDate();
    const isToday = i === dow;
    const assignments = assignmentsMap[iso] || [];
    days.push({ iso, dayLabel, num, isToday, assignments, hasShift: assignments.length > 0 });
  }
  return days;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + "T12:00:00Z") - new Date();
  return Math.ceil(diff / 86400000);
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const user     = getUser();
  const userId   = user?.user_id;

  const [loading,        setLoading]        = useState(true);
  const [staffId,        setStaffId]        = useState(null);
  const [branchName,     setBranchName]     = useState(null);
  const [allAssignments, setAllAssignments] = useState([]);
  const [nextShift,      setNextShift]      = useState(null);
  const [workedDays,     setWorkedDays]     = useState(0);
  const [leaveItems,     setLeaveItems]     = useState([]);
  const [swapItems,      setSwapItems]      = useState([]);
  const [notifications,  setNotifications]  = useState([]);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [approvalTab,    setApprovalTab]    = useState("leave");
  const [formOpen,       setFormOpen]       = useState(false);
  const [acked,          setAcked]          = useState({});
  const [weekDays,       setWeekDays]       = useState([]);
  const [selectedDay,    setSelectedDay]    = useState(null);

  const today = new Date().toISOString().split("T")[0];
  const todayDow = (new Date().getDay() + 6) % 7;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      try {
        const { data: myStaff } = await supabase.from("staff")
          .select("staff_id, branches(name)").eq("user_id", userId).limit(1);
        const sid = myStaff?.[0]?.staff_id;
        if (!sid || cancelled) return;
        setStaffId(sid);
        setBranchName(myStaff[0]?.branches?.name || null);

        const [
          apiResult,
          { data: leaves },
          { data: swaps },
          { data: notifs },
          { count: unread },
        ] = await Promise.all([
          api.get("/api/shifts/me/tasks"),
          supabase.from("availability").select("request_id, start_date, end_date, reason, status").eq("staff_id", sid).order("created_at", { ascending: false }).limit(5),
          supabase.from("swap_requests").select("swap_id, shift_date, status").eq("requester_id", sid).order("created_at", { ascending: false }).limit(5),
          supabase.from("notifications").select("notification_id, message, created_at, is_read").eq("recipient_id", userId).order("created_at", { ascending: false }).limit(6),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false),
        ]);
        if (cancelled) return;

        const all = apiResult?.assignments || [];

        // Map by date for week strip
        const assignMap = {};
        all.forEach(a => {
          if (!a.shifts?.shift_date) return;
          if (!assignMap[a.shifts.shift_date]) assignMap[a.shifts.shift_date] = [];
          assignMap[a.shifts.shift_date].push(a);
        });

        const strip = buildWeekStrip(assignMap);
        setWeekDays(strip);
        setSelectedDay(strip[todayDow] || strip[0]);

        // Next upcoming shift (future published)
        const futurePublished = all.filter(a => a.shifts?.shift_date > today && a.shifts?.status === "published")
          .sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));
        setNextShift(futurePublished[0] || null);

        // Worked days this week (shifts that have ended this week)
        const now = new Date();
        const weekStart = new Date(); weekStart.setDate(now.getDate() - todayDow); weekStart.setHours(0,0,0,0);
        const worked = all.filter(a => {
          if (!a.shifts?.shift_date) return false;
          const shDate = new Date(a.shifts.shift_date + "T12:00:00Z");
          const end = a.shifts.end_time ? new Date(a.shifts.shift_date + "T" + a.shifts.end_time) : null;
          return shDate >= weekStart && end && end <= now;
        });
        setWorkedDays(worked.length);

        setLeaveItems((leaves || []).map(l => ({
          id: l.request_id,
          range: fmtRange(l.start_date, l.end_date),
          reason: l.reason || "Leave",
          status: l.status,
          bg: l.status === "approved" ? "#DCFCE7" : l.status === "declined" ? "#FEE2E2" : "#FEF3C7",
          color: l.status === "approved" ? "#166534" : l.status === "declined" ? "#991B1B" : "#92400E",
        })));
        setSwapItems((swaps || []).map(s => ({
          id: s.swap_id,
          range: s.shift_date ? `Shift on ${fmtDate(s.shift_date)}` : "Swap request",
          status: s.status,
          bg: s.status === "approved" ? "#DCFCE7" : s.status === "declined" ? "#FEE2E2" : "#FEF3C7",
          color: s.status === "approved" ? "#166534" : s.status === "declined" ? "#991B1B" : "#92400E",
        })));
        setNotifications((notifs || []).map(n => ({ ...n, text: n.message || "Notification" })));
        setUnreadCount(unread || 0);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const markRead = async (id) => {
    setNotifications(p => p.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
    setUnreadCount(p => Math.max(0, p - 1));
    await supabase.from("notifications").update({ is_read: true }).eq("notification_id", id);
  };

  const workedDeg = Math.round((workedDays / 5) * 360);
  const onLeave   = approvalTab === "leave";

  const selDayAssignment = selectedDay?.assignments?.[0] || null;
  const selDayShift      = selDayAssignment?.shifts || null;
  const ackKey           = selectedDay?.iso;
  const isAcked          = !!(selDayAssignment && (selDayAssignment.acknowledged || acked[ackKey]));

  const nextDaysUntil = nextShift ? daysUntil(nextShift.shifts?.shift_date) : null;

  return (
    <StaffLayout title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeUp .4s ease both" }}>

        {/* Greeting */}
        <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B", margin: 0 }}>
          Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"}
          {branchName && <span style={{ marginLeft: "10px", fontSize: "20px", fontWeight: "600", color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "99px", padding: "2px 10px", verticalAlign: "middle" }}>{branchName}</span>}
        </h2>

        {/* Next Shift card + Worked donut */}
        <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "18px" }}>
          {/* Next Shift gradient card */}
          <div style={{ background: "linear-gradient(135deg,#2563EB,#1D4ED8)", borderRadius: "18px", padding: "26px 28px", color: "#fff", position: "relative", overflow: "hidden" }}>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <Shimmer w="80px" h="11px" r="5px" />
                <Shimmer w="200px" h="24px" r="6px" />
                <Shimmer w="150px" h="14px" r="5px" />
              </div>
            ) : nextShift ? (
              <>
                <p style={{ fontSize: "18px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", opacity: .75, margin: "0 0 10px" }}>Next Shift</p>
                <h3 style={{ fontSize: "25px", fontWeight: "800", margin: "0 0 6px" }}>
                  {new Date(nextShift.shifts.shift_date + "T12:00:00Z").toLocaleDateString("en-US", { weekday: "long" })}, {nextShift.shifts.title || "Shift"}
                </h3>
                <p style={{ fontSize: "21px", opacity: .85, margin: "0 0 20px" }}>
                  {nextShift.shifts.start_time?.slice(0,5)} – {nextShift.shifts.end_time?.slice(0,5)}
                  {nextShift.shifts.branches?.name && ` · ${nextShift.shifts.branches.name}`}
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px" }}>
                  <span style={{ background: "rgba(255,255,255,.18)", borderRadius: "100px", padding: "6px 14px", fontSize: "19.5px", fontWeight: "700" }}>
                    {nextDaysUntil === 0 ? "Today" : nextDaysUntil === 1 ? "Starts tomorrow" : `Starts in ${nextDaysUntil} days`}
                  </span>
                  <button onClick={() => navigate("/regular-staff/shifts")}
                    style={{ background: "#fff", color: "#1D4ED8", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "20px", fontWeight: "700", cursor: "pointer" }}>
                    View Details
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: "18px", fontWeight: "700", letterSpacing: ".08em", textTransform: "uppercase", opacity: .75, margin: "0 0 10px" }}>Next Shift</p>
                <h3 style={{ fontSize: "23px", fontWeight: "700", margin: "0 0 8px", opacity: .9 }}>No upcoming shifts scheduled</h3>
                <p style={{ fontSize: "20px", opacity: .7, margin: 0 }}>Check back with your manager for new assignments.</p>
              </>
            )}
            {/* Decorative icon */}
            <svg width="130" height="130" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1" style={{ position: "absolute", right: "-20px", bottom: "-24px", opacity: .12 }}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
          </div>

          {/* Worked this week donut */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "24px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: "10px" }}>
            {loading ? (
              <Shimmer w="96px" h="96px" r="50%" />
            ) : (
              <div style={{ width: "96px", height: "96px", borderRadius: "50%", background: `conic-gradient(#F97316 0deg ${workedDeg}deg, #FFEDD5 ${workedDeg}deg 360deg)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: "74px", height: "74px", borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "23px", fontWeight: "800", color: "#0F172A" }}>{workedDays}/5</span>
                  <span style={{ fontSize: "16.5px", color: "#94A3B8", fontWeight: "600" }}>days</span>
                </div>
              </div>
            )}
            <p style={{ fontSize: "19.5px", fontWeight: "600", color: "#1E293B", margin: 0 }}>Worked this week</p>
          </div>
        </div>

        {/* 7-day calendar strip */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
          <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: "0 0 16px" }}>This Week</h3>
          {loading ? (
            <div className="responsive-day-strip" style={{ gap: "8px" }}>
              {Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} h="72px" r="12px" />)}
            </div>
          ) : (
            <div className="responsive-day-strip" style={{ gap: "8px", marginBottom: "16px" }}>
              {weekDays.map((d, i) => {
                const isSel = selectedDay?.iso === d.iso;
                return (
                  <div key={i} onClick={() => setSelectedDay(d)}
                    style={{ cursor: "pointer", textAlign: "center", padding: "12px 4px", borderRadius: "12px",
                      background: isSel ? "#EFF6FF" : d.isToday ? "#FFF7ED" : "#FAFBFC",
                      border: `1.5px solid ${isSel ? "#93C5FD" : d.isToday ? "#FED7AA" : "#F1F5F9"}` }}>
                    <p style={{ fontSize: "17px", fontWeight: "700", color: isSel ? "#2563EB" : "#94A3B8", margin: "0 0 4px", letterSpacing: ".03em" }}>{d.dayLabel}</p>
                    <p style={{ fontSize: "21px", fontWeight: "800", color: isSel ? "#1D4ED8" : "#1E293B", margin: "0 0 6px" }}>{d.num}</p>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: d.hasShift ? "#2563EB" : "#E2E8F0", margin: "0 auto" }} />
                  </div>
                );
              })}
            </div>
          )}
          {/* Shift detail below strip */}
          {!loading && (
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "14px" }}>
              {selDayShift ? (
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ minWidth: "52px", textAlign: "center", background: "#EFF6FF", borderRadius: "10px", padding: "8px 4px" }}>
                    <p style={{ fontSize: "18px", fontWeight: "700", color: "#2563EB", margin: 0 }}>{selectedDay?.dayLabel}</p>
                    <p style={{ fontSize: "21px", fontWeight: "800", color: "#1E293B", margin: 0 }}>{selectedDay?.num}</p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{selDayShift.title || "Shift"}</p>
                    <p style={{ fontSize: "19.5px", color: "#64748B", margin: "2px 0 0" }}>
                      {selDayShift.start_time?.slice(0,5)} – {selDayShift.end_time?.slice(0,5)}
                      {selDayShift.branches?.name && ` · ${selDayShift.branches.name}`}
                    </p>
                  </div>
                  <button onClick={() => setAcked(p => ({ ...p, [ackKey]: !p[ackKey] }))}
                    style={{ background: isAcked ? "#DCFCE7" : "#2563EB", color: isAcked ? "#166534" : "#fff", border: `1px solid ${isAcked ? "#BBF7D0" : "#2563EB"}`, borderRadius: "9px", padding: "9px 16px", fontSize: "19.5px", fontWeight: "700", cursor: "pointer", flexShrink: 0 }}>
                    {isAcked ? "Acknowledged ✓" : "Acknowledge"}
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: "20.5px", color: "#64748B", textAlign: "center", padding: "8px 0", margin: 0 }}>
                  You're off on {selectedDay?.dayLabel}. Enjoy your rest!
                </p>
              )}
            </div>
          )}
        </div>

        {/* Leave/Swap tabs + Notifications */}
        <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Leave / Swap */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {[["leave","Leave"], ["swap","Swaps"]].map(([key, label]) => {
                  const active = approvalTab === key;
                  return (
                    <button key={key} onClick={() => setApprovalTab(key)}
                      style={{ padding: "7px 14px", borderRadius: "9px", border: `1px solid ${active ? "#BFDBFE" : "#E2E8F0"}`, background: active ? "#EFF6FF" : "transparent", color: active ? "#2563EB" : "#94A3B8", fontSize: "19.5px", fontWeight: "700", cursor: "pointer" }}>
                      {label}
                    </button>
                  );
                })}
              </div>
              <button onClick={() => setFormOpen(p => !p)}
                style={{ background: "none", border: "none", fontSize: "19.5px", fontWeight: "700", color: "#F97316", cursor: "pointer" }}>
                {formOpen ? "− Cancel" : "+ New Request"}
              </button>
            </div>

            {formOpen && (
              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px", padding: "12px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ fontSize: "19px", color: "#9A3412", fontWeight: "600" }}>New {onLeave ? "leave" : "swap"} request</div>
                <div style={{ background: "#fff", border: "1px solid #FDBA74", borderRadius: "7px", padding: "8px 10px", fontSize: "19.5px", color: "#94A3B8" }}>
                  Select dates and reason...
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={() => { setFormOpen(false); navigate(onLeave ? "/regular-staff/leave" : "/regular-staff/swaps"); }}
                    style={{ flex: 1, background: "#F97316", color: "#fff", border: "none", borderRadius: "7px", padding: "7px", fontSize: "19px", fontWeight: "700", cursor: "pointer" }}>
                    Submit
                  </button>
                  <button onClick={() => setFormOpen(false)}
                    style={{ flex: 1, background: "#fff", color: "#9A3412", border: "1px solid #FDBA74", borderRadius: "7px", padding: "7px", fontSize: "19px", fontWeight: "700", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2].map(i => <Shimmer key={i} h="50px" r="10px" />)}
              </div>
            ) : (onLeave ? leaveItems : swapItems).length === 0 ? (
              <p style={{ fontSize: "19.5px", color: "#94A3B8", textAlign: "center", padding: "16px 0", margin: 0 }}>
                No {onLeave ? "leave" : "swap"} requests yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(onLeave ? leaveItems : swapItems).map(item => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 10px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px" }}>
                    <div>
                      <p style={{ fontSize: "19.5px", fontWeight: "600", color: "#1E293B", margin: 0 }}>{item.range}</p>
                      {item.reason && <p style={{ fontSize: "18px", color: "#94A3B8", margin: "1px 0 0" }}>{item.reason}</p>}
                    </div>
                    <span style={{ fontSize: "17.5px", fontWeight: "700", padding: "3px 9px", borderRadius: "100px", background: item.bg, color: item.color, textTransform: "capitalize" }}>
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notifications */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: 0 }}>Notifications</h3>
              {unreadCount > 0 && (
                <span style={{ fontSize: "18px", fontWeight: "700", background: "#EF4444", color: "#fff", borderRadius: "100px", padding: "2px 8px" }}>{unreadCount}</span>
              )}
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="42px" r="9px" />)}
              </div>
            ) : notifications.length === 0 ? (
              <p style={{ fontSize: "19.5px", color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>No notifications.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {notifications.map(n => (
                  <div key={n.notification_id} onClick={() => !n.is_read && markRead(n.notification_id)}
                    style={{ display: "flex", gap: "10px", padding: "10px 8px", borderRadius: "9px", cursor: n.is_read ? "default" : "pointer", background: n.is_read ? "transparent" : "#EFF6FF", transition: "background .15s" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: n.is_read ? "#E2E8F0" : "#2563EB", marginTop: "6px", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "19.5px", color: "#1E293B", fontWeight: n.is_read ? 500 : 700, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.text}</p>
                      <p style={{ fontSize: "18px", color: "#94A3B8", margin: "2px 0 0" }}>{relTime(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </StaffLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}
function fmtRange(start, end) {
  if (!start) return "—";
  const s = fmtDate(start);
  const e = end && end !== start ? fmtDate(end) : null;
  return e ? `${s} – ${e}` : s;
}
function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}
