import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { History } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { api } from "../../lib/api";

if (typeof document !== "undefined" && !document.getElementById("sa-reports-kf")) {
  const s = document.createElement("style");
  s.id = "sa-reports-kf";
  s.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .rpt-tab:hover { background:#F1F5F9!important; }
    .rpt-row:hover { background:#F8FAFC!important; }
  `;
  document.head.appendChild(s);
}

const PERIODS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const ROLE_LABELS = {
  system_admin: "System Admin", manager: "Manager", regular_staff: "Regular Staff",
  casual_staff: "Casual Staff", krewby_casual_worker: "Krewby Worker", business_owner: "Business Owner",
};

const ROLE_COLORS = {
  "System Admin": "#0F172A", "Business Owner": "#7C3AED", "Manager": "#059669",
  "Regular Staff": "#2563EB", "Casual Staff": "#D97706", "Krewby Worker": "#DB2777",
};

const STATUS_BAR_COLOR = {
  completed: "#16A34A", published: "#2563EB", draft: "#94A3B8",
  cancelled: "#EF4444", assigned: "#0891B2", open: "#D97706",
  approved: "#16A34A", pending: "#D97706", rejected: "#EF4444",
};

const PLAN_COLORS = { free: "#64748B", premium: "#2563EB", enterprise: "#7C3AED" };
const PLAN_LABELS = { free: "Free", premium: "Premium", enterprise: "Enterprise" };

function Shimmer({ w = "100%", h = "16px", r = "6px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function delta(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function TrendBadge({ pct }) {
  if (pct === null || pct === undefined) return null;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: "700", color: up ? "#16A34A" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: "100px" }}>
      <Icon size={11} /> {Math.abs(pct)}%
    </span>
  );
}

function StatStrip({ stats, loading }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 8px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexWrap: "wrap" }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{ flex: "1 1 0", padding: "0 24px", borderLeft: i === 0 ? "none" : "1px solid #E2E8F0", minWidth: "160px" }}>
          {loading ? (
            <><Shimmer w="60px" h="30px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="80px" h="11px" r="5px" /></div></>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "30px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>{s.value}</span>
                {s.pct !== null && s.pct !== undefined && <TrendBadge pct={s.pct} />}
              </div>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "8px 0 2px" }}>{s.label}</p>
              <p style={{ fontSize: "11px", color: "#94A3B8", margin: 0 }}>{s.sub}</p>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function BarMeterSection({ title, sub, rows, loading, getColor }) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: 0 }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "#94A3B8", margin: "3px 0 16px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map(i => <Shimmer key={i} h="30px" />)}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#94A3B8", textAlign: "center", padding: "16px 0" }}>No data</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rows.map(r => {
            const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
            const color = getColor ? getColor(r.label) : (STATUS_BAR_COLOR[r.label] || "#94A3B8");
            return (
              <div key={r.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#374151", textTransform: "capitalize" }}>{r.label}</span>
                  <span style={{ fontSize: "12px", color: "#64748B" }}><strong style={{ color: "#0F172A", fontWeight: "700" }}>{r.value}</strong> · {pct}%</span>
                </div>
                <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: "100px", background: color, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LineChart({ series, labels, height = 260 }) {
  const W = 1000; const H = height;
  const PAD = { top: 18, right: 12, bottom: 34, left: 46 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allVals = series.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const n = labels.length;
  function px(i) { return PAD.left + (i / Math.max(n - 1, 1)) * chartW; }
  function py(v) { return PAD.top + (1 - v / maxV) * chartH; }
  function linePath(data) { return data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" "); }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 10 ? labels.map((l, i) => ({ l, i })) : [0, Math.floor((n-1)/4), Math.floor((n-1)/2), Math.floor(3*(n-1)/4), n-1].map(i => ({ l: labels[i], i }));
  return (
    <div style={{ width: "100%", height: `${H}px`, position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
        {ticks.map(t => (
          <g key={t.v}>
            <line x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F1F5F9" strokeWidth="1.2" />
            <text x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="11" fill="#94A3B8">{t.v}</text>
          </g>
        ))}
        {xShow.map(({ l, i }) => (
          <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="11" fill="#94A3B8">{l}</text>
        ))}
        {series.map(s => {
          if (!s.data.length) return null;
          const close = ` L${px(s.data.length-1).toFixed(1)},${(PAD.top+chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top+chartH).toFixed(1)} Z`;
          return <path key={s.label + "-area"} d={linePath(s.data) + close} fill={s.color} fillOpacity="0.07" stroke="none" />;
        })}
        {series.map(s => s.data.length > 0 && (
          <path key={s.label} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {series.map(s => s.data.length > 0 && (
          <circle key={s.label + "-dot"} cx={px(s.data.length - 1)} cy={py(s.data[s.data.length - 1])} r="5" fill={s.color} />
        ))}
      </svg>
    </div>
  );
}

export default function AdminReports() {
  const [period, setPeriod] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showHistory,    setShowHistory]    = useState(false);
  const [historyRows,    setHistoryRows]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [kpis, setKpis] = useState({ users: 0, usersPrev: 0, businesses: 0, bizPrev: 0, shifts: 0, shiftsPrev: 0, paidBiz: 0, totalBiz: 0 });
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [shiftsByStatus, setShiftStatus] = useState([]);
  const [usersByRole, setUsersByRole]   = useState([]);
  const [planStats,   setPlanStats]     = useState([]);

  const days = PERIODS[period].days;

  function logDownload(format) {
    const now   = new Date();
    const start = new Date(now); start.setDate(now.getDate() - days);
    api.post("/api/reports", {
      branch_id:    null,
      report_type:  "system_admin",
      format,
      title:        `Krewby — Platform Report (${PERIODS[period].label})`,
      period_start: start.toISOString().slice(0, 10),
      period_end:   now.toISOString().slice(0, 10),
    }).catch(() => {});
  }

  function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    api.get("/api/reports")
      .then(r => setHistoryRows(r.reports || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
    const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);

    const [
      { data: usersAll },
      { data: bizAll },
      { data: shiftsAll },
    ] = await Promise.all([
      supabase.from("users").select("user_id, role, created_at, is_active"),
      supabase.from("businesses").select("business_id, created_at, plan"),
      supabase.from("shifts").select("shift_id, status, shift_date"),
    ]);

    const users  = usersAll  || [];
    const biz    = bizAll    || [];
    const shifts = shiftsAll || [];

    const inPeriod = ts => ts && new Date(ts) >= periodStart;
    const inPrev   = ts => ts && new Date(ts) >= prevStart && new Date(ts) < periodStart;

    const newUsers   = users.filter(u => inPeriod(u.created_at)).length;
    const prevUsers  = users.filter(u => inPrev(u.created_at)).length;
    const newBiz     = biz.filter(b => inPeriod(b.created_at)).length;
    const prevBiz    = biz.filter(b => inPrev(b.created_at)).length;
    const newShifts  = shifts.filter(s => inPeriod(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const prevShifts = shifts.filter(s => inPrev(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const paidBiz    = biz.filter(b => b.plan && b.plan !== "free").length;

    setKpis({ users: newUsers, usersPrev: prevUsers, businesses: newBiz, bizPrev: prevBiz, shifts: newShifts, shiftsPrev: prevShifts, paidBiz, totalBiz: biz.length });

    const dayCount = Math.min(days, 30);
    const dayLabels = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(5, 10);
    });
    const dayKeys = dayLabels.map((_, i) => {
      const d = new Date(now); d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(0, 10);
    });
    function dailyCount(items, getDate) {
      const map = {};
      items.forEach(it => { const d = getDate(it)?.slice(0, 10); if (d && dayKeys.includes(d)) map[d] = (map[d] || 0) + 1; });
      return dayKeys.map(k => map[k] || 0);
    }
    setChartLabels(dayLabels);
    setChartSeries([
      { label: "New Users",      data: dailyCount(users,  u => u.created_at), color: "#2563EB" },
      { label: "Shifts",         data: dailyCount(shifts, s => s.shift_date),  color: "#D97706" },
      { label: "New Businesses", data: dailyCount(biz,    b => b.created_at), color: "#8B5CF6" },
    ]);

    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
    setShiftStatus(
      Object.entries(shiftMap)
        .map(([s, c]) => ({ label: s, value: c }))
        .sort((a, b) => b.value - a.value)
    );

    const roleMap = {};
    users.forEach(u => {
      const label = ROLE_LABELS[u.role] || u.role;
      if (!roleMap[label]) roleMap[label] = { total: 0, active: 0 };
      roleMap[label].total++;
      if (u.is_active) roleMap[label].active++;
    });
    setUsersByRole(Object.entries(roleMap).map(([role, v]) => ({ role, ...v })).sort((a, b) => b.total - a.total));

    const planMap = {};
    biz.forEach(b => { const p = b.plan || "free"; planMap[p] = (planMap[p] || 0) + 1; });
    setPlanStats(
      Object.entries(planMap)
        .map(([p, c]) => ({ label: PLAN_LABELS[p] || p, value: c, planKey: p }))
        .sort((a, b) => b.value - a.value)
    );

    setLoading(false);
  }, [days, period]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];
    lines.push(`Krewby Platform Report — ${PERIODS[period].label}`);
    lines.push(`Generated,${today}`);
    lines.push(""); lines.push("KPI SUMMARY"); lines.push("Metric,This Period,Previous Period,Change %");
    lines.push(`New Users,${kpis.users},${kpis.usersPrev},${delta(kpis.users, kpis.usersPrev)}%`);
    lines.push(`New Businesses,${kpis.businesses},${kpis.bizPrev},${delta(kpis.businesses, kpis.bizPrev)}%`);
    lines.push(`Shifts,${kpis.shifts},${kpis.shiftsPrev},${delta(kpis.shifts, kpis.shiftsPrev)}%`);
    lines.push(`Paid Businesses,${kpis.paidBiz},${kpis.totalBiz},${kpis.totalBiz > 0 ? Math.round((kpis.paidBiz / kpis.totalBiz) * 100) : 0}%`);
    lines.push(""); lines.push("USERS BY ROLE"); lines.push("Role,Total,Active");
    usersByRole.forEach(r => lines.push(`"${r.role}",${r.total},${r.active}`));
    lines.push(""); lines.push("SHIFTS BY STATUS"); lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.label},${s.value}`));
    lines.push(""); lines.push("BUSINESS PLANS"); lines.push("Plan,Count");
    planStats.forEach(p => lines.push(`${p.label},${p.value}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `krewby-report-${PERIODS[period].label}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    logDownload("csv");
  }

  function downloadPDF() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Krewby — Platform Report", 14, 13);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${PERIODS[period].label}   Generated: ${today}`, pageW - 14, 13, { align: "right" });
    let y = 34;
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("KPI Summary", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "This Period", "Prev Period", "Δ %"]],
      body: [
        ["New Users",       kpis.users,      kpis.usersPrev,  `${delta(kpis.users, kpis.usersPrev)}%`],
        ["New Businesses",  kpis.businesses, kpis.bizPrev,    `${delta(kpis.businesses, kpis.bizPrev)}%`],
        ["Shifts",          kpis.shifts,     kpis.shiftsPrev, `${delta(kpis.shifts, kpis.shiftsPrev)}%`],
        ["Paid Businesses", kpis.paidBiz,    kpis.totalBiz,   `${kpis.totalBiz > 0 ? Math.round((kpis.paidBiz / kpis.totalBiz) * 100) : 0}%`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Users by Role", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Role", "Total", "Active"]],
      body: usersByRole.map(r => [r.role, r.total, r.active]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
    if (y > 210) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y, head: [["Shifts by Status", "Count"]],
      body: shiftsByStatus.map(s => [s.label, s.value]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y, head: [["Business Plan", "Count"]],
      body: planStats.map(p => [p.label, p.value]),
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 8 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: pageW / 2 + 2, right: 14 },
    });
    doc.save(`krewby-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
    logDownload("pdf");
  }

  const maxRole = Math.max(...usersByRole.map(r => r.total), 1);

  return (
    <AdminLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {showHistory ? (
          /* ── History View ── */
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "22px" }}>
              <button onClick={() => setShowHistory(false)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", color: "#64748B", fontSize: "16px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Report History</h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>All platform reports exported</p>
              </div>
            </div>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              {historyLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1,2,3].map(i => <Shimmer key={i} h="44px" />)}
                </div>
              ) : historyRows.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 0" }}>
                  <History size={36} color="#CBD5E1" style={{ marginBottom: "12px" }} />
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>No exports yet</p>
                  <p style={{ fontSize: "13px", color: "#CBD5E1", marginTop: "4px" }}>Download a CSV or PDF from the Reports page to see history here.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "500px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                        {["Title", "Format", "Period", "Downloaded"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "Format" || h === "Downloaded" ? "center" : "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map(r => (
                        <tr key={r.report_id} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
                          <td style={{ padding: "12px", fontWeight: "600", color: "#1E293B" }}>{r.title || "Report"}</td>
                          <td style={{ padding: "12px", textAlign: "center" }}>
                            <span style={{ fontSize: "11px", fontWeight: "700", padding: "2px 10px", borderRadius: "100px", background: r.format === "pdf" ? "#FEF2F2" : "#F0FDF4", color: r.format === "pdf" ? "#DC2626" : "#16A34A", textTransform: "uppercase" }}>{r.format}</span>
                          </td>
                          <td style={{ padding: "12px", color: "#64748B", fontSize: "12px" }}>{r.period_start} – {r.period_end}</td>
                          <td style={{ padding: "12px", textAlign: "center", color: "#94A3B8", fontSize: "12px" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Reports View ── */
          <div>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Platform Analytics</h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>Real-time overview across all platform activity</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                  {PERIODS.map((p, i) => (
                    <button key={p.label} onClick={() => setPeriod(i)} className="rpt-tab"
                      style={{ padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", background: period === i ? "#FFF" : "transparent", color: period === i ? "#0F172A" : "#64748B", boxShadow: period === i ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <button onClick={downloadCSV} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
                  ⬇ CSV
                </button>
                <button onClick={downloadPDF} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "none", background: "#0F172A", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
                  ⬇ PDF
                </button>
                <button onClick={openHistory}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>
                  History
                </button>
              </div>
            </div>

            {/* Stats Strip */}
            <StatStrip loading={loading} stats={[
              { label: "NEW USERS",        value: kpis.users,      sub: `vs prev ${PERIODS[period].label}`, pct: delta(kpis.users, kpis.usersPrev) },
              { label: "NEW BUSINESSES",   value: kpis.businesses, sub: `vs prev ${PERIODS[period].label}`, pct: delta(kpis.businesses, kpis.bizPrev) },
              { label: "SHIFTS",           value: kpis.shifts,     sub: `vs prev ${PERIODS[period].label}`, pct: delta(kpis.shifts, kpis.shiftsPrev) },
              { label: "PAID BUSINESSES",  value: kpis.paidBiz,    sub: `of ${kpis.totalBiz} total`,        pct: null },
            ]} />

            {/* Daily Activity Chart */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Daily Activity</h3>
                  <p style={{ fontSize: "12px", color: "#94A3B8", margin: "3px 0 0" }}>Last {Math.min(days, 30)} days</p>
                </div>
                <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
                  {chartSeries.map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "12px", height: "3px", borderRadius: "2px", background: s.color }} />
                      <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {loading ? (
                <div style={{ height: "260px", display: "flex", alignItems: "flex-end", gap: "3px", padding: "0 2px" }}>
                  {Array.from({ length: 28 }).map((_, i) => <Shimmer key={i} w="100%" h={`${15 + Math.sin(i) * 30 + 40}px`} r="3px" />)}
                </div>
              ) : (
                <LineChart series={chartSeries} labels={chartLabels} height={260} />
              )}
            </div>

            {/* Users by Role */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", margin: "0 0 3px" }}>Users by Role</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 18px" }}>All registered accounts, active vs total</p>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} h="40px" />)}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {usersByRole.map((r, i) => {
                    const color = ROLE_COLORS[r.role] || "#2563EB";
                    return (
                      <div key={r.role} style={{ animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{r.role}</span>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <span style={{ fontSize: "11px", color: "#16A34A", fontWeight: "600" }}>{r.active} active</span>
                            <span style={{ fontSize: "13px", fontWeight: "800", color }}>{r.total}</span>
                          </div>
                        </div>
                        <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                          <div style={{ height: "100%", borderRadius: "100px", background: color, width: `${(r.total / maxRole) * 100}%`, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Breakdowns — 2-col grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <BarMeterSection
                title="Shifts by Status" sub="All shifts, by current status"
                rows={shiftsByStatus} loading={loading}
                getColor={label => STATUS_BAR_COLOR[label] || "#94A3B8"}
              />
              <BarMeterSection
                title="Business Plans" sub="All businesses, by subscription tier"
                rows={planStats} loading={loading}
                getColor={label => {
                  const key = Object.keys(PLAN_LABELS).find(k => PLAN_LABELS[k] === label);
                  return key ? PLAN_COLORS[key] : "#94A3B8";
                }}
              />
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
