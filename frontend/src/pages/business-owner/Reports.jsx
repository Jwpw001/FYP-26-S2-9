import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import { Users, CalendarDays, CalendarClock, Download, TrendingUp, TrendingDown } from "lucide-react";
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
    .bo-rpt-sort:hover { color:#0F172A!important; }
  `;
  document.head.appendChild(s);
}

const PERIODS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

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
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: "700", color: up ? "#16A34A" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: "100px" }}>
      <Icon size={11} /> {Math.abs(pct)}%
    </span>
  );
}

function LineChart({ series, labels, height = 180 }) {
  const W = 800;
  const H = height;
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
  function area(data, color) {
    if (data.length === 0) return null;
    const line = path(data);
    const close = ` L${px(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
    return <path d={line + close} fill={color} fillOpacity="0.08" stroke="none" />;
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 14 ? labels.map((l, i) => ({ l, i })) : Array.from({ length: 7 }, (_, k) => { const i = Math.round(k * (n - 1) / 6); return { l: labels[i], i }; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible", display: "block" }}>
      {ticks.map(t => <line key={t.v} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F1F5F9" strokeWidth="1" />)}
      {ticks.map(t => <text key={t.v} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="14" fill="#94A3B8">{t.v}</text>)}
      {xShow.map(({ l, i }) => <text key={i} x={px(i)} y={H - 4} textAnchor="middle" fontSize="14" fill="#94A3B8">{l}</text>)}
      {series.map(s => area(s.data, s.color))}
      {series.map(s => <path key={s.label} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(s => s.data.length > 0 && <circle key={s.label + "-dot"} cx={px(s.data.length - 1)} cy={py(s.data[s.data.length - 1])} r="4" fill={s.color} />)}
    </svg>
  );
}

function KpiCard({ label, value, sub, pct, color = "#2563EB", bg = "#EFF6FF", Icon, loading }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {Icon && <Icon size={18} strokeWidth={2} />}
        </div>
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

const STATUS_STYLE = {
  completed: { bg: "#F0FDF4", color: "#16A34A" },
  published: { bg: "#EFF6FF", color: "#2563EB" },
  draft:     { bg: "#F8FAFC", color: "#64748B" },
  cancelled: { bg: "#FEF2F2", color: "#DC2626" },
  approved:  { bg: "#F0FDF4", color: "#16A34A" },
  pending:   { bg: "#FFFBEB", color: "#D97706" },
  rejected:  { bg: "#FEF2F2", color: "#DC2626" },
  assigned:  { bg: "#EFF6FF", color: "#2563EB" },
  pending_review: { bg: "#FFFBEB", color: "#D97706" },
};
function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || { bg: "#F8FAFC", color: "#64748B" };
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color, textTransform: "capitalize" }}>
      {status?.replace("_", " ")}
    </span>
  );
}

function StatusTable({ rows, loading }) {
  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="36px" />)}</div>;
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead><tr style={{ borderBottom: "2px solid #F1F5F9" }}>
        <th style={{ padding: "8px 0", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
        <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Count</th>
        <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Share</th>
      </tr></thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={3} style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8" }}>No data</td></tr>
        ) : rows.map(r => (
          <tr key={r.status} className="bo-rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
            <td style={{ padding: "10px 0" }}><StatusBadge status={r.status} /></td>
            <td style={{ padding: "10px 0", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{r.count}</td>
            <td style={{ padding: "10px 0", textAlign: "right", color: "#64748B", fontSize: "12px" }}>{total ? Math.round((r.count / total) * 100) : 0}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function BOReports() {
  const user = getUser();
  const [period, setPeriod] = useState(1);
  const [loading, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");

  const [kpis, setKpis] = useState({ staff: 0, staffPrev: 0, shifts: 0, shiftsPrev: 0, leave: 0, leavePrev: 0 });
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [outletRows, setOutletRows] = useState([]);
  const [shiftsByStatus, setShiftsByStatus] = useState([]);
  const [leaveByStatus, setLeaveByStatus] = useState([]);
  const [staffByType, setStaffByType] = useState([]);

  const days = PERIODS[period].days;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Get business via authenticated backend API
      const [bizResp, outletResp] = await Promise.all([
        api.get("/api/business/info"),
        api.get("/api/business/outlets"),
      ]);

      const bizData = bizResp.business;
      if (!bizData) { setLoading(false); return; }
      setBusinessName(bizData.name);

      const outlets = outletResp.outlets || [];
      const outletIds = outlets.map(o => o.branch_id);
      if (outletIds.length === 0) { setLoading(false); return; }

      // Fetch staff for each outlet via Supabase
      const { data: staffData } = await supabase
        .from("staff")
        .select("staff_id, staff_type, is_active, branch_id")
        .in("branch_id", outletIds);

      const allStaff = (staffData || []).map(s => ({
        ...s,
        outlet_name: outlets.find(o => o.branch_id === s.branch_id)?.name || "",
      }));
      const staffIds = allStaff.map(s => s.staff_id);

      const now = new Date();
      const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
      const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);

      // Fetch shifts, leave requests for these outlets
      const [{ data: shiftsAll }, { data: leaveAll }] = await Promise.all([
        outletIds.length > 0
          ? supabase.from("shifts").select("shift_id, status, shift_date, branch_id").in("branch_id", outletIds)
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

      // Chart
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

      // Outlets table
      setOutletRows(outlets.map(o => ({
        name: o.name,
        totalStaff: allStaff.filter(s => s.branch_id === o.branch_id).length,
        activeStaff: allStaff.filter(s => s.branch_id === o.branch_id && s.is_active).length,
        shifts: shifts.filter(s => s.branch_id === o.branch_id).length,
        published: shifts.filter(s => s.branch_id === o.branch_id && s.status === "published").length,
      })));

      // Breakdowns
      const shiftMap = {}; shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
      setShiftsByStatus(Object.entries(shiftMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const leaveMap = {}; leave.forEach(l => { leaveMap[l.status] = (leaveMap[l.status] || 0) + 1; });
      setLeaveByStatus(Object.entries(leaveMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const typeMap = {}; allStaff.forEach(s => { const t = s.staff_type || "unknown"; typeMap[t] = (typeMap[t] || 0) + 1; });
      setStaffByType(Object.entries(typeMap).map(([t, c]) => ({ type: t, count: c })));

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
    lines.push("");
    lines.push("KPI SUMMARY");
    lines.push("Metric,Value");
    lines.push(`Active Staff,${kpis.staff}`);
    lines.push(`Shifts (period),${kpis.shifts}`);
    lines.push(`Leave Requests (period),${kpis.leave}`);
    lines.push("");
    lines.push("OUTLETS");
    lines.push("Outlet,Total Staff,Active Staff,Total Shifts,Published");
    outletRows.forEach(o => lines.push(`"${o.name}",${o.totalStaff},${o.activeStaff},${o.shifts},${o.published}`));
    lines.push("");
    lines.push("SHIFTS BY STATUS");
    lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push("");
    lines.push("LEAVE BY STATUS");
    lines.push("Status,Count");
    leaveByStatus.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push("");
    lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(",")));

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${businessName.toLowerCase().replace(/\s+/g, "-")}-report-${PERIODS[period].label}-${today}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  function downloadPDF() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
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

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Outlets Overview", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Outlet", "Total Staff", "Active Staff", "Total Shifts", "Published"]],
      body: outletRows.map(o => [o.name, o.totalStaff, o.activeStaff, o.shifts, o.published]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y,
      head: [["Shifts by Status", "Count"]],
      body: shiftsByStatus.map(s => [s.status, s.count]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y,
      head: [["Leave by Status", "Count"]],
      body: leaveByStatus.map(l => [l.status, l.count]),
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: pageW / 2 + 2, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    doc.save(`${businessName.toLowerCase().replace(/\s+/g, "-")}-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const maxOutletStaff = Math.max(...outletRows.map(o => o.totalStaff), 1);

  return (
    <BusinessOwnerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Reports</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {businessName ? `${businessName} — ` : ""}Consolidated across all outlets
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
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <KpiCard loading={loading} Icon={Users}         label="Active Staff"      value={kpis.staff}   pct={null}                                          sub="across all outlets"                 color="#2563EB" bg="#EFF6FF" />
          <KpiCard loading={loading} Icon={CalendarDays}  label="Shifts"            value={kpis.shifts}  pct={delta(kpis.shifts,  kpis.shiftsPrev)}          sub={`vs prev ${PERIODS[period].label}`} color="#059669" bg="#ECFDF5" />
          <KpiCard loading={loading} Icon={CalendarClock} label="Leave Requests"    value={kpis.leave}   pct={delta(kpis.leave,   kpis.leavePrev)}           sub={`vs prev ${PERIODS[period].label}`} color="#D97706" bg="#FFFBEB" />
        </div>

        {/* Activity Chart */}
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
            <div style={{ height: "180px", background: "linear-gradient(90deg,#F8FAFC 25%,#F1F5F9 50%,#F8FAFC 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", borderRadius: "8px" }} />
          ) : <LineChart series={chartSeries} labels={chartLabels} height={180} />}
        </div>

        {/* Outlets Table */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Outlets Overview</h3>
          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Staffing and shift coverage per outlet</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="52px" />)}
            </div>
          ) : outletRows.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No outlets found.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {outletRows.map((o, i) => (
                <div key={o.name} style={{ animation: `fadeUp 0.3s ease ${i * 0.07}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>{o.name}</span>
                    <div style={{ display: "flex", gap: "16px", fontSize: "12px" }}>
                      <span style={{ color: "#64748B" }}><strong style={{ color: "#0F172A" }}>{o.activeStaff}</strong>/{o.totalStaff} staff active</span>
                      <span style={{ color: "#64748B" }}><strong style={{ color: "#0F172A" }}>{o.published}</strong>/{o.shifts} shifts published</span>
                    </div>
                  </div>
                  <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: "100px", background: "#2563EB", width: `${(o.totalStaff / maxOutletStaff) * 100}%`, transition: "width 0.8s ease" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Breakdowns */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Shifts</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>By status (all time)</p>
            <StatusTable rows={shiftsByStatus} loading={loading} />
          </div>
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Leave Requests</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>By approval status (all time)</p>
            <StatusTable rows={leaveByStatus} loading={loading} />
          </div>
        </div>

      </div>
    </BusinessOwnerLayout>
  );
}
