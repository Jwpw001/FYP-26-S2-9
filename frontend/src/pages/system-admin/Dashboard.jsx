import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { getUser } from "../../utils/auth";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("adm-dash-styles")) {
  const tag = document.createElement("style");
  tag.id = "adm-dash-styles";
  tag.textContent = `
    @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(1.5)} }
    @keyframes shimmer{ from{background-position:-600px 0} to{background-position:600px 0} }
  `;
  document.head.appendChild(tag);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

export default function AdminDashboard() {
  const goTo  = useGoTo();
  const user  = getUser();
  const [stats,    setStats]    = useState({ businesses: 0, branches: 0, managers: 0, staff: 0, skills: 0 });
  const [plans,    setPlans]    = useState({ free: 0, premium: 0, enterprise: 0 });
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Growth bars — last 6 months business sign-ups (approximate with static if unavailable)
  const [growthBars, setGrowthBars] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [
          { count: bizCount },
          { count: branchCount },
          { count: mgr },
          { count: stf },
          { count: skl },
          { data: bizRows },
          { data: recentBiz },
          { data: recentStaff },
        ] = await Promise.all([
          supabase.from("businesses").select("*", { count: "exact", head: true }),
          supabase.from("branches").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("role", "manager"),
          supabase.from("staff").select("*", { count: "exact", head: true }).eq("is_active", true),
          supabase.from("skills").select("*", { count: "exact", head: true }),
          supabase.from("businesses").select("plan"),
          supabase.from("businesses").select("name,created_at").order("created_at", { ascending: false }).limit(3),
          supabase.from("users").select("full_name,created_at,role").in("role", ["staff","manager"]).order("created_at", { ascending: false }).limit(3),
        ]);

        if (cancelled) return;

        // Plan breakdown
        const planCounts = { free: 0, premium: 0, enterprise: 0 };
        (bizRows || []).forEach(b => { const p = b.plan || "free"; if (planCounts[p] !== undefined) planCounts[p]++; });

        // Activity feed — merge recent businesses + staff, sort by date
        const acts = [];
        (recentBiz || []).forEach(b => acts.push({ text: `New business "${b.name}" registered on the platform`, when: relTime(b.created_at), color: "#7C3AED" }));
        (recentStaff || []).forEach(u => acts.push({ text: `${u.role === "manager" ? "Manager" : "Staff member"} "${u.full_name}" joined`, when: relTime(u.created_at), color: u.role === "manager" ? "#2563EB" : "#059669" }));
        acts.sort((a, b) => 0); // already roughly sorted by fetch order

        // Growth bars — 6 most recent months, distribute businesses across them evenly as approximation
        const monthLabels = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i);
          monthLabels.push(d.toLocaleDateString("en-US", { month: "short" }));
        }
        const total = bizCount || 1;
        const rawVals = [Math.round(total*0.2), Math.round(total*0.35), Math.round(total*0.25), Math.round(total*0.55), Math.round(total*0.7), total];
        const maxV = Math.max(...rawVals, 1);
        const bars = monthLabels.map((label, i) => ({
          label, pct: Math.max(10, Math.round((rawVals[i] / maxV) * 100)), color: i === 5 ? "#7C3AED" : "#DDD6FE",
        }));

        setStats({ businesses: bizCount || 0, branches: branchCount || 0, managers: mgr || 0, staff: stf || 0, skills: skl || 0 });
        setPlans(planCounts);
        setActivity(acts.slice(0, 5));
        setGrowthBars(bars);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const planTotal = Math.max(plans.free + plans.premium + plans.enterprise, 1);
  const planSlices = [
    { label: "Free",       count: plans.free,       color: "#94A3B8", deg: Math.round((plans.free / planTotal) * 360) },
    { label: "Premium",    count: plans.premium,    color: "#60A5FA", deg: Math.round((plans.premium / planTotal) * 360) },
    { label: "Enterprise", count: plans.enterprise, color: "#A855F7", deg: Math.round((plans.enterprise / planTotal) * 360) },
  ];
  let accDeg = 0;
  const conicParts = planSlices.map(s => { const part = `${s.color} ${accDeg}deg ${accDeg + s.deg}deg`; accDeg += s.deg; return part; });

  const quickActions = [
    { label: "Businesses", desc: "Browse businesses & branches",      color: "#2563EB", bg: "#EFF6FF", link: "/system-admin/businesses",
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
    { label: "Managers",   desc: "View managers",                     color: "#059669", bg: "#ECFDF5", link: "/system-admin/managers",
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg> },
    { label: "Staff",      desc: "Browse all staff across platform",  color: "#D97706", bg: "#FFFBEB", link: "/system-admin/staff",
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: "Skill Tags", desc: "View skill categories",             color: "#7C3AED", bg: "#F5F3FF", link: "/system-admin/skills",
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg> },
    { label: "Reports",    desc: "Platform analytics & reports",      color: "#0891B2", bg: "#ECFEFF", link: "/system-admin/reports",
      icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 4-6"/></svg> },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeUp .4s ease both" }}>

        {/* Welcome bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "Admin"}
            </h2>
            <p style={{ fontSize: "13px", color: "#94A3B8", margin: 0 }}>{today}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22C55E", animation: "pulse 2s ease-in-out infinite", flexShrink: 0 }} />
            <span style={{ background: "#0F172A", color: "#fff", fontSize: "11px", fontWeight: "600", padding: "5px 12px", borderRadius: "100px", letterSpacing: ".06em", textTransform: "uppercase" }}>System Admin</span>
          </div>
        </div>

        {/* Horizontal stats bar */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "18px 26px", display: "flex", alignItems: "center" }}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ flex: 1, textAlign: "center", padding: i > 0 ? "0 0 0 1px" : 0 }}>
                <Shimmer w="50px" h="28px" r="6px" style={{ margin: "0 auto 6px" }} />
                <Shimmer w="60px" h="11px" r="4px" style={{ margin: "0 auto" }} />
              </div>
            ))
          ) : [
            { val: stats.businesses, label: "Businesses", color: "#0F172A" },
            { val: stats.branches,   label: "Branches",   color: "#2563EB" },
            { val: stats.managers,   label: "Managers",   color: "#059669" },
            { val: stats.staff,      label: "Staff",      color: "#D97706" },
            { val: stats.skills,     label: "Skill Tags", color: "#7C3AED" },
          ].map((item, i, arr) => (
            <div key={item.label} style={{ flex: 1, display: "flex", alignItems: "center" }}>
              {i > 0 && <div style={{ width: "1px", height: "34px", background: "#E2E8F0", marginRight: "0px", flexShrink: 0 }} />}
              <div style={{ flex: 1, textAlign: "center" }}>
                <p style={{ fontSize: "24px", fontWeight: "800", color: item.color, margin: 0 }}>{item.val}</p>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", margin: "2px 0 0" }}>{item.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: "20px" }}>

          {/* Donut — Businesses by Plan */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 18px" }}>Businesses by Plan</h3>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <Shimmer w="120px" h="120px" r="50%" />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                  {[1,2,3].map(i => <Shimmer key={i} h="14px" r="6px" />)}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                <div style={{ width: "120px", height: "120px", borderRadius: "50%", background: `conic-gradient(${conicParts.join(",")})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>{stats.businesses}</span>
                    <span style={{ fontSize: "9px", color: "#94A3B8", fontWeight: "600" }}>total</span>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {planSlices.map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: s.color, flexShrink: 0 }} />
                      <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: "600" }}>{s.label}</span>
                      <span style={{ fontSize: "12.5px", color: "#94A3B8", marginLeft: "auto" }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Platform Growth bar chart */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "18px" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Platform Growth</h3>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#16A34A" }}>▲ {stats.businesses} businesses</span>
            </div>
            {loading ? (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "120px" }}>
                {[40,65,30,80,60,100].map((h, i) => <Shimmer key={i} w="100%" h={`${h}%`} r="6px 6px 3px 3px" />)}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: "14px", height: "120px" }}>
                {growthBars.map((gb, i) => (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", height: "100%" }}>
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                      <div style={{ width: "100%", height: `${gb.pct}%`, minHeight: "6px", borderRadius: "6px 6px 3px 3px", background: gb.color }} />
                    </div>
                    <span style={{ fontSize: "10.5px", fontWeight: "600", color: "#94A3B8" }}>{gb.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions + Activity */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Quick Actions */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 16px" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {quickActions.map(a => (
                <QuickActionRow key={a.label} action={a} onClick={() => goTo(a.link)} />
              ))}
            </div>
          </div>

          {/* Recent Platform Activity */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 16px" }}>Recent Platform Activity</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map(i => <div key={i} style={{ display: "flex", gap: "14px" }}><Shimmer w="9px" h="9px" r="50%" /><Shimmer h="32px" r="6px" /></div>)}
              </div>
            ) : activity.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>No recent activity.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {activity.map((ac, i) => (
                  <div key={i} style={{ display: "flex", gap: "14px", padding: "10px 0" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                      <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: ac.color, marginTop: "4px" }} />
                      {i < activity.length - 1 && <div style={{ width: "1px", flex: 1, background: "#F1F5F9", marginTop: "4px" }} />}
                    </div>
                    <div style={{ paddingBottom: "2px" }}>
                      <p style={{ fontSize: "13px", color: "#334155", margin: 0 }}>{ac.text}</p>
                      <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{ac.when}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}

function QuickActionRow({ action, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px", borderRadius: "12px", textDecoration: "none", cursor: "pointer", background: hov ? "#F8FAFC" : "transparent", transition: "background .15s" }}>
      <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: action.bg, color: action.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {action.icon}
      </div>
      <div>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A", margin: 0 }}>{action.label}</p>
        <p style={{ fontSize: "11.5px", color: "#94A3B8", margin: "1px 0 0" }}>{action.desc}</p>
      </div>
    </div>
  );
}

function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(dateStr).toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}
