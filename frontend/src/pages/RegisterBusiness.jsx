import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";

function Field({ label, id, type = "text", value, onChange, placeholder, required = true, hint, half }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px", ...(half ? { flex: 1 } : {}) }}>
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

function Row({ children }) {
  return <div style={{ display: "flex", gap: "16px" }}>{children}</div>;
}

function TextArea({ label, id, value, onChange, placeholder, required = false, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        rows={3}
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
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {hint && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function RegisterBusiness() {
  const goTo = useGoTo();
  const [form, setForm] = useState({
    business_name: "", description: "", owner_name: "", email: "",
    phone: "", address: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    const emailOk = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(form.email);
    if (!emailOk) { setError("Please enter a valid email address (e.g. you@example.com)."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register-business", {
        business_name: form.business_name,
        description: form.description,
        owner_name: form.owner_name,
        email: form.email,
        phone: form.phone,
        address: form.address,
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
    <div style={{ minHeight: "100vh", display: "flex" }}>

      {/* Left panel — branding */}
      <div style={{
        flex: "0 0 38%", minWidth: "360px", background: "linear-gradient(160deg,#1E3A8A 0%,#1E40AF 45%,#2563EB 100%)",
        color: "#fff", padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between",
        position: "sticky", top: 0, height: "100vh", boxSizing: "border-box",
      }}>
        <div>
          <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", marginBottom: "64px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "#fff", color: "#1E3A8A", fontSize: "15px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>K</div>
            <span style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em", color: "#fff" }}>Krewby</span>
          </button>

          <h1 style={{ fontSize: "32px", fontWeight: "800", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Set up your business on Krewby
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: "380px" }}>
            Create your Business Owner account, then add outlets, invite managers, and start building schedules across your whole operation.
          </p>

          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "20px" }}>
            {[
              ["🏢", "Add unlimited outlets", "Each outlet gets its own staff, shifts, and skill tags."],
              ["✉️", "Invite outlet managers", "Send a link, they accept and set up their own login."],
              ["📊", "Consolidated reports", "See staffing and shift coverage across every outlet."],
            ].map(([icon, title, desc]) => (
              <div key={title} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ fontSize: "22px", lineHeight: 1 }}>{icon}</div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#fff", marginBottom: "2px" }}>{title}</p>
                  <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", lineHeight: 1.5 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>
          Already registered?{" "}
          <button onClick={() => goTo("/login")} style={{ background: "none", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>Log in</button>
        </p>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, background: "#F8FAFC", overflowY: "auto", height: "100vh" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "56px 40px 80px" }}>
          <button onClick={() => goTo("/get-started")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
            ← Back to options
          </button>

          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Business details</h2>
          <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>Tell us about your business and create your owner account.</p>

          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <p style={s.sectionLabel}>Business</p>
            <Field label="Business name" id="business_name" value={form.business_name} onChange={set("business_name")} placeholder="e.g. The Daily Grind Café" />
            <Field label="Business address" id="address" value={form.address} onChange={set("address")} placeholder="Street, city, postcode" required={false} />
            <TextArea label="Business description" id="description" value={form.description} onChange={set("description")} placeholder="What does your business do?" hint="Optional — shown on your business profile" />

            <p style={s.sectionLabel}>Your account</p>
            <Row>
              <Field label="Your name" id="owner_name" value={form.owner_name} onChange={set("owner_name")} placeholder="Full name" half />
              <Field label="Work email" id="email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" half />
            </Row>
            <Field label="Phone number" id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+65 9123 4567" required={false} hint="Optional — for account recovery" />

            <Row>
              <div style={{ flex: 1, marginBottom: "18px" }}>
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
              <Field label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" half />
            </Row>

            <button
              type="submit"
              disabled={loading}
              style={{ width: "100%", padding: "14px", background: loading ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", marginTop: "8px", transition: "background 0.15s" }}
            >
              {loading ? "Creating account…" : "Register business →"}
            </button>

            <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
              By registering you agree to Krewby's terms of service. Your account will be set up as a Business Owner.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

const s = {
  sectionLabel: { fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px", marginTop: "4px" },
};
