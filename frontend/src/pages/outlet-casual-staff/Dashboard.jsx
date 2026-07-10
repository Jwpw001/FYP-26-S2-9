import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { useNavigate } from "react-router-dom";
import { Briefcase, ClipboardList, Clock, CheckCircle } from "lucide-react";

export default function CasualDashboard() {
  const navigate = useNavigate();
  const [status, setStatus]   = useState(null);
  const [stats, setStats]     = useState({ open: 0, applied: 0, confirmed: 0 });
  const [recent, setRecent]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/casual/me").catch(() => null),
      api.get("/api/casual/my-applications").catch(() => ({ applications: [] })),
    ]).then(([me, myApps]) => {
      if (me) setStatus(me.casual_worker);

      const apps = myApps?.applications || [];
      const confirmed = apps.filter(a => a.status === "confirmed").length;
      const pending   = apps.filter(a => a.status === "pending").length;
      setStats({ applied: apps.length, confirmed, pending });
      setRecent(apps.slice(0, 3));
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <CasualLayout title="Dashboard"><div style={s.loading}>Loading…</div></CasualLayout>;

  const isPending  = status?.status === "pending";
  const isRejected = status?.status === "rejected";

  return (
    <CasualLayout title="Dashboard">
      {isPending && (
        <div style={s.pendingBanner}>
          <div style={{ fontSize: "22px" }}>⏳</div>
          <div>
            <p style={{ fontWeight: "700", color: "#92400E", fontSize: "15px" }}>Application Pending</p>
            <p style={{ fontSize: "13px", color: "#78350F", marginTop: "2px" }}>
              {status?.business_name || "The business"} is reviewing your application. You'll be notified once approved.
            </p>
          </div>
        </div>
      )}

      {isRejected && (
        <div style={{ ...s.pendingBanner, background: "#FEF2F2", border: "1px solid #FECACA" }}>
          <div style={{ fontSize: "22px" }}>❌</div>
          <div>
            <p style={{ fontWeight: "700", color: "#DC2626", fontSize: "15px" }}>Application Rejected</p>
            <p style={{ fontSize: "13px", color: "#B91C1C", marginTop: "2px" }}>Your application was not approved. Please contact the business for more information.</p>
          </div>
        </div>
      )}

      {!isPending && !isRejected && (
        <>
          <div style={s.welcome}>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1C1B18" }}>Welcome back!</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Browse open job requests and apply to ones that suit you.</p>
          </div>

          {/* Stats */}
          <div style={s.statsGrid}>
            <StatCard icon={<Briefcase size={20} color="#2563EB" />} label="Total Applied" value={stats.applied} color="#EFF6FF" />
            <StatCard icon={<Clock size={20} color="#D97706" />}     label="Pending"       value={stats.pending}   color="#FFFBEB" />
            <StatCard icon={<CheckCircle size={20} color="#059669" />} label="Confirmed"   value={stats.confirmed} color="#ECFDF5" />
          </div>

          {/* Recent applications */}
          {recent.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionHeader}>
                <p style={s.sectionTitle}>Recent Applications</p>
                <button onClick={() => navigate("/outlet-casual-staff/my-applications")} style={s.viewAll}>View all</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {recent.map(app => (
                  <ApplicationCard key={app.application_id} app={app} />
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          <div style={s.cta}>
            <p style={{ fontWeight: "700", color: "#1C1B18", fontSize: "15px", marginBottom: "6px" }}>Looking for work?</p>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>Browse all open job requests from branches in your network.</p>
            <button onClick={() => navigate("/outlet-casual-staff/requests")} style={s.browseBtn}>
              Browse Open Requests
            </button>
          </div>
        </>
      )}
    </CasualLayout>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: color, border: "1px solid #E5E2DC", borderRadius: "14px", padding: "18px 20px", display: "flex", alignItems: "center", gap: "14px" }}>
      <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: "24px", fontWeight: "800", color: "#1C1B18", lineHeight: 1 }}>{value}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "3px" }}>{label}</p>
      </div>
    </div>
  );
}

function ApplicationCard({ app }) {
  const req = app.casual_requests;
  const statusStyles = {
    pending:   { bg: "#FFFBEB", color: "#D97706" },
    confirmed: { bg: "#ECFDF5", color: "#059669" },
    rejected:  { bg: "#FEF2F2", color: "#DC2626" },
  };
  const st = statusStyles[app.status] || statusStyles.pending;

  return (
    <div style={{ background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
      <div>
        <p style={{ fontWeight: "700", color: "#1C1B18", fontSize: "14px" }}>{req?.role_name}</p>
        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
          {req?.outlets?.name} · {req?.work_date} · {req?.start_time?.slice(0,5)}–{req?.end_time?.slice(0,5)}
        </p>
      </div>
      <span style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color, flexShrink: 0, textTransform: "capitalize" }}>
        {app.status}
      </span>
    </div>
  );
}

const s = {
  loading: { display: "flex", alignItems: "center", justifyContent: "center", height: "200px", color: "#64748B" },
  pendingBanner: {
    display: "flex", alignItems: "flex-start", gap: "14px",
    background: "#FFFBEB", border: "1px solid #FDE68A",
    borderRadius: "14px", padding: "18px 20px", marginBottom: "24px",
  },
  welcome: { marginBottom: "24px" },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "28px" },
  section: { marginBottom: "28px" },
  sectionHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  viewAll: { fontSize: "13px", color: "#2563EB", fontWeight: "600", background: "none", border: "none", cursor: "pointer", padding: 0 },
  cta: {
    background: "#FFF", border: "1px solid #E5E2DC",
    borderRadius: "14px", padding: "24px",
    textAlign: "center",
  },
  browseBtn: {
    background: "#F59E0B", color: "#1C1917",
    border: "none", borderRadius: "10px",
    padding: "11px 24px", fontSize: "14px",
    fontWeight: "700", cursor: "pointer",
  },
};
