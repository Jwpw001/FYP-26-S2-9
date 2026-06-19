import { useEffect, useState, useRef } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Building2, Users } from "lucide-react";

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

  const cards = [
    { label: "Outlets",     sub: "Across your business", value: stats?.outlets_count ?? 0, Icon: Building2, color: "#D97706", bg: "#FEF3C7", link: "/business-owner/outlets" },
    { label: "Total Staff", sub: "Active members",       value: stats?.staff_count   ?? 0, Icon: Users,     color: "#3B82F6", bg: "#EFF6FF", link: "/business-owner/staff" },
  ];

  return (
    <BusinessOwnerLayout title="Dashboard">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={s.welcomeBox}>
          <h2 style={s.welcomeTitle}>Welcome back 👋</h2>
          <p style={s.welcomeSub}>{business?.name || "Your Business"} · Business Owner Portal</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "16px", marginBottom: "24px" }}>
          {loading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", height: "92px" }} />
              ))
            : cards.map((card, idx) => (
                <StatCard key={card.label} card={card} value={card.value} delay={idx * 80} onNav={() => goTo(card.link)} />
              ))
          }
        </div>

        {business && (
          <div style={s.infoCard}>
            <h3 style={s.infoTitle}>Business Info</h3>
            <div style={s.infoGrid}>
              <InfoRow label="Business Name" value={business.name} />
              <InfoRow label="Contact Email" value={business.contact_email || "—"} />
              <InfoRow label="Phone" value={business.contact_phone || "—"} />
              <InfoRow label="Address" value={business.address || "—"} />
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
