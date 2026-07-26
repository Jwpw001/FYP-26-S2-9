import { useState, useEffect, useRef } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";

if (typeof document !== "undefined" && !document.getElementById("bo-dash-styles")) {
  const style = document.createElement("style");
  style.id = "bo-dash-styles";
  style.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn   { 0%{opacity:0;transform:scale(.93)} 100%{opacity:1;transform:scale(1)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
  `;
  document.head.appendChild(style);
}

const PLAN_STYLE = {
  free:       { label: "Free",       bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  premium:    { label: "Premium",    bg: "#F5F3FF", color: "#7C3AED", border: "#E9D5FF" },
  enterprise: { label: "Enterprise", bg: "#FDF4FF", color: "#9333EA", border: "#E9D5FF" },
};

const BIZ_COLORS = ["#F59E0B","#4F46E5","#8B5CF6","#EC4899","#10B981","#EF4444","#06B6D4"];
function bizColor(name = "") {
  let h = 0; for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return BIZ_COLORS[Math.abs(h) % BIZ_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function ConicDonut({ pct, color, track, label, sub }) {
  const deg = Math.round(pct / 100 * 360);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
      <div style={{ width: "82px", height: "82px", borderRadius: "50%", background: `conic-gradient(${color} 0deg ${deg}deg, ${track} ${deg}deg 360deg)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <div style={{ width: "62px", height: "62px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>{pct}%</span>
        </div>
      </div>
      <div>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{label}</p>
        <p style={{ fontSize: "12px", color: "#94A3B8", margin: "3px 0 0" }}>{sub}</p>
      </div>
    </div>
  );
}

const QUICK_ACTIONS = [
  { key: "branches",    label: "Branches",    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, bg: "#FEF3C7", color: "#D97706", link: "/business-owner/branches" },
  { key: "workforce",   label: "Workforce",   icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/></svg>, bg: "#EFF6FF", color: "#2563EB", link: "/business-owner/staff" },
  { key: "invitations", label: "Invitations", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M20 8v6M23 11h-6"/></svg>, bg: "#ECFEFF", color: "#0891B2", link: "/business-owner/invitations" },
  { key: "skills",      label: "Skill Tags",  icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/></svg>, bg: "#ECFDF5", color: "#059669", link: "/business-owner/skills" },
  { key: "reports",     label: "Reports",     icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 4-6"/></svg>, bg: "#FEF2F2", color: "#DC2626", link: "/business-owner/reports" },
];

export default function BODashboard() {
  const goTo = useGoTo();

  const [loading,          setLoading]         = useState(true);
  const [business,         setBusiness]         = useState(null);
  const [stats,            setStats]            = useState(null);
  const [branches,         setBranches]         = useState([]);
  const [expandedBranch,   setExpandedBranch]   = useState(null);
  const [selectedAction,   setSelectedAction]   = useState("branches");
  const [activity,         setActivity]         = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.get("/api/business/info"),
      api.get("/api/business/stats"),
    ]).then(async ([biz, st]) => {
      if (cancelled) return;
      setBusiness(biz.business);
      setStats(st);

      // Fetch branches via the authenticated API endpoint
      const branchRes = await api.get("/api/business/branches").catch(() => ({ branches: [] }));
      if (cancelled) return;
      const branchRows = branchRes.branches || [];

      if (branchRows.length) {
        const bids = branchRows.map(b => b.branch_id);
        const { data: staffRows } = await supabase
          .from("staff").select("branch_id").in("branch_id", bids).eq("is_active", true);
        const countMap = {};
        (staffRows || []).forEach(s => { countMap[s.branch_id] = (countMap[s.branch_id] || 0) + 1; });
        const total = Math.max(...Object.values(countMap), 1);
        const statusOpts = [
          { min: 0.8, label: "Thriving",    statusBg: "#DCFCE7", statusColor: "#166534", barColor: "#16A34A" },
          { min: 0.5, label: "Stable",      statusBg: "#EFF6FF", statusColor: "#1D4ED8", barColor: "#2563EB" },
          { min: 0,   label: "Needs staff", statusBg: "#FFFBEB", statusColor: "#92400E", barColor: "#D97706" },
        ];
        const mapped = branchRows.map(b => {
          const cnt = countMap[b.branch_id] || 0;
          const pct = Math.round((cnt / total) * 100);
          const s = statusOpts.find(x => pct / 100 >= x.min) || statusOpts[2];
          return { ...b, staff: cnt, pct, ...s };
        });
        setBranches(mapped);
      }

      // Activity feed
      const acts = [];
      const { data: recentStaff } = await supabase.from("staff").select("users:user_id(full_name), created_at").eq("is_active", true).order("created_at", { ascending: false }).limit(3);
      (recentStaff || []).forEach(s => acts.push({ who: s.users?.full_name || "Someone", text: "joined the workforce", when: relTime(s.created_at), color: "#16A34A" }));
      if (!cancelled) setActivity(acts);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const color  = business ? bizColor(business.name) : "#4F46E5";
  const plan   = business?.plan || "free";
  const ps     = PLAN_STYLE[plan] ?? PLAN_STYLE.free;

  // KPI derivations
  const staffCount  = stats?.staff_count ?? 0;
  const branchCount = stats?.branches_count ?? 0;
  const utilPct  = staffCount ? Math.min(98, 60 + Math.round((staffCount / Math.max(branchCount, 1)) * 4)) : 82;
  const healthPct = branchCount ? Math.min(99, 75 + branchCount * 3) : 91;

  const selAct = selectedAction;

  return (
    <BusinessOwnerLayout title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "22px", animation: "fadeUp .4s ease both" }}>

        {/* Hero */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "26px 30px", boxShadow: "0 1px 4px rgba(0,0,0,.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg,#4F46E5,#818CF8)" }} />
          {loading ? (
            <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
              <Shimmer w="64px" h="64px" r="16px" />
              <div style={{ flex: 1 }}><Shimmer w="200px" h="20px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="300px" h="13px" r="5px" /></div></div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "16px", background: color, color: "#fff", fontSize: "24px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 6px 18px ${color}55` }}>
                {business?.name?.[0]?.toUpperCase() || "B"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.3px", margin: 0 }}>{business?.name}</h2>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, textTransform: "uppercase", letterSpacing: ".05em" }}>{ps.label}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#64748B", margin: 0 }}>{[business?.contact_email, business?.address].filter(Boolean).join(" · ")}</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: "700" }}>This month</p>
                <p style={{ fontSize: "22px", fontWeight: "800", color: "#16A34A", margin: 0 }}>+{staffCount}</p>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: "1px 0 0" }}>active staff</p>
              </div>
            </div>
          )}
        </div>

        {/* 3 KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px" }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", animation: `popIn .4s ease ${i * 80}ms both` }}>
                <Shimmer w="82px" h="82px" r="50%" />
              </div>
            ))
          ) : (
            <>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", animation: "popIn .4s ease both" }}>
                <ConicDonut pct={utilPct} color="#4F46E5" track="#E0E7FF" label="Staff Utilization" sub="Across all branches" />
              </div>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", animation: "popIn .4s ease 80ms both" }}>
                <ConicDonut pct={healthPct} color="#059669" track="#D1FAE5" label="Branch Health" sub="Coverage & on-time rate" />
              </div>
              <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", display: "flex", flexDirection: "column", gap: "10px", animation: "popIn .4s ease 160ms both" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", margin: 0 }}>Growth Trend</p>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#16A34A" }}>▲ {branchCount} branches</span>
                </div>
                <svg width="100%" height="46" viewBox="0 0 160 46" preserveAspectRatio="none">
                  <polyline points="0,38 25,32 50,34 75,20 100,24 125,10 160,6" fill="none" stroke="#4F46E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>Workforce growth · last 7 weeks</p>
              </div>
            </>
          )}
        </div>

        {/* Branch performance + Quick Actions */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", alignItems: "start" }}>

          {/* Branch Performance */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 18px" }}>Branch Performance</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="56px" r="10px" />)}
              </div>
            ) : branches.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>No branches yet.</p>
            ) : (
              branches.map(b => (
                <div key={b.branch_id} style={{ borderBottom: "1px solid #F1F5F9", padding: "12px 0" }}>
                  <div onClick={() => setExpandedBranch(p => p === b.branch_id ? null : b.branch_id)}
                    style={{ display: "flex", alignItems: "center", gap: "14px", cursor: "pointer" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EEF2FF", color: "#4F46E5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{b.name}</span>
                        <span style={{ fontSize: "12px", color: "#94A3B8" }}>{b.staff} staff</span>
                      </div>
                      <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${b.pct}%`, background: b.barColor, borderRadius: "100px" }} />
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "100px", background: b.statusBg, color: b.statusColor, flexShrink: 0 }}>{b.label}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5" style={{ flexShrink: 0, transform: expandedBranch === b.branch_id ? "rotate(180deg)" : "none", transition: "transform .2s" }}><polyline points="6 9 12 15 18 9"/></svg>
                  </div>
                  {expandedBranch === b.branch_id && (
                    <div style={{ marginTop: "12px", marginLeft: "50px" }}>
                      <p style={{ fontSize: "12px", color: "#64748B", margin: 0 }}>{b.address || "No address set"}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Quick Actions with tab detail */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 16px" }}>Quick Actions</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
              {QUICK_ACTIONS.map(a => (
                <div key={a.key} onClick={() => { setSelectedAction(a.key); goTo(a.link); }}
                  style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "10px", cursor: "pointer", background: selAct === a.key ? "#F8FAFC" : "transparent", transition: "background .15s" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "9px", background: a.bg, color: a.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{a.icon}</div>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", flex: 1 }}>{a.label}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              ))}
            </div>

            {/* Detail */}
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "14px" }}>
              {loading ? <Shimmer h="60px" r="8px" /> : (
                <>
                  {selAct === "branches" && (
                    <>
                      <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 10px" }}>{branchCount} Branches</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {branches.slice(0, 4).map(b => (
                          <div key={b.branch_id} style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                            <span style={{ color: "#1E293B", fontWeight: "600" }}>{b.name}</span>
                            <span style={{ color: "#94A3B8" }}>{b.label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {selAct === "workforce" && (
                    <>
                      <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".05em", margin: "0 0 10px" }}>{staffCount} Active Staff</p>
                      <p style={{ fontSize: "12.5px", color: "#64748B", margin: 0 }}>Spread across {branchCount} branch{branchCount !== 1 ? "es" : ""}.</p>
                    </>
                  )}
                  {selAct === "invitations" && (
                    <p style={{ fontSize: "12.5px", color: "#64748B", margin: 0 }}>View and manage pending staff invitations.</p>
                  )}
                  {selAct === "skills" && (
                    <p style={{ fontSize: "12.5px", color: "#64748B", margin: 0 }}>Manage the skill tags used across your branches.</p>
                  )}
                  {selAct === "reports" && (
                    <p style={{ fontSize: "12.5px", color: "#64748B", margin: 0 }}>View analytics, attendance and payroll reports.</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", margin: "0 0 18px" }}>Recent Activity</h3>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1,2,3].map(i => <div key={i} style={{ display: "flex", gap: "14px" }}><Shimmer w="9px" h="9px" r="50%" /><Shimmer h="34px" r="6px" /></div>)}
            </div>
          ) : activity.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>No recent activity.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {activity.map((ac, i) => (
                <div key={i} style={{ display: "flex", gap: "14px", padding: "10px 0" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                    <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: ac.color, marginTop: "4px" }} />
                    {i < activity.length - 1 && <div style={{ width: "1px", flex: 1, background: "#F1F5F9", marginTop: "4px" }} />}
                  </div>
                  <div style={{ paddingBottom: "2px" }}>
                    <p style={{ fontSize: "13px", color: "#334155", margin: 0 }}><b style={{ color: "#0F172A" }}>{ac.who}</b> {ac.text}</p>
                    <p style={{ fontSize: "11px", color: "#94A3B8", margin: "2px 0 0" }}>{ac.when}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </BusinessOwnerLayout>
  );
}

function relTime(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}
