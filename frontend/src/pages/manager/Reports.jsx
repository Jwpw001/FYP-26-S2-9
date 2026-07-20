import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import { useGoTo } from "../../components/PageTransition";
import { Users, CalendarDays, ClipboardCheck, CalendarClock, Download, History } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

if (typeof document !== "undefined" && !document.getElementById("mgr-reports-styles")) {
  const el = document.createElement("style");
  el.id = "mgr-reports-styles";
  el.textContent = `
    @keyframes pageIn  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    .mgr-rpt-tab:hover { background:#F1F5F9!important; }
    .mgr-rpt-row:hover { background:#F8FAFC!important; }
  `;
  document.head.appendChild(el);
}

const PERIODS = [
  { label: "7D",  days: 7  },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function Shimmer({ w = "100%", h = "16px", r = "6px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function pctDelta(curr, prev) {
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

function LineChart({ series, labels, height = 180 }) {
  const W = 800; const H = height;
  const PAD = { top: 12, right: 8, bottom: 28, left: 36 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const allVals = series.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const n = labels.length;
  const px = i => PAD.left + (i / Math.max(n - 1, 1)) * chartW;
  const py = v => PAD.top + (1 - v / maxV) * chartH;
  const linePath = data => data.length === 0 ? "" : data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const area = (data, color) => {
    if (!data.length) return null;
    const close = ` L${px(data.length-1).toFixed(1)},${(PAD.top+chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top+chartH).toFixed(1)} Z`;
    return <path d={linePath(data) + close} fill={color} fillOpacity="0.08" stroke="none" />;
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 14 ? labels.map((l, i) => ({ l, i })) : Array.from({ length: 7 }, (_, k) => { const i = Math.round(k * (n-1) / 6); return { l: labels[i], i }; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible", display: "block" }}>
      {ticks.map((t, idx) => <line key={`tl-${idx}`} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F1F5F9" strokeWidth="1" />)}
      {ticks.map((t, idx) => <text key={`tt-${idx}`} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="14" fill="#94A3B8">{t.v}</text>)}
      {xShow.map(({ l, i }) => <text key={`xl-${i}`} x={px(i)} y={H - 4} textAnchor="middle" fontSize="14" fill="#94A3B8">{l}</text>)}
      {series.map((s, si) => { const el = area(s.data, s.color); return el ? <path key={`area-${si}`} d={el.props.d} fill={s.color} fillOpacity="0.08" stroke="none" /> : null; })}
      {series.map(s => <path key={`line-${s.label}`} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(s => s.data.length > 0 && <circle key={`dot-${s.label}`} cx={px(s.data.length-1)} cy={py(s.data[s.data.length-1])} r="4" fill={s.color} />)}
    </svg>
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
  present:   { bg: "#F0FDF4", color: "#16A34A" },
  absent:    { bg: "#FEF2F2", color: "#DC2626" },
  late:      { bg: "#FFFBEB", color: "#D97706" },
};
function StatusBadge({ status }) {
  const st = STATUS_STYLE[status] || { bg: "#F8FAFC", color: "#64748B" };
  return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "700", background: st.bg, color: st.color, textTransform: "capitalize" }}>{status?.replace(/_/g, " ")}</span>;
}

function StatusTable({ rows, loading }) {
  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>{Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="36px" />)}</div>;
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
      <thead><tr style={{ borderBottom: "2px solid #F1F5F9" }}>
        <th style={{ padding: "8px 0", textAlign: "left",  fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</th>
        <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Count</th>
        <th style={{ padding: "8px 0", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Share</th>
      </tr></thead>
      <tbody>
        {rows.length === 0
          ? <tr><td colSpan={3} style={{ padding: "24px 0", textAlign: "center", color: "#94A3B8" }}>No data</td></tr>
          : rows.map(r => (
            <tr key={r.status} className="mgr-rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
              <td style={{ padding: "10px 0" }}><StatusBadge status={r.status} /></td>
              <td style={{ padding: "10px 0", textAlign: "right", fontWeight: "700", color: "#0F172A" }}>{r.count}</td>
              <td style={{ padding: "10px 0", textAlign: "right", color: "#64748B", fontSize: "12px" }}>{total ? Math.round((r.count / total) * 100) : 0}%</td>
            </tr>
          ))
        }
      </tbody>
    </table>
  );
}

export default function Reports() {
  const user    = getUser();
  const userId  = user?.user_id;
  const goTo    = useGoTo();

  const [period,     setPeriod]     = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [branchId,   setBranchId]   = useState(null);
  const [branchName, setBranchName] = useState("");

  const [kpis, setKpis] = useState({
    staff: 0, regularStaff: 0, casualStaff: 0,
    shifts: 0, shiftsPrev: 0,
    tsApprovalRate: 0, tsApprovalRatePrev: 0,
    pendingLeave: 0, pendingLeavePrev: 0,
  });
  const [chartLabels,        setChartLabels]        = useState([]);
  const [chartSeries,        setChartSeries]        = useState([]);
  const [workload,           setWorkload]           = useState([]);
  const [shiftsByStatus,     setShiftsByStatus]     = useState([]);
  const [timesheetBreakdown, setTimesheetBreakdown] = useState([]);
  const [leaveByStatus,      setLeaveByStatus]      = useState([]);
  const [staffKpis,          setStaffKpis]          = useState([]);
  const [showAllKpiModal,    setShowAllKpiModal]    = useState(false);

  const days = PERIODS[period].days;

  function logDownload(format) {
    const now   = new Date();
    const start = new Date(now); start.setDate(now.getDate() - days);
    api.post("/api/reports", {
      branch_id:    branchId,
      report_type:  "manager",
      format,
      title:        `${branchName || "Branch"} — Manager Report (${PERIODS[period].label})`,
      period_start: start.toISOString().slice(0, 10),
      period_end:   now.toISOString().slice(0, 10),
    }).catch(() => {});
  }

  // Resolve branch once
  useEffect(() => {
    if (!userId) return;
    supabase.from("staff").select("branch_id, branches(name)")
      .eq("user_id", userId).eq("is_active", true).limit(1)
      .then(async ({ data }) => {
        if (data?.[0]) {
          setBranchId(data[0].branch_id);
          setBranchName(data[0].branches?.name || "");
        } else {
          const { data: omRow } = await supabase
            .from("branch_managers").select("branch_id, branches(name)")
            .eq("user_id", userId).limit(1);
          if (omRow?.[0]) {
            setBranchId(omRow[0].branch_id);
            setBranchName(omRow[0].branches?.name || "");
          }
        }
      });
  }, [userId]);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const now            = new Date();
      const todayStr       = now.toISOString().slice(0, 10);
      const periodStart    = new Date(now); periodStart.setDate(now.getDate() - days);
      const prevStart      = new Date(now); prevStart.setDate(now.getDate() - days * 2);
      const periodStartStr = periodStart.toISOString().slice(0, 10);
      const prevStartStr   = prevStart.toISOString().slice(0, 10);

      // ── Parallel fetch ─────────────────────────────────────────────────────
      const [
        { data: staffData },
        { data: shiftsAll },
        { data: assignCurr },
        { data: assignPrev },
      ] = await Promise.all([
        supabase.from("staff")
          .select("staff_id, staff_type, is_active, users:user_id(full_name)")
          .eq("branch_id", branchId),
        supabase.from("shifts")
          .select("shift_id, status, shift_date")
          .eq("branch_id", branchId)
          .order("shift_date"),
        supabase.from("task_assignments")
          .select("assignment_id, staff_id, staff:staff_id(users:user_id(full_name)), shifts!inner(shift_date, branch_id)")
          .eq("shifts.branch_id", branchId)
          .gte("shifts.shift_date", periodStartStr)
          .lte("shifts.shift_date", todayStr),
        supabase.from("task_assignments")
          .select("assignment_id, shifts!inner(shift_date, branch_id)")
          .eq("shifts.branch_id", branchId)
          .gte("shifts.shift_date", prevStartStr)
          .lt("shifts.shift_date", periodStartStr),
      ]);

      const staff   = staffData  || [];
      const shifts  = shiftsAll  || [];
      const currA   = assignCurr || [];
      const prevA   = assignPrev || [];

      // Leave requests + timesheets (need staff IDs)
      const staffIds = staff.map(s => s.staff_id);
      const [{ data: leaveAll }, { data: timesheetRows }] = await Promise.all([
        staffIds.length > 0
          ? supabase.from("availability").select("request_id, status, start_date").in("staff_id", staffIds)
          : Promise.resolve({ data: [] }),
        staffIds.length > 0
          ? supabase.from("timesheets").select("staff_id, status, hours_worked").in("staff_id", staffIds)
              .gte("log_date", periodStartStr).lte("log_date", todayStr)
          : Promise.resolve({ data: [] }),
      ]);
      const leave = leaveAll || [];

      // ── KPIs ───────────────────────────────────────────────────────────────
      const activeStaff  = staff.filter(s => s.is_active);
      const periodShifts = shifts.filter(s => s.shift_date >= periodStartStr && s.shift_date <= todayStr);
      const prevShifts   = shifts.filter(s => s.shift_date >= prevStartStr   && s.shift_date <  periodStartStr);
      const periodLeave  = leave.filter(l => l.start_date >= periodStartStr  && l.start_date <= todayStr);
      const prevLeave    = leave.filter(l => l.start_date >= prevStartStr    && l.start_date <  periodStartStr);

      const tsApprovedCount = (timesheetRows || []).filter(t => t.status === "approved").length;
      const tsTotalCount    = (timesheetRows || []).length;
      const tsApprovalRate  = tsTotalCount > 0 ? Math.round((tsApprovedCount / tsTotalCount) * 100) : 0;

      setKpis({
        staff:               activeStaff.length,
        regularStaff:        activeStaff.filter(s => s.staff_type === "regular").length,
        casualStaff:         activeStaff.filter(s => s.staff_type === "casual").length,
        shifts:              periodShifts.length,
        shiftsPrev:          prevShifts.length,
        tsApprovalRate,
        tsApprovalRatePrev:  0,
        pendingLeave:        periodLeave.filter(l => l.status === "pending").length,
        pendingLeavePrev:    prevLeave.filter(l => l.status === "pending").length,
      });

      // ── Daily chart ────────────────────────────────────────────────────────
      const dayCount  = Math.min(days, 30);
      const dayKeys   = Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(now); d.setDate(now.getDate() - (dayCount - 1 - i));
        return d.toISOString().slice(0, 10);
      });
      const dayLabels = dayKeys.map(k => k.slice(5));
      function toDailyCount(items, getDate) {
        const map = {};
        items.forEach(it => { const d = getDate(it)?.slice(0, 10); if (d) map[d] = (map[d] || 0) + 1; });
        return dayKeys.map(k => map[k] || 0);
      }
      setChartLabels(dayLabels);
      setChartSeries([
        { label: "Shifts",         data: toDailyCount(shifts, s => s.shift_date), color: "#2563EB" },
        { label: "Leave Requests", data: toDailyCount(leave,  l => l.start_date), color: "#D97706" },
      ]);

      // ── Staff workload ──────────────────────────────────────────────────────
      const wmap = {};
      currA.forEach(a => {
        const name = a.staff?.users?.full_name || `Staff #${a.staff_id}`;
        wmap[a.staff_id] = { name, count: (wmap[a.staff_id]?.count || 0) + 1 };
      });
      setWorkload(Object.values(wmap).sort((a, b) => b.count - a.count).slice(0, 8));

      // ── Shifts by status (all time) ─────────────────────────────────────────
      const smap = {};
      shifts.forEach(s => { smap[s.status] = (smap[s.status] || 0) + 1; });
      setShiftsByStatus(Object.entries(smap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      // ── Timesheet breakdown (period) ───────────────────────────────────────
      const tmap = {};
      (timesheetRows || []).forEach(t => {
        tmap[t.status] = (tmap[t.status] || 0) + 1;
      });
      setTimesheetBreakdown(Object.entries(tmap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      // ── Leave by status (all time) ──────────────────────────────────────────
      const lmap = {};
      leave.forEach(l => { lmap[l.status] = (lmap[l.status] || 0) + 1; });
      setLeaveByStatus(Object.entries(lmap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      // ── Per-staff KPIs ──────────────────────────────────────────────────────
      const kpiMap = {};
      staff.filter(s => s.users && s.users.full_name).forEach(s => {
        kpiMap[s.staff_id] = {
          staff_id:   s.staff_id,
          name:       s.users.full_name,
          staff_type: s.staff_type,
          is_active:  s.is_active,
          shifts: 0,
          hoursLogged: 0,
          tsApproved: 0, tsPending: 0, tsRejected: 0,
          leaveCount: 0,
        };
      });

      // shifts from currA
      currA.forEach(a => {
        const row = kpiMap[a.staff_id];
        if (!row) return;
        row.shifts++;
      });

      // timesheets
      (timesheetRows || []).forEach(t => {
        const row = kpiMap[t.staff_id];
        if (!row) return;
        if (t.status === "approved")  { row.tsApproved++;  row.hoursLogged += parseFloat(t.hours_worked || 0); }
        if (t.status === "pending")   row.tsPending++;
        if (t.status === "rejected")  row.tsRejected++;
      });

      // leave (period)
      const leaveByStaff = {};
      leave.filter(l => l.start_date >= periodStartStr && l.start_date <= todayStr)
           .forEach(l => { leaveByStaff[l.staff_id] = (leaveByStaff[l.staff_id] || 0) + 1; });

      // need staff_id on leave — re-fetch with staff_id included
      const { data: leaveWithStaff } = staffIds.length > 0
        ? await supabase.from("availability").select("staff_id, start_date")
            .in("staff_id", staffIds).gte("start_date", periodStartStr).lte("start_date", todayStr)
        : { data: [] };
      (leaveWithStaff || []).forEach(l => {
        const row = kpiMap[l.staff_id];
        if (row) row.leaveCount++;
      });

      // Sort by computed score descending so top performers appear first
      const scored = Object.values(kpiMap).map(s => {
        const tsTotal = s.tsApproved + s.tsPending + s.tsRejected;
        const approvalRate = tsTotal > 0 ? (s.tsApproved / tsTotal) : null;
        const shiftScore = Math.min(s.shifts * 8, 25);
        const hoursScore = Math.min(s.hoursLogged / 2, 25);
        const tsScore    = approvalRate != null ? approvalRate * 35 : 17.5;
        const leaveScore = Math.max(0, 15 - s.leaveCount * 3);
        return { ...s, _score: Math.round(shiftScore + hoursScore + tsScore + leaveScore) };
      });
      setStaffKpis(scored.sort((a, b) => b._score - a._score));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [branchId, days]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];
    lines.push(`${branchName || "Branch"} — Manager Report (${PERIODS[period].label})`);
    lines.push(`Generated,${today}`);
    lines.push(""); lines.push("KPI SUMMARY"); lines.push("Metric,Value");
    lines.push(`Active Staff,${kpis.staff}`);
    lines.push(`Regular Staff,${kpis.regularStaff}`);
    lines.push(`Casual Staff,${kpis.casualStaff}`);
    lines.push(`Shifts (period),${kpis.shifts}`);
    lines.push(`TS Approval Rate,${kpis.tsApprovalRate ?? 0}%`);
    lines.push(`Pending Leave (period),${kpis.pendingLeave}`);
    lines.push(""); lines.push("STAFF WORKLOAD"); lines.push("Staff,Shifts");
    workload.forEach(w => lines.push(`"${w.name}",${w.count}`));
    lines.push(""); lines.push("SHIFTS BY STATUS"); lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push(""); lines.push("TIMESHEET BREAKDOWN"); lines.push("Status,Count");
    timesheetBreakdown.forEach(a => lines.push(`${a.status},${a.count}`));
    lines.push(""); lines.push("LEAVE BY STATUS"); lines.push("Status,Count");
    leaveByStatus.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push(""); lines.push("STAFF KPI"); lines.push("Staff,Type,Shifts,HoursLogged,TS_Approved,TS_Pending,TS_Rejected,Leave");
    staffKpis.forEach(s => {
      lines.push(`"${s.name}",${s.staff_type},${s.shifts},${s.hoursLogged.toFixed(1)},${s.tsApproved},${s.tsPending},${s.tsRejected},${s.leaveCount}`);
    });
    lines.push(""); lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `branch-report-${PERIODS[period].label}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
    logDownload("csv");
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
    doc.text(`${branchName || "Branch"} — Manager Report`, 14, 13);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${PERIODS[period].label}   Generated: ${today}`, pageW - 14, 13, { align: "right" });
    y = 34;

    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("KPI Summary", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "Value"]],
      body: [
        ["Active Staff",           `${kpis.staff} (${kpis.regularStaff} regular · ${kpis.casualStaff} casual)`],
        ["Shifts (period)",        kpis.shifts],
        ["TS Approval Rate",       `${kpis.tsApprovalRate ?? 0}%`],
        ["Pending Leave (period)", kpis.pendingLeave],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (workload.length > 0) {
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Staff Workload", 14, y); y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Staff", "Shifts"]],
        body: workload.map(w => [w.name, w.count]),
        headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

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
      head: [["Timesheet Status", "Count"]],
      body: timesheetBreakdown.map(t => [t.status, t.count]),
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: pageW / 2 + 2, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (leaveByStatus.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y,
        head: [["Leave by Status", "Count"]],
        body: leaveByStatus.map(l => [l.status, l.count]),
        headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: 14, right: pageW / 2 + 2 },
      });
      y = doc.lastAutoTable.finalY + 8;
    }

    if (staffKpis.length > 0) {
      doc.addPage(); y = 20;
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
      doc.text("Staff KPI", 14, y); y += 3;
      autoTable(doc, {
        startY: y,
        head: [["Staff", "Type", "Shifts", "Hours", "TS ✓", "TS ⏳", "TS ✗", "Leave", "Score"]],
        body: staffKpis.map(s => {
          const tsTotal = s.tsApproved + s.tsPending + s.tsRejected;
          const approvalRate = tsTotal > 0 ? (s.tsApproved / tsTotal) : null;
          const score = Math.round(
            Math.min(s.shifts * 8, 25) +
            Math.min(s.hoursLogged / 2, 25) +
            (approvalRate != null ? approvalRate * 35 : 17.5) +
            Math.max(0, 15 - s.leaveCount * 3)
          );
          return [s.name, s.staff_type, s.shifts, s.hoursLogged.toFixed(1), s.tsApproved, s.tsPending, s.tsRejected, s.leaveCount, score];
        }),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
    }

    const safeName = (branchName || "branch").toLowerCase().replace(/\s+/g, "-");
    doc.save(`${safeName}-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
    logDownload("pdf");
  }

  const maxWorkload = workload[0]?.count || 1;

  return (
    <ManagerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Reports</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {branchName ? `${branchName} — ` : ""}Branch performance overview
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "2px" }}>
              {PERIODS.map((p, i) => (
                <button key={p.label} onClick={() => setPeriod(i)} className="mgr-rpt-tab"
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
            <button onClick={() => goTo("/manager/report-history")}
              style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <History size={14} strokeWidth={2} /> History
            </button>
          </div>
        </div>

        {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <KpiCard loading={loading} Icon={Users}         color="#2563EB" bg="#EFF6FF"
            label="Active Staff"    value={kpis.staff}              pct={null}
            sub={`${kpis.regularStaff} regular · ${kpis.casualStaff} casual`} />
          <KpiCard loading={loading} Icon={CalendarDays}  color="#059669" bg="#ECFDF5"
            label="Shifts"          value={kpis.shifts}             pct={pctDelta(kpis.shifts, kpis.shiftsPrev)}
            sub={`vs prev ${PERIODS[period].label}`} />
          <KpiCard loading={loading} Icon={ClipboardCheck} color="#7C3AED" bg="#F5F3FF"
            label="TS Approval Rate" value={`${kpis.tsApprovalRate ?? 0}%`} pct={null}
            sub="approved timesheets (period)" />
          <KpiCard loading={loading} Icon={CalendarClock} color="#D97706" bg="#FFFBEB"
            label="Pending Leave"   value={kpis.pendingLeave}       pct={pctDelta(kpis.pendingLeave, kpis.pendingLeavePrev)}
            sub={`vs prev ${PERIODS[period].label}`} />
        </div>

        {/* ── Daily Activity Chart ───────────────────────────────────────────── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Daily Activity</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Last {Math.min(days, 30)} days</p>
            </div>
            <div style={{ display: "flex", gap: "16px" }}>
              {chartSeries.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "3px", borderRadius: "2px", background: s.color }} />
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          {loading
            ? <div style={{ height: "180px", background: "linear-gradient(90deg,#F8FAFC 25%,#F1F5F9 50%,#F8FAFC 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", borderRadius: "8px" }} />
            : <LineChart series={chartSeries} labels={chartLabels} height={180} />}
        </div>

        {/* ── Staff Workload + Timesheet Breakdown ───────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>

          {/* Staff Workload */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Staff Workload</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Shifts worked per staff member (period)</p>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="36px" />)}
              </div>
            ) : workload.length === 0 ? (
              <p style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", padding: "24px 0" }}>No shift assignments in this period.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {workload.map((w, i) => (
                  <div key={w.name} style={{ animation: `fadeUp 0.3s ease ${i * 0.06}s both` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{w.name}</span>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#2563EB" }}>{w.count}</span>
                    </div>
                    <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
                      <div style={{ height: "100%", borderRadius: "100px", background: "linear-gradient(90deg,#3B82F6,#2563EB)", width: `${(w.count / maxWorkload) * 100}%`, transition: "width 0.7s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Timesheet Breakdown */}
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Timesheet</h3>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Submission status for the period</p>
            <StatusTable rows={timesheetBreakdown} loading={loading} />
          </div>
        </div>

        {/* ── Shifts by Status + Leave by Status ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
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

        {/* ── Staff KPI Table ─────────────────────────────────────────────────── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Top Staff KPI</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Top 3 performers this period</p>
            </div>
            {!loading && staffKpis.length > 3 && (
              <button onClick={() => setShowAllKpiModal(true)}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#2563EB", fontSize: "12px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px" }}>
                View all {staffKpis.length} staff →
              </button>
            )}
          </div>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="48px" />)}
            </div>
          ) : staffKpis.length === 0 ? (
            <p style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", padding: "32px 0" }}>No staff data available.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <StaffKpiTable rows={staffKpis.slice(0, 3)} />
              <p style={{ fontSize: "11px", color: "#CBD5E1", marginTop: "14px", textAlign: "right" }}>
                Score = Shifts (25) + Hours (25) + Timesheets (35) + Leave (15) · max 100
              </p>
            </div>
          )}
        </div>

        {showAllKpiModal && (
          <AllStaffKpiModal staffKpis={staffKpis} onClose={() => setShowAllKpiModal(false)} />
        )}

      </div>
    </ManagerLayout>
  );
}

function StaffKpiTable({ rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "720px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
          {["#", "Staff", "Type", "Shifts", "Hours Logged", "Timesheets", "Leave Taken", "Score"].map(h => (
            <th key={h} style={{ padding: "10px 12px", textAlign: h === "Staff" || h === "#" ? "left" : "center", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const tsTotal      = s.tsApproved + s.tsPending + s.tsRejected;
          const approvalRate = tsTotal > 0 ? Math.round((s.tsApproved / tsTotal) * 100) : null;
          const shiftScore   = Math.min(s.shifts * 8, 25);
          const hoursScore   = Math.min(s.hoursLogged / 2, 25);
          const tsScore      = approvalRate != null ? (approvalRate / 100) * 35 : 17.5;
          const leaveScore   = Math.max(0, 15 - s.leaveCount * 3);
          const score        = Math.round(shiftScore + hoursScore + tsScore + leaveScore);
          const scoreColor   = score >= 80 ? "#16A34A" : score >= 55 ? "#D97706" : "#DC2626";
          const scoreBg      = score >= 80 ? "#F0FDF4" : score >= 55 ? "#FFFBEB" : "#FEF2F2";
          const rankColors   = ["#F59E0B", "#94A3B8", "#CD7C3E"];
          const rankEmoji    = ["🥇", "🥈", "🥉"];

          return (
            <tr key={s.staff_id} className="mgr-rpt-row" style={{ borderBottom: "1px solid #F8FAFC", animation: `fadeUp 0.3s ease ${i * 0.05}s both` }}>
              <td style={{ padding: "13px 12px", fontWeight: "800", fontSize: "16px", color: rankColors[i] ?? "#CBD5E1", width: "32px" }}>
                {rankEmoji[i] ?? `${i + 1}`}
              </td>
              <td style={{ padding: "13px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#EFF6FF", color: "#2563EB", fontSize: "13px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {s.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontWeight: "600", color: "#0F172A", whiteSpace: "nowrap" }}>{s.name}</p>
                    {!s.is_active && <p style={{ fontSize: "10px", color: "#DC2626", fontWeight: "600" }}>Inactive</p>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", background: s.staff_type === "regular" ? "#EFF6FF" : "#F5F3FF", color: s.staff_type === "regular" ? "#2563EB" : "#7C3AED", textTransform: "capitalize" }}>{s.staff_type}</span>
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.shifts > 0 ? "#0F172A" : "#CBD5E1" }}>{s.shifts}</td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.hoursLogged > 0 ? "#0F172A" : "#CBD5E1" }}>
                {s.hoursLogged > 0 ? `${s.hoursLogged.toFixed(1)}h` : "—"}
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                {tsTotal === 0
                  ? <span style={{ color: "#CBD5E1", fontSize: "12px" }}>—</span>
                  : <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                      {s.tsApproved > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#F0FDF4", color: "#16A34A" }}>✓ {s.tsApproved}</span>}
                      {s.tsPending  > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706" }}>⏳ {s.tsPending}</span>}
                      {s.tsRejected > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#FEF2F2", color: "#DC2626" }}>✗ {s.tsRejected}</span>}
                    </div>
                }
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.leaveCount > 2 ? "#DC2626" : s.leaveCount > 0 ? "#D97706" : "#CBD5E1" }}>
                {s.leaveCount > 0 ? s.leaveCount : "—"}
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                <span style={{ display: "inline-block", fontWeight: "800", fontSize: "13px", padding: "4px 12px", borderRadius: "8px", background: scoreBg, color: scoreColor, minWidth: "44px" }}>{score}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AllStaffKpiModal({ staffKpis, onClose }) {
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 99999, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "32px 16px", overflowY: "auto", backdropFilter: "blur(2px)" }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "#FFF", borderRadius: "20px", width: "100%", maxWidth: "920px", boxShadow: "0 32px 80px rgba(0,0,0,0.22)", animation: "fadeUp 0.2s cubic-bezier(0.34,1.26,0.64,1) both", flexShrink: 0 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "22px 28px", borderBottom: "1px solid #F1F5F9" }}>
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A" }}>All Staff KPI</h2>
            <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{staffKpis.length} staff · sorted by score</p>
          </div>
          <button onClick={onClose}
            style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", color: "#64748B", lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Table */}
        <div style={{ padding: "20px 28px", overflowX: "auto" }}>
          <StaffKpiTable rows={staffKpis} />
          <p style={{ fontSize: "11px", color: "#CBD5E1", marginTop: "14px", textAlign: "right" }}>
            Score = Shifts (25) + Hours (25) + Timesheets (35) + Leave (15) · max 100
          </p>
        </div>

      </div>
    </div>,
    document.body
  );
}
