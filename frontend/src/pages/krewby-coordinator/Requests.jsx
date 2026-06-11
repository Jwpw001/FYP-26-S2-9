import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";
import { createPortal } from "react-dom";

if (typeof document !== "undefined" && !document.getElementById("coord-req-styles")) {
  const style = document.createElement("style");
  style.id = "coord-req-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes panelIn { from { opacity:0; transform:translateX(40px); } to { opacity:1; transform:translateX(0); } }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_STYLE = {
  pending_review: { bg: "#FFFBEB", color: "#D97706", label: "Pending Review" },
  assigned:       { bg: "#EFF6FF", color: "#1D4ED8", label: "Assigned" },
  approved:       { bg: "#DCFCE7", color: "#166534", label: "Approved" },
  rejected:       { bg: "#FEE2E2", color: "#991B1B", label: "Rejected" },
  cancelled:      { bg: "#F1F5F9", color: "#475569", label: "Cancelled" },
};

export default function CoordinatorRequests() {
  const [requests, setRequests]     = useState([]);
  const [workers, setWorkers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("pending_review");
  const [toast, setToast]           = useState(null);
  const [assignModal, setAssignModal] = useState(null); // { request }
  const [pickedWorker, setPickedWorker] = useState("");
  const [assigning, setAssigning]   = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [reqResult, wrkResult] = await Promise.all([
          supabase
            .from("krewby_requests")
            .select(`
              request_id, role_name, shift_date, start_time, end_time,
              headcount, status, outlet_address, override_note, created_at,
              outlets ( name ),
              skills ( name ),
              assigned_worker:assigned_worker_id ( krewby_worker_id, user_id )
            `)
            .order("created_at", { ascending: false }),
          api.get("/api/auth/krewby-workers"),
        ]);

        if (!cancelled) {
          setRequests(reqResult.data || []);
          setWorkers(wrkResult.workers || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAssign() {
    if (!pickedWorker) { showToast("Please select a worker.", "error"); return; }
    setAssigning(true);
    try {
      const { error } = await supabase
        .from("krewby_requests")
        .update({ assigned_worker_id: Number(pickedWorker), status: "assigned", updated_at: new Date().toISOString() })
        .eq("request_id", assignModal.request.request_id);
      if (error) throw error;

      const worker = workers.find(w => w.krewby_worker_id === Number(pickedWorker));
      setRequests(prev => prev.map(r =>
        r.request_id === assignModal.request.request_id
          ? { ...r, status: "assigned", assigned_worker: { krewby_worker_id: Number(pickedWorker), user_id: worker?.user_id } }
          : r
      ));
      setAssignModal(null);
      setPickedWorker("");
      showToast("Worker assigned successfully.");
    } catch (err) {
      showToast(err.message || "Failed to assign worker.", "error");
    } finally {
      setAssigning(false);
    }
  }

  async function handleReject(requestId) {
    try {
      const { error } = await supabase
        .from("krewby_requests")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("request_id", requestId);
      if (error) throw error;
      setRequests(prev => prev.map(r => r.request_id === requestId ? { ...r, status: "rejected" } : r));
      showToast("Request rejected.", "error");
    } catch (err) {
      showToast(err.message || "Failed.", "error");
    }
  }

  const FILTERS = [
    { value: "pending_review", label: "Pending" },
    { value: "assigned",       label: "Assigned" },
    { value: "approved",       label: "Approved" },
    { value: "rejected",       label: "Rejected" },
    { value: "all",            label: "All" },
  ];

  const filtered    = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCnt  = requests.filter(r => r.status === "pending_review").length;

  // Helper: find worker name
  function workerName(w) {
    if (!w) return "—";
    const found = workers.find(wk => wk.krewby_worker_id === w.krewby_worker_id);
    return found?.user?.full_name || found?.user?.email || `Worker #${w.krewby_worker_id}`;
  }

  return (
    <CoordinatorLayout title="Requests">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Krewby Requests</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
            Shift requests from outlets that need Krewby workers · {pendingCnt} pending review
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "20px", width: "fit-content" }}>
          {FILTERS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
              {t.value === "pending_review" && pendingCnt > 0 && (
                <span style={{ background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>{pendingCnt}</span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
                  <Shimmer w="200px" h="16px" r="6px" />
                  <Shimmer w="90px" h="24px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "20px" }}>
                  {[100, 120, 100, 80].map((w, j) => <Shimmer key={j} w={`${w}px`} h="34px" r="8px" />)}
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>📋</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>
              No {filter === "all" ? "" : FILTERS.find(f => f.value === filter)?.label.toLowerCase()} requests
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((req, i) => {
              const st = STATUS_STYLE[req.status] || STATUS_STYLE.pending_review;
              return (
                <div key={req.request_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }}>

                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>
                        {req.role_name}
                        {req.skills?.name && <span style={{ marginLeft: "8px", fontSize: "12px", fontWeight: "500", color: "#64748B" }}>· {req.skills.name}</span>}
                      </p>
                      <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                        {req.outlets?.name || "Unknown outlet"}
                        {req.outlet_address && ` · ${req.outlet_address}`}
                      </p>
                    </div>
                    <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", background: st.bg, color: st.color, flexShrink: 0 }}>
                      {st.label}
                    </span>
                  </div>

                  {/* Details row */}
                  <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: "14px" }}>
                    <InfoItem label="Date"      value={fmtDate(req.shift_date)} />
                    <InfoItem label="Time"      value={`${req.start_time?.slice(0,5)} – ${req.end_time?.slice(0,5)}`} />
                    <InfoItem label="Headcount" value={`${req.headcount} worker${req.headcount > 1 ? "s" : ""}`} />
                    <InfoItem label="Submitted" value={fmtDate(req.created_at)} />
                    {req.status !== "pending_review" && req.assigned_worker && (
                      <InfoItem label="Assigned Worker" value={workerName(req.assigned_worker)} />
                    )}
                  </div>

                  {req.override_note && (
                    <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "14px" }}>"{req.override_note}"</p>
                  )}

                  {/* Actions */}
                  {req.status === "pending_review" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                      <button onClick={() => handleReject(req.request_id)}
                        style={{ padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B", cursor: "pointer" }}>
                        Reject
                      </button>
                      <button onClick={() => { setAssignModal({ request: req }); setPickedWorker(""); }}
                        style={{ padding: "8px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", border: "none", background: "#3B82F6", color: "#FFF", cursor: "pointer" }}>
                        Assign Worker
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assign Worker modal */}
      {assignModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)" }} />
          <div style={{ position: "relative", background: "#FFF", borderRadius: "16px", padding: "28px", width: "420px", maxWidth: "92vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", animation: "pageIn 0.2s ease both" }}>
            <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>Assign Worker</h3>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>
              {assignModal.request.role_name} · {fmtDate(assignModal.request.shift_date)} · {assignModal.request.outlets?.name}
            </p>

            <label style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", display: "block", marginBottom: "6px" }}>Select Krewby Worker</label>
            <select value={pickedWorker} onChange={e => setPickedWorker(e.target.value)}
              style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FAFAFA", marginBottom: "20px" }}>
              <option value="">— Choose a worker —</option>
              {workers.filter(w => w.is_active).map(w => (
                <option key={w.krewby_worker_id} value={w.krewby_worker_id}>
                  {w.user?.full_name || w.user?.email || `Worker #${w.krewby_worker_id}`}
                  {w.preferred_location ? ` · ${w.preferred_location}` : ""}
                  {w.rating ? ` · ⭐ ${Number(w.rating).toFixed(1)}` : ""}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setAssignModal(null)} disabled={assigning}
                style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleAssign} disabled={assigning || !pickedWorker}
                style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: assigning || !pickedWorker ? "#93C5FD" : "#3B82F6", color: "#FFF", fontSize: "14px", fontWeight: "600", cursor: assigning || !pickedWorker ? "default" : "pointer" }}>
                {assigning ? "Assigning…" : "Confirm Assignment"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 99999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </CoordinatorLayout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}
