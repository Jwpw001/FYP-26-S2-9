import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getUser, setUser } from "../utils/auth";
import { CheckCircle2 } from "lucide-react";

const DASHBOARD = {
  manager:      "/manager/dashboard",
  regular_staff:       "/regular-staff/dashboard",
  casual_staff: "/casual-staff/dashboard",
  business_owner:      "/business-owner/dashboard",
  system_admin:        "/system-admin/dashboard",
};

function roleLabel(role) {
  return role?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || role;
}

export default function JoinByCode() {
  const navigate = useNavigate();
  const loggedInUser = getUser();

  const [code, setCode] = useState("");
  const [invite, setInvite] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [looking, setLooking] = useState(false);
  const [step, setStep] = useState("enter"); // "enter" | "confirm" | "signup" | "done"
  const [form, setForm] = useState({ full_name: "", username: "", password: "", confirm_password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  function formatCode(val) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + "-" + clean.slice(4, 8);
  }

  async function handleLookup(e) {
    e.preventDefault();
    setLooking(true); setLookupError("");
    try {
      const res = await fetch(`/api/invitations/check-code/${code.replace("-", "")}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Code not found");
      setInvite(data.invitation);
      setStep("confirm");
    } catch (err) {
      setLookupError(err.message);
    } finally {
      setLooking(false);
    }
  }

  async function acceptAsExisting() {
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`/api/invitations/${invite.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existing_user_id: loggedInUser.user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to accept");
      setUser(data.user);
      localStorage.setItem("token", data.token);
      setStep("done");
      setTimeout(() => navigate(DASHBOARD[data.user.role] || "/"), 1800);
    } catch (err) {
      setFormError(err.message);
      setSubmitting(false);
    }
  }

  async function handleSignup(e) {
    e.preventDefault();
    if (form.password !== form.confirm_password) { setFormError("Passwords don't match"); return; }
    if (form.password.length < 6) { setFormError("Password must be at least 6 characters"); return; }
    setSubmitting(true); setFormError("");
    try {
      const res = await fetch(`/api/invitations/${invite.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: form.full_name, username: form.username, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create account");
      setUser(data.user);
      localStorage.setItem("token", data.token);
      setStep("done");
      setTimeout(() => navigate(DASHBOARD[data.user.role] || "/"), 1800);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <div style={s.logo}>K</div>
          <span style={s.logoText}>Krewby</span>
        </div>

        {step === "done" ? (
          <div style={{ textAlign: "center" }}>
            <div style={s.successIcon}><CheckCircle2 size={24} color="#059669" /></div>
            <h2 style={s.title}>You're in!</h2>
            <p style={s.muted}>Redirecting to your dashboard…</p>
          </div>

        ) : step === "enter" ? (
          <>
            <h2 style={s.title}>Join with Invitation Code</h2>
            <p style={s.muted}>Enter the code from your invitation email.</p>
            <form onSubmit={handleLookup} style={{ marginTop: "24px" }}>
              <input
                value={code}
                onChange={e => setCode(formatCode(e.target.value))}
                placeholder="XXXX-XXXX"
                maxLength={9}
                required
                style={{ width: "100%", padding: "14px 16px", border: "2px solid #E2E8F0", borderRadius: "12px", fontSize: "22px", fontWeight: "800", textAlign: "center", letterSpacing: "0.15em", outline: "none", boxSizing: "border-box", marginBottom: "14px", color: "#0F172A" }}
              />
              {lookupError && <p style={s.errorBox}>{lookupError}</p>}
              <button type="submit" disabled={looking || code.length < 9} style={{ ...s.btnPrimary, opacity: code.length < 9 ? 0.5 : 1 }}>
                {looking ? "Checking…" : "Continue"}
              </button>
            </form>
            <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#94A3B8" }}>
              Have an invite link? <Link to="/login" style={{ color: "#F59E0B", fontWeight: "600", textDecoration: "none" }}>Log in</Link>
            </p>
          </>

        ) : step === "confirm" ? (
          <>
            <div style={s.inviteBadge}>
              <p style={{ fontSize: "13px", color: "#166534", fontWeight: "600" }}>
                Invitation: <strong>{roleLabel(invite?.role)}</strong>
              </p>
              {invite?.branch_name && <p style={{ fontSize: "12px", color: "#4ADE80", marginTop: "3px" }}>Branch: {invite.branch_name}</p>}
              <p style={{ fontSize: "12px", color: "#16A34A", marginTop: "3px" }}>For: {invite?.email}</p>
            </div>

            {formError && <p style={s.errorBox}>{formError}</p>}

            {loggedInUser ? (
              <>
                <h2 style={s.title}>Accept Invitation</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>
                  Logged in as <strong>{loggedInUser.full_name || loggedInUser.email}</strong>
                </p>
                <button onClick={acceptAsExisting} disabled={submitting} style={s.btnPrimary}>
                  {submitting ? "Joining…" : "Accept & Join"}
                </button>
              </>
            ) : (
              <>
                <h2 style={s.title}>Join this branch</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>How would you like to continue?</p>
                <button onClick={() => setStep("signup")} style={s.btnPrimary}>Create New Account</button>
                <div style={{ textAlign: "center", margin: "12px 0", fontSize: "12px", color: "#94A3B8" }}>— or —</div>
                <Link to={`/login?redirect=/invite/${invite?.token}`}
                  style={{ ...s.btnPrimary, background: "#F1F5F9", color: "#0F172A", display: "block", textAlign: "center", textDecoration: "none" }}>
                  Log In with Existing Account
                </Link>
              </>
            )}
            <button onClick={() => { setStep("enter"); setInvite(null); setFormError(""); }}
              style={{ display: "block", width: "100%", marginTop: "12px", background: "none", border: "none", color: "#94A3B8", fontSize: "13px", cursor: "pointer" }}>
              ← Enter a different code
            </button>
          </>

        ) : step === "signup" ? (
          <>
            <h2 style={s.title}>Create Your Account</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "4px" }}>Email: <strong>{invite?.email}</strong></p>
            <form onSubmit={handleSignup} style={{ marginTop: "16px" }}>
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
                {submitting ? "Creating account…" : "Create Account & Join"}
              </button>
              <button type="button" onClick={() => { setStep("confirm"); setFormError(""); }}
                style={{ ...s.btnPrimary, background: "#F1F5F9", color: "#0F172A", marginTop: "10px" }}>
                Back
              </button>
            </form>
          </>
        ) : null}
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
  title: { fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" },
  muted: { color: "#94A3B8", textAlign: "center", fontSize: "13px" },
  errorBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "13px", marginBottom: "14px" },
  successIcon: { width: "56px", height: "56px", background: "#D1FAE5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#059669", margin: "0 auto 16px" },
  btnPrimary: { display: "block", width: "100%", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer", textAlign: "center", textDecoration: "none", marginTop: "6px", boxSizing: "border-box" },
};
