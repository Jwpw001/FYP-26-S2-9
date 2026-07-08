import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";
import { Check, SkipForward } from "lucide-react";
import { SG_HOLIDAYS } from "../data/sgHolidays";
import StepBusinessInfo from "../components/registration/StepBusinessInfo";
import StepAccountCreate from "../components/registration/StepAccountCreate";
import StepBusinessSetup from "../components/registration/StepBusinessSetup";
import StepWorkforceRoles from "../components/registration/StepWorkforceRoles";
import StepAllocationPrefs from "../components/registration/StepAllocationPrefs";

const STEPS = [
  { n: 1, label: "Create a business", optional: false },
  { n: 2, label: "Your account", optional: false },
  { n: 3, label: "Business setup", optional: true },
  { n: 4, label: "Workforce roles", optional: true },
  { n: 5, label: "Smart allocation", optional: true },
];

export default function RegisterBusiness() {
  const goTo = useGoTo();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name: "", description: "", address: "",
    owner_name: "", email: "", phone: "", password: "", confirm: "",
    operating_days: [1, 1, 1, 1, 1, 0, 0],
    open_time: "09:00", close_time: "18:00",
    holidays: SG_HOLIDAYS.map(h => ({ ...h })),
    work_hours_day: 8, max_work_hours_day: 12, max_consecutive_days: 6,
    allow_overtime: false, min_workers_per_assignment: 1,
    business_roles: [],
    weight_availability: 40, weight_skills: 30,
    weight_attendance: 15, weight_performance: 10, weight_workload: 5,
  });
  const [skipped, setSkipped] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }
  function setField(key, value) { setForm(p => ({ ...p, [key]: value })); }

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

  function skipStep(n) {
    setSkipped(p => ({ ...p, [n]: true }));
    goStep(n + 1);
  }

  async function handleSubmit() {
    setError("");
    setLoading(true);

    const operatingDays = form.operating_days.join("");

    const payload = {
      business_name: form.business_name,
      description: form.description,
      owner_name: form.owner_name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      password: form.password,
    };

    if (!skipped[3]) {
      payload.business_settings = {
        operating_days: operatingDays,
        open_time: form.open_time,
        close_time: form.close_time,
        holidays: form.holidays,
        work_hours_day: form.work_hours_day,
        max_work_hours_day: form.max_work_hours_day,
        max_consecutive_days: form.max_consecutive_days,
        allow_overtime: form.allow_overtime,
        min_workers_per_assignment: form.min_workers_per_assignment,
      };
    }

    if (!skipped[4] && form.business_roles.length > 0) {
      payload.business_roles = form.business_roles;
    }

    if (!skipped[5]) {
      payload.allocation_preferences = {
        weight_availability: form.weight_availability,
        weight_skills: form.weight_skills,
        weight_attendance: form.weight_attendance,
        weight_performance: form.weight_performance,
        weight_workload: form.weight_workload,
      };
    }

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
            <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: "#fff", color: "#1E3A8A", fontSize: "15px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center" }}>K</div>
            <span style={{ fontSize: "18px", fontWeight: "800", letterSpacing: "-0.02em", color: "#fff" }}>Krewby</span>
          </button>

          <h1 style={{ fontSize: "32px", fontWeight: "800", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Set up your business on Krewby
          </h1>
          <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, maxWidth: "380px" }}>
            Create your Business Owner account, then add branches, invite managers, and start building schedules across your whole operation.
          </p>

          {/* Step indicators */}
          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {STEPS.map(({ n, label, optional }) => {
              const done = step > n;
              const active = step === n;
              const wasSkipped = skipped[n];
              return (
                <div key={n} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: done ? (wasSkipped ? "rgba(255,255,255,0.15)" : "#fff") : active ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)", border: active ? "2px solid #fff" : "2px solid transparent", transition: "all 0.2s" }}>
                    {done
                      ? wasSkipped
                        ? <SkipForward size={12} color="rgba(255,255,255,0.7)" />
                        : <Check size={14} color="#1E40AF" strokeWidth={3} />
                      : <span style={{ fontSize: "13px", fontWeight: "700", color: active ? "#fff" : "rgba(255,255,255,0.5)" }}>{n}</span>
                    }
                  </div>
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: active ? "700" : "500", color: active ? "#fff" : done ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)", transition: "color 0.2s" }}>{label}</span>
                    {optional && <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", marginLeft: "6px" }}>optional</span>}
                  </div>
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
              form={form} set={set} error={error}
              onNext={() => { if (validateStep2()) goStep(3); }}
              onBack={() => goStep(1)}
            />
          )}

          {step === 3 && (
            <StepBusinessSetup
              form={form} set={set} setField={setField} error={error}
              onNext={() => goStep(4)}
              onSkip={() => skipStep(3)}
              onBack={() => goStep(2)}
            />
          )}

          {step === 4 && (
            <StepWorkforceRoles
              form={form} setField={setField} error={error}
              onNext={() => {
                if (form.business_roles.length > 0 && form.business_roles.length < 3) {
                  setError("Please add at least 3 roles, or skip this step.");
                  return;
                }
                goStep(5);
              }}
              onSkip={() => skipStep(4)}
              onBack={() => goStep(3)}
            />
          )}

          {step === 5 && (
            <StepAllocationPrefs
              form={form} setField={setField} error={error} loading={loading}
              onSubmit={() => {
                const total = form.weight_availability + form.weight_skills + form.weight_attendance + form.weight_performance + form.weight_workload;
                if (total !== 100) { setError("Allocation weights must sum to 100%."); return; }
                handleSubmit();
              }}
              onSkip={() => { skipStep(5); handleSubmit(); }}
              onBack={() => goStep(4)}
            />
          )}

        </div>
      </div>
    </div>
  );
}
