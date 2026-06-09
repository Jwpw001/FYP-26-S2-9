import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import WorkerLayout from "../../components/layout/WorkerLayout";

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [workerProfile, setWorkerProfile] = useState(null);
  const [upcomingJobs, setUpcomingJobs]   = useState([]);
  const [, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [{ data: worker }, { data: jobs }, { data: notifs }] = await Promise.all([
          supabase.from("krewby_workers")
            .select("krewby_worker_id, rating, total_jobs, preferred_location, is_active")
            .eq("user_id", userId).single(),
          supabase.from("shift_assignments")
            .select(`
              assignment_id, status, acknowledged,
              shifts ( shift_id, title, shift_date, start_time, end_time, status,
                outlets ( name, address ) )
            `)
            .not("krewby_worker_id", "is", null)
            .gte("shifts.shift_date", today)
            .order("shifts.shift_date", { ascending: true })
            .limit(4),
          supabase.from("notifications")
            .select("notification_id, title, message, is_read, created_at")
            .eq("recipient_id", userId)
            .order("created_at", { ascending: false })
            .limit(3),
        ]);

        if (!cancelled) {
          setWorkerProfile(worker);
          setUpcomingJobs((jobs || []).filter(j => j.shifts));
          setNotifications(notifs || []);
        }
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
    <WorkerLayout title="Dashboard">
      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          <div style={s.welcome}>
            <h2 style={s.welcomeTitle}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
            </h2>
            <p style={s.welcomeSub}>Here are your upcoming jobs.</p>
          </div>

          {/* Worker stats */}
          {workerProfile && (
            <div style={s.statsRow}>
              <div style={s.statCard}>
                <p style={s.statValue}>⭐ {Number(workerProfile.rating || 5).toFixed(1)}</p>
                <p style={s.statLabel}>Rating</p>
              </div>
              <div style={s.statCard}>
                <p style={s.statValue}>{workerProfile.total_jobs || 0}</p>
                <p style={s.statLabel}>Jobs Completed</p>
              </div>
              <div style={s.statCard}>
                <p style={s.statValue}>{upcomingJobs.length}</p>
                <p style={s.statLabel}>Upcoming Jobs</p>
              </div>
            </div>
          )}

          {/* Upcoming jobs */}
          <div style={s.section}>
            <div style={s.sectionHeader}>
              <h3 style={s.sectionTitle}>Upcoming Jobs</h3>
              <button style={s.viewAll} onClick={() => navigate("/krewby-worker/jobs")}>
                View all →
              </button>
            </div>
            {upcomingJobs.length === 0 ? (
              <div style={s.empty}>No upcoming jobs assigned.</div>
            ) : (
              upcomingJobs.map(j => (
                <div key={j.assignment_id} style={s.jobRow}>
                  <div style={s.jobDate}>
                    <p style={s.jobDay}>{fmtDay(j.shifts?.shift_date)}</p>
                    <p style={s.jobDayNum}>{fmtDayNum(j.shifts?.shift_date)}</p>
                  </div>
                  <div style={s.jobInfo}>
                    <p style={s.jobTitle}>{j.shifts?.title || "Job"}</p>
                    <p style={s.jobMeta}>
                      {j.shifts?.start_time?.slice(0,5)} – {j.shifts?.end_time?.slice(0,5)}
                      {j.shifts?.outlets?.name && ` · ${j.shifts.outlets.name}`}
                    </p>
                    {j.shifts?.outlets?.address && (
                      <p style={s.jobAddr}>{j.shifts.outlets.address}</p>
                    )}
                  </div>
                  {!j.acknowledged && j.shifts?.status === "published" && (
                    <span style={s.ackPending}>Needs ack</span>
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
                { label:"My Jobs",       icon:"💼", link:"/krewby-worker/jobs" },
                { label:"Availability",  icon:"🗓", link:"/krewby-worker/availability" },
                { label:"Notifications", icon:"🔔", link:"/krewby-worker/notifications" },
              ].map(a => (
                <button key={a.label} style={s.actionBtn} onClick={() => navigate(a.link)}>
                  <span>{a.icon}</span>{a.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </WorkerLayout>
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

const s = {
  loading: { display:"flex", alignItems:"center", justifyContent:"center",
    height:"200px", color:"#7A7870", fontSize:"14px" },
  welcome: { marginBottom:"24px" },
  welcomeTitle: { fontSize:"22px", fontWeight:"800", color:"#1C1B18", marginBottom:"4px" },
  welcomeSub: { fontSize:"14px", color:"#7A7870" },
  statsRow: { display:"grid", gridTemplateColumns:"repeat(3,1fr)",
    gap:"12px", marginBottom:"20px" },
  statCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"12px", padding:"16px", textAlign:"center" },
  statValue: { fontSize:"22px", fontWeight:"800", color:"#1C1B18" },
  statLabel: { fontSize:"12px", color:"#7A7870", marginTop:"4px" },
  section: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  sectionHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"16px" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  viewAll: { background:"none", border:"none", fontSize:"13px",
    color:"#2563EB", fontWeight:"600", cursor:"pointer" },
  empty: { textAlign:"center", padding:"24px", color:"#7A7870", fontSize:"14px" },
  jobRow: { display:"flex", alignItems:"center", gap:"14px",
    padding:"12px 0", borderBottom:"1px solid #F0EDE8" },
  jobDate: { textAlign:"center", minWidth:"40px" },
  jobDay: { fontSize:"11px", fontWeight:"600", color:"#7A7870", textTransform:"uppercase" },
  jobDayNum: { fontSize:"13px", fontWeight:"700", color:"#1C1B18" },
  jobInfo: { flex:1 },
  jobTitle: { fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  jobMeta: { fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  jobAddr: { fontSize:"11px", color:"#A09D97", marginTop:"1px" },
  ackPending: { fontSize:"11px", fontWeight:"600", color:"#D97706",
    background:"#FFFBEB", padding:"3px 8px", borderRadius:"100px", flexShrink:0 },
  actions: { display:"flex", flexWrap:"wrap", gap:"10px" },
  actionBtn: { display:"flex", alignItems:"center", gap:"8px",
    padding:"10px 16px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"10px", fontSize:"13px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },
};
