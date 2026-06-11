import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await api.post("/api/auth/forgot-password", {
        email: email.trim().toLowerCase(),
        redirectTo: `${window.location.origin}/reset-password`
      });
      setSent(true);
    } catch (err) {
      setError("Could not send reset email. Check the address and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <div style={styles.card}>
        <Link to="/" style={styles.logoLink}>
          <div style={styles.logoBox}>K</div>
          <span style={styles.logoText}>Krewby</span>
        </Link>

        {sent ? (
          <div style={styles.successBox}>
            <p style={styles.successTitle}>Check your email</p>
            <p style={styles.successDesc}>
              We've sent a password reset link to <strong>{email}</strong>. It
              expires in 1 hour.
            </p>
            <Link to="/login" style={styles.backLink}>
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <h2 style={styles.title}>Reset your password</h2>
            <p style={styles.sub}>
              Enter your account email and we'll send you a reset link.
            </p>

            {error && (
              <div style={styles.error} role="alert">
                <span>⚠ </span>{error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="reset-email" style={styles.label}>
                Email address
              </label>
              <input
                id="reset-email"
                style={styles.input}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                placeholder="you@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
              <button
                style={{ ...styles.button, ...(loading ? styles.buttonDisabled : {}) }}
                disabled={loading}
              >
                {loading ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <div style={styles.footer}>
              <Link to="/login" style={styles.backLink}>
                ← Back to sign in
              </Link>
            </div>
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
  logoBox: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "#1C1B18",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: "16px",
    fontWeight: "800",
    color: "#1C1B18",
  },
  title: {
    fontSize: "22px",
    fontWeight: "800",
    color: "#1C1B18",
    marginBottom: "6px",
    letterSpacing: "-0.01em",
  },
  sub: {
    fontSize: "14px",
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
    fontSize: "13px",
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "13px",
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
    fontSize: "14px",
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
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    boxSizing: "border-box",
  },
  buttonDisabled: {
    opacity: 0.65,
    cursor: "not-allowed",
  },
  footer: {
    marginTop: "20px",
    textAlign: "center",
  },
  backLink: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#7A7870",
    textDecoration: "none",
  },
  successBox: {
    textAlign: "center",
    paddingTop: "8px",
  },
  successTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#1C1B18",
    marginBottom: "10px",
  },
  successDesc: {
    fontSize: "14px",
    color: "#7A7870",
    lineHeight: "1.6",
    marginBottom: "24px",
  },
};
