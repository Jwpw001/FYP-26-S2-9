import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { getUser } from "../../utils/auth";

const icons = {
  outlets: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  managers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  staff: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  skills: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  workers: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  ),
  arrow: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const user = getUser();
  const [stats, setStats] = useState({ businesses: 0, managers: 0, staff: 0, skills: 0, krewbyWorkers: 0 });
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          { count: biz },
          { count: mgr },
          { count: stf },
          { count: skl },
          { count: kw },
        ] = await Promise.all([
          supabase.from("outlets").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "outlet_manager"),
          supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("skills").select("*", { count: "exact", head: true }),
          supabase.from("krewby_workers").select("*", { count: "exact", head: true }).eq("is_active", true),
        ]);
        if (!cancelled) setStats({ businesses: biz || 0, managers: mgr || 0, staff: stf || 0, skills: skl || 0, krewbyWorkers: kw || 0 });
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const cards = [
    { label: "Outlets",         value: stats.businesses,    icon: icons.outlets,  color: "#2563EB", bg: "#EFF6FF", link: "/system-admin/businesses" },
    { label: "Outlet Managers", value: stats.managers,      icon: icons.managers, color: "#059669", bg: "#ECFDF5", link: "/system-admin/managers" },
    { label: "Active Staff",    value: stats.staff,         icon: icons.staff,    color: "#D97706", bg: "#FFFBEB", link: "/system-admin/managers" },
    { label: "Skill Tags",      value: stats.skills,        icon: icons.skills,   color: "#7C3AED", bg: "#F5F3FF", link: "/system-admin/skills" },
    { label: "Krewby Workers",  value: stats.krewbyWorkers, icon: icons.workers,  color: "#DB2777", bg: "#FDF2F8", link: "/system-admin/krewby-workers" },
  ];

  const actions = [
    { label: "Register Business", desc: "Add a new outlet to the system",       icon: icons.outlets,  link: "/system-admin/businesses/new" },
    { label: "Add Manager",       desc: "Assign a manager to an outlet",         icon: icons.managers, link: "/system-admin/managers/new" },
    { label: "Manage Skill Tags", desc: "Create and edit skill categories",      icon: icons.skills,   link: "/system-admin/skills" },
    { label: "Add Krewby Worker", desc: "Register a new casual worker profile",  icon: icons.workers,  link: "/system-admin/krewby-workers/new" },
  ];

  if (loading) {
    return (
      <AdminLayout title="Dashboard">
        <div style={s.loadingWrap}>
          <div style={s.spinner} />
          <p style={s.loadingText}>Loading dashboard...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Dashboard">
      {/* Welcome Header */}
      <div style={s.welcomeBar}>
        <div>
          <h2 style={s.welcomeTitle}>
            Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Admin"}
          </h2>
          <p style={s.welcomeDate}>{today}</p>
        </div>
        <span style={s.adminBadge}>System Admin</span>
      </div>

      {/* Section label */}
      <p style={s.sectionLabel}>OVERVIEW</p>

      {/* Stats Grid */}
      <div style={s.statsGrid}>
        {cards.map(card => (
          <div
            key={card.label}
            style={s.statCard}
            onClick={() => navigate(card.link)}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.10)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div style={s.statCardHeader}>
              <div style={{ ...s.statIconBox, background: card.bg, color: card.color }}>
                {card.icon}
              </div>
              <div style={{ ...s.statArrow, color: card.color }}>{icons.arrow}</div>
            </div>
            <p style={s.statValue}>{card.value.toLocaleString()}</p>
            <p style={s.statLabel}>{card.label}</p>
            <div style={{ ...s.statBar, background: card.bg }}>
              <div style={{ ...s.statBarFill, background: card.color, width: `${Math.min((card.value / 20) * 100, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <p style={{ ...s.sectionLabel, marginTop: "32px" }}>QUICK ACTIONS</p>
      <div style={s.actionsGrid}>
        {actions.map(a => (
          <button
            key={a.label}
            style={s.actionCard}
            onClick={() => navigate(a.link)}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#0F172A";
              e.currentTarget.style.borderColor = "#0F172A";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "#FFFFFF";
              e.currentTarget.style.borderColor = "#E2E8F0";
            }}
          >
            <div style={s.actionIconWrap}>{a.icon}</div>
            <div style={s.actionBody}>
              <span style={s.actionLabel}>{a.label}</span>
              <span style={s.actionDesc}>{a.desc}</span>
            </div>
            <div style={s.actionChevron}>{icons.chevron}</div>
          </button>
        ))}
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

const s = {
  loadingWrap: {
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", height: "300px", gap: "14px",
  },
  spinner: {
    width: "28px", height: "28px", border: "3px solid #E2E8F0",
    borderTopColor: "#0F172A", borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: { fontSize: "14px", color: "#94A3B8", fontWeight: "500" },
  welcomeBar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "28px",
  },
  welcomeTitle: {
    fontSize: "22px", fontWeight: "700", color: "#0F172A",
    letterSpacing: "-0.02em", marginBottom: "4px",
  },
  welcomeDate: { fontSize: "13px", color: "#94A3B8", fontWeight: "400" },
  adminBadge: {
    background: "#0F172A", color: "#FFFFFF", fontSize: "11px",
    fontWeight: "600", padding: "5px 12px", borderRadius: "100px",
    letterSpacing: "0.06em", textTransform: "uppercase",
  },
  sectionLabel: {
    fontSize: "11px", fontWeight: "700", color: "#94A3B8",
    letterSpacing: "0.08em", marginBottom: "12px",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "14px",
  },
  statCard: {
    background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px",
    padding: "20px", cursor: "pointer",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
  },
  statCardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    marginBottom: "16px",
  },
  statIconBox: {
    width: "40px", height: "40px", borderRadius: "10px",
    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  statArrow: { opacity: 0.5, marginTop: "2px" },
  statValue: {
    fontSize: "30px", fontWeight: "700", color: "#0F172A",
    lineHeight: 1, letterSpacing: "-0.02em", marginBottom: "4px",
  },
  statLabel: {
    fontSize: "12px", fontWeight: "600", color: "#64748B",
    textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px",
  },
  statBar: { height: "3px", borderRadius: "100px", overflow: "hidden" },
  statBarFill: { height: "100%", borderRadius: "100px", transition: "width 0.6s ease" },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "12px",
  },
  actionCard: {
    display: "flex", alignItems: "center", gap: "14px",
    padding: "16px 18px", background: "#FFFFFF",
    border: "1px solid #E2E8F0", borderRadius: "12px",
    cursor: "pointer", textAlign: "left", width: "100%",
    transition: "background 0.15s ease, border-color 0.15s ease",
    color: "#0F172A",
  },
  actionIconWrap: {
    width: "36px", height: "36px", borderRadius: "8px",
    background: "#F1F5F9", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0, color: "#475569",
  },
  actionBody: { display: "flex", flexDirection: "column", flex: 1, gap: "3px" },
  actionLabel: { fontSize: "13px", fontWeight: "600", lineHeight: 1.3 },
  actionDesc: { fontSize: "11px", color: "#94A3B8", lineHeight: 1.4 },
  actionChevron: { opacity: 0.35, flexShrink: 0 },
};
