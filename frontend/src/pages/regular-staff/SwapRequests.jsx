import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";

export default function SwapRequests() {
  const user = getUser();
  const userId = user?.user_id;

  const [myShifts, setMyShifts]   = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showing, setShowing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const [form, setForm] = useState({
    requester_assign: "", request_type: "swap", reason: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const [{ data: assignments }, { data: reqs }] = await Promise.all([
          supabase.from("shift_assignments")
            .select(`
              assignment_id,
              shifts!inner ( shift_id, title, shift_date, start_time, end_time, status )
            `)
            .eq("staff_id", userId)
            .gte("shifts.shift_date", today)
            .eq("shifts.status", "published"),
          supabase.from("swap_requests")
            .select(`
              swap_id, request_type, reason, status, responded_at,
              shift_assignments_swap_requests_requester_assignToshift_assignments (
                shifts ( title, shift_date, start_time, end_time )
              )
            `)
            .eq("requester_id", userId)
            .order("swap_id", { ascending: false }),
        ]);

        if (!cancelled) {
          setMyShifts((assignments || []).filter(a => a.shifts));
          setRequests(reqs || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleSubmit() {
    if (!form.requester_assign) { setError("Please select a shift."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const { data, error: err } = await supabase
        .from("swap_requests")
        .insert({
          requester_id: userId,
          requester_assign: Number(form.requester_assign),
          request_type: form.request_type,
          reason: form.reason.trim() || null,
          status: "pending",
        })
        .select().single();

      if (err) throw err;
      setRequests(prev => [data, ...prev]);
      setForm({ requester_assign: "", request_type: "swap", reason: "" });
      setShowing(false);
      setSuccess("Request submitted successfully.");
    } catch (err) {
      setError("Failed to submit request.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function statusStyle(status) {
    const map = {
      pending:  { background:"#FFFBEB", color:"#D97706" },
      accepted: { background:"#DCFCE7", color:"#166534" },
      approved: { background:"#DBEAFE", color:"#1E40AF" },
      rejected: { background:"#FEE2E2", color:"#991B1B" },
      cancelled:{ background:"#F3F4F6", color:"#6B7280" },
    };
    return map[status] || map.pending;
  }

  return (
    <StaffLayout title="Swap Requests">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Swap Requests</h2>
          <p style={s.sub}>{requests.filter(r => r.status === "pending").length} pending</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowing(!showing); setError(""); }}>
          {showing ? "Cancel" : "+ New Request"}
        </button>
      </div>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {showing && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>New Swap / Replacement Request</h3>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Select Shift *</label>
              <select style={s.input} value={form.requester_assign}
                onChange={e => setForm(p => ({ ...p, requester_assign: e.target.value }))}>
                <option value="">Choose a shift…</option>
                {myShifts.map(a => (
                  <option key={a.assignment_id} value={a.assignment_id}>
                    {a.shifts?.title || "Shift"} · {fmtDate(a.shifts?.shift_date)} · {a.shifts?.start_time?.slice(0,5)}
                  </option>
                ))}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Request Type</label>
              <select style={s.input} value={form.request_type}
                onChange={e => setForm(p => ({ ...p, request_type: e.target.value }))}>
                <option value="swap">Swap — find someone to trade with</option>
                <option value="replacement">Replacement — find cover</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Reason (optional)</label>
              <textarea style={{ ...s.input, minHeight:"70px", resize:"vertical" }}
                value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
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
        <div style={s.emptyCard}>
          <p style={s.emptyIcon}>🔄</p>
          <p style={s.emptyTitle}>No requests yet</p>
        </div>
      ) : (
        <div style={s.list}>
          {requests.map(r => {
            const shift = r.shift_assignments_swap_requests_requester_assignToshift_assignments?.shifts;
            return (
              <div key={r.swap_id} style={s.card}>
                <div style={s.cardTop}>
                  <div>
                    <p style={s.reqType}>
                      {r.request_type === "swap" ? "🔄 Swap Request" : "🆘 Replacement Request"}
                    </p>
                    {shift && (
                      <p style={s.shiftInfo}>
                        {shift.title || "Shift"} · {fmtDate(shift.shift_date)} · {shift.start_time?.slice(0,5)}
                      </p>
                    )}
                    {r.reason && <p style={s.reason}>"{r.reason}"</p>}
                  </div>
                  <span style={{ ...s.badge, ...statusStyle(r.status) }}>
                    {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StaffLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric" });
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
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  formCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px", marginBottom:"20px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  saveBtn: { background:"#1C1B18", border:"none", borderRadius:"10px",
    padding:"10px 20px", fontSize:"14px", fontWeight:"700",
    color:"#FFFFFF", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  emptyCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"60px", textAlign:"center" },
  emptyIcon: { fontSize:"32px", marginBottom:"10px" },
  emptyTitle: { fontSize:"16px", fontWeight:"600", color:"#7A7870" },
  list: { display:"flex", flexDirection:"column", gap:"10px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"12px", padding:"16px 20px" },
  cardTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", gap:"12px" },
  reqType: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  shiftInfo: { fontSize:"13px", color:"#55524A", marginTop:"3px" },
  reason: { fontSize:"12px", color:"#7A7870", fontStyle:"italic", marginTop:"6px" },
  badge: { display:"inline-block", padding:"4px 10px", borderRadius:"100px",
    fontSize:"12px", fontWeight:"600", flexShrink:0 },
};
