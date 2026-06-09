import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

const LEAVE_TYPES = ["annual", "medical", "emergency"];

export default function LeaveRequests() {
  const user = getUser();
  const userId = user?.user_id;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showing, setShowing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [form, setForm]         = useState({
    leave_type:"annual", start_date:"", end_date:"", reason:"",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("availability")
        .select("request_id, leave_type, start_date, end_date, reason, status, reviewed_at")
        .eq("staff_id", userId)
        .order("start_date", { ascending: false });
      if (!cancelled) { setRequests(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleSubmit() {
    if (!form.start_date || !form.end_date) {
      setError("Start and end dates are required."); return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      setError("End date cannot be before start date."); return;
    }
    setSaving(true); setError(""); setSuccess("");
    const { data, error: err } = await supabase
      .from("availability")
      .insert({
        staff_id: userId, leave_type: form.leave_type,
        start_date: form.start_date, end_date: form.end_date,
        reason: form.reason.trim() || null, status:"pending",
      })
      .select().single();
    setSaving(false);
    if (err) { setError("Failed to submit. Please try again."); return; }
    setRequests(prev => [data, ...prev]);
    setForm({ leave_type:"annual", start_date:"", end_date:"", reason:"" });
    setShowing(false);
    setSuccess("Leave request submitted successfully.");
  }

  return (
    <StaffLayout title="Leave Requests">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Leave Requests</h2>
          <p style={s.sub}>{requests.filter(r => r.status === "pending").length} pending</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowing(!showing); setError(""); }}>
          {showing ? "Cancel" : "+ Request Leave"}
        </button>
      </div>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {showing && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>New Leave Request</h3>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Leave Type</label>
              <select style={s.input} value={form.leave_type}
                onChange={e => setForm(p => ({ ...p, leave_type:e.target.value }))}>
                {LEAVE_TYPES.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div style={s.row2}>
              <div style={s.field}>
                <label style={s.label}>Start Date *</label>
                <input style={s.input} type="date" value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date:e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>End Date *</label>
                <input style={s.input} type="date" value={form.end_date}
                  onChange={e => setForm(p => ({ ...p, end_date:e.target.value }))} />
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Reason (optional)</label>
              <textarea style={{ ...s.input, minHeight:"80px", resize:"vertical" }}
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason:e.target.value }))} />
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleSubmit} disabled={saving}>
            {saving ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : requests.length === 0 ? (
        <div style={s.empty}>No leave requests yet.</div>
      ) : (
        <div style={s.list}>
          {requests.map(r => (
            <div key={r.request_id} style={s.card}>
              <div style={s.cardTop}>
                <div>
                  <span style={s.leaveType}>
                    {r.leave_type.charAt(0).toUpperCase() + r.leave_type.slice(1)} Leave
                  </span>
                  <p style={s.dateRange}>
                    {fmtDate(r.start_date)} → {fmtDate(r.end_date)}
                  </p>
                  {r.reason && <p style={s.reason}>"{r.reason}"</p>}
                </div>
                <span style={{ ...s.badge, ...leaveBadge(r.status) }}>
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </StaffLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric", year:"numeric" });
}

function leaveBadge(status) {
  const map = {
    pending:  { background:"#FFFBEB", color:"#D97706" },
    approved: { background:"#DCFCE7", color:"#166534" },
    rejected: { background:"#FEE2E2", color:"#991B1B" },
  };
  return map[status] || map.pending;
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  addBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 18px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  formCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px", marginBottom:"20px" },
  row2: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  saveBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 20px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  list: { display:"flex", flexDirection:"column", gap:"10px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"12px", padding:"16px 20px" },
  cardTop: { display:"flex", justifyContent:"space-between", alignItems:"flex-start" },
  leaveType: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  dateRange: { fontSize:"13px", color:"#55524A", marginTop:"4px" },
  reason: { fontSize:"12px", color:"#7A7870", marginTop:"6px", fontStyle:"italic" },
  badge: { display:"inline-block", padding:"4px 10px", borderRadius:"100px",
    fontSize:"12px", fontWeight:"600", flexShrink:0 },
};
