import { useNavigate, useLocation, Link } from "react-router-dom";
import { getUser } from "../../utils/auth";
import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import SignOutButton from "../SignOutButton";
import { LayoutDashboard, Building2, Users, Tag, BarChart2 } from "lucide-react"; // nav icons
import "./sidebarStyles.js";
import ProfileModal from "../ProfileModal";
import UserAvatar from "../UserAvatar";

const NAV = [
  { label: "Dashboard",      path: "/system-admin/dashboard",        Icon: LayoutDashboard },
  { label: "Businesses",     path: "/system-admin/businesses",       Icon: Building2 },
  { label: "Workers",        path: "/system-admin/staff",            Icon: Users },
  { label: "Skill Tags",     path: "/system-admin/skills",           Icon: Tag },
  { label: "Reports",        path: "/system-admin/reports",          Icon: BarChart2 },
];

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [expanded, setExpanded] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user?.user_id) return;
    supabase.from("notifications").select("*", { count: "exact", head: true })
      .eq("recipient_id", user.user_id).eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
  }, [user?.user_id]);

  return (
    <div style={s.shell}>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ ...s.sidebar, width: expanded ? "224px" : "64px" }}>
        <div style={{ ...s.sidebarTop, padding: "20px 14px 16px" }}>
          <Link to="/system-admin/dashboard" style={s.logoRow}>
            <div style={{ height: "34px", width: "34px", background: "#fff", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/logo_noText.png" alt="Krewby" style={{ height: "26px", width: "26px", objectFit: "contain", display: "block" }} />
            </div>
          </Link>
          <div style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "30px" : "0px", transition: "opacity 0.25s ease, max-height 0.25s ease", overflow: "hidden", marginTop: "8px" }}>
            <span style={s.adminBadge}>Admin</span>
          </div>
        </div>

        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} title={item.label}
                className={`sidebar-nav-item${active ? " sidebar-nav-active" : ""}`}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}>
                <span style={{ ...s.navIcon, color: active ? "#93C5FD" : "rgba(255,255,255,0.55)" }}>
                  <item.Icon size={18} strokeWidth={1.8} />
                </span>
                <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s ease, max-width 0.25s ease", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ ...s.sidebarBottom, padding: "12px" }}>
          <button onClick={() => setShowProfile(true)} title="View profile"
            style={{ ...s.userRow, marginBottom: "10px", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <UserAvatar name={user?.full_name || "A"} avatar_url={user?.avatar_url || "/avatars/default.png"} size={34} />
            <div style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "140px" : "0px", transition: "opacity 0.25s ease, max-width 0.25s ease", overflow: "hidden" }}>
              <p style={s.userName}>{user?.full_name || "Admin"}</p>
              <p style={s.userRole}>System Administrator</p>
            </div>
          </button>
          <div style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "40px" : "0px", transition: "opacity 0.25s ease, max-height 0.25s ease", overflow: "hidden" }}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div style={s.main}>
        <header style={s.topbar}>
          <h1 style={s.pageTitle}>{title}</h1>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => navigate("/system-admin/notifications")}
            style={{
              position: "relative",
              background: location.pathname === "/system-admin/notifications" ? "#EFF6FF" : "none",
              border: location.pathname === "/system-admin/notifications" ? "1.5px solid #BFDBFE" : "1px solid transparent",
              borderRadius: "10px", padding: "7px 9px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all 0.15s",
            }}>
            <svg width="20" height="20" fill="none" stroke={location.pathname === "/system-admin/notifications" ? "#2563EB" : "#64748B"} strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && (
              <span style={{
                position: "absolute", top: "2px", right: "2px",
                background: "#EF4444", color: "#FFF",
                fontSize: "10px", fontWeight: "700",
                width: "20px", height: "20px", borderRadius: "50%",
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
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: {
    height: "100vh", background: "#0F172A",
    display: "flex", flexDirection: "column",
    position: "fixed", top: 0, left: 0, zIndex: 300,
    transition: "width 0.25s ease", overflow: "hidden", flexShrink: 0,
  },
  sidebarTop: { padding: "24px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoBox: {
    width: "34px", height: "34px", borderRadius: "9px",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "21px",
    fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  logoText: { fontSize: "22px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.01em" },
  adminBadge: {
    display: "inline-block", background: "rgba(59,130,246,0.15)",
    color: "#60A5FA", fontSize: "17px", fontWeight: "600",
    padding: "3px 8px", borderRadius: "100px", letterSpacing: "0.06em",
    textTransform: "uppercase", border: "1px solid rgba(59,130,246,0.25)",
    whiteSpace: "nowrap",
  },
  nav: { flex: 1, padding: "14px 10px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" },
  navItem: {
    display: "flex", alignItems: "center", gap: "10px",
    padding: "9px 12px", borderRadius: "8px",
    fontSize: "20.5px", fontWeight: "500",
    color: "rgba(255,255,255,0.55)", textDecoration: "none",
    transition: "background 0.12s ease, color 0.12s ease",
  },
  navItemActive: { background: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  navIcon: { width: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sidebarBottom: { padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.07)" },
  userRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  avatar: {
    width: "34px", height: "34px", borderRadius: "50%",
    background: "#3B82F6", color: "#FFFFFF", fontSize: "21px",
    fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  userName: { fontSize: "20px", fontWeight: "600", color: "#F1F5F9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "18px", color: "rgba(255,255,255,0.35)", marginTop: "1px" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "64px" },
  topbar: {
    height: "58px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0",
    display: "flex", alignItems: "center", padding: "0 24px", gap: "14px",
    position: "sticky", top: 0, zIndex: 100,
  },
  pageTitle: { fontSize: "21px", fontWeight: "700", color: "#0F172A" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
