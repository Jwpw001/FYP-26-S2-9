import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getUser, setSession } from "../utils/auth";
import { api } from "../lib/api";
import { X, CheckCircle2, Eye, EyeOff } from "lucide-react";

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

export default function AcceptInvite() {
  const { token } = useParams();
  const navigate = useNavigate();
  const loggedInUser = getUser();

  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [inviteError, setInviteError] = useState("");
  // "choose" → pick login or signup | "signup" → signup form | "linking" → accepting for existing user
  const [step, setStep] = useState("choose");
  const [form, setForm] = useState({ full_name: "", username: "", password: "", confirm_password: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.get(`/api/invitations/${token}`)
      .then(d => setInvite(d.invitation))
      .catch(err => setInviteError(err.message || "Invalid invitation"))
      .finally(() => setLoading(false));
  }, [token]);

  const emailMismatch = !!(loggedInUser && invite && loggedInUser.email?.toLowerCase() !== invite.email?.toLowerCase());

  // If already logged in with a matching email, skip straight to linking
  useEffect(() => {
    if (!loading && invite && loggedInUser && !emailMismatch) setStep("linking");
  }, [loading, invite, loggedInUser, emailMismatch]);

  async function acceptAsExisting() {
    setSubmitting(true); setFormError("");
    try {
      const data = await api.post(`/api/invitations/${token}/accept`, { existing_user_id: loggedInUser.user_id });
      // Update stored session with potentially new role/token
      setSession({ user: data.user, token: data.token });
      setDone(true);
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
      const data = await api.post(`/api/invitations/${token}/accept`, { full_name: form.full_name, username: form.username, password: form.password });
      setSession({ user: data.user, token: data.token });
      setDone(true);
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
        {/* Logo */}
        <div style={s.logoRow}>
          <div style={s.logo}>K</div>
          <span style={s.logoText}>Krewby</span>
        </div>

        {loading ? (
          <p style={s.muted}>Verifying invitation…</p>

        ) : inviteError ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", background: "#FEF2F2", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><X size={24} color="#DC2626" /></div>
            <p style={{ fontWeight: "700", color: "#0F172A", marginBottom: "8px" }}>Invitation Invalid</p>
            <p style={{ ...s.muted, marginBottom: "20px" }}>{inviteError}</p>
            <Link to="/login" style={s.btnPrimary}>Go to Login</Link>
          </div>

        ) : done ? (
          <div style={{ textAlign: "center" }}>
            <div style={s.successIcon}><CheckCircle2 size={24} color="#059669" /></div>
            <h2 style={s.title}>You're in!</h2>
            <p style={s.muted}>Redirecting to your dashboard…</p>
          </div>

        ) : (
          <>
            {/* Invite badge */}
            <div style={s.inviteBadge}>
              <p style={{ fontSize: "20px", color: "#166534", fontWeight: "600" }}>
                You've been invited as <strong>{roleLabel(invite?.role)}</strong>
              </p>
              {invite?.branch_name && (
                <p style={{ fontSize: "19px", color: "#4ADE80", marginTop: "3px" }}>Branch: {invite.branch_name}</p>
              )}
            </div>

            {/* Wrong account: logged in, but this invite is for a different email */}
            {loggedInUser && emailMismatch && (
              <div style={{ textAlign: "center" }}>
                <h2 style={s.title}>Wrong Account</h2>
                <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "20px" }}>
                  This invitation was sent to <strong>{invite?.email}</strong>, but you're logged in as <strong>{loggedInUser.full_name || loggedInUser.email}</strong>.
                </p>
                <button onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); setStep("choose"); }}
                  style={s.btnPrimary}>
                  Sign Out & Use a Different Account
                </button>
              </div>
            )}

            {/* Step: linking existing user */}
            {step === "linking" && loggedInUser && !emailMismatch && (
              <>
                <h2 style={s.title}>Accept Invitation</h2>
                <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "20px" }}>
                  You're logged in as <strong>{loggedInUser.full_name || loggedInUser.email}</strong>. Accept this invitation to join the branch.
                </p>
                {formError && <p style={s.errorBox}>{formError}</p>}
                <button onClick={acceptAsExisting} disabled={submitting} style={s.btnPrimary}>
                  {submitting ? "Joining…" : "Accept & Join"}
                </button>
                <p style={{ textAlign: "center", fontSize: "19px", color: "#94A3B8", marginTop: "14px" }}>
                  Not you?{" "}
                  <span onClick={() => { localStorage.removeItem("token"); localStorage.removeItem("user"); setStep("choose"); }}
                    style={{ color: "#F59E0B", cursor: "pointer", fontWeight: "600" }}>Sign out</span>
                </p>
              </>
            )}

            {/* Step: choose login or create */}
            {step === "choose" && !loggedInUser && (
              <>
                <h2 style={s.title}>Join Krewby</h2>
                <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "24px" }}>
                  Invitation for <strong>{invite?.email}</strong>
                </p>
                <button onClick={() => setStep("signup")} style={s.btnPrimary}>Create New Account</button>
                <div style={{ textAlign: "center", margin: "14px 0", fontSize: "19px", color: "#94A3B8" }}>— or —</div>
                <Link to={`/login?redirect=/invite/${token}`} style={{ ...s.btnPrimary, background: "#F1F5F9", color: "#0F172A", display: "block", textAlign: "center", textDecoration: "none" }}>
                  Log In with Existing Account
                </Link>
              </>
            )}

            {/* Step: signup form */}
            {step === "signup" && (
              <>
                <h2 style={s.title}>Create Your Account</h2>
                <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "4px" }}>
                  Email: <strong>{invite?.email}</strong>
                </p>
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
                  <button type="button" onClick={() => { setStep("choose"); setFormError(""); }}
                    style={{ ...s.btnPrimary, background: "#F1F5F9", color: "#0F172A", marginTop: "10px" }}>
                    Back
                  </button>
                </form>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "19px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input type={isPassword && show ? "text" : type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required
          style={{ width: "100%", padding: "10px 12px", paddingRight: isPassword ? "40px" : "12px", border: "1px solid #E2E8F0", borderRadius: "10px", fontSize: "21px", outline: "none", boxSizing: "border-box" }} />
        {isPassword && (
          <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"}
            style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", padding: "4px", display: "flex", cursor: "pointer", color: "#94A3B8" }}>
            {show ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: "100vh", background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  card: { background: "#FFF", borderRadius: "18px", padding: "40px", width: "100%", maxWidth: "440px", boxShadow: "0 4px 24px rgba(0,0,0,0.08)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px", justifyContent: "center" },
  logo: { width: "36px", height: "36px", background: "#F59E0B", borderRadius: "10px", color: "#1C1917", fontWeight: "800", fontSize: "23px", display: "flex", alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: "23px", fontWeight: "800", color: "#0F172A" },
  inviteBadge: { background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px" },
  title: { fontSize: "25px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" },
  muted: { color: "#94A3B8", textAlign: "center", fontSize: "20px" },
  errorBox: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px", padding: "10px 14px", color: "#DC2626", fontSize: "20px", marginBottom: "14px" },
  successIcon: { width: "56px", height: "56px", background: "#D1FAE5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", color: "#059669", margin: "0 auto 16px" },
  btnPrimary: { display: "block", width: "100%", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "10px", padding: "12px", fontSize: "21px", fontWeight: "700", cursor: "pointer", textAlign: "center", textDecoration: "none", marginTop: "6px", boxSizing: "border-box" },
};
