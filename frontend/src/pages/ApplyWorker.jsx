import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";

function Field({ label, id, type = "text", value, onChange, placeholder, rightEl, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label} <span style={{ color: "#EF4444" }}>*</span>
      </label>
      <div style={{ position: "relative" }}>
        <input
          id={id} type={type} value={value} onChange={onChange}
          placeholder={placeholder} required
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={{
            width: "100%", padding: "12px 14px", paddingRight: rightEl ? "60px" : "14px",
            borderRadius: "10px", border: `1.5px solid ${focused ? "#0F172A" : "#E2E8F0"}`,
            boxShadow: focused ? "0 0 0 3px rgba(15,23,42,0.07)" : "none",
            fontSize: "14px", color: "#0F172A", boxSizing: "border-box",
            background: "#fff", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {rightEl && <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)" }}>{rightEl}</div>}
      </div>
      {hint && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function ApplyWorker() {
  const goTo = useGoTo();
  const [form, setForm] = useState({ full_name: "", username: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const [showPw, setShowPw]   = useState(false);

  function set(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.username.trim().length < 2) { setError("Username must be at least 2 characters."); return; }
    if (form.password !== form.confirm)  { setError("Passwords do not match."); return; }
    if (form.password.length < 6)        { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/apply-worker", {
        full_name: form.full_name.trim(),
        username:  form.username.trim().toLowerCase(),
        email:     form.email.trim().toLowerCase(),
        password:  form.password,
      });
      if (res.data?.success) {
        setDone(true);
      } else {
        setError(res.data?.message || "Submission failed. Please try again.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", display: "flex", flexDirection: "column" }}>

      {/* ── Navbar ── */}
      <nav style={{ height: "64px", background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 60px", boxSizing: "border-box", flexShrink: 0 }}>
        <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#0F172A", color: "#fff", fontSize: "15px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>K</div>
          <span style={{ fontSize: "17px", fontWeight: "800", letterSpacing: "-0.02em", color: "#0F172A" }}>Krewby</span>
        </button>
        <button onClick={() => goTo("/login")} style={{ background: "none", border: "1.5px solid #E2E8F0", color: "#64748B", padding: "8px 18px", borderRadius: "9px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}>
          Log in
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          <button onClick={() => goTo("/join")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
            ← Back to worker info
          </button>

          {done ? (
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "48px 40px", textAlign: "center", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "12px" }}>Application submitted!</h2>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.75, marginBottom: "20px" }}>
                Thank you for applying to the Krewby worker pool. Our coordinator will personally review your application and get back to you within <strong style={{ color: "#0F172A" }}>2–3 working days</strong>.
              </p>
              <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "12px", padding: "16px", fontSize: "13px", color: "#1E40AF", marginBottom: "24px" }}>
                We'll reach out to <strong>{form.email}</strong> with the outcome.
              </div>
              <button onClick={() => goTo("/")} style={{ width: "100%", padding: "13px", background: "#0F172A", color: "#fff", border: "none", borderRadius: "12px", fontSize: "14px", fontWeight: "700", cursor: "pointer" }}>
                Back to home
              </button>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "40px", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#0F172A", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>

              <h1 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "8px" }}>Worker application</h1>
              <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.65, marginBottom: "28px" }}>
                Fill in your details and our coordinator will review your application within 2–3 working days.
              </p>

              <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
                {["✓ Free to join", "✓ No commitment", "✓ Reviewed personally"].map(b => (
                  <span key={b} style={{ fontSize: "11px", fontWeight: "600", color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: "100px", padding: "4px 10px" }}>{b}</span>
                ))}
              </div>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 14px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
                  ⚠️ {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <Field label="Full name"     id="full_name" value={form.full_name} onChange={set("full_name")} placeholder="Your full name" />
                <Field label="Username"      id="username"  value={form.username}  onChange={set("username")}  placeholder="e.g. john123" hint="Min. 2 characters. This will be your unique handle." />
                <Field label="Email address" id="email"     type="email" value={form.email} onChange={set("email")} placeholder="your@email.com" hint="We'll send your approval status to this email." />
                <Field label="Password" id="password" type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="Min. 6 characters"
                  rightEl={<button type="button" onClick={() => setShowPw(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "12px", fontWeight: "600" }}>{showPw ? "Hide" : "Show"}</button>}
                />
                <Field label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" />

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%", padding: "14px", marginTop: "4px",
                    background: loading ? "#64748B" : "#0F172A",
                    color: "#fff", border: "none", borderRadius: "12px",
                    fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {loading ? "Submitting…" : "Submit application →"}
                </button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
                  By applying you agree to Krewby's terms of service. No credit card required.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
