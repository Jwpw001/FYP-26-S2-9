import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";

function Field({ label, id, type = "text", value, onChange, placeholder, required = true, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          padding: "11px 14px",
          borderRadius: "10px",
          border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`,
          boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
          fontSize: "14px",
          color: "#0F172A",
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.15s, box-shadow 0.15s",
          background: "#fff",
        }}
      />
      {hint && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function RegisterBusiness() {
  const goTo = useGoTo();
  const navigate = useNavigate();
  const [form, setForm] = useState({ business_name: "", owner_name: "", email: "", phone: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register-business", {
        business_name: form.business_name,
        owner_name: form.owner_name,
        email: form.email,
        phone: form.phone,
        password: form.password,
      });
      if (res.success) {
        setUser({ ...res.user, token: res.token });
        goTo("/business-owner/dashboard");
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
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#EFF6FF 0%,#F8FAFC 60%,#EFF6FF 100%)", display: "flex", flexDirection: "column" }}>

      {/* Nav */}
      <nav style={{ height: "64px", background: "rgba(255,255,255,0.93)", backdropFilter: "blur(12px)", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 60px", boxSizing: "border-box" }}>
        <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer" }}>
          <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "#0F172A", color: "#FFF", fontSize: "14px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>K</div>
          <span style={{ fontSize: "17px", fontWeight: "800", letterSpacing: "-0.02em", color: "#0F172A" }}>Krewby</span>
        </button>
        <button onClick={() => goTo("/login")} style={{ background: "none", border: "1.5px solid #E2E8F0", color: "#64748B", padding: "8px 18px", borderRadius: "9px", fontWeight: "600", fontSize: "14px", cursor: "pointer" }}>
          Log in
        </button>
      </nav>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
        <div style={{ width: "100%", maxWidth: "480px" }}>

          {/* Back */}
          <button onClick={() => goTo("/get-started")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
            ← Back to options
          </button>

          {/* Header */}
          <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", border: "1px solid #E2E8F0", boxShadow: "0 4px 24px rgba(15,23,42,0.06)" }}>
            <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px", marginBottom: "20px" }}>🏢</div>
            <h1 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em", marginBottom: "8px" }}>Register your business</h1>
            <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.65, marginBottom: "32px" }}>
              Set up your Krewby account as a business owner. You'll be able to add outlets, invite staff, and start building schedules right away.
            </p>

            {error && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <Field label="Business name" id="business_name" value={form.business_name} onChange={set("business_name")} placeholder="e.g. The Daily Grind Café" />
              <Field label="Your name" id="owner_name" value={form.owner_name} onChange={set("owner_name")} placeholder="Full name" />
              <Field label="Work email" id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" />
              <Field label="Phone number" id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+65 9123 4567" required={false} hint="Optional — for account recovery" />

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
                  Password<span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showPw ? "text" : "password"}
                    value={form.password}
                    onChange={set("password")}
                    placeholder="At least 6 characters"
                    required
                    style={{ width: "100%", padding: "11px 40px 11px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", background: "#fff" }}
                  />
                  <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "13px" }}>
                    {showPw ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <Field label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" />

              <button
                type="submit"
                disabled={loading}
                style={{ width: "100%", padding: "14px", background: loading ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", marginTop: "8px", transition: "background 0.15s" }}
              >
                {loading ? "Creating account…" : "Register business →"}
              </button>

              <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
                By registering you agree to Krewby's terms of service. Your account will be set up as an Outlet Manager.
              </p>
            </form>
          </div>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "13px", color: "#64748B" }}>
            Already have an account?{" "}
            <button onClick={() => goTo("/login")} style={{ background: "none", border: "none", color: "#2563EB", fontWeight: "700", cursor: "pointer", fontSize: "13px" }}>Log in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
