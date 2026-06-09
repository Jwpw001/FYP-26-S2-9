import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

export default function StaffDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [pendingLeave, setPendingLeave]     = useState([]);
  const [notifications, setNotifications]  = useState([]);
  const [loading, setLoading]              = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const in14 = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

        const [{ data: assignments }, { data: leave }, { data: notifs }] = await Promise.all([
          supabase.from("shift_assignments")
            .select(`
              assignment_id, status,
              shifts ( shift_id, title, shift_date, start_time, end_time, status,
                outlets ( name ) )
            `)
            .eq("staff_id", userId)
            .gte("shifts.shift_date", today)
            .lte("shifts.shift_date", in14)
            .order("shifts.shift_date", { ascending: true }),
          supabase.from("availability")
            .select("request_id, leave_type, start_date, end_date, status")
            .eq("staff_id", userId)
            .order("start_date", { ascending: false })
            .limit(5),
          supabase.from("notifications")
            .select("notification_id, type, title, message, created_at")
            .eq("recipient_id", userId)
            .order("created_at", { ascending: false })
            .limit(5),
        ]);

        if (cancelled) return;
        setUpcomingShifts((assignments || []).filter(a => a.shifts).slice(0, 5));
        setPendingLeave((leave || []).filter(l => l.status === "pending"));
        setNotifications(notifs || []);
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

  return (
    <StaffLayout title="Dashboard">
      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
            </h2>
            <p style={s.welcomeSub}>Here's your schedule for the coming days.</p>
          </div>

          {/* Stat cards */}
          <div style={s.grid}>
            {[
              { label:"Upcoming Shifts", value:upcomingShifts.length, icon:"📅",
                color:"#2563EB", bg:"#EFF6FF", link:"/regular-staff/shifts" },
              { label:"Pending Leave", value:pendingLeave.length, icon:"🏖",
                color:"#D97706", bg:"#FFFBEB", link:"/regular-staff/leave" },
              { label:"Notifications", value:notifications.length, icon:"🔔",
                color:"#7C3AED", bg:"#F5F3FF", link:"/regular-staff/notifications" },
            ].map(card => (
              <div key={card.label} style={s.card} onClick={() => navigate(card.link)}>
                <div style={{ ...s.cardIcon, background:card.bg, color:card.color }}>
                  {card.icon}
                </div>
                <div>
                  <p style={s.cardValue}>{card.value}</p>
                  <p style={s.cardLabel}>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Upcoming shifts */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Upcoming Shifts</h3>
              <button style={s.viewAll} onClick={() => navigate("/regular-staff/shifts")}>
                View all →
              </button>
            </div>
            {upcomingShifts.length === 0 ? (
              <div style={s.empty}>No upcoming shifts assigned.</div>
            ) : (
              upcomingShifts.map(a => (
                <div key={a.assignment_id} style={s.shiftRow}>
                  <div style={s.shiftDate}>
                    <p style={s.shiftDay}>{fmtDay(a.shifts?.shift_date)}</p>
                    <p style={s.shiftDayNum}>{fmtDayNum(a.shifts?.shift_date)}</p>
                  </div>
                  <div style={s.shiftInfo}>
                    <p style={s.shiftTitle}>{a.shifts?.title || "Shift"}</p>
                    <p style={s.shiftMeta}>
                      {a.shifts?.start_time?.slice(0,5)} – {a.shifts?.end_time?.slice(0,5)}
                      {a.shifts?.outlets?.name && ` · ${a.shifts.outlets.name}`}
                    </p>
                  </div>
                  <span style={{ ...s.badge, ...statusStyle(a.shifts?.status) }}>
                    {a.shifts?.status}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Quick actions */}
          <div style={s.section}>
            <h3 style={{ ...s.sectionTitle, marginBottom:"14px" }}>Quick Actions</h3>
            <div style={s.actions}>
              {[
                { label:"Request Leave",      icon:"🏖", link:"/regular-staff/leave" },
                { label:"Swap Shift",         icon:"🔄", link:"/regular-staff/swaps" },
                { label:"View Notifications", icon:"🔔", link:"/regular-staff/notifications" },
              ].map(a => (
                <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </StaffLayout>
  );
}

function fmtDay(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"short" });
}
function fmtDayNum(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric" });
}
function statusStyle(status) {
  const map = {
    draft:     { background:"#F3F4F6", color:"#6B7280" },
    published: { background:"#DCFCE7", color:"#166534" },
    completed: { background:"#DBEAFE", color:"#1E40AF" },
  };
  return map[status] || map.draft;
}

const s = {
  loading: { display:"flex", alignItems:"center", justifyContent:"center",
    height:"200px", color:"#7A7870", fontSize:"14px" },
  welcome: { marginBottom:"24px" },
  welcomeTitle: { fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub: { fontSize:"14px", color:"#7A7870" },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
    gap:"16px", marginBottom:"24px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px",
    padding:"20px", display:"flex", gap:"14px", alignItems:"flex-start", cursor:"pointer" },
  cardIcon: { width:"44px", height:"44px", borderRadius:"10px", display:"flex",
    alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue: { fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel: { fontSize:"13px", fontWeight:"600", color:"#1C1B18", marginTop:"4px" },
  section: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  sectionHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"16px" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  viewAll: { background:"none", border:"none", fontSize:"13px",
    color:"#2563EB", fontWeight:"600", cursor:"pointer" },
  empty: { textAlign:"center", padding:"24px", color:"#7A7870", fontSize:"14px" },
  shiftRow: { display:"flex", alignItems:"center", gap:"16px",
    padding:"12px 0", borderBottom:"1px solid #F0EDE8" },
  shiftDate: { textAlign:"center", minWidth:"44px" },
  shiftDay: { fontSize:"11px", fontWeight:"600", color:"#7A7870", textTransform:"uppercase" },
  shiftDayNum: { fontSize:"13px", fontWeight:"700", color:"#1C1B18" },
  shiftInfo: { flex:1 },
  shiftTitle: { fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  shiftMeta: { fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  badge: { display:"inline-block", padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600", textTransform:"capitalize", flexShrink:0 },
  actions: { display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn: { display:"flex", alignItems:"center", gap:"8px",
    padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", fontSize:"13px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },
};
