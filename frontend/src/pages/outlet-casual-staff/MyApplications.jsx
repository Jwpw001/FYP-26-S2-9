import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { MapPin, Clock } from "lucide-react";

const STATUS_STYLE = {
  pending:   { bg: "#FFFBEB", color: "#D97706", label: "Pending" },
  confirmed: { bg: "#ECFDF5", color: "#059669", label: "Confirmed ✓" },
  rejected:  { bg: "#FEF2F2", color: "#DC2626", label: "Not selected" },
};

const TABS = ["all", "pending", "confirmed", "rejected"];

export default function MyApplications() {
  const [apps, setApps]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState("all");

  useEffect(() => {
    api.get("/api/casual/my-applications")
      .then(d => setApps(d.applications || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tab === "all" ? apps : apps.filter(a => a.status === tab);

  return (
    <CasualLayout title="My Applications">
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1C1B18" }}>My Applications</h2>
        <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px" }}>Track all the requests you've applied to.</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: "99px", fontSize: "12px", fontWeight: "700",
            border: `1.5px solid ${tab === t ? "#F59E0B" : "#E5E2DC"}`,
            background: tab === t ? "#FFFBEB" : "#FFF",
            color: tab === t ? "#D97706" : "#64748B",
            cursor: "pointer", textTransform: "capitalize",
          }}>
            {t === "all" ? `All (${apps.length})` : `${STATUS_STYLE[t]?.label} (${apps.filter(a => a.status === t).length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1,2,3].map(i => <div key={i} style={{ height: "100px", background: "#F1F5F9", borderRadius: "14px" }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          <p style={{ fontSize: "28px", marginBottom: "10px" }}>📋</p>
          <p style={{ fontSize: "15px", fontWeight: "700", color: "#1C1B18", marginBottom: "6px" }}>
            {tab === "all" ? "No applications yet" : `No ${tab} applications`}
          </p>
          <p style={{ fontSize: "13px", color: "#64748B" }}>
            {tab === "all" ? "Browse open requests and tap I'm Available to apply." : "Check other tabs to see your applications."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filtered.map(app => <AppCard key={app.application_id} app={app} />)}
        </div>
      )}
    </CasualLayout>
  );
}

function AppCard({ app }) {
  const req = app.casual_requests;
  const st  = STATUS_STYLE[app.status] || STATUS_STYLE.pending;
  const outlet = req?.outlets;

  return (
    <div style={s.card}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: "800", color: "#1C1B18", marginBottom: "6px" }}>{req?.role_name || "Unknown role"}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {outlet && (
              <span style={s.meta}><MapPin size={12} /> {outlet.name}{outlet.address ? ` · ${outlet.address}` : ""}</span>
            )}
            <span style={s.meta}><Clock size={12} /> {req?.work_date} · {req?.start_time?.slice(0,5)}–{req?.end_time?.slice(0,5)}</span>
          </div>
          <p style={{ fontSize: "11px", color: "#A09D97", marginTop: "8px" }}>
            Applied {new Date(app.applied_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <span style={{ padding: "5px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: "700", background: st.bg, color: st.color, flexShrink: 0 }}>
          {st.label}
        </span>
      </div>

      {app.status === "confirmed" && (
        <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #ECFDF5", fontSize: "12px", color: "#059669", fontWeight: "600" }}>
          You're confirmed for this job. Show up on time and ready to work!
        </div>
      )}
    </div>
  );
}

const s = {
  empty: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px 40px", textAlign: "center" },
  card: { background: "#FFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "16px 18px" },
  meta: { fontSize: "12px", color: "#64748B", display: "flex", alignItems: "center", gap: "5px" },
};
