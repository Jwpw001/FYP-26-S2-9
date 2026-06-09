import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function Reports() {
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]   = useState(null);
  const [reportType, setReportType] = useState("attendance");
  const [loading, setLoading]     = useState(false);
  const [reportData, setReportData] = useState(null);
  const [dateFrom, setDateFrom]   = useState(() => {
    const d = new Date();
    d.setDate(1);
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
              users:staff_id ( full_name ),
              attendance ( status )
            )
          `)
          .eq("outlet_id", outletId)
          .gte("shift_date", dateFrom)
          .lte("shift_date", dateTo)
          .order("shift_date");

        // Summarise
        const summary = (shifts || []).map(s => {
          const assignments = s.shift_assignments || [];
          const present = assignments.filter(a => a.attendance?.[0]?.status === "present").length;
          const absent  = assignments.filter(a => a.attendance?.[0]?.status === "absent").length;
          const late    = assignments.filter(a => a.attendance?.[0]?.status === "late").length;
          const pending = assignments.filter(a => !a.attendance?.[0]).length;
          return { date: s.shift_date, title: s.title || "Shift",
            time: `${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}`,
            total: assignments.length, present, absent, late, pending };
        });
        setReportData({ type: "attendance", rows: summary });

      } else if (reportType === "workload") {
        const { data: assignments } = await supabase
          .from("shift_assignments")
          .select(`
            staff_id,
            users:staff_id ( full_name ),
            shifts!inner ( shift_date, outlet_id )
          `)
          .eq("shifts.outlet_id", outletId)
          .gte("shifts.shift_date", dateFrom)
          .lte("shifts.shift_date", dateTo);

        // Count shifts per staff
        const countMap = {};
        (assignments || []).forEach(a => {
          const key = a.staff_id;
          if (!countMap[key]) countMap[key] = { name: a.users?.full_name, count: 0 };
          countMap[key].count++;
        });
        const rows = Object.values(countMap).sort((a, b) => b.count - a.count);
        setReportData({ type: "workload", rows });

      } else if (reportType === "understaffed") {
        const { data: shifts } = await supabase
          .from("shifts")
          .select(`
            shift_id, title, shift_date, start_time, end_time,
            shift_roles ( role_id, headcount,
              shift_assignments ( assignment_id )
            )
          `)
          .eq("outlet_id", outletId)
          .gte("shift_date", dateFrom)
          .lte("shift_date", dateTo)
          .order("shift_date");

        const understaffed = (shifts || []).filter(s => {
          return (s.shift_roles || []).some(r =>
            (r.shift_assignments?.length || 0) < (r.headcount || 1)
          );
        }).map(s => {
          const roles = s.shift_roles || [];
          const needed = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
          const filled = roles.reduce((sum, r) => sum + (r.shift_assignments?.length || 0), 0);
          return { date: s.shift_date, title: s.title || "Shift",
            time: `${s.start_time?.slice(0,5)} – ${s.end_time?.slice(0,5)}`,
            filled, needed, gap: needed - filled };
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
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.title},${r.time},${r.total},${r.present},${r.absent},${r.late},${r.pending}\n`;
      });
    } else if (reportData.type === "workload") {
      csv = "Staff,Shifts Worked\n";
      reportData.rows.forEach(r => { csv += `${r.name},${r.count}\n`; });
    } else if (reportData.type === "understaffed") {
      csv = "Date,Title,Time,Filled,Needed,Gap\n";
      reportData.rows.forEach(r => {
        csv += `${r.date},${r.title},${r.time},${r.filled},${r.needed},${r.gap}\n`;
      });
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krewby-${reportData.type}-report.csv`;
    a.click();
  }

  return (
    <ManagerLayout title="Reports">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Reports</h2>
          <p style={s.sub}>Generate and export operational reports</p>
        </div>
      </div>

      {/* Report config */}
      <div style={s.configCard}>
        <div style={s.configRow}>
          <div style={s.field}>
            <label style={s.label}>Report Type</label>
            <select style={s.input} value={reportType}
              onChange={e => { setReportType(e.target.value); setReportData(null); }}>
              <option value="attendance">Attendance Report</option>
              <option value="workload">Workload Report</option>
              <option value="understaffed">Understaffed Shifts</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>From</label>
            <input style={s.input} type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>To</label>
            <input style={s.input} type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)} />
          </div>
          <button style={s.generateBtn} onClick={generateReport} disabled={loading}>
            {loading ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>

      {/* Report results */}
      {reportData && (
        <div style={s.resultCard}>
          <div style={s.resultHeader}>
            <h3 style={s.resultTitle}>
              {reportData.type === "attendance" && "Attendance Report"}
              {reportData.type === "workload" && "Workload Report"}
              {reportData.type === "understaffed" && "Understaffed Shifts"}
              <span style={s.resultPeriod}> · {fmtDate(dateFrom)} – {fmtDate(dateTo)}</span>
            </h3>
            <button style={s.exportBtn} onClick={exportCSV}>⬇ Export CSV</button>
          </div>

          {reportData.rows.length === 0 ? (
            <div style={s.empty}>No data for this period.</div>
          ) : reportData.type === "attendance" ? (
            <div style={s.table}>
              <div style={s.tableHead}>
                <span>Date</span><span>Shift</span><span>Time</span>
                <span>Total</span><span>Present</span><span>Absent</span><span>Late</span>
              </div>
              {reportData.rows.map((r, i) => (
                <div key={i} style={s.tableRow}>
                  <span>{fmtDateShort(r.date)}</span>
                  <span>{r.title}</span>
                  <span>{r.time}</span>
                  <span>{r.total}</span>
                  <span style={{ color:"#166534", fontWeight:"600" }}>{r.present}</span>
                  <span style={{ color:"#991B1B", fontWeight:"600" }}>{r.absent}</span>
                  <span style={{ color:"#D97706", fontWeight:"600" }}>{r.late}</span>
                </div>
              ))}
            </div>
          ) : reportData.type === "workload" ? (
            <div style={s.table}>
              <div style={{ ...s.tableHead, gridTemplateColumns:"2fr 1fr" }}>
                <span>Staff Member</span><span>Shifts Worked</span>
              </div>
              {reportData.rows.map((r, i) => (
                <div key={i} style={{ ...s.tableRow, gridTemplateColumns:"2fr 1fr" }}>
                  <span style={{ fontWeight:"500" }}>{r.name}</span>
                  <span style={{ fontWeight:"700" }}>{r.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.table}>
              <div style={{ ...s.tableHead, gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr" }}>
                <span>Date</span><span>Shift</span><span>Time</span>
                <span>Filled</span><span>Needed</span><span>Gap</span>
              </div>
              {reportData.rows.map((r, i) => (
                <div key={i} style={{ ...s.tableRow, gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr" }}>
                  <span>{fmtDateShort(r.date)}</span>
                  <span>{r.title}</span>
                  <span>{r.time}</span>
                  <span>{r.filled}</span>
                  <span>{r.needed}</span>
                  <span style={{ color:"#991B1B", fontWeight:"700" }}>{r.gap}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric", year:"numeric" });
}
function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric" });
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  configCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  configRow: { display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"flex-end" },
  field: { flex:1, minWidth:"160px" },
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  generateBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    borderRadius:"10px", padding:"10px 20px", fontSize:"14px",
    fontWeight:"700", cursor:"pointer", flexShrink:0, alignSelf:"flex-end" },
  resultCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px" },
  resultHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"16px" },
  resultTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  resultPeriod: { fontSize:"13px", fontWeight:"400", color:"#7A7870" },
  exportBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"8px", padding:"7px 14px", fontSize:"13px",
    fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  empty: { textAlign:"center", padding:"32px", color:"#7A7870", fontSize:"14px" },
  table: { width:"100%" },
  tableHead: { display:"grid", gridTemplateColumns:"1fr 1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr",
    padding:"8px 12px", background:"#F7F6F3", borderRadius:"8px",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"8px", marginBottom:"4px" },
  tableRow: { display:"grid", gridTemplateColumns:"1fr 1.5fr 1fr 0.5fr 0.5fr 0.5fr 0.5fr",
    padding:"10px 12px", borderBottom:"1px solid #F0EDE8",
    fontSize:"13px", color:"#1C1B18", gap:"8px", alignItems:"center" },
};
