import { useEffect, useState, useRef } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Building2, Users, FolderKanban, Clock, Gauge } from "lucide-react";
import { useBusinessContext } from "../../context/BusinessContext";

if (typeof document !== "undefined" && !document.getElementById("bo-dash-styles")) {
  const style = document.createElement("style");
  style.id = "bo-dash-styles";
  style.textContent = `
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.92); }
      60%  { transform: scale(1.03); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const start = performance.now();
    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(step);
    }
    raf.current = requestAnimationFrame(step);
    return () => raf.current && cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

function StatCard({ card, value, delay, onNav }) {
  const displayed = useCountUp(typeof value === "number" ? value : 0);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onNav}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px",
        padding: "22px", display: "flex", gap: "14px", alignItems: "flex-start",
        cursor: "pointer", animation: `popIn 0.4s ease ${delay}ms both`,
        boxShadow: hovered ? "0 8px 24px rgba(245,158,11,0.12)" : "none",
        transform: hovered ? "translateY(-2px)" : "none",
        transition: "box-shadow 0.2s, transform 0.2s",
      }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: card.bg, color: card.color }}>
        <card.Icon size={20} />
      </div>
      <div>
        <p style={{ fontSize: "28px", fontWeight: "800", color: "#1E293B", lineHeight: 1 }}>{displayed}</p>
        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", marginTop: "4px" }}>{card.label}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>{card.sub}</p>
      </div>
    </div>
  );
}

const INDUSTRY_META = {
  "f&b":         { emoji:"🍽️", label:"F&B",          welcome:"Ready to build this week's schedule?" },
  "retail":      { emoji:"🛍️", label:"Retail",        welcome:"Manage your stores and floor staff." },
  "healthcare":  { emoji:"🏥", label:"Healthcare",    welcome:"Keep your clinic fully covered." },
  "tech":        { emoji:"💻", label:"Technology",    welcome:"Track projects, capacity, and team workload." },
  "logistics":   { emoji:"📦", label:"Logistics",     welcome:"Manage your warehouse shifts and certifications." },
  "beauty":      { emoji:"✨", label:"Beauty",        welcome:"Your appointments and therapist schedule." },
  "education":   { emoji:"📚", label:"Education",     welcome:"Manage tutors, classes, and student groups." },
  "hospitality": { emoji:"🏨", label:"Hospitality",   welcome:"Keep every department staffed around the clock." },
  "other":       { emoji:"🏢", label:"Business",      welcome:"Manage your workforce from one place." },
};

export default function BODashboard() {
  const goTo = useGoTo();
  const { locationLabel, staffLabel, schedulingMode, industry } = useBusinessContext();
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

  const meta = INDUSTRY_META[industry] || INDUSTRY_META["other"];

  // Cards adapt based on scheduling mode
  const cards = schedulingMode === "flexible" ? [
    { label: `${locationLabel}s`,    sub: "Across your business",  value: stats?.outlets_count ?? 0, Icon: Building2,     color: "#D97706", bg: "#FEF3C7", link: "/business-owner/outlets" },
    { label: `All ${staffLabel}`,    sub: "Active team members",   value: stats?.staff_count   ?? 0, Icon: Users,         color: "#3B82F6", bg: "#EFF6FF", link: "/business-owner/staff" },
    { label: "Active Projects",      sub: "Across all teams",      value: stats?.projects_count ?? 0, Icon: FolderKanban, color: "#6366F1", bg: "#EEF2FF", link: "/business-owner/outlets" },
  ] : schedulingMode === "appointment" ? [
    { label: `${locationLabel}s`,    sub: "Across your business",  value: stats?.outlets_count ?? 0, Icon: Building2,     color: "#EC4899", bg: "#FDF2F8", link: "/business-owner/outlets" },
    { label: `All ${staffLabel}`,    sub: "Active members",        value: stats?.staff_count   ?? 0, Icon: Users,         color: "#3B82F6", bg: "#EFF6FF", link: "/business-owner/staff" },
  ] : [
    { label: `${locationLabel}s`,    sub: "Across your business",  value: stats?.outlets_count ?? 0, Icon: Building2,     color: "#D97706", bg: "#FEF3C7", link: "/business-owner/outlets" },
    { label: `All ${staffLabel}`,    sub: "Active members",        value: stats?.staff_count   ?? 0, Icon: Users,         color: "#3B82F6", bg: "#EFF6FF", link: "/business-owner/staff" },
  ];

  // Quick action links adapt per mode
  const quickActions = schedulingMode === "flexible" ? [
    { label: `Add ${locationLabel}`, sub: "Set up a new team", path: "/business-owner/outlets" },
    { label: `Invite ${staffLabel}`, sub: "Send join links",   path: "/business-owner/invitations" },
    { label: "View Reports",         sub: "Hours & capacity",  path: "/business-owner/reports" },
  ] : schedulingMode === "appointment" ? [
    { label: `Add ${locationLabel}`, sub: "New branch or clinic", path: "/business-owner/outlets" },
    { label: `Invite ${staffLabel}`, sub: "Add therapists/staff",  path: "/business-owner/invitations" },
    { label: "View Reports",         sub: "Booking summaries",    path: "/business-owner/reports" },
  ] : [
    { label: `Add ${locationLabel}`, sub: "Set up a new location", path: "/business-owner/outlets" },
    { label: `Invite ${staffLabel}`, sub: "Send join links",        path: "/business-owner/invitations" },
    { label: "View Reports",         sub: "Staff & shifts data",    path: "/business-owner/reports" },
  ];

  return (
    <BusinessOwnerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Welcome banner */}
        <div style={{ ...s.welcomeBox, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px", flexWrap:"wrap" }}>
              <h2 style={s.welcomeTitle}>Welcome back 👋</h2>
              {business?.plan && (() => {
                const ps = { free:{label:"Free",bg:"#F1F5F9",color:"#64748B"}, premium:{label:"Premium",bg:"#EFF6FF",color:"#2563EB"}, enterprise:{label:"Enterprise",bg:"#FDF4FF",color:"#9333EA"} }[business.plan] || {};
                return <span style={{ fontSize:"11px",fontWeight:"700",padding:"3px 9px",borderRadius:"100px",background:ps.bg,color:ps.color }}>{ps.label}</span>;
              })()}
            </div>
            <p style={s.welcomeSub}>{business?.name || "Your Business"} · {meta.label} · {meta.welcome}</p>
          </div>
          {/* Industry badge */}
          <div style={{ display:"flex",alignItems:"center",gap:"8px",padding:"8px 14px",borderRadius:"10px",background:"#F8FAFC",border:"1px solid #E2E8F0" }}>
            <span style={{ fontSize:"20px" }}>{meta.emoji}</span>
            <div>
              <div style={{ fontSize:"11px",fontWeight:"700",color:"#1E293B" }}>{meta.label}</div>
              <div style={{ fontSize:"10px",color:"#94A3B8",textTransform:"capitalize" }}>{schedulingMode} mode</div>
            </div>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "16px", marginBottom: "24px" }}>
          {loading
            ? Array.from({ length: cards.length || 2 }).map((_, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", height: "92px" }} />
              ))
            : cards.map((card, idx) => (
                <StatCard key={card.label} card={card} value={card.value} delay={idx * 80} onNav={() => goTo(card.link)} />
              ))
          }
        </div>

        {/* Quick actions */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"24px" }}>
          {quickActions.map((a, i) => (
            <button key={i} onClick={() => goTo(a.path)}
              style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"12px", padding:"14px 16px", textAlign:"left", cursor:"pointer", transition:"all 0.15s", boxShadow:"0 1px 3px rgba(0,0,0,0.04)" }}
              className="card-hover">
              <div style={{ fontSize:"13px",fontWeight:"700",color:"#1E293B",marginBottom:"2px" }}>{a.label}</div>
              <div style={{ fontSize:"11px",color:"#94A3B8" }}>{a.sub}</div>
            </button>
          ))}
        </div>

        {business && (
          <div style={s.infoCard}>
            <h3 style={s.infoTitle}>Business Info</h3>
            <div style={s.infoGrid}>
              <InfoRow label="Business Name"    value={business.name} />
              <InfoRow label="Contact Email"    value={business.contact_email || "—"} />
              <InfoRow label="Phone"            value={business.contact_phone || "—"} />
              <InfoRow label="Address"          value={business.address || "—"} />
              <InfoRow label="Industry"         value={`${meta.emoji} ${meta.label}`} />
              <InfoRow label="Scheduling Mode"  value={schedulingMode ? schedulingMode.charAt(0).toUpperCase()+schedulingMode.slice(1)+" Mode" : "—"} />
              <InfoRow label={`${locationLabel} Label`} value={locationLabel} />
              <InfoRow label={`Staff Label`}    value={staffLabel} />
            </div>
            {business.description && (
              <div style={{ marginTop: "12px" }}>
                <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Description</p>
                <p style={{ fontSize: "14px", color: "#1E293B", lineHeight: 1.6 }}>{business.description}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <p style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
      <p style={{ fontSize: "14px", color: "#1E293B", fontWeight: "500" }}>{value}</p>
    </div>
  );
}

const s = {
  welcomeBox: { marginBottom: "28px" },
  welcomeTitle: { fontSize: "22px", fontWeight: "700", color: "#1E293B", marginBottom: "4px" },
  welcomeSub: { fontSize: "14px", color: "#64748B" },
  infoCard: { background: "#FFF", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  infoTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" },
};
