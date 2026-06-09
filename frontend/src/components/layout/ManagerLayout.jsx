import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { clearUser, getUser } from "../../utils/auth";

const NAV = [
  { label: "Dashboard",   path: "/outlet-manager/dashboard",    icon: "⊞" },
  { label: "Staff",       path: "/outlet-manager/staff",        icon: "👥" },
  { label: "Shifts",      path: "/outlet-manager/shifts",       icon: "📅" },
  { label: "Availability",path: "/outlet-manager/availability", icon: "🗓" },
  { label: "Attendance",  path: "/outlet-manager/attendance",   icon: "✅" },
  { label: "Reports",     path: "/outlet-manager/reports",      icon: "📊" },
];

export default function ManagerLayout({ children, title }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const user       = getUser();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearUser();
    navigate("/login", { replace: true });
  }

  return (
    <div style={s.shell}>
      {/* ── Sidebar ───────────────────────────────────── */}
      <aside style={{ ...s.sidebar, ...(open ? s.sidebarOpen : {}) }}>
        <div style={s.sidebarTop}>
          <Link to="/outlet-manager/dashboard" style={s.logoRow}>
            <div style={s.logoBox}>K</div>
            <span style={s.logoText}>Krewby</span>
          </Link>
        </div>

        <nav style={s.nav}>
          {NAV.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => setOpen(false)}
              >
                <span style={s.navIcon}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div style={s.sidebarBottom}>
          <div style={s.userRow}>
            <div style={s.avatar}>
              {user?.full_name?.[0]?.toUpperCase() || "M"}
            </div>
            <div style={s.userInfo}>
              <p style={s.userName}>{user?.full_name || "Manager"}</p>
              <p style={s.userRole}>Outlet Manager</p>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Mobile overlay ────────────────────────────── */}
      {open && (
        <div style={s.overlay} onClick={() => setOpen(false)} />
      )}

      {/* ── Main content ──────────────────────────────── */}
      <div style={s.main}>
        {/* Top bar */}
        <header style={s.topbar}>
          <button style={s.menuBtn} onClick={() => setOpen(!open)}>
            ☰
          </button>
          <h1 style={s.pageTitle}>{title}</h1>
        </header>

        <div style={s.content}>
          {children}
        </div>
      </div>
    </div>
  );
}

const s = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    background: "#F7F6F3",
  },

  /* Sidebar */
  sidebar: {
    width: "240px",
    minHeight: "100vh",
    background: "#1C1B18",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    flexShrink: 0,
    zIndex: 200,
    transition: "transform 0.25s ease",
  },
  sidebarOpen: {
    position: "fixed",
    left: 0,
    top: 0,
    height: "100vh",
  },
  sidebarTop: {
    padding: "24px 20px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    textDecoration: "none",
  },
  logoBox: {
    width: "34px",
    height: "34px",
    borderRadius: "9px",
    background: "rgba(255,255,255,0.12)",
    color: "#FFFFFF",
    fontSize: "16px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoText: {
    fontSize: "17px",
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: "-0.01em",
  },

  /* Nav */
  nav: {
    flex: 1,
    padding: "16px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "9px 12px",
    borderRadius: "9px",
    fontSize: "14px",
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textDecoration: "none",
    transition: "background 0.15s, color 0.15s",
  },
  navItemActive: {
    background: "rgba(255,255,255,0.1)",
    color: "#FFFFFF",
  },
  navIcon: {
    fontSize: "16px",
    width: "20px",
    textAlign: "center",
    flexShrink: 0,
  },

  /* Sidebar bottom */
  sidebarBottom: {
    padding: "16px",
    borderTop: "1px solid rgba(255,255,255,0.08)",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "12px",
  },
  avatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "rgba(255,255,255,0.15)",
    color: "#FFFFFF",
    fontSize: "14px",
    fontWeight: "700",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  userInfo: {
    overflow: "hidden",
  },
  userName: {
    fontSize: "13px",
    fontWeight: "600",
    color: "#FFFFFF",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: "11px",
    color: "rgba(255,255,255,0.45)",
    marginTop: "1px",
  },
  logoutBtn: {
    width: "100%",
    padding: "8px",
    background: "rgba(255,255,255,0.07)",
    border: "none",
    borderRadius: "8px",
    color: "rgba(255,255,255,0.6)",
    fontSize: "13px",
    fontWeight: "500",
    cursor: "pointer",
    textAlign: "center",
  },

  /* Overlay */
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 199,
    display: "none",
  },

  /* Main */
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  topbar: {
    height: "60px",
    background: "#FFFFFF",
    borderBottom: "1px solid #E5E2DC",
    display: "flex",
    alignItems: "center",
    padding: "0 28px",
    gap: "16px",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  menuBtn: {
    background: "none",
    border: "none",
    fontSize: "20px",
    color: "#1C1B18",
    cursor: "pointer",
    display: "none",
    padding: "4px",
  },
  pageTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "#1C1B18",
  },
  content: {
    flex: 1,
    padding: "28px",
    boxSizing: "border-box",
  },
};
