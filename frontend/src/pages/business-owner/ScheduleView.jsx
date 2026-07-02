import { useState, useEffect, useRef } from "react";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useBusinessContext } from "../../context/BusinessContext";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, X, Clock, Building2, Users, CheckCircle2, AlertCircle } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-schedule-styles")) {
  const style = document.createElement("style");
  style.id = "bo-schedule-styles";
  style.textContent = `
    @keyframes pageIn  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes slideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    .bo-shift-card { cursor:pointer; transition: box-shadow 0.15s, transform 0.15s; }
    .bo-shift-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.1) !important; transform: translateY(-1px); }
    .bo-shift-card.active { outline: 2px solid #6366F1; outline-offset: 1px; }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280",  label: "Draft",     dot: "#9CA3AF" },
  published: { background: "#DCFCE7", color: "#166534",  label: "Published", dot: "#22C55E" },
  completed: { background: "#DBEAFE", color: "#1E40AF",  label: "Completed", dot: "#3B82F6" },
  cancelled: { background: "#FEE2E2", color: "#991B1B",  label: "Cancelled", dot: "#EF4444" },
};

const OUTLET_COLORS = [
  { border: "#6366F1", bg: "#EEF2FF", text: "#4338CA" },
  { border: "#F59E0B", bg: "#FEF3C7", text: "#92400E" },
  { border: "#10B981", bg: "#D1FAE5", text: "#065F46" },
  { border: "#EC4899", bg: "#FCE7F3", text: "#9D174D" },
  { border: "#3B82F6", bg: "#DBEAFE", text: "#1E40AF" },
  { border: "#8B5CF6", bg: "#EDE9FE", text: "#5B21B6" },
  { border: "#F97316", bg: "#FFEDD5", text: "#9A3412" },
  { border: "#14B8A6", bg: "#CCFBF1", text: "#0F766E" },
];

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

function outletColor(outletId) { return OUTLET_COLORS[(outletId || 0) % OUTLET_COLORS.length]; }
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

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

// ── Shift Detail Panel ───────────────────────────────────────────────────────
function ShiftDetailPanel({ shift, onClose, detailRef }) {
  const [assignees, setAssignees] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const oc  = outletColor(shift.outlet_id);
  const st  = STATUS_STYLES[shift.status] || STATUS_STYLES.draft;
  const required = (shift.shift_roles || []).reduce((a, r) => a + (r.headcount || 0), 0);

  useEffect(() => {
    async function fetchAssignees() {
      setLoadingDetail(true);
      try {
        const { data } = await supabase
          .from("shift_assignments")
          .select(`
            assignment_id, status,
            staff ( staff_id, staff_type,
              users ( full_name, email )
            )
          `)
          .eq("shift_id", shift.shift_id);
        setAssignees(data || []);
      } catch (e) { console.error(e); }
      finally { setLoadingDetail(false); }
    }
    fetchAssignees();
  }, [shift.shift_id]);

  const confirmedCount = assignees.filter(a => a.status === "confirmed" || a.status === "assigned").length;
  const fillPct = required > 0 ? Math.min(100, Math.round((confirmedCount / required) * 100)) : 0;
  const fillColor = fillPct >= 100 ? "#22C55E" : fillPct >= 60 ? "#F59E0B" : "#EF4444";

  return (
    <div ref={detailRef} style={{ marginTop: "20px", background: "#FFF", border: `1.5px solid ${oc.border}`, borderRadius: "16px", overflow: "hidden", animation: "slideUp 0.22s ease", boxShadow: `0 4px 24px ${oc.border}22` }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${oc.bg}, #FFF)`, borderBottom: `1px solid ${oc.border}33`, padding: "18px 24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, borderRadius: "12px", background: oc.border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 12px ${oc.border}44` }}>
            <CalendarDays size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" }}>{shift.title || "Untitled Shift"}</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: oc.text, background: oc.bg, border: `1px solid ${oc.border}44`, padding: "2px 10px", borderRadius: "99px" }}>
                <Building2 size={11} />{shift.outlets?.name || "—"}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", fontWeight: "700", color: st.color, background: st.background, padding: "2px 10px", borderRadius: "99px" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: st.dot, display: "inline-block" }} />{st.label}
              </span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B", flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: "20px 24px", display: "flex", gap: "24px", flexWrap: "wrap" }}>

        {/* Left: shift info */}
        <div style={{ minWidth: "200px", flex: "0 0 220px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <InfoRow icon={<Clock size={14} color="#64748B" />} label="Time">
            {fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}
          </InfoRow>
          <InfoRow icon={<CalendarDays size={14} color="#64748B" />} label="Date">
            {new Date(shift.shift_date + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </InfoRow>
          <InfoRow icon={<Users size={14} color="#64748B" />} label="Staffing">
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: "700", color: fillColor }}>{confirmedCount}/{required} filled</span>
                <span style={{ fontSize: "11px", color: "#94A3B8" }}>{fillPct}%</span>
              </div>
              {required > 0 && (
                <div style={{ height: "6px", background: "#F1F5F9", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${fillPct}%`, background: fillColor, borderRadius: "3px", transition: "width 0.4s" }} />
                </div>
              )}
            </div>
          </InfoRow>
        </div>

        {/* Divider */}
        <div style={{ width: "1px", background: "#F1F5F9", flexShrink: 0 }} />

        {/* Right: staff list */}
        <div style={{ flex: 1, minWidth: "260px" }}>
          <p style={{ fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>
            Assigned Staff
          </p>
          {loadingDetail ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} h="52px" r="10px" />)}
            </div>
          ) : assignees.length === 0 ? (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "10px", padding: "14px 16px" }}>
              <AlertCircle size={16} color="#F97316" />
              <p style={{ fontSize: "13px", color: "#92400E", fontWeight: "500" }}>No staff assigned to this shift yet.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "8px" }}>
              {assignees.map(a => {
                const name = a.staff?.users?.full_name || "Unknown";
                const email = a.staff?.users?.email || "";
                const staffType = a.staff?.staff_type;
                const isConfirmed = a.status === "confirmed" || a.status === "assigned";
                return (
                  <div key={a.assignment_id} style={{ display: "flex", alignItems: "center", gap: "10px", background: isConfirmed ? "#F0FDF4" : "#F8FAFC", border: `1px solid ${isConfirmed ? "#BBF7D0" : "#E2E8F0"}`, borderRadius: "10px", padding: "10px 12px" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(name), color: "#fff", fontSize: 13, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {name[0]?.toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                        {isConfirmed && <CheckCircle2 size={12} color="#22C55E" style={{ flexShrink: 0 }} />}
                      </div>
                      <p style={{ fontSize: "11px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                      {staffType && (
                        <span style={{ fontSize: "9px", fontWeight: "600", color: staffType === "casual" ? "#6B21A8" : "#1E40AF", background: staffType === "casual" ? "#EDE9FE" : "#DBEAFE", padding: "1px 6px", borderRadius: "99px" }}>
                          {staffType === "casual" ? "Casual" : "Regular"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <div style={{ marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>{label}</p>
        <div style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{children}</div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
import FlexiblePortfolio from "./FlexiblePortfolio";

export default function ScheduleView() {
  const { schedulingMode, locationLabel } = useBusinessContext();
  if (schedulingMode === "flexible") return <FlexiblePortfolio />;
  if (schedulingMode === "appointment") { /* fall through to shift calendar view */ }
  const pageTitle = schedulingMode === "flexible" ? "Timesheets" : schedulingMode === "appointment" ? "Appointments" : "Schedule";

  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedShift, setSelectedShift] = useState(null);
  const detailRef = useRef(null);

  useEffect(() => {
    api.get("/api/business/outlets").then(r => setOutlets(r.outlets || []));
  }, []);

  useEffect(() => {
    if (outlets.length === 0) return;
    loadShifts();
  }, [outlets, selectedOutlet, weekOffset]);

  // Clear selection when week/filter changes
  useEffect(() => { setSelectedShift(null); }, [weekOffset, selectedOutlet, filterStatus]);

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
          shift_assignments ( assignment_id, status )
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

  function handleSelectShift(shift) {
    if (selectedShift?.shift_id === shift.shift_id) {
      setSelectedShift(null);
    } else {
      setSelectedShift(shift);
      setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
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
            You are viewing the schedule in read-only mode. Click any shift to see who is working.
          </p>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "6px 12px" }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={s.navBtn}><ChevronLeft size={16} /></button>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", minWidth: "220px", textAlign: "center" }}>{weekLabel}</span>
            <button onClick={() => setWeekOffset(w => w + 1)} style={s.navBtn}><ChevronRight size={16} /></button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} style={{ ...s.navBtn, fontSize: "11px", color: "#F59E0B", fontWeight: "700", padding: "2px 8px", border: "1px solid #FCD34D", borderRadius: "6px" }}>Today</button>
            )}
          </div>

          <select value={selectedOutlet} onChange={e => setSelectedOutlet(e.target.value)} style={s.select}>
            <option value="all">All {locationLabel}s</option>
            {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
          </select>

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

        {/* Outlet colour legend */}
        {outlets.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {outlets.map(o => {
              const oc = outletColor(o.outlet_id);
              return (
                <div key={o.outlet_id} style={{ display: "flex", alignItems: "center", gap: "6px", background: oc.bg, border: `1px solid ${oc.border}`, borderRadius: "99px", padding: "4px 12px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: oc.border, flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: oc.text }}>{o.name}</span>
                </div>
              );
            })}
          </div>
        )}

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
                      const oc = outletColor(shift.outlet_id);
                      const required = (shift.shift_roles || []).reduce((a, r) => a + (r.headcount || 0), 0);
                      const assigned = (shift.shift_assignments || []).length;
                      const fillPct = required > 0 ? Math.min(100, Math.round((assigned / required) * 100)) : 0;
                      const fillColor = fillPct >= 100 ? "#22C55E" : fillPct >= 60 ? "#F59E0B" : "#EF4444";
                      const isActive = selectedShift?.shift_id === shift.shift_id;
                      return (
                        <div key={shift.shift_id}
                          className={`bo-shift-card${isActive ? " active" : ""}`}
                          onClick={() => handleSelectShift(shift)}
                          style={{ ...s.shiftCard, borderLeft: `3px solid ${oc.border}`, background: isActive ? oc.bg : "#F8FAFC" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
                            <p style={{ fontSize: "12px", fontWeight: "700", color: "#1E293B", lineHeight: 1.3 }}>{shift.title || "Untitled"}</p>
                            <span style={{ ...st, padding: "1px 6px", borderRadius: "99px", fontSize: "10px", fontWeight: "700", flexShrink: 0, marginLeft: "4px" }}>{st.label}</span>
                          </div>
                          <p style={{ fontSize: "11px", color: "#64748B", marginBottom: "5px" }}>{fmtTime(shift.start_time)} – {fmtTime(shift.end_time)}</p>
                          {shift.outlets?.name && (
                            <span style={{ display: "inline-block", fontSize: "10px", fontWeight: "700", color: oc.text, background: isActive ? "#fff" : oc.bg, padding: "1px 7px", borderRadius: "99px", marginBottom: "5px" }}>
                              {shift.outlets.name}
                            </span>
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

        {/* Shift detail panel */}
        {selectedShift && (
          <ShiftDetailPanel
            shift={selectedShift}
            onClose={() => setSelectedShift(null)}
            detailRef={detailRef}
          />
        )}
      </div>
    </BusinessOwnerLayout>
  );
}

const s = {
  navBtn:  { background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", color: "#475569", padding: "2px" },
  select:  { padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", fontWeight: "500", color: "#1E293B", background: "#FFF", cursor: "pointer" },
  statPill:{ display: "flex", alignItems: "center", gap: "6px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "9px", padding: "6px 14px", fontSize: "13px" },
  grid:    { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "8px", minHeight: "500px" },
  dayCol:  { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", display: "flex", flexDirection: "column", minHeight: "500px", overflow: "hidden" },
  dayColToday:   { border: "1.5px solid #BFDBFE", background: "#FAFEFF" },
  dayHeader:     { padding: "10px 8px 8px", borderBottom: "1px solid #F1F5F9", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" },
  dayHeaderToday:{ background: "#EFF6FF", borderBottom: "1px solid #BFDBFE" },
  shiftCard:     { border: "1px solid #E2E8F0", borderRadius: "8px", padding: "8px 10px" },
};
