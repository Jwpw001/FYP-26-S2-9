import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import WorkerLayout from "../../components/layout/WorkerLayout";

if (typeof document !== "undefined" && !document.getElementById("worker-dash-styles")) {
  const style = document.createElement("style");
  style.id = "worker-dash-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .worker-stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.1) !important; }
    .worker-action-btn:hover { background:#EFF6FF !important; border-color:#BFDBFE !important; color:#1D4ED8 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

export default function WorkerDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [profile, setProfile]       = useState(null);
  const [upcomingJobs, setUpcomingJobs] = useState([]);
  const [unread, setUnread]         = useState(0);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().split("T")[0];

        const [{ data: worker }, { data: jobs }, { count: unreadCount }] = await Promise.all([
          supabase.from("krewby_workers")
            .select("krewby_worker_id, rating, total_jobs, preferred_location, is_active")
            .eq("user_id", userId).single(),
          supabase.from("shift_assignments")
            .select(`assignment_id, status, acknowledged, krewby_worker_id,
              shifts ( shift_id, title, shift_date, start_time, end_time, outlets ( name ) )`)
            .eq("krewby_worker_id", userId) // will fix with worker_id after profile loads
            .limit(4),
          supabase.from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("recipient_id", userId).eq("is_read", false),
        ]);

        if (!cancelled) {
          setProfile(worker);
          setUnread(unreadCount || 0);
          // fetch jobs using krewby_worker_id from profile
          if (worker?.krewby_worker_id) {
            const { data: jobsData } = await supabase
              .from("shift_assignments")
              .select(`assignment_id, status, acknowledged,
                shifts ( shift_id, title, shift_date, start_time, end_time, outlets ( name, address ) )`)
              .eq("krewby_worker_id", worker.krewby_worker_id)
              .gte("shifts.shift_date", today)
              .order("assignment_id", { ascending: true })
              .limit(4);
            if (!cancelled) setUpcomingJobs((jobsData || []).filter(j => j.shifts));
          }
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
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
    { label: "Upcoming Jobs",    value: upcomingJobs.length,                      icon: "💼", color: "#3B82F6", bg: "#EFF6FF", link: "/krewby-worker/jobs" },
    { label: "Jobs Completed",   value: profile?.total_jobs ?? 0,                 icon: "✅", color: "#10B981", bg: "#ECFDF5", link: "/krewby-worker/jobs" },
    { label: "My Rating",        value: profile ? `⭐ ${Number(profile.rating || 5).toFixed(1)}` : "—", icon: "⭐", color: "#F59E0B", bg: "#FFFBEB", link: null },
    { label: "Notifications",    value: unread,                                   icon: "🔔", color: "#8B5CF6", bg: "#F5F3FF", link: "/krewby-worker/notifications" },
  ];

  return (
    <WorkerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's an overview of your upcoming jobs.</p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <Shimmer w="44px" h="44px" r="10px" />
                <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
                <div style={{ marginTop: "8px" }}><Shimmer w="100px" h="13px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {statCards.map((card, i) => (
              <div key={card.label}
                className="worker-stat-card"
                onClick={() => card.link && navigate(card.link)}
                style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", cursor: card.link ? "pointer" : "default", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "transform 0.18s, box-shadow 0.18s", animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both` }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "14px" }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Preferred location banner */}
        {!loading && profile?.preferred_location && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "14px 18px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px", animation: "fadeSlideUp 0.4s ease 0.28s both" }}>
            <span style={{ fontSize: "18px" }}>📍</span>
            <p style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: "500" }}>
              Preferred area: <strong>{profile.preferred_location}</strong>
            </p>
          </div>
        )}

        {/* Upcoming jobs */}
        <div style={sec}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={secTitle}>Upcoming Jobs</h3>
            <button style={viewAllBtn} onClick={() => navigate("/krewby-worker/jobs")}>View all →</button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="44px" h="44px" r="10px" />
                  <div style={{ flex: 1 }}><Shimmer w="55%" h="14px" r="5px" /><div style={{ marginTop: "7px" }}><Shimmer w="40%" h="12px" r="4px" /></div></div>
                </div>
              ))}
            </div>
          ) : upcomingJobs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "#94A3B8", fontSize: "14px" }}>
              No upcoming jobs — you're all clear! ✓
            </div>
          ) : (
            upcomingJobs.map((j, i) => (
              <div key={j.assignment_id}
                style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: "1px solid #F1F5F9", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: "#EFF6FF", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "#3B82F6", textTransform: "uppercase" }}>
                    {new Date(j.shifts.shift_date).toLocaleDateString("en-SG", { month: "short" })}
                  </span>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>
                    {new Date(j.shifts.shift_date).getDate()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{j.shifts.title || "Job"}</p>
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                    {j.shifts.start_time?.slice(0,5)} – {j.shifts.end_time?.slice(0,5)}
                    {j.shifts.outlets?.name && ` · ${j.shifts.outlets.name}`}
                  </p>
                </div>
                {!j.acknowledged && (
                  <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706", flexShrink: 0 }}>
                    Needs ack
                  </span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div style={sec}>
          <h3 style={{ ...secTitle, marginBottom: "14px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[
              { label: "My Jobs",      icon: "💼", link: "/krewby-worker/jobs" },
              { label: "Availability", icon: "🗓", link: "/krewby-worker/availability" },
              { label: "Notifications",icon: "🔔", link: "/krewby-worker/notifications" },
            ].map(a => (
              <button key={a.label}
                className="worker-action-btn"
                onClick={() => navigate(a.link)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer", transition: "all 0.15s" }}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </WorkerLayout>
  );
}

const sec     = { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const secTitle = { fontSize: "15px", fontWeight: "700", color: "#1E293B" };
const viewAllBtn = { background: "none", border: "none", fontSize: "13px", color: "#3B82F6", fontWeight: "600", cursor: "pointer" };
