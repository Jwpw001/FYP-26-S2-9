import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-leave-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-leave-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

export default function AvailabilityLeave() {
  const user = getUser();
  const userId = user?.user_id;

  const [requests, setRequests]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filter, setFilter]         = useState("pending");
  const [processing, setProcessing] = useState(null);
  const [toast, setToast]           = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;

        const { data: staffRows } = await supabase
          .from("staff").select("staff_id, user_id").eq("outlet_id", oid);

        const staffIds = (staffRows || []).map(s => s.staff_id);
        if (staffIds.length === 0) { if (!cancelled) setLoading(false); return; }

        const { data: reqs, error } = await supabase
          .from("availability")
          .select(`
            request_id, leave_type, start_date, end_date,
            reason, status, reviewed_at, staff_id,
            staff:staff_id (
              staff_id, user_id,
              users:user_id ( full_name, email )
            )
          `)
          .in("staff_id", staffIds)
          .order("start_date", { ascending: false });

        if (error) console.error("availability fetch error:", error);
        if (!cancelled) setRequests(reqs || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleAction(requestId, action) {
    setProcessing(requestId);
    try {
      await supabase.from("availability").update({
        status: action,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq("request_id", requestId);

      setRequests(prev => prev.map(r =>
        r.request_id === requestId ? { ...r, status: action } : r
      ));
      showToast(
        action === "approved" ? "Request approved." : "Request rejected.",
        action === "approved" ? "success" : "error"
      );
    } catch (err) {
      console.error(err);
      showToast("Action failed. Please try again.", "error");
    } finally {
      setProcessing(null);
    }
  }

  const filtered = requests.filter(r => filter === "all" ? true : r.status === filter);
  const pending  = requests.filter(r => r.status === "pending").length;

  function getStaffName(req) { return req.staff?.users?.full_name || req.staff?.users?.email || "Unknown"; }
  function getStaffEmail(req) { return req.staff?.users?.email || ""; }
  function getInitial(req) { return getStaffName(req)?.[0]?.toUpperCase() || "?"; }

  const FILTER_TABS = [
    { value: "pending",  label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all",      label: "All" },
  ];

  return (
    <ManagerLayout title="Availability & Leave">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Leave Requests</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {pending > 0 ? `${pending} pending approval` : "No pending requests"}
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "20px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
          {FILTER_TABS.map(tab => (
            <FilterTab
              key={tab.value}
              label={tab.label}
              active={filter === tab.value}
              badge={tab.value === "pending" && pending > 0 ? pending : null}
              onClick={() => setFilter(tab.value)}
            />
          ))}
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <Shimmer w="40px" h="40px" r="50%" />
                    <div>
                      <Shimmer w="120px" h="15px" r="6px" style={{ marginBottom: "7px" }} />
                      <Shimmer w="80px" h="12px" r="6px" />
                    </div>
                  </div>
                  <Shimmer w="72px" h="26px" r="100px" />
                </div>
                <div style={{ display: "flex", gap: "20px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
                  <Shimmer w="100px" h="36px" r="8px" />
                  <Shimmer w="140px" h="36px" r="8px" />
                  <Shimmer w="80px" h="36px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
            <div style={{ fontSize: "32px", marginBottom: "10px" }}>📋</div>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No {filter} requests</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map(req => (
              <LeaveCard
                key={req.request_id}
                req={req}
                processing={processing}
                getStaffName={getStaffName}
                getStaffEmail={getStaffEmail}
                getInitial={getInitial}
                onAction={handleAction}
              />
            ))}
          </div>
        )}

      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FilterTab({ label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px", background: active ? "#FFFFFF" : "transparent",
        border: "none", borderRadius: "7px", fontSize: "13px",
        fontWeight: active ? "600" : "500", color: active ? "#1E293B" : "#64748B",
        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}>
      {label}
      {badge !== null && badge !== undefined && (
        <span style={{ background: "#EF4444", color: "#FFFFFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function LeaveCard({ req, processing, getStaffName, getStaffEmail, getInitial, onAction }) {
  const [hoverApprove, setHoverApprove] = useState(false);
  const [hoverReject, setHoverReject]   = useState(false);
  const name = getStaffName(req);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", animation: "fadeSlideUp 0.3s ease both" }}>
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
            {getInitial(req)}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{getStaffEmail(req)}</p>
          </div>
        </div>
        <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle(req.status) }}>
          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
        </span>
      </div>

      {/* Info row */}
      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: "14px" }}>
        <InfoItem label="Type" value={`${req.leave_type.charAt(0).toUpperCase() + req.leave_type.slice(1)} Leave`} />
        <InfoItem label="Dates" value={`${fmtDate(req.start_date)} → ${fmtDate(req.end_date)}`} />
        <InfoItem label="Duration" value={`${getDays(req.start_date, req.end_date)} day(s)`} />
      </div>

      {req.reason && (
        <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "14px" }}>
          "{req.reason}"
        </p>
      )}

      {req.status === "pending" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onMouseEnter={() => setHoverReject(true)}
            onMouseLeave={() => setHoverReject(false)}
            onClick={() => onAction(req.request_id, "rejected")}
            disabled={processing === req.request_id}
            style={{
              background: hoverReject ? "#FEE2E2" : "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "600",
              color: "#991B1B", cursor: "pointer",
              opacity: processing === req.request_id ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
            {processing === req.request_id ? "…" : "Reject"}
          </button>
          <button
            onMouseEnter={() => setHoverApprove(true)}
            onMouseLeave={() => setHoverApprove(false)}
            onClick={() => onAction(req.request_id, "approved")}
            disabled={processing === req.request_id}
            style={{
              background: hoverApprove ? "#16A34A" : "#22C55E",
              border: "none", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "700",
              color: "#FFFFFF", cursor: "pointer",
              opacity: processing === req.request_id ? 0.6 : 1,
              transition: "background 0.15s",
            }}>
            {processing === req.request_id ? "…" : "Approve"}
          </button>
        </div>
      )}
    </div>
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

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

function getDays(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
}

function statusStyle(status) {
  const map = {
    pending:  { background: "#FFFBEB", color: "#D97706" },
    approved: { background: "#DCFCE7", color: "#166534" },
    rejected: { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || map.pending;
}
