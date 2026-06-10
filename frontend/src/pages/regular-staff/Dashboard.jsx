import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

export default function RegularDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ upcomingShifts:0, pendingLeave:0 });
  const [nextShift, setNextShift] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [shiftsRes, leaveRes] = await Promise.all([
          api.get("/api/shifts"),
          api.get("/api/availability"),
        ]);
        if (cancelled) return;
        const today = new Date().toISOString().split("T")[0];
        const upcoming = (shiftsRes.shifts || shiftsRes.data || []).filter(s => s.shift_date >= today).sort((a,b) => a.shift_date.localeCompare(b.shift_date));
        const pendingLeave = (leaveRes.availability || leaveRes.data || []).filter(r => r.status === "pending").length;
        setStats({ upcomingShifts: upcoming.length, pendingLeave });
        setNextShift(upcoming[0] || null);
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning"; if (h < 17) return "afternoon"; return "evening";
  }

  return (
    <StaffLayout title="Dashboard">
      {loading ? <div style={s.loading}>Loading…</div> : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋</h2>
            <p style={s.welcomeSub}>Here's your schedule overview.</p>
          </div>
          <div style={s.grid}>
            <div style={s.card} onClick={() => navigate("/regular-staff/shifts")}>
              <div style={{ ...s.cardIcon, background:"#EFF6FF", color:"#2563EB" }}>📅</div>
              <div>
                <p style={s.cardValue}>{stats.upcomingShifts}</p>
                <p style={s.cardLabel}>Upcoming Shifts</p>
              </div>
            </div>
            <div style={s.card} onClick={() => navigate("/regular-staff/leave")}>
              <div style={{ ...s.cardIcon, background:"#FFFBEB", color:"#D97706" }}>📋</div>
              <div>
                <p style={s.cardValue}>{stats.pendingLeave}</p>
                <p style={s.cardLabel}>Pending Leave</p>
              </div>
            </div>
          </div>
          {nextShift && (
            <div style={s.nextShift} onClick={() => navigate("/regular-staff/shifts")}>
              <p style={s.nextShiftLabel}>Next Shift</p>
              <p style={s.nextShiftTitle}>{nextShift.title || "Shift"}</p>
              <p style={s.nextShiftMeta}>{fmtDate(nextShift.shift_date)} · {nextShift.start_time?.slice(0,5)} – {nextShift.end_time?.slice(0,5)}</p>
            </div>
          )}
          <div style={s.actions}>
            {[
              { label:"My Shifts", icon:"📅", link:"/regular-staff/shifts" },
              { label:"Leave Request", icon:"📋", link:"/regular-staff/leave" },
              { label:"Swap Request", icon:"🔄", link:"/regular-staff/swap" },
            ].map(a => (
              <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </StaffLayout>
  );
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"short", month:"short", day:"numeric" });
}
const s = {
  loading:{ textAlign:"center", padding:"60px", color:"#7A7870" },
  welcome:{ marginBottom:"24px" },
  welcomeTitle:{ fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub:{ fontSize:"14px", color:"#7A7870" },
  grid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"20px" },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", display:"flex", gap:"14px", alignItems:"center", cursor:"pointer" },
  cardIcon:{ width:"44px", height:"44px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue:{ fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel:{ fontSize:"13px", fontWeight:"600", color:"#7A7870", marginTop:"4px" },
  nextShift:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", marginBottom:"20px", cursor:"pointer" },
  nextShiftLabel:{ fontSize:"11px", fontWeight:"600", color:"#7A7870", textTransform:"uppercase", marginBottom:"6px" },
  nextShiftTitle:{ fontSize:"16px", fontWeight:"700", color:"#1C1B18" },
  nextShiftMeta:{ fontSize:"13px", color:"#7A7870", marginTop:"4px" },
  actions:{ display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn:{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
};
