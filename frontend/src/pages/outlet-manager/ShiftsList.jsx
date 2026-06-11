import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280" },
  published: { background: "#DCFCE7", color: "#166534" },
  completed: { background: "#DBEAFE", color: "#1E40AF" },
  cancelled: { background: "#FEE2E2", color: "#991B1B" },
};

export default function ShiftsList() {
  const navigate = useNavigate();
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState("list"); // list | calendar
  const [filterStatus, setFilter] = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Backend auto-filters by manager's outlet — no pre-call needed
        const shiftsData = await api.get("/api/shifts");
        if (!cancelled) setShifts(shiftsData?.shifts || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Get week dates for calendar view
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

  const filtered = shifts.filter(s => {
    if (filterStatus === "all") return true;
    return s.status === filterStatus;
  });

  function getFillStatus(shift) {
    const roles = shift.shift_roles || [];
    const totalAssigned = roles.reduce((sum, r) =>
      sum + (r.shift_assignments?.length || 0), 0);
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

  return (
    <ManagerLayout title="Shifts">
      {/* Header */}
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Shifts</h2>
          <p style={s.sub}>{shifts.length} total shifts</p>
        </div>
        <button style={s.addBtn}
          onClick={() => navigate("/outlet-manager/shifts/new")}>
          + Create Shift
        </button>
      </div>

      {/* Controls */}
      <div style={s.controls}>
        {/* View toggle */}
        <div style={s.tabs}>
          {["list", "calendar"].map(v => (
            <button key={v} style={{ ...s.tab, ...(view === v ? s.tabActive : {}) }}
              onClick={() => setView(v)}>
              {v === "list" ? "📋 List" : "📅 Calendar"}
            </button>
          ))}
        </div>

        {/* Status filter */}
        <select style={s.select} value={filterStatus}
          onChange={e => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Loading shifts…</div>
      ) : view === "list" ? (
        /* ── List View ─────────────────────────────────────── */
        filtered.length === 0 ? (
          <div style={s.emptyCard}>
            <p style={s.emptyIcon}>📅</p>
            <p style={s.emptyTitle}>No shifts yet</p>
            <p style={s.emptySub}>Create your first shift to get started.</p>
            <button style={s.emptyBtn}
              onClick={() => navigate("/outlet-manager/shifts/new")}>
              + Create Shift
            </button>
          </div>
        ) : (
          <div style={s.card}>
            <div style={s.tableHead}>
              <span>Date</span><span>Title</span>
              <span>Time</span><span>Roles</span>
              <span>Status</span><span></span>
            </div>
            {filtered.map(shift => {
              const fill = getFillStatus(shift);
              return (
                <div key={shift.shift_id} style={s.row}
                  onClick={() => navigate(`/outlet-manager/shifts/${shift.shift_id}`)}>
                  <span style={s.dateCell}>{fmtDate(shift.shift_date)}</span>
                  <span style={s.nameCell}>{shift.title || "Untitled Shift"}</span>
                  <span style={s.cell}>
                    {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                  </span>
                  <span style={s.cell}>
                    <span style={s.roleCount}>
                      {shift.shift_roles?.length || 0} role{shift.shift_roles?.length !== 1 ? "s" : ""}
                    </span>
                    {fill && (
                      <span style={{
                        ...s.fillDot,
                        background: fill === "full" ? "#22C55E" : "#F59E0B"
                      }} />
                    )}
                  </span>
                  <span>
                    <span style={{ ...s.badge, ...STATUS_STYLES[shift.status] }}>
                      {shift.status}
                    </span>
                  </span>
                  <button style={s.viewBtn}>View →</button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Calendar View ─────────────────────────────────── */
        <div style={s.calendarWrap}>
          {/* Week navigation */}
          <div style={s.weekNav}>
            <button style={s.weekBtn} onClick={() => setWeekOffset(p => p - 1)}>←</button>
            <span style={s.weekLabel}>
              {fmtDateShort(weekDates[0])} – {fmtDateShort(weekDates[6])}
            </span>
            <button style={s.weekBtn} onClick={() => setWeekOffset(p => p + 1)}>→</button>
          </div>

          {/* Calendar grid */}
          <div style={s.calGrid}>
            {weekDates.map((date, i) => {
              const dayShifts = getShiftsForDate(date);
              const isToday = date.toDateString() === new Date().toDateString();
              return (
                <div key={i} style={{ ...s.calDay, ...(isToday ? s.calDayToday : {}) }}>
                  <div style={s.calDayHeader}>
                    <span style={s.calDayName}>{DAYS[i]}</span>
                    <span style={{ ...s.calDayNum, ...(isToday ? s.calDayNumToday : {}) }}>
                      {date.getDate()}
                    </span>
                  </div>
                  <div style={s.calEvents}>
                    {dayShifts.map(shift => (
                      <div key={shift.shift_id}
                        style={{ ...s.calEvent, ...STATUS_STYLES[shift.status] }}
                        onClick={() => navigate(`/outlet-manager/shifts/${shift.shift_id}`)}>
                        <p style={s.calEventTitle}>{shift.title || "Shift"}</p>
                        <p style={s.calEventTime}>
                          {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
                        </p>
                      </div>
                    ))}
                    {dayShifts.length === 0 && (
                      <div style={s.calEmpty}
                        onClick={() => navigate("/outlet-manager/shifts/new")}>
                        +
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

function fmtTime(t) {
  if (!t) return "—";
  return new Date(`1970-01-01T${t.includes("T") ? t.split("T")[1] : t}Z`)
    .toISOString().slice(11, 16);
}
function fmtDate(d) {
  if (!d) return "—";
  try {
    const clean = String(d).includes("T") ? String(d).split("T")[0] : String(d);
    return new Date(clean + "T00:00:00Z").toLocaleDateString("en-SG", {
      weekday: "short", month: "short", day: "numeric", timeZone: "UTC"
    });
  } catch { return "—"; }
}
function fmtDateShort(d) {
  if (!d) return "—";
  try {
    // d can be a Date object or string
    const dt = d instanceof Date ? d : new Date(String(d).split("T")[0] + "T00:00:00Z");
    return dt.toLocaleDateString("en-SG", { month: "short", day: "numeric", timeZone: "UTC" });
  } catch { return "—"; }
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  addBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 18px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  controls: { display:"flex", gap:"10px", marginBottom:"16px",
    flexWrap:"wrap", alignItems:"center" },
  tabs: { display:"flex", gap:"4px", background:"#F0EDE8",
    padding:"4px", borderRadius:"10px" },
  tab: { padding:"6px 14px", background:"transparent", border:"none",
    borderRadius:"7px", fontSize:"13px", fontWeight:"500",
    color:"#7A7870", cursor:"pointer" },
  tabActive: { background:"#FFFFFF", color:"#1C1B18", fontWeight:"600",
    boxShadow:"0 1px 3px rgba(0,0,0,0.08)" },
  select: { padding:"9px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  emptyCard: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px",
    padding:"60px 40px", textAlign:"center" },
  emptyIcon: { fontSize:"40px", marginBottom:"12px" },
  emptyTitle: { fontSize:"18px", fontWeight:"700", color:"#1C1B18", marginBottom:"8px" },
  emptySub: { fontSize:"14px", color:"#7A7870", marginBottom:"24px" },
  emptyBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 20px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  tableHead: { display:"grid", gridTemplateColumns:"1.5fr 2fr 1.2fr 1.2fr 1fr 80px",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"8px" },
  row: { display:"grid", gridTemplateColumns:"1.5fr 2fr 1.2fr 1.2fr 1fr 80px",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"8px", fontSize:"13px",
    color:"#1C1B18", cursor:"pointer" },
  dateCell: { fontWeight:"600", color:"#1C1B18" },
  nameCell: { fontWeight:"500" },
  cell: { display:"flex", alignItems:"center", gap:"6px" },
  roleCount: { color:"#55524A" },
  fillDot: { width:"8px", height:"8px", borderRadius:"50%", flexShrink:0 },
  badge: { display:"inline-block", padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  viewBtn: { background:"none", border:"1px solid #E5E2DC", borderRadius:"7px",
    padding:"5px 10px", fontSize:"12px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },

  /* Calendar */
  calendarWrap: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  weekNav: { display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"14px 20px", borderBottom:"1px solid #F0EDE8" },
  weekBtn: { width:"32px", height:"32px", borderRadius:"8px",
    background:"#F7F6F3", border:"1px solid #E5E2DC",
    fontSize:"14px", cursor:"pointer", display:"flex",
    alignItems:"center", justifyContent:"center" },
  weekLabel: { fontSize:"14px", fontWeight:"700", color:"#1C1B18" },
  calGrid: { display:"grid", gridTemplateColumns:"repeat(7, 1fr)",
    minHeight:"400px" },
  calDay: { borderRight:"1px solid #F0EDE8", padding:"8px",
    minHeight:"140px" },
  calDayToday: { background:"#F8F7FF" },
  calDayHeader: { display:"flex", flexDirection:"column",
    alignItems:"center", marginBottom:"8px" },
  calDayName: { fontSize:"11px", fontWeight:"600", color:"#7A7870",
    textTransform:"uppercase", marginBottom:"2px" },
  calDayNum: { fontSize:"15px", fontWeight:"700", color:"#1C1B18",
    width:"28px", height:"28px", borderRadius:"50%",
    display:"flex", alignItems:"center", justifyContent:"center" },
  calDayNumToday: { background:"#1C1B18", color:"#FFFFFF" },
  calEvents: { display:"flex", flexDirection:"column", gap:"4px" },
  calEvent: { padding:"4px 6px", borderRadius:"6px",
    cursor:"pointer", fontSize:"11px" },
  calEventTitle: { fontWeight:"600", marginBottom:"1px",
    overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  calEventTime: { opacity:0.7 },
  calEmpty: { color:"#D0CEC8", fontSize:"18px", textAlign:"center",
    cursor:"pointer", padding:"4px", borderRadius:"6px",
    border:"1px dashed #E5E2DC" },
};