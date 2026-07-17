import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";
import { Check } from "lucide-react";
import StepBusinessInfo from "../components/registration/StepBusinessInfo";
import StepAccountCreate from "../components/registration/StepAccountCreate";

const STEPS = [
  { n: 1, label: "Create a business", optional: false },
  { n: 2, label: "Your account", optional: false },
];

export default function RegisterBusiness() {
  const goTo = useGoTo();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name: "", description: "", address: "",
    owner_name: "", email: "", phone: "", password: "", confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  function goStep(n) { setError(""); setStep(n); }

  function validateStep1() {
    if (!form.business_name.trim()) { setError("Business name is required."); return false; }
    return true;
  }

  function validateStep2() {
    if (!form.owner_name.trim()) { setError("Your name is required."); return false; }
    const emailOk = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(form.email);
    if (!emailOk) { setError("Please enter a valid email address."); return false; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return false; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return false; }
    return true;
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    const payload = {
      business_name: form.business_name,
      description: form.description,
      owner_name: form.owner_name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      password: form.password,
    };

    try {
      const res = await api.post("/api/auth/register-business", payload);
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

      {/* Left panel */}
      <div style={{ flex: "0 0 38%", minWidth: "360px", background: "linear-gradient(160deg,#1E3A8A 0%,#1E40AF 45%,#2563EB 100%)", color: "#fff", padding: "56px 48px", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "sticky", top: 0, height: "100vh", boxSizing: "border-box" }}>
        <div>
          <button onClick={() => goTo("/")} style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", marginBottom: "64px" }}>
            <div style={{ background: "#fff", borderRadius: "9px", padding: "5px 10px", display: "inline-flex", alignItems: "center" }}>
              <img src="/krewby-logo.png" alt="Krewby" style={{ height: "22px", objectFit: "contain", display: "block" }} />
            </div>
          </button>

          <h1 style={{ fontSize: "32px", fontWeight: "800", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Set up your business on Krewby
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: "380px" }}>
            Create your Business Owner account, then add branches, invite managers, and start building schedules across your whole operation.
          </p>

          {/* Step indicators */}
          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {STEPS.map(({ n, label }) => {
              const done = step > n;
              const active = step === n;
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? "#fff" : active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)", border: active ? "2px solid #fff" : "2px solid transparent", transition: "all 0.2s" }}>
                    {done
                      ? <Check size={14} color="#1E40AF" strokeWidth={3} />
                      : <span style={{ fontSize: "13px", fontWeight: "700", color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>{n}</span>
                    }
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: active ? "700" : "500", color: active ? "#fff" : done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", transition: "color 0.2s" }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)" }}>
          Already registered?{" "}
          <button onClick={() => goTo("/login")} style={{ background: "none", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", fontSize: "12px", textDecoration: "underline" }}>Log in</button>
        </p>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: "#F8FAFC", overflowY: "auto", height: "100vh" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "56px 40px 80px" }}>

          {step === 1 && (
            <StepBusinessInfo
              form={form} set={set} error={error}
              onNext={() => { if (validateStep1()) goStep(2); }}
              onBack={() => goTo("/get-started")}
            />
          )}

          {step === 2 && (
            <StepAccountCreate
              form={form} set={set} error={error} loading={loading}
              onNext={() => { if (validateStep2()) handleSubmit(); }}
              onBack={() => goStep(1)}
            />
          )}

        </div>
      </div>
    </div>
  );
}
