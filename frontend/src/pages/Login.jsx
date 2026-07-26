import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser, getUser } from "../utils/auth";
import { supabase } from "../lib/supabaseClient";

const ROLE_ROUTES = {
  system_admin:         "/system-admin/dashboard",
  business_owner:       "/business-owner/dashboard",
  manager:       "/manager/dashboard",
  regular_staff:        "/regular-staff/dashboard",
  casual_staff:  "/casual-staff/dashboard",
};

const EyeIcon = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const TicketIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>
  </svg>
);

const CheckIcon2 = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

const WarnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

function Field({ id, label, type = "text", name, value, onChange, placeholder, autoComplete, disabled, right }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginTop: "18px" }}>
      <label htmlFor={id} style={s.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id} name={name} type={type} value={value} onChange={onChange}
          placeholder={placeholder} autoComplete={autoComplete}
          disabled={disabled} required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...s.input,
            borderColor: focused ? "#3B82F6" : "#E2E8F0",
            boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
            paddingRight: right ? "44px" : "13px",
          }}
        />
        {right && <div style={s.inputRight}>{right}</div>}
      </div>
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const goTo = useGoTo();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const [form, setForm]                 = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [visible, setVisible]           = useState(false);
  const [pendingUser, setPendingUser]   = useState(null);
  const [inviteCode, setInviteCode]     = useState("");
  const [codeError, setCodeError]       = useState("");
  const [codeLoading, setCodeLoading]   = useState(false);
  const [codeSuccess, setCodeSuccess]   = useState(false);

  useEffect(() => {
    const id = "krewby-login-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = `
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        ::placeholder { color: #CBD5E1 !important; }
      `;
      document.head.appendChild(tag);
    }
    requestAnimationFrame(() => setVisible(true));
    const user = getUser();
    if (user && ROLE_ROUTES[user.role]) navigate(ROLE_ROUTES[user.role], { replace: true });
  }, [navigate]);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (authError) { setError("Invalid email or password."); return; }
      const response = await api.post("/api/auth/login", {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      const profile = { ...response.user, token: response.token };
      const route = ROLE_ROUTES[profile.role];
      if (!route) {
        if (profile.role === "pending") { setPendingUser(profile); return; }
        setError("Your account role is not yet configured. Please contact your administrator.");
        return;
      }
      setUser(profile);
      localStorage.setItem("token", response.token);
      goTo(redirectTo || route);
    } catch (err) {
      const msg = err?.message || "";
      setError(
        msg === "Failed to fetch"
          ? "Cannot connect to the server. Please try again."
          : msg || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatCode(val) {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + "-" + clean.slice(4, 8);
  }

  async function handleCodeSubmit(e) {
    e.preventDefault();
    setCodeLoading(true); setCodeError("");
    try {
      const BASE = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${BASE}/api/invitations/check-code/${encodeURIComponent(inviteCode)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Invalid code");
      const invite = data.invitation;
      const acceptRes = await fetch(`${BASE}/api/invitations/${invite.token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ existing_user_id: pendingUser.user_id }),
      });
      const acceptData = await acceptRes.json();
      if (!acceptRes.ok) throw new Error(acceptData.message || "Failed to accept invitation");
      setUser(acceptData.user);
      localStorage.setItem("token", acceptData.token);
      setCodeSuccess(true);
      setTimeout(() => goTo(ROLE_ROUTES[acceptData.user.role] || "/"), 1500);
    } catch (err) {
      setCodeError(err.message);
    } finally {
      setCodeLoading(false);
    }
  }

  return (
    <main style={s.page}>
      {/* Subtle concentric rings */}
      <div style={s.ring1} />
      <div style={s.ring2} />

      {pendingUser ? (
        <div style={{ ...s.card, animation: visible ? "slideUp 0.45s cubic-bezier(.22,1,.36,1) both" : "none" }}>
          {codeSuccess ? (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#ECFDF5", border: "1px solid #A7F3D0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <CheckIcon2 />
              </div>
              <h2 style={s.cardTitle}>You're in!</h2>
              <p style={s.cardSub}>Redirecting to your dashboard…</p>
            </div>
          ) : (
            <>
              <div style={{ textAlign: "center", marginBottom: "24px" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  <TicketIcon />
                </div>
                <h2 style={s.cardTitle}>Welcome, {pendingUser.full_name?.split(" ")[0] || "there"}!</h2>
                <p style={s.cardSub}>Your account is set up. Enter your invitation code from your manager.</p>
              </div>

              <form onSubmit={handleCodeSubmit}>
                <label style={s.label}>Invitation Code</label>
                <input
                  value={inviteCode}
                  onChange={e => { setInviteCode(formatCode(e.target.value)); setCodeError(""); }}
                  placeholder="XXXX-XXXX"
                  maxLength={9}
                  required
                  style={{
                    width: "100%", padding: "14px 16px",
                    background: "#F8FAFC",
                    border: "1.5px solid #E2E8F0", borderRadius: "12px",
                    fontSize: "22px", fontWeight: "800", textAlign: "center",
                    letterSpacing: "0.15em", outline: "none", boxSizing: "border-box",
                    color: "#0F172A", fontFamily: "monospace",
                  }}
                />
                {codeError && (
                  <div style={{ ...s.errorBox, marginTop: "12px" }} role="alert">
                    <WarnIcon /><span>{codeError}</span>
                  </div>
                )}
                <button
                  type="submit"
                  disabled={codeLoading || inviteCode.length < 9}
                  style={{
                    width: "100%", padding: "13px", borderRadius: "10px", border: "none",
                    background: inviteCode.length < 9 ? "#F1F5F9" : "#3B82F6",
                    color: inviteCode.length < 9 ? "#94A3B8" : "#fff",
                    fontSize: "14px", fontWeight: "700",
                    cursor: inviteCode.length < 9 ? "not-allowed" : "pointer",
                    marginTop: "16px", transition: "all 0.15s",
                  }}
                >
                  {codeLoading ? "Joining…" : "Join Team"}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #F1F5F9" }}>
                <p style={{ fontSize: "13px", color: "#94A3B8", lineHeight: 1.6 }}>
                  Don't have a code? Ask your manager to send an invitation from their dashboard.
                </p>
                <button
                  onClick={() => { setPendingUser(null); setInviteCode(""); setCodeError(""); }}
                  style={{ background: "none", border: "none", color: "#3B82F6", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginTop: "10px" }}
                >
                  ← Back to login
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <form
          style={{ ...s.card, animation: visible ? "slideUp 0.45s cubic-bezier(.22,1,.36,1) both" : "none" }}
          onSubmit={handleLogin}
          autoComplete="off"
          noValidate
        >
          {/* Logo */}
          <Link to="/" style={s.logoRow}>
            <img src="/logo_noText.png" alt="Krewby" style={{ height: "38px", objectFit: "contain" }} />
          </Link>

          <h2 style={s.cardTitle}>Welcome back</h2>
          <p style={s.cardSub}>Sign in to your account to continue.</p>

          {error && (
            <div style={s.errorBox} role="alert">
              <WarnIcon /><span>{error}</span>
            </div>
          )}

          <Field
            id="email" label="Email address" name="email" type="email"
            value={form.email} onChange={handleChange}
            placeholder="you@example.com" autoComplete="off" disabled={loading}
          />

          <Field
            id="password" label="Password" name="password"
            type={showPassword ? "text" : "password"}
            value={form.password} onChange={handleChange}
            placeholder="Enter your password" autoComplete="new-password" disabled={loading}
            right={
              <button type="button" style={s.eyeBtn} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon open={showPassword} />
              </button>
            }
          />

          <div style={s.forgotRow}>
            <Link to="/forgot-password" style={s.forgotLink}>Forgot password?</Link>
          </div>

          <SubmitBtn loading={loading} />

          <div style={s.divider} />

          <p style={{ textAlign: "center", fontSize: "13px", color: "#94A3B8" }}>
            Don't have an account?{" "}
            <Link to="/get-started" style={{ color: "#3B82F6", fontWeight: "600", textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
          <p style={{ textAlign: "center", marginTop: "10px" }}>
            <Link to="/" style={{ fontSize: "12px", color: "#CBD5E1", textDecoration: "none" }}>← Back to home</Link>
          </p>
        </form>
      )}
    </main>
  );
}

function SubmitBtn({ loading }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="submit"
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        display: "block", width: "100%", padding: "13px",
        marginTop: "24px",
        background: loading ? "#93C5FD" : hovered ? "#2563EB" : "#3B82F6",
        color: "#fff", border: "none", borderRadius: "11px",
        fontSize: "14px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
        boxSizing: "border-box", letterSpacing: "0.01em",
        transform: !loading && (pressed ? "scale(0.97)" : hovered ? "scale(1.01)" : "scale(1)"),
        boxShadow: !loading && hovered && !pressed ? "0 8px 24px rgba(59,130,246,0.25)" : "none",
        transition: "transform 0.15s, box-shadow 0.2s, background 0.15s",
      }}
    >
      {loading ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <span style={{ display: "inline-block", width: "14px", height: "14px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
          Signing in…
        </span>
      ) : "Sign in"}
    </button>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F8FAFC",
    position: "relative",
    overflow: "hidden",
    padding: "24px",
    boxSizing: "border-box",
  },
  ring1: {
    position: "absolute",
    width: "520px", height: "520px",
    borderRadius: "50%",
    border: "1px solid rgba(59,130,246,0.07)",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  ring2: {
    position: "absolute",
    width: "340px", height: "340px",
    borderRadius: "50%",
    border: "1px solid rgba(59,130,246,0.05)",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
  },
  card: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    maxWidth: "420px",
    background: "#FFFFFF",
    border: "1px solid #E2E8F0",
    borderRadius: "22px",
    padding: "44px 40px",
    boxSizing: "border-box",
    boxShadow: "0 4px 32px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)",
  },
  logoRow: {
    display: "flex", alignItems: "center",
    textDecoration: "none", marginBottom: "32px",
  },
  cardTitle: { fontSize: "23px", fontWeight: "700", color: "#0F172A", marginBottom: "6px", letterSpacing: "-0.02em" },
  cardSub:   { fontSize: "14px", color: "#94A3B8", marginBottom: "4px", lineHeight: 1.5 },
  errorBox: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    background: "#FEF2F2", border: "1px solid #FECACA",
    color: "#DC2626", padding: "11px 13px", borderRadius: "10px",
    fontSize: "13px", lineHeight: 1.5, marginTop: "16px",
  },
  label:     { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  input: {
    display: "block", width: "100%", padding: "11px 13px",
    borderWidth: "1.5px", borderStyle: "solid", borderColor: "#E2E8F0",
    borderRadius: "10px",
    fontSize: "14px", background: "#F8FAFC", color: "#0F172A",
    boxSizing: "border-box", outline: "none",
    transition: "border-color 0.15s, box-shadow 0.15s",
    fontFamily: "inherit",
  },
  inputRight: {
    position: "absolute", right: "12px", top: "50%",
    transform: "translateY(-50%)", display: "flex", alignItems: "center",
  },
  eyeBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#CBD5E1", display: "flex", alignItems: "center", padding: "2px",
  },
  forgotRow:  { display: "flex", justifyContent: "flex-end", marginTop: "10px" },
  forgotLink: { fontSize: "12px", fontWeight: "600", color: "#3B82F6", textDecoration: "none" },
  divider:    { borderTop: "1px solid #F1F5F9", margin: "22px 0 18px" },
};
