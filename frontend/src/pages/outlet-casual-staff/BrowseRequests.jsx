import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { MapPin, Clock, Users, CheckCircle } from "lucide-react";

export default function BrowseRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [applying, setApplying] = useState(null);
  const [feedback, setFeedback] = useState({});

  useEffect(() => {
    api.get("/api/casual/requests")
      .then(d => setRequests(d.requests || []))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleApply(requestId) {
    setApplying(requestId);
    try {
      await api.post(`/api/casual/requests/${requestId}/apply`, {});
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, already_applied: true } : r));
      setFeedback(prev => ({ ...prev, [requestId]: "Applied! The manager will review your application." }));
    } catch (err) {
      setFeedback(prev => ({ ...prev, [requestId]: err.message }));
    } finally {
      setApplying(null);
    }
  }

  async function handleWithdraw(requestId) {
    setApplying(requestId);
    try {
      await api.delete(`/api/casual/requests/${requestId}/apply`);
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, already_applied: false } : r));
      setFeedback(prev => ({ ...prev, [requestId]: "" }));
    } catch (err) {
      setFeedback(prev => ({ ...prev, [requestId]: err.message }));
    } finally {
      setApplying(null);
    }
  }

  return (
    <CasualLayout title="Browse Jobs">
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1C1B18" }}>Open Requests</h2>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Tap "I'm Available" on requests that suit your schedule.</p>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1,2,3].map(i => <div key={i} style={{ ...s.skeleton, height: "130px" }} />)}
        </div>
      ) : requests.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: "32px", marginBottom: "12px" }}>📋</p>
          <p style={{ fontSize: "16px", fontWeight: "700", color: "#1C1B18", marginBottom: "6px" }}>No open requests right now</p>
          <p style={{ fontSize: "13px", color: "#64748B" }}>Check back later — managers will post when they need help.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {requests.map(req => (
            <RequestCard
              key={req.request_id}
              req={req}
              applying={applying === req.request_id}
              feedback={feedback[req.request_id]}
              onApply={() => handleApply(req.request_id)}
              onWithdraw={() => handleWithdraw(req.request_id)}
            />
          ))}
        </div>
      )}
    </CasualLayout>
  );
}

function RequestCard({ req, applying, feedback, onApply, onWithdraw }) {
  const outlet = req.outlets;

  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={s.roleName}>{req.role_name}</p>
          <div style={s.metaRow}>
            {outlet && (
              <span style={s.meta}><MapPin size={12} /> {outlet.name}{outlet.address ? ` · ${outlet.address}` : ""}</span>
            )}
            <span style={s.meta}><Clock size={12} /> {req.work_date} · {req.start_time?.slice(0,5)}–{req.end_time?.slice(0,5)}</span>
            <span style={s.meta}><Users size={12} /> {req.headcount} worker{req.headcount !== 1 ? "s" : ""} needed</span>
          </div>
          {req.notes && <p style={s.notes}>{req.notes}</p>}
        </div>

        <div style={s.actionCol}>
          {req.already_applied ? (
            <>
              <div style={s.appliedBadge}><CheckCircle size={13} /> Applied</div>
              <button onClick={onWithdraw} disabled={applying} style={s.withdrawBtn}>
                {applying ? "…" : "Withdraw"}
              </button>
            </>
          ) : (
            <button onClick={onApply} disabled={applying} style={s.applyBtn}>
              {applying ? "Submitting…" : "I'm Available"}
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <p style={{ fontSize: "12px", color: req.already_applied ? "#059669" : "#DC2626", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #F1F5F9" }}>
          {feedback}
        </p>
      )}
    </div>
  );
}

const s = {
  errorBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", color: "#DC2626", marginBottom: "16px" },
  skeleton: { background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", borderRadius: "14px" },
  empty: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px 40px", textAlign: "center" },
  card: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "18px 20px" },
  cardTop: { display: "flex", gap: "16px", alignItems: "flex-start" },
  roleName: { fontSize: "16px", fontWeight: "800", color: "#1C1B18", marginBottom: "8px" },
  metaRow: { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "6px" },
  meta: { fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "5px" },
  notes: { fontSize: "12px", color: "#94A3B8", fontStyle: "italic", marginTop: "4px" },
  actionCol: { display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end", flexShrink: 0 },
  applyBtn: { background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer", whiteSpace: "nowrap" },
  appliedBadge: { display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "700", color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "99px", padding: "4px 10px" },
  withdrawBtn: { background: "none", border: "1px solid #E5E2DC", borderRadius: "8px", padding: "5px 10px", fontSize: "12px", color: "#64748B", cursor: "pointer" },
};
