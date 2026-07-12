import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { Users, CalendarDays, ClipboardCheck, CalendarClock, Download, TrendingUp, TrendingDown } from "lucide-react";
import ManagerLayout from "../../components/layout/ManagerLayout";

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

  const [period,     setPeriod]     = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [outletId,   setOutletId]   = useState(null);
  const [outletName, setOutletName] = useState("");

  const [kpis, setKpis] = useState({
    staff: 0, regularStaff: 0, casualStaff: 0,
    shifts: 0, shiftsPrev: 0,
    attendanceRate: 0, attendanceRatePrev: 0,
    pendingLeave: 0, pendingLeavePrev: 0,
  });
  const [chartLabels,        setChartLabels]        = useState([]);
  const [chartSeries,        setChartSeries]        = useState([]);
  const [workload,           setWorkload]           = useState([]);
  const [shiftsByStatus,     setShiftsByStatus]     = useState([]);
  const [timesheetBreakdown, setTimesheetBreakdown] = useState([]);
  const [leaveByStatus,      setLeaveByStatus]      = useState([]);

  const days = PERIODS[period].days;

  // Resolve outlet once
  useEffect(() => {
    if (!userId) return;
    supabase.from("staff").select("outlet_id, outlets(name)")
      .eq("user_id", userId).eq("is_active", true).limit(1)
      .then(({ data }) => {
        if (data?.[0]) {
          setOutletId(data[0].outlet_id);
          setOutletName(data[0].outlets?.name || "");
        }
      });
  }, [userId]);

  const load = useCallback(async () => {
    if (!outletId) return;
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
          .select("staff_id, staff_type, is_active")
          .eq("outlet_id", outletId),
        supabase.from("shifts")
          .select("shift_id, status, shift_date")
          .eq("outlet_id", outletId)
          .order("shift_date"),
        supabase.from("shift_assignments")
          .select("assignment_id, staff_id, staff:staff_id(users:user_id(full_name)), attendance(status), shifts!inner(shift_date, outlet_id)")
          .eq("shifts.outlet_id", outletId)
          .gte("shifts.shift_date", periodStartStr)
          .lte("shifts.shift_date", todayStr),
        supabase.from("shift_assignments")
          .select("assignment_id, attendance(status), shifts!inner(shift_date, outlet_id)")
          .eq("shifts.outlet_id", outletId)
          .gte("shifts.shift_date", prevStartStr)
          .lt("shifts.shift_date", periodStartStr),
      ]);

      const staff   = staffData  || [];
      const shifts  = shiftsAll  || [];
      const currA   = assignCurr || [];
      const prevA   = assignPrev || [];

      // Leave requests (needs staff IDs)
      const staffIds = staff.map(s => s.staff_id);
      const { data: leaveAll } = staffIds.length > 0
        ? await supabase.from("availability").select("request_id, status, start_date").in("staff_id", staffIds)
        : { data: [] };
      const leave = leaveAll || [];

      // ── KPIs ───────────────────────────────────────────────────────────────
      const activeStaff  = staff.filter(s => s.is_active);
      const periodShifts = shifts.filter(s => s.shift_date >= periodStartStr && s.shift_date <= todayStr);
      const prevShifts   = shifts.filter(s => s.shift_date >= prevStartStr   && s.shift_date <  periodStartStr);
      const periodLeave  = leave.filter(l => l.start_date >= periodStartStr  && l.start_date <= todayStr);
      const prevLeave    = leave.filter(l => l.start_date >= prevStartStr    && l.start_date <  periodStartStr);

      function attendanceRate(assigns) {
        const marked   = assigns.filter(a => a.attendance?.[0]);
        const present  = marked.filter(a => a.attendance[0].status === "present").length;
        return marked.length ? Math.round((present / marked.length) * 100) : 0;
      }

      setKpis({
        staff:               activeStaff.length,
        regularStaff:        activeStaff.filter(s => s.staff_type === "regular").length,
        casualStaff:         activeStaff.filter(s => s.staff_type === "casual").length,
        shifts:              periodShifts.length,
        shiftsPrev:          prevShifts.length,
        attendanceRate:      attendanceRate(currA),
        attendanceRatePrev:  attendanceRate(prevA),
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
      const tmap = { present: 0, absent: 0, late: 0, pending: 0 };
      currA.forEach(a => {
        const st = a.attendance?.[0]?.status;
        if (st) tmap[st] = (tmap[st] || 0) + 1;
        else tmap.pending++;
      });
      setTimesheetBreakdown(Object.entries(tmap).filter(([, c]) => c > 0).map(([s, c]) => ({ status: s, count: c })));

      // ── Leave by status (all time) ──────────────────────────────────────────
      const lmap = {};
      leave.forEach(l => { lmap[l.status] = (lmap[l.status] || 0) + 1; });
      setLeaveByStatus(Object.entries(lmap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [outletId, days]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];
    lines.push(`${outletName || "Outlet"} — Manager Report (${PERIODS[period].label})`);
    lines.push(`Generated,${today}`);
    lines.push(""); lines.push("KPI SUMMARY"); lines.push("Metric,Value");
    lines.push(`Active Staff,${kpis.staff}`);
    lines.push(`Regular Staff,${kpis.regularStaff}`);
    lines.push(`Casual Staff,${kpis.casualStaff}`);
    lines.push(`Shifts (period),${kpis.shifts}`);
    lines.push(`Attendance Rate,${kpis.attendanceRate}%`);
    lines.push(`Pending Leave (period),${kpis.pendingLeave}`);
    lines.push(""); lines.push("STAFF WORKLOAD"); lines.push("Staff,Shifts");
    workload.forEach(w => lines.push(`"${w.name}",${w.count}`));
    lines.push(""); lines.push("SHIFTS BY STATUS"); lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push(""); lines.push("TIMESHEET BREAKDOWN"); lines.push("Status,Count");
    timesheetBreakdown.forEach(a => lines.push(`${a.status},${a.count}`));
    lines.push(""); lines.push("LEAVE BY STATUS"); lines.push("Status,Count");
    leaveByStatus.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push(""); lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(",")));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `outlet-report-${PERIODS[period].label}-${today}.csv`; a.click();
    URL.revokeObjectURL(url);
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
              {outletName ? `${outletName} — ` : ""}Outlet performance overview
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
              <Download size={14} strokeWidth={2} /> Export CSV
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
            label="Attendance Rate" value={`${kpis.attendanceRate}%`} pct={kpis.attendanceRatePrev > 0 ? pctDelta(kpis.attendanceRate, kpis.attendanceRatePrev) : null}
            sub="of marked assignments" />
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
            <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Attendance breakdown for the period</p>
            <StatusTable rows={timesheetBreakdown} loading={loading} />
          </div>
        </div>

        {/* ── Shifts by Status + Leave by Status ────────────────────────────── */}
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
    </ManagerLayout>
  );
}
