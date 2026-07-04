import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { createPortal } from "react-dom";
import { Handshake, CalendarDays, Users, BarChart2, Pencil, Star, AlertTriangle, CheckCircle2, X } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("mgr-manpower-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-manpower-styles";
  style.textContent = `
    @keyframes pageIn    { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer   { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes toastIn   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes modalIn   { from { opacity:0; transform:scale(0.96) translateY(10px); } to { opacity:1; transform:scale(1) translateY(0); } }
    .req-card { transition: box-shadow 0.15s; }
    .req-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08) !important; }
    .mgr-input:focus { outline:none; border-color:#3B82F6 !important; box-shadow:0 0 0 3px rgba(59,130,246,0.12); }
    .cancel-req-btn:hover { background:#FEF2F2 !important; border-color:#FECACA !important; color:#991B1B !important; }
    .star-btn { background:none; border:none; outline:none; cursor:pointer; padding:0 4px; line-height:1; transition:transform 0.12s ease; box-shadow:none; }
    .star-btn:hover { transform: scale(1.15); }
    .star-btn:focus { outline:none; box-shadow:none; }
    .star-btn:disabled { cursor:default; }
    .star-btn:disabled:hover { transform:none; }
    .rating-submit-btn:not(:disabled):hover { background:#1E293B !important; }
  `;
  document.head.appendChild(style);
}

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very Good", "Excellent"];
const STAR_COLORS = { filled: "#F59E0B", empty: "#E2E8F0" };

function StarPicker({ value, onChange, disabled, size = 20 }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || value || 0;
  return (
    <div style={{ display: "flex", gap: "0px", alignItems: "center" }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} className="star-btn"
          disabled={disabled}
          onClick={() => !disabled && onChange(n)}
          onMouseEnter={() => !disabled && setHovered(n)}
          onMouseLeave={() => !disabled && setHovered(0)}>
          <svg width={size} height={size} viewBox="0 0 24 24"
            fill={n <= active ? STAR_COLORS.filled : STAR_COLORS.empty}
            stroke="none">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

const STATUS = {
  pending_review: { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A", label: "Pending Review", dot: "#F59E0B" },
  assigned:       { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE", label: "Assigned",       dot: "#3B82F6" },
  approved:       { bg: "#DCFCE7", color: "#166534", border: "#86EFAC", label: "Approved",       dot: "#22C55E" },
  completed:      { bg: "#F0FDF4", color: "#15803D", border: "#BBF7D0", label: "Completed",      dot: "#22C55E" },
  rejected:       { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA", label: "Rejected",       dot: "#EF4444" },
  cancelled:      { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: "Cancelled",      dot: "#94A3B8" },
};

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const EMPTY_FORM = { role_name: "", shift_date: "", start_time: "09:00", end_time: "18:00", headcount: 1, skill_id: "", notes: "" };

export default function ManpowerRequests() {
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]   = useState(null);
  const [outletName, setOutletName] = useState("");
  const [requests, setRequests]   = useState([]);
  const [skills, setSkills]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm]           = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]         = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [ratingTarget, setRatingTarget] = useState(null); // { requestId, workerId, current }
  const [ratingValue, setRatingValue]   = useState(0);
  const [ratingSaving, setRatingSaving] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  // Fetch outlet + requests
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Get manager's outlet
        const { data: staffRows } = await supabase
          .from("staff").select("outlet_id, outlets(outlet_id, name, address)")
          .eq("user_id", userId).limit(1);
        const oid = staffRows?.[0]?.outlet_id;
        const oName = staffRows?.[0]?.outlets?.name || "";
        if (!cancelled) { setOutletId(oid); setOutletName(oName); }
        if (!oid) { setLoading(false); return; }

        const [reqRes, libRes] = await Promise.all([
          supabase.from("krewby_requests")
            .select(`request_id, role_name, shift_date, start_time, end_time, headcount, status, override_note, outlet_address, created_at, manager_rating, assigned_worker_id, skills ( skill_id, name ), assigned_worker:assigned_worker_id ( krewby_worker_id, users ( full_name ) )`)
            .eq("outlet_id", oid)
            .order("created_at", { ascending: false }),
          api.get("/api/business/skills").catch(() => ({ skills: [] })),
        ]);

        if (!cancelled) {
          setRequests(reqRes.data || []);
          setSkills(libRes.skills || []);
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
    if (!form.role_name.trim()) { showToast("Role name is required.", "error"); return; }
    if (!form.shift_date)       { showToast("Date is required.", "error"); return; }
    if (form.headcount < 1)     { showToast("Headcount must be at least 1.", "error"); return; }

    setSubmitting(true);
    try {
      const payload = {
        outlet_id:     outletId,
        role_name:     form.role_name.trim(),
        shift_date:    form.shift_date,
        start_time:    form.start_time + ":00",
        end_time:      form.end_time   + ":00",
        headcount:     Number(form.headcount),
        status:        "pending_review",
        override_note: form.notes.trim() || null,
        skill_id:      form.skill_id || null,
      };
      const { data, error } = await supabase.from("krewby_requests").insert(payload).select(`request_id, role_name, shift_date, start_time, end_time, headcount, status, override_note, outlet_address, created_at, skills ( skill_id, name ), assigned_worker:assigned_worker_id ( krewby_worker_id )`).single();
      if (error) throw error;
      setRequests(prev => [data, ...prev]);
      setShowModal(false);
      setForm(EMPTY_FORM);
      showToast("Manpower request submitted! The coordinator will review it shortly.");
    } catch (err) {
      showToast(err.message || "Failed to submit request.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId) {
    try {
      const { error } = await supabase.from("krewby_requests")
        .update({ status: "cancelled" }).eq("request_id", requestId);
      if (error) throw error;
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: "cancelled" } : r));
      setCancelTarget(null);
      showToast("Request cancelled.");
    } catch (err) {
      showToast(err.message || "Failed to cancel.", "error");
    }
  }

  async function handleRate() {
    if (!ratingValue || !ratingTarget) return;
    setRatingSaving(true);
    try {
      const { error } = await supabase.from("krewby_requests")
        .update({ manager_rating: ratingValue })
        .eq("request_id", ratingTarget.requestId);
      if (error) throw error;
      // Recalculate average rating on the worker
      await supabase.rpc("update_worker_average_rating", { p_worker_id: ratingTarget.workerId });
      setRequests(prev => prev.map(r =>
        r.request_id === ratingTarget.requestId ? { ...r, manager_rating: ratingValue } : r
      ));
      setRatingTarget(null);
      setRatingValue(0);
      showToast(`Rated ${ratingValue} stars — thank you for your feedback!`);
    } catch (err) {
      showToast(err.message || "Failed to save rating.", "error");
    } finally {
      setRatingSaving(false);
    }
  }

  const FILTERS = [
    { value: "all",            label: "All" },
    { value: "pending_review", label: "Pending" },
    { value: "assigned",       label: "Assigned" },
    { value: "completed",      label: "Completed" },
    { value: "rejected",       label: "Rejected" },
    { value: "cancelled",      label: "Cancelled" },
  ];

  const displayed    = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending_review").length;

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const inputStyle = {
    width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0",
    borderRadius: "10px", fontSize: "14px", color: "#1E293B",
    background: "#FAFAFA", boxSizing: "border-box", transition: "border-color 0.15s",
    fontFamily: "inherit",
  };

  return (
    <ManagerLayout title="Manpower Requests">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", gap: "16px", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em" }}>Manpower Requests</h2>
            <p style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>
              Request Krewby casual workers for your outlet when you need extra hands.
              {pendingCount > 0 && <span style={{ marginLeft: "8px", background: "#FEF3C7", color: "#D97706", fontSize: "12px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px" }}>{pendingCount} pending</span>}
            </p>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "11px 20px", borderRadius: "11px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 12px rgba(37,99,235,0.3)", flexShrink: 0, transition: "background 0.15s" }}>
            <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span> New Request
          </button>
        </div>

        {/* ── Summary stats ── */}
        {!loading && requests.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {[
              { label: "Total",   count: requests.length,                                              color: "#1E293B", bg: "#F8FAFC", border: "#E2E8F0" },
              { label: "Pending", count: requests.filter(r => r.status === "pending_review").length,   color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" },
              { label: "Assigned / Approved", count: requests.filter(r => ["assigned","approved"].includes(r.status)).length, color: "#166534", bg: "#DCFCE7", border: "#86EFAC" },
              { label: "Rejected", count: requests.filter(r => r.status === "rejected").length,        color: "#991B1B", bg: "#FEE2E2", border: "#FECACA" },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: "12px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "24px", fontWeight: "800", color: s.color }}>{s.count}</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: s.color, opacity: 0.75 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Filter tabs ── */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content", flexWrap: "wrap" }}>
          {FILTERS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Request list ── */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <Shimmer w="180px" h="16px" r="6px" />
                  <Shimmer w="100px" h="24px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "20px" }}>
                  {[120, 140, 100, 90].map((w, j) => <Shimmer key={j} w={`${w}px`} h="36px" r="8px" />)}
                </div>
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "72px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><Handshake size={40} color="#CBD5E1" /></div>
            <p style={{ fontSize: "17px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {filter === "all" ? "No requests yet" : `No ${FILTERS.find(f => f.value === filter)?.label.toLowerCase()} requests`}
            </p>
            <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>
              {filter === "all" ? "Click 'New Request' to request Krewby workers for your outlet." : "Try a different filter."}
            </p>
            {filter === "all" && (
              <button onClick={() => { setForm(EMPTY_FORM); setShowModal(true); }}
                style={{ padding: "11px 24px", borderRadius: "10px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                New Request
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {displayed.map((req, i) => {
              const st = STATUS[req.status] || STATUS.pending_review;
              return (
                <div key={req.request_id} className="req-card"
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both` }}>

                  {/* Card header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>{req.role_name}</h3>
                        {req.skills?.name && (
                          <span style={{ fontSize: "11px", fontWeight: "600", background: "#EFF6FF", color: "#1D4ED8", padding: "2px 8px", borderRadius: "100px", border: "1px solid #BFDBFE" }}>
                            {req.skills.name}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "3px" }}>
                        Submitted {fmtDate(req.created_at)}
                      </p>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", background: st.bg, color: st.color, border: `1px solid ${st.border}`, flexShrink: 0 }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: st.dot, flexShrink: 0 }} />
                      {st.label}
                    </span>
                  </div>

                  {/* Details grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "12px", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: req.override_note ? "1px solid #F1F5F9" : "none", marginBottom: req.override_note || req.status === "pending_review" ? "14px" : 0 }}>
                    <InfoItem icon={<CalendarDays size={13} />} label="Date"    value={fmtDate(req.shift_date)} />
                    <InfoItem icon={<Users size={13} />} label="Workers" value={`${req.headcount} worker${req.headcount > 1 ? "s" : ""}`} />
                    <InfoItem icon={<BarChart2 size={13} />} label="Status"  value={st.label} />
                  </div>

                  {req.override_note && (
                    <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "10px 14px", marginBottom: req.status === "pending_review" ? "14px" : 0 }}>
                      <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "2px" }}>Notes</p>
                      <p style={{ fontSize: "13px", color: "#475569", fontStyle: "italic" }}>"{req.override_note}"</p>
                    </div>
                  )}

                  {/* Cancel action — only for pending */}
                  {req.status === "pending_review" && (
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button className="cancel-req-btn" onClick={() => setCancelTarget(req.request_id)}
                        style={{ padding: "7px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: "600", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", cursor: "pointer", transition: "all 0.15s" }}>
                        Cancel Request
                      </button>
                    </div>
                  )}

                  {/* Rating — only for completed requests with a worker assigned */}
                  {req.status === "completed" && req.assigned_worker_id && (
                    <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "14px", marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        {req.manager_rating ? (
                          <>
                            <StarPicker value={req.manager_rating} disabled size={14} />
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "#F59E0B" }}>{req.manager_rating}/5</span>
                            <span style={{ fontSize: "12px", color: "#CBD5E1" }}>·</span>
                            <span style={{ fontSize: "12px", color: "#94A3B8" }}>{STAR_LABELS[req.manager_rating]}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#CBD5E1", fontStyle: "italic" }}>Not yet rated</span>
                        )}
                      </div>
                      <button
                        onClick={() => { setRatingTarget({ requestId: req.request_id, workerId: req.assigned_worker_id, workerName: req.assigned_worker?.users?.full_name }); setRatingValue(req.manager_rating || 0); }}
                        style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #E2E8F0", background: "#FFF", color: "#475569", fontSize: "12px", fontWeight: "600", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", gap: "5px" }}>
                        {req.manager_rating ? <><Pencil size={12} /> Edit</> : <><Star size={12} /> Rate</>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New Request Modal ── */}
      {showModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }} onClick={() => setShowModal(false)} />
          <div style={{ position: "relative", background: "#FFF", borderRadius: "20px", width: "520px", maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", animation: "modalIn 0.22s ease both" }}>

            {/* Modal header */}
            <div style={{ padding: "24px 28px 0", borderBottom: "1px solid #F1F5F9", paddingBottom: "18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A" }}>Request Manpower</h3>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
                  The coordinator will review and assign Krewby workers.
                </p>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                ×
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: "18px" }}>

              {/* Role */}
              <div>
                <label style={labelStyle}>Role / Position <span style={{ color: "#EF4444" }}>*</span></label>
                <input className="mgr-input" value={form.role_name} onChange={e => f("role_name", e.target.value)}
                  placeholder="e.g. Cashier, Server, Kitchen Helper"
                  style={inputStyle} />
              </div>

              {/* Skill tag */}
              <div>
                <label style={labelStyle}>Skill Required <span style={{ color: "#94A3B8", fontWeight: "400" }}>(optional)</span></label>
                <select className="mgr-input" value={form.skill_id} onChange={e => f("skill_id", e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— No specific skill —</option>
                  {skills.map(s => <option key={s.skill_id} value={s.skill_id}>{s.name}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label style={labelStyle}>Date <span style={{ color: "#EF4444" }}>*</span></label>
                <input className="mgr-input" type="date" value={form.shift_date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={e => f("shift_date", e.target.value)}
                  style={inputStyle} />
              </div>

              {/* Headcount */}
              <div>
                <label style={labelStyle}>Number of Workers Needed <span style={{ color: "#EF4444" }}>*</span></label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => f("headcount", Math.max(1, form.headcount - 1))}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: "20px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}>
                    −
                  </button>
                  <div style={{ flex: 1, textAlign: "center", fontSize: "24px", fontWeight: "800", color: "#1E293B" }}>
                    {form.headcount}
                  </div>
                  <button onClick={() => f("headcount", Math.min(20, form.headcount + 1))}
                    style={{ width: "40px", height: "40px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: "20px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}>
                    +
                  </button>
                </div>
                <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "6px", textAlign: "center" }}>
                  {form.headcount} worker{form.headcount !== 1 ? "s" : ""} will be requested
                </p>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Additional Notes <span style={{ color: "#94A3B8", fontWeight: "400" }}>(optional)</span></label>
                <textarea className="mgr-input" value={form.notes} onChange={e => f("notes", e.target.value)}
                  placeholder="e.g. Must have F&B experience, preferred 21+ age, uniform provided..."
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", minHeight: "80px", lineHeight: "1.5" }} />
              </div>

              {/* Summary preview */}
              {form.role_name && form.shift_date && (
                <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "12px 16px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#1D4ED8", marginBottom: "4px" }}>Request Summary</p>
                  <p style={{ fontSize: "13px", color: "#1E40AF" }}>
                    {form.headcount} × <strong>{form.role_name}</strong> at <strong>{outletName}</strong> on {fmtDate(form.shift_date)}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "0 28px 24px", display: "flex", gap: "10px" }}>
              <button onClick={() => setShowModal(false)} disabled={submitting}
                style={{ flex: 1, padding: "12px", borderRadius: "11px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting}
                style={{ flex: 2, padding: "12px", borderRadius: "11px", border: "none", background: submitting ? "#93C5FD" : "#2563EB", color: "#FFF", fontSize: "14px", fontWeight: "700", cursor: submitting ? "not-allowed" : "pointer", boxShadow: "0 2px 10px rgba(37,99,235,0.3)", transition: "background 0.15s" }}>
                {submitting ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Rating modal ── */}
      {ratingTarget && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }} onClick={() => setRatingTarget(null)} />
          <div style={{ position: "relative", background: "#FFF", borderRadius: "20px", width: "400px", maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.22)", animation: "modalIn 0.22s ease both", overflow: "hidden" }}>

            {/* Amber accent bar */}
            <div style={{ height: "3px", background: "linear-gradient(90deg, #F59E0B, #FBBF24)" }} />

            {/* Header */}
            <div style={{ padding: "24px 24px 0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#F59E0B", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>Performance Review</p>
                  <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A", lineHeight: 1.2 }}>
                    {ratingTarget.workerName || "Rate Worker"}
                  </h3>
                  <p style={{ fontSize: "12.5px", color: "#94A3B8", marginTop: "3px" }}>How did they perform during this shift?</p>
                </div>
                <button onClick={() => setRatingTarget(null)}
                  style={{ width: "30px", height: "30px", borderRadius: "8px", border: "none", background: "#F1F5F9", color: "#94A3B8", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1, marginTop: "2px" }}>
                  ×
                </button>
              </div>
            </div>

            {/* Star picker body */}
            <div style={{ padding: "28px 24px 24px" }}>

              {/* Stars centered */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", background: "#FAFAFA", borderRadius: "14px", padding: "24px 20px 18px" }}>
                <StarPicker value={ratingValue} onChange={setRatingValue} size={36} />
                <div style={{ height: "28px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ratingValue ? (
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#F59E0B", letterSpacing: "0.01em" }}>
                      {STAR_LABELS[ratingValue]}
                    </span>
                  ) : (
                    <span style={{ fontSize: "13px", color: "#CBD5E1" }}>Tap a star to rate</span>
                  )}
                </div>
              </div>

              {/* Score dots */}
              <div style={{ display: "flex", justifyContent: "center", gap: "6px", marginTop: "14px" }}>
                {[1,2,3,4,5].map(n => (
                  <div key={n} style={{ width: "6px", height: "6px", borderRadius: "50%", background: n <= ratingValue ? "#F59E0B" : "#E2E8F0", transition: "background 0.2s" }} />
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                <button onClick={() => setRatingTarget(null)} disabled={ratingSaving}
                  style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleRate} disabled={ratingSaving || !ratingValue} className="rating-submit-btn"
                  style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: !ratingValue ? "#E2E8F0" : "#0F172A", color: !ratingValue ? "#94A3B8" : "#FFF", fontSize: "13px", fontWeight: "700", cursor: !ratingValue || ratingSaving ? "not-allowed" : "pointer", transition: "background 0.15s", letterSpacing: "0.01em" }}>
                  {ratingSaving ? "Saving…" : ratingValue ? `Submit · ${ratingValue}/5` : "Select a Rating"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Cancel confirm modal ── */}
      {cancelTarget && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} onClick={() => setCancelTarget(null)} />
          <div style={{ position: "relative", background: "#FFF", borderRadius: "16px", padding: "28px", width: "360px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", animation: "modalIn 0.2s ease both" }}>
            <div style={{ marginBottom: "12px", display: "flex", justifyContent: "center" }}><AlertTriangle size={36} color="#F59E0B" /></div>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>Cancel this request?</h3>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "22px" }}>The coordinator won't be able to action it after cancellation.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setCancelTarget(null)}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Keep it
              </button>
              <button onClick={() => handleCancel(cancelTarget)}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "#EF4444", color: "#FFF", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                Yes, cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 99999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#FFF", padding: "13px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both", display: "flex", alignItems: "center", gap: "8px" }}>
          {toast.type === "success" ? <CheckCircle2 size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

const labelStyle = { fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "6px" };

function InfoItem({ icon, label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{icon} {value}</span>
    </div>
  );
}
