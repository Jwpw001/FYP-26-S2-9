import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

if (typeof document !== "undefined" && !document.getElementById("sa-reports-kf")) {
  const s = document.createElement("style");
  s.id = "sa-reports-kf";
  s.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .rpt-tab:hover { background:#F1F5F9!important; }
    .rpt-row:hover { background:#F8FAFC!important; }
    .rpt-sort:hover { color:#0F172A!important; }
  `;
  document.head.appendChild(s);
}

const PERIODS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const ROLE_LABELS = {
  system_admin:          "System Admin",
  outlet_manager:        "Outlet Manager",
  regular_staff:         "Regular Staff",
  outlet_casual_staff:   "Outlet Casual Staff",
  krewby_casual_worker:  "Krewby Worker",
  business_owner:        "Business Owner",
};

function Shimmer({ w = "100%", h = "16px", r = "6px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function delta(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function TrendBadge({ pct }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "2px", fontSize: "11px", fontWeight: "700", color: up ? "#16A34A" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: "100px" }}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/* ── SVG multi-line chart ── */
function LineChart({ series, labels, height = 140 }) {
  const W = 100; // percentage-based viewBox
  const H = height;
  const PAD = { top: 12, right: 4, bottom: 24, left: 28 };
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
  function area(data, color) {
    if (data.length === 0) return null;
    const line = path(data);
    const close = ` L${px(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
    return (
      <path d={line + close}
        fill={color} fillOpacity="0.08" stroke="none" />
    );
  }

  // y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  // x-axis labels: show first, middle, last
  const xShow = n <= 7 ? labels.map((l, i) => ({ l, i })) : [0, Math.floor((n - 1) / 2), n - 1].map(i => ({ l: labels[i], i }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible" }}>
      {/* Grid lines */}
      {ticks.map(t => (
        <line key={t.v} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
          stroke="#F1F5F9" strokeWidth="0.5" />
      ))}
      {/* Y labels */}
      {ticks.map(t => (
        <text key={t.v} x={PAD.left - 2} y={t.y + 1} textAnchor="end" fontSize="3.5" fill="#94A3B8">{t.v}</text>
      ))}
      {/* X labels */}
      {xShow.map(({ l, i }) => (
        <text key={i} x={px(i)} y={H - 2} textAnchor="middle" fontSize="3.5" fill="#94A3B8">{l}</text>
      ))}
      {/* Areas + Lines */}
      {series.map(s => area(s.data, s.color))}
      {series.map(s => (
        <path key={s.label} d={path(s.data)}
          fill="none" stroke={s.color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {/* Dots on last point */}
      {series.map(s => s.data.length > 0 && (
        <circle key={s.label + "-dot"}
          cx={px(s.data.length - 1)} cy={py(s.data[s.data.length - 1])}
          r="1.6" fill={s.color} />
      ))}
    </svg>
  );
}

/* ── Sortable table ── */
function SortableTable({ columns, rows, emptyMsg = "No data" }) {
  const [sortCol, setSortCol] = useState(0);
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(i) {
    if (sortCol === i) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(i); setSortDir("desc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
            {columns.map((col, i) => (
              <th key={col} onClick={() => handleSort(i)}
                className="rpt-sort"
                style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "right", fontWeight: "700", fontSize: "11px", color: sortCol === i ? "#0F172A" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
                {col} {sortCol === i ? (sortDir === "asc" ? "↑" : "↓") : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: "32px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>{emptyMsg}</td></tr>
          ) : sorted.map((row, ri) => (
            <tr key={ri} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "10px 12px", textAlign: ci === 0 ? "left" : "right", color: ci === 0 ? "#1E293B" : "#374151", fontWeight: ci === 0 ? "600" : "500" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, pct, color = "#2563EB", bg = "#EFF6FF", icon, loading }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>{icon}</div>
        {!loading && <TrendBadge pct={pct} />}
      </div>
      {loading ? (
        <><Shimmer w="60px" h="26px" r="6px" /><div style={{ marginTop: "6px" }}><Shimmer w="90px" h="11px" r="5px" /></div></>
      ) : (
        <>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0F172A", lineHeight: 1, marginBottom: "4px" }}>{value}</p>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</p>
          {sub && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{sub}</p>}
        </>
      )}
    </div>
  );
}

/* ── Status badge ── */
const STATUS_STYLE = {
  completed: { bg: "#F0FDF4", color: "#16A34A" },
  assigned:  { bg: "#EFF6FF", color: "#2563EB" },
  open:      { bg: "#FFFBEB", color: "#D97706" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626" },
  published: { bg: "#EFF6FF", color: "#2563EB" },
  draft:     { bg: "#F8FAFC", color: "#64748B" },
  approved:  { bg: "#F0FDF4", color: "#16A34A" },
  pending:   { bg: "#FFFBEB", color: "#D97706" },
  rejected:  { bg: "#FEF2F2", color: "#DC2626" },
};
function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || { bg: "#F8FAFC", color: "#64748B" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color, textTransform: "capitalize" }}>
      {status}
    </span>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AdminReports() {
  const [period, setPeriod] = useState(1); // index into PERIODS
  const [loading, setLoading] = useState(true);

  // KPIs
  const [kpis, setKpis] = useState({ users: 0, usersPrev: 0, businesses: 0, bizPrev: 0, requests: 0, reqPrev: 0, shifts: 0, shiftsPrev: 0 });

  // Chart data
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);

  // Tables
  const [bizTable, setBizTable]           = useState([]);
  const [requestsByStatus, setReqStatus]  = useState([]);
  const [shiftsByStatus, setShiftStatus]  = useState([]);
  const [usersByRole, setUsersByRole]     = useState([]);
  const [leaveStats, setLeaveStats]       = useState([]);
  const [workerStats, setWorkerStats]     = useState([]);

  // Raw for export
  const [rawData, setRawData] = useState({});

  const days = PERIODS[period].days;

  const load = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
    const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);
    const pStartISO = periodStart.toISOString();
    const prevISO   = prevStart.toISOString();

    const [
      { data: usersAll },
      { data: bizAll },
      { data: reqAll },
      { data: shiftsAll },
      { data: attendAll },
      { data: leaveAll },
    ] = await Promise.all([
      supabase.from("users").select("user_id, role, created_at, is_active"),
      supabase.from("businesses").select("business_id, name, industry, created_at, outlets(outlet_id, staff(staff_id))"),
      supabase.from("krewby_requests").select("request_id, status, created_at, shift_date"),
      supabase.from("shifts").select("shift_id, status, shift_date, outlet_id"),
      supabase.from("attendance").select("attendance_id, status, clock_in"),
      supabase.from("availability").select("request_id, status, leave_type, start_date"),
    ]);

    const users = usersAll || [];
    const biz   = bizAll   || [];
    const reqs  = reqAll   || [];
    const shifts = shiftsAll || [];
    const leave = leaveAll || [];

    // ── KPIs ──
    const inPeriod = (ts) => ts && new Date(ts) >= periodStart;
    const inPrev   = (ts) => ts && new Date(ts) >= prevStart && new Date(ts) < periodStart;

    const newUsers  = users.filter(u => inPeriod(u.created_at)).length;
    const prevUsers = users.filter(u => inPrev(u.created_at)).length;
    const newBiz    = biz.filter(b => inPeriod(b.created_at)).length;
    const prevBiz   = biz.filter(b => inPrev(b.created_at)).length;
    const newReqs   = reqs.filter(r => inPeriod(r.created_at)).length;
    const prevReqs  = reqs.filter(r => inPrev(r.created_at)).length;
    const newShifts = shifts.filter(s => inPeriod(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const prevShifts= shifts.filter(s => inPrev(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    setKpis({ users: newUsers, usersPrev: prevUsers, businesses: newBiz, bizPrev: prevBiz, requests: newReqs, reqPrev: prevReqs, shifts: newShifts, shiftsPrev: prevShifts });

    // ── Chart: daily series ──
    const dayCount = Math.min(days, 30);
    const dayLabels = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(5, 10); // MM-DD
    });
    const dayKeys = dayLabels.map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(0, 10);
    });

    function dailyCount(items, getDate) {
      const map = {};
      items.forEach(it => {
        const d = getDate(it)?.slice(0, 10);
        if (d && dayKeys.includes(d)) map[d] = (map[d] || 0) + 1;
      });
      return dayKeys.map(k => map[k] || 0);
    }

    setChartLabels(dayLabels);
    setChartSeries([
      { label: "New Users",       data: dailyCount(users, u => u.created_at), color: "#2563EB" },
      { label: "Krewby Requests", data: dailyCount(reqs,  r => r.created_at), color: "#DB2777" },
      { label: "Shifts",          data: dailyCount(shifts, s => s.shift_date ? s.shift_date : null), color: "#D97706" },
    ]);

    // ── Businesses table ──
    const bizRows = biz.map(b => ({
      name: b.name,
      industry: b.industry || "—",
      outlets: b.outlets?.length ?? 0,
      staff: b.outlets?.reduce((s, o) => s + (o.staff?.length ?? 0), 0) ?? 0,
      registered: b.created_at ? new Date(b.created_at).toLocaleDateString("en-GB") : "—",
    })).sort((a, b) => b.outlets - a.outlets);
    setBizTable(bizRows);

    // ── Krewby requests by status ──
    const reqMap = {};
    reqs.forEach(r => { reqMap[r.status] = (reqMap[r.status] || 0) + 1; });
    setReqStatus(Object.entries(reqMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    // ── Shifts by status ──
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
    setShiftStatus(Object.entries(shiftMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    // ── Users by role ──
    const roleMap = {};
    users.forEach(u => {
      const label = ROLE_LABELS[u.role] || u.role;
      if (!roleMap[label]) roleMap[label] = { total: 0, active: 0 };
      roleMap[label].total++;
      if (u.is_active) roleMap[label].active++;
    });
    setUsersByRole(Object.entries(roleMap).map(([role, v]) => ({ role, ...v })).sort((a, b) => b.total - a.total));

    // ── Leave/availability ──
    const leaveMap = {};
    leave.forEach(l => { leaveMap[l.status] = (leaveMap[l.status] || 0) + 1; });
    setLeaveStats(Object.entries(leaveMap).map(([s, c]) => ({ status: s, count: c })));

    // ── Worker stats ──
    const workerData = users.filter(u => u.role === "krewby_casual_worker");
    setWorkerStats([
      { label: "Total Workers", value: workerData.length },
      { label: "Active",        value: workerData.filter(u => u.is_active).length },
      { label: "Inactive",      value: workerData.filter(u => !u.is_active).length },
    ]);

    // Store raw for export
    setRawData({ users, biz: bizRows, reqs, shifts, leave, period: PERIODS[period].label });

    setLoading(false);
  }, [days, period]);

  useEffect(() => { load(); }, [load]);

  // ── CSV export ──
  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];

    lines.push(`Krewby Platform Report — ${PERIODS[period].label} period`);
    lines.push(`Generated,${today}`);
    lines.push("");

    lines.push("KPI SUMMARY");
    lines.push("Metric,This Period,Previous Period,Change %");
    lines.push(`New Users,${kpis.users},${kpis.usersPrev},${delta(kpis.users, kpis.usersPrev)}%`);
    lines.push(`New Businesses,${kpis.businesses},${kpis.bizPrev},${delta(kpis.businesses, kpis.bizPrev)}%`);
    lines.push(`Krewby Requests,${kpis.requests},${kpis.reqPrev},${delta(kpis.requests, kpis.reqPrev)}%`);
    lines.push(`Shifts,${kpis.shifts},${kpis.shiftsPrev},${delta(kpis.shifts, kpis.shiftsPrev)}%`);
    lines.push("");

    lines.push("BUSINESSES");
    lines.push("Name,Industry,Outlets,Staff,Registered");
    bizTable.forEach(b => lines.push(`"${b.name}","${b.industry}",${b.outlets},${b.staff},${b.registered}`));
    lines.push("");

    lines.push("USERS BY ROLE");
    lines.push("Role,Total,Active");
    usersByRole.forEach(r => lines.push(`"${r.role}",${r.total},${r.active}`));
    lines.push("");

    lines.push("KREWBY REQUESTS BY STATUS");
    lines.push("Status,Count");
    requestsByStatus.forEach(r => lines.push(`${r.status},${r.count}`));
    lines.push("");

    lines.push("SHIFTS BY STATUS");
    lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push("");

    lines.push("LEAVE REQUESTS BY STATUS");
    lines.push("Status,Count");
    leaveStats.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push("");

    lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => {
      lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krewby-report-${PERIODS[period].label}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ──
  function downloadPDF() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Krewby — Platform Report", 14, 13);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${PERIODS[period].label}   Generated: ${today}`, pageW - 14, 13, { align: "right" });
    y = 34;

    // KPIs
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("KPI Summary", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "This Period", "Prev Period", "Δ %"]],
      body: [
        ["New Users",       kpis.users,      kpis.usersPrev,  `${delta(kpis.users, kpis.usersPrev)}%`],
        ["New Businesses",  kpis.businesses, kpis.bizPrev,    `${delta(kpis.businesses, kpis.bizPrev)}%`],
        ["Krewby Requests", kpis.requests,   kpis.reqPrev,    `${delta(kpis.requests, kpis.reqPrev)}%`],
        ["Shifts",          kpis.shifts,     kpis.shiftsPrev, `${delta(kpis.shifts, kpis.shiftsPrev)}%`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Businesses
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Businesses", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Business", "Industry", "Outlets", "Staff", "Registered"]],
      body: bizTable.map(b => [b.name, b.industry, b.outlets, b.staff, b.registered]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Users by Role", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Role", "Total", "Active"]],
      body: usersByRole.map(r => [r.role, r.total, r.active]),
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    // Side by side: requests + shifts
    autoTable(doc, {
      startY: y,
      head: [["Krewby Requests", "Count"]],
      body: requestsByStatus.map(r => [r.status, r.count]),
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y,
      head: [["Shifts", "Count"]],
      body: shiftsByStatus.map(s => [s.status, s.count]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: pageW / 2 + 2, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Daily Activity", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Date", ...chartSeries.map(s => s.label)]],
      body: chartLabels.map((lbl, i) => [lbl, ...chartSeries.map(s => s.data[i] ?? 0)]),
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: Object.fromEntries(chartSeries.map((_, i) => [i + 1, { halign: "right" }])),
      margin: { left: 14, right: 14 },
    });

    doc.save(`krewby-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const maxRole = Math.max(...usersByRole.map(r => r.total), 1);

  return (
    <AdminLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Platform Analytics</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Real-time overview across all platform activity</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Period tabs */}
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
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <KpiCard loading={loading} icon="👤" label="New Users"       value={kpis.users}      pct={delta(kpis.users, kpis.usersPrev)}      sub={`vs prev ${PERIODS[period].label}`} color="#2563EB" bg="#EFF6FF" />
          <KpiCard loading={loading} icon="🏢" label="New Businesses"  value={kpis.businesses} pct={delta(kpis.businesses, kpis.bizPrev)}    sub={`vs prev ${PERIODS[period].label}`} color="#059669" bg="#ECFDF5" />
          <KpiCard loading={loading} icon="📋" label="Krewby Requests" value={kpis.requests}   pct={delta(kpis.requests, kpis.reqPrev)}     sub={`vs prev ${PERIODS[period].label}`} color="#DB2777" bg="#FDF2F8" />
          <KpiCard loading={loading} icon="📅" label="Shifts"          value={kpis.shifts}     pct={delta(kpis.shifts, kpis.shiftsPrev)}    sub={`vs prev ${PERIODS[period].label}`} color="#D97706" bg="#FFFBEB" />
        </div>

        {/* ── Activity Chart ── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Daily Activity</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Last {Math.min(days, 30)} days</p>
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
            <div style={{ height: "140px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
              {Array.from({ length: 20 }).map((_, i) => <Shimmer key={i} w="100%" h={`${20 + Math.random() * 80}px`} r="3px" />)}
            </div>
          ) : (
            <LineChart series={chartSeries} labels={chartLabels} height={140} />
          )}
        </div>

        {/* ── Businesses Table ── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Businesses</h3>
          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Click a column header to sort</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="36px" />)}
            </div>
          ) : (
            <SortableTable
              columns={["Business", "Industry", "Outlets", "Staff", "Registered"]}
              rows={bizTable.map(b => [b.name, b.industry, b.outlets, b.staff, b.registered])}
              emptyMsg="No businesses yet"
            />
          )}
        </div>

        {/* ── Request Status + Shift Status ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Krewby Requests</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Breakdown by status (all time)</p>
            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="36px" />)}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                  <th style={{ padding: "8px 0", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Count</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Share</th>
                </tr></thead>
                <tbody>
                  {requestsByStatus.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8" }}>No data</td></tr>
                  ) : (() => {
                    const total = requestsByStatus.reduce((s, r) => s + r.count, 0);
                    return requestsByStatus.map(r => (
                      <tr key={r.status} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
                        <td style={{ padding: "10px 0" }}><StatusBadge status={r.status} /></td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{r.count}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", color: "#64748B", fontSize: "12px" }}>{Math.round((r.count / total) * 100)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Shifts</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Breakdown by status (all time)</p>
            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="36px" />)}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                  <th style={{ padding: "8px 0", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Count</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Share</th>
                </tr></thead>
                <tbody>
                  {shiftsByStatus.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8" }}>No data</td></tr>
                  ) : (() => {
                    const total = shiftsByStatus.reduce((s, r) => s + r.count, 0);
                    return shiftsByStatus.map(r => (
                      <tr key={r.status} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
                        <td style={{ padding: "10px 0" }}><StatusBadge status={r.status} /></td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{r.count}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", color: "#64748B", fontSize: "12px" }}>{Math.round((r.count / total) * 100)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── Users by Role + Leave Requests ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Users by Role</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>All registered accounts</p>
            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>{Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} h="38px" />)}</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {usersByRole.map((r, i) => (
                  <div key={r.role} style={{ animation: `fadeUp 0.3s ease ${i * 0.05}s both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{r.role}</span>
                      <div style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                        <span style={{ color: "#16A34A", fontWeight: "600" }}>{r.active} active</span>
                        <span style={{ fontWeight: "700", color: "#0F172A" }}>{r.total}</span>
                      </div>
                    </div>
                    <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "100px", background: "#2563EB", width: `${(r.total / maxRole) * 100}%`, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Leave Requests</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>All time, by approval status</p>
            {loading ? <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="36px" />)}</div> : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                <thead><tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                  <th style={{ padding: "8px 0", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Count</th>
                  <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Share</th>
                </tr></thead>
                <tbody>
                  {leaveStats.length === 0 ? (
                    <tr><td colSpan={3} style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8" }}>No data</td></tr>
                  ) : (() => {
                    const total = leaveStats.reduce((s, l) => s + l.count, 0);
                    return leaveStats.map(l => (
                      <tr key={l.status} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
                        <td style={{ padding: "10px 0" }}><StatusBadge status={l.status} /></td>
                        <td style={{ padding: "10px 0", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{l.count}</td>
                        <td style={{ padding: "10px 0", textAlign: "right", color: "#64748B", fontSize: "12px" }}>{Math.round((l.count / total) * 100)}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
