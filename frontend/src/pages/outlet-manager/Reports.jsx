import { useState } from "react";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";

const REPORT_TYPES = [
  { key:"attendance", label:"Attendance Report", icon:"✅", desc:"Staff attendance by shift and date range" },
  { key:"workload", label:"Workload Report", icon:"⏱", desc:"Total hours assigned per staff member" },
  { key:"understaffed", label:"Understaffed Shifts", icon:"⚠️", desc:"Shifts with unfilled role headcount" },
];

export default function Reports() {
  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 7*86400000).toISOString().split("T")[0];
  const [reportType, setReportType] = useState("attendance");
  const [startDate, setStartDate] = useState(weekAgo);
  const [endDate, setEndDate] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generateReport() {
    setLoading(true); setError(""); setData(null);
    try {
      const res = await api.get(`/api/reports?type=${reportType}&start_date=${startDate}&end_date=${endDate}`);
      setData(res.data || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  function exportCSV() {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type:"text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `${reportType}-report-${startDate}-${endDate}.csv`; a.click();
  }

  return (
    <ManagerLayout title="Reports">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Reports</h2>
          <p style={s.sub}>Generate and export operational reports</p>
        </div>
      </div>

      <div style={s.typeGrid}>
        {REPORT_TYPES.map(rt => (
          <div key={rt.key} style={{ ...s.typeCard, ...(reportType === rt.key ? s.typeCardActive : {}) }}
            onClick={() => setReportType(rt.key)}>
            <span style={s.typeIcon}>{rt.icon}</span>
            <div>
              <p style={s.typeLabel}>{rt.label}</p>
              <p style={s.typeDesc}>{rt.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={s.filterRow}>
        <div style={s.filterGroup}>
          <label style={s.label}>Start Date</label>
          <input style={s.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        <div style={s.filterGroup}>
          <label style={s.label}>End Date</label>
          <input style={s.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button style={s.generateBtn} onClick={generateReport} disabled={loading}>
          {loading ? "Generating…" : "Generate Report"}
        </button>
        {data && data.length > 0 && (
          <button style={s.exportBtn} onClick={exportCSV}>Export CSV</button>
        )}
      </div>

      {error && <div style={s.error}>{error}</div>}

      {data !== null && (
        <div style={s.results}>
          {data.length === 0 ? (
            <div style={s.empty}>No data found for the selected period.</div>
          ) : reportType === "workload" ? (
            <div style={s.table}>
              <div style={{ ...s.tableHead, gridTemplateColumns:"2fr 1fr" }}>
                <span>Staff Member</span><span>Total Hours</span>
              </div>
              {data.map((row, i) => (
                <div key={i} style={{ ...s.tableRow, gridTemplateColumns:"2fr 1fr" }}>
                  <span>{row.name}</span>
                  <span style={s.hoursVal}>{row.hours?.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          ) : reportType === "understaffed" ? (
            <div style={s.table}>
              <div style={{ ...s.tableHead, gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr" }}>
                <span>Date</span><span>Shift</span><span>Role</span><span>Filled</span><span>Needed</span>
              </div>
              {data.map((row, i) => (
                <div key={i} style={{ ...s.tableRow, gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr" }}>
                  <span>{fmtDate(row.shift_date)}</span>
                  <span>{row.title}</span>
                  <span>{row.role_name}</span>
                  <span style={{ color:"#D97706", fontWeight:"600" }}>{row.filled}</span>
                  <span>{row.needed}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={s.table}>
              <div style={{ ...s.tableHead, gridTemplateColumns:"1fr 1fr 1fr 1fr" }}>
                <span>Date</span><span>Shift</span><span>Staff</span><span>Status</span>
              </div>
              {data.flatMap((shift, i) =>
                (shift.shift_assignments || []).map((a, j) => (
                  <div key={`${i}-${j}`} style={{ ...s.tableRow, gridTemplateColumns:"1fr 1fr 1fr 1fr" }}>
                    <span>{fmtDate(shift.shift_date)}</span>
                    <span>{shift.title}</span>
                    <span>{a.staff?.users?.full_name || "Unknown"}</span>
                    <span>
                      <span style={{ ...s.badge, ...attStyle(a.attendance?.[0]?.status) }}>
                        {a.attendance?.[0]?.status || "—"}
                      </span>
                    </span>
                  </div>
                ))
              )}
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
function attStyle(s) {
  const map = { present:{ background:"#DCFCE7", color:"#166534" }, absent:{ background:"#FEE2E2", color:"#991B1B" }, late:{ background:"#FFFBEB", color:"#D97706" } };
  return map[s] || { background:"#F3F4F6", color:"#6B7280" };
}
const s = {
  headerRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" },
  heading:{ fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub:{ fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  typeGrid:{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:"12px", marginBottom:"20px" },
  typeCard:{ background:"#FFFFFF", border:"1.5px solid #E5E2DC", borderRadius:"12px", padding:"16px", display:"flex", gap:"12px", alignItems:"flex-start", cursor:"pointer" },
  typeCardActive:{ border:"1.5px solid #1C1B18", background:"#F7F6F3" },
  typeIcon:{ fontSize:"22px", flexShrink:0 },
  typeLabel:{ fontSize:"14px", fontWeight:"700", color:"#1C1B18" },
  typeDesc:{ fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  filterRow:{ display:"flex", gap:"12px", alignItems:"flex-end", flexWrap:"wrap", marginBottom:"20px" },
  filterGroup:{ display:"flex", flexDirection:"column", gap:"4px" },
  label:{ fontSize:"12px", fontWeight:"600", color:"#7A7870" },
  input:{ padding:"9px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px", background:"#FFFFFF" },
  generateBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"10px 20px", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
  exportBtn:{ background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"9px", padding:"10px 20px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  error:{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  results:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px" },
  empty:{ textAlign:"center", padding:"40px", color:"#7A7870", fontSize:"14px" },
  table:{ width:"100%" },
  tableHead:{ display:"grid", padding:"8px 12px", background:"#F7F6F3", borderRadius:"8px", fontSize:"12px", fontWeight:"600", color:"#7A7870", marginBottom:"4px", gap:"8px" },
  tableRow:{ display:"grid", padding:"10px 12px", borderRadius:"8px", fontSize:"13px", gap:"8px", alignItems:"center", borderBottom:"1px solid #F0EDE8", color:"#1C1B18" },
  hoursVal:{ fontWeight:"700", color:"#1C1B18" },
  badge:{ display:"inline-block", padding:"3px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
};
