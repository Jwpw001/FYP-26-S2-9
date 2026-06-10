import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

export default function CoordinatorRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [overrideNote, setOverrideNote] = useState("");
  const [showOverride, setShowOverride] = useState(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [reqRes, matchRes] = await Promise.all([
          api.get(`/api/krewby/requests/${id}`),
          api.get(`/api/krewby/requests/${id}/matches`),
        ]);
        // krewby controller returns { success, data }
        setRequest(reqRes.data);
        setMatches(matchRes.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleApprove(workerId, isOverride) {
    if (isOverride && !overrideNote.trim()) { setError("Please provide an override note."); return; }
    setProcessing(workerId); setError("");
    try {
      // Send krewby_worker_id — that's the PK of krewby_workers
      await api.post(`/api/krewby/requests/${id}/assign`, {
        worker_id: workerId,
        override_note: isOverride ? overrideNote : null
      });
      setSuccess("Worker assigned successfully!");
      setTimeout(() => navigate("/krewby-coordinator/requests"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject() {
    setProcessing("reject");
    try {
      await api.patch(`/api/krewby/requests/${id}`, { status: "rejected" });
      setSuccess("Request rejected.");
      setTimeout(() => navigate("/krewby-coordinator/requests"), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <CoordinatorLayout title="Request Detail"><div style={s.loading}>Loading…</div></CoordinatorLayout>;
  if (!request) return <CoordinatorLayout title="Request Detail"><div style={s.loading}>Request not found.</div></CoordinatorLayout>;

  return (
    <CoordinatorLayout title="Request Detail">
      <button style={s.back} onClick={() => navigate("/krewby-coordinator/requests")}>← Back to Requests</button>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      <div style={s.card}>
        <h2 style={s.heading}>Krewby Request</h2>
        <div style={s.infoGrid}>
          {/* Prisma returns outlets (plural), skills (plural) */}
          <div style={s.infoItem}><span style={s.infoLabel}>Outlet</span><span style={s.infoVal}>{request.outlets?.name || "—"}</span></div>
          <div style={s.infoItem}><span style={s.infoLabel}>Role</span><span style={s.infoVal}>{request.role_name}</span></div>
          <div style={s.infoItem}><span style={s.infoLabel}>Date</span><span style={s.infoVal}>{fmtDate(request.shift_date)}</span></div>
          <div style={s.infoItem}><span style={s.infoLabel}>Time</span><span style={s.infoVal}>{fmtTime(request.start_time)} – {fmtTime(request.end_time)}</span></div>
          <div style={s.infoItem}><span style={s.infoLabel}>Skill</span><span style={s.infoVal}>{request.skills?.name || "—"}</span></div>
          <div style={s.infoItem}><span style={s.infoLabel}>Headcount</span><span style={s.infoVal}>{request.headcount}</span></div>
        </div>
        <div style={s.statusRow}>
          <span style={{ ...s.statusBadge, ...statusStyle(request.status) }}>{request.status.replace("_", " ")}</span>
          {request.status === "pending_review" && (
            <button style={s.rejectBtn} onClick={handleReject} disabled={processing === "reject"}>Reject Request</button>
          )}
        </div>
      </div>

      {request.status === "pending_review" && (
        <div style={s.matchSection}>
          <h3 style={s.sectionTitle}>AI Match Recommendations</h3>
          <p style={s.sectionSub}>Review and approve the best match for this request.</p>
          {matches.length === 0 ? (
            <div style={s.emptyCard}><p>No matching workers found.</p></div>
          ) : matches.map((match, i) => (
            <div key={match.krewby_worker_id} style={s.matchCard}>
              <div style={s.matchTop}>
                <div style={s.matchRank}>#{i + 1}</div>
                <div style={s.matchInfo}>
                  <p style={s.workerName}>{match.users?.full_name || match.users?.email}</p>
                  <p style={s.workerEmail}>{match.users?.email}</p>
                  <div style={s.scoreRow}>
                    <span style={s.scoreItem}>⭐ {Number(match.rating || 5).toFixed(1)}</span>
                    <span style={s.scoreItem}>📍 {match.preferred_location || "Any"}</span>
                    <span style={s.scoreItem}>✅ {match.total_jobs || 0} jobs</span>
                    <span style={s.scoreItem}>🎯 {match.score || 0}% match</span>
                  </div>
                </div>
                <div style={s.matchActions}>
                  {i === 0 ? (
                    <button style={s.approveBtn}
                      onClick={() => handleApprove(match.krewby_worker_id, false)}
                      disabled={processing === match.krewby_worker_id}>
                      {processing === match.krewby_worker_id ? "…" : "Approve"}
                    </button>
                  ) : (
                    showOverride === match.krewby_worker_id ? (
                      <div style={s.overrideForm}>
                        <textarea style={s.overrideInput} placeholder="Override reason..."
                          value={overrideNote} onChange={e => setOverrideNote(e.target.value)} />
                        <button style={s.approveBtn}
                          onClick={() => handleApprove(match.krewby_worker_id, true)}
                          disabled={processing === match.krewby_worker_id}>
                          Confirm Override
                        </button>
                        <button style={s.cancelBtn} onClick={() => setShowOverride(null)}>Cancel</button>
                      </div>
                    ) : (
                      <button style={s.overrideBtn} onClick={() => setShowOverride(match.krewby_worker_id)}>
                        Override & Select
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </CoordinatorLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  return new Date(`1970-01-01T${t.includes("T") ? t.split("T")[1] : t}Z`).toISOString().slice(11, 16);
}
function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function statusStyle(status) {
  const map = { pending_review: { background: "#FFFBEB", color: "#D97706" }, matched: { background: "#DBEAFE", color: "#1E40AF" }, confirmed: { background: "#DCFCE7", color: "#166534" }, rejected: { background: "#FEE2E2", color: "#991B1B" } };
  return map[status] || { background: "#F3F4F6", color: "#6B7280" };
}
const s = {
  loading: { textAlign: "center", padding: "60px", color: "#7A7870" },
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#7A7870", cursor: "pointer", marginBottom: "20px", padding: 0 },
  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "24px", marginBottom: "20px" },
  heading: { fontSize: "18px", fontWeight: "800", color: "#1C1B18", marginBottom: "16px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" },
  infoItem: { display: "flex", flexDirection: "column", gap: "2px" },
  infoLabel: { fontSize: "11px", fontWeight: "600", color: "#A09D97", textTransform: "uppercase" },
  infoVal: { fontSize: "14px", fontWeight: "500", color: "#1C1B18" },
  statusRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  statusBadge: { padding: "4px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", textTransform: "capitalize" },
  rejectBtn: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#991B1B", cursor: "pointer" },
  matchSection: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "24px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18", marginBottom: "4px" },
  sectionSub: { fontSize: "13px", color: "#7A7870", marginBottom: "16px" },
  emptyCard: { textAlign: "center", padding: "32px", color: "#7A7870" },
  matchCard: { border: "1px solid #E5E2DC", borderRadius: "12px", padding: "16px", marginBottom: "10px" },
  matchTop: { display: "flex", alignItems: "flex-start", gap: "12px" },
  matchRank: { width: "28px", height: "28px", borderRadius: "50%", background: "#F7F6F3", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", color: "#7A7870", flexShrink: 0 },
  matchInfo: { flex: 1 },
  workerName: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  workerEmail: { fontSize: "12px", color: "#7A7870", marginTop: "2px" },
  scoreRow: { display: "flex", gap: "12px", marginTop: "6px", flexWrap: "wrap" },
  scoreItem: { fontSize: "12px", color: "#55524A" },
  matchActions: { flexShrink: 0 },
  approveBtn: { background: "#1C1B18", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", cursor: "pointer" },
  overrideBtn: { background: "#F7F6F3", border: "1px solid #E5E2DC", borderRadius: "9px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: "#1C1B18", cursor: "pointer" },
  overrideForm: { display: "flex", flexDirection: "column", gap: "6px", width: "200px" },
  overrideInput: { padding: "8px", border: "1.5px solid #D8D5CE", borderRadius: "8px", fontSize: "12px", resize: "vertical", height: "60px" },
  cancelBtn: { background: "none", border: "none", fontSize: "12px", color: "#7A7870", cursor: "pointer" },
};
