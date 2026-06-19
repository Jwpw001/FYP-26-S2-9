import { useNavigate, useLocation, Link } from "react-router-dom";
import { getUser } from "../../utils/auth";
import { useState, useEffect } from "react";
import SignOutButton from "../SignOutButton";
import { supabase } from "../../lib/supabaseClient";
import { LayoutDashboard, Building2, Users, UserPlus, BarChart2, Tag } from "lucide-react";

const NAV = [
  { label: "Dashboard",  path: "/business-owner/dashboard",    Icon: LayoutDashboard },
  { label: "Outlets",    path: "/business-owner/outlets",      Icon: Building2 },
  { label: "All Staff",  path: "/business-owner/staff",        Icon: Users },
  { label: "Invitations",path: "/business-owner/invitations",  Icon: UserPlus },
  { label: "Skill Tags", path: "/business-owner/skills",       Icon: Tag },
  { label: "Reports",    path: "/business-owner/reports",      Icon: BarChart2 },
];

const PLAN_BADGE = {
  free:       { label: "Free",       color: "#94A3B8", bg: "rgba(148,163,184,0.15)", dot: "#94A3B8" },
  premium:    { label: "Premium",    color: "#60A5FA", bg: "rgba(96,165,250,0.15)",  dot: "#3B82F6" },
  enterprise: { label: "Enterprise", color: "#C084FC", bg: "rgba(192,132,252,0.15)", dot: "#A855F7" },
};

export default function BusinessOwnerLayout({ children, title }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const [expanded, setExpanded] = useState(false);
  const [unread, setUnread] = useState(0);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!user?.user_id) return;
    supabase.from("notifications").select("*", { count: "exact", head: true })
      .eq("recipient_id", user.user_id).eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
    supabase.from("businesses").select("plan").eq("owner_id", user.user_id).maybeSingle()
      .then(({ data }) => data?.plan && setPlan(data.plan));
  }, [user?.user_id]);

  const pb = plan ? (PLAN_BADGE[plan] || PLAN_BADGE.free) : null;

  return (
    <div style={s.shell}>
      <aside onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
        style={{ ...s.sidebar, width: expanded ? "220px" : "64px" }}>
        <div style={{ ...s.sidebarTop }}>
          <Link to="/business-owner/dashboard" style={s.logoRow}>
            <div style={s.logoBox}>K</div>
            <span style={{ ...s.logoText, opacity: expanded ? 1 : 0, maxWidth: expanded ? "120px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>Krewby</span>
          </Link>
          <div style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "30px" : "0px", transition: "opacity 0.25s, max-height 0.25s", overflow: "hidden", marginTop: "8px" }}>
            <span style={s.badge}>Business Owner</span>
          </div>
        </div>
        <nav style={s.nav}>
          {NAV.map(item => {
            const active = location.pathname.startsWith(item.path);
            return (
              <Link key={item.path} to={item.path} title={item.label}
                className={`sidebar-nav-item${active ? " sidebar-nav-active" : ""}`}
                style={{ ...s.navItem, ...(active ? s.navItemActive : {}) }}>
                <span style={s.navIcon}><item.Icon size={18} strokeWidth={1.8} /></span>
                <span style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div style={s.sidebarBottom}>
          {/* Plan indicator */}
          {pb && (
            <div style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px", padding: "0 4px" }}>
              {/* Dot — always visible */}
              <div title={`${pb.label} plan`} style={{ width: "8px", height: "8px", borderRadius: "50%", background: pb.dot, flexShrink: 0, boxShadow: `0 0 6px ${pb.dot}` }} />
              {/* Label — only when expanded */}
              <div style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: pb.color, background: pb.bg, padding: "2px 9px", borderRadius: "100px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {pb.label} Plan
                </span>
              </div>
            </div>
          )}

          <div style={{ ...s.userRow, marginBottom: "10px" }}>
            <div style={{ ...s.avatar, flexShrink: 0 }}>{user?.full_name?.[0]?.toUpperCase() || "B"}</div>
            <div style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "140px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden" }}>
              <p style={s.userName}>{user?.full_name || "Business Owner"}</p>
              <p style={s.userRole}>Business Owner</p>
            </div>
          </div>
          <div style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "40px" : "0px", transition: "opacity 0.25s, max-height 0.25s", overflow: "hidden" }}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div style={s.main}>
        <header style={s.topbar}>
          <h1 style={s.pageTitle}>{title}</h1>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigate("/business-owner/notifications")} style={{ position: "relative", background: "none", border: "1px solid transparent", borderRadius: "10px", padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && <span style={{ position: "absolute", top: "4px", right: "4px", background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", width: "16px", height: "16px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{unread > 9 ? "9+" : unread}</span>}
          </button>
        </header>
        <div style={s.content}>{children}</div>
      </div>
    </div>
  );
}

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  sidebar: { height: "100vh", background: "#0F172A", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, zIndex: 300, transition: "width 0.25s ease", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { padding: "20px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoBox: { width: "34px", height: "34px", borderRadius: "9px", background: "#F59E0B", color: "#1C1917", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText: { fontSize: "17px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.01em" },
  badge: { display: "inline-block", background: "rgba(245,158,11,0.2)", color: "#FCD34D", fontSize: "10px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(245,158,11,0.3)", whiteSpace: "nowrap" },
  nav: { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  navItem: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", fontSize: "14px", fontWeight: "500", color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "background 0.15s, color 0.15s" },
  navItemActive: { background: "rgba(245,158,11,0.15)", color: "#FCD34D" },
  navIcon: { width: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sidebarBottom: { padding: "12px", borderTop: "1px solid rgba(255,255,255,0.08)" },
  userRow: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", background: "#F59E0B", color: "#1C1917", fontSize: "14px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userName: { fontSize: "13px", fontWeight: "600", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "11px", color: "rgba(255,255,255,0.45)", marginTop: "1px" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "64px" },
  topbar: { height: "60px", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 28px", gap: "16px", position: "sticky", top: 0, zIndex: 100 },
  pageTitle: { fontSize: "17px", fontWeight: "700", color: "#1E293B" },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
