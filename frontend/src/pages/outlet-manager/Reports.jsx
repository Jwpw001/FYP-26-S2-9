import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-reports-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-reports-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes barGrow {
      from { width: 0; }
      to   { width: 100%; }
    }
  `;
  document.head.appendChild(style);
}

const PALETTE = ["#2563EB", "#059669", "#DB2777", "#D97706", "#7C3AED", "#0891B2", "#DC2626", "#65A30D"];

function Shimmer({ w = "100%", h = "16px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

/* ── Donut chart: stacked stroke-dasharray arcs, count in the center ── */
function DonutChart({ data, size = 116, thickness = 16 }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
        ) : data.filter(d => d.value > 0).map(d => {
          const frac = d.value / total;
          const dash = Math.max(frac * c - (data.length > 1 ? 1.5 : 0), 0);
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
              strokeWidth={thickness} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
              strokeLinecap="round" />
          );
          offset += frac * c;
          return el;
        })}
      </g>
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.22} fontWeight="800" fill="#0F172A">{total}</text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.095} fontWeight="600" fill="#94A3B8" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>total</text>
    </svg>
  );
}

/* ── Horizontal bar chart: one labeled bar per row, scaled to the max value ── */
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {data.map((d, i) => (
        <div key={d.label} style={{ animation: `barGrow 0.6s ease ${i * 0.04}s both`, transformOrigin: "left" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
            <span style={{ fontSize: "12.5px", fontWeight: "600", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
            <span style={{ fontSize: "12.5px", fontWeight: "700", color: d.color }}>{d.value}</span>
          </div>
          <div style={{ height: "8px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
            <div style={{ width: `${(d.value / max) * 100}%`, height: "100%", background: d.color, borderRadius: "100px", transition: "width 0.6s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]       = useState(null);
  const [reportType, setReportType]   = useState("attendance");
  const [loading, setLoading]         = useState(false);
  const [reportData, setReportData]   = useState(null);
  const [dateFrom, setDateFrom]       = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: myStaff } = await supabase
        .from("staff").select("outlet_id")
        .eq("user_id", userId).eq("is_active", true).limit(1);
      if (!cancelled) setOutletId(myStaff?.[0]?.outlet_id || null);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function generateReport() {
    if (!outletId) return;
    setLoading(true);
    setReportData(null);

    try {
      if (reportType === "attendance") {
        const { data: shifts } = await supabase
          .from("shifts")
          .select(`
            shift_id, title, shift_date, start_time, end_time,
            shift_assignments (
              assignment_id, staff_id,
              staff:staff_id ( users:user_id ( full_name ) ),
              attendance ( status )
            )
          `)
          .eq("outlet_id", outletId)
          .gte("shift_date", dateFrom)
          .lte("shift_date", dateTo)
          .order("shift_date");

        const summary = (shifts || []).map(s => {
          const assignments = s.shift_assignments || [];
          const present = assignments.filter(a => a.attendance?.[0]?.status === "present").length;
          const absent  = assignments.filter(a => a.attendance?.[0]?.status === "absent").length;
          const late    = assignments.filter(a => a.attendance?.[0]?.status === "late").length;
          const pending = assignments.filter(a => !a.attendance?.[0]).length;
          return { date: s.shift_date, title: s.title || "Shift", time: `${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}`, total: assignments.length, present, absent, late, pending };
        });
        setReportData({ type: "attendance", rows: summary });

      } else if (reportType === "workload") {
        const { data: assignments } = await supabase
          .from("shift_assignments")
          .select(`staff_id, staff:staff_id ( users:user_id ( full_name ) ), shifts!inner ( shift_date, outlet_id )`)
          .eq("shifts.outlet_id", outletId)
          .gte("shifts.shift_date", dateFrom)
          .lte("shifts.shift_date", dateTo);

        const countMap = {};
        (assignments || []).forEach(a => {
          const key = a.staff_id;
          const name = a.staff?.users?.full_name || `Staff #${a.staff_id}`;
          if (!countMap[key]) countMap[key] = { name, count: 0 };
          countMap[key].count++;
        });
        const rows = Object.values(countMap).sort((a, b) => b.count - a.count);
        setReportData({ type: "workload", rows });

      } else if (reportType === "understaffed") {
        const { data: shifts } = await supabase
          .from("shifts")
          .select(`
            shift_id, title, shift_date, start_time, end_time,
            shift_roles ( role_id, headcount, shift_assignments ( assignment_id ) )
          `)
          .eq("outlet_id", outletId)
          .gte("shift_date", dateFrom)
          .lte("shift_date", dateTo)
          .order("shift_date");

        const understaffed = (shifts || []).filter(s =>
          (s.shift_roles || []).some(r => (r.shift_assignments?.length || 0) < (r.headcount || 1))
        ).map(s => {
          const roles = s.shift_roles || [];
          const needed = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
          const filled = roles.reduce((sum, r) => sum + (r.shift_assignments?.length || 0), 0);
          return { date: s.shift_date, title: s.title || "Shift", time: `${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}`, filled, needed, gap: needed - filled };
        });
        setReportData({ type: "understaffed", rows: understaffed });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    if (!reportData) return;
    let csv = "";
    if (reportData.type === "attendance") {
      csv = "Date,Title,Time,Total,Present,Absent,Late,Pending\n";
      reportData.rows.forEach(r => { csv += `${r.date},${r.title},${r.time},${r.total},${r.present},${r.absent},${r.late},${r.pending}\n`; });
    } else if (reportData.type === "workload") {
      csv = "Staff,Shifts Worked\n";
      reportData.rows.forEach(r => { csv += `${r.name},${r.count}\n`; });
    } else if (reportData.type === "understaffed") {
      csv = "Date,Title,Time,Filled,Needed,Gap\n";
      reportData.rows.forEach(r => { csv += `${r.date},${r.title},${r.time},${r.filled},${r.needed},${r.gap}\n`; });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `krewby-${reportData.type}-report.csv`; a.click();
  }

  const REPORT_TYPES = [
    { value: "attendance",   label: "Attendance Report",   desc: "Present / absent / late per shift" },
    { value: "workload",     label: "Workload Report",     desc: "Shifts worked per staff member" },
    { value: "understaffed", label: "Understaffed Shifts", desc: "Shifts below required headcount" },
  ];

  // Summary stats from reportData
  function getSummaryStats() {
    if (!reportData) return null;
    if (reportData.type === "attendance") {
      const totalShifts = reportData.rows.length;
      const totalPresent = reportData.rows.reduce((s, r) => s + r.present, 0);
      const totalAbsent  = reportData.rows.reduce((s, r) => s + r.absent, 0);
      const totalLate    = reportData.rows.reduce((s, r) => s + r.late, 0);
      return [
        { label: "Shifts", value: totalShifts, color: "#2563EB", bg: "#EFF6FF" },
        { label: "Present", value: totalPresent, color: "#166534", bg: "#DCFCE7" },
        { label: "Absent",  value: totalAbsent,  color: "#991B1B", bg: "#FEE2E2" },
        { label: "Late",    value: totalLate,    color: "#D97706", bg: "#FFFBEB" },
      ];
    }
    if (reportData.type === "workload") {
      const total = reportData.rows.reduce((s, r) => s + r.count, 0);
      const max   = reportData.rows[0]?.count || 0;
      return [
        { label: "Staff Members", value: reportData.rows.length, color: "#2563EB", bg: "#EFF6FF" },
        { label: "Total Shifts",  value: total, color: "#059669", bg: "#ECFDF5" },
        { label: "Most Shifts",   value: max,   color: "#7C3AED", bg: "#F5F3FF" },
      ];
    }
    if (reportData.type === "understaffed") {
      const totalGap = reportData.rows.reduce((s, r) => s + r.gap, 0);
      return [
        { label: "Understaffed",  value: reportData.rows.length, color: "#991B1B", bg: "#FEE2E2" },
        { label: "Total Gap",     value: totalGap,               color: "#D97706", bg: "#FFFBEB" },
      ];
    }
    return null;
  }

  const summaryStats = getSummaryStats();
  const maxWorkload  = reportData?.type === "workload" ? (reportData.rows[0]?.count || 1) : 1;

  // Diagram data derived from the current report
  const attendanceDonut = reportData?.type === "attendance" ? [
    { label: "Present", value: reportData.rows.reduce((s, r) => s + r.present, 0), color: "#16A34A" },
    { label: "Absent",  value: reportData.rows.reduce((s, r) => s + r.absent, 0),  color: "#DC2626" },
    { label: "Late",    value: reportData.rows.reduce((s, r) => s + r.late, 0),    color: "#D97706" },
    { label: "Pending", value: reportData.rows.reduce((s, r) => s + r.pending, 0), color: "#94A3B8" },
  ] : [];
  const workloadBars = reportData?.type === "workload"
    ? reportData.rows.slice(0, 8).map((r, i) => ({ label: r.name, value: r.count, color: PALETTE[i % PALETTE.length] }))
    : [];
  const understaffedDonut = reportData?.type === "understaffed" ? [
    { label: "Filled", value: reportData.rows.reduce((s, r) => s + r.filled, 0), color: "#16A34A" },
    { label: "Gap",    value: reportData.rows.reduce((s, r) => s + r.gap, 0),    color: "#DC2626" },
  ] : [];

  return (
    <ManagerLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Reports</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Generate and export operational reports</p>
          </div>
        </div>

        {/* Report type cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "12px", marginBottom: "20px" }}>
          {REPORT_TYPES.map(rt => (
            <ReportTypeCard
              key={rt.value}
              label={rt.label}
              desc={rt.desc}
              active={reportType === rt.value}
              onClick={() => { setReportType(rt.value); setReportData(null); }}
            />
          ))}
        </div>

        {/* Config card */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", marginBottom: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Date Range</h3>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" }}>From</label>
              <input
                style={{ display: "block", width: "100%", padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", boxSizing: "border-box", outline: "none" }}
                type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: "160px" }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" }}>To</label>
              <input
                style={{ display: "block", width: "100%", padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", boxSizing: "border-box", outline: "none" }}
                type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <GenerateBtn loading={loading} onClick={generateReport} />
          </div>
        </div>

        {/* Loading shimmer for results */}
        {loading && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            <div style={{ display: "flex", gap: "14px", marginBottom: "22px" }}>
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ flex: 1, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "16px" }}>
                  <Shimmer w="50%" h="26px" r="6px" style={{ marginBottom: "8px" }} />
                  <Shimmer w="70%" h="13px" r="6px" />
                </div>
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr", gap: "12px", padding: "12px 0", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                {Array.from({ length: 7 }).map((__, j) => <Shimmer key={j} h="14px" r="6px" />)}
              </div>
            ))}
          </div>
        )}

        {/* Results */}
        {reportData && !loading && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", animation: "fadeSlideUp 0.35s ease both" }}>
            {/* Result header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B" }}>
                  {reportData.type === "attendance" && "Attendance Report"}
                  {reportData.type === "workload"   && "Workload Report"}
                  {reportData.type === "understaffed" && "Understaffed Shifts"}
                </h3>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                  {fmtDate(dateFrom)} – {fmtDate(dateTo)}
                </p>
              </div>
              <ExportBtn onClick={exportCSV} />
            </div>

            {/* Summary stat cards */}
            {summaryStats && (
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "22px" }}>
                {summaryStats.map(stat => (
                  <div key={stat.label} style={{ flex: 1, minWidth: "100px", background: stat.bg, border: `1px solid ${stat.color}22`, borderRadius: "10px", padding: "14px 16px" }}>
                    <p style={{ fontSize: "22px", fontWeight: "800", color: stat.color, lineHeight: 1 }}>{stat.value}</p>
                    <p style={{ fontSize: "12px", color: stat.color, fontWeight: "600", marginTop: "4px", opacity: 0.8 }}>{stat.label}</p>
                  </div>
                ))}
              </div>
            )}

            {reportData.rows.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748B", fontSize: "14px" }}>
                No data for this period.
              </div>
            ) : reportData.type === "attendance" ? (
              <>
                <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", padding: "4px 4px 24px" }}>
                  <DonutChart data={attendanceDonut} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px", flex: 1, minWidth: "200px" }}>
                    {attendanceDonut.map(d => {
                      const total = attendanceDonut.reduce((s, x) => s + x.value, 0);
                      return (
                        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" }}>
                          <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: d.color, flexShrink: 0 }} />
                          <span style={{ flex: 1, color: "#374151", fontWeight: "600" }}>{d.label}</span>
                          <span style={{ fontWeight: "700", color: "#0F172A" }}>{d.value}</span>
                          <span style={{ color: "#94A3B8", fontSize: "11px", width: "34px", textAlign: "right" }}>{total ? Math.round((d.value / total) * 100) : 0}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <AttendanceTable rows={reportData.rows} />
              </>
            ) : reportData.type === "workload" ? (
              <>
                <div style={{ padding: "4px 4px 24px" }}>
                  <BarChart data={workloadBars} />
                </div>
                <WorkloadTable rows={reportData.rows} max={maxWorkload} />
              </>
            ) : (
              <>
                <div style={{ display: "flex", gap: "24px", alignItems: "center", flexWrap: "wrap", padding: "4px 4px 24px" }}>
                  <DonutChart data={understaffedDonut} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px", flex: 1, minWidth: "200px" }}>
                    <p style={{ fontSize: "12.5px", color: "#64748B" }}>
                      Across {reportData.rows.length} understaffed shift{reportData.rows.length !== 1 ? "s" : ""}, roles are{" "}
                      <strong style={{ color: "#16A34A" }}>{understaffedDonut[0]?.value ?? 0} filled</strong> vs a{" "}
                      <strong style={{ color: "#DC2626" }}>{understaffedDonut[1]?.value ?? 0} headcount gap</strong>.
                    </p>
                  </div>
                </div>
                <UnderstaffedTable rows={reportData.rows} />
              </>
            )}
          </div>
        )}

      </div>
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ReportTypeCard({ label, desc, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: active ? "#EFF6FF" : "#FFFFFF",
        border: active ? "1.5px solid #2563EB" : (hovered ? "1.5px solid #BFDBFE" : "1px solid #E2E8F0"),
        borderRadius: "12px", padding: "16px", cursor: "pointer",
        transition: "all 0.15s",
      }}>
      <p style={{ fontSize: "14px", fontWeight: "700", color: active ? "#2563EB" : "#1E293B", marginBottom: "4px" }}>{label}</p>
      <p style={{ fontSize: "12px", color: active ? "#3B82F6" : "#64748B" }}>{desc}</p>
    </div>
  );
}

function GenerateBtn({ loading, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && !loading ? "#1D4ED8" : "#2563EB",
        color: "#FFFFFF", border: "none", borderRadius: "10px",
        padding: "10px 22px", fontSize: "14px", fontWeight: "700",
        cursor: loading ? "not-allowed" : "pointer",
        flexShrink: 0, alignSelf: "flex-end",
        opacity: loading ? 0.7 : 1, transition: "background 0.15s",
      }}>
      {loading ? "Generating…" : "Generate"}
    </button>
  );
}

function ExportBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#F1F5F9" : "#F8FAFC",
        border: "1px solid #E2E8F0", borderRadius: "9px",
        padding: "8px 16px", fontSize: "13px", fontWeight: "600",
        color: "#1E293B", cursor: "pointer",
        display: "flex", alignItems: "center", gap: "6px",
        transition: "background 0.15s",
      }}>
      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export CSV
    </button>
  );
}

function TableHead({ cols }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: cols, padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "10px", marginBottom: "4px" }}>
      {/* rendered by children */}
    </div>
  );
}

function AttendanceTable({ rows }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr", padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "10px", marginBottom: "4px" }}>
        <span>Date</span><span>Shift</span><span>Time</span>
        <span>Total</span><span>Present</span><span>Absent</span><span>Late</span>
      </div>
      {rows.map((r, i) => (
        <AttendanceTableRow key={i} row={r} />
      ))}
    </div>
  );
}

function AttendanceTableRow({ row: r }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr", padding: "11px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B", gap: "10px", alignItems: "center", background: hovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
      <span style={{ fontWeight: "600" }}>{fmtDateShort(r.date)}</span>
      <span>{r.title}</span>
      <span style={{ color: "#64748B" }}>{r.time}</span>
      <span>{r.total}</span>
      <span style={{ color: "#166534", fontWeight: "700" }}>{r.present}</span>
      <span style={{ color: "#991B1B", fontWeight: "700" }}>{r.absent}</span>
      <span style={{ color: "#D97706", fontWeight: "700" }}>{r.late}</span>
    </div>
  );
}

function WorkloadTable({ rows, max }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 60px", padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "10px", marginBottom: "4px" }}>
        <span>Staff Member</span><span>Shifts</span><span>Count</span>
      </div>
      {rows.map((r, i) => (
        <WorkloadRow key={i} row={r} max={max} />
      ))}
    </div>
  );
}

function WorkloadRow({ row: r, max }) {
  const [hovered, setHovered] = useState(false);
  const pct = Math.round((r.count / max) * 100);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "2fr 3fr 60px", padding: "11px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B", gap: "10px", alignItems: "center", background: hovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
      <span style={{ fontWeight: "600" }}>{r.name}</span>
      <div style={{ background: "#F1F5F9", borderRadius: "100px", height: "8px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#3B82F6,#2563EB)", borderRadius: "100px", transition: "width 0.6s ease" }} />
      </div>
      <span style={{ fontWeight: "700", color: "#2563EB", textAlign: "right" }}>{r.count}</span>
    </div>
  );
}

function UnderstaffedTable({ rows }) {
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 0.6fr 0.6fr 0.6fr", padding: "9px 14px", background: "#F8FAFC", borderRadius: "8px", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "10px", marginBottom: "4px" }}>
        <span>Date</span><span>Shift</span><span>Time</span>
        <span>Filled</span><span>Needed</span><span>Gap</span>
      </div>
      {rows.map((r, i) => (
        <UnderstaffedRow key={i} row={r} />
      ))}
    </div>
  );
}

function UnderstaffedRow({ row: r }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1fr 0.6fr 0.6fr 0.6fr", padding: "11px 14px", borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B", gap: "10px", alignItems: "center", background: hovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
      <span style={{ fontWeight: "600" }}>{fmtDateShort(r.date)}</span>
      <span>{r.title}</span>
      <span style={{ color: "#64748B" }}>{r.time}</span>
      <span style={{ color: "#166534", fontWeight: "600" }}>{r.filled}</span>
      <span>{r.needed}</span>
      <span style={{ color: "#991B1B", fontWeight: "700" }}>-{r.gap}</span>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}
