import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { User, Calendar, CheckSquare, Users } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

if (typeof document !== "undefined" && !document.getElementById("sa-reports-kf")) {
  const s = document.createElement("style");
  s.id = "sa-reports-kf";
  s.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes growBar { from{width:0} to{width:var(--bar-w)} }
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
  system_admin:          "System Admin",
  manager:        "Manager",
  regular_staff:         "Regular Staff",
  casual_staff:   "Casual Staff",
  krewby_casual_worker:  "Krewby Worker",
  business_owner:        "Business Owner",
};

const ROLE_COLORS = {
  "System Admin":    "#0F172A",
  "Business Owner":  "#7C3AED",
  "Manager":  "#059669",
  "Regular Staff":   "#2563EB",
  "Casual Staff":    "#D97706",
  "Krewby Worker":   "#DB2777",
};

const STATUS_COLORS = {
  completed: "#16A34A", published: "#2563EB", draft: "#94A3B8",
  cancelled: "#EF4444", assigned: "#0891B2", open: "#D97706",
  approved:  "#16A34A", pending:  "#D97706", rejected: "#EF4444",
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

/* ── SVG Line chart ── */
function LineChart({ series, labels, height = 260 }) {
  const W = 1000;
  const H = height;
  const PAD = { top: 18, right: 12, bottom: 34, left: 46 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allVals = series.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const n = labels.length;
  function px(i) { return PAD.left + (i / Math.max(n - 1, 1)) * chartW; }
  function py(v) { return PAD.top + (1 - v / maxV) * chartH; }
  function linePath(data) {
    return data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  }
  function areaPath(data) {
    const line = linePath(data);
    return line + ` L${px(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
  }
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 10 ? labels.map((l, i) => ({ l, i })) : [0, Math.floor((n - 1) / 4), Math.floor((n - 1) / 2), Math.floor(3 * (n - 1) / 4), n - 1].map(i => ({ l: labels[i], i }));
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
        {series.map(s => s.data.length > 0 && (
          <path key={s.label + "-area"} d={areaPath(s.data)} fill={s.color} fillOpacity="0.07" stroke="none" />
        ))}
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

/* ── SVG Donut chart ── */
function DonutChart({ segments, size = 180, strokeWidth = 30, centerLabel = "total" }) {
  const cx = size / 2, cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  let cumulative = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      {total === 0 ? (
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeWidth} />
      ) : segments.map((seg, i) => {
        const dash = (seg.value / total) * C;
        const dashOffset = C - cumulative;
        cumulative += dash;
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={dashOffset}
            style={{ transform: `rotate(-90deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}
      <text x={cx} y={cy - size * 0.05} textAnchor="middle" fontSize={size * 0.16} fontWeight="800" fill="#0F172A">{total}</text>
      <text x={cx} y={cy + size * 0.1} textAnchor="middle" fontSize={size * 0.08} fill="#94A3B8">{centerLabel}</text>
    </svg>
  );
}

/* ── Horizontal bar chart ── */
function HBarChart({ rows, colorFn, maxVal }) {
  const max = maxVal || Math.max(...rows.map(r => r.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {rows.map((row, i) => {
        const pct = (row.value / max) * 100;
        const color = colorFn ? colorFn(row.label) : "#2563EB";
        return (
          <div key={row.label} style={{ animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{row.label}</span>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {row.sub !== undefined && <span style={{ fontSize: "11px", color: "#16A34A", fontWeight: "600" }}>{row.sub} active</span>}
                <span style={{ fontSize: "13px", fontWeight: "800", color }}>{row.value}</span>
              </div>
            </div>
            <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: "100px", background: color, width: `${pct}%`, transition: "width 0.8s cubic-bezier(.4,0,.2,1)" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, pct, color = "#2563EB", bg = "#EFF6FF", icon, loading }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
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

/* ── Donut card wrapper ── */
function DonutCard({ title, sub, segments, loading, shimmerRows = 4 }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "3px" }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "18px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: shimmerRows }).map((_, i) => <Shimmer key={i} h="36px" />)}
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <DonutChart segments={segments} size={150} strokeWidth={26} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "9px" }}>
            {segments.map(seg => (
              <div key={seg.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151", textTransform: "capitalize" }}>{seg.label}</span>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "#CBD5E1", fontWeight: "500" }}>
                    {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: "800", color: seg.color, minWidth: "24px", textAlign: "right" }}>{seg.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AdminReports() {
  const [period, setPeriod] = useState(1);
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState({ users: 0, usersPrev: 0, businesses: 0, bizPrev: 0, shifts: 0, shiftsPrev: 0, leave: 0, leavePrev: 0 });
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);
  const [shiftsByStatus, setShiftStatus] = useState([]);
  const [usersByRole, setUsersByRole]     = useState([]);
  const [leaveStats, setLeaveStats]       = useState([]);
  const [rawData, setRawData] = useState({});

  const days = PERIODS[period].days;

  const load = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
    const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);

    const [
      { data: usersAll },
      { data: bizAll },
      { data: shiftsAll },
      { data: leaveAll },
    ] = await Promise.all([
      supabase.from("users").select("user_id, role, created_at, is_active"),
      supabase.from("businesses").select("business_id, created_at"),
      supabase.from("shifts").select("shift_id, status, shift_date"),
      supabase.from("availability").select("request_id, status, leave_type, start_date, created_at"),
    ]);

    const users  = usersAll  || [];
    const biz    = bizAll    || [];
    const shifts = shiftsAll || [];
    const leave  = leaveAll  || [];

    const inPeriod = ts => ts && new Date(ts) >= periodStart;
    const inPrev   = ts => ts && new Date(ts) >= prevStart && new Date(ts) < periodStart;

    const newUsers   = users.filter(u => inPeriod(u.created_at)).length;
    const prevUsers  = users.filter(u => inPrev(u.created_at)).length;
    const newBiz     = biz.filter(b => inPeriod(b.created_at)).length;
    const prevBiz    = biz.filter(b => inPrev(b.created_at)).length;
    const newShifts  = shifts.filter(s => inPeriod(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const prevShifts = shifts.filter(s => inPrev(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const newLeave   = leave.filter(l => inPeriod(l.created_at)).length;
    const prevLeave  = leave.filter(l => inPrev(l.created_at)).length;

    setKpis({ users: newUsers, usersPrev: prevUsers, businesses: newBiz, bizPrev: prevBiz, shifts: newShifts, shiftsPrev: prevShifts, leave: newLeave, leavePrev: prevLeave });

    // Daily chart
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
      { label: "New Users", data: dailyCount(users,  u => u.created_at), color: "#2563EB" },
      { label: "Shifts",    data: dailyCount(shifts, s => s.shift_date),  color: "#D97706" },
      { label: "Leave",     data: dailyCount(leave,  l => l.created_at),  color: "#8B5CF6" },
    ]);

    // Shifts donut
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
    setShiftStatus(
      Object.entries(shiftMap)
        .map(([s, c]) => ({ label: s, value: c, color: STATUS_COLORS[s] || "#94A3B8" }))
        .sort((a, b) => b.value - a.value)
    );

    // Users by role bar
    const roleMap = {};
    users.forEach(u => {
      const label = ROLE_LABELS[u.role] || u.role;
      if (!roleMap[label]) roleMap[label] = { total: 0, active: 0 };
      roleMap[label].total++;
      if (u.is_active) roleMap[label].active++;
    });
    setUsersByRole(Object.entries(roleMap).map(([role, v]) => ({ role, ...v })).sort((a, b) => b.total - a.total));

    // Leave donut
    const leaveMap = {};
    leave.forEach(l => { leaveMap[l.status] = (leaveMap[l.status] || 0) + 1; });
    setLeaveStats(
      Object.entries(leaveMap)
        .map(([s, c]) => ({ label: s, value: c, color: STATUS_COLORS[s] || "#94A3B8" }))
        .sort((a, b) => b.value - a.value)
    );

    setRawData({ users, shifts, leave, period: PERIODS[period].label });
    setLoading(false);
  }, [days, period]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];
    lines.push(`Krewby Platform Report — ${PERIODS[period].label}`);
    lines.push(`Generated,${today}`);
    lines.push("");
    lines.push("KPI SUMMARY");
    lines.push("Metric,This Period,Previous Period,Change %");
    lines.push(`New Users,${kpis.users},${kpis.usersPrev},${delta(kpis.users, kpis.usersPrev)}%`);
    lines.push(`New Businesses,${kpis.businesses},${kpis.bizPrev},${delta(kpis.businesses, kpis.bizPrev)}%`);
    lines.push(`Shifts,${kpis.shifts},${kpis.shiftsPrev},${delta(kpis.shifts, kpis.shiftsPrev)}%`);
    lines.push(`Leave Requests,${kpis.leave},${kpis.leavePrev},${delta(kpis.leave, kpis.leavePrev)}%`);
    lines.push("");
    lines.push("USERS BY ROLE");
    lines.push("Role,Total,Active");
    usersByRole.forEach(r => lines.push(`"${r.role}",${r.total},${r.active}`));
    lines.push("");
    lines.push("SHIFTS BY STATUS");
    lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.label},${s.value}`));
    lines.push("");
    lines.push("LEAVE BY STATUS");
    lines.push("Status,Count");
    leaveStats.forEach(l => lines.push(`${l.label},${l.value}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `krewby-report-${PERIODS[period].label}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
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
        ["Leave Requests",  kpis.leave,      kpis.leavePrev,  `${delta(kpis.leave, kpis.leavePrev)}%`],
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
      startY: y,
      head: [["Shifts by Status", "Count"]],
      body: shiftsByStatus.map(s => [s.label, s.value]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y,
      head: [["Leave by Status", "Count"]],
      body: leaveStats.map(l => [l.label, l.value]),
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: pageW / 2 + 2, right: 14 },
    });
    doc.save(`krewby-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const maxRole = Math.max(...usersByRole.map(r => r.total), 1);

  return (
    <AdminLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Platform Analytics</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Real-time overview across all platform activity</p>
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
          </div>
        </div>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <KpiCard loading={loading} icon={<User size={17} />}        label="New Users"      value={kpis.users}      pct={delta(kpis.users, kpis.usersPrev)}       sub={`vs prev ${PERIODS[period].label}`} color="#2563EB" bg="#EFF6FF" />
          <KpiCard loading={loading} icon={<Users size={17} />}       label="New Businesses" value={kpis.businesses} pct={delta(kpis.businesses, kpis.bizPrev)}     sub={`vs prev ${PERIODS[period].label}`} color="#059669" bg="#ECFDF5" />
          <KpiCard loading={loading} icon={<Calendar size={17} />}    label="Shifts"         value={kpis.shifts}     pct={delta(kpis.shifts, kpis.shiftsPrev)}      sub={`vs prev ${PERIODS[period].label}`} color="#D97706" bg="#FFFBEB" />
          <KpiCard loading={loading} icon={<CheckSquare size={17} />} label="Leave Requests" value={kpis.leave}      pct={delta(kpis.leave, kpis.leavePrev)}        sub={`vs prev ${PERIODS[period].label}`} color="#8B5CF6" bg="#F5F3FF" />
        </div>

        {/* Daily Activity Chart — full width, tall */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Daily Activity</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Last {Math.min(days, 30)} days</p>
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

        {/* Shifts + Leave donut row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <DonutCard
            title="Shifts by Status"
            sub="All shifts, broken down by current status"
            segments={shiftsByStatus}
            loading={loading}
            shimmerRows={4}
          />
          <DonutCard
            title="Leave Requests"
            sub="All time, by approval status"
            segments={leaveStats}
            loading={loading}
            shimmerRows={3}
          />
        </div>

        {/* Users by role — full-width horizontal bar */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "3px" }}>Users by Role</h3>
          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "20px" }}>All registered accounts, active vs total</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {Array.from({ length: 5 }).map((_, i) => <Shimmer key={i} h="40px" />)}
            </div>
          ) : (
            <HBarChart
              rows={usersByRole.map(r => ({ label: r.role, value: r.total, sub: r.active }))}
              colorFn={label => ROLE_COLORS[label] || "#2563EB"}
              maxVal={maxRole}
            />
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
