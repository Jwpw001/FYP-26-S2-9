import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { useGoTo } from "../../components/PageTransition";
import { Download, History } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

if (typeof document !== "undefined" && !document.getElementById("bo-reports-styles")) {
  const s = document.createElement("style");
  s.id = "bo-reports-styles";
  s.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .bo-rpt-tab:hover { background:#F1F5F9!important; }
    .bo-rpt-row:hover { background:#F8FAFC!important; }
  `;
  document.head.appendChild(s);
}

const PERIODS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const STATUS_BAR_COLOR = {
  completed: "#16A34A", published: "#2563EB", draft: "#94A3B8",
  cancelled: "#EF4444", assigned: "#0891B2", open: "#D97706",
  approved: "#16A34A", pending: "#D97706", rejected: "#EF4444",
  pending_review: "#D97706",
};

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

function BarMeterSection({ title, sub, rows, loading }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
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
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            const color = STATUS_BAR_COLOR[r.status] || "#94A3B8";
            return (
              <div key={r.status}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
                  <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#374151", textTransform: "capitalize" }}>{r.status?.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: "12px", color: "#64748B" }}><strong style={{ color: "#0F172A", fontWeight: "700" }}>{r.count}</strong> · {pct}%</span>
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

function LineChart({ series, labels, height = 180 }) {
  const W = 800; const H = height;
  const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allVals = series.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const n = labels.length;
  function px(i) { return PAD.left + (i / Math.max(n - 1, 1)) * chartW; }
  function py(v) { return PAD.top + (1 - v / maxV) * chartH; }
  function path(data) {
    if (data.length === 0) return "";
    return data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 14 ? labels.map((l, i) => ({ l, i })) : Array.from({ length: 7 }, (_, k) => { const i = Math.round(k * (n - 1) / 6); return { l: labels[i], i }; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible", display: "block" }}>
      {ticks.map(t => <line key={t.v} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F1F5F9" strokeWidth="1" />)}
      {ticks.map(t => <text key={t.v} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="14" fill="#94A3B8">{t.v}</text>)}
      {xShow.map(({ l, i }) => <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="14" fill="#94A3B8">{l}</text>)}
      {series.map(s => {
        if (!s.data.length) return null;
        const close = ` L${px(s.data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
        return <path key={s.label + "-a"} d={path(s.data) + close} fill={s.color} fillOpacity="0.08" stroke="none" />;
      })}
      {series.map(s => <path key={s.label} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(s => s.data.length > 0 && <circle key={s.label + "-dot"} cx={px(s.data.length - 1)} cy={py(s.data[s.data.length - 1])} r="4" fill={s.color} />)}
    </svg>
  );
}

export default function BOReports() {
  const goTo    = useGoTo();
  const [period, setPeriod] = useState(1);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [showHistory,    setShowHistory]    = useState(false);
  const [historyRows,    setHistoryRows]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [kpis, setKpis] = useState({ staff: 0, staffPrev: 0, shifts: 0, shiftsPrev: 0, leave: 0, leavePrev: 0 });
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [branchRows, setBranchRows] = useState([]);
  const [shiftsByStatus, setShiftsByStatus] = useState([]);
  const [leaveByStatus, setLeaveByStatus] = useState([]);

  const days = PERIODS[period].days;

  function logDownload(format) {
    const now   = new Date();
    const start = new Date(now); start.setDate(now.getDate() - days);
    api.post("/api/reports", {
      branch_id:    null,
      report_type:  "business_owner",
      format,
      title:        `${businessName || "Business"} — Staffing Report (${PERIODS[period].label})`,
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
    try {
      const [bizResp, branchResp] = await Promise.all([
        api.get("/api/business/info"),
        api.get("/api/business/branches"),
      ]);

      const bizData = bizResp.business;
      if (!bizData) { setLoading(false); return; }
      setBusinessName(bizData.name);

      const branches = branchResp.branches || [];
      const branchIds = branches.map(o => o.branch_id);
      if (branchIds.length === 0) { setLoading(false); return; }

      const { data: staffData } = await supabase
        .from("staff")
        .select("staff_id, staff_type, is_active, branch_id")
        .in("branch_id", branchIds);

      const allStaff = (staffData || []).map(s => ({
        ...s,
        branch_name: branches.find(o => o.branch_id === s.branch_id)?.name || "",
      }));
      const staffIds = allStaff.map(s => s.staff_id);

      const now = new Date();
      const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
      const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);

      const [{ data: shiftsAll }, { data: leaveAll }] = await Promise.all([
        branchIds.length > 0
          ? supabase.from("shifts").select("shift_id, status, shift_date, branch_id").in("branch_id", branchIds)
          : Promise.resolve({ data: [] }),
        staffIds.length > 0
          ? supabase.from("availability").select("request_id, status, start_date, staff_id").in("staff_id", staffIds)
          : Promise.resolve({ data: [] }),
      ]);

      const shifts  = shiftsAll  || [];
      const leave   = leaveAll   || [];

      const inPeriod = ts => ts && new Date(ts) >= periodStart;
      const inPrev   = ts => ts && new Date(ts) >= prevStart && new Date(ts) < periodStart;

      const newShifts  = shifts.filter(s => inPeriod(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
      const prevShifts = shifts.filter(s => inPrev(s.shift_date  ? s.shift_date + "T00:00:00"  : null)).length;
      const newLeave   = leave.filter(l => inPeriod(l.start_date  ? l.start_date + "T00:00:00"  : null)).length;
      const prevLeave  = leave.filter(l => inPrev(l.start_date    ? l.start_date + "T00:00:00"  : null)).length;
      const activeStaff = allStaff.filter(s => s.is_active).length;

      setKpis({ staff: activeStaff, staffPrev: 0, shifts: newShifts, shiftsPrev: prevShifts, leave: newLeave, leavePrev: prevLeave });

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
        { label: "Shifts",          data: dailyCount(shifts, s => s.shift_date), color: "#2563EB" },
        { label: "Leave Requests",  data: dailyCount(leave,  l => l.start_date), color: "#D97706" },
      ]);

      setBranchRows(branches.map(o => ({
        name: o.name,
        totalStaff:  allStaff.filter(s => s.branch_id === o.branch_id).length,
        activeStaff: allStaff.filter(s => s.branch_id === o.branch_id && s.is_active).length,
        shifts:      shifts.filter(s => s.branch_id === o.branch_id).length,
        published:   shifts.filter(s => s.branch_id === o.branch_id && s.status === "published").length,
      })));

      const shiftMap = {}; shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
      setShiftsByStatus(Object.entries(shiftMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const leaveMap = {}; leave.forEach(l => { leaveMap[l.status] = (leaveMap[l.status] || 0) + 1; });
      setLeaveByStatus(Object.entries(leaveMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];
    lines.push(`${businessName} — Staff & Shift Report (${PERIODS[period].label})`);
    lines.push(`Generated,${today}`);
    lines.push(""); lines.push("KPI SUMMARY"); lines.push("Metric,Value");
    lines.push(`Active Staff,${kpis.staff}`);
    lines.push(`Shifts (period),${kpis.shifts}`);
    lines.push(`Leave Requests (period),${kpis.leave}`);
    lines.push(""); lines.push("BRANCHES"); lines.push("Branch,Total Staff,Active Staff,Total Shifts,Published");
    branchRows.forEach(o => lines.push(`"${o.name}",${o.totalStaff},${o.activeStaff},${o.shifts},${o.published}`));
    lines.push(""); lines.push("SHIFTS BY STATUS"); lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push(""); lines.push("LEAVE BY STATUS"); lines.push("Status,Count");
    leaveByStatus.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push(""); lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-report-${PERIODS[period].label}-${today}.csv`;
    a.click(); URL.revokeObjectURL(url);
    logDownload("csv");
  }

  function downloadPDF() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text(`${businessName} — Staffing Report`, 14, 13);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${PERIODS[period].label}   Generated: ${today}`, pageW - 14, 13, { align: "right" });
    y = 34;

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("KPI Summary", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value", "vs Prev Period"]],
      body: [
        ["Active Staff",              kpis.staff,   "—"],
        ["Shifts (period)",           kpis.shifts,  `${delta(kpis.shifts, kpis.shiftsPrev)}%`],
        ["Leave Requests (period)",   kpis.leave,   `${delta(kpis.leave, kpis.leavePrev)}%`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Branches Overview", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Branch", "Total Staff", "Active Staff", "Total Shifts", "Published"]],
      body: branchRows.map(o => [o.name, o.totalStaff, o.activeStaff, o.shifts, o.published]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y, head: [["Shifts by Status", "Count"]],
      body: shiftsByStatus.map(s => [s.status, s.count]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y, head: [["Leave by Status", "Count"]],
      body: leaveByStatus.map(l => [l.status, l.count]),
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8 }, bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: pageW / 2 + 2, right: 14 },
    });
    doc.save(`${businessName.toLowerCase().replace(/\s+/g, "-")}-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
    logDownload("pdf");
  }

  const maxBranchStaff  = Math.max(...branchRows.map(o => o.totalStaff), 1);
  const maxBranchShifts = Math.max(...branchRows.map(o => o.shifts), 1);

  return (
    <BusinessOwnerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {showHistory ? (
          /* ── History View ── */
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "22px" }}>
              <button onClick={() => setShowHistory(false)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", color: "#64748B", fontSize: "16px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Report History</h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>All reports exported</p>
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
                        <tr key={r.report_id} className="bo-rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
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
                <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Reports</h2>
                <p style={{ fontSize: "13px", color: "#64748B", margin: "4px 0 0" }}>
                  {businessName ? `${businessName} — ` : ""}Consolidated across all branches
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                  {PERIODS.map((p, i) => (
                    <button key={p.label} onClick={() => setPeriod(i)} className="bo-rpt-tab"
                      style={{ padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", background: period === i ? "#FFF" : "transparent", color: period === i ? "#0F172A" : "#64748B", boxShadow: period === i ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <button onClick={downloadCSV} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Download size={14} strokeWidth={2} /> CSV
                </button>
                <button onClick={downloadPDF} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "none", background: "#0F172A", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Download size={14} strokeWidth={2} /> PDF
                </button>
                <button onClick={openHistory}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>
                  History
                </button>
              </div>
            </div>

            {/* Stats Strip */}
            <StatStrip loading={loading} stats={[
              { label: "ACTIVE STAFF",    value: kpis.staff,  sub: "across all branches",          pct: null },
              { label: "SHIFTS",          value: kpis.shifts, sub: `vs prev ${PERIODS[period].label}`, pct: delta(kpis.shifts, kpis.shiftsPrev) },
              { label: "LEAVE REQUESTS",  value: kpis.leave,  sub: `vs prev ${PERIODS[period].label}`, pct: delta(kpis.leave, kpis.leavePrev) },
            ]} />

            {/* Daily Activity Chart */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Daily Activity</h3>
                  <p style={{ fontSize: "12px", color: "#94A3B8", margin: "3px 0 0" }}>Last {Math.min(days, 30)} days</p>
                </div>
                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                  {chartSeries.map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "10px", height: "3px", borderRadius: "2px", background: s.color }} />
                      <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {loading ? (
                <div style={{ height: "180px", background: "linear-gradient(90deg,#F8FAFC 25%,#F1F5F9 50%,#F8FAFC 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", borderRadius: "8px" }} />
              ) : <LineChart series={chartSeries} labels={chartLabels} height={180} />}
            </div>

            {/* Branches Overview — dual progress bars */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: "0 0 4px" }}>Branches Overview</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", margin: "0 0 18px" }}>Staffing and shift coverage per branch</p>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="60px" />)}
                </div>
              ) : branchRows.length === 0 ? (
                <p style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No branches found.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                  {branchRows.map((o, i) => (
                    <div key={o.name} style={{ animation: `fadeUp 0.3s ease ${i * 0.07}s both` }}>
                      <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", margin: "0 0 10px" }}>{o.name}</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B" }}>Staff active</span>
                            <span style={{ fontSize: "12px", color: "#64748B" }}><strong style={{ color: "#0F172A", fontWeight: "700" }}>{o.activeStaff}</strong> / {o.totalStaff}</span>
                          </div>
                          <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "100px", background: "#2563EB", width: `${o.totalStaff > 0 ? (o.activeStaff / o.totalStaff) * 100 : 0}%`, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "4px" }}>
                            <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B" }}>Shifts published</span>
                            <span style={{ fontSize: "12px", color: "#64748B" }}><strong style={{ color: "#0F172A", fontWeight: "700" }}>{o.published}</strong> / {o.shifts}</span>
                          </div>
                          <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: "100px", background: "#10B981", width: `${o.shifts > 0 ? (o.published / o.shifts) * 100 : 0}%`, transition: "width 0.8s ease" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Breakdowns — 2-col grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              <BarMeterSection title="Shifts by Status"   sub="All shifts (all time)"                rows={shiftsByStatus} loading={loading} />
              <BarMeterSection title="Leave Requests"     sub="By approval status (all time)"        rows={leaveByStatus}  loading={loading} />
            </div>
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}
