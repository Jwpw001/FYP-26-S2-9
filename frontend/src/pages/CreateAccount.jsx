import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { PenLine, Briefcase, Key, CheckCircle2 } from "lucide-react";

function Field({ label, id, type = "text", value, onChange, placeholder, half }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px", ...(half ? { flex: 1 } : {}) }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}<span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: "10px",
          border: `1.5px solid ${focused ? "#059669" : "#E2E8F0"}`,
          boxShadow: focused ? "0 0 0 3px rgba(5,150,105,0.1)" : "none",
          fontSize: "14px",
          color: "#0F172A",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s, box-shadow 0.15s",
          background: "#fff",
        }}
      />
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "flex", gap: "16px" }}>{children}</div>;
}

export default function CreateAccount() {
  const goTo = useGoTo();
  const [form, setForm] = useState({ full_name: "", username: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [done, setDone] = useState(false);

  function setField(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        full_name: form.full_name,
        username: form.username,
        email: form.email,
        password: form.password,
      });
      if (res.success) {
        setDone(true);
      } else {
        setError(res.message || "Registration failed.");
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>

      {/* Left panel — branding */}
      <div style={{
        flex: "0 0 38%", minWidth: "360px", background: "linear-gradient(160deg,#065F46 0%,#047857 45%,#059669 100%)",
        color: "#fff", padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "sticky", top: 0, height: "100vh", boxSizing: "border-box",
      }}>
        <div>
          <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", marginBottom: "64px" }}>
            <div style={{ background: "#fff", borderRadius: "9px", padding: "5px 10px", display: "inline-flex", alignItems: "center" }}>
              <img src="/krewby-logo.png" alt="Krewby" style={{ height: "22px", objectFit: "contain", display: "block" }} />
            </div>
          </button>

          <h1 style={{ fontSize: "32px", fontWeight: "800", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Create your Krewby account
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: "380px" }}>
            Sign up and your manager or system administrator will assign your role and outlet once you're set up.
          </p>

          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              [PenLine, "Quick sign-up", "Just your name, email, and a password to get started."],
              [Briefcase, "Role assigned for you", "Your manager links your account to the right outlet and role."],
              [Key, "Ready to log in", "Once assigned, sign in and access your dashboard right away."],
            ].map(([Icon, title, desc]) => (
              <div key={title} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ lineHeight: 1 }}><Icon size={22} color="#fff" /></div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginBottom: "2px" }}>{title}</p>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>
          Already have an account?{" "}
          <button onClick={() => goTo("/login")} style={{ background: "none", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>Log in</button>
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, background: "#F8FAFC", overflowY: "auto", height: "100vh" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "56px 40px 80px" }}>
          <button onClick={() => goTo("/get-started")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
            ← Back to options
          </button>

          {done ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <div style={{ marginBottom: "16px", display: "flex", justifyContent: "center" }}><CheckCircle2 size={48} color="#059669" /></div>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "10px" }}>Account created!</h2>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.7, marginBottom: "28px", maxWidth: "420px", margin: "0 auto 28px" }}>
                Your account has been set up. Your manager or administrator will assign your role.
                Once assigned, you'll be able to log in and access your dashboard.
              </p>
              <button
                onClick={() => goTo("/login")}
                style={{ padding: "13px 32px", background: "#059669", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: "pointer" }}
              >
                Go to login →
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Create your account</h2>
              <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>Fill in your details below to get started.</p>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <Row>
                  <Field label="Full name" id="full_name" value={form.full_name} onChange={setField("full_name")} placeholder="Your full name" half />
                  <Field label="Username" id="username" value={form.username} onChange={setField("username")} placeholder="e.g. john123" half />
                </Row>
                <Field label="Email address" id="email" type="email" value={form.email} onChange={setField("email")} placeholder="your@email.com" />

                <Row>
                  <div style={{ flex: 1, marginBottom: "18px" }}>
                    <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                      Password<span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showPw ? "text" : "password"}
                        value={form.password}
                        onChange={setField("password")}
                        placeholder="At least 6 characters"
                        required
                        style={{ width: "100%", padding: "11px 40px 11px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", background: "#fff" }}
                      />
                      <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "13px" }}>
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                  <Field label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={setField("confirm")} placeholder="Repeat password" half />
                </Row>

                <button
                  type="submit"
                  disabled={loading}
                  style={{ width: "100%", padding: "14px", background: loading ? "#6EE7B7" : "#059669", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", marginTop: "8px", transition: "background 0.15s" }}
                >
                  {loading ? "Creating account…" : "Create account →"}
                </button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
                  Your role will be assigned by your manager or system administrator after sign-up.
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
