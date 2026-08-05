import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { clearUser } from "../utils/auth";
import { AlertTriangle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase's client parses the recovery token out of the URL hash and fires this
    // event once it's established a temporary "password recovery" session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    // If the link's token already expired/was invalid, no session will ever appear.
    const timeout = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (!data.session) setInvalid(true);
        else setReady(true);
      });
    }, 2500);
    return () => { sub.subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }

    setLoading(true);
    setError("");
    try {
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) throw updateErr;
      setDone(true);
      await supabase.auth.signOut();
      // Clear the app's own cached session too — otherwise Login.jsx sees the old
      // localStorage user/token, assumes you're still logged in as whoever that was,
      // and redirects straight to their dashboard instead of showing the login form.
      clearUser();
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      setError(err.message || "Could not reset password. Please request a new link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link to="/" style={styles.logoLink}>
          <img src="/logo_noText.png" alt="Krewby" style={{ width: "34px", height: "34px", objectFit: "contain", borderRadius: "9px" }} />
          <span style={styles.logoText}>Krewby</span>
        </Link>

        {invalid ? (
          <div style={styles.successBox}>
            <p style={styles.successTitle}>Link expired</p>
            <p style={styles.successDesc}>This password reset link is invalid or has expired.</p>
            <Link to="/forgot-password" style={styles.backLink}>Request a new link</Link>
          </div>
        ) : done ? (
          <div style={styles.successBox}>
            <p style={styles.successTitle}>Password updated</p>
            <p style={styles.successDesc}>Redirecting you to sign in…</p>
          </div>
        ) : !ready ? (
          <p style={styles.sub}>Verifying your reset link…</p>
        ) : (
          <>
            <h2 style={styles.title}>Set a new password</h2>
            <p style={styles.sub}>Choose a new password for your account.</p>

            {error && (
              <div style={{ ...styles.error, display: "flex", alignItems: "center", gap: "6px" }} role="alert">
                <AlertTriangle size={14} color="#991B1B" />{error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="new-password" style={styles.label}>New password</label>
              <input
                id="new-password"
                style={styles.input}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Min. 6 characters"
                disabled={loading}
                autoComplete="new-password"
              />
              <label htmlFor="confirm-password" style={{ ...styles.label, marginTop: "14px" }}>Confirm password</label>
              <input
                id="confirm-password"
                style={styles.input}
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                placeholder="Repeat password"
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
                disabled={loading}
              >
                {loading ? "Saving…" : "Reset password"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F7F6F3",
    padding: "24px",
  },
  card: {
    width: "100%",
    maxWidth: "400px",
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "18px",
    padding: "36px 32px",
    boxSizing: "border-box",
  },
  logoLink: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
    marginBottom: "28px",
  },
  logoText: {
    fontSize: "21px",
    fontWeight: "800",
    color: "#1C1B18",
  },
  title: {
    fontSize: "25px",
    fontWeight: "800",
    color: "#1C1B18",
    marginBottom: "6px",
    letterSpacing: "-0.01em",
  },
  sub: {
    fontSize: "21px",
    color: "#7A7870",
    lineHeight: "1.5",
    marginBottom: "24px",
  },
  error: {
    background: "#FEF2F2",
    border: "1px solid #FECACA",
    color: "#991B1B",
    padding: "10px 12px",
    borderRadius: "10px",
    fontSize: "20px",
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "20px",
    fontWeight: "600",
    color: "#3D3B35",
    marginBottom: "6px",
  },
  input: {
    display: "block",
    width: "100%",
    padding: "11px 13px",
    border: "1.5px solid #D8D5CE",
    borderRadius: "10px",
    fontSize: "21px",
    background: "#FFFFFF",
    color: "#1C1B18",
    boxSizing: "border-box",
    outline: "none",
  },
  button: {
    display: "block",
    width: "100%",
    padding: "12px",
    marginTop: "18px",
    background: "#1C1B18",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "11px",
    fontSize: "21px",
    fontWeight: "700",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  successBox: {
    textAlign: "center",
    paddingTop: "8px",
  },
  successTitle: {
    fontSize: "23px",
    fontWeight: "700",
    color: "#1C1B18",
    marginBottom: "10px",
  },
  successDesc: {
    fontSize: "21px",
    color: "#7A7870",
    lineHeight: "1.6",
    marginBottom: "24px",
  },
  backLink: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#7A7870",
    textDecoration: "none",
  },
};
