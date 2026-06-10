import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import StaffLayout from "../../components/layout/StaffLayout";

export default function SwapRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [myShifts, setMyShifts] = useState([]);
  const [form, setForm] = useState({ requester_assign:"", request_type:"swap", reason:"" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [reqRes, shiftsRes] = await Promise.all([
          api.get("/api/shifts/swap-requests"),
          api.get("/api/shifts"),
        ]);
        setRequests(reqRes.data || []);
        const today = new Date().toISOString().split("T")[0];
        setMyShifts((shiftsRes.data || []).filter(s => s.shift_date >= today));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res = await api.post("/api/shifts/swap-requests", form);
      setRequests(prev => [res.data, ...prev]);
      setShowForm(false);
      setSuccess("Request submitted!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  }

  return (
    <StaffLayout title="Swap Requests">
      <div style={s.headerRow}>
        <h2 style={s.heading}>Swap & Replacement Requests</h2>
        <button style={s.addBtn} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Request"}
        </button>
      </div>
      {success && <div style={s.successMsg}>{success}</div>}
      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>New Request</h3>
          {error && <div style={s.error}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={s.field}>
              <label style={s.label}>Request Type</label>
              <select style={s.input} value={form.request_type} onChange={e => setForm({...form, request_type:e.target.value})}>
                <option value="swap">Shift Swap</option>
                <option value="replacement">Replacement</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Reason</label>
              <textarea style={{ ...s.input, height:"80px", resize:"vertical" }} value={form.reason} onChange={e => setForm({...form, reason:e.target.value})} required />
            </div>
            <button type="submit" style={s.submitBtn} disabled={submitting}>{submitting ? "Submitting…" : "Submit Request"}</button>
          </form>
        </div>
      )}
      {loading ? <div style={s.empty}>Loading…</div>
      : requests.length === 0 ? (
        <div style={s.emptyCard}><p style={s.emptyIcon}>🔄</p><p style={s.emptyTitle}>No requests yet</p></div>
      ) : requests.map(req => (
        <div key={req.swap_id} style={s.card}>
          <div style={s.cardTop}>
            <div>
              <p style={s.reqType}>{req.request_type === "swap" ? "Shift Swap" : "Replacement"}</p>
              <p style={s.reason}>{req.reason}</p>
            </div>
            <span style={{ ...s.badge, ...statusStyle(req.status) }}>
              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
            </span>
          </div>
        </div>
      ))}
    </StaffLayout>
  );
}
function statusStyle(status) {
  const map = { pending:{ background:"#FFFBEB", color:"#D97706" }, approved:{ background:"#DCFCE7", color:"#166534" }, rejected:{ background:"#FEE2E2", color:"#991B1B" } };
  return map[status] || map.pending;
}
const s = {
  headerRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  heading:{ fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  addBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"9px 16px", fontSize:"13px", fontWeight:"600", color:"#FFFFFF", cursor:"pointer" },
  successMsg:{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  formCard:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle:{ fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  error:{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"12px" },
  field:{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"12px" },
  label:{ fontSize:"13px", fontWeight:"600", color:"#55524A" },
  input:{ padding:"10px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px", background:"#FFFFFF" },
  submitBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"10px 20px", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
  empty:{ textAlign:"center", padding:"60px", color:"#7A7870" },
  emptyCard:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon:{ fontSize:"32px", marginBottom:"10px" },
  emptyTitle:{ fontSize:"16px", fontWeight:"600", color:"#7A7870" },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px", marginBottom:"12px" },
  cardTop:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  reqType:{ fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  reason:{ fontSize:"13px", color:"#7A7870", marginTop:"4px" },
  badge:{ padding:"4px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600", flexShrink:0 },
};
