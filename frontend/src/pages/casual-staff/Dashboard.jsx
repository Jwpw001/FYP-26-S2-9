import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { useNavigate } from "react-router-dom";

if (typeof document !== "undefined" && !document.getElementById("casual-dash-styles")) {
  const style = document.createElement("style");
  style.id = "casual-dash-styles";
  style.textContent = `
    @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const DAY_LABELS = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
const DAY_SHORT  = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export default function CasualDashboard() {
  const user      = getUser();
  const userId    = user?.user_id;
  const navigate  = useNavigate();

  const [loading,        setLoading]        = useState(true);
  const [staffRecord,    setStaffRecord]    = useState(null);
  const [upcomingShifts, setUpcomingShifts] = useState([]);
  const [avail,          setAvail]          = useState([]);   // deduped, for week panel
  const [rawAvail,       setRawAvail]       = useState([]);   // all rows, for calendar dates
  const [monthShifts,    setMonthShifts]    = useState([]);
  const [selectedDate,   setSelectedDate]   = useState(new Date().getDate());

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const today = now.toISOString().slice(0, 10);
      const { data: staffData } = await supabase
        .from("staff").select("staff_id, is_active, branch_id, branches(name, address)")
        .eq("user_id", userId).maybeSingle();
      if (cancelled) return;
      setStaffRecord(staffData || null);

      if (staffData?.staff_id) {
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        const [{ data: shifts }, { data: availRows }, { data: allMonthShifts }] = await Promise.all([
          supabase.from("task_assignments").select(`
            assignment_id, acknowledged,
            shifts!inner(shift_id, title, shift_date, start_time, end_time, branches(name))
          `).eq("staff_id", staffData.staff_id).gte("shifts.shift_date", today)
            .order("shifts.shift_date", { referencedTable: "shifts", ascending: true }).limit(5),
          supabase.from("casual_availability")
            .select("day_of_week, available_from, available_to, week_start_date")
            .eq("staff_id", staffData.staff_id)
            .gte("week_start_date", new Date(now.getFullYear(), now.getMonth(), -6).toISOString().slice(0, 10))
            .lte("week_start_date", monthEnd)
            .order("week_start_date", { ascending: false }),
          supabase.from("task_assignments").select(`
            assignment_id, acknowledged,
            shifts!inner(shift_id, title, shift_date, start_time, end_time)
          `).eq("staff_id", staffData.staff_id)
            .gte("shifts.shift_date", monthStart)
            .lte("shifts.shift_date", monthEnd),
        ]);
        if (!cancelled) {
          setUpcomingShifts((shifts || []).filter(a => a.shifts));
          setMonthShifts((allMonthShifts || []).filter(a => a.shifts));
          setRawAvail(availRows || []);

          // Deduped (latest per day_of_week) for the week panel time ranges
          const seen = new Set();
          const deduped = (availRows || []).filter(r => {
            if (seen.has(r.day_of_week)) return false;
            seen.add(r.day_of_week);
            return true;
          });
          setAvail(deduped);
        }
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const isActive    = staffRecord?.is_active === true;
  const branchName  = staffRecord?.branches?.name || null;
  const branchAddr  = staffRecord?.branches?.address || null;

  // Build calendar cells
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build availDates: map actual date strings from (week_start_date + day_of_week)
  const availDates = new Set();
  const availByDate = {};
  rawAvail.forEach(r => {
    if (!r.week_start_date) return;
    const [wy, wm, wd] = r.week_start_date.split("-").map(Number);
    const d = new Date(Date.UTC(wy, wm - 1, wd + r.day_of_week));
    const dateStr = d.toISOString().slice(0, 10);
    availDates.add(dateStr);
    availByDate[dateStr] = r;
  });

  // Map date string → assignments (with acknowledged) for that date
  const shiftsOnDate = {};
  monthShifts.forEach(a => {
    const dateStr = a.shifts.shift_date?.slice(0, 10);
    if (!dateStr) return;
    if (!shiftsOnDate[dateStr]) shiftsOnDate[dateStr] = [];
    shiftsOnDate[dateStr].push({ ...a.shifts, acknowledged: a.acknowledged });
  });

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push({ blank: true });
  for (let d = 1; d <= daysInMonth; d++) {
    const dow     = (new Date(year, month, d).getDay() + 6) % 7;
    const isToday = d === now.getDate();
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hasAvail = availDates.has(dateStr);
    const dayShifts = shiftsOnDate[dateStr] || [];
    const hasShift  = dayShifts.length > 0;
    const hasUnacked = hasShift && dayShifts.some(s => s.acknowledged === false);
    cells.push({ date: d, dow, isToday, hasAvail, hasShift, hasUnacked, dayShifts, dateStr });
  }

  // Selected date info
  const selCell    = cells.find(c => !c.blank && c.date === selectedDate);
  const selShifts  = selCell?.dayShifts || [];
  const selLabel   = `${monthLabel.split(" ")[0]} ${selectedDate}`;
  const selAvailRow = selCell ? availByDate[selCell.dateStr] : null;
  const selInfo    = selAvailRow
    ? `Available ${selAvailRow.available_from?.slice(0,5)} – ${selAvailRow.available_to?.slice(0,5)}`
    : "No availability submitted for this day";

  // This week's hours — only rows matching this week's Monday
  const todayDow = (now.getDay() + 6) % 7;
  const thisWeekMonday = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() - todayDow));
  const thisWeekMondayStr = thisWeekMonday.toISOString().slice(0, 10);
  const thisWeekAvail = rawAvail.filter(r => r.week_start_date === thisWeekMondayStr);
  const weekSlots = DAY_SHORT.map((d, i) => {
    const a = thisWeekAvail.find(r => r.day_of_week === i);
    return { day: d, set: !!a, hours: a ? `${a.available_from?.slice(0,5)} – ${a.available_to?.slice(0,5)}` : null };
  });

  // Total hours this week
  const totalHours = avail.reduce((acc, a) => {
    if (!a.available_from || !a.available_to) return acc;
    const [sh, sm] = a.available_from.split(":").map(Number);
    const [eh, em] = a.available_to.split(":").map(Number);
    return acc + (eh + em / 60 - sh - sm / 60);
  }, 0);

  return (
    <CasualLayout title="Dashboard">
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", animation: "fadeUp .4s ease both" }}>

        {/* Greeting + status pills */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
              Good {getGreeting()}, {user?.full_name?.split(" ")[0] || "there"}
            </h2>
            <p style={{ fontSize: "20px", color: "#64748B", margin: 0 }}>Casual worker{branchName ? ` · ${branchName}` : ""}</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "19px", fontWeight: "700", color: isActive ? "#16A34A" : "#DC2626", background: isActive ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${isActive ? "#BBF7D0" : "#FECACA"}`, padding: "6px 12px", borderRadius: "100px" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: isActive ? "#16A34A" : "#DC2626" }} />
              {isActive ? "Active" : "Inactive"}
            </span>
            {!loading && upcomingShifts.length > 0 && (
              <span style={{ fontSize: "19px", fontWeight: "700", color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "6px 12px", borderRadius: "100px" }}>
                {upcomingShifts.length} Upcoming Gig{upcomingShifts.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Calendar + This Week's Hours */}
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "18px" }}>

          {/* Monthly availability calendar */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
              <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{monthLabel}</h3>
              <div style={{ display: "flex", gap: "10px", fontSize: "18px", color: "#64748B", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#DCFCE7", border: "1.5px solid #86EFAC", display: "inline-block" }} />
                  Available
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#DBEAFE", border: "1.5px solid #93C5FD", display: "inline-block" }} />
                  Shift assigned
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#FEF9C3", border: "1.5px solid #FDE047", display: "inline-block" }} />
                  Action needed
                </span>
              </div>
            </div>
            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px", marginBottom: "6px" }}>
              {DAY_LABELS.map(d => <span key={d} style={{ fontSize: "17px", fontWeight: "700", color: "#94A3B8", textAlign: "center" }}>{d}</span>)}
            </div>
            {/* Calendar cells */}
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                {Array.from({ length: 35 }).map((_, i) => <Shimmer key={i} h="34px" r="9px" />)}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "6px" }}>
                {cells.map((c, i) => {
                  if (c.blank) return <div key={i} />;
                  const isSel = c.date === selectedDate;
                  // Color priority: shift (blue) > available (green) > today > empty
                  const bg     = isSel ? (c.hasShift ? "#BFDBFE" : "#BBF7D0")
                               : c.hasShift  ? "#DBEAFE"
                               : c.hasAvail  ? "#DCFCE7"
                               : c.isToday   ? "#EFF6FF"
                               : "#F8FAFC";
                  const border = isSel ? (c.hasShift ? "#3B82F6" : "#16A34A")
                               : c.hasShift  ? "#93C5FD"
                               : c.hasAvail  ? "#86EFAC"
                               : c.isToday   ? "#93C5FD"
                               : "#F1F5F9";
                  const color  = c.hasShift  ? "#1D4ED8"
                               : c.hasAvail  ? "#166534"
                               : c.isToday   ? "#2563EB"
                               : "#94A3B8";
                  return (
                    <div key={i} onClick={() => setSelectedDate(c.date)}
                      style={{ minHeight: "42px", borderRadius: "9px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", padding: "5px 3px 4px", fontSize: "19px", fontWeight: c.isToday ? 800 : 600, cursor: "pointer", position: "relative", color, background: bg, border: `1.5px solid ${border}` }}>
                      <span>{c.date}</span>
                      {c.hasShift && (
                        <div style={{ display: "flex", gap: "2px", marginTop: "3px", justifyContent: "center", flexWrap: "wrap" }}>
                          {c.dayShifts.slice(0, 2).map((_, si) => (
                            <span key={si} style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
                          ))}
                          {c.dayShifts.length > 2 && (
                            <span style={{ fontSize: "15px", fontWeight: "700", color: "#2563EB", lineHeight: "5px" }}>+{c.dayShifts.length - 2}</span>
                          )}
                        </div>
                      )}
                      {c.hasUnacked && (
                        <span style={{ position: "absolute", top: "3px", right: "4px", width: "7px", height: "7px", borderRadius: "50%", background: "#EAB308", border: "1.5px solid #fff", flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Selected info */}
            <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
              <div style={{ fontSize: "19px", fontWeight: "700", color: "#94A3B8", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{selLabel}</div>
              {selShifts.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "8px" }}>
                  {selShifts.map((sh, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 10px", borderRadius: "8px", background: "#EFF6FF", border: "1px solid #BFDBFE" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#2563EB", flexShrink: 0 }} />
                      <span style={{ fontSize: "19.5px", fontWeight: "700", color: "#1E293B", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.title || "Shift"}</span>
                      <span style={{ fontSize: "18.5px", color: "#3B82F6", fontWeight: "600", flexShrink: 0 }}>{sh.start_time?.slice(0,5)} – {sh.end_time?.slice(0,5)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ fontSize: "19.5px", color: "#475569" }}>{selInfo}</div>
            </div>
          </div>

          {/* This Week's Hours */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: "0 0 14px" }}>This Week's Hours</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} h="40px" r="9px" />)}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {weekSlots.map((w, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "9px", background: w.set ? "#EFF6FF" : "#FAFAFA", border: `1px solid ${w.set ? "#BFDBFE" : "#F1F5F9"}` }}>
                    <span style={{ width: "30px", fontSize: "19px", fontWeight: "700", color: w.set ? "#1E40AF" : "#94A3B8" }}>{w.day}</span>
                    {w.set ? (
                      <span style={{ fontSize: "19.5px", fontWeight: "500", color: "#1E293B" }}>{w.hours}</span>
                    ) : (
                      <span style={{ fontSize: "19px", color: "#CBD5E1" }}>Not available</span>
                    )}
                    {w.set && <span style={{ marginLeft: "auto", width: "7px", height: "7px", borderRadius: "50%", background: "#22C55E", flexShrink: 0 }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Gigs + Branch card */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>

          {/* Upcoming Gigs */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: "0 0 14px" }}>Upcoming Gigs</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="64px" r="10px" />)}
              </div>
            ) : upcomingShifts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.5" style={{ display: "block", margin: "0 auto 10px" }}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                <p style={{ fontSize: "20px", color: "#94A3B8", margin: 0 }}>No upcoming gigs yet.</p>
                <p style={{ fontSize: "19px", color: "#CBD5E1", marginTop: "4px" }}>Your manager will assign you shifts soon.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {upcomingShifts.map((a, i) => {
                  const sh = a.shifts;
                  const d = new Date(sh.shift_date + "T12:00:00Z");
                  return (
                    <div key={a.assignment_id} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "11px 14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "9px", background: "#DCFCE7", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <span style={{ fontSize: "17px", fontWeight: "800", color: "#16A34A", lineHeight: 1 }}>{d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                        <span style={{ fontSize: "22px", fontWeight: "800", color: "#166534", lineHeight: 1 }}>{d.getUTCDate()}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: "20px", fontWeight: "600", color: "#1E293B", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sh.title || "Shift"}</p>
                        <p style={{ fontSize: "18.5px", color: "#94A3B8", margin: "1px 0 0" }}>{sh.start_time?.slice(0,5)} – {sh.end_time?.slice(0,5)}</p>
                      </div>
                      {!a.acknowledged && (
                        <span style={{ fontSize: "16px", fontWeight: "700", color: "#D97706", background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: "5px", padding: "2px 6px", flexShrink: 0 }}>NEW</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Branch card */}
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px" }}>
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", margin: "0 0 14px" }}>Branch</h3>
            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", gap: "14px" }}><Shimmer w="46px" h="46px" r="11px" /><div style={{ flex: 1 }}><Shimmer w="60%" h="16px" r="5px" /><div style={{ marginTop: "6px" }}><Shimmer w="80%" h="12px" r="5px" /></div></div></div>
              </div>
            ) : staffRecord ? (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
                  <div style={{ width: "46px", height: "46px", borderRadius: "11px", background: "#EFF6FF", color: "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div>
                    <p style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", margin: 0 }}>{branchName || "No branch assigned"}</p>
                    {branchAddr && <p style={{ fontSize: "19px", color: "#94A3B8", margin: "2px 0 0" }}>{branchAddr}</p>}
                  </div>
                </div>
                <button onClick={() => navigate("/casual-staff/availability")}
                  style={{ width: "100%", background: "#16A34A", color: "#fff", border: "none", borderRadius: "9px", padding: "11px", fontSize: "20px", fontWeight: "700", cursor: "pointer" }}>
                  Update Availability
                </button>
              </>
            ) : (
              <p style={{ fontSize: "20px", color: "#94A3B8", textAlign: "center", padding: "20px 0", margin: 0 }}>No branch assigned yet.</p>
            )}
          </div>
        </div>

      </div>
    </CasualLayout>
  );
}
