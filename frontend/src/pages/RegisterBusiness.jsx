import { useState } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";
import { Check, UtensilsCrossed, ShoppingBag, Stethoscope, Code2, Package, Sparkles, BookOpen, Hotel, Building2 } from "lucide-react";
import { Pricing } from "../components/Pricing";

const PLANS = [
  {
    key: "free",
    name: "FREE",
    label: "Free",
    price: "0",
    yearlyPrice: "0",
    period: "/ month",
    tagline: "Get started at no cost",
    accent: "#64748B",
    accentLight: "#F8FAFC",
    isPopular: false,
    buttonText: "Start for free",
    description: "No credit card required",
    features: [
      "1 outlet",
      "Up to 20 staff",
      "Shift scheduling",
      "Leave & swap requests",
      "Basic reports",
    ],
  },
  {
    key: "premium",
    name: "PREMIUM",
    label: "Premium",
    price: "60",
    yearlyPrice: "48",
    period: "/ month",
    tagline: "For growing businesses",
    accent: "#2563EB",
    accentLight: "#EFF6FF",
    isPopular: true,
    buttonText: "Get Premium",
    description: "Billed monthly, cancel anytime",
    features: [
      "1 outlet",
      "Unlimited staff",
      "Everything in Free",
      "Advanced reports",
      "AI scheduling assistant",
      "Priority email support",
    ],
  },
  {
    key: "enterprise",
    name: "ENTERPRISE",
    label: "Enterprise",
    price: "120",
    yearlyPrice: "96",
    period: "/ month",
    tagline: "For multi-outlet operations",
    accent: "#7C3AED",
    accentLight: "#F5F3FF",
    isPopular: false,
    buttonText: "Contact us",
    description: "Custom onboarding included",
    features: [
      "Up to 2 businesses",
      "Unlimited outlets",
      "Unlimited staff",
      "Everything in Premium",
      "Dedicated account manager",
      "Custom onboarding",
      "SLA & priority support",
    ],
  },
];

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

function TextArea({ label, id, value, onChange, placeholder, required = false, hint }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "18px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>
        {label}{required && <span style={{ color: "#EF4444", marginLeft: "3px" }}>*</span>}
      </label>
      <textarea
        id={id} value={value} onChange={onChange} placeholder={placeholder} required={required} rows={3}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1.5px solid ${focused ? "#2563EB" : "#E2E8F0"}`, boxShadow: focused ? "0 0 0 3px rgba(37,99,235,0.1)" : "none", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s", background: "#fff", resize: "vertical", fontFamily: "inherit" }}
      />
      {hint && <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "5px" }}>{hint}</p>}
    </div>
  );
}

export default function RegisterBusiness() {
  const goTo = useGoTo();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name: "", description: "", owner_name: "", email: "",
    phone: "", address: "", password: "", confirm: "",
  });
  const [plan, setPlan] = useState("free");
  const [industry, setIndustry] = useState("");
  const [schedulingMode, setSchedulingMode] = useState("");
  const [locationLabel, setLocationLabel] = useState("Outlet");
  const [staffLabel, setStaffLabel] = useState("Staff");
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [customSkill, setCustomSkill] = useState("");
  const [catalogSkills, setCatalogSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  const SKILL_SUGGESTIONS = {
    "f&b":         ["Service Staff","Kitchen Staff","Barista","Cashier","Delivery Rider","Chef","Waiter/Waitress","Food Safety Certified"],
    "retail":      ["Sales Associate","Cashier","Visual Merchandiser","Stock Control","Security","Customer Service","Store Supervisor"],
    "healthcare":  ["Registered Nurse","Medical Assistant","Receptionist","Phlebotomist","Radiographer","Pharmacist","Doctor","First Aid Certified"],
    "tech":        ["Frontend Developer","Backend Developer","DevOps Engineer","AI Engineer","Data Scientist","UI/UX Designer","Product Manager","QA Engineer","Mobile Developer","Cloud Architect"],
    "logistics":   ["Forklift Operator","Dispatcher","Warehouse Associate","Delivery Driver","Quality Inspector","Hazmat Certified","Inventory Manager","Loading Supervisor"],
    "beauty":      ["Massage Therapist","Nail Technician","Aesthetician","Hair Stylist","Makeup Artist","Lash Technician","Waxing Specialist","Spa Therapist"],
    "education":   ["Math Tutor","Science Tutor","English Teacher","Programming Instructor","Art Teacher","Music Teacher","Language Coach","Special Needs Educator"],
    "hospitality": ["Front Desk","Concierge","Housekeeping","F&B Staff","Security","Bellboy","Event Coordinator","Night Auditor"],
    "other":       ["Manager","Supervisor","Team Lead","Administrative Staff","Customer Service","Technical Support","Operations Staff"],
  };

  const INDUSTRIES = [
    { key:"f&b",         label:"Food & Beverage",      Icon:UtensilsCrossed, color:"#F59E0B", bg:"#FFFBEB", mode:"shift",       locLabel:"Outlet",    staffLabel:"Staff" },
    { key:"retail",      label:"Retail",               Icon:ShoppingBag,     color:"#3B82F6", bg:"#EFF6FF", mode:"shift",       locLabel:"Store",     staffLabel:"Staff" },
    { key:"healthcare",  label:"Healthcare / Clinic",  Icon:Stethoscope,     color:"#EF4444", bg:"#FEF2F2", mode:"shift",       locLabel:"Clinic",    staffLabel:"Staff" },
    { key:"tech",        label:"Technology / Agency",  Icon:Code2,           color:"#6366F1", bg:"#EEF2FF", mode:"flexible",    locLabel:"Team",      staffLabel:"Employees" },
    { key:"logistics",   label:"Logistics / Warehouse",Icon:Package,         color:"#F97316", bg:"#FFF7ED", mode:"shift",       locLabel:"Warehouse", staffLabel:"Staff" },
    { key:"beauty",      label:"Beauty & Wellness",    Icon:Sparkles,        color:"#EC4899", bg:"#FDF2F8", mode:"appointment", locLabel:"Branch",    staffLabel:"Therapists" },
    { key:"education",   label:"Education / Tuition",  Icon:BookOpen,        color:"#10B981", bg:"#ECFDF5", mode:"appointment", locLabel:"Centre",    staffLabel:"Tutors" },
    { key:"hospitality", label:"Hospitality / Hotels", Icon:Hotel,           color:"#8B5CF6", bg:"#F5F3FF", mode:"shift",       locLabel:"Property",  staffLabel:"Staff" },
    { key:"other",       label:"Other",                Icon:Building2,       color:"#64748B", bg:"#F8FAFC", mode:"shift",       locLabel:"Location",  staffLabel:"Staff" },
  ];
  const MODE_INFO = {
    shift:       { label:"Shift Mode",       color:"#4F46E5", desc:"Fixed time blocks with defined start/end times. Best for F&B, Retail, Healthcare." },
    flexible:    { label:"Flexible Mode",    color:"#7C3AED", desc:"Staff log their own hours against a weekly target. Best for Tech and Agencies." },
    appointment: { label:"Appointment Mode", color:"#059669", desc:"Schedule built around customer bookings. Best for Beauty, Clinics, Education." },
  };

  function set(key) { return e => setForm(p => ({ ...p, [key]: e.target.value })); }

  function handleNextStep(e) {
    e.preventDefault();
    setError("");
    const emailOk = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(form.email);
    if (!emailOk) { setError("Please enter a valid email address (e.g. you@example.com)."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setStep(2);
  }

  function handleIndustrySelect(ind) {
    setIndustry(ind.key);
    setSchedulingMode(ind.mode);
    setLocationLabel(ind.locLabel);
    setStaffLabel(ind.staffLabel);
    setSelectedSkills([]);
    // Fetch catalog skills for this industry
    api.get(`/api/catalog/skills?industry=${ind.key}`)
      .then(r => setCatalogSkills(r.skills || []))
      .catch(() => setCatalogSkills([]));
  }

  async function handleSubmit() {
    setError("");
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
        plan,
        industry: industry || "f&b",
        scheduling_mode: schedulingMode || "shift",
        location_label: locationLabel || "Outlet",
        staff_label: staffLabel || "Staff",
        skills: selectedSkills,
      });
      if (res.success) {
        setUser({ ...res.user, token: res.token });
        goTo("/business-owner/dashboard");
      } else {
        setError(res.message || "Registration failed.");
        setStep(1);
      }
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setStep(1);
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

          <h1 style={{ fontSize: "30px", fontWeight: "800", lineHeight: 1.25, letterSpacing: "-0.02em", marginBottom: "12px", transition:"all 0.3s ease" }}>
            {step === 1 ? "Set up your business on Krewby" : step === 2 ? "Tell us about your business" : step === 3 ? "Build your skills library" : "Choose a plan that fits"}
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: "340px", transition:"all 0.3s ease" }}>
            {step === 1
              ? "Create your Business Owner account, then invite managers and start building schedules."
              : step === 2
              ? "Krewby adapts its scheduling tools, labels, and AI rules based on your industry."
              : step === 3
              ? "Pick the skills your team needs. These power AI scheduling and staff assignment."
              : "Start free and upgrade anytime. No credit card required for the Free plan."}
          </p>

          {/* Step indicators */}
          <div style={{ marginTop: "48px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              { n: 1, label: "Business details" },
              { n: 2, label: "Industry & mode" },
              { n: 3, label: "Skills setup" },
              { n: 4, label: "Choose your plan" },
            ].map(({ n, label }) => {
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
      <div style={{ flex: 1, background: "#F8FAFC", overflowY: "auto", height: "100vh", display:"flex", flexDirection:"column" }}>
        <div key={step} style={{ flex:1, display:"flex", flexDirection:"column", maxWidth: step === 4 ? "900px" : step === 2 ? "100%" : "560px", margin: "0 auto", width:"100%", padding: step === 2 ? "0" : "52px 40px 80px", transition: "max-width 0.3s ease", animation: "pageSlideUp 0.22s cubic-bezier(0.34,1.56,0.64,1) both" }}>

          {step === 1 && (
            <>
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

              <form onSubmit={handleNextStep}>
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
                  Next — Choose a plan →
                </button>

                <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "16px", lineHeight: 1.6 }}>
                  By registering you agree to Krewby's terms of service.
                </p>
              </form>
            </>
          )}

          {step === 2 && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"36px 48px 0", animation:"pageSlideUp 0.22s ease both" }}>
              {/* Top bar */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"28px" }}>
                <button onClick={() => setStep(1)} style={{ display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",color:"#64748B",fontSize:"13px",fontWeight:"600",cursor:"pointer",padding:"0" }}>
                  ← Back
                </button>
                <div style={{ textAlign:"center" }}>
                  <h2 style={{ fontSize:"20px",fontWeight:"800",color:"#0F172A",marginBottom:"2px" }}>What type of business?</h2>
                  <p style={{ fontSize:"12px",color:"#94A3B8" }}>Select your industry — Krewby adapts everything to match.</p>
                </div>
                <div style={{ width:"60px" }}/>{/* spacer */}
              </div>

              {/* Full-screen industry grid */}
              <div style={{ flex:1, display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"12px", marginBottom:"20px" }}>
                {INDUSTRIES.map(ind => {
                  const active = industry === ind.key;
                  const modeColors = { shift:"#4F46E5", flexible:"#7C3AED", appointment:"#059669" };
                  const modeColor  = modeColors[ind.mode] || "#4F46E5";
                  const modeLabel  = { shift:"Shift scheduling", flexible:"Flexible timesheets", appointment:"Appointment booking" };
                  return (
                    <button key={ind.key} onClick={() => handleIndustrySelect(ind)}
                      style={{
                        borderRadius:"16px",
                        border:`2px solid ${active ? ind.color : "#E8EDF5"}`,
                        background: active ? ind.bg : "#fff",
                        cursor:"pointer",
                        textAlign:"left",
                        padding:"24px 20px",
                        display:"flex",
                        flexDirection:"column",
                        gap:"0",
                        boxShadow: active
                          ? `0 0 0 3px ${ind.color}25, 0 8px 24px rgba(0,0,0,0.08)`
                          : "0 1px 4px rgba(0,0,0,0.04)",
                        transform: active ? "translateY(-3px)" : "none",
                        transition:"all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
                        position:"relative",
                        overflow:"hidden",
                      }}>
                      {/* Top colour stripe when active */}
                      {active && (
                        <div style={{ position:"absolute",top:0,left:0,right:0,height:"4px",background:ind.color,borderRadius:"16px 16px 0 0" }}/>
                      )}
                      {/* Icon circle */}
                      <div style={{ width:"52px",height:"52px",borderRadius:"14px",background:active?ind.color:`${ind.color}15`,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"14px",transition:"all 0.2s",flexShrink:0 }}>
                        <ind.Icon size={24} color={active?"#fff":ind.color} strokeWidth={1.8}/>
                      </div>
                      {/* Label */}
                      <div style={{ fontSize:"14px",fontWeight:"800",color:active?ind.color:"#1E293B",marginBottom:"4px",lineHeight:1.3 }}>{ind.label}</div>
                      {/* Mode tag */}
                      <div style={{ display:"flex",alignItems:"center",gap:"4px",marginTop:"auto",paddingTop:"10px" }}>
                        <div style={{ width:"6px",height:"6px",borderRadius:"50%",background:active?modeColor:"#CBD5E1",flexShrink:0 }}/>
                        <span style={{ fontSize:"10px",fontWeight:"600",color:active?modeColor:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px" }}>
                          {modeLabel[ind.mode]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Bottom bar: preview + continue */}
              <div style={{ borderTop:"1px solid #E8EDF5", padding:"16px 0 28px", display:"flex", alignItems:"center", gap:"16px" }}>
                {/* Labels preview */}
                {industry ? (
                  <div style={{ display:"flex",gap:"0",flex:1,background:"#F8FAFC",borderRadius:"10px",border:"1px solid #E8EDF5",overflow:"hidden",animation:"pageSlideUp 0.18s ease" }}>
                    {[
                      { label:"Locations", val:locationLabel },
                      { label:"Staff",     val:staffLabel },
                      { label:"Schedule",  val:schedulingMode==="shift"?"Shifts":schedulingMode==="flexible"?"Timesheets":"Appointments" },
                    ].map((item,i) => (
                      <div key={item.label} style={{ flex:1,textAlign:"center",padding:"8px 12px",borderRight:i<2?"1px solid #E8EDF5":"none" }}>
                        <div style={{ fontSize:"9px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"2px" }}>{item.label}</div>
                        <div style={{ fontSize:"13px",fontWeight:"800",color:"#1E293B" }}>{item.val}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ flex:1,fontSize:"12px",color:"#94A3B8" }}>Select an industry above to continue.</p>
                )}

                {error && <p style={{ color:"#DC2626",fontSize:"12px",padding:"8px 12px",background:"#FEF2F2",borderRadius:"8px",border:"1px solid #FECACA",flexShrink:0 }}>{error}</p>}

                <button
                  onClick={() => { if (!industry) { setError("Please select your industry."); return; } setError(""); setStep(3); }}
                  style={{ padding:"12px 28px",borderRadius:"10px",border:"none",background:industry?"linear-gradient(135deg,#4F46E5,#7C3AED)":"#E2E8F0",color:industry?"#fff":"#94A3B8",fontSize:"14px",fontWeight:"700",cursor:industry?"pointer":"not-allowed",boxShadow:industry?"0 4px 14px rgba(99,102,241,0.35)":"none",whiteSpace:"nowrap",flexShrink:0 }}>
                  Continue →
                </button>
              </div>
            </div>
          )}

          {step === 3 && (() => {
            const ind = INDUSTRIES.find(i => i.key === industry);
            const indColor = ind?.color || "#6366F1";
            function toggleSkill(s) {
              setSelectedSkills(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
            }
            function addCustom() {
              const t = customSkill.trim();
              if (t && !selectedSkills.includes(t)) { setSelectedSkills(prev => [...prev, t]); }
              setCustomSkill("");
            }
            return (
              <div style={{ animation:"pageSlideUp 0.22s ease both" }}>
                <button onClick={() => setStep(2)} style={{ display:"flex",alignItems:"center",gap:"6px",background:"none",border:"none",color:"#64748B",fontSize:"13px",fontWeight:"600",cursor:"pointer",marginBottom:"24px",padding:"0" }}>← Back</button>

                <h2 style={{ fontSize:"22px",fontWeight:"800",color:"#0F172A",marginBottom:"4px" }}>What skills does your team need?</h2>
                <p style={{ fontSize:"13px",color:"#64748B",marginBottom:"24px",lineHeight:1.6 }}>
                  Select or add the skills relevant to <strong>{ind?.label || "your business"}</strong>. You can add or remove more later.
                </p>

                {/* Catalog skills grid */}
                <div style={{ marginBottom:"20px" }}>
                  <p style={{ fontSize:"11px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>
                    Skills for {ind?.label} ({catalogSkills.length})
                  </p>
                  {catalogSkills.length === 0 ? (
                    <p style={{ fontSize:"12px",color:"#CBD5E1",fontStyle:"italic" }}>Loading suggestions…</p>
                  ) : (
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:"8px" }}>
                      {catalogSkills.map(s => {
                        const on = selectedSkills.includes(s.name);
                        return (
                          <button key={s.skill_id} onClick={() => toggleSkill(s.name)}
                            style={{ padding:"10px 12px",borderRadius:"10px",border:`1.5px solid ${on?indColor:"#E2E8F0"}`,background:on?`${indColor}10`:"#fff",cursor:"pointer",textAlign:"left",transition:"all 0.15s",boxShadow:on?`0 0 0 2px ${indColor}25`:"none" }}>
                            <div style={{ display:"flex",alignItems:"center",gap:"6px",marginBottom:"2px" }}>
                              <div style={{ width:"14px",height:"14px",borderRadius:"4px",border:`1.5px solid ${on?indColor:"#CBD5E1"}`,background:on?indColor:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                                {on && <span style={{ color:"#fff",fontSize:"8px",fontWeight:"900",lineHeight:1 }}>✓</span>}
                              </div>
                              <span style={{ fontSize:"12px",fontWeight:"700",color:on?indColor:"#1E293B" }}>{s.name}</span>
                            </div>
                            {s.description && <div style={{ fontSize:"10px",color:"#94A3B8",paddingLeft:"20px",lineHeight:1.4 }}>{s.description}</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom skill input */}
                <div style={{ marginBottom:"24px" }}>
                  <p style={{ fontSize:"11px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>Add a custom skill</p>
                  <div style={{ display:"flex",gap:"8px" }}>
                    <input
                      value={customSkill}
                      onChange={e => setCustomSkill(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
                      placeholder="e.g. Kubernetes, Sign Language, HACCP…"
                      style={{ flex:1,padding:"10px 14px",borderRadius:"10px",border:"1.5px solid #E2E8F0",fontSize:"13px",color:"#1E293B",outline:"none",background:"#fff",fontFamily:"inherit" }}/>
                    <button onClick={addCustom} disabled={!customSkill.trim()}
                      style={{ padding:"10px 18px",borderRadius:"10px",border:"none",background:customSkill.trim()?indColor:"#E2E8F0",color:customSkill.trim()?"#fff":"#94A3B8",fontSize:"13px",fontWeight:"700",cursor:customSkill.trim()?"pointer":"not-allowed" }}>
                      + Add
                    </button>
                  </div>
                </div>

                {/* Selected skills */}
                {selectedSkills.length > 0 && (
                  <div style={{ padding:"16px",borderRadius:"12px",background:"#F8FAFC",border:"1px solid #E8EDF5",marginBottom:"24px" }}>
                    <p style={{ fontSize:"11px",fontWeight:"700",color:"#94A3B8",textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"10px" }}>
                      Selected ({selectedSkills.length})
                    </p>
                    <div style={{ display:"flex",flexWrap:"wrap",gap:"6px" }}>
                      {selectedSkills.map(s => (
                        <span key={s} style={{ display:"inline-flex",alignItems:"center",gap:"6px",padding:"6px 12px",borderRadius:"100px",background:indColor,color:"#fff",fontSize:"12px",fontWeight:"600" }}>
                          {s}
                          <button onClick={() => toggleSkill(s)} style={{ background:"none",border:"none",color:"rgba(255,255,255,0.8)",cursor:"pointer",fontSize:"14px",lineHeight:1,padding:"0" }}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display:"flex",gap:"10px" }}>
                  <button onClick={() => { setStep(4); }} style={{ flex:"0 0 auto",padding:"12px 20px",borderRadius:"10px",border:"1.5px solid #E2E8F0",background:"#fff",fontSize:"13px",fontWeight:"600",color:"#64748B",cursor:"pointer" }}>
                    Skip for now
                  </button>
                  <button onClick={() => setStep(4)}
                    style={{ flex:1,padding:"12px",borderRadius:"10px",border:"none",background:`linear-gradient(135deg,#4F46E5,#7C3AED)`,color:"#fff",fontSize:"14px",fontWeight:"700",cursor:"pointer",boxShadow:"0 4px 14px rgba(99,102,241,0.35)" }}>
                    Continue {selectedSkills.length > 0 ? `with ${selectedSkills.length} skill${selectedSkills.length>1?"s":""}` : ""} →
                  </button>
                </div>
              </div>
            );
          })()}

          {step === 4 && (
            <>
              <button onClick={() => setStep(3)} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" }}>
                ← Back to details
              </button>

              <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "4px" }}>Choose your plan</h2>
              <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "28px" }}>Start free and upgrade anytime as your business grows.</p>

              {error && (
                <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" }}>
                  {error}
                </div>
              )}

              <Pricing plans={PLANS} onSelect={setPlan} selectedKey={plan} />

              <button onClick={handleSubmit} disabled={loading}
                style={{ width: "100%", padding: "14px", marginTop: "28px", background: loading ? "#93C5FD" : PLANS.find(p => p.key === plan)?.accent || "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
                {loading ? "Creating account…" : `Get started with ${PLANS.find(p => p.key === plan)?.label} →`}
              </button>

              <p style={{ textAlign: "center", fontSize: "12px", color: "#94A3B8", marginTop: "14px", lineHeight: 1.6 }}>
                No credit card required for Free. Paid plans are billed monthly.
              </p>
            </>
          )}

        </div>
      </div>
    </div>
  );
}

const s = {
  sectionLabel: { fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px", marginTop: "4px" },
};
