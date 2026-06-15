import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

export default function AcceptInvite() {
  const { token } = useParams();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");
  const [form, setForm] = useState({ full_name: "", username: "", password: "", confirm_password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.invitation) setInvite(d.invitation);
        else setInviteError(d.message || "Invalid invitation");
      })
      .catch(() => setInviteError("Failed to load invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm_password) { setFormError("Passwords don't match"); return; }
    if (form.password.length < 6) { setFormError("Password must be at least 6 characters"); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.full_name, username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create account");
      setDone(true);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = (role) => role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || role;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={s.logo}>K</div>
          <span style={s.logoText}>Krewby</span>
        </div>

        {loading ? (
          <p style={s.muted}>Verifying invitation…</p>
        ) : inviteError ? (
          <div style={{ textAlign: "center" }}>
            <p style={s.errorBox}>{inviteError}</p>
            <Link to="/" style={s.link}>Back to home</Link>
          </div>
        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <div style={s.successIcon}>✓</div>
            <h2 style={s.title}>Account Created!</h2>
            <p style={s.subtitle}>You can now log in with your email and password.</p>
            <Link to="/login" style={s.btnPrimary}>Go to Login</Link>
          </div>
        ) : (
          <>
            <div style={s.inviteBadge}>
              <p style={s.inviteText}>You've been invited as <strong>{roleLabel(invite?.role)}</strong></p>
              {invite?.outlet_name && <p style={s.inviteSub}>Outlet: {invite.outlet_name}</p>}
            </div>

            <h2 style={s.title}>Create Your Account</h2>
            <p style={s.subtitle}>Your email: <strong>{invite?.email}</strong></p>

            <form onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
              <Field label="Full Name *" type="text" value={form.full_name}
                onChange={v => setForm(p => ({ ...p, full_name: v }))} placeholder="Your full name" />
              <Field label="Username *" type="text" value={form.username}
                onChange={v => setForm(p => ({ ...p, username: v }))} placeholder="Choose a username" />
              <Field label="Password *" type="password" value={form.password}
                onChange={v => setForm(p => ({ ...p, password: v }))} placeholder="Min. 6 characters" />
              <Field label="Confirm Password *" type="password" value={form.confirm_password}
                onChange={v => setForm(p => ({ ...p, confirm_password: v }))} placeholder="Repeat password" />

              {formError && <p style={s.errorBox}>{formError}</p>}

              <button type="submit" disabled={submitting} style={s.btnPrimary}>
                {submitting ? "Creating account…" : "Create Account"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
        style={{ width: "100%", padding: "10px 12px", border: "1px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  card: { background: "#FFF", borderRadius: "18px", padding: "40px", width: "100%", maxWidth: "440px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", justifyContent: "center" },
  logo: { width: "36px", height: "36px", background: "#F59E0B", borderRadius: "10px", color: "#1C1917", fontWeight: "800", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: "18px", fontWeight: "800", color: "#0F172A" },
  inviteBadge: { background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" },
  inviteText: { fontSize: "13px", color: "#166534" },
  inviteSub: { fontSize: "12px", color: "#4ADE80", marginTop: "2px" },
  title: { fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" },
  subtitle: { fontSize: "13px", color: "#64748B", marginBottom: "4px" },
  muted: { color: "#94A3B8", textAlign: "center" },
  errorBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "14px" },
  successIcon: { width: "56px", height: "56px", background: "#D1FAE5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#059669", margin: "0 auto 16px" },
  btnPrimary: { display: "block", width: "100%", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", textAlign: "center", textDecoration: "none", marginTop: "6px" },
  link: { color: "#3B82F6", fontSize: "14px", textDecoration: "none" },
};
