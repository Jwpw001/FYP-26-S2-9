import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import { useGoTo } from "../../components/PageTransition";
import { Download, History } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import UserAvatar from "../../components/UserAvatar";
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

const STATUS_BAR_COLOR = {
  completed: "#16A34A", published: "#2563EB", draft: "#94A3B8",
  cancelled: "#EF4444", assigned: "#0891B2", open: "#D97706",
  approved: "#16A34A", pending: "#D97706", rejected: "#EF4444",
  present: "#16A34A", absent: "#EF4444", late: "#D97706", pending_review: "#D97706",
};

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
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "18px", fontWeight: "700", color: up ? "#16A34A" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: "100px" }}>
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
              <p style={{ fontSize: "19px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", margin: "8px 0 2px" }}>{s.label}</p>
              <p style={{ fontSize: "18px", color: "#94A3B8", margin: 0 }}>{s.sub}</p>
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
      <h3 style={{ fontSize: "21px", fontWeight: "700", color: "#0F172A", margin: 0 }}>{title}</h3>
      <p style={{ fontSize: "19px", color: "#94A3B8", margin: "3px 0 16px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map(i => <Shimmer key={i} h="30px" />)}
        </div>
      ) : rows.length === 0 ? (
        <p style={{ fontSize: "20px", color: "#94A3B8", textAlign: "center", padding: "16px 0" }}>No data</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {rows.map(r => {
            const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
            const color = STATUS_BAR_COLOR[r.status] || "#94A3B8";
            return (
              <div key={r.status}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "5px" }}>
                  <span style={{ fontSize: "19.5px", fontWeight: "600", color: "#374151", textTransform: "capitalize" }}>{r.status?.replace(/_/g, " ")}</span>
                  <span style={{ fontSize: "19px", color: "#64748B" }}><strong style={{ color: "#0F172A", fontWeight: "700" }}>{r.count}</strong> · {pct}%</span>
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
  const px = i => PAD.left + (i / Math.max(n - 1, 1)) * chartW;
  const py = v => PAD.top + (1 - v / maxV) * chartH;
  const linePath = data => data.length === 0 ? "" : data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  const xShow = n <= 14 ? labels.map((l, i) => ({ l, i })) : Array.from({ length: 7 }, (_, k) => { const i = Math.round(k * (n-1) / 6); return { l: labels[i], i }; });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: "visible", display: "block" }}>
      {ticks.map((t, idx) => <line key={`tl-${idx}`} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#F1F5F9" strokeWidth="1" />)}
      {ticks.map((t, idx) => <text key={`tt-${idx}`} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="14" fill="#94A3B8">{t.v}</text>)}
      {xShow.map(({ l, i }) => <text key={`xl-${i}`} x={px(i)} y={H - 4} textAnchor="middle" fontSize="14" fill="#94A3B8">{l}</text>)}
      {series.map((s, si) => {
        if (!s.data.length) return null;
        const close = ` L${px(s.data.length-1).toFixed(1)},${(PAD.top+chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top+chartH).toFixed(1)} Z`;
        return <path key={`area-${si}`} d={linePath(s.data) + close} fill={s.color} fillOpacity="0.08" stroke="none" />;
      })}
      {series.map(s => <path key={`line-${s.label}`} d={linePath(s.data)} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(s => s.data.length > 0 && <circle key={`dot-${s.label}`} cx={px(s.data.length-1)} cy={py(s.data[s.data.length-1])} r="4" fill={s.color} />)}
    </svg>
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
  const [showHistory,    setShowHistory]    = useState(false);
  const [historyRows,    setHistoryRows]    = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [kpis, setKpis] = useState({
    staff: 0, regularStaff: 0, casualStaff: 0,
    shifts: 0, shiftsPrev: 0,
    tsApprovalRate: 0, tsApprovalRatePrev: 0,
    pendingLeave: 0, pendingLeavePrev: 0,
  });
  const [chartLabels,        setChartLabels]        = useState([]);
  const [chartSeries,        setChartSeries]        = useState([]);
  const [shiftsByStatus,     setShiftsByStatus]     = useState([]);
  const [timesheetBreakdown, setTimesheetBreakdown] = useState([]);
  const [leaveByStatus,      setLeaveByStatus]      = useState([]);
  const [staffKpis,          setStaffKpis]          = useState([]);

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

  function openHistory() {
    setShowHistory(true);
    setHistoryLoading(true);
    api.get("/api/reports")
      .then(r => setHistoryRows(r.reports || []))
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }

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

      const [
        { data: staffData },
        { data: shiftsAll },
        { data: assignCurr },
        { data: assignPrev },
      ] = await Promise.all([
        supabase.from("staff")
          .select("staff_id, staff_type, is_active, users:user_id(full_name, avatar_url)")
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

      const smap = {};
      shifts.forEach(s => { smap[s.status] = (smap[s.status] || 0) + 1; });
      setShiftsByStatus(Object.entries(smap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const tmap = {};
      (timesheetRows || []).forEach(t => { tmap[t.status] = (tmap[t.status] || 0) + 1; });
      setTimesheetBreakdown(Object.entries(tmap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const lmap = {};
      leave.forEach(l => { lmap[l.status] = (lmap[l.status] || 0) + 1; });
      setLeaveByStatus(Object.entries(lmap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

      const kpiMap = {};
      staff.filter(s => s.users && s.users.full_name).forEach(s => {
        kpiMap[s.staff_id] = {
          staff_id: s.staff_id, name: s.users.full_name, avatar_url: s.users.avatar_url || null,
          staff_type: s.staff_type, is_active: s.is_active,
          shifts: 0, hoursLogged: 0, tsApproved: 0, tsPending: 0, tsRejected: 0, leaveCount: 0,
        };
      });
      currA.forEach(a => { const row = kpiMap[a.staff_id]; if (row) row.shifts++; });
      (timesheetRows || []).forEach(t => {
        const row = kpiMap[t.staff_id];
        if (!row) return;
        if (t.status === "approved")  { row.tsApproved++;  row.hoursLogged += parseFloat(t.hours_worked || 0); }
        if (t.status === "pending")   row.tsPending++;
        if (t.status === "rejected")  row.tsRejected++;
      });
      const { data: leaveWithStaff } = staffIds.length > 0
        ? await supabase.from("availability").select("staff_id, start_date")
            .in("staff_id", staffIds).gte("start_date", periodStartStr).lte("start_date", todayStr)
        : { data: [] };
      (leaveWithStaff || []).forEach(l => { const row = kpiMap[l.staff_id]; if (row) row.leaveCount++; });

      const scored = Object.values(kpiMap).map(s => {
        const tsTotal = s.tsApproved + s.tsPending + s.tsRejected;
        const approvalRate = tsTotal > 0 ? (s.tsApproved / tsTotal) : null;
        return { ...s, _score: Math.round(Math.min(s.shifts * 8, 25) + Math.min(s.hoursLogged / 2, 25) + (approvalRate != null ? approvalRate * 35 : 17.5) + Math.max(0, 15 - s.leaveCount * 3)) };
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

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
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
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 15 },
      bodyStyles: { fontSize: 15 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
    if (y > 210) { doc.addPage(); y = 20; }
    autoTable(doc, {
      startY: y, head: [["Shifts by Status", "Count"]],
      body: shiftsByStatus.map(s => [s.status, s.count]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 15 }, bodyStyles: { fontSize: 15 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y, head: [["Timesheet Status", "Count"]],
      body: timesheetBreakdown.map(t => [t.status, t.count]),
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 15 }, bodyStyles: { fontSize: 15 },
      columnStyles: { 1: { halign: "right" } }, margin: { left: pageW / 2 + 2, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
    if (leaveByStatus.length > 0) {
      if (y > 240) { doc.addPage(); y = 20; }
      autoTable(doc, {
        startY: y, head: [["Leave by Status", "Count"]],
        body: leaveByStatus.map(l => [l.status, l.count]),
        headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 15 }, bodyStyles: { fontSize: 15 },
        columnStyles: { 1: { halign: "right" } }, margin: { left: 14, right: pageW / 2 + 2 },
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
          const score = Math.round(Math.min(s.shifts * 8, 25) + Math.min(s.hoursLogged / 2, 25) + (approvalRate != null ? approvalRate * 35 : 17.5) + Math.max(0, 15 - s.leaveCount * 3));
          return [s.name, s.staff_type, s.shifts, s.hoursLogged.toFixed(1), s.tsApproved, s.tsPending, s.tsRejected, s.leaveCount, score];
        }),
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 14 }, bodyStyles: { fontSize: 14 },
        columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" }, 8: { halign: "right" } },
        margin: { left: 14, right: 14 },
      });
    }
    const safeName = (branchName || "branch").toLowerCase().replace(/\s+/g, "-");
    doc.save(`${safeName}-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
    logDownload("pdf");
  }

  return (
    <ManagerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {showHistory ? (
          /* ── History View ── */
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "22px" }}>
              <button onClick={() => setShowHistory(false)}
                style={{ width: "34px", height: "34px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", color: "#64748B", fontSize: "21px", lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
              <div>
                <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Report History</h2>
                <p style={{ fontSize: "20px", color: "#64748B", margin: "4px 0 0" }}>All reports you have exported</p>
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
                  <p style={{ fontSize: "21px", fontWeight: "600", color: "#94A3B8" }}>No exports yet</p>
                  <p style={{ fontSize: "20px", color: "#CBD5E1", marginTop: "4px" }}>Download a CSV or PDF from the Reports page to see history here.</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "20px", minWidth: "500px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                        {["Title", "Format", "Period", "Downloaded"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", textAlign: h === "Format" || h === "Downloaded" ? "center" : "left", fontSize: "18px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {historyRows.map(r => (
                        <tr key={r.report_id} style={{ borderBottom: "1px solid #F8FAFC" }}>
                          <td style={{ padding: "12px", fontWeight: "600", color: "#1E293B" }}>{r.title || "Report"}</td>
                          <td style={{ padding: "12px", textAlign: "center" }}>
                            <span style={{ fontSize: "18px", fontWeight: "700", padding: "2px 10px", borderRadius: "100px", background: r.format === "pdf" ? "#FEF2F2" : "#F0FDF4", color: r.format === "pdf" ? "#DC2626" : "#16A34A", textTransform: "uppercase" }}>{r.format}</span>
                          </td>
                          <td style={{ padding: "12px", color: "#64748B", fontSize: "19px" }}>{r.period_start} – {r.period_end}</td>
                          <td style={{ padding: "12px", textAlign: "center", color: "#94A3B8", fontSize: "19px" }}>{r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
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
                <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", margin: 0 }}>Reports</h2>
                <p style={{ fontSize: "20px", color: "#64748B", margin: "4px 0 0" }}>
                  {branchName ? `${branchName} — ` : ""}Branch performance overview
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "2px" }}>
                  {PERIODS.map((p, i) => (
                    <button key={p.label} onClick={() => setPeriod(i)} className="mgr-rpt-tab"
                      style={{ padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "20px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", background: period === i ? "#FFF" : "transparent", color: period === i ? "#0F172A" : "#64748B", boxShadow: period === i ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <button onClick={downloadCSV} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "20px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Download size={14} strokeWidth={2} /> CSV
                </button>
                <button onClick={downloadPDF} disabled={loading}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "none", background: "#0F172A", color: "#FFF", fontSize: "20px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
                  <Download size={14} strokeWidth={2} /> PDF
                </button>
                <button onClick={openHistory}
                  style={{ padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "20px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" }}>
                  History
                </button>
              </div>
            </div>

            {/* Stats Strip */}
            <StatStrip loading={loading} stats={[
              { label: "ACTIVE STAFF",      value: kpis.staff,            sub: `${kpis.regularStaff} regular · ${kpis.casualStaff} casual`, pct: null },
              { label: "SHIFTS",            value: kpis.shifts,           sub: `vs prev ${PERIODS[period].label}`, pct: pctDelta(kpis.shifts, kpis.shiftsPrev) },
              { label: "TS APPROVAL RATE",  value: `${kpis.tsApprovalRate ?? 0}%`, sub: "approved timesheets", pct: null },
              { label: "PENDING LEAVE",     value: kpis.pendingLeave,     sub: `vs prev ${PERIODS[period].label}`, pct: pctDelta(kpis.pendingLeave, kpis.pendingLeavePrev) },
            ]} />

            {/* Daily Activity Chart */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <h3 style={{ fontSize: "21px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Daily Activity</h3>
                  <p style={{ fontSize: "19px", color: "#94A3B8", margin: "3px 0 0" }}>Last {Math.min(days, 30)} days</p>
                </div>
                <div style={{ display: "flex", gap: "16px" }}>
                  {chartSeries.map(s => (
                    <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: "10px", height: "3px", borderRadius: "2px", background: s.color }} />
                      <span style={{ fontSize: "18px", fontWeight: "600", color: "#64748B" }}>{s.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              {loading
                ? <div style={{ height: "180px", background: "linear-gradient(90deg,#F8FAFC 25%,#F1F5F9 50%,#F8FAFC 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", borderRadius: "8px" }} />
                : <LineChart series={chartSeries} labels={chartLabels} height={180} />}
            </div>

            {/* Staff Performance Table */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Staff Performance</h3>
                <p style={{ fontSize: "19px", color: "#94A3B8", margin: "3px 0 0" }}>All staff · sorted by score · period: {PERIODS[period].label}</p>
              </div>
              {loading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="48px" />)}
                </div>
              ) : staffKpis.length === 0 ? (
                <p style={{ color: "#94A3B8", fontSize: "20px", textAlign: "center", padding: "32px 0" }}>No staff data available.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <StaffKpiTable rows={staffKpis} />
                  <p style={{ fontSize: "18px", color: "#CBD5E1", marginTop: "14px", textAlign: "right" }}>
                    Score = Shifts (25) + Hours (25) + Timesheets (35) + Leave (15) · max 100
                  </p>
                </div>
              )}
            </div>

            {/* Breakdowns — 3-col grid */}
            <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "20px" }}>
              <BarMeterSection title="Shifts by Status"     sub="All shifts (all time)"             rows={shiftsByStatus}     loading={loading} />
              <BarMeterSection title="Timesheet Status"     sub="Submissions for the period"        rows={timesheetBreakdown} loading={loading} />
              <BarMeterSection title="Leave Requests"       sub="By approval status (all time)"     rows={leaveByStatus}      loading={loading} />
            </div>

            {/* Round 3, Task 6 */}
            {branchId && <WorkingHoursReportPanel branchId={branchId} />}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

function StaffKpiTable({ rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "20px", minWidth: "720px" }}>
      <thead>
        <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
          {["Staff", "Type", "Shifts", "Hours", "Timesheets", "Leave", "Score"].map(h => (
            <th key={h} style={{ padding: "10px 12px", textAlign: h === "Staff" ? "left" : "center", fontSize: "18px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const tsTotal      = s.tsApproved + s.tsPending + s.tsRejected;
          const approvalRate = tsTotal > 0 ? Math.round((s.tsApproved / tsTotal) * 100) : null;
          const score        = Math.round(Math.min(s.shifts * 8, 25) + Math.min(s.hoursLogged / 2, 25) + (approvalRate != null ? (approvalRate / 100) * 35 : 17.5) + Math.max(0, 15 - s.leaveCount * 3));
          const scoreColor   = score >= 80 ? "#16A34A" : score >= 55 ? "#D97706" : "#DC2626";
          const scoreBg      = score >= 80 ? "#F0FDF4" : score >= 55 ? "#FFFBEB" : "#FEF2F2";
          return (
            <tr key={s.staff_id} className="mgr-rpt-row" style={{ borderBottom: "1px solid #F8FAFC", animation: `fadeUp 0.3s ease ${Math.min(i,8) * 0.05}s both` }}>
              <td style={{ padding: "13px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <UserAvatar name={s.name} avatar_url={s.avatar_url} size={32} />
                  <div>
                    <p style={{ fontWeight: "600", color: "#0F172A", margin: 0, whiteSpace: "nowrap" }}>{s.name}</p>
                    {!s.is_active && <p style={{ fontSize: "17px", color: "#DC2626", fontWeight: "600", margin: 0 }}>Inactive</p>}
                  </div>
                </div>
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                <span style={{ fontSize: "18px", fontWeight: "600", padding: "3px 9px", borderRadius: "100px", background: s.staff_type === "regular" ? "#EFF6FF" : "#F5F3FF", color: s.staff_type === "regular" ? "#2563EB" : "#7C3AED", textTransform: "capitalize" }}>{s.staff_type}</span>
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.shifts > 0 ? "#0F172A" : "#CBD5E1" }}>{s.shifts}</td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.hoursLogged > 0 ? "#0F172A" : "#CBD5E1" }}>
                {s.hoursLogged > 0 ? `${s.hoursLogged.toFixed(1)}h` : "—"}
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                {tsTotal === 0
                  ? <span style={{ color: "#CBD5E1", fontSize: "19px" }}>—</span>
                  : <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                      {s.tsApproved > 0 && <span style={{ fontSize: "18px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#F0FDF4", color: "#16A34A" }}>✓ {s.tsApproved}</span>}
                      {s.tsPending  > 0 && <span style={{ fontSize: "18px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706" }}>⏳ {s.tsPending}</span>}
                      {s.tsRejected > 0 && <span style={{ fontSize: "18px", fontWeight: "600", padding: "2px 7px", borderRadius: "100px", background: "#FEF2F2", color: "#DC2626" }}>✗ {s.tsRejected}</span>}
                    </div>
                }
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center", fontWeight: "700", color: s.leaveCount > 2 ? "#DC2626" : s.leaveCount > 0 ? "#D97706" : "#CBD5E1" }}>
                {s.leaveCount > 0 ? s.leaveCount : "—"}
              </td>
              <td style={{ padding: "13px 12px", textAlign: "center" }}>
                <span style={{ display: "inline-block", fontWeight: "800", fontSize: "20px", padding: "4px 12px", borderRadius: "8px", background: scoreBg, color: scoreColor, minWidth: "44px" }}>{score}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// Round 3, Task 6 — "the report is where the manager sees the picture and rebalances future
// rosters. It replaces enforcement." Generated on demand for a date range (not auto-loaded with
// the rest of the page, since it's a heavier query); sortable by any column client-side.
const WH_COLUMNS = [
  { key: "full_name",              label: "Staff" },
  { key: "staff_type",             label: "Type" },
  { key: "rostered_hours",         label: "Rostered" },
  { key: "span_hours",             label: "Span" },
  { key: "worked_hours",           label: "Worked" },
  { key: "break_hours",            label: "Break" },
  { key: "additional_hours",       label: "Additional" },
  { key: "overtime_hours",         label: "Overtime" },
  { key: "days_worked",            label: "Days" },
  { key: "longest_consecutive_run",label: "Longest run" },
  { key: "pending_submissions",    label: "Pending" },
];

function WorkingHoursReportPanel({ branchId }) {
  const today = new Date();
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const [startDate, setStartDate] = useState(weekAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate]     = useState(today.toISOString().slice(0, 10));
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [report, setReport]       = useState(null);
  const [sortKey, setSortKey]     = useState("worked_hours");
  const [sortDir, setSortDir]     = useState("desc");

  async function generate() {
    setLoading(true); setError("");
    try {
      const r = await api.get(`/api/reports/working-hours?branch_id=${branchId}&start_date=${startDate}&end_date=${endDate}`);
      setReport(r);
    } catch (err) { setError(err.message || "Failed to generate report."); }
    finally { setLoading(false); }
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedRows = report ? [...report.rows].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const cmp = typeof av === "string" ? (av || "").localeCompare(bv || "") : (av ?? 0) - (bv ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  }) : [];

  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginTop: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#0F172A", margin: 0 }}>Working Hours Report</h3>
        <p style={{ fontSize: "19px", color: "#94A3B8", margin: "3px 0 0" }}>Rostered vs. actual hours, additional time, and overtime — approved submissions only</p>
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap", marginBottom: "16px" }}>
        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "18px" }} />
        <span style={{ color: "#94A3B8" }}>to</span>
        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={{ padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "18px" }} />
        <button onClick={generate} disabled={loading}
          style={{ background: "#1E293B", color: "#fff", border: "none", borderRadius: "8px", padding: "8px 16px", fontSize: "18px", fontWeight: "700", cursor: "pointer" }}>
          {loading ? "Generating…" : "Generate"}
        </button>
      </div>

      {error && <p style={{ color: "#DC2626", fontSize: "19px", marginBottom: "12px" }}>{error}</p>}

      {report && (
        report.rows.length === 0 ? (
          <p style={{ color: "#94A3B8", fontSize: "20px", textAlign: "center", padding: "24px 0" }}>No rostered staff in this period.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "19px", minWidth: "760px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
                  {WH_COLUMNS.map(c => (
                    <th key={c.key} onClick={() => toggleSort(c.key)}
                      style={{ padding: "10px 12px", textAlign: c.key === "full_name" ? "left" : "center", fontSize: "17px", fontWeight: "700", color: sortKey === c.key ? "#1E293B" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" }}>
                      {c.label}{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(r => (
                  <tr key={r.staff_id} style={{ borderBottom: "1px solid #F8FAFC", background: r.breaches_limit ? "#FFFBEB" : "transparent" }}>
                    <td style={{ padding: "12px" }}>
                      <p style={{ fontWeight: "600", color: "#0F172A", margin: 0 }}>{r.full_name || "—"}</p>
                      {r.warnings.map((w, i) => (
                        <p key={i} style={{ fontSize: "16px", color: "#D97706", fontWeight: "600", margin: "2px 0 0" }}>⚠ {w}</p>
                      ))}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>
                      <span style={{ fontSize: "17px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: r.staff_type === "regular" ? "#EFF6FF" : "#F5F3FF", color: r.staff_type === "regular" ? "#2563EB" : "#7C3AED", textTransform: "capitalize" }}>{r.staff_type}</span>
                    </td>
                    <td style={{ padding: "12px", textAlign: "center" }}>{r.rostered_hours.toFixed(1)}h</td>
                    <td style={{ padding: "12px", textAlign: "center", color: "#64748B" }}>{r.span_hours.toFixed(1)}h</td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: "700" }}>
                      {r.worked_hours.toFixed(1)}h{r.hours_partially_unknown && <span title="Some submissions have no exact start/end time — figure may be incomplete" style={{ color: "#94A3B8" }}> *</span>}
                    </td>
                    <td style={{ padding: "12px", textAlign: "center", color: "#64748B" }}>{r.break_hours > 0 ? `${r.break_hours.toFixed(1)}h` : "—"}</td>
                    <td style={{ padding: "12px", textAlign: "center", color: r.additional_hours > 0 ? "#2563EB" : "#CBD5E1", fontWeight: r.additional_hours > 0 ? "700" : "400" }}>{r.additional_hours.toFixed(1)}h</td>
                    <td style={{ padding: "12px", textAlign: "center", color: r.overtime_hours > 0 ? "#DC2626" : "#CBD5E1", fontWeight: r.overtime_hours > 0 ? "700" : "400" }}>{r.overtime_hours.toFixed(1)}h</td>
                    <td style={{ padding: "12px", textAlign: "center" }}>{r.days_worked}</td>
                    <td style={{ padding: "12px", textAlign: "center", fontWeight: r.breaches_limit ? "700" : "400", color: r.breaches_limit ? "#D97706" : "#1E293B" }}>{r.longest_consecutive_run}</td>
                    <td style={{ padding: "12px", textAlign: "center", color: r.pending_submissions > 0 ? "#D97706" : "#CBD5E1" }}>{r.pending_submissions || "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #F1F5F9", fontWeight: "700" }}>
                  <td style={{ padding: "12px" }} colSpan={2}>Branch total</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.rostered_hours.toFixed(1)}h</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.span_hours.toFixed(1)}h</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.worked_hours.toFixed(1)}h</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.break_hours.toFixed(1)}h</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.additional_hours.toFixed(1)}h</td>
                  <td style={{ padding: "12px", textAlign: "center" }}>{report.totals.overtime_hours.toFixed(1)}h</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )
      )}
    </div>
  );
}
