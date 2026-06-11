import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function KrewbyRequests() {
  const [requests, setRequests]   = useState([]);
  const [skills, setSkills]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [filter, setFilter]       = useState("all");

  const [form, setForm] = useState({
    role_name: "", skill_id: "", shift_date: "",
    start_time: "", end_time: "", outlet_address: "", headcount: 1
  });

  useEffect(() => {
    Promise.all([
      api.get("/api/krewby/requests"),
      api.get("/api/skills"),
    ]).then(([reqRes, skillRes]) => {
      setRequests(reqRes.data || []);
      setSkills(skillRes.skills || skillRes.data || []);
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.role_name || !form.shift_date || !form.start_time || !form.end_time) {
      setError("Role name, date, start time and end time are required.");
      return;
    }
    setSubmitting(true); setError("");
    try {
      const res = await api.post("/api/krewby/requests", {
        ...form,
        skill_id: form.skill_id ? Number(form.skill_id) : null,
        headcount: Number(form.headcount),
      });
      setRequests(prev => [res.data, ...prev]);
      setShowForm(false);
      setForm({ role_name: "", skill_id: "", shift_date: "", start_time: "", end_time: "", outlet_address: "", headcount: 1 });
      setSuccess("Krewby request submitted! The coordinator will review it shortly.");
      setTimeout(() => setSuccess(""), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId) {
    if (!window.confirm("Cancel this Krewby request?")) return;
    try {
      await api.patch(`/api/krewby/requests/${requestId}`, { status: "cancelled" });
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: "cancelled" } : r));
    } catch (err) {
      setError(err.message);
    }
  }

  const filtered = requests.filter(r => filter === "all" ? true : r.status === filter);

  return (
    <ManagerLayout title="Krewby Requests">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Krewby Casual Workers</h2>
          <p style={s.sub}>Request external casual workers when internal staffing is insufficient.</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowForm(!showForm); setError(""); }}>
          {showForm ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {success && <div style={s.successMsg}>{success}</div>}

      {showForm && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>New Krewby Request</h3>
          {error && <div style={s.error}>{error}</div>}
          <form onSubmit={handleSubmit}>
            <div style={s.formGrid}>
              <div style={s.field}>
                <label style={s.label}>Role Name *</label>
                <input style={s.input} placeholder="e.g. Floor Service" value={form.role_name}
                  onChange={e => setForm({ ...form, role_name: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Required Skill</label>
                <select style={s.input} value={form.skill_id}
                  onChange={e => setForm({ ...form, skill_id: e.target.value })}>
                  <option value="">No specific skill</option>
                  {skills.map(sk => <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Shift Date *</label>
                <input style={s.input} type="date" value={form.shift_date}
                  onChange={e => setForm({ ...form, shift_date: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Headcount</label>
                <input style={s.input} type="number" min="1" max="20" value={form.headcount}
                  onChange={e => setForm({ ...form, headcount: e.target.value })} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Start Time *</label>
                <input style={s.input} type="time" value={form.start_time}
                  onChange={e => setForm({ ...form, start_time: e.target.value })} required />
              </div>
              <div style={s.field}>
                <label style={s.label}>End Time *</label>
                <input style={s.input} type="time" value={form.end_time}
                  onChange={e => setForm({ ...form, end_time: e.target.value })} required />
              </div>
              <div style={{ ...s.field, gridColumn: "1 / -1" }}>
                <label style={s.label}>Outlet Address</label>
                <input style={s.input} placeholder="e.g. 176 Orchard Road, Singapore 238843"
                  value={form.outlet_address}
                  onChange={e => setForm({ ...form, outlet_address: e.target.value })} />
              </div>
            </div>
            <div style={s.formActions}>
              <button type="button" style={s.cancelBtn} onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" style={s.submitBtn} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={s.tabs}>
        {[
          { key: "all", label: "All" },
          { key: "pending_review", label: "Pending" },
          { key: "matched", label: "Matched" },
          { key: "confirmed", label: "Confirmed" },
          { key: "completed", label: "Completed" },
          { key: "cancelled", label: "Cancelled" },
          { key: "rejected", label: "Rejected" },
        ].map(f => (
          <button key={f.key} style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }}
            onClick={() => setFilter(f.key)}>
            {f.label}
            {f.key === "pending_review" && requests.filter(r => r.status === "pending_review").length > 0 && (
              <span style={s.badge}>{requests.filter(r => r.status === "pending_review").length}</span>
            )}
          </button>
        ))}
      </div>

      {loading ? <div style={s.empty}>Loading…</div>
        : filtered.length === 0 ? (
          <div style={s.emptyCard}>
            <p style={s.emptyIcon}>🧑‍🍳</p>
            <p style={s.emptyTitle}>No {filter === "all" ? "" : filter.replace("_", " ")} requests</p>
            <p style={s.emptySub}>Click "+ New Request" to request a Krewby casual worker.</p>
          </div>
        ) : filtered.map(req => (
          <div key={req.request_id} style={s.card}>
            <div style={s.cardTop}>
              <div style={s.cardLeft}>
                <p style={s.reqTitle}>{req.role_name}</p>
                <p style={s.reqMeta}>
                  {fmtDate(req.shift_date)} · {fmtTime(req.start_time)} – {fmtTime(req.end_time)}
                </p>
                {req.skills?.name && <p style={s.reqSkill}>Requires: {req.skills.name}</p>}
                {req.assigned_worker_id && (
                  <p style={s.reqWorker}>
                    Worker assigned: {req.krewby_workers?.users?.full_name || `Worker #${req.assigned_worker_id}`}
                  </p>
                )}
              </div>
              <div style={s.cardRight}>
                <span style={{ ...s.statusBadge, ...statusStyle(req.status) }}>
                  {req.status.replace(/_/g, " ")}
                </span>
                {(req.status === "pending_review" || req.status === "matched") && (
                  <button style={s.cancelReqBtn} onClick={() => handleCancel(req.request_id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      }
    </ManagerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  try {
    const s = String(t);
    if (s.length === 5 && s[2] === ':') return s;
    if (s.length >= 8 && s[2] === ':') return s.slice(0, 5);
    if (s.includes("T")) return s.split("T")[1].slice(0, 5);
    return s.slice(0, 5);
  } catch { return "—"; }
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    const clean = String(d).includes("T") ? String(d).split("T")[0] : String(d);
    return new Date(clean + "T00:00:00Z").toLocaleDateString("en-SG", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC"
    });
  } catch { return "—"; }
}
function statusStyle(status) {
  const map = {
    pending_review: { background: "#FFFBEB", color: "#D97706" },
    matched:        { background: "#DBEAFE", color: "#1E40AF" },
    confirmed:      { background: "#DCFCE7", color: "#166534" },
    completed:      { background: "#F0FDF4", color: "#15803D" },
    cancelled:      { background: "#F3F4F6", color: "#6B7280" },
    rejected:       { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || { background: "#F3F4F6", color: "#6B7280" };
}

const s = {
  headerRow:  { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading:    { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub:        { fontSize:"13px", color:"#7A7870", marginTop:"3px" },
  addBtn:     { background:"#1C1B18", color:"#FFF", border:"none", borderRadius:"9px", padding:"10px 18px", fontSize:"13px", fontWeight:"600", cursor:"pointer" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  formCard:   { background:"#FFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle:  { fontSize:"16px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  error:      { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"14px" },
  formGrid:   { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"16px" },
  field:      { display:"flex", flexDirection:"column", gap:"5px" },
  label:      { fontSize:"13px", fontWeight:"600", color:"#55524A" },
  input:      { padding:"9px 12px", border:"1.5px solid #D8D5CE", borderRadius:"8px", fontSize:"14px", background:"#FFF", color:"#1C1B18" },
  formActions:{ display:"flex", justifyContent:"flex-end", gap:"10px" },
  cancelBtn:  { background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"8px", padding:"9px 18px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  submitBtn:  { background:"#1C1B18", border:"none", borderRadius:"8px", padding:"9px 20px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" },
  tabs:       { display:"flex", gap:"4px", background:"#F0EDE8", padding:"4px", borderRadius:"10px", marginBottom:"16px", flexWrap:"wrap" },
  tab:        { padding:"6px 14px", background:"transparent", border:"none", borderRadius:"7px", fontSize:"13px", fontWeight:"500", color:"#7A7870", cursor:"pointer", display:"flex", alignItems:"center", gap:"6px" },
  tabActive:  { background:"#FFF", color:"#1C1B18", fontWeight:"600", boxShadow:"0 1px 3px rgba(0,0,0,0.08)" },
  badge:      { background:"#EF4444", color:"#FFF", fontSize:"10px", fontWeight:"700", padding:"1px 5px", borderRadius:"100px" },
  empty:      { textAlign:"center", padding:"60px", color:"#7A7870" },
  emptyCard:  { background:"#FFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon:  { fontSize:"32px", marginBottom:"10px" },
  emptyTitle: { fontSize:"16px", fontWeight:"600", color:"#7A7870", marginBottom:"6px" },
  emptySub:   { fontSize:"13px", color:"#A09D97" },
  card:       { background:"#FFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"18px 20px", marginBottom:"10px" },
  cardTop:    { display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"12px" },
  cardLeft:   { flex:1 },
  cardRight:  { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px", flexShrink:0 },
  reqTitle:   { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"4px" },
  reqMeta:    { fontSize:"13px", color:"#7A7870" },
  reqSkill:   { fontSize:"12px", color:"#55524A", marginTop:"4px" },
  reqWorker:  { fontSize:"12px", color:"#166534", fontWeight:"600", marginTop:"4px" },
  statusBadge:{ padding:"4px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600", textTransform:"capitalize" },
  cancelReqBtn:{ background:"none", border:"1px solid #FECACA", borderRadius:"6px", padding:"4px 10px", fontSize:"12px", fontWeight:"600", color:"#991B1B", cursor:"pointer" },
};
