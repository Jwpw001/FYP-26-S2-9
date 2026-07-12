import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-attend-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-attend-styles";
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
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastOut {
      from { opacity: 1; transform: translateY(0); }
      to   { opacity: 0; transform: translateY(20px); }
    }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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

const STATUS_OPTIONS = ["present", "absent", "late"];

export default function Attendance() {
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedShift, setSelectedShift] = useState(null);
  const [assignments, setAssignments]     = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(false);
  const [saving, setSaving]               = useState(null);
  const [toast, setToast]                 = useState(null);
  const [outletId, setOutletId]           = useState(null);
  const [activeTab, setActiveTab]         = useState("timesheet");

  const today = new Date().toISOString().split("T")[0];
  const [dateFilter, setDateFilter] = useState(today);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;
        setOutletId(oid);

        const { data } = await supabase
          .from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status")
          .eq("outlet_id", oid)
          .eq("shift_date", dateFilter)
          .eq("status", "published")
          .order("start_time");

        if (!cancelled) {
          setShifts(data || []);
          setSelectedShift(null);
          setAssignments([]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, dateFilter]);

  async function loadAssignments(shiftId) {
    setSelectedShift(shiftId);
    setLoadingAssign(true);
    try {
      const { data: roleData } = await supabase
        .from("shift_roles")
        .select(`
          role_id, role_name,
          shift_assignments (
            assignment_id, staff_id, status,
            staff ( users ( full_name, email ) ),
            attendance ( attendance_id, status, clock_in, clock_out )
          )
        `)
        .eq("shift_id", shiftId);

      const flat = (roleData || []).flatMap(r =>
        (r.shift_assignments || []).map(a => ({
          ...a,
          role_name: r.role_name,
          users: a.staff?.users || null,
          attendanceStatus: a.attendance?.[0]?.status || "pending",
          attendanceId: a.attendance?.[0]?.attendance_id || null,
          clockIn: a.attendance?.[0]?.clock_in || null,
          clockOut: a.attendance?.[0]?.clock_out || null,
        }))
      );
      setAssignments(flat);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAssign(false);
    }
  }

  async function markAttendance(assignment, status) {
    setSaving(assignment.assignment_id);
    try {
      const now = new Date().toISOString();
      if (assignment.attendanceId) {
        await supabase.from("attendance").update({ status }).eq("attendance_id", assignment.attendanceId);
      } else {
        await supabase.from("attendance").insert({
          assignment_id: assignment.assignment_id,
          status,
          marked_by: userId,
          clock_in: status === "present" || status === "late" ? now : null,
        });
      }
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id
          ? { ...a, attendanceStatus: status, clockIn: !a.attendanceId && (status === "present" || status === "late") ? now : a.clockIn }
          : a
      ));
      showToast("Attendance updated.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update.", "error");
    } finally {
      setSaving(null);
    }
  }

  async function clockIn(assignment) {
    setSaving(assignment.assignment_id);
    try {
      const now = new Date().toISOString();
      if (assignment.attendanceId) {
        await supabase.from("attendance").update({ clock_in: now, status: "present" }).eq("attendance_id", assignment.attendanceId);
      } else {
        await supabase.from("attendance").insert({
          assignment_id: assignment.assignment_id,
          status: "present",
          marked_by: userId,
          clock_in: now,
        });
      }
      const { data: updated } = await supabase.from("attendance")
        .select("attendance_id,status,clock_in,clock_out")
        .eq("assignment_id", assignment.assignment_id).single();
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id
          ? { ...a, attendanceStatus: updated?.status || "present", attendanceId: updated?.attendance_id || a.attendanceId, clockIn: updated?.clock_in || now, clockOut: updated?.clock_out || null }
          : a
      ));
      showToast("Clocked in.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock in.", "error");
    } finally {
      setSaving(null);
    }
  }

  async function clockOut(assignment) {
    setSaving(assignment.assignment_id);
    try {
      const now = new Date().toISOString();
      if (assignment.attendanceId) {
        await supabase.from("attendance").update({ clock_out: now }).eq("attendance_id", assignment.attendanceId);
      } else {
        await supabase.from("attendance").insert({
          assignment_id: assignment.assignment_id,
          status: "present",
          marked_by: userId,
          clock_out: now,
        });
      }
      const { data: updated } = await supabase.from("attendance")
        .select("attendance_id,status,clock_in,clock_out")
        .eq("assignment_id", assignment.assignment_id).single();
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id
          ? { ...a, clockOut: updated?.clock_out || now, attendanceId: updated?.attendance_id || a.attendanceId }
          : a
      ));
      showToast("Clocked out.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to clock out.", "error");
    } finally {
      setSaving(null);
    }
  }

  async function saveClockTimes(assignment, clockInISO, clockOutISO) {
    setSaving(assignment.assignment_id);
    try {
      const updates = {};
      if (clockInISO !== undefined) updates.clock_in = clockInISO;
      if (clockOutISO !== undefined) updates.clock_out = clockOutISO;
      if (Object.keys(updates).length === 0) return;

      if (assignment.attendanceId) {
        await supabase.from("attendance").update(updates).eq("attendance_id", assignment.attendanceId);
      } else {
        await supabase.from("attendance").insert({
          assignment_id: assignment.assignment_id,
          status: "present",
          marked_by: userId,
          ...updates,
        });
      }
      const { data: updated } = await supabase.from("attendance")
        .select("attendance_id,status,clock_in,clock_out")
        .eq("assignment_id", assignment.assignment_id).single();
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id
          ? { ...a, attendanceId: updated?.attendance_id || a.attendanceId, attendanceStatus: updated?.status || a.attendanceStatus, clockIn: updated?.clock_in || null, clockOut: updated?.clock_out || null }
          : a
      ));
      showToast("Times saved.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to save times.", "error");
    } finally {
      setSaving(null);
    }
  }

  function getAttendanceStyle(status) {
    const map = {
      pending: { background: "#F1F5F9", color: "#64748B" },
      present: { background: "#DCFCE7", color: "#166534" },
      absent:  { background: "#FEE2E2", color: "#991B1B" },
      late:    { background: "#FFFBEB", color: "#D97706" },
    };
    return map[status] || map.pending;
  }

  function getStatusBtnStyle(btnStatus, currentStatus) {
    const active = btnStatus === currentStatus;
    const map = {
      present: { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
      absent:  { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
      late:    { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
    };
    const m = map[btnStatus];
    if (active) return { background: m.bg, color: m.color, border: `1.5px solid ${m.border}`, fontWeight: "700" };
    return { background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0", fontWeight: "500" };
  }

  return (
    <ManagerLayout title="Timesheet">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Timesheet</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {activeTab === "timesheet" ? "Mark timesheet for published shifts" : "Track working hours per staff member"}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "3px", background: "#F1F5F9", borderRadius: "10px", padding: "3px" }}>
              {[["timesheet","Timesheet"],["hours","Working Hours"]].map(([id, label]) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  style={{ padding: "7px 16px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "all 0.15s",
                    background: activeTab === id ? "#FFF" : "transparent",
                    color: activeTab === id ? "#1E293B" : "#64748B",
                    boxShadow: activeTab === id ? "0 1px 4px rgba(0,0,0,0.1)" : "none",
                  }}>{label}</button>
              ))}
            </div>
            {activeTab === "timesheet" && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <input
                  style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", outline: "none" }}
                  type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {activeTab === "hours" ? (
          <WorkingHours outletId={outletId} />
        ) : (
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px" }}>

          {/* Shift list */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "14px" }}>
              Shifts on {fmtDate(dateFilter)}
            </h3>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ padding: "12px", border: "1px solid #E2E8F0", borderRadius: "10px" }}>
                    <Shimmer h="14px" r="6px" style={{ marginBottom: "8px" }} />
                    <Shimmer w="60%" h="12px" r="6px" />
                  </div>
                ))}
              </div>
            ) : shifts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", color: "#64748B", fontSize: "13px" }}>
                No published shifts on this date.
              </div>
            ) : (
              shifts.map(shift => (
                <ShiftCard
                  key={shift.shift_id}
                  shift={shift}
                  active={selectedShift === shift.shift_id}
                  onClick={() => loadAssignments(shift.shift_id)}
                />
              ))
            )}
          </div>

          {/* Attendance panel */}
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
            {!selectedShift ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", color: "#64748B", fontSize: "14px", gap: "8px" }}>
                <svg width="32" height="32" fill="none" stroke="#CBD5E1" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"/>
                  <path d="M9 12h6M9 16h4"/>
                </svg>
                Select a shift to mark timesheet
              </div>
            ) : loadingAssign ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <Shimmer w="36px" h="36px" r="50%" />
                      <div>
                        <Shimmer w="100px" h="14px" r="6px" style={{ marginBottom: "6px" }} />
                        <Shimmer w="70px" h="12px" r="6px" />
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Shimmer w="68px" h="32px" r="8px" />
                      <Shimmer w="68px" h="32px" r="8px" />
                      <Shimmer w="68px" h="32px" r="8px" />
                    </div>
                  </div>
                ))}
              </div>
            ) : assignments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px", color: "#64748B", fontSize: "14px" }}>
                No staff assigned to this shift.
              </div>
            ) : (
              <>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Mark Timesheet</h3>
                {assignments.map(a => (
                  <AttendanceRow
                    key={a.assignment_id}
                    assignment={a}
                    saving={saving}
                    shiftDate={shifts.find(s => s.shift_id === selectedShift)?.shift_date || dateFilter}
                    getAttendanceStyle={getAttendanceStyle}
                    getStatusBtnStyle={getStatusBtnStyle}
                    onMark={markAttendance}
                    onClockIn={clockIn}
                    onClockOut={clockOut}
                    onSaveTimes={saveClockTimes}
                  />
                ))}
              </>
            )}
          </div>

        </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ShiftCard({ shift, active, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 14px", border: active ? "1.5px solid #2563EB" : (hovered ? "1.5px solid #BFDBFE" : "1px solid #E2E8F0"),
        borderRadius: "10px", marginBottom: "8px", cursor: "pointer",
        background: active ? "#EFF6FF" : (hovered ? "#F8FAFC" : "#FFFFFF"),
        transition: "all 0.15s",
      }}>
      <p style={{ fontSize: "14px", fontWeight: "600", color: active ? "#2563EB" : "#1E293B" }}>
        {shift.title || "Shift"}
      </p>
      <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
        {shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}
      </p>
    </div>
  );
}

function isoToTimeInput(iso) {
  if (!iso) return "";
  const u = iso.endsWith("Z") || iso.includes("+") ? iso : iso + "Z";
  return new Date(u).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Singapore" });
}

function timeInputToISO(timeStr, shiftDate) {
  if (!timeStr || !shiftDate) return null;
  return new Date(`${shiftDate}T${timeStr}:00+08:00`).toISOString();
}

function AttendanceRow({ assignment: a, saving, shiftDate, getAttendanceStyle, getStatusBtnStyle, onMark, onClockIn, onClockOut, onSaveTimes }) {
  const name = a.users?.full_name || "Staff";
  const isSaving = saving === a.assignment_id;

  const [inVal,  setInVal]  = useState(() => isoToTimeInput(a.clockIn));
  const [outVal, setOutVal] = useState(() => isoToTimeInput(a.clockOut));
  const [dirty,  setDirty]  = useState(false);

  // Sync when parent updates the assignment (e.g. after clock in button)
  useEffect(() => { setInVal(isoToTimeInput(a.clockIn));  }, [a.clockIn]);
  useEffect(() => { setOutVal(isoToTimeInput(a.clockOut)); }, [a.clockOut]);

  function handleSave() {
    onSaveTimes(a, timeInputToISO(inVal, shiftDate), timeInputToISO(outVal, shiftDate));
    setDirty(false);
  }

  return (
    <div style={{ padding: "14px 0", borderBottom: "1px solid #F1F5F9" }}>
      {/* Top row: avatar + name + status badge + status buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: "700", flexShrink: 0 }}>
            {name?.[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{name}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{a.role_name}</p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", ...getAttendanceStyle(a.attendanceStatus) }}>
            {a.attendanceStatus.charAt(0).toUpperCase() + a.attendanceStatus.slice(1)}
          </span>
          <div style={{ display: "flex", gap: "5px" }}>
            {STATUS_OPTIONS.map(status => (
              <button
                key={status}
                onClick={() => onMark(a, status)}
                disabled={isSaving}
                style={{
                  padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
                  transition: "all 0.15s", opacity: isSaving ? 0.6 : 1,
                  ...getStatusBtnStyle(status, a.attendanceStatus),
                }}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clock in/out editable row */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", paddingLeft: "46px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: "700", color: "#16A34A", minWidth: "24px" }}>In</label>
          <input
            type="time"
            value={inVal}
            onChange={e => { setInVal(e.target.value); setDirty(true); }}
            style={{ padding: "4px 8px", border: "1.5px solid #BBF7D0", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "#166534", background: "#F0FDF4", outline: "none", cursor: "pointer" }}
          />
        </div>

        <span style={{ color: "#CBD5E1", fontSize: "14px" }}>→</span>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <label style={{ fontSize: "11px", fontWeight: "700", color: "#9F1239", minWidth: "28px" }}>Out</label>
          <input
            type="time"
            value={outVal}
            onChange={e => { setOutVal(e.target.value); setDirty(true); }}
            style={{ padding: "4px 8px", border: "1.5px solid #FECACA", borderRadius: "8px", fontSize: "13px", fontWeight: "600", color: "#9F1239", background: "#FFF1F2", outline: "none", cursor: "pointer" }}
          />
        </div>

        {dirty && (
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "5px 14px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#FFF", fontSize: "12px", fontWeight: "700", cursor: isSaving ? "not-allowed" : "pointer", opacity: isSaving ? 0.7 : 1, transition: "all 0.15s" }}>
            {isSaving ? "Saving…" : "Save"}
          </button>
        )}
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "long", month: "long", day: "numeric" });
}

function fmtDateShort(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" });
}

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function fmtHours(h) {
  if (!h || h <= 0) return "0h";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

function KPICard({ label, value, color }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px 20px" }}>
      <p style={{ fontSize: "22px", fontWeight: "800", color }}>{value}</p>
      <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", marginTop: "4px" }}>{label}</p>
    </div>
  );
}

function StaffHoursCard({ staff, rank, expanded, onToggle, fmtHrs }) {
  const name = staff.name;
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  const attendedShifts = staff.present + staff.late;

  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", cursor: "pointer" }}>
        <span style={{ fontSize: "11px", fontWeight: "700", color: "#CBD5E1", minWidth: "20px" }}>#{rank}</span>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(name), color: "#FFF",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>
            {attendedShifts} of {staff.shiftsAssigned} shift{staff.shiftsAssigned !== 1 ? "s" : ""} attended
          </p>
        </div>
        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {staff.present > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: "#DCFCE7", color: "#166534" }}>{staff.present}P</span>}
          {staff.late   > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: "#FFFBEB", color: "#D97706" }}>{staff.late}L</span>}
          {staff.absent > 0 && <span style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: "#FEE2E2", color: "#991B1B" }}>{staff.absent}A</span>}
        </div>
        <div style={{ textAlign: "right", minWidth: "80px" }}>
          <p style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>{fmtHrs(staff.totalHours)}</p>
          <p style={{ fontSize: "11px", color: "#94A3B8" }}>total hours</p>
        </div>
        <svg width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s", flexShrink: 0 }}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </div>
      {expanded && staff.records.length > 0 && (
        <div style={{ borderTop: "1px solid #F1F5F9", padding: "0 18px 14px" }}>
          {[...staff.records]
            .filter(r => r.shift)
            .sort((a, b) => (a.shift?.shift_date || "").localeCompare(b.shift?.shift_date || ""))
            .map((r, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "9px 0",
                borderBottom: i < arr.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                <div style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#F1F5F9",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "9px", fontWeight: "700", color: "#94A3B8", lineHeight: 1 }}>
                    {new Date(r.shift.shift_date + "T00:00:00").toLocaleDateString("en-SG", { month: "short" }).toUpperCase()}
                  </span>
                  <span style={{ fontSize: "14px", fontWeight: "800", color: "#475569", lineHeight: 1 }}>
                    {new Date(r.shift.shift_date + "T00:00:00").getDate()}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "12px", fontWeight: "600", color: "#1E293B" }}>{r.shift.title || "Shift"}</p>
                  <p style={{ fontSize: "11px", color: "#94A3B8" }}>
                    {r.shift.start_time?.slice(0, 5)} – {r.shift.end_time?.slice(0, 5)}
                  </p>
                </div>
                {r.att && (
                  <div style={{ textAlign: "right", fontSize: "11px", color: "#64748B" }}>
                    {r.att.clock_in && <span>{isoToTimeInput(r.att.clock_in)}</span>}
                    {r.att.clock_in && r.att.clock_out && <span style={{ color: "#CBD5E1" }}> → </span>}
                    {r.att.clock_out && <span>{isoToTimeInput(r.att.clock_out)}</span>}
                  </div>
                )}
                <div style={{ minWidth: "60px", textAlign: "right" }}>
                  {r.hours != null ? (
                    <span style={{ fontSize: "13px", fontWeight: "700", color: "#059669" }}>{fmtHrs(r.hours)}</span>
                  ) : r.att?.status === "absent" ? (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#EF4444" }}>Absent</span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#CBD5E1" }}>—</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function WorkingHours({ outletId }) {
  const [period, setPeriod] = useState("week");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [staffHours, setStaffHours] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState({});

  function getRangeForPeriod(p) {
    const today = new Date();
    if (p === "week") {
      const dow = today.getDay();
      const diff = dow === 0 ? -6 : 1 - dow;
      const start = new Date(today);
      start.setDate(today.getDate() + diff);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return [toLocalDateStr(start), toLocalDateStr(end)];
    }
    if (p === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return [toLocalDateStr(start), toLocalDateStr(end)];
    }
    return [customStart, customEnd];
  }

  useEffect(() => {
    if (!outletId) return;
    if (period === "custom" && (!customStart || !customEnd)) return;
    const [startDate, endDate] = getRangeForPeriod(period);
    if (!startDate || !endDate) return;

    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: shifts } = await supabase
          .from("shifts")
          .select("shift_id, shift_date, title, start_time, end_time")
          .eq("outlet_id", outletId)
          .gte("shift_date", startDate)
          .lte("shift_date", endDate);

        if (!shifts?.length) {
          if (!cancelled) { setStaffHours([]); setLoading(false); }
          return;
        }

        const shiftIds = shifts.map(s => s.shift_id);
        const shiftMap = Object.fromEntries(shifts.map(s => [s.shift_id, s]));

        const { data: asgns } = await supabase
          .from("shift_assignments")
          .select(`
            assignment_id, staff_id, shift_id,
            staff ( users ( full_name ) ),
            attendance ( attendance_id, clock_in, clock_out, status )
          `)
          .in("shift_id", shiftIds);

        const staffMap = {};
        for (const asgn of (asgns || [])) {
          const att = asgn.attendance?.[0];
          const staffId = asgn.staff_id;
          const name = asgn.staff?.users?.full_name || "Unknown";

          if (!staffMap[staffId]) {
            staffMap[staffId] = { staffId, name, totalHours: 0, shiftsAssigned: 0, present: 0, late: 0, absent: 0, noRecord: 0, records: [] };
          }

          staffMap[staffId].shiftsAssigned++;
          const shift = shiftMap[asgn.shift_id];

          if (!att) {
            staffMap[staffId].noRecord++;
            staffMap[staffId].records.push({ shift, att: null, hours: null });
          } else if (att.status === "absent") {
            staffMap[staffId].absent++;
            staffMap[staffId].records.push({ shift, att, hours: null });
          } else {
            if (att.status === "present") staffMap[staffId].present++;
            else if (att.status === "late") staffMap[staffId].late++;
            const hours = (att.clock_in && att.clock_out)
              ? (new Date(att.clock_out) - new Date(att.clock_in)) / 3600000
              : null;
            if (hours != null) staffMap[staffId].totalHours += hours;
            staffMap[staffId].records.push({ shift, att, hours });
          }
        }

        if (!cancelled) {
          setStaffHours(Object.values(staffMap).sort((a, b) => b.totalHours - a.totalHours));
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [outletId, period, customStart, customEnd]);

  if (!outletId) return <div style={{ textAlign: "center", padding: "64px 0", color: "#94A3B8", fontSize: "14px" }}>Loading…</div>;

  const [startDate, endDate] = getRangeForPeriod(period);
  const totalHours = staffHours.reduce((s, x) => s + x.totalHours, 0);

  return (
    <div>
      {/* Period selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "3px", background: "#F1F5F9", borderRadius: "10px", padding: "3px" }}>
          {[["week","This Week"],["month","This Month"],["custom","Custom"]].map(([id, label]) => (
            <button key={id} onClick={() => setPeriod(id)}
              style={{ padding: "6px 14px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: "600", transition: "all 0.15s",
                background: period === id ? "#FFF" : "transparent",
                color: period === id ? "#1E293B" : "#64748B",
                boxShadow: period === id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}>{label}</button>
          ))}
        </div>
        {period === "custom" && (
          <>
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ padding: "6px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none" }} />
            <span style={{ color: "#94A3B8", fontSize: "13px" }}>to</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ padding: "6px 10px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: "13px", color: "#1E293B", outline: "none" }} />
          </>
        )}
        {period !== "custom" && startDate && (
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>
            {fmtDateShort(startDate)} – {fmtDateShort(endDate)}
          </span>
        )}
      </div>

      {/* KPI summary */}
      {!loading && staffHours.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "20px" }}>
          <KPICard label="Staff Tracked" value={staffHours.length} color="#2563EB" />
          <KPICard label="Total Hours" value={fmtHours(totalHours)} color="#059669" />
          <KPICard label="Avg per Staff" value={fmtHours(staffHours.length ? totalHours / staffHours.length : 0)} color="#7C3AED" />
        </div>
      )}

      {/* Staff list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="72px" r="12px" />)}
        </div>
      ) : staffHours.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#64748B", fontSize: "14px" }}>
          No attendance records found for this period.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {staffHours.map((s, i) => (
            <StaffHoursCard
              key={s.staffId}
              staff={s}
              rank={i + 1}
              expanded={!!expanded[s.staffId]}
              onToggle={() => setExpanded(prev => ({ ...prev, [s.staffId]: !prev[s.staffId] }))}
              fmtHrs={fmtHours}
            />
          ))}
        </div>
      )}
    </div>
  );
}
