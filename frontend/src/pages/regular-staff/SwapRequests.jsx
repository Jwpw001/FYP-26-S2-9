import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import StaffLayout from "../../components/layout/StaffLayout";
import { RefreshCw, AlertCircle } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-swaps-styles")) {
  const style = document.createElement("style");
  style.id = "staff-swaps-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(14px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position: 600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
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
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

export default function SwapRequests() {
  const user = getUser();
  const userId = user?.user_id;

  const [myShifts, setMyShifts]   = useState([]);
  const [requests, setRequests]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [showing, setShowing]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [toast, setToast]         = useState(null);
  const [form, setForm]           = useState({ requester_assign: "", request_type: "swap", reason: "" });
  const [staffId, setStaffId]     = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = new Date().toISOString().split("T")[0];

        const { data: myStaff } = await supabase
          .from("staff").select("staff_id")
          .eq("user_id", userId).limit(1);
        const sid = myStaff?.[0]?.staff_id;
        if (cancelled) return;
        setStaffId(sid || null);
        if (!sid) { setMyShifts([]); setRequests([]); return; }

        const [{ data: assignments }, { data: reqs }] = await Promise.all([
          supabase.from("shift_assignments")
            .select(`assignment_id, shifts!inner ( shift_id, title, shift_date, start_time, end_time, status )`)
            .eq("staff_id", sid)
            .gte("shifts.shift_date", today)
            .eq("shifts.status", "published"),
          supabase.from("swap_requests")
            .select(`
              swap_id, request_type, reason, status, responded_at,
              shift_assignments_swap_requests_requester_assignToshift_assignments (
                shifts ( title, shift_date, start_time, end_time )
              )
            `)
            .eq("requester_id", sid)
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
    if (!staffId) { setError("No staff record found for your account."); return; }
    setSaving(true); setError("");
    try {
      const { data, error: err } = await supabase
        .from("swap_requests")
        .insert({
          requester_id: staffId,
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
      showToast("Request submitted successfully.");
    } catch (err) {
      setError("Failed to submit request.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const FILTER_TABS = [
    { value: "all",      label: "All" },
    { value: "pending",  label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  const filtered = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <StaffLayout title="Swap Requests">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Swap & Replacement Requests</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {pendingCount > 0 ? `${pendingCount} pending` : "No pending requests"}
            </p>
          </div>
          <button
            onClick={() => { setShowing(!showing); setError(""); }}
            style={{ background: "#2563EB", color: "#FFFFFF", border: "none", padding: "10px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
            {showing ? "Cancel" : "+ New Request"}
          </button>
        </div>

        {/* Form */}
        {showing && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "26px", marginBottom: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.08)", animation: "popIn 0.2s ease both" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "20px" }}>New Swap / Replacement Request</h3>
            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" }}>
                {error}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "22px" }}>
              <div>
                <label style={lbl}>Select Shift *</label>
                <select style={inp} value={form.requester_assign}
                  onChange={e => setForm(p => ({ ...p, requester_assign: e.target.value }))}>
                  <option value="">Choose a shift…</option>
                  {myShifts.map(a => (
                    <option key={a.assignment_id} value={a.assignment_id}>
                      {a.shifts?.title || "Shift"} · {fmtDate(a.shifts?.shift_date)} · {a.shifts?.start_time?.slice(0,5)}
                    </option>
                  ))}
                </select>
                {myShifts.length === 0 && (
                  <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "6px" }}>No upcoming published shifts to request swap for.</p>
                )}
              </div>
              <div>
                <label style={lbl}>Request Type</label>
                <select style={inp} value={form.request_type}
                  onChange={e => setForm(p => ({ ...p, request_type: e.target.value }))}>
                  <option value="swap">Swap — find someone to trade with</option>
                  <option value="replacement">Replacement — find cover</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Reason (optional)</label>
                <textarea style={{ ...inp, minHeight: "80px", resize: "vertical" }}
                  value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} />
              </div>
            </div>
            <button onClick={handleSubmit} disabled={saving}
              style={{ background: saving ? "#93C5FD" : "#2563EB", color: "#FFFFFF", border: "none", padding: "11px 24px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", cursor: saving ? "default" : "pointer" }}>
              {saving ? "Submitting…" : "Submit Request"}
            </button>
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content" }}>
          {FILTER_TABS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{
                padding: "7px 16px", background: filter === t.value ? "#FFFFFF" : "transparent",
                border: "none", borderRadius: "7px", fontSize: "13px",
                fontWeight: filter === t.value ? "600" : "500",
                color: filter === t.value ? "#1E293B" : "#64748B",
                cursor: "pointer",
                boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                  <Shimmer w="160px" h="16px" r="6px" />
                  <Shimmer w="70px" h="24px" r="100px" />
                </div>
                <Shimmer w="200px" h="13px" r="5px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "12px" }}><RefreshCw size={36} color="#64748B" /></div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No swap requests yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "6px" }}>Submit a request when you need to swap or find cover for a shift.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((r, i) => {
              const shift = r.shift_assignments_swap_requests_requester_assignToshift_assignments?.shifts;
              const typeColor = r.request_type === "swap"
                ? { bg: "#EFF6FF", color: "#1D4ED8" }
                : { bg: "#F5F3FF", color: "#6D28D9" };
              return (
                <div key={r.swap_id}
                  style={{
                    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    animation: `fadeSlideUp 0.3s ease ${i * 0.06}s both`,
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <span style={{ padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", background: typeColor.bg, color: typeColor.color }}>
                      {r.request_type === "swap" ? <><RefreshCw size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} /> Shift Swap</> : <><AlertCircle size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} /> Replacement</>}
                    </span>
                    <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle(r.status) }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  {shift && (
                    <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: r.reason ? "1px solid #F1F5F9" : "none" }}>
                      <InfoItem label="Shift" value={shift.title || "Shift"} />
                      <InfoItem label="Date"  value={fmtDate(shift.shift_date)} />
                      <InfoItem label="Time"  value={`${shift.start_time?.slice(0,5)} – ${shift.end_time?.slice(0,5)}`} />
                    </div>
                  )}
                  {r.reason && (
                    <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginTop: "12px" }}>
                      "{r.reason}"
                    </p>
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
    </StaffLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

function statusStyle(status) {
  const map = {
    pending:  { background: "#FFFBEB", color: "#D97706" },
    approved: { background: "#DCFCE7", color: "#166534" },
    rejected: { background: "#FEE2E2", color: "#991B1B" },
    cancelled:{ background: "#F3F4F6", color: "#6B7280" },
  };
  return map[status] || map.pending;
}

const lbl = { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" };
const inp = { display: "block", width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", boxSizing: "border-box" };
