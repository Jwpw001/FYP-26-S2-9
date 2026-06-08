import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { setUser, getUser } from "../utils/auth";

const ROLE_ROUTES = {
  system_admin: "/system-admin/dashboard",
  outlet_manager: "/outlet-manager/dashboard",
  regular_staff: "/regular-staff/dashboard",
  outlet_casual_staff: "/outlet-casual-staff/dashboard",
  krewby_Coordinator: "/krewby-coordinator/dashboard",
  krewby_casual_worker: "/krewby-worker/dashboard",
};

export default function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect already-logged-in users
  useEffect(() => {
    const user = getUser();
    if (user && ROLE_ROUTES[user.role]) {
      navigate(ROLE_ROUTES[user.role], { replace: true });
    }
  }, [navigate]);

  function handleChange(e) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (error) setError("");
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: form.email.trim().toLowerCase(),
          password: form.password,
        });

      if (authError) {
        setError("Invalid email or password. Please try again.");
        return;
      }

      const email = authData.user.email?.toLowerCase().trim();

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .ilike("email", email)
        .single();

      if (profileError || !profile) {
        setError("Account not found. Please contact your administrator.");
        return;
      }

      const route = ROLE_ROUTES[profile.role];
      if (!route) {
        setError(`Unrecognised role: "${profile.role}". Contact support.`);
        return;
      }

      setUser(profile);
      navigate(route, { replace: true });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      {/* ── Left panel ───────────────────────────────────── */}
      <section style={styles.left} aria-hidden="true">
        <div style={styles.leftInner}>
          <Link to="/" style={styles.logoLink}>
            <div style={styles.logoBox}>K</div>
            <span style={styles.logoText}>Krewby</span>
          </Link>

          <div style={styles.leftBody}>
            <h1 style={styles.leftTitle}>
              Workforce scheduling,
              <br />
              done right.
            </h1>
            <p style={styles.leftDesc}>
              Manage shifts, availability, attendance, and casual worker
              requests — all in one place.
            </p>
          </div>

          <div style={styles.leftFooter}>
            <p style={styles.leftFooterText}>
              © {new Date().getFullYear()} Krewby · CSIT321 FYP-26-S2-9
            </p>
          </div>
        </div>
      </section>

      {/* ── Right panel ──────────────────────────────────── */}
      <section style={styles.right}>
        <form
          style={styles.card}
          onSubmit={handleLogin}
          noValidate
          aria-label="Login form"
        >
          {/* Mobile logo — only shown below 768px via inline media query workaround */}
          <div style={styles.mobileLogo}>
            <Link to="/" style={styles.logoLink}>
              <div style={{ ...styles.logoBox, ...styles.logoBoxDark }}>K</div>
              <span style={styles.mobileLogoText}>Krewby</span>
            </Link>
          </div>

          <h2 style={styles.cardTitle}>Welcome back</h2>
          <p style={styles.cardSub}>Sign in to your account to continue.</p>

          {/* Error banner */}
          {error && (
            <div style={styles.error} role="alert">
              <span style={styles.errorIcon}>⚠</span>
              {error}
            </div>
          )}

          {/* Email */}
          <label htmlFor="email" style={styles.label}>
            Email address
          </label>
          <input
            id="email"
            style={styles.input}
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="you@example.com"
            autoComplete="email"
            required
            disabled={loading}
          />

          {/* Password */}
          <label htmlFor="password" style={styles.label}>
            Password
          </label>
          <div style={styles.passwordWrapper}>
            <input
              id="password"
              style={styles.passwordInput}
              name="password"
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              disabled={loading}
            />
            <button
              type="button"
              style={styles.toggleBtn}
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Forgot password */}
          <div style={styles.forgotRow}>
            <Link to="/forgot-password" style={styles.forgotLink}>
              Forgot password?
            </Link>
          </div>

          {/* Submit */}
          <button
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {}),
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.spinnerRow}>
                <span style={styles.spinner} />
                Signing in…
              </span>
            ) : (
              "Sign in"
            )}
          </button>
        </form>
      </section>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    background: "#F7F6F3",
    color: "#1C1B18",
  },

  /* Left */
  left: {
    background: "#1C1B18",
    color: "#FFFFFF",
    padding: "48px",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    "@media(max-width:768px)": { display: "none" },
  },
  leftInner: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: "100%",
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
  },
  logoBox: {
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    fontWeight: "700",
    color: "#FFFFFF",
    flexShrink: 0,
  },
  logoBoxDark: {
    background: "#1C1B18",
    color: "#FFFFFF",
  },
  logoText: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: "-0.01em",
  },
  leftBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    paddingBottom: "32px",
  },
  leftTitle: {
    fontSize: "clamp(28px, 3vw, 40px)",
    fontWeight: "800",
    lineHeight: "1.15",
    letterSpacing: "-0.02em",
    color: "#FFFFFF",
    marginBottom: "16px",
  },
  leftDesc: {
    fontSize: "15px",
    lineHeight: "1.7",
    color: "rgba(255,255,255,0.6)",
    maxWidth: "380px",
  },
  leftFooter: {
    borderTop: "1px solid rgba(255,255,255,0.1)",
    paddingTop: "20px",
  },
  leftFooterText: {
    fontSize: "12px",
    color: "rgba(255,255,255,0.35)",
  },

  /* Right */
  right: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 32px",
    boxSizing: "border-box",
    background: "#F7F6F3",
  },

  /* Card */
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "18px",
    padding: "36px 32px",
    boxSizing: "border-box",
  },
  mobileLogo: {
    display: "none",
    marginBottom: "24px",
  },
  mobileLogoText: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#1C1B18",
  },
  cardTitle: {
    fontSize: "24px",
    fontWeight: "800",
    color: "#1C1B18",
    marginBottom: "6px",
    letterSpacing: "-0.01em",
  },
  cardSub: {
    fontSize: "14px",
    color: "#7A7870",
    marginBottom: "24px",
    lineHeight: "1.5",
  },

  /* Error */
  error: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#991B1B",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    lineHeight: "1.5",
    marginBottom: "16px",
  },
  errorIcon: {
    flexShrink: 0,
    fontSize: "14px",
    lineHeight: "1.5",
  },

  /* Form */
  label: {
    display: "block",
    fontSize: "13px",
    fontWeight: "600",
    color: "#3D3B35",
    marginBottom: "6px",
    marginTop: "16px",
  },
  input: {
    display: "block",
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid #D8D5CE",
    borderRadius: "10px",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1C1B18",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.15s",
  },

  /* Password with toggle */
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  passwordInput: {
    display: "block",
    width: "100%",
    padding: "11px 52px 11px 13px",
    border: "1.5px solid #D8D5CE",
    borderRadius: "10px",
    fontSize: "14px",
    background: "#FFFFFF",
    color: "#1C1B18",
    boxSizing: "border-box",
    outline: "none",
  },
  toggleBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    fontSize: "12px",
    fontWeight: "600",
    color: "#7A7870",
    cursor: "pointer",
    padding: "4px",
    userSelect: "none",
  },

  /* Forgot */
  forgotRow: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: "8px",
  },
  forgotLink: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#7A7870",
    textDecoration: "none",
  },

  /* Submit */
  button: {
    display: "block",
    width: "100%",
    padding: "12px",
    marginTop: "22px",
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "11px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxSizing: "border-box",
    letterSpacing: "0.01em",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  spinnerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
  },
  spinner: {
    display: "inline-block",
    width: "14px",
    height: "14px",
    border: "2px solid rgba(255,255,255,0.3)",
    borderTopColor: "#FFFFFF",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
};
