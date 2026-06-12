import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import WorkerLayout from "../../components/layout/WorkerLayout";

if (typeof document !== "undefined" && !document.getElementById("worker-jobs-styles")) {
  const style = document.createElement("style");
  style.id = "worker-jobs-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLE = {
  assigned:  { bg: "#EFF6FF", color: "#1D4ED8", label: "Assigned" },
  approved:  { bg: "#DCFCE7", color: "#166534", label: "Approved" },
  confirmed: { bg: "#DCFCE7", color: "#166534", label: "Confirmed" },
  completed: { bg: "#F0FDF4", color: "#15803D", label: "Completed" },
  cancelled: { bg: "#FEE2E2", color: "#991B1B", label: "Cancelled" },
};

export default function WorkerMyJobs() {
  const user = getUser();
  const userId = user?.user_id;
  const location = useLocation();

  const [jobs, setJobs]         = useState([]);
  const [workerId, setWorkerId] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState(location.state?.filter || "upcoming");
  const [toast, setToast]       = useState(null);
  const [acking, setAcking]     = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: worker } = await supabase
          .from("krewby_workers").select("krewby_worker_id").eq("user_id", userId).single();
        if (!worker || cancelled) return;
        setWorkerId(worker.krewby_worker_id);

        const [assignRes, reqRes] = await Promise.all([
          supabase
            .from("shift_assignments")
            .select(`assignment_id, status, acknowledged, assigned_at,
              shifts ( shift_id, title, shift_date, start_time, end_time, status,
                outlets ( name, address ) )`)
            .eq("krewby_worker_id", worker.krewby_worker_id)
            .order("assignment_id", { ascending: false }),
          supabase
            .from("krewby_requests")
            .select(`request_id, role_name, shift_date, start_time, end_time, status, override_note, clock_out, manager_rating,
              outlets ( name, address )`)
            .eq("assigned_worker_id", worker.krewby_worker_id)
            .in("status", ["assigned", "approved", "completed"])
            .order("shift_date", { ascending: false }),
        ]);

        const regularJobs = (assignRes.data || []).filter(j => j.shifts);

        // Normalise krewby_requests rows into the same shape
        const krewbyJobs = (reqRes.data || []).map(r => ({
          _type: "krewby_request",
          assignment_id: `kr-${r.request_id}`,
          request_id: r.request_id,
          // treat as completed if clocked out, regardless of DB status lag
          status: r.clock_out ? "completed" : r.status,
          manager_rating: r.manager_rating || null,
          acknowledged: true,
          assigned_at: null,
          shifts: {
            title: r.role_name,
            shift_date: r.shift_date,
            start_time: r.start_time,
            end_time: r.end_time,
            outlets: r.outlets,
          },
          override_note: r.override_note,
        }));

        if (!cancelled) setJobs([...regularJobs, ...krewbyJobs].sort((a, b) => {
          const da = a.shifts?.shift_date || "";
          const db = b.shifts?.shift_date || "";
          return db.localeCompare(da);
        }));
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function acknowledge(assignmentId) {
    setAcking(assignmentId);
    const { error } = await supabase
      .from("shift_assignments").update({ acknowledged: true }).eq("assignment_id", assignmentId);
    if (error) { showToast("Failed to acknowledge.", "error"); }
    else {
      setJobs(prev => prev.map(j => j.assignment_id === assignmentId ? { ...j, acknowledged: true } : j));
      showToast("Job acknowledged!");
    }
    setAcking(null);
  }

  const today = new Date().toISOString().split("T")[0];
  const filtered = jobs.filter(j => {
    const d = j.shifts?.shift_date;
    if (filter === "upcoming") return d >= today && !["cancelled", "completed"].includes(j.status);
    if (filter === "past")     return d < today  || ["completed", "cancelled"].includes(j.status);
    return true;
  });

  const upcomingCount = jobs.filter(j => j.shifts?.shift_date >= today && j.status !== "cancelled").length;

  return (
    <WorkerLayout title="My Jobs">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>My Jobs</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
            {loading ? "Loading…" : `${upcomingCount} upcoming · ${jobs.length} total`}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content" }}>
          {[
            { value: "upcoming", label: "Upcoming" },
            { value: "past",     label: "Past" },
            { value: "all",      label: "All" },
          ].map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                  <Shimmer w="180px" h="16px" r="6px" />
                  <Shimmer w="80px" h="24px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "20px" }}>
                  <Shimmer w="100px" h="32px" r="8px" />
                  <Shimmer w="120px" h="32px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>💼</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No {filter} jobs</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((j, i) => {
              const st = STATUS_STYLE[j.status] || STATUS_STYLE.assigned;
              return (
                <div key={j.assignment_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{j.shifts.title || "Shift"}</p>
                        {j._type === "krewby_request" && (
                          <span style={{ fontSize: "10px", fontWeight: "700", background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA", padding: "2px 7px", borderRadius: "100px", letterSpacing: "0.04em" }}>
                            KREWBY REQUEST
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{j.shifts.outlets?.name || ""}</p>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", background: st.bg, color: st.color, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>

                  <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: (!j.acknowledged && j.status === "assigned") || j.override_note ? "1px solid #F1F5F9" : "none", marginBottom: (!j.acknowledged && j.status === "assigned") || j.override_note ? "14px" : "0" }}>
                    <InfoItem label="Date"  value={fmtDate(j.shifts.shift_date)} />
                    <InfoItem label="Time"  value={`${j.shifts.start_time?.slice(0,5)} – ${j.shifts.end_time?.slice(0,5)}`} />
                    {j.shifts.outlets?.address && <InfoItem label="Address" value={j.shifts.outlets.address} />}
                  </div>

                  {j.override_note && (
                    <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "10px" }}>
                      "{j.override_note}"
                    </p>
                  )}

                  {j.status === "completed" && j._type === "krewby_request" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "12px", borderTop: "1px solid #F1F5F9", marginTop: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Manager Rating</span>
                      {j.manager_rating ? (
                        <>
                          <div style={{ display: "flex", gap: "1px" }}>
                            {[1,2,3,4,5].map(n => (
                              <svg key={n} width="14" height="14" viewBox="0 0 24 24" fill={n <= j.manager_rating ? "#F59E0B" : "#E2E8F0"} stroke="none">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                              </svg>
                            ))}
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B" }}>{j.manager_rating}/5</span>
                        </>
                      ) : (
                        <span style={{ fontSize: "12px", color: "#CBD5E1", fontStyle: "italic" }}>Not rated yet</span>
                      )}
                    </div>
                  )}

                  {!j.acknowledged && j.status === "assigned" && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => acknowledge(j.assignment_id)} disabled={acking === j.assignment_id}
                        style={{ padding: "8px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", border: "none", background: acking === j.assignment_id ? "#93C5FD" : "#3B82F6", color: "#FFF", cursor: "pointer" }}>
                        {acking === j.assignment_id ? "…" : "Acknowledge"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </WorkerLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}
