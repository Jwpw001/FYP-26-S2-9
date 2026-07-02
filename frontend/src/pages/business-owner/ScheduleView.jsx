import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useBusinessContext } from "../../context/BusinessContext";
import { CalendarDays, ChevronLeft, ChevronRight, Eye } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-schedule-styles")) {
  const style = document.createElement("style");
  style.id = "bo-schedule-styles";
  style.textContent = `
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280", label: "Draft" },
  published: { background: "#DCFCE7", color: "#166534", label: "Published" },
  completed: { background: "#DBEAFE", color: "#1E40AF", label: "Completed" },
  cancelled: { background: "#FEE2E2", color: "#991B1B", label: "Cancelled" },
};

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function fmtTime(t) {
  if (!t) return "—";
  const parts = String(t).split(":");
  const h = Number(parts[0]); const m = parts[1] || "00";
  return `${h % 12 || 12}:${m} ${h >= 12 ? "PM" : "AM"}`;
}

function getWeekDates(offset) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function ScheduleView() {
  const { schedulingMode, locationLabel } = useBusinessContext();
  const pageTitle = schedulingMode === "flexible" ? "Timesheets" : schedulingMode === "appointment" ? "Appointments" : "Schedule";

  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    api.get("/api/business/outlets").then(r => setOutlets(r.outlets || []));
  }, []);

  useEffect(() => {
    if (outlets.length === 0) return;
    loadShifts();
  }, [outlets, selectedOutlet, weekOffset]);

  async function loadShifts() {
    setLoading(true);
    try {
      const outletIds = selectedOutlet === "all"
        ? outlets.map(o => o.outlet_id)
        : [Number(selectedOutlet)];

      const weekDates = getWeekDates(weekOffset);
      const from = weekDates[0].toISOString().split("T")[0];
      const to   = weekDates[6].toISOString().split("T")[0];

      const { data } = await supabase
        .from("shifts")
        .select(`
          shift_id, title, shift_date, start_time, end_time, status, outlet_id,
          outlets ( name ),
          shift_roles ( role_id, headcount ),
          shift_assignments ( assignment_id )
        `)
        .in("outlet_id", outletIds)
        .gte("shift_date", from)
        .lte("shift_date", to)
        .order("shift_date", { ascending: true })
        .order("start_time", { ascending: true });

      setShifts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const weekDates = getWeekDates(weekOffset);
  const weekLabel = (() => {
    const s = weekDates[0]; const e = weekDates[6];
    if (s.getMonth() === e.getMonth()) return `${DAY_LABELS[0]} ${s.getDate()} – ${DAY_LABELS[6]} ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
    return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
  })();

  const filteredShifts = filterStatus === "all" ? shifts : shifts.filter(s => s.status === filterStatus);

  const shiftsByDate = {};
  weekDates.forEach(d => { shiftsByDate[d.toISOString().split("T")[0]] = []; });
  filteredShifts.forEach(s => { if (shiftsByDate[s.shift_date]) shiftsByDate[s.shift_date].push(s); });

  const totalShifts = filteredShifts.length;
  const publishedCount = filteredShifts.filter(s => s.status === "published").length;

  return (
    <BusinessOwnerLayout title={`${pageTitle} (View Only)`}>
      <div style={{ animation: "pageIn 0.3s ease" }}>

        {/* Read-only notice */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "10px 16px", marginBottom: "20px" }}>
          <Eye size={16} color="#3B82F6" />
          <p style={{ fontSize: "13px", color: "#1D4ED8", fontWeight: "500" }}>
            You are viewing the schedule in read-only mode. Only outlet managers can create or edit shifts.
          </p>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          {/* Week navigator */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "6px 12px" }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={s.navBtn}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", minWidth: "220px", textAlign: "center" }}>{weekLabel}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} style={s.navBtn}><ChevronRight size={16} /></button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} style={{ ...s.navBtn, fontSize: "11px", color: "#F59E0B", fontWeight: "700", padding: "2px 8px", border: "1px solid #FCD34D", borderRadius: "6px" }}>Today</button>
            )}
          </div>

          {/* Outlet filter */}
          <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} style={s.select}>
            <option value="all">All {locationLabel}s</option>
            {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
          </select>

          {/* Status filter */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={s.select}>
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          <div style={{ marginLeft: "auto", display: "flex", gap: "16px" }}>
            <div style={s.statPill}><span style={{ color: "#64748B" }}>Total</span><strong style={{ color: "#1E293B" }}>{totalShifts}</strong></div>
            <div style={s.statPill}><span style={{ color: "#64748B" }}>Published</span><strong style={{ color: "#16A34A" }}>{publishedCount}</strong></div>
          </div>
        </div>

        {/* Calendar grid */}
        <div style={s.grid}>
          {weekDates.map((date, idx) => {
            const dateStr = date.toISOString().split("T")[0];
            const dayShifts = shiftsByDate[dateStr] || [];
            const isToday = dateStr === new Date().toISOString().split("T")[0];
            return (
              <div key={dateStr} style={{ ...s.dayCol, ...(isToday ? s.dayColToday : {}) }}>
                <div style={{ ...s.dayHeader, ...(isToday ? s.dayHeaderToday : {}) }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.05em", color: isToday ? "#1D4ED8" : "#94A3B8" }}>{DAY_LABELS[idx]}</span>
                  <span style={{ fontSize: "18px", fontWeight: "800", color: isToday ? "#1D4ED8" : "#1E293B", marginTop: "2px" }}>{date.getDate()}</span>
                  {isToday && <span style={{ fontSize: "9px", fontWeight: "700", color: "#3B82F6", background: "#DBEAFE", padding: "1px 6px", borderRadius: "99px", marginTop: "2px" }}>TODAY</span>}
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {loading ? (
                    Array.from({ length: 2 }).map((_, i) => <Shimmer key={i} h="64px" r="8px" />)
                  ) : dayShifts.length === 0 ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "11px", color: "#CBD5E1" }}>—</span>
                    </div>
                  ) : (
                    dayShifts.map(shift => {
                      const st = STATUS_STYLES[shift.status] || STATUS_STYLES.draft;
                      const required = (shift.shift_roles || []).reduce((a, r) => a + (r.headcount || 0), 0);
                      const assigned = (shift.shift_assignments || []).length;
                      const fillPct = required > 0 ? Math.min(100, Math.round((assigned / required) * 100)) : 0;
                      const fillColor = fillPct >= 100 ? "#22C55E" : fillPct >= 60 ? "#F59E0B" : "#EF4444";
                      return (
                        <div key={shift.shift_id} style={s.shiftCard}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                            <p style={{ fontSize: "12px", fontWeight: "700", color: "#1E293B", lineHeight: 1.3 }}>{shift.title || "Untitled"}</p>
                            <span style={{ ...st, padding: "1px 6px", borderRadius: "99px", fontSize: "10px", fontWeight: "700", flexShrink: 0, marginLeft: "4px" }}>{st.label}</span>
                          </div>
                          <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "4px" }}>{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</p>
                          {shift.outlets?.name && selectedOutlet === "all" && (
                            <p style={{ fontSize: "10px", color: "#94A3B8", marginBottom: "4px", fontWeight: "600" }}>{shift.outlets.name}</p>
                          )}
                          {required > 0 && (
                            <div>
                              <div style={{ height: "3px", background: "#F1F5F9", borderRadius: "2px", overflow: "hidden" }}>
                                <div style={{ height: "100%", width: `${fillPct}%`, background: fillColor, borderRadius: "2px", transition: "width 0.4s" }} />
                              </div>
                              <p style={{ fontSize: "10px", color: "#94A3B8", marginTop: "3px" }}>{assigned}/{required} staff</p>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BusinessOwnerLayout>
  );
}

const s = {
  navBtn: { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#475569", padding: "2px" },
  select: { padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", fontWeight: "500", color: "#1E293B", background: "#FFF", cursor: "pointer" },
  statPill: { display: "flex", alignItems: "center", gap: "6px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "9px", padding: "6px 14px", fontSize: "13px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", minHeight: "500px" },
  dayCol: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", display: "flex", flexDirection: "column", minHeight: "500px", overflow: "hidden" },
  dayColToday: { border: "1.5px solid #BFDBFE", background: "#FAFEFF" },
  dayHeader: { padding: "10px 8px 8px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  dayHeaderToday: { background: "#EFF6FF", borderBottom: "1px solid #BFDBFE" },
  shiftCard: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 10px" },
};
