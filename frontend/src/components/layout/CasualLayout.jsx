import { useState, useEffect } from "react";
import SignOutButton from "../SignOutButton";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { LayoutDashboard, Briefcase, ClipboardList, Bell } from "lucide-react";
import ProfileModal from "../ProfileModal";

const NAV = [
  { label: "Dashboard",    path: "/outlet-casual-staff/dashboard",    Icon: LayoutDashboard },
  { label: "Browse Jobs",  path: "/outlet-casual-staff/requests",     Icon: Briefcase },
  { label: "My Applications", path: "/outlet-casual-staff/my-applications", Icon: ClipboardList },
];

export default function CasualLayout({ children, title }) {
  const navigate  = useNavigate();
  const location  = useLocation();
  const user      = getUser();
  const [expanded, setExpanded] = useState(false);
  const [unread, setUnread]     = useState(0);
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

  return (
    <div style={s.shell}>
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{ ...s.sidebar, width: expanded ? "220px" : "64px" }}>

        <div style={{ padding: "20px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <Link to="/outlet-casual-staff/dashboard" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
            <div style={s.logoBox}>K</div>
            <span style={{ fontSize: "17px", fontWeight: "800", color: "#FFF", opacity: expanded ? 1 : 0, transition: "opacity 0.25s", whiteSpace: "nowrap" }}>Krewby</span>
          </Link>
        </div>

        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} title={item.label}
                style={{ ...s.navItem, ...(active ? s.navActive : {}) }}>
                <span style={s.navIcon}><item.Icon size={18} strokeWidth={1.8} /></span>
                <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button onClick={() => setShowProfile(true)} title="View profile"
            style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <div style={s.avatar}>{user?.full_name?.[0]?.toUpperCase() || "C"}</div>
            <div style={{ opacity: expanded ? 1 : 0, transition: "opacity 0.25s", overflow: "hidden" }}>
              <p style={{ fontSize: "13px", fontWeight: "600", color: "#FFF", whiteSpace: "nowrap" }}>{user?.full_name || "Casual Worker"}</p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)" }}>Casual</p>
            </div>
          </button>
          <div style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "40px" : "0px", transition: "opacity 0.25s, max-height 0.25s", overflow: "hidden" }}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div style={s.main}>
        <header style={s.topbar}>
          <h1 style={s.pageTitle}>{title}</h1>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigate("/outlet-casual-staff/notifications")}
            style={{ position: "relative", background: "none", border: "1px solid transparent", borderRadius: "10px", padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <Bell size={20} color="#64748B" />
            {unread > 0 && (
              <span style={{ position: "absolute", top: "4px", right: "4px", background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  shell:   { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: { height: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, zIndex: 300, transition: "width 0.25s ease", overflow: "hidden", flexShrink: 0 },
  logoBox: { width: "34px", height: "34px", borderRadius: "9px", background: "#F59E0B", color: "#1C1917", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  nav:     { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  navItem: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", fontSize: "14px", fontWeight: "500", color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "background 0.15s, color 0.15s" },
  navActive: { background: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  navIcon: { width: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatar:  { width: "34px", height: "34px", borderRadius: "50%", background: "#F59E0B", color: "#1C1917", fontSize: "14px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  main:    { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "64px" },
  topbar:  { height: "60px", background: "#FFF", borderBottom: "1px solid #E5E2DC", display: "flex", alignItems: "center", padding: "0 28px", gap: "16px", position: "sticky", top: 0, zIndex: 100 },
  pageTitle: { fontSize: "17px", fontWeight: "700", color: "#1C1B18" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
