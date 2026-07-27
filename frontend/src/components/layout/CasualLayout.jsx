import { useState, useEffect } from "react";
import SignOutButton from "../SignOutButton";
import AIAssistantWidget from "../AIAssistantWidget";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { LayoutDashboard, Building2, CalendarClock, CalendarDays, ArrowLeftRight } from "lucide-react";
import "./sidebarStyles.js";
import ProfileModal from "../ProfileModal";
import UserAvatar from "../UserAvatar";

const NAV = [
  { label: "Dashboard",    path: "/casual-staff/dashboard",    Icon: LayoutDashboard },
  { label: "Tasks",        path: "/casual-staff/shifts",       Icon: CalendarDays },
  { label: "Availability",  path: "/casual-staff/availability",   Icon: CalendarClock },
  { label: "Swap Requests", path: "/casual-staff/swap-requests", Icon: ArrowLeftRight },
  { label: "Branches",      path: "/casual-staff/branches",      Icon: Building2 },
];

export default function CasualLayout({ children, title }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = getUser();
  const [expanded, setExpanded]   = useState(false);
  const [unread, setUnread]       = useState(0);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!user?.user_id) return;
    supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("recipient_id", user.user_id)
      .eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
  }, [user?.user_id]);

  const onNotifPage = location.pathname === "/casual-staff/notifications";

  return (
    <div style={s.shell}>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ ...s.sidebar, width: expanded ? "220px" : "64px" }}>

        <div style={{ ...s.sidebarTop, padding: "20px 14px 16px" }}>
          <Link to="/casual-staff/dashboard" style={s.logoRow}>
            <div style={{ height: "34px", width: "34px", background: "#fff", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/logo_noText.png" alt="Krewby" style={{ height: "26px", width: "26px", objectFit: "contain", display: "block" }} />
            </div>
          </Link>
        </div>

        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} title={item.label}
                className={`sidebar-nav-item${active ? " sidebar-nav-active" : ""}`}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}>
                <span style={s.navIcon}><item.Icon size={18} strokeWidth={1.8} /></span>
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
            <UserAvatar name={user?.full_name || "C"} avatar_url={user?.avatar_url} size={34} />
            <div style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "140px" : "0px", transition: "opacity 0.25s ease, max-width 0.25s ease", overflow: "hidden" }}>
              <p style={s.userName}>{user?.full_name || "Casual Worker"}</p>
              <p style={s.userRole}>Casual Worker</p>
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
            onClick={() => navigate("/casual-staff/notifications")}
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
              <span style={{ position: "absolute", top: "4px", right: "4px", background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>
        </header>
        <div style={s.content}>{children}</div>
      </div>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <AIAssistantWidget />
    </div>
  );
}

const s = {
  shell:   { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: { height: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, zIndex: 300, transition: "width 0.25s ease", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoBox: { width: "34px", height: "34px", borderRadius: "9px", background: "#3B82F6", color: "#FFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText: { fontSize: "17px", fontWeight: "800", color: "#FFF", letterSpacing: "-0.01em" },
  nav:     { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" },
  navItem: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", fontSize: "14px", fontWeight: "500", color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "background 0.15s, color 0.15s" },
  navItemActive: { background: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  navIcon: { fontSize: "16px", width: "20px", textAlign: "center", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" },
  sidebarBottom: { padding: "16px", borderTop: "1px solid rgba(255,255,255,0.08)" },
  userRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" },
  avatar:  { width: "34px", height: "34px", borderRadius: "50%", background: "#3B82F6", color: "#FFF", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userName: { fontSize: "13px", fontWeight: "600", color: "#FFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "1px" },
  main:    { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "64px" },
  topbar:  { height: "60px", background: "#FFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 28px", gap: "16px", position: "sticky", top: 0, zIndex: 100 },
  pageTitle: { fontSize: "17px", fontWeight: "700", color: "#1E293B" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
