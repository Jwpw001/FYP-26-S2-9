import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";
import { HardHat, ClipboardList, CheckCircle2, Star, Users, TrendingUp, CalendarCheck } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("coord-dash-styles")) {
  const style = document.createElement("style");
  style.id = "coord-dash-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes barGrow { from { width:0; } to { width:var(--bar-w); } }
    .coord-stat-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.1) !important; }
    .req-row:hover { background:#F8FAFC !important; }
    .worker-row:hover { background:#F8FAFC !important; }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d.toISOString().split("T")[0];
}

export default function CoordinatorDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [stats, setStats]               = useState({ totalWorkers: 0, pendingAssignments: 0, completedThisMonth: 0 });
  const [statusBreakdown, setStatusBreakdown] = useState({ pending_review: 0, assigned: 0, approved: 0, completed: 0 });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [topWorkers, setTopWorkers]     = useState([]);
  const [availableWorkers, setAvailableWorkers] = useState([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const weekStart = getWeekStart();
        const monthStart = new Date();
        monthStart.setDate(1);
        const monthStartStr = monthStart.toISOString().split("T")[0];

        const [
          { count: totalWorkers },
          { count: pendingCount },
          { count: completedThisMonth },
          { data: allRequests },
          { data: workers },
          { data: availRows },
        ] = await Promise.all([
          supabase.from("krewby_workers").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("krewby_requests").select("*", { count: "exact", head: true }).eq("status", "pending_review"),
          supabase.from("krewby_requests").select("*", { count: "exact", head: true }).eq("status", "completed").gte("shift_date", monthStartStr),
          supabase.from("krewby_requests").select("request_id, role_name, shift_date, status, outlets(name)").eq("status", "pending_review").order("created_at", { ascending: false }).limit(5),
          supabase.from("krewby_workers").select("krewby_worker_id, total_jobs, rating, preferred_location, is_active, users(full_name, email)").eq("is_active", true).order("rating", { ascending: false }).limit(5),
          supabase.from("krewby_worker_availability").select("krewby_worker_id, day_of_week, krewby_workers(users(full_name), preferred_location, rating)").eq("week_start_date", weekStart),
        ]);

        if (cancelled) return;

        // Status breakdown from all statuses
        const { data: breakdown } = await supabase
          .from("krewby_requests")
          .select("status");
        const counts = { pending_review: 0, assigned: 0, approved: 0, completed: 0 };
        (breakdown || []).forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });

        // Available workers this week (unique by worker)
        const workerAvailMap = {};
        (availRows || []).forEach(row => {
          if (!workerAvailMap[row.krewby_worker_id]) {
            workerAvailMap[row.krewby_worker_id] = { ...row.krewby_workers, krewby_worker_id: row.krewby_worker_id, days: new Set() };
          }
          workerAvailMap[row.krewby_worker_id].days.add(row.day_of_week);
        });

        setStats({ totalWorkers: totalWorkers || 0, pendingAssignments: pendingCount || 0, completedThisMonth: completedThisMonth || 0 });
        setStatusBreakdown(counts);
        setPendingRequests(allRequests || []);
        setTopWorkers(workers || []);
        setAvailableWorkers(Object.values(workerAvailMap));
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
    { label: "Active Workers",       value: stats.totalWorkers,        Icon: HardHat,       iconColor: "#0EA5E9", bg: "#E0F2FE", link: "/krewby-coordinator/workers" },
    { label: "Pending Assignments",  value: stats.pendingAssignments,  Icon: ClipboardList, iconColor: "#D97706", bg: "#FFFBEB", link: "/krewby-coordinator/requests" },
    { label: "Completed This Month", value: stats.completedThisMonth,  Icon: CheckCircle2,  iconColor: "#059669", bg: "#ECFDF5", link: "/krewby-coordinator/requests" },
  ];

  const totalRequests = Object.values(statusBreakdown).reduce((a, b) => a + b, 0) || 1;
  const statusConfig = [
    { key: "pending_review", label: "Pending",   color: "#F59E0B", bg: "#FFFBEB" },
    { key: "assigned",       label: "Assigned",  color: "#3B82F6", bg: "#EFF6FF" },
    { key: "approved",       label: "Approved",  color: "#22C55E", bg: "#F0FDF4" },
    { key: "completed",      label: "Completed", color: "#8B5CF6", bg: "#F5F3FF" },
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "20px" }}>
          {loading ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
              <Shimmer w="44px" h="44px" r="10px" />
              <div style={{ marginTop: "14px" }}><Shimmer w="50px" h="28px" r="6px" /></div>
              <div style={{ marginTop: "8px" }}><Shimmer w="120px" h="13px" r="5px" /></div>
            </div>
          )) : statCards.map((card, i) => (
            <div key={card.label} className="coord-stat-card" onClick={() => navigate(card.link)}
              style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transition: "transform 0.18s, box-shadow 0.18s", animation: `fadeSlideUp 0.35s ease ${i * 0.07}s both` }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "10px", background: card.bg, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "14px" }}>
                <card.Icon size={20} color={card.iconColor} strokeWidth={1.8} />
              </div>
              <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{card.value}</p>
              <p style={{ fontSize: "13px", fontWeight: "500", color: "#64748B", marginTop: "6px" }}>{card.label}</p>
            </div>
          ))}
        </div>

        {/* Main grid: 2 columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "16px", marginBottom: "16px" }}>

          {/* Pending Assignments */}
          <div style={sec}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={secTitle}>Pending Assignments</h3>
              <button style={viewAllBtn} onClick={() => navigate("/krewby-coordinator/requests")}>View all →</button>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "8px 0" }}>
                    <Shimmer w="34px" h="34px" r="50%" />
                    <div style={{ flex: 1 }}><Shimmer w="55%" h="13px" r="5px" /><div style={{ marginTop: "6px" }}><Shimmer w="35%" h="11px" r="4px" /></div></div>
                    <Shimmer w="64px" h="20px" r="100px" />
                  </div>
                ))}
              </div>
            ) : pendingRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <CheckCircle2 size={28} color="#22C55E" style={{ marginBottom: "8px" }} />
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}>All clear — no pending assignments</p>
              </div>
            ) : pendingRequests.map((r, i) => (
              <div key={r.request_id} className="req-row"
                onClick={() => navigate("/krewby-coordinator/requests")}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 8px", borderRadius: "10px", cursor: "pointer", transition: "background 0.15s", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#FFFBEB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ClipboardList size={16} color="#D97706" strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.outlets?.name || "Unknown outlet"}</p>
                  <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{r.role_name} · {fmtDate(r.shift_date)}</p>
                </div>
                <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706", flexShrink: 0 }}>Pending</span>
              </div>
            ))}
          </div>

          {/* Request status breakdown */}
          <div style={sec}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
              <TrendingUp size={16} color="#6366F1" />
              <h3 style={secTitle}>Requests Overview</h3>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="36px" r="8px" />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {statusConfig.map(({ key, label, color, bg }) => {
                  const count = statusBreakdown[key] || 0;
                  const pct = Math.round((count / totalRequests) * 100);
                  return (
                    <div key={key}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569" }}>{label}</span>
                        <span style={{ fontSize: "12px", fontWeight: "700", color }}>{count}</span>
                      </div>
                      <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "100px", transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "4px" }}>Total: {totalRequests === 1 && Object.values(statusBreakdown).reduce((a,b)=>a+b,0) === 0 ? 0 : Object.values(statusBreakdown).reduce((a,b)=>a+b,0)} requests</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom grid: Top workers + Available this week */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>

          {/* Top workers */}
          <div style={sec}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Star size={16} color="#F59E0B" fill="#FCD34D" />
                <h3 style={secTitle}>Top Rated Workers</h3>
              </div>
              <button style={viewAllBtn} onClick={() => navigate("/krewby-coordinator/workers")}>View all →</button>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Shimmer w="36px" h="36px" r="50%" />
                    <div style={{ flex: 1 }}><Shimmer w="60%" h="13px" r="5px" /><div style={{ marginTop: "6px" }}><Shimmer w="40%" h="11px" r="4px" /></div></div>
                    <Shimmer w="40px" h="20px" r="6px" />
                  </div>
                ))}
              </div>
            ) : topWorkers.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "24px 0" }}>No workers yet</p>
            ) : topWorkers.map((w, i) => {
              const name = w.users?.full_name || w.users?.email || "Worker";
              const color = avatarColor(name);
              return (
                <div key={w.krewby_worker_id} className="worker-row"
                  onClick={() => navigate(`/krewby-coordinator/workers/${w.krewby_worker_id}`)}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 8px", borderRadius: "10px", cursor: "pointer", transition: "background 0.15s", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", flexShrink: 0 }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                    <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "1px" }}>{w.total_jobs ?? 0} jobs completed</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                    <Star size={12} color="#F59E0B" fill="#F59E0B" />
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{w.rating ? Number(w.rating).toFixed(1) : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Available this week */}
          <div style={sec}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
              <CalendarCheck size={16} color="#10B981" />
              <h3 style={secTitle}>Available This Week</h3>
            </div>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <Shimmer w="36px" h="36px" r="50%" />
                    <div style={{ flex: 1 }}><Shimmer w="55%" h="13px" r="5px" /><div style={{ marginTop: "6px" }}><Shimmer w="80px" h="11px" r="4px" /></div></div>
                  </div>
                ))}
              </div>
            ) : availableWorkers.length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8" }}>No availability submitted yet</p>
              </div>
            ) : availableWorkers.map((w, i) => {
              const name = w.users?.full_name || "Worker";
              const color = avatarColor(name);
              const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
              return (
                <div key={w.krewby_worker_id} className="worker-row"
                  onClick={() => navigate(`/krewby-coordinator/workers/${w.krewby_worker_id}`)}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 8px", borderRadius: "10px", cursor: "pointer", transition: "background 0.15s", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`, marginBottom: "4px" }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", flexShrink: 0 }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
                    <div style={{ display: "flex", gap: "3px", marginTop: "5px", flexWrap: "wrap" }}>
                      {DAYS.map((d, idx) => (
                        <span key={idx} style={{ fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "4px", background: w.days.has(idx) ? "#DCFCE7" : "#F1F5F9", color: w.days.has(idx) ? "#166534" : "#CBD5E1" }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </CoordinatorLayout>
  );
}

const sec = { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" };
const secTitle = { fontSize: "15px", fontWeight: "700", color: "#1E293B", margin: 0 };
const viewAllBtn = { background: "none", border: "none", fontSize: "13px", color: "#0EA5E9", fontWeight: "600", cursor: "pointer" };
