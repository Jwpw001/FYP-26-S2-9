import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser, getUser } from "../utils/auth";
import { supabase } from "../lib/supabaseClient";

const ROLE_ROUTES = {
  system_admin:         "/system-admin/dashboard",
  outlet_manager:       "/outlet-manager/dashboard",
  regular_staff:        "/regular-staff/dashboard",
  outlet_casual_staff:  "/outlet-casual-staff/dashboard",
  krewby_coordinator:   "/krewby-coordinator/dashboard",
  krewby_casual_worker: "/krewby-worker/dashboard",
};

/* ── Icons ── */
const EyeIcon = ({ open }) => open ? (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const WarnIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

/* ── Focused Input ── */
function Field({ id, label, type = "text", name, value, onChange, placeholder, autoComplete, disabled, right }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginTop: "18px" }}>
      <label htmlFor={id} style={s.label}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          required
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            ...s.input,
            borderColor: focused ? "#3B82F6" : "#E2E8F0",
            boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
            paddingRight: right ? "44px" : "13px",
          }}
        />
        {right && <div style={s.inputRight}>{right}</div>}
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function Login() {
  const navigate = useNavigate();
  const goTo = useGoTo();
  const [form, setForm]               = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [visible, setVisible]         = useState(false);

  useEffect(() => {
    // inject keyframes once
    const id = "krewby-login-styles";
    if (!document.getElementById(id)) {
      const tag = document.createElement("style");
      tag.id = id;
      tag.textContent = `
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes slideUp   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
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
    setLoading(true);
    setError("");
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
      if (!route) { setError(`Unrecognised role: "${profile.role}". Contact support.`); return; }
      setUser(profile);
      goTo(route);
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>
      {/* ── Left panel ── */}
      <aside style={{ ...s.left, animation: visible ? "fadeIn 0.5s ease both" : "none" }}>
        <div style={s.leftInner}>
          {/* Logo */}
          <Link to="/" style={s.logoRow}>
            <div style={s.logoMark}>K</div>
            <span style={s.logoText}>Krewby</span>
          </Link>

          {/* Central copy */}
          <div style={s.leftBody}>
            {/* Graphic */}
            <div style={s.graphicWrap}>
              <PanelGraphic />
            </div>
            <h2 style={s.leftTitle}>
              Workforce scheduling,<br />done right.
            </h2>
            <p style={s.leftDesc}>
              Manage shifts, availability, attendance, and casual worker requests — all in one platform.
            </p>
            <div style={s.featureList}>
              {["Smart shift scheduling", "Role-based dashboards", "Real-time attendance tracking", "On-demand casual workers"].map(f => (
                <div key={f} style={s.featureItem}>
                  <CheckIcon />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p style={s.leftFooter}>© {new Date().getFullYear()} Krewby · CSIT321 FYP-26-S2-9</p>
        </div>
      </aside>

      {/* ── Right panel ── */}
      <section style={s.right}>
        <form
          style={{ ...s.card, animation: visible ? "slideUp 0.45s cubic-bezier(.22,1,.36,1) both" : "none" }}
          onSubmit={handleLogin}
          autoComplete="off"
          noValidate
        >
          {/* Mobile logo */}
          <Link to="/" style={{ ...s.logoRow, marginBottom: "28px", display: "none", ...s.mobileLogoShow }}>
            <div style={{ ...s.logoMark, background: "#0F172A" }}>K</div>
            <span style={{ ...s.logoText, color: "#0F172A" }}>Krewby</span>
          </Link>

          <h2 style={s.cardTitle}>Welcome back</h2>
          <p style={s.cardSub}>Sign in to your account to continue.</p>

          {error && (
            <div style={s.errorBox} role="alert">
              <WarnIcon />
              <span>{error}</span>
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

          <p style={s.backRow}>
            <Link to="/" style={s.backLink}>← Back to home</Link>
          </p>
        </form>
      </section>
    </main>
  );
}

/* ── Submit button with hover/press ── */
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
        ...s.submitBtn,
        ...(loading ? s.submitDisabled : {}),
        transform: !loading && (pressed ? "scale(0.97)" : hovered ? "scale(1.02)" : "scale(1)"),
        boxShadow: !loading && hovered && !pressed ? "0 6px 20px rgba(15,23,42,0.25)" : "none",
        transition: "transform 0.15s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease",
      }}
    >
      {loading ? (
        <span style={s.spinRow}>
          <span style={s.spinner} /> Signing in…
        </span>
      ) : "Sign in"}
    </button>
  );
}

/* ── Decorative SVG panel graphic ── */
function PanelGraphic() {
  return (
    <svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: "320px" }}>
      {/* Card background */}
      <rect width="320" height="180" rx="14" fill="rgba(255,255,255,0.06)"/>

      {/* Header row */}
      <rect x="16" y="16" width="80" height="10" rx="5" fill="rgba(255,255,255,0.5)"/>
      <rect x="240" y="14" width="64" height="14" rx="7" fill="rgba(59,130,246,0.6)"/>

      {/* Shift bars */}
      {[
        { y: 46,  w: 120, label: "Morning — Alice T.",   color: "#3B82F6" },
        { y: 70,  w: 90,  label: "Afternoon — Ben K.",   color: "#22C55E" },
        { y: 94,  w: 150, label: "Evening — Carol M.",   color: "#A78BFA" },
        { y: 118, w: 80,  label: "Night — David L.",     color: "#F59E0B" },
      ].map((row) => (
        <g key={row.y}>
          <rect x="16" y={row.y} width="8" height="16" rx="3" fill={row.color}/>
          <rect x="30" y={row.y + 3} width={row.w} height="5" rx="2.5" fill="rgba(255,255,255,0.15)"/>
          <rect x="30" y={row.y + 3} width={row.w * 0.6} height="5" rx="2.5" fill={row.color} opacity="0.7"/>
          <text x="30" y={row.y + 15} fill="rgba(255,255,255,0.4)" fontSize="7" fontFamily="sans-serif">{row.label}</text>
        </g>
      ))}

      {/* Mini stat cards */}
      {[
        { x: 16,  val: "47",  sub: "Staff active", c: "#3B82F6" },
        { x: 118, val: "12",  sub: "Outlets",      c: "#22C55E" },
        { x: 218, val: "98%", sub: "Attendance",   c: "#A78BFA" },
      ].map(c => (
        <g key={c.x}>
          <rect x={c.x} y="148" width="90" height="26" rx="8" fill="rgba(255,255,255,0.07)"/>
          <text x={c.x + 8} y="160" fill={c.c} fontSize="10" fontFamily="sans-serif" fontWeight="700">{c.val}</text>
          <text x={c.x + 8} y="169" fill="rgba(255,255,255,0.35)" fontSize="7" fontFamily="sans-serif">{c.sub}</text>
        </g>
      ))}
    </svg>
  );
}

/* ── Styles ── */
const s = {
  page: {
    minHeight: "100vh", display: "grid",
    gridTemplateColumns: "1fr 1fr", background: "#F8FAFC", color: "#0F172A",
  },
  left: {
    background: "linear-gradient(160deg, #0F172A 0%, #1E3A5F 100%)",
    padding: "48px", display: "flex", flexDirection: "column", boxSizing: "border-box",
  },
  leftInner: { display: "flex", flexDirection: "column", height: "100%" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoMark: {
    width: "32px", height: "32px", borderRadius: "8px", background: "#3B82F6",
    color: "#FFF", fontSize: "15px", fontWeight: "800",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: "17px", fontWeight: "800", color: "#FFF", letterSpacing: "-0.01em" },
  leftBody: { flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", paddingBottom: "24px" },
  graphicWrap: { marginBottom: "28px", opacity: 0.9 },
  leftTitle: {
    fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: "800", lineHeight: 1.2,
    letterSpacing: "-0.02em", color: "#F8FAFC", marginBottom: "12px",
  },
  leftDesc: { fontSize: "14px", lineHeight: 1.7, color: "rgba(255,255,255,0.55)", marginBottom: "24px", maxWidth: "340px" },
  featureList: { display: "flex", flexDirection: "column", gap: "10px" },
  featureItem: { display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  leftFooter: { fontSize: "11px", color: "rgba(255,255,255,0.25)", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "18px" },

  right: {
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "48px 32px", boxSizing: "border-box", background: "#F8FAFC",
  },
  card: {
    width: "100%", maxWidth: "400px", background: "#FFFFFF",
    border: "1px solid #E2E8F0", borderRadius: "20px",
    padding: "40px 36px", boxSizing: "border-box",
    boxShadow: "0 4px 24px rgba(15,23,42,0.07)",
  },
  mobileLogoShow: {},
  cardTitle: { fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px", letterSpacing: "-0.02em" },
  cardSub: { fontSize: "14px", color: "#64748B", marginBottom: "6px", lineHeight: 1.5 },

  errorBox: {
    display: "flex", alignItems: "flex-start", gap: "8px",
    background: "#FEF2F2", border: "1px solid #FECACA",
    color: "#991B1B", padding: "11px 13px", borderRadius: "10px",
    fontSize: "13px", lineHeight: 1.5, marginTop: "16px",
  },

  label: { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" },
  input: {
    display: "block", width: "100%", padding: "11px 13px",
    border: "1.5px solid #E2E8F0", borderRadius: "10px",
    fontSize: "14px", background: "#FFF", color: "#0F172A",
    boxSizing: "border-box", outline: "none",
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
  },
  inputRight: {
    position: "absolute", right: "12px", top: "50%",
    transform: "translateY(-50%)", display: "flex", alignItems: "center",
  },
  eyeBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: "#94A3B8", display: "flex", alignItems: "center", padding: "2px",
  },

  forgotRow: { display: "flex", justifyContent: "flex-end", marginTop: "10px" },
  forgotLink: { fontSize: "12px", fontWeight: "600", color: "#3B82F6", textDecoration: "none" },

  submitBtn: {
    display: "block", width: "100%", padding: "13px",
    marginTop: "24px", background: "#0F172A", color: "#FFF",
    border: "none", borderRadius: "11px", fontSize: "14px",
    fontWeight: "700", cursor: "pointer", boxSizing: "border-box",
    letterSpacing: "0.01em",
  },
  submitDisabled: { opacity: 0.6, cursor: "not-allowed" },
  spinRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
  spinner: {
    display: "inline-block", width: "14px", height: "14px",
    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#FFF",
    borderRadius: "50%", animation: "spin 0.7s linear infinite",
  },

  backRow: { textAlign: "center", marginTop: "20px" },
  backLink: { fontSize: "13px", color: "#94A3B8", textDecoration: "none", fontWeight: "500" },
};
