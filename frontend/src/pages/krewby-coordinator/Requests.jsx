import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import CoordinatorLayout from "../../components/layout/CoordinatorLayout";

export default function CoordinatorRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending_review");

  useEffect(() => {
    api.get("/api/krewby/requests")
      .then(res => setRequests(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = requests.filter(r => filter === "all" ? true : r.status === filter);

  return (
    <CoordinatorLayout title="Krewby Requests">
      <div style={s.headerRow}>
        <h2 style={s.heading}>Krewby Requests</h2>
      </div>
      <div style={s.tabs}>
        {[
          { key: "pending_review", label: "Pending" },
          { key: "matched", label: "Matched" },
          { key: "confirmed", label: "Confirmed" },
          { key: "all", label: "All" },
        ].map(f => (
          <button key={f.key} style={{ ...s.tab, ...(filter === f.key ? s.tabActive : {}) }} onClick={() => setFilter(f.key)}>
            {f.label}
            {f.key === "pending_review" && requests.filter(r => r.status === "pending_review").length > 0 && (
              <span style={s.badge}>{requests.filter(r => r.status === "pending_review").length}</span>
            )}
          </button>
        ))}
      </div>
      {loading ? <div style={s.empty}>Loading…</div>
        : filtered.length === 0 ? (
          <div style={s.emptyCard}><p style={s.emptyIcon}>📋</p><p style={s.emptyTitle}>No {filter.replace("_", " ")} requests</p></div>
        ) : filtered.map(req => (
          <div key={req.request_id} style={s.card} onClick={() => navigate(`/krewby-coordinator/requests/${req.request_id}`)}>
            <div style={s.cardTop}>
              <div>
                {/* Prisma returns outlets (plural) not outlet */}
                <p style={s.reqTitle}>{req.role_name} — {req.outlets?.name || "Outlet"}</p>
                <p style={s.reqMeta}>{fmtDate(req.shift_date)} · {fmtTime(req.start_time)} – {fmtTime(req.end_time)}</p>
                {/* Prisma returns skills (plural) not skill */}
                <p style={s.reqSkill}>Requires: {req.skills?.name || "—"}</p>
              </div>
              <div style={s.right}>
                <span style={{ ...s.statusBadge, ...statusStyle(req.status) }}>{req.status.replace("_", " ")}</span>
                <p style={s.viewBtn}>View →</p>
              </div>
            </div>
          </div>
        ))}
    </CoordinatorLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  try {
    const s = String(t);
    if (s.length === 5 && s[2] === ':') return s;
    if (s.length >= 8 && s[2] === ':') return s.slice(0, 5);
    if (s.includes("T")) return s.split("T")[1].slice(0, 5);
    return "—";
  } catch { return "—"; }
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    const s = String(d);
    const clean = s.includes("T") ? s.split("T")[0] : s;
    const dt = new Date(clean + "T00:00:00Z");
    if (isNaN(dt.getTime())) return s;
    return dt.toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  } catch { return "—"; }
}
function statusStyle(status) {
  const map = { pending_review: { background: "#FFFBEB", color: "#D97706" }, matched: { background: "#DBEAFE", color: "#1E40AF" }, confirmed: { background: "#DCFCE7", color: "#166534" }, rejected: { background: "#FEE2E2", color: "#991B1B" }, cancelled: { background: "#F3F4F6", color: "#6B7280" } };
  return map[status] || { background: "#F3F4F6", color: "#6B7280" };
}
const s = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  heading: { fontSize: "20px", fontWeight: "800", color: "#1C1B18" },
  tabs: { display: "flex", gap: "4px", background: "#F0EDE8", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" },
  tab: { padding: "6px 14px", background: "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: "500", color: "#7A7870", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  tabActive: { background: "#FFFFFF", color: "#1C1B18", fontWeight: "600", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
  badge: { background: "#EF4444", color: "#FFFFFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" },
  empty: { textAlign: "center", padding: "60px", color: "#7A7870" },
  emptyCard: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "60px", textAlign: "center" },
  emptyIcon: { fontSize: "32px", marginBottom: "10px" },
  emptyTitle: { fontSize: "16px", fontWeight: "600", color: "#7A7870" },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "20px", marginBottom: "12px", cursor: "pointer" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  reqTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  reqMeta: { fontSize: "13px", color: "#7A7870", marginTop: "4px" },
  reqSkill: { fontSize: "12px", color: "#55524A", marginTop: "4px" },
  right: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" },
  statusBadge: { padding: "4px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", textTransform: "capitalize" },
  viewBtn: { fontSize: "13px", color: "#2563EB", fontWeight: "600" },
};
