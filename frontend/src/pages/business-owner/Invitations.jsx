import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { api } from "../../lib/api";
import { Plus, Copy, Check, Clock, UserCheck, XCircle, RefreshCw, Mail, X, Send, Users, LinkIcon, Building2 } from "lucide-react";
import { UpgradePlanModal } from "../../components/UpgradePlanModal";
import SearchableSelect from "../../components/SearchableSelect";

if (typeof document !== "undefined" && !document.getElementById("bo-invite-styles")) {
  const style = document.createElement("style");
  style.id = "bo-invite-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
    .bo-invite-card { transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; }
    .bo-invite-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.08) !important; border-color: #CBD5E1 !important; }
    .bo-invite-action-btn { transition: all 0.15s; }
    .bo-invite-action-btn:hover { background: #F1F5F9 !important; transform: scale(1.08); }
    .bo-invite-stat:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06) !important; }
    .bo-invite-filter-btn { transition: all 0.15s; }
    .bo-invite-filter-btn:hover { background: #F8FAFC !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const STATUS_META = {
  pending:   { bg: "#FEF3C7", text: "#D97706", icon: Clock, label: "Pending" },
  accepted:  { bg: "#D1FAE5", text: "#059669", icon: Check, label: "Accepted" },
  cancelled: { bg: "#F1F5F9", text: "#94A3B8", icon: XCircle, label: "Cancelled" },
  expired:   { bg: "#FEE2E2", text: "#DC2626", icon: Clock, label: "Expired" },
};

const ROLE_META = {
  manager:      { label: "Branch Manager", bg: "#EDE9FE", text: "#7C3AED", icon: "shield" },
  regular_staff:       { label: "Regular Staff", bg: "#EFF6FF", text: "#3B82F6", icon: "user" },
  casual_staff: { label: "Casual Staff", bg: "#FFF7ED", text: "#EA580C", icon: "clock" },
};

const ROLES = [
  { value: "manager",      label: "Branch Manager" },
  { value: "regular_staff",       label: "Regular Staff" },
  { value: "casual_staff", label: "Casual Staff" },
];

export default function BOInvitations() {
  const [invites, setInvites] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ email: "", role: "manager", branch_id: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successCode, setSuccessCode] = useState(null);
  const [copied, setCopied] = useState(null);
  const [resending, setResending] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [upgradeModal, setUpgradeModal] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/api/invitations").catch(() => ({ invitations: [] })),
      api.get("/api/business/branches").catch(() => ({ branches: [] })),
    ]).then(([inv, out]) => {
      setInvites(inv.invitations || []);
      setBranches(out.branches || []);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.branch_id) { setError("Please select a branch."); return; }
    setSubmitting(true); setError("");
    try {
      const body = { email: form.email, role: form.role, branch_id: parseInt(form.branch_id) };
      const resp = await api.post("/api/invitations/send", body);
      setSuccessCode({ code: resp.code, email: form.email, link: resp.invite_link });
      setShowForm(false);
      setForm({ email: "", role: "manager", branch_id: "" });
      load();
    } catch (err) {
      if (err.limitReached) {
        setShowForm(false);
        setUpgradeModal({ limitType: err.limitType, plan: err.plan, message: err.message });
      } else {
        setError(err.message || "Failed to send invite");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id) => { setConfirmCancel(id); };

  const confirmCancelAction = async () => {
    await api.delete(`/api/invitations/${confirmCancel}/cancel`);
    setConfirmCancel(null);
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
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(`link-${token}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(`code-${code}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const visibleInvites = invites.filter(i => i.status !== "cancelled");
  const filtered = filterStatus === "all" ? visibleInvites : visibleInvites.filter(i => i.status === filterStatus);
  const counts = { all: visibleInvites.length, pending: 0, accepted: 0 };
  visibleInvites.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });

  return (
    <BusinessOwnerLayout title="Invitations">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>Invitations</h2>
            <p style={{ fontSize: "20px", color: "#64748B" }}>
              Invite branch managers and staff to join your business
            </p>
          </div>
          <button onClick={() => { setShowForm(v => !v); setError(""); setSuccessCode(null); }} style={sty.btnPrimary}>
            <Send size={14} /> Send Invite
          </button>
        </div>

        {/* Stats row */}
        {!loading && (
          <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Total Sent", value: visibleInvites.length, icon: Mail, color: "#3B82F6", bg: "#EFF6FF" },
              { label: "Pending", value: counts.pending, icon: Clock, color: "#D97706", bg: "#FEF3C7" },
              { label: "Accepted", value: counts.accepted, icon: UserCheck, color: "#059669", bg: "#D1FAE5" },
            ].map(stat => (
              <div key={stat.label} className="bo-invite-stat" style={{
                background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px",
                display: "flex", alignItems: "center", gap: "14px", transition: "all 0.2s", cursor: "default",
              }}>
                <div style={{ width: "42px", height: "42px", borderRadius: "11px", background: stat.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <stat.icon size={20} color={stat.color} />
                </div>
                <div>
                  <p style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{stat.value}</p>
                  <p style={{ fontSize: "19px", color: "#94A3B8", fontWeight: "500", marginTop: "2px" }}>{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Success banner after sending */}
        {successCode && (
          <div style={{ background: "linear-gradient(135deg, #F0FDF4, #ECFDF5)", border: "1px solid #BBF7D0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", animation: "fadeSlideUp 0.3s ease both" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#BBF7D0", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={18} color="#059669" />
                </div>
                <div>
                  <p style={{ fontWeight: "700", color: "#166534", marginBottom: "2px", fontSize: "21px" }}>Invitation sent to {successCode.email}</p>
                  <p style={{ fontSize: "19px", color: "#4ADE80" }}>Share the code below or copy the invite link</p>
                </div>
              </div>
              <button onClick={() => setSuccessCode(null)} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "4px" }}><X size={16} /></button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginTop: "16px", flexWrap: "wrap" }}>
              <div style={{ background: "#FFF", borderRadius: "12px", padding: "10px 20px", border: "2px dashed #BBF7D0" }}>
                <span style={{ fontSize: "28px", fontWeight: "800", color: "#0F172A", letterSpacing: "0.14em", fontFamily: "monospace" }}>
                  {successCode.code}
                </span>
              </div>
              <button onClick={() => copyCode(successCode.code)} style={{ ...sty.actionBtn, background: "#FFF", border: "1px solid #BBF7D0" }}>
                {copied === `code-${successCode.code}` ? <Check size={14} color="#10B981" /> : <Copy size={14} color="#059669" />}
                <span style={{ fontSize: "19px", color: "#059669", fontWeight: "600" }}>{copied === `code-${successCode.code}` ? "Copied!" : "Copy code"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Invite form — modal style */}
        {showForm && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#FFF", borderRadius: "20px", padding: "32px", width: "520px", maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", animation: "fadeSlideUp 0.25s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Send size={18} color="#D97706" />
                </div>
                <div>
                  <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Send New Invitation</h3>
                  <p style={{ fontSize: "19px", color: "#94A3B8" }}>Fill in the details to invite a team member</p>
                </div>
              </div>
              <form onSubmit={handleSend}>
                <div style={{ marginBottom: "16px" }}>
                  <label style={sty.label}><Mail size={12} style={{ marginRight: "4px" }} /> Email Address</label>
                  <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="name@company.com" required style={sty.input} />
                </div>
                <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginBottom: "16px" }}>
                  <div>
                    <label style={sty.label}><Users size={12} style={{ marginRight: "4px" }} /> Role</label>
                    <SearchableSelect
                      options={ROLES.map(r => ({ value: r.value, label: r.label }))}
                      value={form.role}
                      onChange={v => setForm(p => ({ ...p, role: v }))}
                      clearable={false}
                      searchable={false}
                    />
                  </div>
                  <div>
                    <label style={sty.label}><Building2 size={12} style={{ marginRight: "4px" }} /> Branch</label>
                    <SearchableSelect
                      options={branches.map(o => ({ value: o.branch_id, label: o.name }))}
                      value={form.branch_id}
                      onChange={v => setForm(p => ({ ...p, branch_id: v }))}
                      placeholder="Select branch"
                    />
                  </div>
                </div>

                {error && (
                  <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "10px 14px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <XCircle size={14} color="#EF4444" />
                    <p style={{ color: "#DC2626", fontSize: "20px", fontWeight: "500" }}>{error}</p>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px", paddingTop: "20px", borderTop: "1px solid #F1F5F9" }}>
                  <button type="button" onClick={() => { setShowForm(false); setError(""); }} style={sty.btnSecondary}>Cancel</button>
                  <button type="submit" disabled={submitting} style={sty.btnPrimary}>
                    <Send size={14} /> {submitting ? "Sending..." : "Send Invitation"}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}

        {/* Filter tabs */}
        {!loading && invites.length > 0 && (
          <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
            {["all", "pending", "accepted"].map(st => (
              <button key={st} onClick={() => setFilterStatus(st)} className="bo-invite-filter-btn"
                style={{
                  padding: "7px 16px", borderRadius: "10px", border: "1.5px solid", fontSize: "19px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s",
                  borderColor: filterStatus === st ? "#F59E0B" : "#E2E8F0",
                  background: filterStatus === st ? "#FEF3C7" : "#FFF",
                  color: filterStatus === st ? "#92400E" : "#64748B",
                }}>
                {st === "all" ? "All" : st.charAt(0).toUpperCase() + st.slice(1)}
                <span style={{
                  marginLeft: "6px", fontSize: "18px", fontWeight: "700", padding: "1px 7px", borderRadius: "100px",
                  background: filterStatus === st ? "#F59E0B" : "#F1F5F9",
                  color: filterStatus === st ? "#FFF" : "#94A3B8",
                }}>
                  {counts[st] ?? 0}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Invitation cards */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 24px", display: "flex", gap: "16px", alignItems: "center" }}>
                <Shimmer w="44px" h="44px" r="11px" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="40%" h="14px" r="6px" />
                  <div style={{ marginTop: "8px" }}><Shimmer w="60%" h="12px" r="5px" /></div>
                </div>
                <Shimmer w="70px" h="24px" r="100px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px",
            backgroundImage: "radial-gradient(circle at 50% 0%, rgba(245,158,11,0.04) 0%, transparent 60%)",
          }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Send size={28} color="#D97706" />
            </div>
            <p style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {invites.length === 0 ? "No invitations yet" : "No invitations match this filter"}
            </p>
            <p style={{ fontSize: "20px", color: "#94A3B8", marginBottom: "20px" }}>
              {invites.length === 0 ? "Send your first invite to start building your team" : "Try a different filter to see more"}
            </p>
            {invites.length === 0 && (
              <button onClick={() => { setShowForm(true); setError(""); }} style={sty.btnPrimary}>
                <Send size={14} /> Send Your First Invite
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {filtered.map((inv, i) => {
              const isExpired = inv.expires_at && new Date(inv.expires_at) < new Date() && inv.status === "pending";
              const status = isExpired ? "expired" : inv.status;
              const sm = STATUS_META[status] || STATUS_META.pending;
              const rm = ROLE_META[inv.role] || ROLE_META.regular_staff;
              const StatusIcon = sm.icon;

              return (
                <div key={inv.id} className="bo-invite-card" style={{
                  background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px",
                  padding: "18px 22px", display: "flex", alignItems: "center", gap: "16px",
                  animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`, cursor: "default",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
                }}>
                  {/* Avatar circle */}
                  <div style={{
                    width: "44px", height: "44px", borderRadius: "12px", flexShrink: 0,
                    background: `linear-gradient(135deg, ${rm.bg}, ${rm.bg}dd)`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "21px", fontWeight: "800", color: rm.text,
                  }}>
                    {inv.email?.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: "700", color: "#0F172A", fontSize: "21px", marginBottom: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ background: rm.bg, color: rm.text, fontSize: "18px", fontWeight: "600", padding: "2px 10px", borderRadius: "100px" }}>
                        {rm.label}
                      </span>
                      {inv.branches?.name && (
                        <span style={{ fontSize: "18px", color: "#94A3B8", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Building2 size={10} /> {inv.branches.name}
                        </span>
                      )}
                      {inv.expires_at && (
                        <span style={{ fontSize: "18px", color: "#CBD5E1", display: "flex", alignItems: "center", gap: "3px" }}>
                          <Clock size={10} /> {new Date(inv.expires_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Invite code */}
                  {inv.invitation_code && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#F8FAFC", borderRadius: "8px", border: "1px solid #E2E8F0" }}>
                      <span style={{ fontFamily: "monospace", fontWeight: "700", fontSize: "20px", color: "#334155", letterSpacing: "0.08em" }}>
                        {inv.invitation_code}
                      </span>
                      <button onClick={() => copyCode(inv.invitation_code)} className="bo-invite-action-btn"
                        style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", borderRadius: "4px" }} title="Copy code">
                        {copied === `code-${inv.invitation_code}` ? <Check size={12} color="#10B981" /> : <Copy size={12} color="#94A3B8" />}
                      </button>
                    </div>
                  )}

                  {/* Status badge */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    background: sm.bg, color: sm.text, fontSize: "18px", fontWeight: "700",
                    padding: "5px 12px", borderRadius: "100px", flexShrink: 0,
                  }}>
                    <StatusIcon size={12} />
                    {sm.label}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                    {inv.status === "pending" && !isExpired && (
                      <>
                        <button onClick={() => copyLink(inv.token)} className="bo-invite-action-btn"
                          style={sty.iconBtn} title="Copy invite link">
                          {copied === `link-${inv.token}` ? <Check size={14} color="#10B981" /> : <LinkIcon size={14} />}
                        </button>
                        <button onClick={() => handleResend(inv.id)} disabled={resending === inv.id} className="bo-invite-action-btn"
                          style={sty.iconBtn} title="Resend email">
                          {copied === `resent-${inv.id}` ? <Check size={14} color="#10B981" /> : <RefreshCw size={14} style={resending === inv.id ? { animation: "spin 1s linear infinite" } : {}} />}
                        </button>
                        <button onClick={() => handleCancel(inv.id)} className="bo-invite-action-btn"
                          style={{ ...sty.iconBtn, color: "#EF4444" }} title="Cancel invitation">
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                    {inv.status === "accepted" && (
                      <span style={{ fontSize: "18px", color: "#059669", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px", padding: "0 4px" }}>
                        <Check size={13} strokeWidth={3} /> Joined
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {confirmCancel && createPortal(
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
            <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px 32px", width: "380px", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", animation: "fadeSlideUp 0.2s ease both" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                <XCircle size={24} color="#EF4444" />
              </div>
              <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "8px" }}>Cancel Invitation?</h3>
              <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "24px", lineHeight: "1.5" }}>This invitation will be cancelled and the link and code will no longer work.</p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button onClick={() => setConfirmCancel(null)} style={sty.btnSecondary}>Keep It</button>
                <button onClick={confirmCancelAction} style={{ ...sty.btnPrimary, background: "#EF4444", color: "#FFF" }}>Yes, Cancel</button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </div>

      {upgradeModal && (
        <UpgradePlanModal
          currentPlan={upgradeModal.plan}
          onClose={() => setUpgradeModal(null)}
          onUpgraded={() => setUpgradeModal(null)}
        />
      )}
    </BusinessOwnerLayout>
  );
}

const sty = {
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "7px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "20px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "20px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" },
  label: { display: "flex", alignItems: "center", fontSize: "19px", fontWeight: "600", color: "#374151", marginBottom: "7px" },
  input: { width: "100%", padding: "10px 14px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "21px", outline: "none", boxSizing: "border-box", color: "#1E293B", background: "#FAFAFA", transition: "border-color 0.15s" },
  iconBtn: { background: "none", border: "1px solid #E2E8F0", borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#64748B", transition: "all 0.15s" },
  actionBtn: { display: "inline-flex", alignItems: "center", gap: "6px", border: "none", borderRadius: "8px", padding: "7px 14px", cursor: "pointer", transition: "all 0.15s" },
};
