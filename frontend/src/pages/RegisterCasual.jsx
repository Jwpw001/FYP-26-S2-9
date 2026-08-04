import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";

export default function RegisterCasual() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    full_name: "",
    username: "",
    email: "",
    password: "",
    join_code: params.get("code") || "",
    bio: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function set(field, value) {
    setForm(p => ({ ...p, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.post("/api/casual/register", form);
      localStorage.setItem("token", data.token);
      setUser(data.user);
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={s.shell}>
        <div style={s.card}>
          <div style={{ textAlign: "center", padding: "8px 0 24px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1C1B18", marginBottom: "10px" }}>Application Submitted!</h2>
            <p style={{ fontSize: "21px", color: "#64748B", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto 28px" }}>
              Your application is now pending review. The business owner will approve or reject your account shortly. You'll receive a notification once it's reviewed.
            </p>
            <button onClick={() => navigate("/casual-staff/dashboard")} style={s.btn}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.shell}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <img src="/logo_noText.png" alt="Krewby" style={{ width: "36px", height: "36px", objectFit: "contain", borderRadius: "9px" }} />
          <span style={s.logoText}>Krewby</span>
        </div>

        <h1 style={s.heading}>Join as Casual Worker</h1>
        <p style={s.sub}>Enter the join code from your employer to apply.</p>

        {error && <div style={s.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={s.fieldGroup}>
            <label style={s.label}>Join Code</label>
            <input
              style={{ ...s.input, fontFamily: "monospace", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: "700" }}
              placeholder="XXXX-XXXX"
              value={form.join_code}
              onChange={e => set("join_code", e.target.value.toUpperCase())}
              required
              autoComplete="off"
            />
            <p style={s.hint}>Get this code from the business you're joining.</p>
          </div>

          <div style={s.divider}><span style={s.dividerText}>Your details</span></div>

          <Field label="Full Name" value={form.full_name} onChange={v => set("full_name", v)} placeholder="e.g. Jamie Tan" required autoComplete="off" />
          <Field label="Username" value={form.username} onChange={v => set("username", v)} placeholder="e.g. jamiet" required autoComplete="off" />
          <Field label="Email" type="email" value={form.email} onChange={v => set("email", v)} placeholder="you@email.com" required autoComplete="off" />
          <Field label="Password" type="password" value={form.password} onChange={v => set("password", v)} placeholder="Min 8 characters" required autoComplete="new-password" />

          <div style={s.fieldGroup}>
            <label style={s.label}>Short Bio <span style={{ color: "#A09D97", fontWeight: 500 }}>(optional)</span></label>
            <textarea
              style={{ ...s.input, resize: "vertical", minHeight: "72px", lineHeight: 1.5 }}
              placeholder="Tell the business a bit about yourself and your experience…"
              value={form.bio}
              onChange={e => set("bio", e.target.value)}
            />
          </div>

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? "Submitting…" : "Submit Application"}
          </button>
        </form>

        <p style={s.footer}>
          Already have an account? <Link to="/login" style={s.link}>Log in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, required, autoComplete }) {
  return (
    <div style={s.fieldGroup}>
      <label style={s.label}>{label}</label>
      <input
        style={s.input}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
      />
    </div>
  );
}

const s = {
  shell: {
    minHeight: "100vh",
    background: "#F8FAFC",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  },
  card: {
    background: "#FFFFFF",
    border: "1px solid #E5E2DC",
    borderRadius: "18px",
    padding: "36px 32px",
    width: "100%",
    maxWidth: "440px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
  },
  logoRow: {
    display: "flex", alignItems: "center", gap: "10px", marginBottom: "28px",
  },
  logoBox: {
    width: "36px", height: "36px", borderRadius: "9px",
    background: "#F59E0B", color: "#1C1917",
    fontSize: "21px", fontWeight: "800",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: "23px", fontWeight: "800", color: "#0F172A" },
  heading: { fontSize: "25px", fontWeight: "800", color: "#1C1B18", marginBottom: "6px" },
  sub: { fontSize: "20px", color: "#64748B", marginBottom: "24px" },
  errorBox: {
    background: "#FEF2F2", border: "1px solid #FECACA",
    borderRadius: "10px", padding: "11px 14px",
    fontSize: "20px", color: "#DC2626", marginBottom: "4px",
  },
  fieldGroup: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "19px", fontWeight: "700", color: "#7A7870", textTransform: "uppercase", letterSpacing: "0.05em" },
  hint: { fontSize: "18px", color: "#A09D97", marginTop: "2px" },
  input: {
    border: "1.5px solid #E5E2DC", borderRadius: "10px",
    padding: "10px 13px", fontSize: "21px", color: "#1C1B18",
    background: "#FAFAF8", outline: "none",
    transition: "border-color 0.15s",
  },
  divider: {
    display: "flex", alignItems: "center", gap: "10px", margin: "4px 0",
  },
  dividerText: {
    fontSize: "18px", fontWeight: "700", color: "#A09D97",
    textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap",
    padding: "0 4px", background: "#fff",
  },
  btn: {
    background: "#F59E0B", color: "#1C1917",
    border: "none", borderRadius: "10px",
    padding: "12px", fontSize: "21px", fontWeight: "700",
    cursor: "pointer", marginTop: "4px",
    transition: "background 0.15s",
  },
  footer: { fontSize: "20px", color: "#64748B", textAlign: "center", marginTop: "20px" },
  link: { color: "#2563EB", fontWeight: "600", textDecoration: "none" },
};
