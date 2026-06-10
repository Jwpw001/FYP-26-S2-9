import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ upcomingShifts:0, pendingLeave:0, pendingSwaps:0, totalStaff:0 });
  const [recentShifts, setRecentShifts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [shiftsRes, staffRes, leaveRes] = await Promise.all([
          api.get("/api/shifts"),
          api.get("/api/staff"),
          api.get("/api/availability"),
        ]);
        if (cancelled) return;
        const today = new Date().toISOString().split("T")[0];
        const future = new Date(Date.now() + 7*86400000).toISOString().split("T")[0];
        const upcoming = (shiftsRes.shifts || shiftsRes.data || []).filter(s => s.shift_date >= today && s.shift_date <= future);
        const pendingLeave = (leaveRes.availability || leaveRes.availability || leaveRes.data || []).filter(r => r.status === "pending").length;
        setStats({
          upcomingShifts: upcoming.length,
          totalStaff: (staffRes.staff || staffRes.data || []).filter(s => s.is_active).length,
          pendingLeave,
          pendingSwaps: 0,
        });
        setRecentShifts(upcoming.slice(0, 5));
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label:"Upcoming Shifts", value:stats.upcomingShifts, sub:"Next 7 days", icon:"📅", color:"#2563EB", bg:"#EFF6FF", link:"/outlet-manager/shifts" },
    { label:"Total Staff", value:stats.totalStaff, sub:"Active members", icon:"👥", color:"#059669", bg:"#ECFDF5", link:"/outlet-manager/staff" },
    { label:"Pending Leave", value:stats.pendingLeave, sub:"Awaiting approval", icon:"📋", color:"#D97706", bg:"#FFFBEB", link:"/outlet-manager/availability" },
    { label:"Swap Requests", value:stats.pendingSwaps, sub:"Needs review", icon:"🔄", color:"#7C3AED", bg:"#F5F3FF", link:"/outlet-manager/shifts" },
  ];

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning"; if (h < 17) return "afternoon"; return "evening";
  }

  return (
    <ManagerLayout title="Dashboard">
      {loading ? <div style={s.loading}>Loading dashboard…</div> : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Manager"} 👋</h2>
            <p style={s.welcomeSub}>Here's what needs your attention today.</p>
          </div>
          <div style={s.grid}>
            {cards.map(card => (
              <div key={card.label} style={s.card} onClick={() => navigate(card.link)}>
                <div style={{ ...s.cardIcon, background:card.bg, color:card.color }}>{card.icon}</div>
                <div>
                  <p style={s.cardValue}>{card.value}</p>
                  <p style={s.cardLabel}>{card.label}</p>
                  <p style={s.cardSub}>{card.sub}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Upcoming Shifts</h3>
              <button style={s.viewAll} onClick={() => navigate("/outlet-manager/shifts")}>View all →</button>
            </div>
            {recentShifts.length === 0 ? <div style={s.empty}>No shifts in the next 7 days.</div> : (
              <div style={s.table}>
                <div style={s.tableHead}><span>Date</span><span>Title</span><span>Time</span><span>Status</span></div>
                {recentShifts.map(shift => (
                  <div key={shift.shift_id} style={s.tableRow} onClick={() => navigate(`/outlet-manager/shifts/${shift.shift_id}`)}>
                    <span>{fmtDate(shift.shift_date)}</span>
                    <span>{shift.title || "Untitled"}</span>
                    <span>{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</span>
                    <span><span style={{ ...s.badge, ...badgeStyle(shift.status) }}>{shift.status}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={s.section}>
            <h3 style={{ ...s.sectionTitle, marginBottom:"14px" }}>Quick Actions</h3>
            <div style={s.actions}>
              {[
                { label:"Create Shift", icon:"➕", link:"/outlet-manager/shifts/new" },
                { label:"View Staff", icon:"👥", link:"/outlet-manager/staff" },
                { label:"Approve Leave", icon:"✅", link:"/outlet-manager/availability" },
                { label:"View Reports", icon:"📊", link:"/outlet-manager/reports" },
              ].map(a => (
                <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </ManagerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  try {
    const s = String(t);
    if (s.length === 5 && s[2] === ':') return s;
    if (s.length >= 8 && s[2] === ':') return s.slice(0, 5);
    if (s.includes("T")) return s.split("T")[1].slice(0, 5);
    return "—";
  } catch { return "—"; }
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    const s = String(d);
    const clean = s.includes("T") ? s.split("T")[0] : s;
    const dt = new Date(clean + "T00:00:00Z");
    if (isNaN(dt.getTime())) return s;
    return dt.toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  } catch { return "—"; }
}
function badgeStyle(status) {
  const map = { draft:{ background:"#F3F4F6", color:"#6B7280" }, published:{ background:"#DCFCE7", color:"#166534" }, completed:{ background:"#DBEAFE", color:"#1E40AF" }, cancelled:{ background:"#FEE2E2", color:"#991B1B" } };
  return map[status] || map.draft;
}
const s = {
  loading:{ display:"flex", alignItems:"center", justifyContent:"center", height:"200px", color:"#7A7870", fontSize:"14px" },
  welcome:{ marginBottom:"24px" },
  welcomeTitle:{ fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub:{ fontSize:"14px", color:"#7A7870" },
  grid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"16px", marginBottom:"24px" },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", display:"flex", gap:"14px", alignItems:"flex-start", cursor:"pointer" },
  cardIcon:{ width:"44px", height:"44px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue:{ fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel:{ fontSize:"13px", fontWeight:"600", color:"#1C1B18", marginTop:"4px" },
  cardSub:{ fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  section:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  sectionHeader:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"16px" },
  sectionTitle:{ fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  viewAll:{ background:"none", border:"none", fontSize:"13px", color:"#2563EB", fontWeight:"600", cursor:"pointer" },
  empty:{ textAlign:"center", padding:"32px", color:"#7A7870", fontSize:"14px" },
  table:{ width:"100%" },
  tableHead:{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 1fr", padding:"8px 12px", background:"#F7F6F3", borderRadius:"8px", fontSize:"12px", fontWeight:"600", color:"#7A7870", marginBottom:"4px", gap:"8px" },
  tableRow:{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 1fr", padding:"10px 12px", borderRadius:"8px", cursor:"pointer", fontSize:"13px", gap:"8px", alignItems:"center", borderBottom:"1px solid #F0EDE8", color:"#1C1B18" },
  badge:{ display:"inline-block", padding:"3px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  actions:{ display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn:{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
};
