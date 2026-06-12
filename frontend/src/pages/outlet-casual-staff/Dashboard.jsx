import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

if (typeof document !== "undefined" && !document.getElementById("casual-dash-styles")) {
  const style = document.createElement("style");
  style.id = "casual-dash-styles";
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
    .casual-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .casual-action-btn:hover { background: #EFF6FF !important; border-color: #93C5FD !important; color: #1D4ED8 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  return d.toISOString().split("T")[0];
}
function getSunday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - day + 7);
  return d.toISOString().split("T")[0];
}

export default function CasualDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [upcomingShifts, setUpcomingShifts]       = useState([]);
  const [availabilityCount, setAvailabilityCount] = useState(0);
  const [unreadCount, setUnreadCount]             = useState(0);
  const [loading, setLoading]                     = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today  = new Date().toISOString().split("T")[0];
        const in7    = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
        const monday = getMonday();
        const sunday = getSunday();

        const { data: myStaff } = await supabase
          .from("staff").select("staff_id")
          .eq("user_id", userId).limit(1);
        const staffId = myStaff?.[0]?.staff_id;

        const [
          { data: assignments },
          { count: availCount },
          { count: unread },
        ] = await Promise.all([
          staffId
            ? supabase.from("shift_assignments")
                .select(`assignment_id, acknowledged,
                  shifts ( shift_id, title, shift_date, start_time, end_time, status, outlets ( name ) )`)
                .eq("staff_id", staffId)
            : Promise.resolve({ data: [] }),
          staffId
            ? supabase.from("casual_availability")
                .select("*", { count: "exact", head: true })
                .eq("staff_id", staffId)
                .gte("week_start_date", monday)
                .lte("week_start_date", sunday)
            : Promise.resolve({ count: 0 }),
          supabase.from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", userId)
            .eq("is_read", false),
        ]);

        if (cancelled) return;

        const upcoming = (assignments || [])
          .filter(a => a.shifts && a.shifts.shift_date >= today && a.shifts.shift_date <= in7)
          .sort((a, b) => a.shifts.shift_date.localeCompare(b.shifts.shift_date));

        setUpcomingShifts(upcoming.slice(0, 4));
        setAvailabilityCount(availCount || 0);
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

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning";
    if (h < 17) return "afternoon";
    return "evening";
  }

  const statCards = [
    { label: "Upcoming Shifts",          value: upcomingShifts.length, icon: "📅", color: "#2563EB", bg: "#EFF6FF", link: "/outlet-casual-staff/shifts" },
    { label: "Availability Slots (Week)", value: availabilityCount,     icon: "🗓",  color: "#059669", bg: "#ECFDF5", link: "/outlet-casual-staff/availability" },
    { label: "Unread Notifications",     value: unreadCount,           icon: "🔔",  color: "#7C3AED", bg: "#F5F3FF", link: "/outlet-casual-staff/notifications" },
  ];

  const quickActions = [
    { label: "Submit Availability", icon: "🗓", link: "/outlet-casual-staff/availability" },
    { label: "View My Shifts",      icon: "📅", link: "/outlet-casual-staff/shifts" },
    { label: "Notifications",       icon: "🔔", link: "/outlet-casual-staff/notifications" },
  ];

  return (
    <CasualLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Check your upcoming shifts and submit your weekly availability.</p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <Shimmer w="44px" h="44px" r="10px" />
                <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
                <div style={{ marginTop: "8px" }}><Shimmer w="120px" h="13px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {statCards.map((card, i) => (
              <div key={card.label}
                className="casual-stat-card"
                onClick={() => navigate(card.link)}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px",
                  padding: "22px", cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  transition: "transform 0.18s, box-shadow 0.18s",
                  animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both`,
                }}>
                <div style={{
                  width: "44px", height: "44px", borderRadius: "10px",
                  background: card.bg, color: card.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "20px", marginBottom: "14px",
                }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Availability reminder */}
        {!loading && availabilityCount === 0 && (
          <div style={{
            background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "14px",
            padding: "18px 22px", display: "flex", alignItems: "center", gap: "14px",
            marginBottom: "24px", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: "22px", flexShrink: 0 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#92400E" }}>Submit your availability for this week</p>
              <p style={{ fontSize: "13px", color: "#B45309", marginTop: "2px" }}>You haven't submitted any slots yet. Submit now so the manager can schedule you.</p>
            </div>
            <button onClick={() => navigate("/outlet-casual-staff/availability")}
              style={{ background: "#D97706", color: "#FFFFFF", border: "none", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer", flexShrink: 0 }}>
              Submit →
            </button>
          </div>
        )}

        {/* Upcoming shifts */}
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <h3 style={s.sectionTitle}>Upcoming Shifts</h3>
            <button style={s.viewAll} onClick={() => navigate("/outlet-casual-staff/shifts")}>View all →</button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="50px" h="50px" r="10px" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="55%" h="14px" r="5px" />
                    <div style={{ marginTop: "7px" }}><Shimmer w="40%" h="12px" r="5px" /></div>
                  </div>
                  <Shimmer w="70px" h="24px" r="100px" />
                </div>
              ))}
            </div>
          ) : upcomingShifts.length === 0 ? (
            <div style={s.emptyInner}>
              <span style={{ fontSize: "28px" }}>📅</span>
              <p style={{ fontSize: "14px", color: "#64748B", marginTop: "8px" }}>No upcoming shifts assigned in the next 7 days.</p>
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
                  <span style={{ ...badge, ...statusStyle(a.shifts?.status) }}>{a.shifts?.status}</span>
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
              <button key={a.label}
                className="casual-action-btn"
                onClick={() => navigate(a.link)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 18px", background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0", borderRadius: "10px",
                  fontSize: "13px", fontWeight: "600", color: "#1E293B",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </CasualLayout>
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

const badge = { display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize" };
const s = {
  section: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  viewAll: { background: "none", border: "none", fontSize: "13px", color: "#2563EB", fontWeight: "600", cursor: "pointer" },
  emptyInner: { textAlign: "center", padding: "28px 0", display: "flex", flexDirection: "column", alignItems: "center" },
};
