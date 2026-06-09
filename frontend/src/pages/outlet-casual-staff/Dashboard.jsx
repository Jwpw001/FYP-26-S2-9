import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

export default function CasualDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [notifications, setNotifications]  = useState([]);
  const [availabilityThisWeek, setAvailabilityThisWeek] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];
        const in7   = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

        const monday = getMonday();
        const sunday = getSunday();

        const [{ data: assignments }, { data: notifs }, { count: availCount }] =
          await Promise.all([
            supabase.from("shift_assignments")
              .select(`
                assignment_id, status, acknowledged,
                shifts ( shift_id, title, shift_date, start_time, end_time, status,
                  outlets ( name ) )
              `)
              .eq("staff_id", userId)
              .gte("shifts.shift_date", today)
              .lte("shifts.shift_date", in7)
              .order("shifts.shift_date", { ascending: true }),
            supabase.from("notifications")
              .select("notification_id, title, message, type, created_at")
              .eq("recipient_id", userId)
              .order("created_at", { ascending: false })
              .limit(5),
            supabase.from("casual_availability")
              .select("*", { count:"exact", head:true })
              .eq("staff_id", userId)
              .gte("week_start_date", monday)
              .lte("week_start_date", sunday),
          ]);

        if (cancelled) return;
        setUpcomingShifts((assignments || []).filter(a => a.shifts).slice(0, 4));
        setNotifications(notifs || []);
        setAvailabilityThisWeek(availCount || 0);
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
    <CasualLayout title="Dashboard">
      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
            </h2>
            <p style={s.welcomeSub}>Check your upcoming shifts and submit your availability.</p>
          </div>

          <div style={s.grid}>
            {[
              { label:"Upcoming Shifts", value:upcomingShifts.length,
                icon:"📅", color:"#2563EB", bg:"#EFF6FF", link:"/outlet-casual-staff/shifts" },
              { label:"Availability Slots This Week", value:availabilityThisWeek,
                icon:"🗓", color:"#059669", bg:"#ECFDF5", link:"/outlet-casual-staff/availability" },
              { label:"Notifications", value:notifications.length,
                icon:"🔔", color:"#7C3AED", bg:"#F5F3FF", link:"/outlet-casual-staff/notifications" },
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

          {/* Availability reminder */}
          {availabilityThisWeek === 0 && (
            <div style={s.reminder}>
              <span style={s.reminderIcon}>⚠️</span>
              <div>
                <p style={s.reminderTitle}>Submit your availability for this week</p>
                <p style={s.reminderSub}>
                  You haven't submitted any availability slots yet. Submit now so the manager can schedule you.
                </p>
              </div>
              <button style={s.reminderBtn}
                onClick={() => navigate("/outlet-casual-staff/availability")}>
                Submit →
              </button>
            </div>
          )}

          {/* Upcoming shifts */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Upcoming Shifts</h3>
              <button style={s.viewAll} onClick={() => navigate("/outlet-casual-staff/shifts")}>
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
                  {!a.acknowledged && a.shifts?.status === "published" && (
                    <span style={s.ackPending}>Needs acknowledgement</span>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick actions */}
          <div style={s.section}>
            <h3 style={{ ...s.sectionTitle, marginBottom:"14px" }}>Quick Actions</h3>
            <div style={s.actions}>
              {[
                { label:"Submit Availability", icon:"🗓", link:"/outlet-casual-staff/availability" },
                { label:"View My Shifts",      icon:"📅", link:"/outlet-casual-staff/shifts" },
                { label:"Notifications",       icon:"🔔", link:"/outlet-casual-staff/notifications" },
              ].map(a => (
                <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </CasualLayout>
  );
}

function getMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
function getSunday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + 7;
  d.setDate(diff);
  return d.toISOString().split("T")[0];
}
function fmtDay(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"short" });
}
function fmtDayNum(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric" });
}

const s = {
  loading: { display:"flex", alignItems:"center", justifyContent:"center",
    height:"200px", color:"#7A7870", fontSize:"14px" },
  welcome: { marginBottom:"24px" },
  welcomeTitle: { fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub: { fontSize:"14px", color:"#7A7870" },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
    gap:"16px", marginBottom:"20px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px",
    padding:"20px", display:"flex", gap:"14px", alignItems:"flex-start", cursor:"pointer" },
  cardIcon: { width:"44px", height:"44px", borderRadius:"10px", display:"flex",
    alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue: { fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel: { fontSize:"13px", fontWeight:"600", color:"#1C1B18", marginTop:"4px" },
  reminder: { background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:"12px",
    padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px",
    marginBottom:"20px", flexWrap:"wrap" },
  reminderIcon: { fontSize:"20px", flexShrink:0 },
  reminderTitle: { fontSize:"14px", fontWeight:"700", color:"#92400E" },
  reminderSub: { fontSize:"12px", color:"#B45309", marginTop:"2px" },
  reminderBtn: { marginLeft:"auto", background:"#D97706", color:"#FFFFFF", border:"none",
    padding:"8px 16px", borderRadius:"8px", fontSize:"13px",
    fontWeight:"600", cursor:"pointer", flexShrink:0 },
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
  ackPending: { fontSize:"11px", fontWeight:"600", color:"#D97706",
    background:"#FFFBEB", padding:"3px 8px", borderRadius:"100px", flexShrink:0 },
  actions: { display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn: { display:"flex", alignItems:"center", gap:"8px",
    padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", fontSize:"13px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },
};
