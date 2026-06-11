import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

if (typeof document !== "undefined" && !document.getElementById("coord-req-styles")) {
  const style = document.createElement("style");
  style.id = "coord-req-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
  );
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

export default function CoordinatorRequests() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState("pending");
  const [toast, setToast]             = useState(null);
  const [processing, setProcessing]   = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Fetch shift assignments for krewby workers
        const { data: rows, error } = await supabase
          .from("shift_assignments")
          .select(`
            assignment_id, status, acknowledged, krewby_worker_id,
            shifts ( shift_id, title, shift_date, start_time, end_time,
              outlets ( name ) )
          `)
          .not("krewby_worker_id", "is", null)
          .order("assignment_id", { ascending: false });

        if (error) { console.error(error); return; }

        // Fetch worker + user info in two steps
        const workerIds = [...new Set((rows || []).map(r => r.krewby_worker_id).filter(Boolean))];
        let workerMap = {};
        if (workerIds.length > 0) {
          const { data: workers } = await supabase
            .from("krewby_workers")
            .select("krewby_worker_id, user_id, rating, total_jobs")
            .in("krewby_worker_id", workerIds);
          const userIds = [...new Set((workers || []).map(w => w.user_id))];
          let usersMap = {};
          if (userIds.length > 0) {
            const { data: users } = await supabase
              .from("users")
              .select("user_id, full_name, email")
              .in("user_id", userIds);
            (users || []).forEach(u => { usersMap[u.user_id] = u; });
          }
          (workers || []).forEach(w => { workerMap[w.krewby_worker_id] = { ...w, user: usersMap[w.user_id] }; });
        }

        if (!cancelled) {
          setAssignments((rows || []).map(r => ({ ...r, worker: workerMap[r.krewby_worker_id] || null })));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function updateStatus(assignmentId, newStatus) {
    setProcessing(assignmentId);
    try {
      const { error } = await supabase
        .from("shift_assignments")
        .update({ status: newStatus })
        .eq("assignment_id", assignmentId);
      if (error) throw error;
      setAssignments(prev => prev.map(a => a.assignment_id === assignmentId ? { ...a, status: newStatus } : a));
      showToast(newStatus === "confirmed" ? "Assignment confirmed." : "Assignment cancelled.", newStatus === "confirmed" ? "success" : "error");
    } catch {
      showToast("Action failed.", "error");
    } finally {
      setProcessing(null);
    }
  }

  const FILTERS = [
    { value: "pending",   label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "cancelled", label: "Cancelled" },
    { value: "all",       label: "All" },
  ];

  const filtered   = filter === "all" ? assignments : assignments.filter(a => a.status === filter);
  const pendingCnt = assignments.filter(a => a.status === "pending").length;

  return (
    <CoordinatorLayout title="Requests">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Job Assignments</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
            Shift assignments for Krewby casual workers · {pendingCnt} pending
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content" }}>
          {FILTERS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
              {t.value === "pending" && pendingCnt > 0 && (
                <span style={{ background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>{pendingCnt}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
                  <Shimmer w="40px" h="40px" r="50%" />
                  <div style={{ flex: 1 }}><Shimmer w="130px" h="14px" r="6px" /><div style={{ marginTop: "7px" }}><Shimmer w="90px" h="11px" r="5px" /></div></div>
                  <Shimmer w="70px" h="24px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "20px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
                  <Shimmer w="120px" h="34px" r="8px" />
                  <Shimmer w="160px" h="34px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>📋</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No {filter === "all" ? "" : filter} assignments</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((a, i) => {
              const name   = a.worker?.user?.full_name || a.worker?.user?.email || "Unknown";
              const shift  = a.shifts;
              const outlet = shift?.outlets?.name || "";
              const color  = avatarColor(name);
              const statusStyle = {
                pending:   { background: "#FFFBEB", color: "#D97706" },
                confirmed: { background: "#DCFCE7", color: "#166534" },
                cancelled: { background: "#FEE2E2", color: "#991B1B" },
              }[a.status] || { background: "#F1F5F9", color: "#475569" };

              return (
                <div key={a.assignment_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
                        {name[0]?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
                        <p style={{ fontSize: "12px", color: "#64748B" }}>
                          {a.worker?.rating ? `⭐ ${Number(a.worker.rating).toFixed(1)}` : ""}
                          {a.worker?.total_jobs != null ? ` · ${a.worker.total_jobs} jobs` : ""}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {a.acknowledged && (
                        <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", background: "#EFF6FF", color: "#1D4ED8" }}>Acknowledged</span>
                      )}
                      <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle }}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {shift && (
                    <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: a.status === "pending" ? "1px solid #F1F5F9" : "none", marginBottom: a.status === "pending" ? "14px" : "0" }}>
                      <InfoItem label="Shift"  value={shift.title || "Shift"} />
                      <InfoItem label="Date"   value={fmtDate(shift.shift_date)} />
                      <InfoItem label="Time"   value={`${shift.start_time?.slice(0,5)} – ${shift.end_time?.slice(0,5)}`} />
                      {outlet && <InfoItem label="Outlet" value={outlet} />}
                    </div>
                  )}

                  {a.status === "pending" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button onClick={() => updateStatus(a.assignment_id, "cancelled")} disabled={processing === a.assignment_id}
                        style={{ padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B", cursor: "pointer", opacity: processing === a.assignment_id ? 0.5 : 1 }}>
                        {processing === a.assignment_id ? "…" : "Cancel"}
                      </button>
                      <button onClick={() => updateStatus(a.assignment_id, "confirmed")} disabled={processing === a.assignment_id}
                        style={{ padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", border: "none", background: "#22C55E", color: "#FFF", cursor: "pointer", opacity: processing === a.assignment_id ? 0.5 : 1 }}>
                        {processing === a.assignment_id ? "…" : "Confirm"}
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
    </CoordinatorLayout>
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
