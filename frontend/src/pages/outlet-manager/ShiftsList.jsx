import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-shifts-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-shifts-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280" },
  published: { background: "#DCFCE7", color: "#166534" },
  completed: { background: "#DBEAFE", color: "#1E40AF" },
  cancelled: { background: "#FEE2E2", color: "#991B1B" },
};

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

export default function ShiftsList() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("list");
  const [filterStatus, setFilter]   = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaffData } = await api.get(`/api/staff`);
        const myStaffRecord = myStaffData?.staff?.find(s => s.users?.user_id === userId && s.is_active);
        const oid = myStaffRecord?.outlet_id;
        if (!oid || cancelled) return;

        const { data: shiftsData } = await api.get(`/api/shifts?outlet_id=${oid}`);
        if (!cancelled) setShifts(shiftsData?.shifts || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function getWeekDates() {
    const dates = [];
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  const weekDates = getWeekDates();

  const filtered = shifts.filter(s => filterStatus === "all" || s.status === filterStatus);

  function getFillStatus(shift) {
    const roles = shift.shift_roles || [];
    const totalAssigned = roles.reduce((sum, r) => sum + (r.shift_assignments?.length || 0), 0);
    const totalNeeded = roles.length;
    if (totalNeeded === 0) return null;
    if (totalAssigned >= totalNeeded) return "full";
    return "partial";
  }

  function getShiftsForDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return shifts.filter(s => s.shift_date === dateStr);
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const STATUS_CHIPS = [
    { value: "all",       label: "All" },
    { value: "draft",     label: "Draft" },
    { value: "published", label: "Published" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <ManagerLayout title="Shifts">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Shifts</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{shifts.length} total shifts</p>
          </div>
          <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {["list", "calendar"].map(v => (
              <ViewToggleBtn key={v} label={v === "list" ? "List" : "Calendar"} active={view === v} onClick={() => setView(v)} />
            ))}
          </div>

          {/* Status chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {STATUS_CHIPS.map(chip => (
              <StatusChip key={chip.value} label={chip.label} active={filterStatus === chip.value} onClick={() => setFilter(chip.value)} status={chip.value} />
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
              <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "14px 18px", gap: "8px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                <Shimmer w="80%" h="14px" r="6px" />
                <Shimmer w="60%" h="14px" r="6px" />
                <Shimmer w="70%" h="14px" r="6px" />
                <Shimmer w="50px" h="20px" r="100px" />
                <Shimmer w="70px" h="22px" r="100px" />
                <Shimmer w="58px" h="28px" r="7px" />
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          filtered.length === 0 ? (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px 40px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📅</div>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#1E293B", marginBottom: "8px" }}>No shifts yet</p>
              <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>Create your first shift to get started.</p>
              <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
            </div>
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
                <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
              </div>
              {filtered.map(shift => (
                <ShiftRow key={shift.shift_id} shift={shift} fill={getFillStatus(shift)} onNav={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)} />
              ))}
            </div>
          )
        ) : (
          /* Calendar view */
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <WeekNavBtn label="←" onClick={() => setWeekOffset(p => p - 1)} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>
                {fmtDateShort(weekDates[0])} – {fmtDateShort(weekDates[6])}
              </span>
              <WeekNavBtn label="→" onClick={() => setWeekOffset(p => p + 1)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "400px" }}>
              {weekDates.map((date, i) => {
                const dayShifts = getShiftsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", padding: "10px", minHeight: "140px", background: isToday ? "#F0F7FF" : "transparent" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "3px" }}>{DAYS[i]}</span>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: isToday ? "#2563EB" : "transparent", color: isToday ? "#fff" : "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700" }}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {dayShifts.map(shift => (
                        <div key={shift.shift_id}
                          style={{ padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", ...STATUS_STYLES[shift.status] }}
                          onClick={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)}>
                          <p style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "1px" }}>{shift.title || "Shift"}</p>
                          <p style={{ opacity: 0.75 }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</p>
                        </div>
                      ))}
                      {dayShifts.length === 0 && (
                        <div style={{ color: "#CBD5E1", fontSize: "16px", textAlign: "center", cursor: "pointer", padding: "4px", borderRadius: "6px", border: "1px dashed #E2E8F0" }}
                          onClick={() => goTo("/outlet-manager/shifts/new")}>+</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ShiftRow({ shift, fill, onNav }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNav}
      style={{
        display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px",
        padding: "13px 18px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s", cursor: "pointer",
      }}>
      <span style={{ fontWeight: "600" }}>{fmtDate(shift.shift_date)}</span>
      <span style={{ fontWeight: "500" }}>{shift.title || "Untitled Shift"}</span>
      <span style={{ color: "#64748B" }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ color: "#64748B" }}>{shift.shift_roles?.length || 0} role{shift.shift_roles?.length !== 1 ? "s" : ""}</span>
        {fill && (
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: fill === "full" ? "#22C55E" : "#F59E0B", flexShrink: 0, display: "inline-block" }} />
        )}
      </span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", ...STATUS_STYLES[shift.status] }}>
          {shift.status}
        </span>
      </span>
      <button
        onClick={e => { e.stopPropagation(); onNav(); }}
        style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
        View →
      </button>
    </div>
  );
}

function CreateShiftBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#1D4ED8" : "#2563EB", color: "#FFFFFF", border: "none",
        padding: "10px 18px", borderRadius: "10px", fontSize: "14px",
        fontWeight: "600", cursor: "pointer", transition: "background 0.15s",
      }}>
      + Create Shift
    </button>
  );
}

function ViewToggleBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 16px", background: active ? "#FFFFFF" : "transparent",
        border: "none", borderRadius: "7px", fontSize: "13px",
        fontWeight: active ? "600" : "500", color: active ? "#1E293B" : "#64748B",
        cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function StatusChip({ label, active, onClick, status }) {
  const statusMap = {
    all:       { activeBg: "#EFF6FF", activeBorder: "#2563EB", activeColor: "#2563EB" },
    draft:     { activeBg: "#F9FAFB", activeBorder: "#9CA3AF", activeColor: "#374151" },
    published: { activeBg: "#F0FDF4", activeBorder: "#22C55E", activeColor: "#166534" },
    completed: { activeBg: "#EFF6FF", activeBorder: "#3B82F6", activeColor: "#1E40AF" },
    cancelled: { activeBg: "#FEF2F2", activeBorder: "#EF4444", activeColor: "#991B1B" },
  };
  const m = statusMap[status] || statusMap.all;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px", borderRadius: "100px", fontSize: "12px", fontWeight: "600",
        cursor: "pointer",
        border: active ? `1.5px solid ${m.activeBorder}` : "1.5px solid #E2E8F0",
        background: active ? m.activeBg : "#FFFFFF",
        color: active ? m.activeColor : "#64748B",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function WeekNavBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        background: hovered ? "#EFF6FF" : "#F8FAFC",
        border: "1px solid #E2E8F0", fontSize: "14px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        color: hovered ? "#2563EB" : "#64748B", transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateShort(d) {
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}
