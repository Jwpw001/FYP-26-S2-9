import { useState } from "react";

function Field({ label, id, type = "text", value, onChange, placeholder, required = true, hint, half }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px", ...(half ? { flex: 1 } : {}) }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "20px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <input
        id={id} type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`, boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none", fontSize: "21px", color: "#0F172A", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s", background: "#fff" }}
      />
      {hint && <p style={{ fontSize: "19px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

function TextArea({ label, id, value, onChange, placeholder, required = false, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "20px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <textarea
        id={id} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={3}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`, boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none", fontSize: "21px", color: "#0F172A", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s", background: "#fff", resize: "vertical", fontFamily: "inherit" }}
      />
      {hint && <p style={{ fontSize: "19px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function StepBusinessInfo({ form, set, error, onNext, onBack }) {
  function handleSubmit(e) {
    e.preventDefault();
    onNext();
  }

  return (
    <>
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "20px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
        ← Back to options
      </button>

      <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Create a business</h2>
      <p style={{ fontSize: "21px", color: "#64748B", marginBottom: "28px" }}>Tell us about your business so we can set things up.</p>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "20px", color: "#DC2626" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <Field label="Business name" id="business_name" value={form.business_name} onChange={set("business_name")} placeholder="e.g. The Daily Grind Café" />
        <Field label="Business address" id="address" value={form.address} onChange={set("address")} placeholder="Street, city, postcode" required={false} />
        <TextArea label="Business description" id="description" value={form.description} onChange={set("description")} placeholder="What does your business do?" hint="Optional — shown on your business profile" />

        <button type="submit" style={{ width: "100%", padding: "14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "22px", fontWeight: "700", cursor: "pointer", marginTop: "8px", transition: "background 0.15s" }}>
          Next — Your account →
        </button>
      </form>
    </>
  );
}
