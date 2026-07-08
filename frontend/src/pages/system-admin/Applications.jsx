import { useState, useEffect } from "react";
import { Inbox, X, Check, RefreshCw } from "lucide-react";
import { api } from "../../lib/api";
import AdminLayout from "../../components/layout/AdminLayout";

if (typeof document !== "undefined" && !document.getElementById("coord-apps-styles")) {
  const style = document.createElement("style");
  style.id = "coord-apps-styles";
  style.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .app-row:hover { background:#F8FAFC !important; }
    .app-row { transition: background 0.15s ease !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtDate(d) {
  if (!d) return "â€”";
  return new Date(d).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

export default function CoordinatorApplications() {
  const [apps, setApps]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [actioning, setActioning] = useState(false);
  const [toast, setToast]       = useState(null);
  const [filter, setFilter]     = useState("pending");

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadApps() {
    setLoading(true);
    try {
      const res = await api.get("/api/auth/coordinator/applications");
      setApps(res.data?.applications || []);
    } catch {
      showToast("Failed to load applications.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadApps(); }, []);

  async function handleApprove(id) {
    setActioning(true);
    try {
      const res = await api.post(`/api/auth/coordinator/applications/${id}/approve`);
      showToast(res.data?.message || "Application approved.");
      setSelected(null);
      loadApps();
    } catch (err) {
      showToast(err.response?.data?.message || "Approval failed.", "error");
    } finally {
      setActioning(false);
    }
  }

  async function handleReject(id) {
    if (!window.confirm("Reject and permanently delete this application?")) return;
    setActioning(true);
    try {
      await api.post(`/api/auth/coordinator/applications/${id}/reject`);
      showToast("Application rejected and removed.");
      setSelected(null);
      loadApps();
    } catch (err) {
      showToast(err.response?.data?.message || "Rejection failed.", "error");
    } finally {
      setActioning(false);
    }
  }

  const filtered = apps.filter(a => filter === "all" || a.status === filter);
  const pendingCount = apps.filter(a => a.status === "pending").length;

  return (
    <AdminLayout>
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "32px 24px", animation: "pageIn 0.4s ease both" }}>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: "24px", right: "24px", zIndex: 9999,
            background: toast.type === "error" ? "#FEF2F2" : "#F0FDF4",
            border: `1px solid ${toast.type === "error" ? "#FECACA" : "#A7F3D0"}`,
            color: toast.type === "error" ? "#DC2626" : "#065F46",
            padding: "14px 20px", borderRadius: "12px", fontSize: "14px", fontWeight: "600",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)", maxWidth: "360px",
          }}>
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "28px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "6px" }}>
              Worker Applications
              {pendingCount > 0 && (
                <span style={{ marginLeft: "10px", fontSize: "13px", fontWeight: "700", background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A", borderRadius: "100px", padding: "3px 10px", verticalAlign: "middle" }}>
                  {pendingCount} pending
                </span>
              )}
            </h1>
            <p style={{ fontSize: "14px", color: "#64748B" }}>Review and manage incoming Krewby worker applications.</p>
          </div>
          <button onClick={loadApps} style={{ background: "#F1F5F9", border: "1px solid #E2E8F0", color: "#374151", padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            <RefreshCw size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} /> Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", borderRadius: "10px", padding: "4px", marginBottom: "24px", width: "fit-content" }}>
          {["pending", "all"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "7px 18px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                background: filter === f ? "#fff" : "transparent",
                color: filter === f ? "#0F172A" : "#64748B",
                boxShadow: filter === f ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}>
              {f === "pending" ? "Pending" : "All"}
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr auto auto", gap: "0", borderBottom: "1px solid #E2E8F0", padding: "12px 20px", background: "#F8FAFC" }}>
            {["Full Name", "Username", "Email", "Applied", "Status"].map(h => (
              <span key={h} style={{ fontSize: "11px", fontWeight: "700", color: "#64748B", letterSpacing: "0.04em", textTransform: "uppercase" }}>{h}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1,2,3].map(i => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr auto auto", gap: "16px" }}>
                  <Shimmer h="14px"/><Shimmer h="14px" w="70%"/><Shimmer h="14px"/><Shimmer h="14px" w="60px"/><Shimmer h="20px" w="60px" r="100px"/>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: "48px", textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}><Inbox size={32} color="#64748B" /></div>
              <p style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", marginBottom: "6px" }}>No applications</p>
              <p style={{ fontSize: "13px", color: "#64748B" }}>No {filter === "pending" ? "pending" : ""} applications at the moment.</p>
            </div>
          ) : (
            filtered.map((app, i) => (
              <div key={app.id} className="app-row"
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr auto auto", gap: "0", alignItems: "center", padding: "16px 20px", borderBottom: i < filtered.length-1 ? "1px solid #F1F5F9" : "none", cursor: "pointer" }}
                onClick={() => setSelected(app)}
              >
                <span style={{ fontSize: "14px", fontWeight: "600", color: "#0F172A" }}>{app.full_name}</span>
                <span style={{ fontSize: "13px", color: "#64748B" }}>@{app.username}</span>
                <span style={{ fontSize: "13px", color: "#64748B" }}>{app.email}</span>
                <span style={{ fontSize: "12px", color: "#94A3B8", whiteSpace: "nowrap", paddingRight: "20px" }}>{fmtDate(app.applied_at)}</span>
                <span style={{
                  fontSize: "11px", fontWeight: "700", padding: "4px 10px", borderRadius: "100px", whiteSpace: "nowrap",
                  background: app.status === "pending" ? "#FEF3C7" : "#F0FDF4",
                  color: app.status === "pending" ? "#92400E" : "#065F46",
                  border: `1px solid ${app.status === "pending" ? "#FDE68A" : "#A7F3D0"}`,
                }}>
                  {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Detail panel overlay */}
        {selected && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
            onClick={e => { if (e.target === e.currentTarget) setSelected(null); }}>
            <div style={{ background: "#fff", borderRadius: "20px", padding: "36px", width: "100%", maxWidth: "480px", boxShadow: "0 20px 60px rgba(15,23,42,0.2)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A" }}>Application Details</h2>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: "#94A3B8", fontSize: "20px", cursor: "pointer", lineHeight: 1, display: "flex", alignItems: "center" }}><X size={20} /></button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "28px" }}>
                {[
                  ["Full Name",  selected.full_name],
                  ["Username",   "@" + selected.username],
                  ["Email",      selected.email],
                  ["Applied on", fmtDate(selected.applied_at)],
                  ["Status",     selected.status],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "#F8FAFC", borderRadius: "10px", border: "1px solid #E2E8F0" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>{label}</span>
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>{val}</span>
                  </div>
                ))}
              </div>

              <div style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px", padding: "14px 16px", fontSize: "13px", color: "#92400E", marginBottom: "24px", lineHeight: 1.65 }}>
                <strong>Note:</strong> If approved, the applicant will receive an account. They'll need to use <strong>Forgot Password</strong> to set their own login password.
              </div>

              {selected.status === "pending" && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    onClick={() => handleApprove(selected.id)}
                    disabled={actioning}
                    style={{ flex: 1, padding: "13px", background: "#059669", color: "#fff", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.7 : 1 }}
                  >
                    {actioning ? "Processing…" : <><Check size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} /> Approve</>}
                  </button>
                  <button
                    onClick={() => handleReject(selected.id)}
                    disabled={actioning}
                    style={{ flex: 1, padding: "13px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: actioning ? "not-allowed" : "pointer", opacity: actioning ? 0.7 : 1 }}
                  >
                    <X size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} /> Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


