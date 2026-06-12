import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { clearUser, getUser } from "../../utils/auth";
import { useState, useEffect } from "react";

const NAV = [
  { label: "Dashboard",    path: "/outlet-casual-staff/dashboard",    icon: "⊞" },
  { label: "My Shifts",    path: "/outlet-casual-staff/shifts",       icon: "📅" },
  { label: "Availability", path: "/outlet-casual-staff/availability", icon: "🗓" },
];

export default function CasualLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.user_id) return;
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.user_id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
  }, [user?.user_id]);

  async function handleLogout() {
    await supabase.auth.signOut();
    clearUser();
    navigate("/login", { replace: true });
  }

  const onNotifPage = location.pathname === "/outlet-casual-staff/notifications";

  return (
    <div style={s.shell}>
      <aside style={{ ...s.sidebar, ...(open ? s.sidebarOpen : {}) }}>
        <div style={s.sidebarTop}>
          <Link to="/outlet-casual-staff/dashboard" style={s.logoRow}>
            <div style={s.logoBox}>K</div>
            <span style={s.logoText}>Krewby</span>
          </Link>
        </div>
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}
                onClick={() => setOpen(false)}>
                <span style={s.navIcon}>{item.icon}</span>
                <span style={{ color: active ? "#93C5FD" : "inherit" }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userRow}>
            <div style={s.avatar}>{user?.full_name?.[0]?.toUpperCase() || "C"}</div>
            <div style={{ overflow: "hidden" }}>
              <p style={s.userName}>{user?.full_name || "Casual Staff"}</p>
              <p style={s.userRole}>Outlet Casual Staff</p>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}>Sign out</button>
        </div>
      </aside>
      {open && <div style={s.overlay} onClick={() => setOpen(false)} />}
      <div style={s.main}>
        <header style={s.topbar}>
          <h1 style={s.pageTitle}>{title}</h1>
          <div style={{ flex: 1 }} />
          {/* Notification bell */}
          <button
            onClick={() => navigate("/outlet-casual-staff/notifications")}
            style={{
              position: "relative", background: onNotifPage ? "#EFF6FF" : "none",
              border: onNotifPage ? "1.5px solid #BFDBFE" : "1px solid transparent",
              borderRadius: "10px", padding: "7px 9px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
            <svg width="20" height="20" fill="none" stroke={onNotifPage ? "#2563EB" : "#64748B"} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position: "absolute", top: "4px", right: "4px",
                background: "#EF4444", color: "#FFF",
                fontSize: "10px", fontWeight: "700",
                width: "16px", height: "16px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </header>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: {
    width: "220px", minHeight: "100vh", background: "#0F172A",
    display: "flex", flexDirection: "column", position: "sticky", top: 0,
    flexShrink: 0, zIndex: 200, transition: "transform 0.25s ease",
  },
  sidebarOpen: { position: "fixed", left: 0, top: 0, height: "100vh" },
  sidebarTop: { padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoBox: {
    width: "32px", height: "32px", borderRadius: "8px",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "15px",
    fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center",
  },
  logoText: { fontSize: "16px", fontWeight: "800", color: "#FFFFFF" },
  nav: { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  navItem: {
    display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px",
    borderRadius: "9px", fontSize: "14px", fontWeight: "500",
    color: "rgba(255,255,255,0.55)", textDecoration: "none", transition: "all 0.15s",
  },
  navItemActive: { background: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  navIcon: { fontSize: "15px", width: "20px", textAlign: "center", flexShrink: 0 },
  sidebarBottom: { padding: "16px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  userRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  avatar: {
    width: "32px", height: "32px", borderRadius: "50%",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "13px",
    fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  userName: { fontSize: "13px", fontWeight: "600", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "11px", color: "rgba(255,255,255,0.4)", marginTop: "1px" },
  logoutBtn: {
    width: "100%", padding: "8px", background: "rgba(255,255,255,0.07)",
    border: "none", borderRadius: "8px", color: "rgba(255,255,255,0.55)",
    fontSize: "13px", fontWeight: "500", cursor: "pointer",
  },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 199 },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 },
  topbar: {
    height: "60px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
    display: "flex", alignItems: "center", padding: "0 28px", gap: "16px",
    position: "sticky", top: 0, zIndex: 100,
  },
  menuBtn: { background: "none", border: "none", fontSize: "20px", color: "#1E293B", cursor: "pointer", padding: "4px" },
  pageTitle: { fontSize: "17px", fontWeight: "700", color: "#1E293B" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
