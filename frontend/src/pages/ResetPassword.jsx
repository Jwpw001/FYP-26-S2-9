import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AlertTriangle, CheckCircle } from "lucide-react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [done, setDone]           = useState(false);
  const [loading, setLoading]     = useState(false);
  const [token, setToken]         = useState(null);

  useEffect(() => {
    // Supabase puts the access_token in the URL hash after redirect
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.replace("#", "?"));
    const t = params.get("access_token");
    if (!t) setError("Invalid or expired reset link. Please request a new one.");
    setToken(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", { access_token: token, password });
      setDone(true);
      setTimeout(() => navigate("/login"), 3000);
    } catch {
      setError("Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={s.page}>
      <div style={s.card}>
        <Link to="/" style={s.logoLink}>
          <img src="/logo_noText.png" alt="Krewby" style={{ width: "34px", height: "34px", objectFit: "contain", borderRadius: "9px" }} />
          <span style={s.logoText}>Krewby</span>
        </Link>

        {done ? (
          <div style={{ textAlign: "center", paddingTop: "8px" }}>
            <CheckCircle size={40} color="#16A34A" style={{ marginBottom: "12px" }} />
            <p style={{ fontSize: "18px", fontWeight: "700", color: "#1C1B18", marginBottom: "8px" }}>Password updated!</p>
            <p style={{ fontSize: "14px", color: "#7A7870" }}>Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <h2 style={s.title}>Set a new password</h2>
            <p style={s.sub}>Choose a strong password for your account.</p>

            {error && (
              <div style={s.error} role="alert">
                <AlertTriangle size={14} color="#991B1B" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              <label style={s.label} htmlFor="rp-pw">New password</label>
              <input
                id="rp-pw"
                style={s.input}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="Min. 8 characters"
                required
                disabled={loading || !token}
                autoComplete="new-password"
              />
              <label style={{ ...s.label, marginTop: "14px" }} htmlFor="rp-confirm">Confirm password</label>
              <input
                id="rp-confirm"
                style={s.input}
                type="password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); setError(""); }}
                placeholder="Repeat password"
                required
                disabled={loading || !token}
                autoComplete="new-password"
              />
              <button
                style={{ ...s.button, ...((loading || !token) ? s.buttonDisabled : {}) }}
                disabled={loading || !token}
              >
                {loading ? "Updating…" : "Update password"}
              </button>
            </form>

            <div style={{ marginTop: "20px", textAlign: "center" }}>
              <Link to="/login" style={s.backLink}>← Back to sign in</Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const s = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F6F3", padding: "24px" },
  card: { width: "100%", maxWidth: "400px", background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "18px", padding: "36px 32px", boxSizing: "border-box" },
  logoLink: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "28px" },
  logoText: { fontSize: "16px", fontWeight: "800", color: "#1C1B18" },
  title: { fontSize: "22px", fontWeight: "800", color: "#1C1B18", marginBottom: "6px", letterSpacing: "-0.01em" },
  sub: { fontSize: "14px", color: "#7A7870", lineHeight: "1.5", marginBottom: "24px" },
  error: { display: "flex", alignItems: "center", gap: "6px", background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "10px", fontSize: "13px", marginBottom: "14px" },
  label: { display: "block", fontSize: "13px", fontWeight: "600", color: "#3D3B35", marginBottom: "6px" },
  input: { display: "block", width: "100%", padding: "11px 13px", border: "1.5px solid #D8D5CE", borderRadius: "10px", fontSize: "14px", background: "#FFFFFF", color: "#1C1B18", boxSizing: "border-box", outline: "none" },
  button: { display: "block", width: "100%", padding: "12px", marginTop: "18px", background: "#1C1B18", color: "#FFFFFF", border: "none", borderRadius: "11px", fontSize: "14px", fontWeight: "700", cursor: "pointer", boxSizing: "border-box" },
  buttonDisabled: { opacity: 0.65, cursor: "not-allowed" },
  backLink: { fontSize: "13px", fontWeight: "600", color: "#7A7870", textDecoration: "none" },
};
