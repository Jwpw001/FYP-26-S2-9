import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";
import { ArrowLeft, Star, Briefcase, MapPin, Mail, User } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("coord-worker-detail-styles")) {
  const style = document.createElement("style");
  style.id = "coord-worker-detail-styles";
  style.textContent = `
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    .week-row-btn:hover { background:#EFF6FF !important; border-color:#BFDBFE !important; }
  `;
  document.head.appendChild(style);
}

const DAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function fmtWeekRange(weekStartStr) {
  const start = new Date(weekStartStr + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-SG", opts)} – ${end.toLocaleDateString("en-SG", opts)}`;
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function CoordinatorWorkerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [worker, setWorker]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [allAvail, setAllAvail]       = useState([]);
  const [availLoading, setAvailLoading] = useState(true);
  const [recentJobs, setRecentJobs]   = useState([]);
  const [weekOffset, setWeekOffset]   = useState(0); // index into sorted weeks (0 = latest)

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("krewby_workers")
        .select("krewby_worker_id, total_jobs, rating, preferred_location, is_active, users ( full_name, email, username )")
        .eq("krewby_worker_id", id)
        .single();
      if (!error) setWorker(data);
      setLoading(false);
    }
    load();
  }, [id]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("krewby_requests")
        .select("request_id, role_name, shift_date, manager_rating, outlets ( name )")
        .eq("assigned_worker_id", id)
        .eq("status", "completed")
        .order("shift_date", { ascending: false })
        .limit(10);
      setRecentJobs(data || []);
    }
    load();
  }, [id]);

  // Fetch ALL availability rows via backend (admin client bypasses RLS)
  useEffect(() => {
    async function load() {
      setAvailLoading(true);
      try {
        const res = await api.get(`/api/auth/worker-availability-by-id?worker_id=${id}`);
        setAllAvail(res.availability || []);
      } catch (err) {
        console.error("Availability fetch error:", err);
        setAllAvail([]);
      }
      setAvailLoading(false);
    }
    load();
  }, [id]);

  // Group by week_start_date, newest first
  const weekGroups = Object.entries(
    allAvail.reduce((acc, row) => {
      if (!acc[row.week_start_date]) acc[row.week_start_date] = new Set();
      acc[row.week_start_date].add(row.day_of_week);
      return acc;
    }, {})
  ).sort(([a], [b]) => b.localeCompare(a));

  const currentGroup  = weekGroups[weekOffset];
  const availDays     = currentGroup ? currentGroup[1] : new Set();
  const weekLabel     = currentGroup ? fmtWeekRange(currentGroup[0]) : null;

  const name  = worker?.users?.full_name || worker?.users?.email || "Worker";
  const color = avatarColor(name);

  return (
    <CoordinatorLayout title="Worker Details">
      <div style={{ animation: "pageIn 0.35s ease both" }}>

        <button onClick={() => navigate("/krewby-coordinator/workers")}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "20px", padding: 0 }}>
          <ArrowLeft size={15} strokeWidth={2} /> Back to Workers
        </button>

        {loading ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "16px", alignItems: "center", marginBottom: "20px" }}>
              <Shimmer w="64px" h="64px" r="50%" />
              <div style={{ flex: 1 }}><Shimmer w="200px" h="18px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="150px" h="13px" r="5px" /></div></div>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>{[1,2].map(i => <Shimmer key={i} h="80px" r="12px" />)}</div>
          </div>
        ) : !worker ? (
          <div style={{ textAlign: "center", padding: "60px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" }}>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>Worker not found</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>

            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

              {/* Profile */}
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px" }}>
                  <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: "800", flexShrink: 0 }}>
                    {name[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A" }}>{name}</h2>
                      <span style={{ padding: "2px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: worker.is_active ? "#DCFCE7" : "#F1F5F9", color: worker.is_active ? "#166534" : "#64748B" }}>
                        {worker.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "8px" }}>
                      {worker.users?.email && <InfoChip icon={<Mail size={12} />} text={worker.users.email} />}
                      {worker.users?.username && <InfoChip icon={<User size={12} />} text={`@${worker.users.username}`} />}
                      {worker.preferred_location && <InfoChip icon={<MapPin size={12} />} text={worker.preferred_location} />}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <StatBox icon={<Briefcase size={16} color="#2563EB" />} bg="#EFF6FF" value={worker.total_jobs ?? 0} label="Total Jobs" />
                  <StatBox icon={<Star size={16} color="#D97706" fill="#FCD34D" />} bg="#FFFBEB" value={worker.rating ? Number(worker.rating).toFixed(1) : "—"} label="Avg Rating" />
                </div>
              </div>

              {/* Completed jobs */}
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", marginBottom: "16px" }}>Completed Jobs</h3>
                {recentJobs.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#94A3B8", fontStyle: "italic" }}>No completed jobs yet</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {recentJobs.map(job => (
                      <div key={job.request_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #F1F5F9" }}>
                        <div>
                          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{job.role_name}</p>
                          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
                            {job.outlets?.name} · {new Date(job.shift_date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" })}
                          </p>
                        </div>
                        {job.manager_rating ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                            {[1,2,3,4,5].map(n => (
                              <svg key={n} width="13" height="13" viewBox="0 0 24 24" fill={n <= job.manager_rating ? "#F59E0B" : "#E2E8F0"} stroke="none">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            ))}
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B", marginLeft: "4px" }}>{job.manager_rating}/5</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#CBD5E1", fontStyle: "italic" }}>Unrated</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT — Availability */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>Weekly Availability</h3>
                  <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Submitted by the worker</p>
                </div>
                {weekGroups.length > 1 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setWeekOffset(o => Math.max(0, o - 1))} disabled={weekOffset === 0}
                      style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: weekOffset === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: weekOffset === 0 ? "#CBD5E1" : "#475569", fontSize: "14px" }}>‹</button>
                    <span style={{ fontSize: "12px", fontWeight: "600", color: "#475569", minWidth: "140px", textAlign: "center" }}>{weekLabel}</span>
                    <button onClick={() => setWeekOffset(o => Math.min(weekGroups.length - 1, o + 1))} disabled={weekOffset === weekGroups.length - 1}
                      style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: weekOffset === weekGroups.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: weekOffset === weekGroups.length - 1 ? "#CBD5E1" : "#475569", fontSize: "14px" }}>›</button>
                  </div>
                )}
              </div>

              {availLoading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "8px" }}>
                  {DAYS_SHORT.map(d => <Shimmer key={d} h="80px" r="10px" />)}
                </div>
              ) : weekGroups.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>No availability submitted</p>
                  <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "4px" }}>The worker hasn't set their availability yet</p>
                </div>
              ) : (
                <>
                  {weekGroups.length === 1 && (
                    <p style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginBottom: "14px", textAlign: "center" }}>{weekLabel}</p>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px" }}>
                    {DAYS_SHORT.map((short, i) => {
                      const available = availDays.has(i);
                      return (
                        <div key={i} style={{ borderRadius: "10px", padding: "12px 6px", textAlign: "center", background: available ? "#ECFDF5" : "#F8FAFC", border: `1.5px solid ${available ? "#86EFAC" : "#E2E8F0"}` }}>
                          <p style={{ fontSize: "11px", fontWeight: "700", color: available ? "#166534" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{short}</p>
                          <p style={{ fontSize: "17px", marginTop: "4px", color: available ? "#16A34A" : "#CBD5E1" }}>{available ? "✓" : "—"}</p>
                          <p style={{ fontSize: "10px", color: available ? "#16A34A" : "#CBD5E1", marginTop: "2px", fontWeight: "600" }}>{available ? "Available" : "Off"}</p>
                        </div>
                      );
                    })}
                  </div>

                  <p style={{ fontSize: "12px", color: "#94A3B8", textAlign: "center", marginTop: "14px" }}>
                    Available <strong style={{ color: "#1E293B" }}>{availDays.size}</strong> of 7 days
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </CoordinatorLayout>
  );
}

function InfoChip({ icon, text }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12.5px", color: "#64748B" }}>
      {icon} {text}
    </span>
  );
}

function StatBox({ icon, bg, value, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", background: bg, borderRadius: "12px", padding: "14px 18px", flex: 1 }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: "11px", color: "#64748B", marginTop: "2px", fontWeight: "500" }}>{label}</p>
      </div>
    </div>
  );
}
