import { useState } from "react";

function Field({ label, id, type = "text", value, onChange, placeholder, required = true, hint, half }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px", ...(half ? { flex: 1 } : {}) }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <input
        id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`, boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s", background: "#fff" }}
      />
      {hint && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "flex", gap: "16px" }}>{children}</div>;
}

export default function StepAccountCreate({ form, set, error, onNext, onBack }) {
  const [showPw, setShowPw] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
        ← Back
      </button>

      <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Your account</h2>
      <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>Create your Business Owner login credentials.</p>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
              <input type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="At least 6 characters" required
                style={{ width: "100%", padding: "11px 40px 11px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", background: "#fff" }} />
              <button type="button" onClick={() => setShowPw(p => !p)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: "13px" }}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <Field label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" half />
        </Row>

        <button type="submit" style={{ width: "100%", padding: "14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: "pointer", marginTop: "8px", transition: "background 0.15s" }}>
          Next — Business setup →
        </button>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
          By registering you agree to Krewby's terms of service.
        </p>
      </form>
    </>
  );
}
