import { useEffect, useState } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import { supabase } from "../../lib/supabaseClient";
import { Plus, Copy, Check, Clock, UserCheck, XCircle, RefreshCw, Mail, X, CheckCircle2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("om-invite-styles")) {
  const style = document.createElement("style");
  style.id = "om-invite-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .om-invite-row { transition: background 0.15s; }
    .om-invite-row:hover { background: #F8FAFC; }
    .om-invite-icon-btn:hover { background: #F1F5F9 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const STATUS_COLORS = {
  pending:   { bg: "#FEF3C7", text: "#D97706" },
  accepted:  { bg: "#D1FAE5", text: "#059669" },
  cancelled: { bg: "#F1F5F9", text: "#94A3B8" },
};

const STAFF_ROLES = [
  { value: "regular_staff",       label: "Regular Staff" },
  { value: "outlet_casual_staff", label: "Casual Staff" },
];

export default function OMInvitations() {
  const user = getUser();
  const [invites, setInvites] = useState([]);
  const [outletId, setOutletId] = useState(null);
  const [outletName, setOutletName] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", role: "regular_staff" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState(null);
  const [copied, setCopied] = useState(null);
  const [resending, setResending] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      // Get the manager's outlet
      if (!outletId) {
        const { data: staffRow } = await supabase
          .from("staff")
          .select("outlet_id, outlets(name)")
          .eq("user_id", user.user_id)
          .eq("is_active", true)
          .maybeSingle();
        if (staffRow) {
          setOutletId(staffRow.outlet_id);
          setOutletName(staffRow.outlets?.name || "");
        }
      }
      const inv = await api.get("/api/invitations");
      setInvites(inv.invitations || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // re-fetch invites once outletId is set
  useEffect(() => {
    if (outletId && invites.length === 0 && !loading) load();
  }, [outletId]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!outletId) { setError("Could not determine your outlet."); return; }
    setSubmitting(true); setError("");
    try {
      const resp = await api.post("/api/invitations/send", {
        email: form.email, role: form.role, outlet_id: outletId,
      });
      setSuccessCode({ code: resp.code, email: form.email });
      setShowForm(false);
      setForm({ email: "", role: "regular_staff" });
      load();
    } catch (err) {
      setError(err.message || "Failed to send invite");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm("Cancel this invitation?")) return;
    await api.delete(`/api/invitations/${id}/cancel`);
    load();
  };

  const handleResend = async (id) => {
    setResending(id);
    try {
      await api.post(`/api/invitations/${id}/resend`, {});
      setCopied(`resent-${id}`);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setResending(null);
    }
  };

  const copyLink = (token) => {
    navigator.clipboard.writeText(`${window.location.origin}/invite/${token}`);
    setCopied(`link-${token}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(`code-${code}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = filterStatus === "all" ? invites : invites.filter(i => i.status === filterStatus);
  const counts = { all: invites.length, pending: 0, accepted: 0, cancelled: 0 };
  invites.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });

  return (
    <ManagerLayout title="Invitations">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Invitations</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {outletName ? `Inviting staff to ${outletName}` : "Invite staff to your outlet"}
            </p>
          </div>
          <button onClick={() => { setShowForm(v => !v); setError(""); setSuccessCode(null); }} style={s.btnPrimary}>
            <Plus size={15} /> Invite Staff
          </button>
        </div>

        {/* Success banner */}
        {successCode && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "14px", padding: "20px 24px", marginBottom: "20px", animation: "fadeSlideUp 0.3s ease both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontWeight: "700", color: "#166534", marginBottom: "4px" }}>Invitation sent to {successCode.email}!</p>
                <p style={{ fontSize: "13px", color: "#4ADE80" }}>Share this code with them:</p>
              </div>
              <button onClick={() => setSuccessCode(null)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "14px" }}>
              <span style={{ fontSize: "28px", fontWeight: "800", color: "#0F172A", letterSpacing: "0.12em", fontFamily: "monospace" }}>
                {successCode.code}
              </span>
              <button onClick={() => copyCode(successCode.code)} style={s.iconBtn}>
                {copied === `code-${successCode.code}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                <span style={{ fontSize: "12px", marginLeft: "4px" }}>{copied === `code-${successCode.code}` ? "Copied!" : "Copy code"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Invite form */}
        {showForm && (
          <div style={{ ...s.formCard, animation: "fadeSlideUp 0.3s ease both" }}>
            <h3 style={s.formTitle}>Invite Staff Member</h3>
            {outletName && <p style={{ fontSize: "12px", color: "#64748B", marginBottom: "14px" }}>Inviting to: <strong>{outletName}</strong></p>}
            <form onSubmit={handleSend}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "18px" }}>
                <div>
                  <label style={s.label}>Email Address *</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="staff@example.com" required style={s.input} />
                </div>
                <div>
                  <label style={s.label}>Staff Type *</label>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={s.input}>
                    {STAFF_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
              {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" disabled={submitting} style={s.btnPrimary}>
                  <Mail size={14} /> {submitting ? "Sending…" : "Send Invitation"}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(""); }} style={s.btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Filter tabs */}
        {!loading && invites.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
            {["all", "pending", "accepted", "cancelled"].map(st => (
              <button key={st} onClick={() => setFilterStatus(st)}
                style={{ padding: "6px 14px", borderRadius: "100px", border: "1.5px solid", fontSize: "12px", fontWeight: "600", cursor: "pointer",
                  borderColor: filterStatus === st ? "#0F172A" : "#E2E8F0",
                  background: filterStatus === st ? "#0F172A" : "#FFF",
                  color: filterStatus === st ? "#FFF" : "#64748B",
                }}>
                {st === "all" ? "All" : st.charAt(0).toUpperCase() + st.slice(1)} ({counts[st] ?? 0})
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={s.tableWrap}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: "12px", padding: "16px", borderBottom: "1px solid #F8FAFC" }}>
                <Shimmer h="14px" /> <Shimmer h="20px" r="100px" /> <Shimmer h="20px" r="100px" /> <Shimmer h="14px" /> <Shimmer h="14px" w="80px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.empty}>
            <UserCheck size={40} color="#CBD5E1" />
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>
              {invites.length === 0 ? "No invitations sent yet" : "No invitations match this filter"}
            </p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Invite staff members to join your outlet.</p>
          </div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Staff Type</th>
                  <th style={s.th}>Code</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}>Expires</th>
                  <th style={s.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv, i) => {
                  const col = STATUS_COLORS[inv.status] || STATUS_COLORS.pending;
                  const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date() && inv.status === "pending";
                  return (
                    <tr key={inv.id} className="om-invite-row" style={{ ...s.tr, animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both` }}>
                      <td style={s.td}><p style={{ fontWeight: "600", color: "#0F172A" }}>{inv.email}</p></td>
                      <td style={s.td}><span style={s.roleTag}>{inv.role?.replace(/_/g, " ")}</span></td>
                      <td style={s.td}>
                        {inv.invitation_code ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "13px", color: "#0F172A", letterSpacing: "0.08em" }}>
                              {inv.invitation_code}
                            </span>
                            <button onClick={() => copyCode(inv.invitation_code)} className="om-invite-icon-btn" style={{ ...s.iconBtn, padding: "3px 5px" }}>
                              {copied === `code-${inv.invitation_code}` ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          </div>
                        ) : "—"}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.statusBadge, background: isExpired ? "#FEE2E2" : col.bg, color: isExpired ? "#DC2626" : col.text }}>
                          {isExpired ? "expired" : inv.status}
                        </span>
                      </td>
                      <td style={{ ...s.td, color: "#94A3B8", fontSize: "12px" }}>
                        {inv.expires_at ? <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><Clock size={11} />{new Date(inv.expires_at).toLocaleDateString()}</span> : "—"}
                      </td>
                      <td style={s.td}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {inv.status === "pending" && !isExpired && (
                            <>
                              <button onClick={() => copyLink(inv.token)} className="om-invite-icon-btn" style={s.iconBtn} title="Copy invite link">
                                {copied === `link-${inv.token}` ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                              </button>
                              <button onClick={() => handleResend(inv.id)} disabled={resending === inv.id} className="om-invite-icon-btn" style={s.iconBtn} title="Resend email">
                                {copied === `resent-${inv.id}` ? <Check size={14} color="#10B981" /> : <RefreshCw size={14} />}
                              </button>
                              <button onClick={() => handleCancel(inv.id)} className="om-invite-icon-btn" style={{ ...s.iconBtn, color: "#EF4444" }} title="Cancel">
                                <XCircle size={14} />
                              </button>
                            </>
                          )}
                          {inv.status === "accepted" && <span style={{ fontSize: "11px", color: "#059669", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={14} /> Joined</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

const s = {
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  formCard: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", marginBottom: "24px" },
  formTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "8px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  empty: { textAlign: "center", padding: "60px 20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" },
  tableWrap: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#F8FAFC" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #F1F5F9" },
  tr: { borderBottom: "1px solid #F8FAFC" },
  td: { padding: "14px 16px", fontSize: "13px", color: "#334155" },
  roleTag: { background: "#EFF6FF", color: "#3B82F6", fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", textTransform: "capitalize", whiteSpace: "nowrap" },
  statusBadge: { fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", textTransform: "capitalize" },
  iconBtn: { background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "5px 7px", cursor: "pointer", display: "inline-flex", alignItems: "center", color: "#64748B" },
};
