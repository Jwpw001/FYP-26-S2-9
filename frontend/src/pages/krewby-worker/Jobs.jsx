import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import WorkerLayout from "../../components/layout/WorkerLayout";

export default function WorkerJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("upcoming");
  const [processing, setProcessing] = useState(null);
  const [clockingIn, setClockingIn] = useState(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    api.get("/api/krewby/my-assignments")
      .then(res => setJobs(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleConfirm(assignmentId) {
    setProcessing(assignmentId);
    try {
      await api.patch(`/api/krewby/assignments/${assignmentId}/confirm`, {});
      setJobs(prev => prev.map(j => j.assignment_id === assignmentId ? { ...j, status: "confirmed" } : j));
      setSuccess("Job confirmed!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) { console.error(err); }
    finally { setProcessing(null); }
  }

  async function handleDecline(assignmentId) {
    setProcessing(assignmentId);
    try {
      await api.patch(`/api/krewby/assignments/${assignmentId}/decline`, {});
      setJobs(prev => prev.map(j => j.assignment_id === assignmentId ? { ...j, status: "declined" } : j));
    } catch (err) { console.error(err); }
    finally { setProcessing(null); }
  }

  async function handleClockIn(assignmentId) {
    setClockingIn(assignmentId);
    try {
      await api.post(`/api/krewby/assignments/${assignmentId}/clock-in`, {});
      setJobs(prev => prev.map(j =>
        j.assignment_id === assignmentId ? { ...j, clocked_in: true, clock_in: new Date().toISOString() } : j
      ));
      setSuccess("Clocked in successfully!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) { console.error(err); }
    finally { setClockingIn(null); }
  }

  async function handleClockOut(assignmentId) {
    setClockingIn(assignmentId);
    try {
      await api.post(`/api/krewby/assignments/${assignmentId}/clock-out`, {});
      setJobs(prev => prev.map(j =>
        j.assignment_id === assignmentId ? { ...j, clocked_out: true, clock_out: new Date().toISOString() } : j
      ));
      setSuccess("Clocked out. Shift complete!");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) { console.error(err); }
    finally { setClockingIn(null); }
  }

  const today = new Date().toISOString().split("T")[0];
  const filtered = jobs.filter(j => {
    // shift_date lives at j.shifts.shift_date (nested Prisma relation)
    const shiftDate = j.shifts?.shift_date?.split("T")[0] || "";
    if (filter === "upcoming") return shiftDate >= today && j.status !== "declined";
    if (filter === "past") return shiftDate < today;
    return true;
  });

  return (
    <WorkerLayout title="My Jobs">
      <div style={s.headerRow}>
        <h2 style={s.heading}>My Jobs</h2>
      </div>
      <div style={s.tabs}>
        {[{ key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }, { key: "all", label: "All" }].map(f => (
          <button key={f.key} style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }} onClick={() => setFilter(f.key)}>{f.label}</button>
        ))}
      </div>
      {success && <div style={s.successMsg}>{success}</div>}
      {loading ? <div style={s.empty}>Loading…</div>
        : filtered.length === 0 ? (
          <div style={s.emptyCard}><p style={s.emptyIcon}>💼</p><p style={s.emptyTitle}>No {filter} jobs</p></div>
        ) : filtered.map(job => {
          // Flatten nested paths for display
          const shiftDate = job.shifts?.shift_date?.split("T")[0] || "";
          const startTime = job.shifts?.start_time;
          const endTime = job.shifts?.end_time;
          const roleName = job.shift_roles?.role_name || "—";
          const outletName = job.shifts?.outlets?.name || "—";
          const outletAddress = job.shifts?.outlets?.address || "";

          return (
            <div key={job.assignment_id} style={s.card}>
              <div style={s.cardTop}>
                <div>
                  <p style={s.jobTitle}>{roleName} — {outletName}</p>
                  <p style={s.jobMeta}>{fmtDate(shiftDate)} · {fmtTime(startTime)} – {fmtTime(endTime)}</p>
                  {outletAddress && <p style={s.jobAddr}>{outletAddress}</p>}
                </div>
                <span style={{ ...s.badge, ...statusStyle(job.status) }}>{job.status}</span>
              </div>
              {job.status === "assigned" && (
                <div style={s.actions}>
                  <button style={s.declineBtn} onClick={() => handleDecline(job.assignment_id)} disabled={processing === job.assignment_id}>Decline</button>
                  <button style={s.confirmBtn} onClick={() => handleConfirm(job.assignment_id)} disabled={processing === job.assignment_id}>
                    {processing === job.assignment_id ? "…" : "Confirm"}
                  </button>
                </div>
              )}
              {job.status === "confirmed" && shiftDate === today && (
                <div style={s.actions}>
                  {!job.clocked_in ? (
                    <button style={s.clockBtn} onClick={() => handleClockIn(job.assignment_id)} disabled={clockingIn === job.assignment_id}>
                      {clockingIn === job.assignment_id ? "…" : "🕐 Clock In"}
                    </button>
                  ) : !job.clocked_out ? (
                    <div style={s.clockRow}>
                      <span style={s.clockedIn}>✓ Clocked in {new Date(job.clock_in).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}</span>
                      <button style={s.clockBtn} onClick={() => handleClockOut(job.assignment_id)} disabled={clockingIn === job.assignment_id}>
                        {clockingIn === job.assignment_id ? "…" : "🕐 Clock Out"}
                      </button>
                    </div>
                  ) : (
                    <span style={s.completed}>✓ Shift completed</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </WorkerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  return new Date(`1970-01-01T${t.includes("T") ? t.split("T")[1] : t}Z`).toISOString().slice(11, 16);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function statusStyle(status) {
  const map = { assigned: { background: "#FFFBEB", color: "#D97706" }, confirmed: { background: "#DCFCE7", color: "#166534" }, declined: { background: "#FEE2E2", color: "#991B1B" }, completed: { background: "#DBEAFE", color: "#1E40AF" } };
  return map[status] || { background: "#F3F4F6", color: "#6B7280" };
}
const s = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" },
  heading: { fontSize: "20px", fontWeight: "800", color: "#1C1B18" },
  tabs: { display: "flex", gap: "4px", background: "#F0EDE8", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" },
  tab: { padding: "6px 14px", background: "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: "500", color: "#7A7870", cursor: "pointer" },
  tabActive: { background: "#FFFFFF", color: "#1C1B18", fontWeight: "600", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  empty: { textAlign: "center", padding: "60px", color: "#7A7870" },
  emptyCard: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px", textAlign: "center" },
  emptyIcon: { fontSize: "32px", marginBottom: "10px" },
  emptyTitle: { fontSize: "16px", fontWeight: "600", color: "#7A7870" },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "20px", marginBottom: "12px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" },
  jobTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  jobMeta: { fontSize: "13px", color: "#7A7870", marginTop: "4px" },
  jobAddr: { fontSize: "12px", color: "#A09D97", marginTop: "2px" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", flexShrink: 0 },
  actions: { display: "flex", justifyContent: "flex-end", gap: "8px" },
  declineBtn: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#991B1B", cursor: "pointer" },
  confirmBtn: { background: "#1C1B18", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: "pointer" },
  clockBtn: { background: "#2563EB", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", cursor: "pointer" },
  clockRow: { display: "flex", alignItems: "center", gap: "12px" },
  clockedIn: { fontSize: "13px", color: "#059669", fontWeight: "600" },
  completed: { fontSize: "13px", color: "#2563EB", fontWeight: "600" },
};
