import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

const STATUS_OPTIONS = ["present", "absent", "late"];

export default function Attendance() {
  const user = getUser();
  const today = new Date().toISOString().split("T")[0];
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [saving, setSaving] = useState(null);
  const [success, setSuccess] = useState("");
  const [dateFilter, setDateFilter] = useState(today);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await api.get("/api/shifts");
        if (cancelled) return;
        const filtered = (res.attendance || res.data || []).filter(s => s.shift_date === dateFilter && s.status === "published");
        setShifts(filtered);
        setSelectedShift(null);
        setAssignments([]);
      } catch (err) { console.error(err); }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [dateFilter]);

  async function loadAssignments(shiftId) {
    setSelectedShift(shiftId);
    setLoadingAssign(true);
    try {
      const res = await api.get(`/api/shifts/${shiftId}`);
      const shift = res.data;
      const flat = (shift.shift_roles || []).flatMap(r =>
        (r.shift_assignments || []).map(a => ({
          ...a,
          role_name: r.role_name,
          staffName: a.staff?.users?.full_name || a.staff?.users?.email || "Unknown",
          attendanceStatus: a.attendance?.[0]?.status || "pending",
          attendanceId: a.attendance?.[0]?.attendance_id || null,
        }))
      );
      setAssignments(flat);
    } catch (err) { console.error(err); }
    finally { setLoadingAssign(false); }
  }

  async function markAttendance(assignment, status) {
    setSaving(assignment.assignment_id);
    try {
      await api.post("/api/attendance", { assignment_id: assignment.assignment_id, status });
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id ? { ...a, attendanceStatus: status } : a
      ));
      setSuccess("Attendance updated.");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) { console.error(err); }
    finally { setSaving(null); }
  }

  function getAttendanceStyle(status) {
    const map = { pending:{ background:"#F3F4F6", color:"#6B7280" }, present:{ background:"#DCFCE7", color:"#166534" }, absent:{ background:"#FEE2E2", color:"#991B1B" }, late:{ background:"#FFFBEB", color:"#D97706" } };
    return map[status] || map.pending;
  }

  return (
    <ManagerLayout title="Attendance">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Attendance</h2>
          <p style={s.sub}>Mark attendance for published shifts</p>
        </div>
        <input style={s.dateInput} type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
      </div>
      {success && <div style={s.successMsg}>{success}</div>}
      <div style={s.layout}>
        <div style={s.shiftList}>
          <h3 style={s.sectionTitle}>Shifts on {fmtDate(dateFilter)}</h3>
          {loading ? <div style={s.empty}>Loading…</div> : shifts.length === 0 ? (
            <div style={s.empty}>No published shifts on this date.</div>
          ) : shifts.map(shift => (
            <div key={shift.shift_id}
              style={{ ...s.shiftCard, ...(selectedShift === shift.shift_id ? s.shiftCardActive : {}) }}
              onClick={() => loadAssignments(shift.shift_id)}>
              <p style={s.shiftTitle}>{shift.title || "Shift"}</p>
              <p style={s.shiftTime}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</p>
            </div>
          ))}
        </div>
        <div style={s.attendancePanel}>
          {!selectedShift ? <div style={s.empty}>Select a shift to mark attendance.</div>
          : loadingAssign ? <div style={s.empty}>Loading staff…</div>
          : assignments.length === 0 ? <div style={s.empty}>No staff assigned to this shift.</div>
          : (
            <>
              <h3 style={s.sectionTitle}>Mark Attendance</h3>
              {assignments.map(a => (
                <div key={a.assignment_id} style={s.attendRow}>
                  <div style={s.staffInfo}>
                    <div style={s.avatar}>{a.staffName?.[0]?.toUpperCase() || "?"}</div>
                    <div>
                      <p style={s.staffName}>{a.staffName}</p>
                      <p style={s.roleName}>{a.role_name}</p>
                    </div>
                  </div>
                  <div style={s.attendActions}>
                    <span style={{ ...s.currentStatus, ...getAttendanceStyle(a.attendanceStatus) }}>
                      {a.attendanceStatus.charAt(0).toUpperCase() + a.attendanceStatus.slice(1)}
                    </span>
                    <div style={s.btnGroup}>
                      {STATUS_OPTIONS.map(status => (
                        <button key={status}
                          style={{ ...s.statusBtn, ...(a.attendanceStatus === status ? s.statusBtnActive : {}) }}
                          onClick={() => markAttendance(a, status)}
                          disabled={saving === a.assignment_id}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday:"long", month:"long", day:"numeric" });
}
const s = {
  headerRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading:{ fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub:{ fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  dateInput:{ padding:"9px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px", background:"#FFFFFF", color:"#1C1B18" },
  successMsg:{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  layout:{ display:"grid", gridTemplateColumns:"280px 1fr", gap:"20px" },
  shiftList:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px" },
  sectionTitle:{ fontSize:"14px", fontWeight:"700", color:"#1C1B18", marginBottom:"12px" },
  empty:{ textAlign:"center", padding:"32px", color:"#7A7870", fontSize:"14px" },
  shiftCard:{ padding:"12px", border:"1px solid #E5E2DC", borderRadius:"10px", marginBottom:"8px", cursor:"pointer" },
  shiftCardActive:{ border:"1.5px solid #1C1B18", background:"#F7F6F3" },
  shiftTitle:{ fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  shiftTime:{ fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  attendancePanel:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"20px" },
  attendRow:{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #F0EDE8", flexWrap:"wrap", gap:"10px" },
  staffInfo:{ display:"flex", alignItems:"center", gap:"10px" },
  avatar:{ width:"32px", height:"32px", borderRadius:"50%", background:"#E5E2DC", color:"#55524A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"700", flexShrink:0 },
  staffName:{ fontSize:"14px", fontWeight:"600", color:"#1C1B18" },
  roleName:{ fontSize:"12px", color:"#7A7870" },
  attendActions:{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap" },
  currentStatus:{ padding:"3px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  btnGroup:{ display:"flex", gap:"4px" },
  statusBtn:{ padding:"5px 10px", border:"1px solid #E5E2DC", borderRadius:"7px", fontSize:"12px", fontWeight:"500", color:"#55524A", background:"#F7F6F3", cursor:"pointer" },
  statusBtnActive:{ background:"#1C1B18", color:"#FFFFFF", border:"1px solid #1C1B18" },
};
