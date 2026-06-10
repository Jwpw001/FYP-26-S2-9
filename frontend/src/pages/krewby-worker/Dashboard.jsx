import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import WorkerLayout from "../../components/layout/WorkerLayout";

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ pendingJobs:0, confirmedJobs:0, totalJobs:0 });
  const [upcomingJobs, setUpcomingJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get("/api/krewby/my-assignments");
        const jobs = res.assignments || res.data || [];
        const today = new Date().toISOString().split("T")[0];
        const upcoming = jobs.filter(j => j.shift_date >= today).sort((a,b) => a.shift_date.localeCompare(b.shift_date));
        setStats({
          pendingJobs: jobs.filter(j => j.status === "assigned").length,
          confirmedJobs: jobs.filter(j => j.status === "confirmed").length,
          totalJobs: jobs.length,
        });
        setUpcomingJobs(upcoming.slice(0, 3));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return "morning"; if (h < 17) return "afternoon"; return "evening";
  }

  return (
    <WorkerLayout title="Dashboard">
      {loading ? <div style={s.loading}>Loading…</div> : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋</h2>
            <p style={s.welcomeSub}>Your Krewby job overview</p>
          </div>
          <div style={s.grid}>
            <div style={s.card} onClick={() => navigate("/krewby-worker/jobs")}>
              <div style={{ ...s.cardIcon, background:"#FFFBEB", color:"#D97706" }}>⏳</div>
              <div><p style={s.cardValue}>{stats.pendingJobs}</p><p style={s.cardLabel}>Pending Confirmation</p></div>
            </div>
            <div style={s.card} onClick={() => navigate("/krewby-worker/jobs")}>
              <div style={{ ...s.cardIcon, background:"#DCFCE7", color:"#166534" }}>✅</div>
              <div><p style={s.cardValue}>{stats.confirmedJobs}</p><p style={s.cardLabel}>Confirmed Jobs</p></div>
            </div>
            <div style={s.card}>
              <div style={{ ...s.cardIcon, background:"#EFF6FF", color:"#2563EB" }}>📊</div>
              <div><p style={s.cardValue}>{stats.totalJobs}</p><p style={s.cardLabel}>Total Jobs</p></div>
            </div>
          </div>
          {upcomingJobs.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <h3 style={s.sectionTitle}>Upcoming Jobs</h3>
                <button style={s.viewAll} onClick={() => navigate("/krewby-worker/jobs")}>View all →</button>
              </div>
              {upcomingJobs.map(job => (
                <div key={job.assignment_id} style={s.jobCard}>
                  <div>
                    <p style={s.jobTitle}>{job.role_name} — {job.outlet?.name}</p>
                    <p style={s.jobMeta}>{fmtDate(job.shift_date)} · {job.start_time?.slice(0,5)} – {job.end_time?.slice(0,5)}</p>
                  </div>
                  <span style={{ ...s.badge, ...statusStyle(job.status) }}>{job.status}</span>
                </div>
              ))}
            </div>
          )}
          <div style={s.actions}>
            {[
              { label:"My Jobs", icon:"💼", link:"/krewby-worker/jobs" },
              { label:"My Availability", icon:"📆", link:"/krewby-worker/availability" },
            ].map(a => (
              <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </WorkerLayout>
  );
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"short", month:"short", day:"numeric" });
}
function statusStyle(status) {
  const map = { assigned:{ background:"#FFFBEB", color:"#D97706" }, confirmed:{ background:"#DCFCE7", color:"#166534" }, declined:{ background:"#FEE2E2", color:"#991B1B" } };
  return map[status] || { background:"#F3F4F6", color:"#6B7280" };
}
const s = {
  loading:{ textAlign:"center", padding:"60px", color:"#7A7870" },
  welcome:{ marginBottom:"24px" },
  welcomeTitle:{ fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub:{ fontSize:"14px", color:"#7A7870" },
  grid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"16px", marginBottom:"24px" },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", display:"flex", gap:"14px", alignItems:"center", cursor:"pointer" },
  cardIcon:{ width:"44px", height:"44px", borderRadius:"10px", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue:{ fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel:{ fontSize:"12px", fontWeight:"600", color:"#7A7870", marginTop:"4px" },
  section:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  sectionHeader:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" },
  sectionTitle:{ fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  viewAll:{ background:"none", border:"none", fontSize:"13px", color:"#2563EB", fontWeight:"600", cursor:"pointer" },
  jobCard:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #F0EDE8" },
  jobTitle:{ fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  jobMeta:{ fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  badge:{ display:"inline-block", padding:"3px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  actions:{ display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn:{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
};
