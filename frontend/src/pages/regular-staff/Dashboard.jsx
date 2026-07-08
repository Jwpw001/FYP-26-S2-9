import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";
import { CalendarDays, Palmtree, RefreshCw, Bell, SmilePlus, CheckCircle2, Flag, Hand } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-dash-styles")) {
  const style = document.createElement("style");
  style.id = "staff-dash-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .staff-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .staff-action-btn:hover { background: #EFF6FF !important; border-color: #93C5FD !important; color: #1D4ED8 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function fmtTime(iso) {
  if (!iso) return null;
  const u = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(u).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
}

function canClockIn(startTime) {
  if (!startTime) return false;
  const [h, m] = startTime.split(":").map(Number);
  const shiftStart = new Date();
  shiftStart.setHours(h, m, 0, 0);
  return new Date() >= new Date(shiftStart.getTime() - 5 * 60 * 1000);
}

export default function StaffDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pendingLeave, setPendingLeave]     = useState(0);
  const [pendingSwaps, setPendingSwaps]     = useState(0);
  const [unreadCount, setUnreadCount]       = useState(0);
  const [loading, setLoading]               = useState(true);

  const [todayShift, setTodayShift]   = useState(null);  // null=loading, false=none, obj=shift
  const [todayAttend, setTodayAttend] = useState(null);
  const [clockSaving, setClockSaving] = useState(false);
  const [toast, setToast]             = useState(null);
  const [nowTick, setNowTick]         = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const in14  = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

        const { data: myStaff } = await supabase
          .from("staff").select("staff_id")
          .eq("user_id", userId).limit(1);
        const staffId = myStaff?.[0]?.staff_id;

        const [
          { data: assignments },
          { data: leave },
          { data: swaps },
          { count: unread },
        ] = await Promise.all([
          staffId
            ? supabase.from("shift_assignments")
                .select(`assignment_id, status, acknowledged,
                  shifts ( shift_id, title, shift_date, start_time, end_time, status, outlets ( name ) ),
                  attendance ( attendance_id, status, clock_in, clock_out )`)
                .eq("staff_id", staffId)
            : Promise.resolve({ data: [] }),
          staffId
            ? supabase.from("availability")
                .select("request_id, status")
                .eq("staff_id", staffId)
                .eq("status", "pending")
            : Promise.resolve({ data: [] }),
          staffId
            ? supabase.from("swap_requests")
                .select("swap_id, status")
                .eq("requester_id", staffId)
                .eq("status", "pending")
            : Promise.resolve({ data: [] }),
          supabase.from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", userId)
            .eq("is_read", false),
        ]);

        if (cancelled) return;

        const all = assignments || [];

        // Today's shift
        const todayAssign = all.find(a => a.shifts?.shift_date === today && a.shifts?.status === "published");
        if (todayAssign) {
          setTodayShift(todayAssign);
          setTodayAttend(todayAssign.attendance?.[0] || null);
        } else {
          setTodayShift(false);
          setTodayAttend(null);
        }

        const upcoming = all
          .filter(a => a.shifts && a.shifts.shift_date > today && a.shifts.shift_date <= in14)
          .sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));

        setUpcomingShifts(upcoming.slice(0, 5));
        setPendingLeave((leave || []).length);
        setPendingSwaps((swaps || []).length);
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

  async function handleClockIn() {
    if (!todayShift) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      if (todayAttend?.attendance_id) {
        await supabase.from("attendance").update({ clock_in: now, status: "present" }).eq("attendance_id", todayAttend.attendance_id);
        setTodayAttend(prev => ({ ...prev, clock_in: now, status: "present" }));
      } else {
        const { data } = await supabase.from("attendance").insert({
          assignment_id: todayShift.assignment_id, status: "present", marked_by: userId, clock_in: now,
        }).select("attendance_id,status,clock_in,clock_out").single();
        setTodayAttend(data);
      }
      showToast("Clocked in successfully!");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock in.", "error");
    } finally {
      setClockSaving(false);
    }
  }

  async function handleClockOut() {
    if (!todayAttend?.attendance_id) return;
    setClockSaving(true);
    try {
      const now = new Date().toISOString();
      await supabase.from("attendance").update({ clock_out: now }).eq("attendance_id", todayAttend.attendance_id);
      setTodayAttend(prev => ({ ...prev, clock_out: now }));
      showToast("Clocked out successfully!");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock out.", "error");
    } finally {
      setClockSaving(false);
    }
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  const statCards = [
    { label: "Upcoming Shifts",   value: upcomingShifts.length, icon: CalendarDays, color: "#2563EB", bg: "#EFF6FF", link: "/regular-staff/shifts" },
    { label: "Pending Leave",     value: pendingLeave,           icon: Palmtree,     color: "#D97706", bg: "#FFFBEB", link: "/regular-staff/leave" },
    { label: "Pending Swaps",     value: pendingSwaps,           icon: RefreshCw,    color: "#7C3AED", bg: "#F5F3FF", link: "/regular-staff/swaps" },
    { label: "Unread Notifications", value: unreadCount,         icon: Bell,         color: "#059669", bg: "#ECFDF5", link: "/regular-staff/notifications" },
  ];

  const quickActions = [
    { label: "Request Leave",    icon: Palmtree,  link: "/regular-staff/leave" },
    { label: "Swap Requests",    icon: RefreshCw, link: "/regular-staff/swaps" },
    { label: "Notifications",    icon: Bell,      link: "/regular-staff/notifications" },
  ];

  const clockInAllowed = todayShift && canClockIn(todayShift.shifts?.start_time);
  void nowTick;

  return (
    <StaffLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} <Hand size={22} color="#F59E0B" />
            </span>
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's your schedule and updates for the coming days.</p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <Shimmer w="44px" h="44px" r="10px" />
                <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
                <div style={{ marginTop: "8px" }}><Shimmer w="100px" h="13px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {statCards.map((card, i) => (
              <div
                key={card.label}
                className="staff-stat-card"
                onClick={() => navigate(card.link)}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px",
                  padding: "22px", cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  transition: "transform 0.18s, box-shadow 0.18s",
                  animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both`,
                }}
              >
                <div style={{
                  width: "44px", height: "44px", borderRadius: "10px",
                  background: card.bg, color: card.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px", marginBottom: "14px",
                }}>
                  <card.icon size={20} />
                </div>
                <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Today's Shift & Clock In/Out ── */}
        <div style={{ ...s.section, background: todayShift ? "linear-gradient(135deg,#EFF6FF 0%,#F0FDF4 100%)" : "#FAFAFA", border: todayShift ? "1.5px solid #BFDBFE" : "1px solid #E2E8F0" }}>
          <h3 style={{ ...s.sectionTitle, marginBottom: "16px" }}>Today's Shift</h3>

          {loading ? (
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <Shimmer w="60px" h="60px" r="12px" />
              <div style={{ flex: 1 }}>
                <Shimmer w="45%" h="15px" r="5px" />
                <div style={{ marginTop: "8px" }}><Shimmer w="60%" h="12px" r="5px" /></div>
              </div>
              <Shimmer w="100px" h="38px" r="10px" />
            </div>
          ) : todayShift === false ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <p style={{ fontSize: "32px", marginBottom: "10px", display: "flex", justifyContent: "center" }}><SmilePlus size={32} color="#64748B" /></p>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>No shift today — take a well-earned rest!</p>
              <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Enjoy your day off. Check back tomorrow.</p>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                <div style={{ minWidth: "56px", textAlign: "center", background: "#2563EB", borderRadius: "12px", padding: "10px 6px" }}>
                  <p style={{ fontSize: "10px", fontWeight: "800", color: "#BFDBFE", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    {fmtDay(todayShift.shifts?.shift_date)}
                  </p>
                  <p style={{ fontSize: "20px", fontWeight: "900", color: "#FFFFFF", lineHeight: 1.1 }}>
                    {fmtDayNum(todayShift.shifts?.shift_date)}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>{todayShift.shifts?.title || "Shift"}</p>
                  <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
                    {todayShift.shifts?.start_time?.slice(0,5)} – {todayShift.shifts?.end_time?.slice(0,5)}
                    {todayShift.shifts?.outlets?.name && ` · ${todayShift.shifts.outlets.name}`}
                  </p>
                  {!clockInAllowed && !todayAttend?.clock_in && (
                    <p style={{ fontSize: "11px", color: "#D97706", marginTop: "4px", fontWeight: "600" }}>
                      Clock-in opens 5 min before shift starts
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                {todayAttend?.clock_in ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#DCFCE7", border: "1.5px solid #BBF7D0", borderRadius: "10px", padding: "10px 16px" }}>
                    <span style={{ fontSize: "16px", display: "inline-flex" }}><CheckCircle2 size={16} color="#16A34A" /></span>
                    <div>
                      <p style={{ fontSize: "11px", color: "#166534", fontWeight: "600" }}>Clocked In</p>
                      <p style={{ fontSize: "15px", color: "#166534", fontWeight: "800" }}>{fmtTime(todayAttend.clock_in)}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={handleClockIn}
                    disabled={clockSaving || !clockInAllowed}
                    style={{
                      padding: "11px 24px", borderRadius: "10px", border: "none",
                      background: clockInAllowed ? "#16A34A" : "#D1FAE5",
                      color: clockInAllowed ? "#FFF" : "#6EE7B7",
                      fontSize: "14px", fontWeight: "700",
                      cursor: (clockSaving || !clockInAllowed) ? "not-allowed" : "pointer",
                      opacity: clockSaving ? 0.7 : 1, transition: "all 0.15s",
                    }}>
                    {clockSaving ? "Clocking in…" : "Clock In"}
                  </button>
                )}

                {(todayAttend?.clock_in || clockInAllowed) && (
                  <span style={{ color: "#CBD5E1", fontSize: "18px" }}>→</span>
                )}

                {todayAttend?.clock_out ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFF1F2", border: "1.5px solid #FECACA", borderRadius: "10px", padding: "10px 16px" }}>
                    <span style={{ fontSize: "16px", display: "inline-flex" }}><Flag size={16} color="#DC2626" /></span>
                    <div>
                      <p style={{ fontSize: "11px", color: "#9F1239", fontWeight: "600" }}>Clocked Out</p>
                      <p style={{ fontSize: "15px", color: "#9F1239", fontWeight: "800" }}>{fmtTime(todayAttend.clock_out)}</p>
                    </div>
                  </div>
                ) : todayAttend?.clock_in ? (
                  <button
                    onClick={handleClockOut}
                    disabled={clockSaving}
                    style={{
                      padding: "11px 24px", borderRadius: "10px", border: "none",
                      background: "#DC2626", color: "#FFF",
                      fontSize: "14px", fontWeight: "700",
                      cursor: clockSaving ? "not-allowed" : "pointer",
                      opacity: clockSaving ? 0.7 : 1, transition: "all 0.15s",
                    }}>
                    {clockSaving ? "Clocking out…" : "Clock Out"}
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Upcoming shifts */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h3 style={s.sectionTitle}>Upcoming Shifts</h3>
            <button style={s.viewAll} onClick={() => navigate("/regular-staff/shifts")}>View all →</button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="44px" h="44px" r="10px" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="60%" h="14px" r="5px" />
                    <div style={{ marginTop: "7px" }}><Shimmer w="40%" h="12px" r="5px" /></div>
                  </div>
                  <Shimmer w="70px" h="24px" r="100px" />
                </div>
              ))}
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div style={s.emptyInner}>
              <span style={{ fontSize: "28px", display: "inline-flex" }}><CalendarDays size={28} color="#94A3B8" /></span>
              <p style={{ fontSize: "14px", color: "#64748B", marginTop: "8px" }}>No upcoming shifts in the next 14 days.</p>
            </div>
          ) : (
            upcomingShifts.map((a, i) => (
              <div key={a.assignment_id}
                style={{ display: "flex", alignItems: "center", gap: "16px", padding: "14px 0", borderBottom: "1px solid #F1F5F9", animation: `fadeSlideUp 0.3s ease ${i * 0.06}s both` }}>
                <div style={{ minWidth: "50px", textAlign: "center", background: "#EFF6FF", borderRadius: "10px", padding: "8px 4px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#2563EB", textTransform: "uppercase" }}>{fmtDay(a.shifts?.shift_date)}</p>
                  <p style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>{fmtDayNum(a.shifts?.shift_date)}</p>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B", marginBottom: "2px" }}>{a.shifts?.title || "Shift"}</p>
                  <p style={{ fontSize: "12px", color: "#64748B" }}>
                    {a.shifts?.start_time?.slice(0,5)} – {a.shifts?.end_time?.slice(0,5)}
                    {a.shifts?.outlets?.name && ` · ${a.shifts.outlets.name}`}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                  <span style={{ ...s.badge, ...statusStyle(a.shifts?.status) }}>{a.shifts?.status}</span>
                  {!a.acknowledged && a.shifts?.status === "published" && (
                    <span style={{ fontSize: "10px", color: "#D97706", fontWeight: "600", background: "#FFFBEB", padding: "2px 7px", borderRadius: "100px" }}>Needs ack</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom: "14px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {quickActions.map(a => (
              <button
                key={a.label}
                className="staff-action-btn"
                onClick={() => navigate(a.link)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 18px", background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600", color: "#1E293B",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <span style={{ display: "inline-flex", alignItems: "center" }}><a.icon size={16} /></span>{a.label}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "error" ? "#EF4444" : "#22C55E",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        }}>
          {toast.msg}
        </div>
      )}
    </StaffLayout>
  );
}

function fmtDay(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short" });
}
function fmtDayNum(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { day: "numeric" });
}
function statusStyle(status) {
  const map = {
    draft:     { background: "#F3F4F6", color: "#6B7280" },
    published: { background: "#DCFCE7", color: "#166534" },
    completed: { background: "#DBEAFE", color: "#1E40AF" },
    cancelled: { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || map.draft;
}

const s = {
  section: {
    background: "#FFFFFF", border: "1px solid #E2E8F0",
    borderRadius: "16px", padding: "22px", marginBottom: "20px",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  viewAll: { background: "none", border: "none", fontSize: "13px", color: "#2563EB", fontWeight: "600", cursor: "pointer" },
  emptyInner: { textAlign: "center", padding: "28px 0", display: "flex", flexDirection: "column", alignItems: "center" },
  badge: { display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize" },
};
