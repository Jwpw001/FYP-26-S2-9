import { useState, useEffect, useRef } from "react";
import { useGoTo } from "../components/PageTransition";
import { api } from "../lib/api";
import { setUser } from "../utils/auth";

if (typeof document !== "undefined" && !document.getElementById("join-styles")) {
  const tag = document.createElement("style");
  tag.id = "join-styles";
  tag.textContent = `
    @keyframes jFadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes jFloat    { 0%,100%{transform:translateY(0px) rotate(-1deg)} 50%{transform:translateY(-12px) rotate(1deg)} }
    @keyframes jPulseRing{ 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.9);opacity:0} }
    @keyframes jSlide    { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
    @keyframes jGrad     { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes jOrb1     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-20px)} }
    @keyframes jOrb2     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,25px)} }
    @keyframes jTicker   { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
    .join-field:focus { border-color:#A78BFA !important; box-shadow:0 0 0 3px rgba(167,139,250,0.18) !important; }
    .join-submit:hover:not(:disabled) { background:#6D28D9 !important; transform:translateY(-1px); box-shadow:0 8px 24px rgba(124,58,237,0.45) !important; }
    .join-submit { transition: all 0.18s ease !important; }
    .perk-card:hover { background:rgba(124,58,237,0.12) !important; border-color:rgba(124,58,237,0.35) !important; transform:translateY(-2px); }
    .perk-card { transition: all 0.18s ease !important; }
  `;
  document.head.appendChild(tag);
}

const PERKS = [
  { icon: "📅", title: "Flexible scheduling",   desc: "Pick shifts that fit your week. No fixed hours, no long-term contracts." },
  { icon: "💰", title: "Earn on your terms",    desc: "Work as much or as little as you want — fully your choice." },
  { icon: "📍", title: "Multiple outlets",       desc: "Get matched to cafés, restaurants, and events across Singapore." },
  { icon: "⭐", title: "Build your reputation", desc: "Ratings after every shift unlock more and better opportunities." },
];

const STATS = [
  { val: "500+", label: "Shifts posted monthly" },
  { val: "4.8★", label: "Avg worker rating"     },
  { val: "Free",  label: "Always free to join"   },
];

const TICKER = ["Smart Matching","Flexible Hours","Instant Notifications","Multiple Outlets","Shift History","Skill Profiles","Rating System","Weekly Availability","Real-Time Roster"];

function InputField({ label, id, type = "text", value, onChange, placeholder, right }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ marginBottom: "16px" }}>
      <label htmlFor={id} style={{ display: "block", fontSize: "12px", fontWeight: "700", color: "#94A3B8", marginBottom: "7px", letterSpacing: "0.03em", textTransform: "uppercase" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id} type={type} value={value} onChange={onChange}
          placeholder={placeholder} required
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          className="join-field"
          style={{
            width: "100%", padding: "13px 16px", paddingRight: right ? "56px" : "16px",
            borderRadius: "12px", border: `1.5px solid ${focused ? "#A78BFA" : "rgba(255,255,255,0.1)"}`,
            fontSize: "14px", color: "#F1F5F9", outline: "none",
            boxSizing: "border-box", background: "rgba(255,255,255,0.06)",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {right && <div style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)" }}>{right}</div>}
      </div>
    </div>
  );
}

export default function JoinWorker() {
  const goTo = useGoTo();
  const [form, setForm] = useState({ full_name: "", email: "", password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [done, setDone]       = useState(false);
  const [showPw, setShowPw]   = useState(false);

  function set(k) { return e => setForm(p => ({ ...p, [k]: e.target.value })); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.password.length < 6)       { setError("Password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const res = await api.post("/api/auth/register", {
        full_name: form.full_name, email: form.email,
        password: form.password, role: "krewby_casual_worker",
      });
      if (res.data?.success) {
        setUser({ ...res.data.user, token: res.data.token });
        setDone(true);
        setTimeout(() => goTo("/krewby-worker/dashboard"), 1800);
      } else {
        setError(res.data?.message || "Registration failed.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080E1D", color: "#F1F5F9", overflowX: "hidden" }}>

      {/* ── Background orbs ── */}
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0 }}>
        <div style={{ position:"absolute", top:"-100px", left:"-100px", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle,rgba(124,58,237,0.18) 0%,transparent 65%)", animation:"jOrb1 14s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", bottom:"-80px", right:"-60px", width:"420px", height:"420px", borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.14) 0%,transparent 65%)", animation:"jOrb2 18s ease-in-out infinite" }}/>
        <div style={{ position:"absolute", top:"40%", left:"35%", width:"300px", height:"300px", borderRadius:"50%", background:"radial-gradient(circle,rgba(167,139,250,0.07) 0%,transparent 65%)" }}/>
      </div>

      {/* ── Navbar ── */}
      <nav style={{ position:"sticky", top:0, zIndex:100, height:"64px", background:"rgba(8,14,29,0.8)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 60px", boxSizing:"border-box" }}>
        <button onClick={() => goTo("/")} style={{ display:"flex", alignItems:"center", gap:"10px", background:"none", border:"none", cursor:"pointer" }}>
          <div style={{ width:"32px", height:"32px", borderRadius:"9px", background:"linear-gradient(135deg,#7C3AED,#4F46E5)", color:"#FFF", fontSize:"15px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 16px rgba(124,58,237,0.5)" }}>K</div>
          <span style={{ fontSize:"17px", fontWeight:"800", letterSpacing:"-0.02em", color:"#F1F5F9" }}>Krewby</span>
        </button>
        <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"13px", color:"#64748B" }}>Already a worker?</span>
          <button onClick={() => goTo("/login")} style={{ background:"rgba(124,58,237,0.15)", border:"1px solid rgba(124,58,237,0.3)", color:"#C4B5FD", padding:"8px 18px", borderRadius:"9px", fontWeight:"600", fontSize:"13px", cursor:"pointer" }}>
            Log in →
          </button>
        </div>
      </nav>

      {/* ── Ticker strip ── */}
      <div style={{ background:"rgba(124,58,237,0.08)", borderBottom:"1px solid rgba(124,58,237,0.15)", padding:"9px 0", overflow:"hidden", position:"relative", zIndex:1 }}>
        <div style={{ display:"flex", width:"max-content", animation:"jTicker 22s linear infinite" }}>
          {[...Array(2)].map((_,pass) => (
            <div key={pass} style={{ display:"flex" }}>
              {TICKER.map(t => (
                <span key={t} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"0 24px", fontSize:"12px", fontWeight:"600", color:"#A78BFA", whiteSpace:"nowrap" }}>
                  <span style={{ width:"4px", height:"4px", borderRadius:"50%", background:"#7C3AED", flexShrink:0 }}/>
                  {t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── Main grid ── */}
      <div style={{ position:"relative", zIndex:1, maxWidth:"1160px", margin:"0 auto", padding:"72px 40px 80px", display:"grid", gridTemplateColumns:"1fr 440px", gap:"80px", alignItems:"start" }}>

        {/* LEFT ── */}
        <div style={{ animation:"jFadeUp 0.6s ease both" }}>

          {/* Badge */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:"8px", background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:"100px", padding:"6px 16px 6px 10px", marginBottom:"28px" }}>
            <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#A78BFA", boxShadow:"0 0 8px #A78BFA", flexShrink:0 }}/>
            <span style={{ fontSize:"11px", fontWeight:"700", letterSpacing:"0.08em", textTransform:"uppercase", color:"#C4B5FD" }}>Krewby Worker Pool</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize:"clamp(36px,4.5vw,58px)", fontWeight:"800", lineHeight:1.07, letterSpacing:"-0.035em", color:"#F8FAFC", marginBottom:"22px" }}>
            Work F&amp;B shifts<br/>
            <span style={{ background:"linear-gradient(135deg,#A78BFA 0%,#60A5FA 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text" }}>
              on your schedule.
            </span>
          </h1>
          <p style={{ fontSize:"16px", color:"#94A3B8", lineHeight:1.8, marginBottom:"44px", maxWidth:"480px" }}>
            Join the Krewby worker pool and get matched to cafés, restaurants, and F&amp;B outlets that need extra hands. You choose when you work — no long-term contracts, no fixed hours.
          </p>

          {/* Stats row */}
          <div style={{ display:"flex", gap:"0", marginBottom:"44px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", overflow:"hidden" }}>
            {STATS.map((st, i) => (
              <div key={st.label} style={{ flex:1, padding:"20px 24px", borderRight: i < STATS.length-1 ? "1px solid rgba(255,255,255,0.07)" : "none", textAlign:"center" }}>
                <p style={{ fontSize:"22px", fontWeight:"800", color:"#F8FAFC", letterSpacing:"-0.02em", marginBottom:"4px" }}>{st.val}</p>
                <p style={{ fontSize:"11px", color:"#64748B", fontWeight:"500" }}>{st.label}</p>
              </div>
            ))}
          </div>

          {/* Perk cards */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"36px" }}>
            {PERKS.map((p, i) => (
              <div key={p.title} className="perk-card" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:"16px", padding:"22px", animation:`jFadeUp 0.6s ease ${120+i*80}ms both`, cursor:"default" }}>
                <div style={{ width:"40px", height:"40px", borderRadius:"12px", background:"rgba(124,58,237,0.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", marginBottom:"14px" }}>{p.icon}</div>
                <p style={{ fontSize:"13px", fontWeight:"700", color:"#F1F5F9", marginBottom:"6px" }}>{p.title}</p>
                <p style={{ fontSize:"12px", color:"#64748B", lineHeight:1.65 }}>{p.desc}</p>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <div style={{ background:"rgba(124,58,237,0.07)", border:"1px solid rgba(124,58,237,0.18)", borderRadius:"16px", padding:"24px", display:"flex", gap:"16px", alignItems:"flex-start" }}>
            <div style={{ width:"40px", height:"40px", borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#3B82F6)", color:"#FFF", fontWeight:"700", fontSize:"15px", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>P</div>
            <div>
              <p style={{ fontSize:"13px", color:"#C4B5FD", lineHeight:1.75, fontStyle:"italic", marginBottom:"10px" }}>
                "I pick up shifts at different cafés on weekends. The app is straightforward — I can see what's available, accept the ones that fit my schedule, and just show up."
              </p>
              <p style={{ fontSize:"12px", fontWeight:"700", color:"#A78BFA" }}>Priya N. <span style={{ color:"#475569", fontWeight:"400" }}>· Krewby Worker, Singapore</span></p>
              <div style={{ display:"flex", gap:"2px", marginTop:"6px" }}>
                {[1,2,3,4,5].map(s => <span key={s} style={{ color:"#F59E0B", fontSize:"13px" }}>★</span>)}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT ── form card */}
        <div style={{ position:"sticky", top:"84px", animation:"jSlide 0.6s ease 0.1s both" }}>
          {done ? (
            /* Success state */
            <div style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(124,58,237,0.3)", borderRadius:"24px", padding:"48px 36px", textAlign:"center" }}>
              <div style={{ position:"relative", width:"72px", height:"72px", margin:"0 auto 24px" }}>
                <div style={{ position:"absolute", inset:0, borderRadius:"50%", background:"rgba(124,58,237,0.2)", animation:"jPulseRing 1.2s ease-out forwards" }}/>
                <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center", position:"relative" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
              </div>
              <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#F1F5F9", marginBottom:"10px" }}>You're in! 🎉</h2>
              <p style={{ fontSize:"14px", color:"#64748B", lineHeight:1.7 }}>Welcome to the Krewby worker pool. Taking you to your dashboard…</p>
            </div>
          ) : (
            <div style={{ background:"linear-gradient(160deg,rgba(124,58,237,0.12) 0%,rgba(255,255,255,0.04) 100%)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:"24px", padding:"36px", backdropFilter:"blur(12px)" }}>

              {/* Card header */}
              <div style={{ marginBottom:"28px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"8px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"10px", background:"linear-gradient(135deg,#7C3AED,#4F46E5)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                  <h2 style={{ fontSize:"20px", fontWeight:"800", color:"#F1F5F9" }}>Join the worker pool</h2>
                </div>
                <p style={{ fontSize:"13px", color:"#64748B" }}>Free forever. Start picking up shifts today.</p>
              </div>

              {/* Free badge */}
              <div style={{ display:"flex", gap:"8px", marginBottom:"24px", flexWrap:"wrap" }}>
                {["✓ Free to join","✓ No commitment","✓ Instant access"].map(b => (
                  <span key={b} style={{ fontSize:"11px", fontWeight:"600", color:"#A78BFA", background:"rgba(124,58,237,0.12)", border:"1px solid rgba(124,58,237,0.2)", borderRadius:"100px", padding:"4px 10px" }}>{b}</span>
                ))}
              </div>

              {error && (
                <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:"10px", padding:"12px 14px", marginBottom:"18px", fontSize:"13px", color:"#FCA5A5", display:"flex", gap:"8px", alignItems:"center" }}>
                  <span>⚠️</span> {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <InputField label="Full name"      id="full_name" value={form.full_name} onChange={set("full_name")} placeholder="Your full name" />
                <InputField label="Email address"  id="email"     type="email" value={form.email}     onChange={set("email")}     placeholder="your@email.com" />
                <InputField label="Password"       id="password"  type={showPw ? "text" : "password"} value={form.password} onChange={set("password")} placeholder="Min. 6 characters"
                  right={<button type="button" onClick={() => setShowPw(p => !p)} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748B", fontSize:"12px", fontWeight:"600" }}>{showPw ? "Hide" : "Show"}</button>}
                />
                <InputField label="Confirm password" id="confirm" type={showPw ? "text" : "password"} value={form.confirm} onChange={set("confirm")} placeholder="Repeat password" />

                <button
                  type="submit"
                  disabled={loading}
                  className="join-submit"
                  style={{
                    width:"100%", padding:"15px", marginTop:"4px",
                    background: loading ? "#6D28D9" : "linear-gradient(135deg,#7C3AED,#4F46E5)",
                    color:"#fff", border:"none", borderRadius:"13px",
                    fontSize:"15px", fontWeight:"700", cursor: loading ? "not-allowed" : "pointer",
                    boxShadow:"0 4px 20px rgba(124,58,237,0.35)", letterSpacing:"0.01em",
                  }}
                >
                  {loading ? (
                    <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                      <span style={{ width:"14px", height:"14px", border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"#fff", borderRadius:"50%", display:"inline-block", animation:"jOrb1 0.7s linear infinite" }}/>
                      Creating your account…
                    </span>
                  ) : "Join the pool →"}
                </button>

                <p style={{ textAlign:"center", fontSize:"12px", color:"#334155", marginTop:"16px", lineHeight:1.6 }}>
                  By signing up you agree to Krewby's terms of service.<br/>No credit card required.
                </p>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
