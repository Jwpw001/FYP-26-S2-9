import { useNavigate, useLocation, Link } from "react-router-dom";
import { getUser } from "../../utils/auth";
import { useState, useEffect } from "react";
import SignOutButton from "../SignOutButton";
import { supabase } from "../../lib/supabaseClient";
import { LayoutDashboard, Building2, Users, UserPlus, BarChart2, Tag, Settings2, Menu, X } from "lucide-react";
import ProfileModal from "../ProfileModal";
import AIAssistantWidget from "../AIAssistantWidget";
import UserAvatar from "../UserAvatar";

const NAV = [
  { label: "Dashboard",   path: "/business-owner/dashboard",    Icon: LayoutDashboard },
  { label: "Branches",    path: "/business-owner/branches",      Icon: Building2 },
  { label: "Workforce",    path: "/business-owner/staff",        Icon: Users },
  { label: "Invitations", path: "/business-owner/invitations",  Icon: UserPlus },
  { label: "Skill Tags",  path: "/business-owner/skills",       Icon: Tag },
  { label: "Reports",     path: "/business-owner/reports",      Icon: BarChart2 },
  { label: "Settings",    path: "/business-owner/settings",     Icon: Settings2 },
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
  const [showProfile, setShowProfile] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!user?.user_id) return;
    supabase.from("notifications").select("*", { count: "exact", head: true })
      .eq("recipient_id", user.user_id).eq("is_read", false)
      .then(({ count }) => setUnread(count || 0));
    supabase.from("businesses").select("plan").eq("owner_id", user.user_id).maybeSingle()
      .then(({ data }) => data?.plan && setPlan(data.plan));
  }, [user?.user_id]);

  useEffect(() => { setMobileNavOpen(false); }, [location.pathname]);

  const pb = plan ? (PLAN_BADGE[plan] || PLAN_BADGE.free) : null;

  return (
    <div style={s.shell}>
      <div
        className={`dash-overlay${mobileNavOpen ? " dash-overlay-open" : ""}`}
        onClick={() => setMobileNavOpen(false)}
      />
      <aside
        className={`dash-sidebar${mobileNavOpen ? " dash-sidebar-open" : ""}`}
        onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
        style={{ ...s.sidebar, width: expanded ? "220px" : "64px" }}>
        <div style={{ ...s.sidebarTop, paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
          <Link to="/business-owner/dashboard" style={s.logoRow}>
            <div style={{ height: "34px", width: "34px", background: "#fff", borderRadius: "9px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <img src="/logo_noText.png" alt="Krewby" style={{ height: "26px", width: "26px", objectFit: "contain", display: "block" }} />
            </div>
          </Link>
          <div className="dash-sidebar-label" style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "30px" : "0px", transition: "opacity 0.25s, max-height 0.25s", overflow: "hidden", marginTop: "8px" }}>
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
                <span className="dash-sidebar-label" style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>{item.label}</span>
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
              <div className="dash-sidebar-label" style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "160px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden", whiteSpace: "nowrap" }}>
                <span style={{ fontSize: "18px", fontWeight: "700", color: pb.color, background: pb.bg, padding: "2px 9px", borderRadius: "100px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                  {pb.label} Plan
                </span>
              </div>
            </div>
          )}

          <button onClick={() => setShowProfile(true)} title="View profile"
            style={{ ...s.userRow, marginBottom: "10px", width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
            <UserAvatar name={user?.full_name || "B"} avatar_url={user?.avatar_url || "/avatars/default.png"} size={34} />
            <div className="dash-sidebar-label" style={{ opacity: expanded ? 1 : 0, maxWidth: expanded ? "140px" : "0px", transition: "opacity 0.25s, max-width 0.25s", overflow: "hidden" }}>
              <p style={s.userName}>{user?.full_name || "Business Owner"}</p>
              <p style={s.userRole}>Business Owner</p>
            </div>
          </button>
          <div className="dash-sidebar-label" style={{ opacity: expanded ? 1 : 0, maxHeight: expanded ? "40px" : "0px", transition: "opacity 0.25s, max-height 0.25s", overflow: "hidden" }}>
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="dash-main" style={s.main}>
        <header className="dash-topbar" style={s.topbar}>
          <button
            className="dash-hamburger"
            onClick={() => setMobileNavOpen(v => !v)}
            aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
            style={s.hamburgerBtn}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 style={s.pageTitle}>{title}</h1>
          <div style={{ flex: 1 }} />
          <button onClick={() => navigate("/business-owner/notifications")} style={{ position: "relative", background: "none", border: "1px solid transparent", borderRadius: "10px", padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <svg width="20" height="20" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unread > 0 && <span style={{ position: "absolute", top: "2px", right: "2px", background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>{unread > 9 ? "9+" : unread}</span>}
          </button>
        </header>
        <div className="dash-content" style={s.content}>{children}</div>
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
      <AIAssistantWidget />
    </div>
  );
}

const s = {
  shell: { display: "flex", minHeight: "100vh", background: "#F8FAFC" },
  // `bottom: 0` instead of `height: "100vh"` — 100vh is measured against the largest possible
  // mobile viewport (browser chrome collapsed), so a fixed, non-scrolling sidebar sized that way
  // gets its bottom edge (sign-out button included) pushed underneath the browser's own address/
  // tab bar whenever that bar is actually visible, making it unreachable. top:0 + bottom:0 sizes
  // against the real, current viewport instead.
  sidebar: { background: "#0F172A", display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, bottom: 0, zIndex: 300, transition: "width 0.25s ease", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { padding: "20px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" },
  logoRow: { display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" },
  logoBox: { width: "34px", height: "34px", borderRadius: "9px", background: "#3B82F6", color: "#FFF", fontSize: "21px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  logoText: { fontSize: "22px", fontWeight: "800", color: "#FFFFFF", letterSpacing: "-0.01em" },
  badge: { display: "inline-block", background: "rgba(59,130,246,0.2)", color: "#93C5FD", fontSize: "17px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", letterSpacing: "0.05em", textTransform: "uppercase", border: "1px solid rgba(59,130,246,0.3)", whiteSpace: "nowrap" },
  nav: { flex: 1, padding: "16px 12px", display: "flex", flexDirection: "column", gap: "2px" },
  navItem: { display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "9px", fontSize: "21px", fontWeight: "500", color: "rgba(255,255,255,0.6)", textDecoration: "none", transition: "background 0.15s, color 0.15s" },
  navItemActive: { background: "rgba(59,130,246,0.15)", color: "#93C5FD" },
  navIcon: { width: "20px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sidebarBottom: { padding: "12px", paddingBottom: "max(12px, env(safe-area-inset-bottom))", borderTop: "1px solid rgba(255,255,255,0.08)" },
  userRow: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: { width: "34px", height: "34px", borderRadius: "50%", background: "#3B82F6", color: "#FFF", fontSize: "21px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  userName: { fontSize: "20px", fontWeight: "600", color: "#FFFFFF", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  userRole: { fontSize: "18px", color: "rgba(255,255,255,0.45)", marginTop: "1px" },
  main: { flex: 1, display: "flex", flexDirection: "column", minWidth: 0, marginLeft: "64px" },
  topbar: { height: "calc(60px + env(safe-area-inset-top))", background: "#FFFFFF", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", padding: "0 28px", gap: "16px", position: "sticky", top: 0, zIndex: 100, paddingTop: "calc(0px + env(safe-area-inset-top))" },
  pageTitle: { fontSize: "22px", fontWeight: "700", color: "#1E293B" },
  hamburgerBtn: { background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center", color: "#1E293B", marginRight: "4px", flexShrink: 0 },
  content: { flex: 1, padding: "28px", boxSizing: "border-box" },
};
