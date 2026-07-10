import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { useParams } from "react-router-dom";
import { useGoTo } from "../../components/PageTransition";
import { Sparkles, ArrowLeft, Users, CheckCircle, Clock } from "lucide-react";

const STATUS_STYLE = {
  open:      { bg: "#ECFDF5", color: "#059669", label: "Open" },
  filled:    { bg: "#DBEAFE", color: "#1E40AF", label: "Filled" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626", label: "Cancelled" },
};

const APP_STATUS = {
  pending:   { bg: "#FFFBEB", color: "#D97706", label: "Pending" },
  confirmed: { bg: "#ECFDF5", color: "#059669", label: "Confirmed" },
  rejected:  { bg: "#FEF2F2", color: "#DC2626", label: "Not selected" },
};

export default function CasualRequestDetail() {
  const { id }  = useParams();
  const goTo    = useGoTo();
  const [request, setRequest]   = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [confirming, setConfirming] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [aiRec, setAiRec]       = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError]   = useState("");

  useEffect(() => { loadDetail(); }, [id]);

  function loadDetail() {
    setLoading(true);
    api.get(`/api/casual/manager/requests/${id}`)
      .then(d => { setRequest(d.request); setApplicants(d.applicants || []); })
      .finally(() => setLoading(false));
  }

  async function confirmApplicant(applicationId) {
    setConfirming(applicationId);
    try {
      await api.post(`/api/casual/manager/requests/${id}/confirm/${applicationId}`, {});
      loadDetail();
    } catch (err) {
      alert(err.message);
    } finally {
      setConfirming(null);
    }
  }

  async function cancelRequest() {
    if (!confirm("Cancel this request? Applicants will no longer see it.")) return;
    setCancelling(true);
    try {
      await api.post(`/api/casual/manager/requests/${id}/cancel`, {});
      loadDetail();
    } catch (err) {
      alert(err.message);
    } finally {
      setCancelling(false);
    }
  }

  async function getAiRecommend() {
    setAiLoading(true); setAiError(""); setAiRec(null);
    try {
      const d = await api.post(`/api/casual/manager/requests/${id}/ai-recommend`, {});
      setAiRec(d.recommendation);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  if (loading) {
    return (
      <ManagerLayout title="Request Detail">
        <div style={{ color: "#64748B", padding: "40px 0" }}>Loading…</div>
      </ManagerLayout>
    );
  }

  if (!request) {
    return (
      <ManagerLayout title="Request Detail">
        <div style={{ color: "#DC2626" }}>Request not found.</div>
      </ManagerLayout>
    );
  }

  const st = STATUS_STYLE[request.status] || STATUS_STYLE.open;
  const confirmedCount = applicants.filter(a => a.status === "confirmed").length;
  const pendingApplicants = applicants.filter(a => a.status === "pending");
  const canConfirm = request.status === "open" && confirmedCount < request.headcount;

  return (
    <ManagerLayout title="Request Detail">
      {/* Back */}
      <button onClick={() => goTo("/outlet-manager/casual-requests")} style={s.backBtn}>
        <ArrowLeft size={15} /> Back to Requests
      </button>

      {/* Request header */}
      <div style={s.headerCard}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>{request.role_name}</h2>
            <span style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color }}>{st.label}</span>
          </div>
          <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <Meta label="Branch" value={request.outlets?.name || "—"} />
            <Meta label="Date" value={request.work_date} />
            <Meta label="Time" value={`${request.start_time?.slice(0,5)} – ${request.end_time?.slice(0,5)}`} />
            <Meta label="Workers Needed" value={`${confirmedCount} / ${request.headcount} confirmed`} />
          </div>
          {request.notes && <p style={{ fontSize: "13px", color: "#64748B", marginTop: "10px", fontStyle: "italic" }}>{request.notes}</p>}
        </div>
        {request.status === "open" && (
          <button onClick={cancelRequest} disabled={cancelling} style={s.cancelBtn}>
            {cancelling ? "Cancelling…" : "Cancel Request"}
          </button>
        )}
      </div>

      {/* AI Recommendation */}
      {pendingApplicants.length > 0 && canConfirm && (
        <div style={s.aiSection}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#4338CA" }}>AI Recommendation</p>
              <p style={{ fontSize: "12px", color: "#6366F1", marginTop: "2px" }}>Let AI pick the best applicant based on skills, experience, and reliability.</p>
            </div>
            <button onClick={getAiRecommend} disabled={aiLoading} style={s.aiBtn}>
              <Sparkles size={14} /> {aiLoading ? "Analysing…" : "Get AI Recommendation"}
            </button>
          </div>

          {aiError && <p style={{ fontSize: "13px", color: "#DC2626", marginTop: "12px" }}>{aiError}</p>}

          {aiRec && (
            <div style={s.aiResult}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Sparkles size={18} color="#6366F1" />
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "800", color: "#1E293B" }}>
                    Recommended: <span style={{ color: "#4338CA" }}>{aiRec.recommended_name}</span>
                  </p>
                  <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", lineHeight: 1.5 }}>{aiRec.reason}</p>
                </div>
              </div>
              {aiRec.ranking && aiRec.ranking.length > 1 && (
                <div style={{ marginTop: "14px", borderTop: "1px solid #E0E7FF", paddingTop: "12px" }}>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Full Ranking</p>
                  {aiRec.ranking.map((r, i) => (
                    <div key={r.application_id} style={{ display: "flex", gap: "10px", fontSize: "12px", color: "#64748B", marginBottom: "4px" }}>
                      <span style={{ fontWeight: "700", color: "#4338CA", width: "16px" }}>#{i+1}</span>
                      <span style={{ fontWeight: "600", color: "#1E293B" }}>{r.name}</span>
                      <span>·</span>
                      <span>{r.score_reason}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Applicants */}
      <div style={s.applicantsSection}>
        <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "14px" }}>
          Applicants <span style={{ fontSize: "13px", color: "#64748B", fontWeight: "500" }}>({applicants.length})</span>
        </p>

        {applicants.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94A3B8" }}>
            <Users size={32} style={{ marginBottom: "10px", opacity: 0.4 }} />
            <p>No applicants yet. Casual workers will appear here when they apply.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {applicants.map(app => (
              <ApplicantCard
                key={app.application_id}
                app={app}
                isRecommended={aiRec?.recommended_application_id === app.application_id}
                canConfirm={canConfirm && app.status === "pending"}
                confirming={confirming === app.application_id}
                onConfirm={() => confirmApplicant(app.application_id)}
              />
            ))}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

function ApplicantCard({ app, isRecommended, canConfirm, confirming, onConfirm }) {
  const st = APP_STATUS[app.status] || APP_STATUS.pending;
  return (
    <div style={{ ...s.appCard, border: isRecommended ? "2px solid #6366F1" : "1px solid #E2E8F0" }}>
      {isRecommended && (
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: "700", color: "#4338CA", marginBottom: "10px" }}>
          <Sparkles size={12} /> AI Recommended
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{app.full_name}</p>
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{app.email}</p>
          <div style={{ display: "flex", gap: "14px", marginTop: "8px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "4px" }}>
              <CheckCircle size={12} color="#059669" /> {app.confirmed_jobs} jobs done
            </span>
            {app.skills?.length > 0 && (
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {app.skills.slice(0, 3).map(sk => (
                  <span key={sk} style={{ fontSize: "11px", background: "#F1F5F9", color: "#475569", borderRadius: "99px", padding: "2px 8px" }}>{sk}</span>
                ))}
              </div>
            )}
          </div>
          <p style={{ fontSize: "11px", color: "#A09D97", marginTop: "6px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Clock size={11} /> Applied {new Date(app.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
          <span style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color }}>{st.label}</span>
          {canConfirm && (
            <button onClick={onConfirm} disabled={confirming} style={s.confirmBtn}>
              {confirming ? "Confirming…" : "Confirm"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: "11px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>{label}</p>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", marginTop: "2px" }}>{value}</p>
    </div>
  );
}

const s = {
  backBtn: { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", padding: "0 0 16px", marginBottom: "8px" },
  headerCard: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px 24px", marginBottom: "20px", display: "flex", gap: "16px", alignItems: "flex-start", flexWrap: "wrap" },
  cancelBtn: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: "9px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", cursor: "pointer", flexShrink: 0 },
  aiSection: { background: "#EEF2FF", border: "1.5px solid #C7D2FE", borderRadius: "14px", padding: "18px 20px", marginBottom: "20px" },
  aiBtn: { display: "flex", alignItems: "center", gap: "7px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", color: "#FFF", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" },
  aiResult: { marginTop: "16px", background: "#FFF", border: "1px solid #C7D2FE", borderRadius: "12px", padding: "16px" },
  applicantsSection: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px" },
  appCard: { background: "#FAFAF8", borderRadius: "12px", padding: "14px 16px" },
  confirmBtn: { background: "#2563EB", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer" },
};
