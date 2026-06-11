import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { clearUser, getUser } from "../../utils/auth";
import { useState } from "react";

const NavIcons = {
  Dashboard: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  Businesses: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  Managers: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  "Skill Tags": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <line x1="7" y1="7" x2="7.01" y2="7"/>
    </svg>
  ),
  "Krewby Workers": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
    </svg>
  ),
};

const HamburgerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

const NAV = [
  { label: "Dashboard",      path: "/system-admin/dashboard" },
  { label: "Businesses",     path: "/system-admin/businesses" },
  { label: "Managers",       path: "/system-admin/managers" },
  { label: "Skill Tags",     path: "/system-admin/skills" },
  { label: "Krewby Workers", path: "/system-admin/krewby-workers" },
];

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearUser();
    navigate("/login", { replace: true });
  }

  return (
    <div style={s.shell}>
      <aside style={{ ...s.sidebar, ...(open ? s.sidebarOpen : {}) }}>
        {/* Logo */}
        <div style={s.sidebarTop}>
          <Link to="/system-admin/dashboard" style={s.logoRow}>
            <div style={s.logoBox}>K</div>
            <span style={s.logoText}>Krewby</span>
          </Link>
          <span style={s.adminBadge}>Admin</span>
        </div>

        {/* Nav */}
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => setOpen(false)}
              >
                <span style={{ ...s.navIcon, color: active ? "#93C5FD" : "rgba(255,255,255,0.45)" }}>
                  {NavIcons[item.label]}
                </span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User + Logout */}
        <div style={s.sidebarBottom}>
          <div style={s.userRow}>
            <div style={s.avatar}>{user?.full_name?.[0]?.toUpperCase() || "A"}</div>
            <div style={s.userInfo}>
              <p style={s.userName}>{user?.full_name || "Admin"}</p>
              <p style={s.userRole}>System Admin</p>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>

      {open && <div style={s.overlay} onClick={() => setOpen(false)} />}

      <div style={s.main}>
        <header style={s.topbar}>
          <button style={s.menuBtn} onClick={() => setOpen(!open)}>
            <HamburgerIcon />
          </button>
          <h1 style={s.pageTitle}>{title}</h1>
        </header>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: {
    width: "224px", minHeight: "100vh", background: "#0F172A",
    display: "flex", flexDirection: "column",
    position: "sticky", top: 0, flexShrink: 0, zIndex: 200,
    transition: "transform 0.25s ease",
  },
  sidebarOpen: { position: "fixed", left: 0, top: 0, height: "100vh" },
  sidebarTop: {
    padding: "24px 20px 18px",
    borderBottom: "1px solid rgba(255,255,255,0.07)",
  },
  logoRow: {
    display: "flex", alignItems: "center", gap: "10px",
    textDecoration: "none", marginBottom: "12px",
  },
  logoBox: {
    width: "30px", height: "30px", borderRadius: "7px",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "14px",
    fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: "15px", fontWeight: "700", color: "#FFFFFF", letterSpacing: "-0.01em" },
  adminBadge: {
    display: "inline-block", background: "rgba(59,130,246,0.15)",
    color: "#60A5FA", fontSize: "10px", fontWeight: "600",
    padding: "3px 8px", borderRadius: "100px", letterSpacing: "0.06em",
    textTransform: "uppercase", border: "1px solid rgba(59,130,246,0.25)",
  },
  nav: {
    flex: 1, padding: "14px 10px",
    display: "flex", flexDirection: "column", gap: "2px",
  },
  navItem: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "9px 12px", borderRadius: "8px",
    fontSize: "13.5px", fontWeight: "500",
    color: "rgba(255,255,255,0.55)", textDecoration: "none",
    transition: "background 0.12s ease, color 0.12s ease",
  },
  navItemActive: {
    background: "rgba(59,130,246,0.15)", color: "#93C5FD",
  },
  navIcon: {
    width: "20px", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  },
  sidebarBottom: {
    padding: "14px 16px",
    borderTop: "1px solid rgba(255,255,255,0.07)",
  },
  userRow: {
    display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px",
  },
  avatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "13px",
    fontWeight: "700", display: "flex", alignItems: "center",
    justifyContent: "center", flexShrink: 0,
  },
  userInfo: { overflow: "hidden" },
  userName: {
    fontSize: "13px", fontWeight: "600", color: "#F1F5F9",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  },
  userRole: { fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "1px" },
  logoutBtn: {
    width: "100%", padding: "8px", background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)", borderRadius: "7px",
    color: "rgba(255,255,255,0.5)", fontSize: "13px",
    fontWeight: "500", cursor: "pointer",
    transition: "background 0.12s ease",
  },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 199 },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: {
    height: "58px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
    display: "flex", alignItems: "center", padding: "0 24px", gap: "14px",
    position: "sticky", top: 0, zIndex: 100,
  },
  menuBtn: {
    background: "none", border: "none", color: "#64748B",
    cursor: "pointer", padding: "6px", display: "flex",
    alignItems: "center", justifyContent: "center", borderRadius: "6px",
  },
  pageTitle: { fontSize: "16px", fontWeight: "700", color: "#0F172A" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
