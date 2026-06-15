import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { Plus, Copy, Check, Clock, UserCheck, XCircle } from "lucide-react";

const STATUS_COLORS = {
  pending:   { bg: "#FEF3C7", text: "#D97706" },
  accepted:  { bg: "#D1FAE5", text: "#059669" },
  cancelled: { bg: "#F1F5F9", text: "#94A3B8" },
  expired:   { bg: "#FEE2E2", text: "#DC2626" },
};

export default function BOInvitations() {
  const [invites, setInvites] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", role: "outlet_manager", outlet_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(null);

  const token = localStorage.getItem("token");

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/invitations", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/business/outlets", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([inv, out]) => {
      setInvites(inv.invitations || []);
      setOutlets(out.outlets || []);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSend = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const body = { email: form.email, role: form.role };
      if (form.outlet_id) body.outlet_id = parseInt(form.outlet_id);
      const res = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send invite");
      setShowForm(false);
      setForm({ email: "", role: "outlet_manager", outlet_id: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => {
    await fetch(`/api/invitations/${id}/cancel`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    load();
  };

  const copyLink = (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <BusinessOwnerLayout title="Invitations">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <p style={{ color: "#64748B", fontSize: "14px" }}>{invites.length} invitation{invites.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(true)} style={s.btnPrimary}>
          <Plus size={15} /> Send Invite
        </button>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "20px" }}>Invite Outlet Manager</h3>
          <form onSubmit={handleSend}>
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>Email Address *</label>
              <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                placeholder="manager@example.com" required style={s.input} />
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>Role *</label>
              <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} style={s.input}>
                <option value="outlet_manager">Outlet Manager</option>
              </select>
            </div>
            <div style={{ marginBottom: "14px" }}>
              <label style={s.label}>Assign to Outlet (optional)</label>
              <select value={form.outlet_id} onChange={e => setForm(p => ({ ...p, outlet_id: e.target.value }))} style={s.input}>
                <option value="">— No specific outlet —</option>
                {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
              </select>
            </div>
            {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" disabled={submitting} style={s.btnPrimary}>{submitting ? "Sending…" : "Send Invitation"}</button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }} style={s.btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: "#64748B" }}>Loading…</p> : invites.length === 0 ? (
        <div style={s.empty}>
          <UserCheck size={40} color="#CBD5E1" />
          <p style={{ color: "#94A3B8", marginTop: "12px" }}>No invitations sent yet.</p>
        </div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>Email</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>Status</th>
                <th style={s.th}>Expires</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => {
                const col = STATUS_COLORS[inv.status] || STATUS_COLORS.pending;
                return (
                  <tr key={inv.id} style={s.tr}>
                    <td style={s.td}>{inv.email}</td>
                    <td style={s.td}><span style={s.roleTag}>{inv.role.replace(/_/g, " ")}</span></td>
                    <td style={s.td}><span style={{ ...s.statusBadge, background: col.bg, color: col.text }}>{inv.status}</span></td>
                    <td style={{ ...s.td, color: "#94A3B8", fontSize: "12px" }}>
                      <Clock size={11} style={{ marginRight: "4px" }} />
                      {new Date(inv.expires_at).toLocaleDateString()}
                    </td>
                    <td style={s.td}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        {inv.status === "pending" && (
                          <>
                            <button onClick={() => copyLink(inv.token)} style={s.iconBtn} title="Copy invite link">
                              {copied === inv.token ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                            </button>
                            <button onClick={() => handleCancel(inv.id)} style={{ ...s.iconBtn, color: "#EF4444" }} title="Cancel">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

const s = {
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  formCard: { background: "#FFF", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "24px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  input: { width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", boxSizing: "border-box" },
  empty: { textAlign: "center", padding: "60px 20px" },
  tableWrap: { background: "#FFF", borderRadius: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  thead: { background: "#F8FAFC" },
  th: { padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid #F1F5F9" },
  tr: { borderBottom: "1px solid #F8FAFC" },
  td: { padding: "14px 16px", fontSize: "13px", color: "#334155" },
  roleTag: { background: "#EFF6FF", color: "#3B82F6", fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", textTransform: "capitalize" },
  statusBadge: { fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", textTransform: "capitalize" },
  iconBtn: { background: "none", border: "1px solid #E2E8F0", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex", alignItems: "center", color: "#64748B" },
};
