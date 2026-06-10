import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ pendingRequests:0, activeWorkers:0, confirmedToday:0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [reqRes, workersRes] = await Promise.all([
          api.get("/api/krewby/requests"),
          api.get("/api/krewby/workers"),
        ]);
        const requests = reqRes.requests || reqRes.data || [];
        const pending = requests.filter(r => r.status === "pending_review").length;
        const confirmed = requests.filter(r => r.status === "confirmed").length;
        const activeWorkers = (workersRes.workers || workersRes.data || []).filter(w => w.is_active).length;
        setStats({ pendingRequests: pending, activeWorkers, confirmedToday: confirmed });
        setRecentRequests(requests.slice(0, 5));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const cards = [
    { label:"Pending Review", value:stats.pendingRequests, sub:"Awaiting coordinator", icon:"⏳", color:"#D97706", bg:"#FFFBEB", link:"/krewby-coordinator/requests" },
    { label:"Active Workers", value:stats.activeWorkers, sub:"In Krewby roster", icon:"👷", color:"#059669", bg:"#ECFDF5", link:"/krewby-coordinator/workers" },
    { label:"Confirmed Shifts", value:stats.confirmedToday, sub:"Total confirmed", icon:"✅", color:"#2563EB", bg:"#EFF6FF", link:"/krewby-coordinator/requests" },
  ];

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning"; if (h < 17) return "afternoon"; return "evening";
  }

  return (
    <CoordinatorLayout title="Dashboard">
      {loading ? <div style={s.loading}>Loading…</div> : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Coordinator"} 👋</h2>
            <p style={s.welcomeSub}>Krewby coordinator overview</p>
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
              <h3 style={s.sectionTitle}>Recent Requests</h3>
              <button style={s.viewAll} onClick={() => navigate("/krewby-coordinator/requests")}>View all →</button>
            </div>
            {recentRequests.length === 0 ? <div style={s.empty}>No requests yet.</div> : (
              <div style={s.table}>
                <div style={s.tableHead}><span>Date</span><span>Outlet</span><span>Role</span><span>Status</span></div>
                {recentRequests.map(req => (
                  <div key={req.request_id} style={s.tableRow} onClick={() => navigate(`/krewby-coordinator/requests/${req.request_id}`)}>
                    <span>{fmtDate(req.shift_date)}</span>
                    <span>{req.outlet?.name || "—"}</span>
                    <span>{req.role_name}</span>
                    <span><span style={{ ...s.badge, ...statusStyle(req.status) }}>{req.status.replace("_"," ")}</span></span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={s.section}>
            <h3 style={{ ...s.sectionTitle, marginBottom:"14px" }}>Quick Actions</h3>
            <div style={s.actions}>
              {[
                { label:"Review Requests", icon:"📋", link:"/krewby-coordinator/requests" },
                { label:"Manage Workers", icon:"👷", link:"/krewby-coordinator/workers" },
                { label:"View Availability", icon:"📆", link:"/krewby-coordinator/availability" },
              ].map(a => (
                <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </CoordinatorLayout>
  );
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
function statusStyle(status) {
  const map = { pending_review:{ background:"#FFFBEB", color:"#D97706" }, matched:{ background:"#DBEAFE", color:"#1E40AF" }, confirmed:{ background:"#DCFCE7", color:"#166534" }, rejected:{ background:"#FEE2E2", color:"#991B1B" }, cancelled:{ background:"#F3F4F6", color:"#6B7280" } };
  return map[status] || { background:"#F3F4F6", color:"#6B7280" };
}
const s = {
  loading:{ textAlign:"center", padding:"60px", color:"#7A7870" },
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
  tableHead:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"8px 12px", background:"#F7F6F3", borderRadius:"8px", fontSize:"12px", fontWeight:"600", color:"#7A7870", marginBottom:"4px", gap:"8px" },
  tableRow:{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", padding:"10px 12px", borderRadius:"8px", cursor:"pointer", fontSize:"13px", gap:"8px", alignItems:"center", borderBottom:"1px solid #F0EDE8" },
  badge:{ display:"inline-block", padding:"3px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  actions:{ display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn:{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
};
