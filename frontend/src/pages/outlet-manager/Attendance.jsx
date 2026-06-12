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
            users:staff_id ( full_name, email ),
            attendance ( attendance_id, status, clock_in, clock_out )
          )
        `)
        .eq("shift_id", shiftId);

      const flat = (roleData || []).flatMap(r =>
        (r.shift_assignments || []).map(a => ({
          ...a,
          role_name: r.role_name,
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
      if (assignment.attendanceId) {
        await supabase.from("attendance").update({ status }).eq("attendance_id", assignment.attendanceId);
      } else {
        await supabase.from("attendance").insert({
          assignment_id: assignment.assignment_id,
          status,
          marked_by: userId,
          clock_in: status === "present" || status === "late" ? new Date().toISOString() : null,
        });
      }
      setAssignments(prev => prev.map(a =>
        a.assignment_id === assignment.assignment_id ? { ...a, attendanceStatus: status } : a
      ));
      showToast("Attendance updated.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to update.", "error");
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
    <ManagerLayout title="Attendance">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Attendance</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Mark attendance for published shifts</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <svg width="16" height="16" fill="none" stroke="#64748B" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>
            </svg>
            <input
              style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", outline: "none" }}
              type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            />
          </div>
        </div>

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
                Select a shift to mark attendance
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
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>Mark Attendance</h3>
                {assignments.map(a => (
                  <AttendanceRow
                    key={a.assignment_id}
                    assignment={a}
                    saving={saving}
                    getAttendanceStyle={getAttendanceStyle}
                    getStatusBtnStyle={getStatusBtnStyle}
                    onMark={markAttendance}
                  />
                ))}
              </>
            )}
          </div>

        </div>
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

function AttendanceRow({ assignment: a, saving, getAttendanceStyle, getStatusBtnStyle, onMark }) {
  const name = a.users?.full_name || "Staff";
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: "1px solid #F1F5F9", flexWrap: "wrap", gap: "10px" }}>
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
              disabled={saving === a.assignment_id}
              style={{
                padding: "6px 12px", borderRadius: "8px", fontSize: "12px", cursor: "pointer",
                transition: "all 0.15s", opacity: saving === a.assignment_id ? 0.6 : 1,
                ...getStatusBtnStyle(status, a.attendanceStatus),
              }}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "long", month: "long", day: "numeric" });
}
