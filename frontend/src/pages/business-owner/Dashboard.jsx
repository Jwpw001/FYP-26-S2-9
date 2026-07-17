import { useEffect, useState, useRef } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import {
  Building2, Users, UserPlus, Tag, BarChart2,
  Settings, Mail, Phone, MapPin, FileText, ChevronRight, Calendar,
} from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-dash-styles")) {
  const style = document.createElement("style");
  style.id = "bo-dash-styles";
  style.textContent = `
    @keyframes popIn   { 0%{opacity:0;transform:scale(0.93)} 65%{transform:scale(1.02)} 100%{opacity:1;transform:scale(1)} }
    @keyframes pageIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .bo-action-card:hover { transform:translateY(-3px)!important; box-shadow:0 10px 28px rgba(0,0,0,0.08)!important; border-color:#CBD5E1!important; }
    .bo-stat-card:hover   { transform:translateY(-3px)!important; box-shadow:0 10px 28px rgba(245,158,11,0.12)!important; }
  `;
  document.head.appendChild(style);
}

const PLAN_STYLE = {
  free:       { label: "Free",       bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  premium:    { label: "Premium",    bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  enterprise: { label: "Enterprise", bg: "#FDF4FF", color: "#9333EA", border: "#E9D5FF" },
};

const BIZ_COLORS = ["#F59E0B","#3B82F6","#8B5CF6","#EC4899","#10B981","#EF4444","#06B6D4"];
function bizColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return BIZ_COLORS[Math.abs(h) % BIZ_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function StatCard({ Icon, label, sub, value, color, bg, onClick, delay }) {
  const displayed = useCountUp(value);
  return (
    <div className="bo-stat-card" onClick={onClick}
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s", animation: `popIn 0.45s ease ${delay}ms both`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
        <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={19} />
        </div>
        <ChevronRight size={15} color="#CBD5E1" />
      </div>
      <p style={{ fontSize: "30px", fontWeight: "800", color: "#0F172A", lineHeight: 1, marginBottom: "5px" }}>{displayed}</p>
      <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{label}</p>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{sub}</p>
    </div>
  );
}

function ActionCard({ Icon, label, sub, color, bg, onClick, delay }) {
  return (
    <div className="bo-action-card" onClick={onClick}
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 16px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "10px", transition: "transform 0.18s, box-shadow 0.18s, border-color 0.15s", animation: `fadeUp 0.3s ease ${delay}ms both`, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ width: "46px", height: "46px", borderRadius: "13px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={20} />
      </div>
      <div>
        <p style={{ fontSize: "13px", fontWeight: "700", color: "#0F172A" }}>{label}</p>
        <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px", lineHeight: 1.4 }}>{sub}</p>
      </div>
    </div>
  );
}

const ACTIONS = [
  { Icon: Building2, label: "Branches",    sub: "Manage your locations",   color: "#D97706", bg: "#FEF3C7", link: "/business-owner/branches" },
  { Icon: Users,     label: "Workforce",   sub: "View all staff members",  color: "#2563EB", bg: "#EFF6FF", link: "/business-owner/staff" },
  { Icon: UserPlus,  label: "Invitations", sub: "Pending join requests",   color: "#0891B2", bg: "#ECFEFF", link: "/business-owner/invitations" },
  { Icon: Tag,       label: "Skill Tags",  sub: "Categorise staff skills", color: "#059669", bg: "#ECFDF5", link: "/business-owner/skills" },
  { Icon: BarChart2, label: "Reports",     sub: "Analytics & insights",    color: "#DC2626", bg: "#FEF2F2", link: "/business-owner/reports" },
];

export default function BODashboard() {
  const goTo = useGoTo();
  const [stats, setStats] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/business/info"),
      api.get("/api/business/stats"),
    ]).then(([biz, st]) => {
      setBusiness(biz.business);
      setStats(st);
    }).finally(() => setLoading(false));
  }, []);

  const color  = business ? bizColor(business.name) : "#F59E0B";
  const plan   = business?.plan || "free";
  const ps     = PLAN_STYLE[plan] ?? PLAN_STYLE.free;

  return (
    <BusinessOwnerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both", display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── Hero card ── */}
        {loading ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
              <Shimmer w="72px" h="72px" r="18px" />
              <div style={{ flex: 1 }}><Shimmer w="200px" h="20px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="300px" h="13px" r="5px" /></div></div>
            </div>
          </div>
        ) : business && (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "28px 30px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", position: "relative", overflow: "hidden" }}>
            {/* subtle top colour bar */}
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: "18px 18px 0 0" }} />

            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              {/* Avatar */}
              <div style={{ width: "68px", height: "68px", borderRadius: "18px", background: color, color: "#FFF", fontSize: "26px", fontWeight: "900", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 6px 18px ${color}44` }}>
                {business.name?.[0]?.toUpperCase()}
              </div>
              {/* Name + info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.3px" }}>{business.name}</h2>
                  <span style={{ fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "100px", background: ps.bg, color: ps.color, border: `1px solid ${ps.border}`, textTransform: "uppercase", letterSpacing: "0.05em" }}>{ps.label}</span>
                </div>
                <p style={{ fontSize: "13px", color: "#64748B" }}>Business Owner Portal</p>
              </div>
              {/* Meta chips */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {business.contact_email && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "6px 12px" }}>
                    <Mail size={12} color="#64748B" />
                    <span style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>{business.contact_email}</span>
                  </div>
                )}
                {business.address && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "6px 12px" }}>
                    <MapPin size={12} color="#64748B" />
                    <span style={{ fontSize: "12px", color: "#475569", fontWeight: "500" }}>{business.address}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Description */}
            {business.description && (
              <div style={{ marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <span style={{ fontSize: "32px", lineHeight: 0.9, color: color, opacity: 0.25, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: "2px" }}>"</span>
                <p style={{ fontSize: "15px", fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", color: "#475569", lineHeight: 1.7, letterSpacing: "0.01em" }}>{business.description}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Stat cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "14px" }}>
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px", height: "110px" }}>
                <Shimmer w="42px" h="42px" r="12px" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                Icon={Building2} label="Branches" sub="Across your business"
                value={stats?.branches_count ?? 0} color="#D97706" bg="#FEF3C7"
                onClick={() => goTo("/business-owner/branches")} delay={0}
              />
              <StatCard
                Icon={Users} label="Total Staff" sub="Active members"
                value={stats?.staff_count ?? 0} color="#3B82F6" bg="#EFF6FF"
                onClick={() => goTo("/business-owner/staff")} delay={80}
              />
            </>
          )}
        </div>

        {/* ── Business info + Quick Actions side by side ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Business Info */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", marginBottom: "18px" }}>Business Info</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="38px" />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[
                  { Icon: Building2, label: "Business Name",  value: business?.name },
                  { Icon: Mail,      label: "Contact Email",  value: business?.contact_email },
                  { Icon: Phone,     label: "Phone",          value: business?.contact_phone },
                  { Icon: MapPin,    label: "Address",        value: business?.address },
                ].map(({ Icon, label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={14} color="#64748B" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
                      <p style={{ fontSize: "13px", fontWeight: "600", color: value ? "#1E293B" : "#CBD5E1", fontStyle: value ? "normal" : "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value || "Not set"}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px 26px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", marginBottom: "18px" }}>Quick Actions</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
              {ACTIONS.map((action, i) => (
                <ActionCard key={action.label} {...action} onClick={() => goTo(action.link)} delay={i * 50} />
              ))}
            </div>
          </div>

        </div>
      </div>
    </BusinessOwnerLayout>
  );
}
