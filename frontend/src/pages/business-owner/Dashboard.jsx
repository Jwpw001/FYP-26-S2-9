import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { Building2, Users, CalendarDays, TrendingUp } from "lucide-react";

export default function BODashboard() {
  const [stats, setStats] = useState(null);
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    Promise.all([
      fetch("/api/business/info", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/business/stats", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
    ]).then(([biz, st]) => {
      setBusiness(biz.business);
      setStats(st);
    }).finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Outlets",        value: stats?.outlets_count ?? "—", Icon: Building2,    color: "#F59E0B" },
    { label: "Total Staff",    value: stats?.staff_count   ?? "—", Icon: Users,         color: "#3B82F6" },
    { label: "Shifts This Month", value: stats?.shifts_count ?? "—", Icon: CalendarDays, color: "#10B981" },
    { label: "Active Invites", value: stats?.active_invites ?? "—", Icon: TrendingUp,   color: "#8B5CF6" },
  ];

  return (
    <BusinessOwnerLayout title="Dashboard">
      {loading ? <p style={{ color: "#64748B" }}>Loading…</p> : (
        <div>
          <div style={s.welcomeBox}>
            <h2 style={s.welcomeTitle}>Welcome back 👋</h2>
            <p style={s.welcomeSub}>{business?.name || "Your Business"} · Business Owner Portal</p>
          </div>

          <div style={s.cardGrid}>
            {cards.map(({ label, value, Icon, color }) => (
              <div key={label} style={s.card}>
                <div style={{ ...s.cardIcon, background: color + "1A", color }}>
                  <Icon size={20} />
                </div>
                <div>
                  <p style={s.cardValue}>{value}</p>
                  <p style={s.cardLabel}>{label}</p>
                </div>
              </div>
            ))}
          </div>

          {business && (
            <div style={s.infoCard}>
              <h3 style={s.infoTitle}>Business Info</h3>
              <div style={s.infoGrid}>
                <InfoRow label="Business Name" value={business.name} />
                <InfoRow label="Industry" value={business.industry || "—"} />
                <InfoRow label="Contact Email" value={business.contact_email || "—"} />
                <InfoRow label="Phone" value={business.contact_phone || "—"} />
              </div>
            </div>
          )}
        </div>
      )}
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
  cardGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" },
  card: { background: "#FFF", borderRadius: "14px", padding: "20px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  cardIcon: { width: "44px", height: "44px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardValue: { fontSize: "24px", fontWeight: "800", color: "#1E293B" },
  cardLabel: { fontSize: "12px", color: "#64748B", marginTop: "2px" },
  infoCard: { background: "#FFF", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  infoTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" },
  infoGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" },
};
