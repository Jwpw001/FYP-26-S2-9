import { useEffect, useRef, useState, useCallback } from "react";
import { getUser } from "../utils/auth";
import { useGoTo } from "../components/PageTransition";
import NavHeader from "../components/NavHeader";
import { CalendarDays, Users, Star, BarChart3 } from "lucide-react";

/* ─────────────────────────────────────────────
   Hook: fade-in on scroll (IntersectionObserver)
───────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Check if already in viewport immediately (handles elements visible on first load)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

/* ─────────────────────────────────────────────
   Component: animated section wrapper
───────────────────────────────────────────── */
function Reveal({ children, delay = 0, style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(32px)", transition: `opacity 0.65s ease ${delay}ms, transform 0.65s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Component: count-up number
───────────────────────────────────────────── */
function CountUp({ end, suffix = "", duration = 1400 }) {
  const [ref, visible] = useReveal(0.1);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!visible || started.current || typeof end !== "number") return;
    started.current = true;
    const startTime = performance.now();
    function tick(now) {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(ease * end));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [visible, end, duration]);
  return <span ref={ref}>{typeof end === "number" ? val + suffix : end}</span>;
}

const ROLE_ROUTES = {
  system_admin:         "/system-admin/dashboard",
  business_owner:       "/business-owner/dashboard",
  outlet_manager:       "/outlet-manager/dashboard",
  regular_staff:        "/regular-staff/dashboard",
  outlet_casual_staff:  "/outlet-casual-staff/dashboard",
};

/* ─────────────────────────────────────────────
   SVG Icons
───────────────────────────────────────────── */
const Icon = {
  calendar: (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  users:    (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  check:    (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  bell:     (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>,
  briefcase:(c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  bar:      (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  shield:   (c="currentColor") => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  arrow: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  x:     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  tick:  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  quote: <svg width="28" height="28" viewBox="0 0 24 24" fill="#3B82F6" opacity="0.15"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>,
  plus:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  minus: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

/* ─────────────────────────────────────────────
   Weekly Roster Graphic
───────────────────────────────────────────── */
const DAYS  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const STAFF = [
  { name:"Alice T.", role:"Manager", color:"#3B82F6", bg:"rgba(59,130,246,0.15)",  shifts:[1,1,0,1,1,0,0] },
  { name:"Ben K.",   role:"Kitchen", color:"#22C55E", bg:"rgba(34,197,94,0.15)",   shifts:[1,0,1,1,0,1,0] },
  { name:"Carol M.", role:"Service", color:"#F59E0B", bg:"rgba(245,158,11,0.15)",  shifts:[0,1,1,0,1,1,1] },
  { name:"David L.", role:"Casual",  color:"#A78BFA", bg:"rgba(167,139,250,0.15)", shifts:[1,1,0,0,1,0,1] },
  { name:"Emma S.",  role:"Kitchen", color:"#22C55E", bg:"rgba(34,197,94,0.15)",   shifts:[0,0,1,1,1,1,0] },
];
function RosterGraphic() {
  const COL_W=48, ROW_H=38, LEFT=72, TOP=52;
  const W=LEFT+DAYS.length*COL_W+16, H=TOP+STAFF.length*ROW_H+48;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg"
      style={{ width:"100%", maxWidth:"680px", filter:"drop-shadow(0 24px 48px rgba(15,23,42,0.22))" }}>
      <rect width={W} height={H} rx="16" fill="#FFFFFF"/>
      <rect width={W} height="40" rx="16" fill="#F8FAFC"/>
      <rect y="30" width={W} height="10" fill="#F8FAFC"/>
      <rect y="39" width={W} height="1" fill="#E2E8F0"/>
      <text x="16" y="25" fill="#0F172A" fontSize="11" fontFamily="sans-serif" fontWeight="700">Weekly Shift Roster</text>
      <rect x={W-82} y="12" width="68" height="18" rx="9" fill="#EFF6FF"/>
      <text x={W-48} y="25" textAnchor="middle" fill="#3B82F6" fontSize="9" fontFamily="sans-serif" fontWeight="600">This week</text>
      {DAYS.map((d,i)=>(
        <g key={d}>
          <text x={LEFT+i*COL_W+COL_W/2} y={TOP-10} textAnchor="middle"
            fill={i===2?"#3B82F6":"#94A3B8"} fontSize="9" fontFamily="sans-serif"
            fontWeight={i===2?"700":"500"}>{d}</text>
          {i===2&&<circle cx={LEFT+i*COL_W+COL_W/2} cy={TOP-3} r="2.5" fill="#3B82F6"/>}
        </g>
      ))}
      {STAFF.map((_,i)=><line key={i} x1="0" y1={TOP+i*ROW_H} x2={W} y2={TOP+i*ROW_H} stroke="#F1F5F9" strokeWidth="1"/>)}
      {STAFF.map((s,ri)=>{
        const y=TOP+ri*ROW_H;
        return (
          <g key={s.name}>
            <circle cx="24" cy={y+ROW_H/2} r="12" fill={s.bg}/>
            <text x="24" y={y+ROW_H/2+4} textAnchor="middle" fill={s.color} fontSize="9" fontFamily="sans-serif" fontWeight="700">{s.name[0]}</text>
            <text x="42" y={y+ROW_H/2-3} fill="#0F172A" fontSize="8.5" fontFamily="sans-serif" fontWeight="600">{s.name}</text>
            <text x="42" y={y+ROW_H/2+8} fill="#94A3B8" fontSize="7.5" fontFamily="sans-serif">{s.role}</text>
            {s.shifts.map((on,ci)=>{
              const cx=LEFT+ci*COL_W+COL_W/2, cy2=y+ROW_H/2;
              return on?(
                <g key={ci}>
                  <rect x={cx-16} y={cy2-9} width="32" height="18" rx="5" fill={s.bg}/>
                  <rect x={cx-16} y={cy2-9} width="3" height="18" rx="1.5" fill={s.color}/>
                  <text x={cx+2} y={cy2+4} textAnchor="middle" fill={s.color} fontSize="7.5" fontFamily="sans-serif" fontWeight="600">ON</text>
                </g>
              ):(
                <text key={ci} x={cx} y={cy2+4} textAnchor="middle" fill="#E2E8F0" fontSize="11" fontFamily="sans-serif">—</text>
              );
            })}
          </g>
        );
      })}
      <rect y={TOP+STAFF.length*ROW_H+8} width={W} height="32" fill="#F8FAFC"/>
      <line x1="0" y1={TOP+STAFF.length*ROW_H+8} x2={W} y2={TOP+STAFF.length*ROW_H+8} stroke="#E2E8F0" strokeWidth="1"/>
      {[{label:"Shifts this week",val:"23",color:"#3B82F6"},{label:"Staff rostered",val:"5",color:"#22C55E"},{label:"Coverage",val:"94%",color:"#F59E0B"}].map((stat,i)=>{
        const x=20+i*((W-20)/3), sy=TOP+STAFF.length*ROW_H+28;
        return <g key={stat.label}><text x={x} y={sy} fill={stat.color} fontSize="10" fontFamily="sans-serif" fontWeight="700">{stat.val}</text><text x={x+16} y={sy} fill="#94A3B8" fontSize="8" fontFamily="sans-serif">{stat.label}</text></g>;
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Reusable: animated button
───────────────────────────────────────────── */
function Btn({ baseStyle, onClick, children }) {
  const [hov, setHov] = useState(false);
  const [press, setPress] = useState(false);
  return (
    <button
      style={{ ...baseStyle, transform: press?"scale(0.96)":hov?"scale(1.03)":"scale(1)",
        boxShadow: hov&&!press?"0 8px 24px rgba(15,23,42,0.2)":"none",
        transition:"transform 0.15s cubic-bezier(.34,1.56,.64,1),box-shadow 0.2s ease" }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setHov(false);setPress(false);}}
      onMouseDown={()=>setPress(true)} onMouseUp={()=>setPress(false)} onClick={onClick}
    >{children}</button>
  );
}

/* ─────────────────────────────────────────────
   Reusable: FAQ accordion item
───────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...s.faqItem, borderColor: open ? "#BFDBFE" : "#E2E8F0" }}>
      <button style={s.faqQ} onClick={() => setOpen(o=>!o)}>
        <span>{q}</span>
        <span style={{ color:"#64748B", flexShrink:0, transition:"transform 0.2s", transform: open?"rotate(180deg)":"rotate(0deg)" }}>
          {open ? Icon.minus : Icon.plus}
        </span>
      </button>
      {open && <p style={s.faqA}>{a}</p>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Inject keyframes at module load time
   (runs once when JS bundle loads — before any render,
    so animations are always available immediately)
───────────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("krewby-home-styles")) {
  const tag = document.createElement("style");
  tag.id = "krewby-home-styles";
  tag.textContent = `
    html { scroll-behavior: smooth; }
    @keyframes fadeOut     { from{opacity:1;transform:translateY(0)}   to{opacity:0;transform:translateY(-10px)} }
    @keyframes fadeIn      { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes float       { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-14px)} }
    @keyframes marquee     { from{transform:translateX(0)} to{transform:translateX(-50%)} }
    @keyframes gradShift   { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
    @keyframes orbDrift1   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(40px,-30px) scale(1.08)} 66%{transform:translate(-20px,20px) scale(0.95)} }
    @keyframes orbDrift2   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-35px,25px) scale(1.05)} 66%{transform:translate(25px,-15px) scale(0.97)} }
    @keyframes orbDrift3   { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,30px)} }
    @keyframes pulse       { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.4)} }
    @keyframes spin        { to{transform:rotate(360deg)} }
    @keyframes slideInLeft { from{opacity:0;transform:translateX(-40px)} to{opacity:1;transform:translateX(0)} }
    @keyframes popIn       { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
  `;
  document.head.appendChild(tag);
}

/* ─────────────────────────────────────────────
   Component: scroll-to-top button
───────────────────────────────────────────── */
function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "fixed", bottom: "32px", right: "32px", zIndex: 1001,
        width: "46px", height: "46px", borderRadius: "12px",
        background: hov ? "#1E293B" : "#0F172A",
        color: "#FFF", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 20px rgba(15,23,42,0.3)",
        transform: hov ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
      }}
      title="Back to top"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="18 15 12 9 6 15"/>
      </svg>
    </button>
  );
}

/* ─────────────────────────────────────────────
   Main Page
───────────────────────────────────────────── */
export default function Home() {
  const user = getUser();
  const goTo = useGoTo();

  function go(dest) {
    const target = dest || (user && ROLE_ROUTES[user.role] ? ROLE_ROUTES[user.role] : "/get-started");
    goTo(target);
  }
  function scroll(id) { document.getElementById(id)?.scrollIntoView({ behavior:"smooth" }); }

  return (
    <main style={{ ...s.page, animation: "fadeIn 0.4s ease both" }}>

      {/* ══ NAVBAR ══════════════════════════════════════════ */}
      <div style={s.navSpacer}/>
      <nav style={s.navbar}>
        <div style={s.navLeft}>
          <div style={s.logoMark}>K</div>
          <span style={s.logoText}>Krewby</span>
        </div>
        <NavHeader
          items={["Features", "Who it's for", "How it works", "FAQ"]}
          onSelect={label => scroll({ "Features":"features", "Who it's for":"roles", "How it works":"how", "FAQ":"faq" }[label])}
        />
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {!user && (
            <Btn baseStyle={{ ...s.navCta, background:"transparent", color:"#0F172A", border:"1.5px solid #E2E8F0", boxShadow:"none" }} onClick={()=>goTo("/get-started")}>
              Sign up
            </Btn>
          )}
          <Btn baseStyle={s.navCta} onClick={()=>user ? go() : goTo("/login")}>
            {user?"Go to dashboard":"Log in"} <span style={{marginLeft:6}}>{Icon.arrow}</span>
          </Btn>
        </div>
      </nav>


      {/* ══ HERO ════════════════════════════════════════════ */}
      <section style={s.heroWrap}>
        {/* Animated background orbs */}
        <div style={s.orb1}/>
        <div style={s.orb2}/>
        <div style={s.orb3}/>

        <div style={s.hero}>
          <div style={{ ...s.heroLeft, animation:"slideInLeft 0.7s ease both" }}>
            <span style={s.eyebrow}>Workforce Management Platform</span>
            <h1 style={s.heroTitle}>
              Stop juggling spreadsheets.<br/>
              <span style={s.heroAccent}>Run your team smarter.</span>
            </h1>
            <p style={s.heroDesc}>
              Krewby is the all-in-one workforce management platform for modern businesses.
              Schedule shifts, track attendance, manage your workforce, and streamline operations — without the chaos.
            </p>
            <div style={s.heroActions}>
              <Btn baseStyle={s.btnPrimary} onClick={()=>go()}>
                {user?"Go to dashboard":"Get started free"} <span style={{marginLeft:8}}>{Icon.arrow}</span>
              </Btn>
              <Btn baseStyle={s.btnSecondary} onClick={()=>scroll("features")}>
                See how it works
              </Btn>
            </div>
            <div style={s.trustRow}>
              {["Shift scheduling","Attendance tracking","Skill matching","Role-based access"].map(t=>(
                <div key={t} style={s.trustPill}>
                  <span style={{ ...s.trustDot, animation:"pulse 2s ease-in-out infinite" }}/>
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div style={{ ...s.heroRight, animation:"popIn 0.7s ease 0.2s both" }}>
            <div style={{ animation:"float 5s ease-in-out infinite" }}>
              <RosterGraphic/>
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══════════════════════════════════════ */}
      <div style={s.statsBar}>
        {[
          {val:100,  suffix:"+", label:"Shifts managed"},
          {val:5,    suffix:"",  label:"User role types"},
          {val:"Real-time", label:"Attendance sync"},
          {val:"1-click",  label:"Branch management"},
          {val:0,    suffix:"",  label:"Spreadsheets needed"},
        ].map((st,i,arr)=>(
          <div key={st.label} style={{ ...s.statItem, borderRight: i<arr.length-1?"1px solid rgba(255,255,255,0.08)":"none" }}>
            <span style={s.statVal}>
              <CountUp end={st.val} suffix={st.suffix||""} />
            </span>
            <span style={s.statLabel}>{st.label}</span>
          </div>
        ))}
      </div>

      {/* ══ MARQUEE STRIP ═══════════════════════════════════ */}
      <div style={s.marqueeWrap}>
        <div style={s.marqueeTrack}>
          {[...Array(2)].map((_,pass)=>(
            <div key={pass} style={s.marqueeInner}>
              {["Smart Scheduling","Attendance Tracking","Workforce Management","Role-Based Dashboards","Shift Notifications","Skill Matching","Multi-Branch Support","Live Roster","Audit Trail","Reports & Insights","Swap Requests","Leave Approvals"].map(label=>(
                <span key={label} style={s.marqueeItem}>
                  <span style={s.marqueeDot}/>
                  {label}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ══ PROBLEM / SOLUTION ═════════════════════════════ */}
      <section style={s.problemSection}>
        <div style={s.inner}>
          <Reveal>
            <div style={s.sectionHead}>
              <p style={s.sectionEyebrow}>THE PROBLEM</p>
              <h2 style={s.sectionTitle}>Workforce scheduling is broken</h2>
              <p style={s.sectionSub}>Most businesses still rely on WhatsApp groups, paper rosters, and manual spreadsheets — and it shows.</p>
            </div>
          </Reveal>
          <div style={s.compareGrid}>
            <Reveal delay={0}>
              <div style={{ ...s.compareCard, ...s.compareCardBad }}>
                <p style={s.compareCardTitle}>Without Krewby</p>
                {["Last-minute shift changes sent over WhatsApp","No visibility into who is actually working","Attendance tracked with pen and paper","Short-staffed shifts with no backup plan","Managers spending hours building rosters","No audit trail when issues arise"].map(item=>(
                  <div key={item} style={s.compareRow}><span style={s.compareIcon}>{Icon.x}</span><span style={s.compareText}>{item}</span></div>
                ))}
              </div>
            </Reveal>
            <Reveal delay={150}>
              <div style={{ ...s.compareCard, ...s.compareCardGood }}>
                <div style={s.compareCardBadge}>With Krewby</div>
                {["Instant shift notifications sent to all workers","Live roster visible to everyone on any device","Digital attendance marked per shift, per person","Skill-based worker matching for every role","Build and publish rosters in minutes","Full audit trail for every shift and change"].map(item=>(
                  <div key={item} style={s.compareRow}><span style={s.compareIcon}>{Icon.tick}</span><span style={{ ...s.compareText, color:"#0F172A" }}>{item}</span></div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════ */}
      <section id="features" style={s.featuresSection}>
        <div style={s.inner}>
          <Reveal>
            <div style={s.sectionHead}>
              <p style={s.sectionEyebrow}>FEATURES</p>
              <h2 style={s.sectionTitle}>Everything your team needs</h2>
              <p style={s.sectionSub}>Purpose-built for workforce operations — not retrofitted HR software.</p>
            </div>
          </Reveal>
          <div style={s.featureGrid}>
            {FEATURES.map((f,i)=>(
              <Reveal key={f.title} delay={i*60}>
                <FeatureCard f={f}/>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ WHO IT'S FOR ════════════════════════════════════ */}
      <section id="roles" style={s.rolesSection}>
        <div style={s.inner}>
          <Reveal>
            <div style={s.sectionHead}>
              <p style={s.sectionEyebrow}>WHO IT'S FOR</p>
              <h2 style={s.sectionTitle}>Built for every role in your operation</h2>
              <p style={s.sectionSub}>One platform, tailored experiences for every person on the team.</p>
            </div>
          </Reveal>
          <div style={s.rolesGrid}>
            {ROLES.map((r,i)=>(
              <Reveal key={r.title} delay={i*80}>
                <RoleCard r={r}/>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════ */}
      <section id="how" style={s.howSection}>
        <div style={s.inner}>
          <Reveal>
            <div style={s.sectionHead}>
              <p style={s.sectionEyebrow}>HOW IT WORKS</p>
              <h2 style={s.sectionTitle}>Up and running in minutes</h2>
              <p style={s.sectionSub}>No complicated setup. No training sessions. Your team is ready from day one.</p>
            </div>
          </Reveal>
          <div style={s.stepsRow}>
            {STEPS.map((step,i)=>(
              <Reveal key={step.title} delay={i*100}>
                <div style={s.stepCard}>
                  <div style={s.stepNum}>{i+1}</div>
                  <h3 style={s.stepTitle}>{step.title}</h3>
                  <p style={s.stepDesc}>{step.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════ */}
      <section style={s.testimonialsSection}>
        <Reveal>
          <div style={{ textAlign:"center", marginBottom:"48px" }}>
            <p style={{ ...s.sectionEyebrow, color:"rgba(255,255,255,0.35)" }}>WHAT PEOPLE SAY</p>
            <h2 style={{ ...s.sectionTitle, color:"#F8FAFC" }}>Trusted by teams everywhere</h2>
          </div>
        </Reveal>
        <TestimonialsCarousel/>
      </section>

      {/* ══ FAQ ═════════════════════════════════════════════ */}
      <section id="faq" style={s.faqSection}>
        <div style={{ ...s.inner, maxWidth:"720px" }}>
          <Reveal>
            <div style={s.sectionHead}>
              <p style={s.sectionEyebrow}>FAQ</p>
              <h2 style={s.sectionTitle}>Common questions</h2>
            </div>
          </Reveal>
          <div style={s.faqList}>
            {FAQ.map((f,i)=>(
              <Reveal key={f.q} delay={i*50}>
                <FaqItem q={f.q} a={f.a}/>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA BANNER ══════════════════════════════════════ */}
      <section style={s.ctaBanner}>
        <Reveal>
        <div style={{ ...s.inner, textAlign:"center" }}>
          <span style={{ ...s.eyebrow, background:"rgba(59,130,246,0.15)", color:"#93C5FD", border:"1px solid rgba(59,130,246,0.3)", marginBottom:"24px", display:"inline-block" }}>
            Ready to get started?
          </span>
          <h2 style={s.ctaTitle}>Your team deserves better than WhatsApp rosters.</h2>
          <p style={s.ctaDesc}>Join businesses already using Krewby to plan smarter, track better, and stress less.</p>
          <Btn baseStyle={s.ctaBtn} onClick={()=>go()}>
            {user?"Go to dashboard":"Get started for free"} <span style={{marginLeft:8}}>{Icon.arrow}</span>
          </Btn>
        </div>
        </Reveal>
      </section>

      <ScrollToTop />

      {/* ══ FOOTER ══════════════════════════════════════════ */}
      <footer id="contact" style={s.footer}>
        <div style={s.footerGrid}>
          {/* Brand */}
          <div style={s.footerBrand}>
            <div style={s.footerLogoRow}>
              <div style={s.footerLogoMark}>K</div>
              <span style={s.footerLogoText}>Krewby</span>
            </div>
            <p style={s.footerTagline}>Workforce management built for the speed and scale of modern business operations.</p>
            <p style={s.footerCopy}>© {new Date().getFullYear()} Krewby · CSIT321 FYP-26-S2-9</p>
          </div>

          {/* Product links */}
          <div>
            <p style={s.footerColTitle}>Product</p>
            {[{l:"Features",id:"features"},{l:"How it works",id:"how"},{l:"Who it's for",id:"roles"},{l:"FAQ",id:"faq"}].map(({l,id})=>(
              <a key={l} href="#" style={s.footerLink} onClick={e=>{e.preventDefault();scroll(id);}}>{l}</a>
            ))}
          </div>

          {/* Use cases */}
          <div>
            <p style={s.footerColTitle}>Use cases</p>
            {["Retail chains","Service businesses","Hospitality","Healthcare","Multi-branch teams"].map(l=>(
              <span key={l} style={s.footerStaticLink}>{l}</span>
            ))}
          </div>

          {/* Platform */}
          <div>
            <p style={s.footerColTitle}>Platform</p>
            {[{l:"Log in",fn:()=>go()},{l:"System Admin",fn:()=>go("/login")},{l:"Manager Portal",fn:()=>go("/login")},{l:"Worker Portal",fn:()=>go("/login")}].map(({l,fn})=>(
              <a key={l} href="#" style={s.footerLink} onClick={e=>{e.preventDefault();fn();}}>{l}</a>
            ))}
          </div>
        </div>
      </footer>

    </main>
  );
}

/* ─────────────────────────────────────────────
   Component: hoverable feature card
───────────────────────────────────────────── */
function FeatureCard({ f }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ ...s.featureCard, transform: hov?"translateY(-4px)":"translateY(0)", boxShadow: hov?"0 12px 32px rgba(15,23,42,0.1)":"0 1px 4px rgba(15,23,42,0.05)", transition:"transform 0.2s ease,box-shadow 0.2s ease" }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{ ...s.featureIconBox, background:f.bg, color:f.color }}>{f.icon(f.color)}</div>
      <h3 style={s.featureTitle}>{f.title}</h3>
      <p style={s.featureDesc}>{f.desc}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Component: hoverable role card
───────────────────────────────────────────── */
function RoleCard({ r }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ ...s.roleCard, transform: hov?"translateY(-4px)":"translateY(0)", boxShadow: hov?"0 12px 32px rgba(15,23,42,0.1)":"none", transition:"transform 0.2s ease,box-shadow 0.2s ease", borderColor: hov?r.color:"#E2E8F0" }}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <div style={{ ...s.roleIconBox, background:r.bg, color:r.color }}>{r.icon(r.color)}</div>
      <h3 style={s.roleTitle}>{r.title}</h3>
      <p style={s.roleDesc}>{r.desc}</p>
      <ul style={s.roleList}>
        {r.bullets.map(b=>(
          <li key={b} style={s.roleLi}><span style={s.roleLiDot}/>{b}</li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Component: auto-scrolling testimonials carousel
───────────────────────────────────────────── */
function TestimonialsCarousel() {
  const [active, setActive] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const timer = useRef(null);

  const go = useCallback((idx) => {
    setActive(idx);
    setAnimKey(k => k+1);
  }, []);

  useEffect(() => {
    timer.current = setInterval(() => {
      setActive(a => { const next=(a+1)%TESTIMONIALS.length; setAnimKey(k=>k+1); return next; });
    }, 4500);
    return () => clearInterval(timer.current);
  }, []);

  const t = TESTIMONIALS[active];
  return (
    <div style={s.carouselWrap}>
      <div key={animKey} style={{ ...s.testimonialCard, animation:"popIn 0.45s cubic-bezier(.22,1,.36,1) both", maxWidth:"640px", margin:"0 auto" }}>
        <div style={s.quoteIcon}>{Icon.quote}</div>
        <p style={s.testimonialText}>"{t.text}"</p>
        <div style={s.testimonialAuthor}>
          <div style={{ ...s.testimonialAvatar, background:t.color }}>{t.name[0]}</div>
          <div>
            <p style={s.testimonialName}>{t.name}</p>
            <p style={s.testimonialRole}>{t.role}</p>
          </div>
        </div>
      </div>
      {/* Dot indicators */}
      <div style={s.carouselDots}>
        {TESTIMONIALS.map((_,i)=>(
          <button key={i} onClick={()=>go(i)} style={{ ...s.dot, background: i===active?"#3B82F6":"rgba(255,255,255,0.2)", transform: i===active?"scale(1.3)":"scale(1)", transition:"all 0.25s ease" }}/>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Data
───────────────────────────────────────────── */
const FEATURES = [
  { icon:Icon.calendar, title:"Smart Scheduling",         color:"#2563EB", bg:"#EFF6FF", desc:"Build weekly rosters in minutes with conflict detection, availability checks, and automatic staff recommendations based on skills." },
  { icon:Icon.users,    title:"Role-Based Dashboards",    color:"#059669", bg:"#ECFDF5", desc:"Every user type — admin, business owner, manager, regular worker, casual worker — gets a dashboard built exactly for their needs." },
  { icon:Icon.check,    title:"Attendance Tracking",      color:"#D97706", bg:"#FFFBEB", desc:"Mark attendance digitally per shift. Handle last-minute no-shows, replacements, and late arrivals with a complete audit trail." },
  { icon:Icon.bell,     title:"Real-Time Notifications",  color:"#7C3AED", bg:"#F5F3FF", desc:"Push alerts for shift assignments, swap requests, leave approvals, and understaffed warnings — so nothing slips through the cracks." },
  { icon:Icon.briefcase,title:"Workforce Management",     color:"#DB2777", bg:"#FDF2F8", desc:"Manage your entire workforce from one place. Track worker availability, assign shifts by skill, and keep every branch fully staffed." },
  { icon:Icon.bar,      title:"Reports & Insights",       color:"#0891B2", bg:"#ECFEFF", desc:"Exportable attendance reports, workload breakdowns, and understaffed shift analysis so management always has the full picture." },
  { icon:Icon.shield,   title:"Skill-Based Matching",     color:"#4F46E5", bg:"#EEF2FF", desc:"Tag workers with skill sets. When building a roster, Krewby surfaces the right people for the right roles automatically." },
  { icon:Icon.users,    title:"Multi-Branch Support",     color:"#0369A1", bg:"#F0F9FF", desc:"Manage multiple branches from a single account. Each branch operates independently with shared oversight." },
];

const ROLES = [
  {
    icon: Icon.briefcase, title:"Business Owner", color:"#3B82F6", bg:"#EFF6FF",
    desc:"Full visibility and control across your branches, workers, and operations — all from one place.",
    bullets:["Register your business and branches","Appoint and manage branch managers","Access platform-wide reports","Oversee your entire workforce"],
  },
  {
    icon: Icon.users, title:"Manager", color:"#059669", bg:"#ECFDF5",
    desc:"Own the day-to-day scheduling and workforce management for your branch.",
    bullets:["Build and publish weekly rosters","Approve leave & swap requests","Mark and review attendance","Manage worker skills and assignments"],
  },
  {
    icon: Icon.calendar, title:"Regular Worker", color:"#D97706", bg:"#FFFBEB",
    desc:"See your upcoming shifts, submit availability, and manage requests — all in one place.",
    bullets:["View assigned shifts","Submit leave requests","Request shift swaps","Receive real-time notifications"],
  },
  {
    icon: Icon.check, title:"Casual Worker", color:"#7C3AED", bg:"#F5F3FF",
    desc:"View your assigned shifts, set weekly availability, and stay connected with your branch.",
    bullets:["View assigned shifts","Set weekly availability","Acknowledge shift assignments","Receive real-time notifications"],
  },
];

const STEPS = [
  { title:"Register your business",   desc:"Sign up, add your business details, branch locations, and configure your team structure in minutes." },
  { title:"Invite your team",        desc:"Managers and workers receive role-tailored access. Everyone sees exactly what they need — nothing more, nothing less." },
  { title:"Build your roster",       desc:"Create shifts, assign workers by availability and skill, then publish. Your whole team gets notified instantly." },
  { title:"Track attendance & act",  desc:"Mark attendance as shifts happen. Spot gaps, reassign workers, and export reports for management review." },
];

const TESTIMONIALS = [
  { name:"Sarah L.", role:"Branch Manager, The Daily Grind", color:"#3B82F6",
    text:"We used to spend 3 hours every Sunday building the weekly roster on Excel. Krewby cut that down to under 30 minutes. The team also stopped missing shifts because everyone actually gets a notification now." },
  { name:"Marcus T.", role:"Operations Director, Horizon Group", color:"#059669",
    text:"Managing 4 branches with different worker pools was a nightmare. Krewby gave us one place to see everything. The skill matching feature alone has saved us during peak periods more times than I can count." },
  { name:"Priya N.", role:"Regular Worker", color:"#7C3AED",
    text:"I used to find out about my shifts through group chats. Now everything is in the app — I can see my schedule, request swaps, and get notified instantly. No more back-and-forth with managers over text." },
];

const FAQ = [
  { q:"What types of businesses can use Krewby?", a:"Krewby is designed for any business that manages shift-based workers — retail, hospitality, healthcare, service businesses, and more. It scales from single-location setups to multi-branch operations." },
  { q:"How does skill-based matching work?", a:"Managers can tag workers with skill sets. When building a roster, Krewby surfaces the right people for the right roles automatically, helping you assign the best-fit workers to every shift." },
  { q:"Can workers see their schedules on their phones?", a:"Yes. Krewby is a web-based platform accessible from any device. Workers log in to their own portal to view upcoming shifts, submit leave, request swaps, and receive notifications — no app download required." },
  { q:"What happens when a worker calls in sick last minute?", a:"The manager is notified immediately. They can reassign the shift to another available worker or use skill-based matching to find a suitable replacement — all within the platform." },
  { q:"Is Krewby suitable for businesses with multiple branches?", a:"Absolutely. The business owner account provides full visibility across all branches. Each branch operates with its own manager and workers, while management retains a consolidated view and reporting access." },
  { q:"Does Krewby support different roles and permissions?", a:"Yes. There are five distinct role types: System Administrator, Business Owner, Manager, Regular Worker, and Casual Worker. Each role has a dedicated dashboard and access level." },
];

/* ─────────────────────────────────────────────
   Styles
───────────────────────────────────────────── */
const s = {
  page:     { minHeight:"100vh", background:"#F8FAFC", color:"#0F172A" },
  inner:    { maxWidth:"1100px", margin:"0 auto" },

  /* Navbar */
  navbar:   { height:"64px", background:"rgba(255,255,255,0.93)", backdropFilter:"blur(12px)", borderBottom:"1px solid #E2E8F0", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 60px", boxSizing:"border-box", position:"fixed", top:0, left:0, right:0, zIndex:1000 },
  navSpacer:{ height:"64px" },
  navLeft:  { display:"flex", alignItems:"center", gap:"10px" },
  logoMark: { width:"30px", height:"30px", borderRadius:"8px", background:"#0F172A", color:"#FFF", fontSize:"14px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center" },
  logoText: { fontSize:"17px", fontWeight:"800", letterSpacing:"-0.02em", color:"#0F172A" },
  navLinks: { display:"flex", gap:"32px" },
  navLink:  { color:"#64748B", fontSize:"14px", fontWeight:"500", textDecoration:"none" },
  navJoin:  { background:"#F5F3FF", color:"#7C3AED", border:"1.5px solid #DDD6FE", padding:"8px 16px", borderRadius:"9px", fontWeight:"600", fontSize:"13px", cursor:"pointer" },
  navCta:   { display:"flex", alignItems:"center", gap:"4px", background:"#0F172A", color:"#FFF", border:"none", padding:"9px 18px", borderRadius:"9px", fontWeight:"600", fontSize:"14px", cursor:"pointer" },

  /* Hero */
  hero:       { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"48px", padding:"88px 60px 80px", boxSizing:"border-box", maxWidth:"1200px", margin:"0 auto" },
  heroLeft:   { flex:"0 0 auto", maxWidth:"500px" },
  heroRight:  { flex:"1 1 auto", display:"flex", justifyContent:"center" },
  eyebrow:    { display:"inline-block", fontSize:"11px", fontWeight:"700", letterSpacing:"0.08em", textTransform:"uppercase", color:"#3B82F6", background:"#EFF6FF", padding:"5px 12px", borderRadius:"100px", marginBottom:"24px", border:"1px solid #BFDBFE" },
  heroTitle:  { fontSize:"clamp(34px,5vw,54px)", lineHeight:1.1, fontWeight:"800", letterSpacing:"-0.03em", color:"#0F172A", marginBottom:"20px" },
  heroAccent: { color:"#3B82F6" },
  heroDesc:   { fontSize:"16px", lineHeight:1.75, color:"#64748B", marginBottom:"36px", maxWidth:"440px" },
  heroActions:{ display:"flex", gap:"12px", flexWrap:"wrap", marginBottom:"28px" },
  btnPrimary: { display:"flex", alignItems:"center", background:"#0F172A", color:"#FFF", border:"none", padding:"13px 24px", borderRadius:"10px", fontSize:"15px", fontWeight:"700", cursor:"pointer" },
  btnSecondary:{ background:"#FFF", color:"#0F172A", border:"1.5px solid #E2E8F0", padding:"13px 24px", borderRadius:"10px", fontSize:"15px", fontWeight:"600", cursor:"pointer" },
  trustRow:   { display:"flex", gap:"16px", flexWrap:"wrap" },
  trustPill:  { display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", color:"#64748B", fontWeight:"500" },
  trustDot:   { width:"6px", height:"6px", borderRadius:"50%", background:"#22C55E", flexShrink:0 },

  /* Worker CTA */
  workerCta:        { marginBottom:"28px" },
  workerCtaDivider: { display:"flex", alignItems:"center", gap:"12px", marginBottom:"12px" },
  workerCtaLine:    { flex:1, height:"1px", background:"#E2E8F0" },
  workerCtaDividerText: { fontSize:"11px", fontWeight:"600", color:"#94A3B8", letterSpacing:"0.04em", whiteSpace:"nowrap" },
  workerCtaBtn:     { width:"100%", display:"flex", alignItems:"center", justifyContent:"space-between", background:"transparent", border:"1px solid rgba(124,58,237,0.3)", borderRadius:"12px", padding:"14px 18px", cursor:"pointer", transition:"all 0.2s ease", textAlign:"left" },
  workerCtaBtnLeft: { display:"flex", alignItems:"center", gap:"12px" },
  workerCtaIcon:    { width:"32px", height:"32px", borderRadius:"8px", background:"#F5F3FF", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  workerCtaTitle:   { display:"block", fontSize:"13px", fontWeight:"700", color:"#7C3AED", marginBottom:"2px" },
  workerCtaSub:     { display:"block", fontSize:"12px", color:"#94A3B8" },
  workerCtaArrow:   { color:"#7C3AED", flexShrink:0 },

  /* Roster card */
  rosterCard:   { position:"relative" },
  floatBadge1:  { display:"none" },
  floatBadge2:  { display:"none" },

  /* Eyebrow (new markup compat) */
  eyebrowWrap:{ display:"inline-block" },
  eyebrowDot: {},
  eyebrowText:{},

  /* Join as Worker section */
  workerSection:  { padding:"96px 60px", boxSizing:"border-box", background:"#0F172A", borderTop:"1px solid rgba(255,255,255,0.06)" },
  workerInner:    { display:"flex", alignItems:"center", gap:"72px", flexWrap:"wrap" },
  workerPerks:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"36px" },
  workerPerk:     { display:"flex", gap:"12px", alignItems:"flex-start" },
  workerPerkIcon: { fontSize:"22px", flexShrink:0 },
  workerPerkTitle:{ fontSize:"13px", fontWeight:"700", color:"#F1F5F9", marginBottom:"4px" },
  workerPerkDesc: { fontSize:"12px", color:"#64748B", lineHeight:1.6 },
  workerJoinBtn:  { display:"inline-flex", alignItems:"center", background:"#7C3AED", color:"#FFF", border:"none", padding:"13px 24px", borderRadius:"10px", fontSize:"15px", fontWeight:"700", cursor:"pointer" },
  workerCard:       { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"20px", padding:"28px", width:"320px", boxSizing:"border-box" },
  workerCardHeader: { display:"flex", alignItems:"center", gap:"12px", marginBottom:"20px" },
  workerCardAvatar: { width:"42px", height:"42px", borderRadius:"50%", background:"linear-gradient(135deg,#7C3AED,#3B82F6)", color:"#FFF", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  workerCardName:   { fontSize:"14px", fontWeight:"700", color:"#F1F5F9", marginBottom:"2px" },
  workerCardRole:   { fontSize:"11px", color:"#64748B" },
  workerCardBadge:  { marginLeft:"auto", background:"rgba(245,158,11,0.12)", color:"#F59E0B", fontSize:"12px", fontWeight:"700", padding:"4px 10px", borderRadius:"8px", flexShrink:0 },
  workerCardDivider:{ height:"1px", background:"rgba(255,255,255,0.07)", marginBottom:"16px" },
  workerCardLabel:  { fontSize:"11px", fontWeight:"700", color:"#475569", letterSpacing:"0.05em", textTransform:"uppercase", marginBottom:"12px" },
  workerShiftRow:   { display:"flex", alignItems:"center", gap:"10px", paddingBottom:"12px", marginBottom:"12px", borderBottom:"1px solid rgba(255,255,255,0.05)" },
  workerShiftOutlet:{ fontSize:"13px", fontWeight:"600", color:"#E2E8F0", marginBottom:"3px" },
  workerShiftTime:  { fontSize:"11px", color:"#475569" },
  workerShiftTag:   { fontSize:"11px", fontWeight:"700", padding:"3px 9px", borderRadius:"6px", flexShrink:0 },
  workerCardFooter: { display:"flex", gap:"16px", marginTop:"4px" },
  workerCardStat:   { fontSize:"11px", color:"#475569", fontWeight:"600" },

  /* Stats */
  statsBar:   { background:"#0F172A", display:"flex", justifyContent:"center", flexWrap:"wrap", padding:"32px 60px" },
  statItem:   { display:"flex", flexDirection:"column", alignItems:"center", padding:"0 40px" },
  statVal:    { fontSize:"26px", fontWeight:"800", color:"#F8FAFC", letterSpacing:"-0.02em" },
  statLabel:  { fontSize:"11px", color:"#64748B", marginTop:"4px", fontWeight:"500" },

  /* Problem / Solution */
  problemSection: { padding:"96px 60px", boxSizing:"border-box", background:"#FFF", borderTop:"1px solid #E2E8F0" },
  sectionHead:    { textAlign:"center", marginBottom:"52px" },
  sectionEyebrow: { fontSize:"11px", fontWeight:"700", letterSpacing:"0.08em", color:"#94A3B8", marginBottom:"12px" },
  sectionTitle:   { fontSize:"clamp(24px,3.5vw,36px)", fontWeight:"800", letterSpacing:"-0.02em", color:"#0F172A", marginBottom:"12px" },
  sectionSub:     { fontSize:"16px", color:"#64748B", maxWidth:"560px", margin:"0 auto" },
  compareGrid:    { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"24px", maxWidth:"900px", margin:"0 auto" },
  compareCard:    { borderRadius:"16px", padding:"32px", boxSizing:"border-box" },
  compareCardBad: { background:"#FEF2F2", border:"1px solid #FECACA" },
  compareCardGood:{ background:"#F0FDF4", border:"2px solid #86EFAC", position:"relative" },
  compareCardTitle:{ fontSize:"15px", fontWeight:"700", color:"#991B1B", marginBottom:"20px" },
  compareCardBadge:{ display:"inline-block", background:"#059669", color:"#FFF", fontSize:"12px", fontWeight:"700", padding:"4px 12px", borderRadius:"100px", marginBottom:"20px" },
  compareRow:     { display:"flex", alignItems:"flex-start", gap:"10px", marginBottom:"14px" },
  compareIcon:    { flexShrink:0, marginTop:"1px" },
  compareText:    { fontSize:"13px", color:"#64748B", lineHeight:1.55 },

  /* Features */
  featuresSection:{ padding:"96px 60px", boxSizing:"border-box", background:"#F8FAFC", borderTop:"1px solid #E2E8F0" },
  featureGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:"20px" },
  featureCard:    { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"28px", boxSizing:"border-box" },
  featureIconBox: { width:"44px", height:"44px", borderRadius:"11px", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"18px", flexShrink:0 },
  featureTitle:   { fontSize:"15px", fontWeight:"700", color:"#0F172A", marginBottom:"8px" },
  featureDesc:    { fontSize:"13px", color:"#64748B", lineHeight:1.65 },

  /* Roles */
  rolesSection: { padding:"96px 60px", boxSizing:"border-box", background:"#FFF", borderTop:"1px solid #E2E8F0" },
  rolesGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))", gap:"20px" },
  roleCard:     { background:"#F8FAFC", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"28px", boxSizing:"border-box" },
  roleIconBox:  { width:"44px", height:"44px", borderRadius:"11px", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px" },
  roleTitle:    { fontSize:"15px", fontWeight:"700", color:"#0F172A", marginBottom:"8px" },
  roleDesc:     { fontSize:"13px", color:"#64748B", lineHeight:1.6, marginBottom:"16px" },
  roleList:     { listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:"8px" },
  roleLi:       { display:"flex", alignItems:"flex-start", gap:"8px", fontSize:"12.5px", color:"#475569", lineHeight:1.5 },
  roleLiDot:    { width:"5px", height:"5px", borderRadius:"50%", background:"#CBD5E1", flexShrink:0, marginTop:"6px" },

  /* How it works */
  howSection: { padding:"96px 60px", boxSizing:"border-box", background:"#F8FAFC", borderTop:"1px solid #E2E8F0" },
  stepsRow:   { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(210px,1fr))", gap:"24px" },
  stepCard:   { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"28px", boxSizing:"border-box" },
  stepNum:    { width:"36px", height:"36px", borderRadius:"50%", background:"#0F172A", color:"#FFF", fontSize:"14px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"16px" },
  stepTitle:  { fontSize:"15px", fontWeight:"700", color:"#0F172A", marginBottom:"8px" },
  stepDesc:   { fontSize:"13px", color:"#64748B", lineHeight:1.65 },

  /* Testimonials */
  testimonialsSection: { padding:"96px 60px", boxSizing:"border-box", background:"#0F172A", borderTop:"1px solid #E2E8F0" },
  testimonialsGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))", gap:"20px" },
  testimonialCard:     { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"16px", padding:"28px", boxSizing:"border-box" },
  quoteIcon:           { marginBottom:"12px" },
  testimonialText:     { fontSize:"14px", color:"rgba(255,255,255,0.75)", lineHeight:1.75, marginBottom:"20px" },
  testimonialAuthor:   { display:"flex", alignItems:"center", gap:"12px" },
  testimonialAvatar:   { width:"36px", height:"36px", borderRadius:"50%", color:"#FFF", fontSize:"14px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 },
  testimonialName:     { fontSize:"13px", fontWeight:"700", color:"#F1F5F9" },
  testimonialRole:     { fontSize:"11px", color:"#475569", marginTop:"2px" },

  /* FAQ */
  faqSection: { padding:"96px 60px", boxSizing:"border-box", background:"#FFF", borderTop:"1px solid #E2E8F0" },
  faqList:    { display:"flex", flexDirection:"column", gap:"8px" },
  faqItem:    { border:"1.5px solid #E2E8F0", borderRadius:"12px", overflow:"hidden", transition:"border-color 0.2s" },
  faqQ:       { display:"flex", justifyContent:"space-between", alignItems:"center", width:"100%", padding:"18px 20px", background:"none", border:"none", cursor:"pointer", fontSize:"14px", fontWeight:"600", color:"#0F172A", textAlign:"left", gap:"16px" },
  faqA:       { padding:"0 20px 18px", fontSize:"13.5px", color:"#64748B", lineHeight:1.7 },

  /* CTA banner */
  ctaBanner: { background:"linear-gradient(135deg,#1E3A5F 0%,#0F172A 100%)", padding:"96px 60px", boxSizing:"border-box" },
  ctaTitle:  { fontSize:"clamp(24px,3.5vw,40px)", fontWeight:"800", color:"#F8FAFC", letterSpacing:"-0.02em", marginBottom:"16px", maxWidth:"640px", margin:"0 auto 16px" },
  ctaDesc:   { fontSize:"16px", color:"#94A3B8", marginBottom:"36px" },
  ctaBtn:    { display:"inline-flex", alignItems:"center", background:"#3B82F6", color:"#FFF", border:"none", padding:"15px 32px", borderRadius:"12px", fontSize:"16px", fontWeight:"700", cursor:"pointer", gap:"8px" },

  /* Footer */
  footer:         { background:"#0F172A", padding:"64px 60px 40px", boxSizing:"border-box" },
  footerGrid:     { display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:"48px", maxWidth:"1100px", margin:"0 auto" },
  footerBrand:    {},
  footerLogoRow:  { display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" },
  footerLogoMark: { width:"28px", height:"28px", borderRadius:"7px", background:"#3B82F6", color:"#FFF", fontSize:"13px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center" },
  footerLogoText: { fontSize:"15px", fontWeight:"700", color:"#F1F5F9" },
  footerTagline:  { fontSize:"13px", color:"#475569", lineHeight:1.7, marginBottom:"20px", maxWidth:"280px" },
  footerCopy:     { fontSize:"12px", color:"#334155" },
  footerColTitle: { fontSize:"12px", fontWeight:"700", color:"#64748B", letterSpacing:"0.06em", textTransform:"uppercase", marginBottom:"16px" },
  footerLink:     { display:"block", fontSize:"13px", color:"#64748B", textDecoration:"none", fontWeight:"500", marginBottom:"10px" },
  footerStaticLink:{ display:"block", fontSize:"13px", color:"#334155", marginBottom:"10px" },

  /* Hero wrapper with orbs */
  heroWrap: { position:"relative", overflow:"hidden", background:"linear-gradient(160deg,#F0F7FF 0%,#F8FAFC 60%,#F0FDF4 100%)" },
  heroGrid: { display:"none" },
  orb1: { position:"absolute", top:"-80px", left:"-80px", width:"420px", height:"420px", borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.18) 0%,transparent 70%)", animation:"orbDrift1 12s ease-in-out infinite", pointerEvents:"none" },
  orb2: { position:"absolute", top:"60px", right:"-60px", width:"360px", height:"360px", borderRadius:"50%", background:"radial-gradient(circle,rgba(34,197,94,0.12) 0%,transparent 70%)", animation:"orbDrift2 15s ease-in-out infinite", pointerEvents:"none" },
  orb3: { position:"absolute", bottom:"-40px", left:"40%", width:"280px", height:"280px", borderRadius:"50%", background:"radial-gradient(circle,rgba(167,139,250,0.12) 0%,transparent 70%)", animation:"orbDrift3 10s ease-in-out infinite", pointerEvents:"none" },

  /* Marquee */
  marqueeWrap: { background:"#0F172A", overflow:"hidden", padding:"14px 0", borderTop:"1px solid rgba(255,255,255,0.06)" },
  marqueeTrack: { display:"flex", width:"max-content", animation:"marquee 28s linear infinite" },
  marqueeInner: { display:"flex", gap:"0" },
  marqueeItem:  { display:"flex", alignItems:"center", gap:"10px", padding:"0 28px", fontSize:"13px", fontWeight:"600", color:"rgba(255,255,255,0.45)", whiteSpace:"nowrap" },
  marqueeDot:   { width:"5px", height:"5px", borderRadius:"50%", background:"#3B82F6", flexShrink:0 },

  /* Testimonials carousel */
  carouselWrap: { maxWidth:"700px", margin:"0 auto", padding:"0 60px" },
  carouselDots: { display:"flex", justifyContent:"center", gap:"8px", marginTop:"28px" },
  dot: { width:"8px", height:"8px", borderRadius:"50%", border:"none", cursor:"pointer", padding:0 },

  /* Animated CTA banner */
  ctaBanner: { background:"linear-gradient(270deg,#1E3A5F,#0F172A,#1a1f5e,#0F172A)", backgroundSize:"400% 400%", animation:"gradShift 8s ease infinite", padding:"96px 60px", boxSizing:"border-box" },
};
