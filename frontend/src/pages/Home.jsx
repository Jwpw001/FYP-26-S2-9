import { useEffect, useRef, useState } from "react";
import { getUser } from "../utils/auth";
import { useGoTo } from "../components/PageTransition";
import NavHeader from "../components/NavHeader";

/* ── SCROLL REVEAL ─────────────────────────────────────────── */
function useReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) { setVisible(true); return; }
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, style = {} }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(28px)", transition: `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`, ...style }}>
      {children}
    </div>
  );
}

/* ── FAQ ITEM ──────────────────────────────────────────────── */
function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${open ? C.brandBdr : C.border}`, borderRadius: 12, background: C.surface, overflow: "hidden", transition: "border-color .2s" }}>
      <button style={{ width: "100%", background: "none", border: "none", padding: "20px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 21, fontWeight: 600, color: C.ink, textAlign: "left", gap: 16, cursor: "pointer" }}
        onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span style={{ color: C.brand, fontSize: 23, lineHeight: 1, flexShrink: 0, transition: "transform .2s", transform: open ? "rotate(45deg)" : "rotate(0deg)" }}>+</span>
      </button>
      {open && <p style={{ fontSize: 20.5, color: C.ink2, lineHeight: 1.7, padding: "0 22px 20px", margin: 0 }}>{a}</p>}
    </div>
  );
}

/* ── SCROLL-TO-TOP ─────────────────────────────────────────── */
function ScrollToTop() {
  const [visible, setVisible] = useState(false);
  const [hov, setHov] = useState(false);
  useEffect(() => {
    const fn = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);
  if (!visible) return null;
  return (
    <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ position: "fixed", bottom: 32, right: 32, zIndex: 1001, width: 44, height: 44, borderRadius: 11, background: hov ? "#1E293B" : C.ink, color: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 18px rgba(15,23,42,.28)", transform: hov ? "translateY(-2px)" : "none", transition: "all .15s" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
    </button>
  );
}

/* ── KEYFRAME INJECTION ────────────────────────────────────── */
if (typeof document !== "undefined" && !document.getElementById("kh-styles")) {
  const tag = document.createElement("style");
  tag.id = "kh-styles";
  tag.textContent = `
    html{scroll-behavior:smooth;}
    @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
    @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
  `;
  document.head.appendChild(tag);
}

/* ── CONSTANTS ─────────────────────────────────────────────── */
const ROLE_ROUTES = {
  system_admin:   "/system-admin/dashboard",
  business_owner: "/business-owner/dashboard",
  manager:        "/manager/dashboard",
  regular_staff:  "/regular-staff/dashboard",
  casual_staff:   "/casual-staff/dashboard",
};

// Color palette
const C = {
  ink:       "#0D1526",
  ink2:      "#475569",
  ink3:      "#94A3B8",
  bg:        "#F7FAFD",
  surface:   "#FFFFFF",
  surface2:  "#EEF3FF",
  border:    "#E1EAF4",
  brand:     "#2457E8",
  brandH:    "#1C46CC",
  brandDim:  "#EEF3FF",
  brandBdr:  "#C3D4FD",
  green:     "#059669", greenDim: "#ECFDF5", greenBdr: "#A7F3D0",
  amber:     "#D97706", amberDim: "#FFFBEB",
  rose:      "#E11D48",
  purple:    "#7C3AED", purpleDim: "#F5F3FF",
  teal:      "#0891B2", tealDim: "#ECFEFF",
};

const PREVIEW_SHIFTS = [
  { date: "MON\n28", name: "Morning Shift",   time: "06:00 – 14:00", status: "pub", statusLabel: "Published",  avatars: [{ i: "JD", c: "#2457E8" }, { i: "SK", c: "#059669" }, { i: "MP", c: "#7C3AED" }, { i: "+2", c: "#374151" }] },
  { date: "MON\n28", name: "Afternoon Shift", time: "14:00 – 22:00", status: "open", statusLabel: "1 open",    avatars: [{ i: "RL", c: "#D97706" }, { i: "TW", c: "#0891B2" }] },
  { date: "TUE\n29", name: "Morning Shift",   time: "06:00 – 14:00", status: "draft", statusLabel: "Draft",    avatars: [{ i: "KA", c: "#E11D48" }, { i: "BJ", c: "#059669" }, { i: "LM", c: "#2457E8" }] },
];

const BADGE_STYLES = {
  pub:   { background: "rgba(5,150,105,.2)",  color: "#34D399" },
  open:  { background: "rgba(217,119,6,.18)", color: "#FCD34D" },
  draft: { background: "rgba(148,163,184,.1)", color: "rgba(255,255,255,.4)" },
};

const FEATURES = [
  { title: "Smart Scheduling",        color: C.brand,  bg: C.brandDim,  desc: "Build weekly rosters in minutes with conflict detection, availability checks, and skill-based staff recommendations." },
  { title: "Role-Based Dashboards",   color: C.green,  bg: C.greenDim,  desc: "Every user type gets a dashboard built exactly for their responsibilities — no noise, no clutter." },
  { title: "Attendance Tracking",     color: C.amber,  bg: C.amberDim,  desc: "Mark attendance digitally per shift with a complete, exportable audit trail." },
  { title: "Real-Time Notifications", color: C.purple, bg: C.purpleDim, desc: "Alerts for assignments, swap requests, leave decisions, and understaffed shifts — nothing slips through." },
];

const ROLES = [
  { name: "Business Owner", color: C.brand,  bg: C.brandDim,  desc: "Full visibility and control across branches, workers, and operations.", bullets: ["Register your business and branches", "Appoint and manage branch managers", "Access platform-wide reports", "Oversee your entire workforce"] },
  { name: "Manager",        color: C.green,  bg: C.greenDim,  desc: "Own day-to-day scheduling and workforce management for your branch.",   bullets: ["Build and publish weekly rosters", "Approve leave & swap requests", "Mark and review attendance", "Manage worker skills and assignments"] },
  { name: "Regular Worker", color: C.amber,  bg: C.amberDim,  desc: "See upcoming shifts, submit availability, and manage requests.",         bullets: ["View assigned shifts", "Submit leave requests", "Request shift swaps", "Receive real-time notifications"] },
  { name: "Casual Worker",  color: C.purple, bg: C.purpleDim, desc: "View assigned shifts, set availability, and stay connected.",            bullets: ["View assigned shifts", "Set weekly availability", "Acknowledge shift assignments", "Receive real-time notifications"] },
];

const STEPS = [
  { title: "Register your business", desc: "Add business details, branch locations, and your team structure in minutes." },
  { title: "Invite your team",       desc: "Managers and workers get role-tailored access — everyone sees exactly what they need." },
  { title: "Build your roster",      desc: "Assign workers by availability and skill, then publish. The team is notified instantly." },
  { title: "Track attendance & act", desc: "Mark attendance as shifts happen, spot gaps, and export reports for review." },
];

const PRICING = [
  { name: "Free",       accent: "#64748B", accentLight: "#F8FAFC", desc: "Get started at no cost.",          price: "S$0",   unit: "/ month", features: ["1 branch", "Up to 20 staff", "Shift scheduling", "Leave & swap requests", "Basic reports"],                                                                        popular: false },
  { name: "Premium",    accent: "#2563EB", accentLight: "#EFF6FF", desc: "For growing businesses.",          price: "S$60",  unit: "/ month", features: ["1 branch", "Unlimited staff", "Everything in Free", "Advanced reports", "AI scheduling assistant", "Priority email support"],                                 popular: true  },
  { name: "Enterprise", accent: "#7C3AED", accentLight: "#F5F3FF", desc: "For multi-branch operations.",     price: "S$120", unit: "/ month", features: ["Up to 2 businesses", "Unlimited branches", "Unlimited staff", "Everything in Premium", "Dedicated account manager", "Custom onboarding", "SLA & priority support"], popular: false },
];

const FAQ = [
  { q: "What types of businesses can use Krewby?",             a: "Any business that manages shift-based workers — retail, hospitality, healthcare, and service businesses. It scales from a single location to multi-branch operations." },
  { q: "How does skill-based matching work?",                   a: "Tag workers with skills in their profile. When building a roster, Krewby surfaces the right people for the right roles automatically — ranked by match quality." },
  { q: "Is Krewby suitable for multiple branches?",             a: "Yes. The business owner account gives full visibility across branches, while each branch keeps its own manager and workers operating independently." },
  { q: "How is our data secured?",                              a: "Role-based access controls mean workers and managers only see what's relevant to them. Business owners keep oversight across every branch." },
  { q: "What happens when a worker calls in sick last minute?", a: "The manager is notified immediately and can reassign the shift or use skill-based matching to find a suitable replacement — all from the same screen." },
  { q: "Does Krewby support different roles and permissions?",  a: "Yes. There are five distinct role types: System Administrator, Business Owner, Manager, Regular Worker, and Casual Worker, each with a dedicated dashboard." },
];

/* ── NAV SIDEBAR ICON ──────────────────────────────────────── */
function PvIcon({ name }) {
  const d = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    calendar:  <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    clock:     <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
    check:     <><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    bar:       <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    bell:      <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    shifts:    <><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></>,
    team:      <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    reports:   <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M20 12h2M2 12h2M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M12 20v2M12 2v2"/></>,
  };
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{d[name]}</svg>;
}

/* ── MAIN PAGE ─────────────────────────────────────────────── */
export default function Home() {
  const user = getUser();
  const goTo = useGoTo();

  function go(dest) {
    const target = dest || (user && ROLE_ROUTES[user.role] ? ROLE_ROUTES[user.role] : "/get-started");
    goTo(target);
  }
  function scroll(id) { document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }); }

  return (
    <main style={{ minHeight: "100vh", background: C.bg, color: C.ink, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif", animation: "fadeIn .4s ease both" }}>

      {/* ── ANNOUNCE BAR ─────────────────────────────────── */}
      <div style={{ background: C.brandDim, borderBottom: `1px solid ${C.brandBdr}`, padding: "8px 24px", textAlign: "center", fontSize: 19.5, fontWeight: 600, color: C.brand, letterSpacing: ".01em" }}>
        New: Skill-based auto matching for every shift →
      </div>

      {/* ── NAV ──────────────────────────────────────────── */}
      <div style={{ height: 66 }} />
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, height: 66, display: "flex", alignItems: "center", padding: "0 64px", background: "rgba(247,250,253,0.92)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: `1px solid ${C.border}`, boxSizing: "border-box" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: 22, letterSpacing: "-.022em", color: C.ink, textDecoration: "none" }}>
          <img src="/logo_noText.png" alt="Krewby" style={{ width: 30, height: 30, objectFit: "contain", borderRadius: 7 }} />
          Krewby
        </a>
        <NavHeader
          items={["Features", "Who it's for", "How it works", "FAQ"]}
          onSelect={label => scroll({ "Features": "features", "Who it's for": "roles", "How it works": "how", "FAQ": "faq" }[label])}
        />
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {!user && (
            <button style={{ fontSize: 20.5, fontWeight: 600, color: C.ink2, padding: "8px 12px", background: "none", border: "none", cursor: "pointer" }} onClick={() => goTo("/get-started")}>
              Sign up
            </button>
          )}
          <button style={{ background: C.ink, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 9, fontSize: 21, fontWeight: 700, cursor: "pointer" }}
            onClick={() => user ? go() : goTo("/login")}>
            {user ? "Go to dashboard" : "Log in"}
          </button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────── */}
      <section style={{ background: C.surface, padding: "84px 64px 0", textAlign: "center", overflow: "hidden" }}>
        <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.brand, background: C.brandDim, border: `1px solid ${C.brandBdr}`, padding: "5px 14px", borderRadius: 100, marginBottom: 24 }}>
          Workforce Management Platform
        </div>
        <h1 style={{ fontSize: "clamp(34px,5.5vw,58px)", fontWeight: 800, letterSpacing: "-.035em", lineHeight: 1.03, color: C.ink, maxWidth: 800, margin: "0 auto 20px" }}>
          One dashboard.<br />
          <em style={{ fontStyle: "normal", color: C.brand }}>Your entire workforce.</em>
        </h1>
        <p style={{ fontSize: 22, lineHeight: 1.7, color: C.ink2, maxWidth: 500, margin: "0 auto 36px" }}>
          See every shift, every branch, and every worker's status in real time — no more piecing it together from group chats.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 60 }}>
          <button style={{ background: C.brand, color: "#fff", border: "none", padding: "14px 28px", borderRadius: 9, fontSize: 22, fontWeight: 700, cursor: "pointer" }}
            onClick={() => go()}>
            Get started free
          </button>
        </div>

        {/* Product preview */}
        <div style={{ maxWidth: 980, margin: "0 auto", borderRadius: "14px 14px 0 0", border: `1px solid ${C.border}`, borderBottom: "none", overflow: "hidden", boxShadow: "0 8px 40px rgba(15,23,42,.1),0 2px 8px rgba(15,23,42,.06)" }}>
          {/* Browser chrome */}
          <div style={{ background: "#1E293B", padding: "11px 16px", display: "flex", alignItems: "center", gap: 8, borderBottom: "1px solid #334155" }}>
            <div style={{ display: "flex", gap: 6 }}>
              {["#FF5F56","#FFBD2E","#27C93F"].map(c => <span key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c, display: "inline-block" }} />)}
            </div>
            <div style={{ marginLeft: 8, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 5, padding: "3px 14px", fontSize: 18, color: "rgba(255,255,255,.4)", fontFamily: "ui-monospace,monospace" }}>
              app.krewby.com/manager/dashboard
            </div>
          </div>
          {/* Dashboard layout — matches actual app */}
          <div style={{ background: "#F8FAFC", display: "grid", gridTemplateColumns: "64px 1fr", minHeight: 400 }}>
            {/* Sidebar — matches ManagerLayout: #0F172A, 64px collapsed */}
            <div style={{ background: "#0F172A", display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 0", gap: 4, borderRight: "1px solid rgba(255,255,255,.06)" }}>
              {/* Logo box */}
              <div style={{ width: 34, height: 34, borderRadius: 9, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><img src="/logo_noText.png" alt="Krewby" style={{ width: 26, height: 26, objectFit: "contain" }} /></div>
              {/* Nav icons */}
              {[
                { icon: "dashboard", active: true },
                { icon: "users",    active: false },
                { icon: "calendar", active: false },
                { icon: "clock",    active: false },
                { icon: "check",    active: false },
                { icon: "bar",      active: false },
              ].map(({ icon, active }) => (
                <div key={icon} style={{ width: 40, height: 36, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "rgba(59,130,246,.15)" : "transparent", color: active ? "#93C5FD" : "rgba(255,255,255,.45)", cursor: "default" }}>
                  <PvIcon name={icon} />
                </div>
              ))}
            </div>
            {/* Main content */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {/* Topbar */}
              <div style={{ height: 48, background: "#fff", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 20px", gap: 10 }}>
                <span style={{ fontSize: 21, fontWeight: 700, color: "#1E293B" }}>Dashboard</span>
                <div style={{ flex: 1 }} />
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <PvIcon name="bell" />
                </div>
              </div>
              {/* Content */}
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Greeting */}
                <div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: "#1E293B", letterSpacing: "-.02em" }}>Good morning, Manager</div>
                  <div style={{ fontSize: 18, color: "#64748B", marginTop: 2 }}>Here's what's happening at your branch today.</div>
                </div>
                {/* Today's Roster card */}
                <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 19, fontWeight: 700, color: "#1E293B" }}>Today's Roster</span>
                    <span style={{ fontSize: 16.5, color: "#94A3B8", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 5, padding: "2px 7px", fontWeight: 500 }}>8AM – 10PM</span>
                  </div>
                  {/* Time labels */}
                  <div style={{ paddingLeft: 90, marginBottom: 6 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, color: "#94A3B8", fontWeight: 600 }}>
                      {["8am","12pm","4pm","8pm","10pm"].map(t => <span key={t}>{t}</span>)}
                    </div>
                  </div>
                  {/* Gantt rows */}
                  {[
                    { name: "J. Davis",  initial: "J", avatarBg: "#6366F1", left: 0,   width: 57, label: "Morning",   clr: { bg:"#DBEAFE", color:"#1D4ED8", border:"#BFDBFE" } },
                    { name: "S. Kumar",  initial: "S", avatarBg: "#F59E0B", left: 42,  width: 58, label: "Afternoon",  clr: { bg:"#FEF3C7", color:"#92400E", border:"#FDE68A" } },
                    { name: "M. Park",   initial: "M", avatarBg: "#10B981", left: 0,   width: 71, label: "Day Shift",  clr: { bg:"#D1FAE5", color:"#065F46", border:"#A7F3D0" } },
                  ].map((row, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderTop: "1px solid #F1F5F9" }}>
                      <div style={{ width: 82, flexShrink: 0, display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: "50%", background: row.avatarBg, color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{row.initial}</div>
                        <span style={{ fontSize: 17.5, fontWeight: 600, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</span>
                      </div>
                      <div style={{ flex: 1, position: "relative", height: 22, background: "#FAFBFC", borderRadius: 5 }}>
                        <div style={{ position: "absolute", top: 2, height: 18, left: `${row.left}%`, width: `${row.width}%`, background: row.clr.bg, color: row.clr.color, border: `1px solid ${row.clr.border}`, borderRadius: 5, display: "flex", alignItems: "center", padding: "0 7px", fontSize: 16.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden" }}>
                          {row.label}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Two mini cards */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {/* Weekly workload */}
                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Weekly Workload</div>
                    {[["Mon",80,true],["Tue",55,false],["Wed",65,false],["Thu",40,false],["Fri",70,false]].map(([day,pct,today]) => (
                      <div key={day} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ width: 24, fontSize: 16.5, fontWeight: 600, color: today ? "#0D9488" : "#94A3B8", flexShrink: 0 }}>{day}</span>
                        <div style={{ flex: 1, height: 8, background: "#F1F5F9", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: today ? "#0D9488" : "#5EEAD4", borderRadius: 4 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Pending approvals */}
                  <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 14, padding: "12px 14px" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Pending Requests</div>
                    {[
                      { name: "A. Tan",   type: "Leave",  badge: { bg:"#FEF3C7", color:"#92400E" } },
                      { name: "B. Lim",   type: "Swap",   badge: { bg:"#EDE9FE", color:"#6B21A8" } },
                      { name: "C. Ng",    type: "Leave",  badge: { bg:"#FEF3C7", color:"#92400E" } },
                    ].map((r, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0", borderTop: i > 0 ? "1px solid #F1F5F9" : "none" }}>
                        <span style={{ fontSize: 17.5, fontWeight: 600, color: "#1E293B" }}>{r.name}</span>
                        <span style={{ fontSize: 16, fontWeight: 700, padding: "2px 7px", borderRadius: 100, background: r.badge.bg, color: r.badge.color }}>{r.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LOGOS ────────────────────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "52px 64px" }}>
        <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.ink3, textAlign: "center", margin: "0 0 22px" }}>Trusted by operations teams at</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 20, flexWrap: "wrap" }}>
          {["[ logo ]","[ logo ]","[ logo ]","[ logo ]","[ logo ]"].map((l,i) => (
            <span key={i} style={{ fontFamily: "ui-monospace,monospace", fontSize: 18.5, color: C.ink3, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 22px" }}>{l}</span>
          ))}
        </div>
      </div>

      {/* ── STATS ────────────────────────────────────────── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "26px 64px" }}>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
          {[["100+","Shifts managed"],["5","User role types"],["Real-time","Attendance sync"],["1-click","Branch management"]].map(([n,l],i,arr) => (
            <div key={l} style={{ textAlign: "center", padding: "0 44px", borderRight: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", color: C.ink, fontVariantNumeric: "tabular-nums" }}>{n}</div>
              <div style={{ fontSize: 18, color: C.ink3, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MARQUEE ──────────────────────────────────────── */}
      <div style={{ padding: "13px 0", overflow: "hidden", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ display: "inline-flex", animation: "marquee 28s linear infinite" }}>
          {[0,1].map(pass => (
            <div key={pass} style={{ display: "inline-flex", gap: 28, paddingRight: 28 }}>
              {["Smart Scheduling","Skill Matching","Live Roster","Multi-Branch","Attendance Tracking","Reports & Exports","Swap Requests","Real-Time Alerts"].map(label => (
                <span key={label} style={{ fontSize: 19.5, color: C.ink3, background: C.bg, border: `1px solid ${C.border}`, padding: "5px 15px", borderRadius: 100, whiteSpace: "nowrap" }}>{label}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── PROBLEM / SOLUTION ───────────────────────────── */}
      <section style={{ padding: "100px 64px" }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>The Problem</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: "0 0 12px" }}>Workforce scheduling is broken</h2>
            <p style={{ maxWidth: 540, margin: "0 auto" }}>Most businesses still run on WhatsApp groups, paper rosters, and spreadsheets — and it shows.</p>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, maxWidth: 940, margin: "0 auto" }}>
          <Reveal>
            <div style={{ borderRadius: 16, padding: 32, background: C.surface2, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: C.ink2, marginBottom: 22 }}>Without Krewby</div>
              {["Last-minute changes sent over WhatsApp","No visibility into who is actually working","Attendance tracked with pen and paper","Short-staffed shifts with no backup plan","Managers spending hours building rosters","No audit trail when issues arise"].map(item => (
                <div key={item} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start", fontSize: 20.5, lineHeight: 1.55, color: C.ink2 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.border, marginTop: 5, flexShrink: 0, display: "inline-block" }} />{item}
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div style={{ borderRadius: 16, padding: 32, background: C.brand, border: `1px solid ${C.brand}` }}>
              <div style={{ display: "inline-block", background: "rgba(255,255,255,.18)", color: "#fff", fontSize: 18, fontWeight: 700, padding: "4px 12px", borderRadius: 100, marginBottom: 20 }}>With Krewby</div>
              {["Instant shift notifications sent to every worker","Live roster visible to everyone on any device","Digital attendance marked per shift, per person","Skill-based worker matching for every role","Build and publish rosters in minutes","Full audit trail for every shift and change"].map(item => (
                <div key={item} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start", fontSize: 20.5, lineHeight: 1.55, color: "rgba(255,255,255,.92)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(255,255,255,.55)", marginTop: 5, flexShrink: 0, display: "inline-block" }} />{item}
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────── */}
      <section id="features" style={{ padding: "100px 64px", background: C.surface2, borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>Product</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>See how Krewby runs day to day</h2>
          </div>
        </Reveal>
        {/* Feature grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, maxWidth: 980, margin: "0 auto" }}>
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 60}>
              <FeatureCard f={f} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── ROLES ────────────────────────────────────────── */}
      <section id="roles" style={{ padding: "100px 64px", borderTop: `1px solid ${C.border}` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>Who It's For</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>Built for every role in your operation</h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 20, maxWidth: 1100, margin: "0 auto" }}>
          {ROLES.map((r, i) => (
            <Reveal key={r.name} delay={i * 70}>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden", background: C.surface }}>
                <div style={{ padding: "20px 22px", background: r.bg }}>
                  <div style={{ fontSize: 21, fontWeight: 800, color: r.color }}>{r.name}</div>
                </div>
                <div style={{ fontSize: 19.5, color: C.ink2, lineHeight: 1.6, padding: "14px 22px 0" }}>{r.desc}</div>
                <ul style={{ listStyle: "none", padding: "14px 22px 24px", margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                  {r.bullets.map(b => (
                    <li key={b} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 19, color: C.ink2, lineHeight: 1.4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: r.color, flexShrink: 0, marginTop: 4, display: "inline-block" }} />{b}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────── */}
      <section id="how" style={{ padding: "100px 64px", background: C.surface2, borderTop: `1px solid ${C.border}` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>How It Works</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>Up and running in minutes</h2>
          </div>
        </Reveal>
        <div style={{ maxWidth: 580, margin: "0 auto", position: "relative", paddingLeft: 28, borderLeft: `1.5px solid ${C.border}` }}>
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 80}>
              <div style={{ position: "relative", paddingBottom: i < STEPS.length - 1 ? 36 : 0 }}>
                <div style={{ position: "absolute", left: -38, top: 0, width: 20, height: 20, borderRadius: "50%", background: C.brand, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>{i + 1}</div>
                <h3 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.01em", marginBottom: 6 }}>{step.title}</h3>
                <p style={{ fontSize: 20.5 }}>{step.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────── */}
      <section id="pricing" style={{ padding: "100px 64px", borderTop: `1px solid ${C.border}` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 52 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>Pricing</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>Simple, per-branch pricing</h2>
          </div>
        </Reveal>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, maxWidth: 960, margin: "0 auto" }}>
          {PRICING.map((plan) => (
            <div key={plan.name} style={{ position: "relative", border: `2px solid ${plan.popular ? plan.accent : C.border}`, borderRadius: 18, background: plan.popular ? plan.accentLight : C.surface, padding: "28px 24px", boxShadow: plan.popular ? `0 0 0 4px ${plan.accent}18, 0 8px 24px ${plan.accent}14` : "0 1px 4px rgba(0,0,0,.04)" }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: 0, right: 0, background: plan.accent, color: "#fff", fontSize: 17, fontWeight: 700, padding: "5px 13px", borderRadius: "0 16px 0 12px", letterSpacing: ".04em" }}>⭐ Popular</div>
              )}
              <div style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: plan.accent, marginBottom: 14 }}>{plan.name}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 2, marginBottom: 4 }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: plan.popular ? plan.accent : "#64748B", marginBottom: 6 }}></span>
                <span style={{ fontSize: 36, fontWeight: 800, letterSpacing: "-.04em", color: plan.popular ? plan.accent : C.ink, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{plan.price}</span>
                <span style={{ fontSize: 19, color: C.ink3, fontWeight: 500, marginBottom: 5, marginLeft: 3 }}>{plan.unit}</span>
              </div>
              <p style={{ fontSize: 19, color: C.ink3, margin: "0 0 6px" }}>billed monthly</p>
              <p style={{ fontSize: 19.5, color: plan.popular ? plan.accent : "#64748B", fontWeight: 500, margin: "0 0 18px" }}>{plan.desc}</p>
              <div style={{ height: 1, background: plan.popular ? `${plan.accent}28` : "#F1F5F9", marginBottom: 16 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 20, color: plan.popular ? "#1E293B" : "#64748B" }}>
                    <div style={{ width: 15, height: 15, borderRadius: "50%", background: plan.popular ? plan.accent : "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 15, color: plan.popular ? "#fff" : "#94A3B8", fontWeight: 700 }}>✓</span>
                    </div>
                    {f}
                  </div>
                ))}
              </div>
              <button style={{ marginTop: 22, width: "100%", padding: "11px", background: plan.popular ? plan.accent : "#F1F5F9", color: plan.popular ? "#fff" : "#64748B", border: `1.5px solid ${plan.popular ? plan.accent : "#E2E8F0"}`, borderRadius: 10, fontSize: 20, fontWeight: 700, cursor: "pointer" }}
                onClick={() => go()}>
                {plan.name === "Free" ? "Get started free" : `Upgrade to ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL ──────────────────────────────────── */}
      <section style={{ padding: "100px 64px", background: C.surface2, borderTop: `1px solid ${C.border}`, textAlign: "center" }}>
        <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 28 }}>Customer Story</div>
        <Reveal>
          <p style={{ fontSize: "clamp(17px,2.5vw,23px)", fontWeight: 500, lineHeight: 1.55, maxWidth: 720, margin: "0 auto 28px", color: C.ink, letterSpacing: "-.01em" }}>
            &ldquo;Managing 4 branches with different worker pools was a nightmare. Krewby gave us one place to see everything.&rdquo;
          </p>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: C.green, color: "#fff", fontWeight: 700, fontSize: 21, display: "flex", alignItems: "center", justifyContent: "center" }}>M</div>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: C.ink }}>Marcus T.</div>
              <div style={{ fontSize: 19, color: C.ink3 }}>Operations Director, Horizon Group</div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section id="faq" style={{ padding: "100px 64px", borderTop: `1px solid ${C.border}` }}>
        <Reveal>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ display: "inline-block", fontSize: 18, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.ink3, marginBottom: 11 }}>FAQ</div>
            <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", margin: 0 }}>Common questions</h2>
          </div>
        </Reveal>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column", gap: 10 }}>
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 40}>
              <FaqItem q={f.q} a={f.a} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section style={{ padding: "96px 64px", background: C.brand, textAlign: "center" }}>
        <Reveal>
          <h2 style={{ fontSize: "clamp(26px,3.5vw,38px)", fontWeight: 800, letterSpacing: "-.03em", color: "#fff", margin: "0 0 14px" }}>See your whole workforce in one view.</h2>
          <p style={{ fontSize: 21, color: "rgba(255,255,255,.75)", maxWidth: 460, margin: "0 auto 32px" }}>Join businesses already using Krewby to plan smarter, track better, and stress less.</p>
          <button style={{ background: "#fff", color: C.brand, fontSize: 22, fontWeight: 700, padding: "14px 28px", borderRadius: 10, border: "none", cursor: "pointer" }} onClick={() => go()}>
            Get started for free
          </button>
        </Reveal>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={{ padding: "72px 64px 44px", borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 40, maxWidth: 1100, margin: "0 auto 48px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <img src="/logo_noText.png" alt="Krewby" style={{ width: 28, height: 28, objectFit: "contain", borderRadius: 6 }} />
              <span style={{ fontWeight: 800, fontSize: 22, letterSpacing: "-.02em", color: C.ink }}>Krewby</span>
            </div>
            <p style={{ fontSize: 20, color: C.ink3, lineHeight: 1.6, maxWidth: 230 }}>Workforce management built for the speed and scale of modern business operations.</p>
            <p style={{ fontSize: 19, color: C.ink3, marginTop: 20 }}>© {new Date().getFullYear()} Krewby · CSIT321 FYP-26-S2-9</p>
          </div>
          {[
            { title: "Product",   links: [["Features","features"],["How it works","how"],["Who it's for","roles"],["FAQ","faq"]] },
            { title: "Use cases", links: [["Retail chains",null],["Hospitality",null],["Healthcare",null],["Multi-branch teams",null]] },
            { title: "Platform",  links: [["Log in","/login"],["System Admin","/login"],["Manager Portal","/login"],["Worker Portal","/login"]] },
          ].map(col => (
            <div key={col.title}>
              <p style={{ fontSize: 18, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.ink3, margin: "0 0 16px" }}>{col.title}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map(([label, target]) => (
                  <a key={label} href="#" style={{ fontSize: 20, color: C.ink2, textDecoration: "none" }}
                    onClick={e => { e.preventDefault(); if (target?.startsWith("/")) goTo(target); else if (target) scroll(target); }}>
                    {label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </footer>

      <ScrollToTop />
    </main>
  );
}

/* ── FEATURE CARD ──────────────────────────────────────────── */
function FeatureCard({ f }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.border}`, borderRadius: 12, padding: 22, transform: hov ? "translateY(-3px)" : "none", boxShadow: hov ? "0 10px 28px rgba(15,23,42,.09)" : "none", transition: "transform .2s,box-shadow .2s" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: f.bg, color: f.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 21, marginBottom: 13 }}>
        {f.title[0]}
      </div>
      <h4 style={{ fontSize: 20.5, fontWeight: 700, letterSpacing: "-.005em", margin: "0 0 7px", color: C.ink }}>{f.title}</h4>
      <p style={{ fontSize: 19.5, lineHeight: 1.55, margin: 0 }}>{f.desc}</p>
    </div>
  );
}
