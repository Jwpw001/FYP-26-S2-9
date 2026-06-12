import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

if (typeof document !== "undefined" && !document.getElementById("coord-dash-styles")) {
  const style = document.createElement("style");
  style.id = "coord-dash-styles";
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
    .coord-stat-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .coord-action-btn:hover { background: #E0F2FE !important; border-color: #7DD3FC !important; color: #0369A1 !important; }
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

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const user = getUser();

  const [stats, setStats]           = useState({ totalWorkers: 0, pendingAssignments: 0, unread: 0 });
  const [recentRequests, setRecentRequests] = useState([]);
  const [loading, setLoading]       = useState(true);
  const userId = user?.user_id;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          { count: totalWorkers },
          { count: pendingAssignments },
          { count: unread },
          { data: assignmentRows },
        ] = await Promise.all([
          supabase.from("krewby_workers").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("krewby_requests").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
          supabase.from("notifications").select("*", { count: "exact", head: true }).eq("recipient_id", userId).eq("is_read", false),
          supabase.from("krewby_requests")
            .select(`request_id, role_name, shift_date, status, outlets(name)`)
            .eq("status", "pending_review")
            .order("created_at", { ascending: false }).limit(6),
        ]);

        if (cancelled) return;
        setStats({
          totalWorkers: totalWorkers || 0,
          pendingAssignments: pendingAssignments || 0,
          unread: unread || 0,
        });

        setRecentRequests((assignmentRows || []).map(r => ({
          type: "request", id: r.request_id,
          name: r.outlets?.name || "Unknown outlet",
          detail: `${r.role_name} · ${fmtDate(r.shift_date)}`,
        })));
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
    { label: "Active Workers",       value: stats.totalWorkers,       icon: "👷", color: "#0EA5E9", bg: "#E0F2FE", link: "/krewby-coordinator/workers" },
    { label: "Pending Assignments",  value: stats.pendingAssignments, icon: "📋", color: "#D97706", bg: "#FFFBEB", link: "/krewby-coordinator/requests" },
    { label: "Unread Notifications", value: stats.unread,             icon: "🔔", color: "#059669", bg: "#ECFDF5", link: "/krewby-coordinator/notifications" },
  ];

  return (
    <CoordinatorLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"} 👋
          </h2>
          <p style={{ fontSize: "14px", color: "#64748B" }}>Here's an overview of your Krewby casual workers.</p>
        </div>

        {/* Stat cards */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <Shimmer w="44px" h="44px" r="10px" />
                <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
                <div style={{ marginTop: "8px" }}><Shimmer w="110px" h="13px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "16px", marginBottom: "28px" }}>
            {statCards.map((card, i) => (
              <div key={card.label}
                className="coord-stat-card"
                onClick={() => navigate(card.link)}
                style={{
                  background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px",
                  padding: "22px", cursor: "pointer",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                  transition: "transform 0.18s, box-shadow 0.18s",
                  animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both`,
                }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: card.bg, color: card.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", marginBottom: "14px" }}>
                  {card.icon}
                </div>
                <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{card.value}</p>
                <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Pending requests preview */}
        <div style={s.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={s.sectionTitle}>Pending Assignments</h3>
            <button style={s.viewAll} onClick={() => navigate("/krewby-coordinator/requests")}>View all →</button>
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="32px" h="32px" r="50%" />
                  <div style={{ flex: 1 }}><Shimmer w="55%" h="13px" r="5px" /><div style={{ marginTop: "6px" }}><Shimmer w="35%" h="11px" r="4px" /></div></div>
                  <Shimmer w="70px" h="22px" r="100px" />
                </div>
              ))}
            </div>
          ) : recentRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0", color: "#94A3B8", fontSize: "14px" }}>
              No pending assignments — all clear! ✓
            </div>
          ) : (
            recentRequests.map((r, i) => (
              <div key={`${r.type}-${r.id}`}
                onClick={() => navigate("/krewby-coordinator/requests")}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 0", borderBottom: "1px solid #F1F5F9", cursor: "pointer", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0 }}>
                  📋
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{r.name}</p>
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{r.detail}</p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706", flexShrink: 0 }}>Pending</span>
              </div>
            ))
          )}
        </div>

        {/* Quick actions */}
        <div style={s.section}>
          <h3 style={{ ...s.sectionTitle, marginBottom: "14px" }}>Quick Actions</h3>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
            {[
              { label: "View Requests",    icon: "📋", link: "/krewby-coordinator/requests" },
              { label: "Manage Workers",   icon: "👥", link: "/krewby-coordinator/workers" },
              { label: "Notifications",    icon: "🔔", link: "/krewby-coordinator/notifications" },
            ].map(a => (
              <button key={a.label}
                className="coord-action-btn"
                onClick={() => navigate(a.link)}
                style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer", transition: "all 0.15s" }}>
                <span>{a.icon}</span>{a.label}
              </button>
            ))}
          </div>
        </div>

      </div>
    </CoordinatorLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

const s = {
  section: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  viewAll: { background: "none", border: "none", fontSize: "13px", color: "#0EA5E9", fontWeight: "600", cursor: "pointer" },
};
