import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ workers: 0, activeJobs: 0, pending: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [{ count: workers }, { count: activeJobs }] = await Promise.all([
          supabase.from("krewby_workers").select("*", { count:"exact", head:true }).eq("is_active", true),
          supabase.from("shift_assignments").select("*", { count:"exact", head:true })
            .not("krewby_worker_id", "is", null).eq("status", "assigned"),
        ]);
        if (!cancelled) setStats({
          workers: workers || 0,
          activeJobs: activeJobs || 0,
          pending: 0,
        });
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label:"Active Workers",  value:stats.workers,    icon:"👥", color:"#2563EB", bg:"#EFF6FF", link:"/krewby-coordinator/workers" },
    { label:"Active Jobs",     value:stats.activeJobs, icon:"💼", color:"#059669", bg:"#ECFDF5", link:"/krewby-coordinator/requests" },
    { label:"Pending Requests",value:stats.pending,    icon:"📋", color:"#D97706", bg:"#FFFBEB", link:"/krewby-coordinator/requests" },
  ];

  return (
    <CoordinatorLayout title="Dashboard">
      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>Krewby Coordinator Dashboard</h2>
            <p style={s.welcomeSub}>Manage Krewby worker assignments and requests.</p>
          </div>

          <div style={s.grid}>
            {cards.map(card => (
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

          <div style={s.section}>
            <h3 style={{ ...s.sectionTitle, marginBottom:"14px" }}>Quick Actions</h3>
            <div style={s.actions}>
              {[
                { label:"View Requests",  icon:"📋", link:"/krewby-coordinator/requests" },
                { label:"Manage Workers", icon:"👥", link:"/krewby-coordinator/workers" },
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

const s = {
  loading: { display:"flex", alignItems:"center", justifyContent:"center",
    height:"200px", color:"#7A7870", fontSize:"14px" },
  welcome: { marginBottom:"24px" },
  welcomeTitle: { fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub: { fontSize:"14px", color:"#7A7870" },
  grid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",
    gap:"16px", marginBottom:"24px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px",
    padding:"20px", display:"flex", gap:"14px", alignItems:"flex-start", cursor:"pointer" },
  cardIcon: { width:"44px", height:"44px", borderRadius:"10px", display:"flex",
    alignItems:"center", justifyContent:"center", fontSize:"20px", flexShrink:0 },
  cardValue: { fontSize:"26px", fontWeight:"800", color:"#1C1B18", lineHeight:1 },
  cardLabel: { fontSize:"13px", fontWeight:"600", color:"#1C1B18", marginTop:"4px" },
  section: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  actions: { display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn: { display:"flex", alignItems:"center", gap:"8px",
    padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", fontSize:"13px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },
};
