import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { getUser } from "../../utils/auth";
import { useGoTo } from "../../components/PageTransition";

/* ── Inject keyframes at module load (before any render) ── */
if (typeof document !== "undefined" && !document.getElementById("dash-styles")) {
  const tag = document.createElement("style");
  tag.id = "dash-styles";
  tag.textContent = `
    @keyframes spin        { to { transform: rotate(360deg); } }
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    @keyframes popIn       { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
    @keyframes pulse       { 0%,100%{ opacity:1; transform:scale(1); } 50%{ opacity:0.4; transform:scale(1.5); } }
    @keyframes shimmer     { 0% { background-position: -600px 0; } 100% { background-position: 600px 0; } }
    @keyframes pageIn      { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes pageOut     { from { opacity:1; transform:translateY(0); } to { opacity:0; transform:translateY(-10px); } }
  `;
  document.head.appendChild(tag);
}

/* ── SVG Icons ── */
const icons = {
  outlets:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  managers: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  staff:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  skills:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>,
  workers:  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/></svg>,
  arrowUpRight: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>,
  chevron:  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
};

/* ── Count-up hook ── */
function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current) return;
    started.current = true;
    if (target === 0) return;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min((now - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [enabled, target, duration]);
  return val;
}

/* ── Animated stat card ── */
function StatCard({ card, index, ready, goTo }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const count = useCountUp(card.value, 900, ready);
  const barW = `${Math.min(card.value > 0 ? (card.value / Math.max(card.value, 20)) * 100 : 0, 100)}%`;

  return (
    <div
      style={{
        ...s.statCard,
        animation: ready ? `popIn 0.45s cubic-bezier(.22,1,.36,1) ${index * 70}ms both` : "none",
        transform: pressed ? "scale(0.97)" : hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov && !pressed
          ? `0 8px 24px ${card.color}22, 0 2px 8px rgba(0,0,0,0.08)`
          : "0 1px 4px rgba(0,0,0,0.06)",
        borderColor: hov ? card.color + "55" : "#E2E8F0",
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "pointer",
      }}
      onClick={() => goTo(card.link)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div style={s.statCardHeader}>
        <div style={{
          ...s.statIconBox,
          background: card.bg,
          color: card.color,
          transform: hov ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
          transition: "transform 0.25s cubic-bezier(.34,1.56,.64,1)",
        }}>
          {card.icon}
        </div>
        <div style={{ color: card.color, opacity: hov ? 1 : 0.4, transition: "opacity 0.2s" }}>
          {icons.arrowUpRight}
        </div>
      </div>

      <p style={s.statValue}>{count.toLocaleString()}</p>
      <p style={s.statLabel}>{card.label}</p>

      {/* Animated progress bar */}
      <div style={{ ...s.statBar, background: card.bg }}>
        <div style={{
          height: "100%", borderRadius: "100px", background: card.color,
          width: ready ? barW : "0%",
          transition: ready ? `width 1s cubic-bezier(.4,0,.2,1) ${index * 70 + 300}ms` : "none",
        }} />
      </div>
    </div>
  );
}


/* ── Skeleton loader card ── */
function SkeletonCard() {
  return (
    <div style={s.skeletonCard}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ ...s.skeletonBox, width: "40px", height: "40px", borderRadius: "10px" }} />
        <div style={{ ...s.skeletonBox, width: "20px", height: "20px", borderRadius: "4px" }} />
      </div>
      <div style={{ ...s.skeletonBox, width: "60px", height: "28px", borderRadius: "6px", marginBottom: "8px" }} />
      <div style={{ ...s.skeletonBox, width: "80px", height: "10px", borderRadius: "4px", marginBottom: "16px" }} />
      <div style={{ ...s.skeletonBox, width: "100%", height: "3px", borderRadius: "4px" }} />
    </div>
  );
}

/* ── Bottom section: Platform overview + Quick actions ── */
function BottomSection({ stats, actions, ready, goTo }) {
  const bars = [
    { label: "Outlets",  val: stats.outlets,      color: "#2563EB", bg: "#EFF6FF" },
    { label: "Managers", val: stats.managers,      color: "#059669", bg: "#ECFDF5" },
    { label: "Staff",    val: stats.staff,         color: "#D97706", bg: "#FFFBEB" },
    { label: "Skills",   val: stats.skills,        color: "#7C3AED", bg: "#F5F3FF" },
    { label: "Workers",  val: stats.krewbyWorkers, color: "#DB2777", bg: "#FDF2F8" },
  ];
  const max   = Math.max(...bars.map(b => b.val), 1);
  const total = bars.reduce((acc, b) => acc + b.val, 0);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "14px", animation: "fadeSlideUp 0.45s ease 350ms both" }}>

      {/* Left — Platform at a glance */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
          <div>
            <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>Summary</p>
            <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>Platform at a Glance</h3>
          </div>
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "8px 16px", textAlign: "center" }}>
            <p style={{ fontSize: "20px", fontWeight: "800", color: "#2563EB", lineHeight: 1 }}>{stats.businesses}</p>
            <p style={{ fontSize: "10px", fontWeight: "600", color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "3px", opacity: 0.7 }}>Businesses</p>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
          {bars.map((b, i) => {
            const pct = total > 0 ? Math.round((b.val / total) * 100) : 0;
            return (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#374151" }}>{b.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#CBD5E1" }}>{pct}%</span>
                    <span style={{ fontSize: "13px", fontWeight: "800", color: b.color, minWidth: "22px", textAlign: "right" }}>{b.val}</span>
                  </div>
                </div>
                <div style={{ height: "6px", background: b.bg, borderRadius: "100px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: "100px",
                    background: `linear-gradient(90deg,${b.color}99,${b.color})`,
                    width: ready ? `${(b.val / max) * 100}%` : "0%",
                    transition: `width 0.9s cubic-bezier(.4,0,.2,1) ${i * 80}ms`,
                    minWidth: b.val > 0 ? "6px" : "0",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right — Quick actions */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <div style={{ marginBottom: "22px" }}>
          <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>Navigation</p>
          <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>Quick Actions</h3>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {actions.map((a, i) => (
            <QuickActionRow key={a.label} action={a} index={i} ready={ready} goTo={goTo} />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuickActionRow({ action, index, ready, goTo }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={() => goTo(action.link)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: "14px",
        padding: "13px 14px", borderRadius: "12px", cursor: "pointer",
        background: hov ? "#F8FAFC" : "transparent",
        border: `1px solid ${hov ? "#E2E8F0" : "transparent"}`,
        transition: "background 0.15s, border-color 0.15s",
        animation: ready ? `fadeSlideUp 0.35s ease ${index * 55 + 100}ms both` : "none",
      }}>
      <div style={{
        width: "40px", height: "40px", borderRadius: "10px", flexShrink: 0,
        background: action.bg, color: action.color,
        display: "flex", alignItems: "center", justifyContent: "center",
        transform: hov ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.2s cubic-bezier(.34,1.56,.64,1)",
      }}>
        {action.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>{action.label}</p>
        <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "1px" }}>{action.desc}</p>
      </div>
      <div style={{
        color: hov ? action.color : "#CBD5E1",
        transform: hov ? "translateX(3px)" : "translateX(0)",
        transition: "transform 0.2s ease, color 0.15s",
        flexShrink: 0,
      }}>
        {icons.chevron}
      </div>
    </div>
  );
}

/* ── Combined Businesses + Outlets card ── */
function BizOutletCard({ stats, ready, goTo }) {
  const [hov, setHov] = useState(false);
  const [pressed, setPressed] = useState(false);
  const bizCount    = useCountUp(stats.businesses, 900, ready);
  const outletCount = useCountUp(stats.outlets,    900, ready);

  return (
    <div
      style={{
        ...s.statCard,
        animation: ready ? "popIn 0.45s cubic-bezier(.22,1,.36,1) 0ms both" : "none",
        transform: pressed ? "scale(0.97)" : hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov && !pressed ? "0 8px 24px #2563EB22, 0 2px 8px rgba(0,0,0,0.08)" : "0 1px 4px rgba(0,0,0,0.06)",
        borderColor: hov ? "#2563EB55" : "#E2E8F0",
        transition: "transform 0.18s cubic-bezier(.34,1.56,.64,1), box-shadow 0.2s ease, border-color 0.2s ease",
        cursor: "pointer",
      }}
      onClick={() => goTo("/system-admin/businesses")}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setHov(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
    >
      <div style={s.statCardHeader}>
        <div style={{
          ...s.statIconBox, background: "#EFF6FF", color: "#2563EB",
          transform: hov ? "scale(1.1) rotate(-4deg)" : "scale(1) rotate(0deg)",
          transition: "transform 0.25s cubic-bezier(.34,1.56,.64,1)",
        }}>
          {icons.outlets}
        </div>
        <div style={{ color: "#2563EB", opacity: hov ? 1 : 0.4, transition: "opacity 0.2s" }}>
          {icons.arrowUpRight}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "6px" }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ ...s.statValue, fontSize: "26px" }}>{bizCount}</p>
          <p style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Businesses</p>
        </div>
        <div style={{ width: "1px", height: "32px", background: "#E2E8F0", flexShrink: 0 }} />
        <div style={{ textAlign: "center" }}>
          <p style={{ ...s.statValue, fontSize: "26px", color: "#2563EB" }}>{outletCount}</p>
          <p style={{ fontSize: "10px", fontWeight: "600", color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.7 }}>Outlets</p>
        </div>
      </div>

      <p style={{ ...s.statLabel, marginBottom: "14px" }}>Businesses &amp; Outlets</p>

      <div style={{ ...s.statBar, background: "#EFF6FF" }}>
        <div style={{
          height: "100%", borderRadius: "100px", background: "#2563EB",
          width: ready ? `${Math.min((stats.outlets / Math.max(stats.outlets, 20)) * 100, 100)}%` : "0%",
          transition: ready ? "width 1s cubic-bezier(.4,0,.2,1) 0ms" : "none",
        }} />
      </div>
    </div>
  );
}

/* ── Main Dashboard ── */
export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ businesses: 0, outlets: 0, managers: 0, staff: 0, skills: 0, krewbyWorkers: 0 });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [fading, setFading] = useState(false);
  const goTo = useGoTo();

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          { count: bizCount }, { count: outletCount }, { count: mgr }, { count: stf }, { count: skl }, { count: kw },
        ] = await Promise.all([
          supabase.from("businesses").select("*", { count: "exact", head: true }),
          supabase.from("outlets").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "outlet_manager"),
          supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("skills").select("*", { count: "exact", head: true }),
          supabase.from("krewby_workers").select("*", { count: "exact", head: true }).eq("is_active", true),
        ]);
        if (!cancelled) {
          setStats({ businesses: bizCount || 0, outlets: outletCount || 0, managers: mgr || 0, staff: stf || 0, skills: skl || 0, krewbyWorkers: kw || 0 });
          setLoading(false);
          // small delay so CSS animations fire after paint
          setTimeout(() => setReady(true), 30);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label: "Outlet Managers", value: stats.managers,      icon: icons.managers, color: "#059669", bg: "#ECFDF5", link: "/system-admin/managers" },
    { label: "Active Staff",    value: stats.staff,         icon: icons.staff,    color: "#D97706", bg: "#FFFBEB", link: "/system-admin/staff" },
    { label: "Skill Tags",      value: stats.skills,        icon: icons.skills,   color: "#7C3AED", bg: "#F5F3FF", link: "/system-admin/skills" },
    { label: "Krewby Workers",  value: stats.krewbyWorkers, icon: icons.workers,  color: "#DB2777", bg: "#FDF2F8", link: "/system-admin/krewby-workers" },
  ];

  const reportsIcon = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>;

  const actions = [
    { label: "Businesses",     desc: "Browse businesses & outlets",         icon: icons.outlets,  color: "#2563EB", bg: "#EFF6FF", link: "/system-admin/businesses" },
    { label: "Managers",       desc: "View outlet managers",                icon: icons.managers, color: "#059669", bg: "#ECFDF5", link: "/system-admin/managers" },
    { label: "Staff",          desc: "Browse all staff across platform",    icon: icons.staff,    color: "#D97706", bg: "#FFFBEB", link: "/system-admin/staff" },
    { label: "Skill Tags",     desc: "View skill categories",               icon: icons.skills,   color: "#7C3AED", bg: "#F5F3FF", link: "/system-admin/skills" },
    { label: "Krewby Workers", desc: "Monitor casual worker pool",          icon: icons.workers,  color: "#DB2777", bg: "#FDF2F8", link: "/system-admin/krewby-workers" },
    { label: "Reports",        desc: "Platform analytics & reports",        icon: reportsIcon,    color: "#0891B2", bg: "#ECFEFF", link: "/system-admin/reports" },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div style={{ animation: fading ? "pageOut 0.28s ease forwards" : "pageIn 0.4s ease both" }}>
      {/* ── Welcome bar ── */}
      <div style={{ ...s.welcomeBar, animation: fading ? "none" : "fadeSlideUp 0.4s ease both" }}>
        <div>
          <h2 style={s.welcomeTitle}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Admin"}
          </h2>
          <p style={s.welcomeDate}>{today}</p>
        </div>
        <div style={s.badgeRow}>
          <span style={s.liveDot} />
          <span style={s.adminBadge}>System Admin</span>
        </div>
      </div>

      {/* ── Overview ── */}
      <p style={{ ...s.sectionLabel, animation: "fadeSlideUp 0.4s ease 60ms both" }}>OVERVIEW</p>

      <div style={s.statsGrid}>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : [
              <BizOutletCard key="biz" stats={stats} ready={ready} goTo={goTo} />,
              ...cards.map((card, i) => <StatCard key={card.label} card={card} index={i + 1} ready={ready} goTo={goTo} />),
            ]
        }
      </div>

      {/* ── Bottom section ── */}
      {!loading && <BottomSection stats={stats} actions={actions} ready={ready} goTo={goTo} />}
      </div>
    </AdminLayout>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const shimmerBg = "linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)";

const s = {
  welcomeBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px",
  },
  welcomeTitle: {
    fontSize: "22px", fontWeight: "700", color: "#0F172A",
    letterSpacing: "-0.02em", marginBottom: "4px",
  },
  welcomeDate: { fontSize: "13px", color: "#94A3B8", fontWeight: "400" },
  badgeRow: { display: "flex", alignItems: "center", gap: "8px" },
  liveDot: {
    width: "7px", height: "7px", borderRadius: "50%", background: "#22C55E",
    animation: "pulse 2s ease-in-out infinite", flexShrink: 0,
  },
  adminBadge: {
    background: "#0F172A", color: "#FFFFFF", fontSize: "11px",
    fontWeight: "600", padding: "5px 12px", borderRadius: "100px",
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  sectionLabel: {
    fontSize: "11px", fontWeight: "700", color: "#94A3B8",
    letterSpacing: "0.08em", marginBottom: "12px",
  },

  /* Stats grid */
  statsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px",
  },
  statCard: {
    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px",
    padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  statCardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px",
  },
  statIconBox: {
    width: "40px", height: "40px", borderRadius: "10px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  statValue: {
    fontSize: "30px", fontWeight: "700", color: "#0F172A",
    lineHeight: 1, letterSpacing: "-0.02em", marginBottom: "4px",
  },
  statLabel: {
    fontSize: "12px", fontWeight: "600", color: "#64748B",
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px",
  },
  statBar: { height: "3px", borderRadius: "100px", overflow: "hidden" },

  /* Skeleton */
  skeletonCard: {
    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px",
  },
  skeletonBox: {
    background: shimmerBg, backgroundSize: "600px 100%",
    animation: "shimmer 1.4s ease-in-out infinite",
  },

  /* Activity graphic */
  activityCard: {
    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px",
    padding: "20px 24px", marginTop: "14px",
  },
  activityTitle: {
    fontSize: "12px", fontWeight: "700", color: "#94A3B8",
    letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "16px",
  },
  activityBars: { display: "flex", flexDirection: "column", gap: "10px" },
  activityBarRow: { display: "flex", alignItems: "center", gap: "12px" },
  activityBarLabel: { fontSize: "12px", color: "#64748B", fontWeight: "500", width: "58px", flexShrink: 0 },
  activityBarTrack: { flex: 1, height: "8px", background: "#F1F5F9", borderRadius: "4px", overflow: "hidden" },
  activityBarVal: { fontSize: "12px", fontWeight: "700", width: "28px", textAlign: "right", flexShrink: 0 },

  /* Actions */
  actionsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px",
  },
  actionCard: {
    display: "flex", alignItems: "center", gap: "14px",
    padding: "16px 18px", border: "1px solid #E2E8F0",
    borderRadius: "12px", cursor: "pointer", textAlign: "left", width: "100%",
  },
  actionIconWrap: {
    width: "36px", height: "36px", borderRadius: "8px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  actionBody: { display: "flex", flexDirection: "column", flex: 1, gap: "3px" },
  actionLabel: { fontSize: "13px", fontWeight: "600", lineHeight: 1.3 },
  actionDesc: { fontSize: "11px", lineHeight: 1.4 },
};
