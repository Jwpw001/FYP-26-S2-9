import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";
import { Check, X, Calendar } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-avail-styles")) {
  const style = document.createElement("style");
  style.id = "casual-avail-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .avail-day-card { transition: box-shadow 0.18s, transform 0.18s; }
    .avail-day-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.10) !important; }
    .avail-day-card-active:hover { box-shadow: 0 8px 24px rgba(34,197,94,0.35) !important; }
    .avail-time:focus { outline:none; border-color:#2563EB !important; box-shadow:0 0 0 3px rgba(37,99,235,0.12); }
    .week-btn:hover:not(:disabled) { background:#EFF6FF !important; border-color:#BFDBFE !important; color:#1D4ED8 !important; }
    .action-btn:hover { background:#F1F5F9 !important; }
    .save-btn:hover:not(:disabled) { background:#1D4ED8 !important; transform:translateY(-1px); box-shadow:0 6px 20px rgba(37,99,235,0.4) !important; }
  `;
  document.head.appendChild(style);
}

const DAYS = [
  { full: "Monday",    short: "Mon" },
  { full: "Tuesday",   short: "Tue" },
  { full: "Wednesday", short: "Wed" },
  { full: "Thursday",  short: "Thu" },
  { full: "Friday",    short: "Fri" },
  { full: "Saturday",  short: "Sat" },
  { full: "Sunday",    short: "Sun" },
];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const DAY_NUMS = [1, 2, 3, 4, 5, 6, 0];

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

function getDayDate(weekStart, dayOffset) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  return { date: d.getDate(), month: MONTHS[d.getMonth()] };
}

function fmtWeekRange(weekStart) {
  const s = new Date(weekStart);
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-SG", opts)} – ${e.toLocaleDateString("en-SG", opts)}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function WeeklyAvailability() {
  const user   = getUser();
  const userId = user?.user_id;

  const [weekOffset, setWeekOffset] = useState(1);
  const weekStart = getWeekStart(weekOffset);

  const [slots, setSlots]       = useState({});
  const [existing, setExisting] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [staffId, setStaffId]   = useState(null);
  const [outletHours, setOutletHours] = useState({ open: null, close: null });
  const [showOverwrite, setShowOverwrite] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [lastSaved, setLastSaved] = useState(null); // { weekStart, entries: [{day, from, to}] }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data: myStaff } = await supabase
        .from("staff").select("staff_id, outlet_id").eq("user_id", userId).limit(1);
      const sid = myStaff?.[0]?.staff_id;
      const outletId = myStaff?.[0]?.outlet_id;
      if (cancelled) return;
      setStaffId(sid || null);
      if (!sid) { setExisting([]); setSlots({}); setLoading(false); return; }

      if (outletId) {
        const { data: outlet } = await supabase
          .from("outlets").select("open_time, close_time").eq("outlet_id", outletId).maybeSingle();
        if (!cancelled && outlet) {
          setOutletHours({ open: outlet.open_time?.slice(0, 5) || null, close: outlet.close_time?.slice(0, 5) || null });
        }
      }

      const { data } = await supabase
        .from("casual_availability")
        .select("availability_id, day_of_week, available_from, available_to, week_start_date")
        .eq("staff_id", sid).eq("week_start_date", weekStart);

      if (!cancelled) {
        setExisting(data || []);
        const filled = {};
        (data || []).forEach(row => {
          const idx = DAY_NUMS.indexOf(row.day_of_week);
          if (idx >= 0) filled[idx] = { enabled: true, from: row.available_from?.slice(0,5) || "09:00", to: row.available_to?.slice(0,5) || "18:00" };
        });
        setSlots(filled);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, weekStart]);

  function toggleDay(idx) {
    if (isPast) return;
    setSlots(prev => {
      if (prev[idx]?.enabled) { const next = { ...prev }; delete next[idx]; return next; }
      return { ...prev, [idx]: { enabled: true, from: outletHours.open || "09:00", to: outletHours.close || "18:00" } };
    });
  }

  function updateSlot(idx, field, val) {
    setSlots(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: val } }));
  }

  function validateSlots() {
    for (const [idx, slot] of Object.entries(slots)) {
      if (!slot.enabled) continue;
      if (slot.from >= slot.to) {
        showToast(`${DAYS[Number(idx)].full}: end time must be after start time.`, "error"); return false;
      }
      if (outletHours.open && slot.from < outletHours.open) {
        showToast(`${DAYS[Number(idx)].full}: start time cannot be before outlet opens (${fmtTime(outletHours.open)}).`, "error"); return false;
      }
      if (outletHours.close && slot.to > outletHours.close) {
        showToast(`${DAYS[Number(idx)].full}: end time cannot be after outlet closes (${fmtTime(outletHours.close)}).`, "error"); return false;
      }
    }
    return true;
  }

  async function doSave() {
    if (!staffId) { showToast("No staff record found.", "error"); return; }
    setSaving(true);
    try {
      await supabase.from("casual_availability").delete().eq("staff_id", staffId).eq("week_start_date", weekStart);
      const toInsert = Object.entries(slots).filter(([, v]) => v.enabled).map(([idx, v]) => ({
        staff_id: staffId, week_start_date: weekStart,
        day_of_week: DAY_NUMS[Number(idx)],
        available_from: v.from + ":00", available_to: v.to + ":00",
      }));
      if (toInsert.length > 0) {
        const { error: err } = await supabase.from("casual_availability").insert(toInsert);
        if (err) throw err;
      }
      setExisting(toInsert.map(r => ({ ...r })));
      setLastSaved({
        weekStart,
        entries: Object.entries(slots).filter(([, v]) => v.enabled).map(([idx, v]) => ({
          day: DAYS[Number(idx)].full, from: v.from, to: v.to,
        })),
      });
      showToast(`Availability saved for ${fmtWeekRange(weekStart)}!`);
    } catch { showToast("Failed to save. Please try again.", "error"); }
    finally { setSaving(false); setPendingSave(false); }
  }

  async function handleSave() {
    if (!staffId) { showToast("No staff record found.", "error"); return; }
    if (!validateSlots()) return;
    // If already submitted for this week, ask to overwrite
    if (existing.length > 0) { setShowOverwrite(true); return; }
    doSave();
  }

  const isPast = weekOffset <= 0;
  const enabledCount = Object.values(slots).filter(v => v.enabled).length;
  const weekLabel = weekOffset === 1 ? "Next week" : `${weekOffset} weeks ahead`;

  return (
    <CasualLayout title="Weekly Availability">
      <div style={{ animation: "pageIn 0.4s ease both", height: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── Top row: header + week nav ── */}
        <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <h2 style={{ fontSize: "24px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.02em", margin: 0 }}>My Availability</h2>
            <p style={{ fontSize: "14px", color: "#64748B", marginTop: "4px" }}>Tap a day to mark yourself as available, then set your hours.</p>
          </div>

          {/* Week navigator inline */}
          <div style={{ display: "flex", alignItems: "center", gap: "0", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "6px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <button className="week-btn" onClick={() => setWeekOffset(p => p - 1)} disabled={weekOffset <= 1}
              style={{ width: "36px", height: "36px", borderRadius: "9px", border: "none", background: "transparent", fontSize: "20px", cursor: weekOffset <= 1 ? "not-allowed" : "pointer", color: weekOffset <= 1 ? "#CBD5E1" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              ‹
            </button>
            <div style={{ textAlign: "center", padding: "0 16px", minWidth: "200px" }}>
              <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", margin: 0 }}>{fmtWeekRange(weekStart)}</p>
              {weekOffset === 1 && <span style={{ fontSize: "11px", fontWeight: "700", color: "#0D9488", background: "#F0FDFA", padding: "1px 8px", borderRadius: "100px" }}>Next week</span>}
              {weekOffset > 1  && <span style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6", background: "#EFF6FF", padding: "1px 8px", borderRadius: "100px" }}>{weekLabel}</span>}
            </div>
            <button className="week-btn" onClick={() => setWeekOffset(p => p + 1)} disabled={weekOffset >= 4}
              style={{ width: "36px", height: "36px", borderRadius: "9px", border: "none", background: "transparent", fontSize: "20px", cursor: weekOffset >= 4 ? "not-allowed" : "pointer", color: weekOffset >= 4 ? "#CBD5E1" : "#64748B", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              ›
            </button>
          </div>
        </div>

        {/* ── Main two-column layout ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: "20px", flex: 1, alignItems: "start" }}>

          {/* Left column: progress + cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* Progress */}
            {!loading && (
              <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>Days selected</span>
                    <span style={{ fontSize: "14px", fontWeight: "800", color: enabledCount > 0 ? "#16A34A" : "#94A3B8" }}>{enabledCount} / 7</span>
                  </div>
                  <div style={{ height: "8px", borderRadius: "100px", background: "#F1F5F9", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(enabledCount / 7) * 100}%`, background: enabledCount === 7 ? "#16A34A" : enabledCount > 0 ? "#22C55E" : "#E2E8F0", borderRadius: "100px", transition: "width 0.4s ease" }} />
                  </div>
                </div>
                {!isPast && (
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button className="action-btn" onClick={() => {
                      const all = {};
                      DAYS.forEach((_, i) => { all[i] = slots[i]?.enabled ? slots[i] : { enabled: true, from: outletHours.open || "09:00", to: outletHours.close || "18:00" }; });
                      setSlots(all);
                    }} style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", cursor: "pointer", transition: "background 0.15s" }}>
                      All
                    </button>
                    <button className="action-btn" onClick={() => setSlots({})}
                      style={{ padding: "7px 14px", borderRadius: "8px", fontSize: "12px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", cursor: "pointer", transition: "background 0.15s" }}>
                      Clear
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Operating hours hint */}
            {!loading && outletHours.open && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", color: "#1D4ED8" }}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span>Outlet operating hours: <strong>{fmtTime(outletHours.open)} – {fmtTime(outletHours.close)}</strong>. Your availability must be within this range.</span>
              </div>
            )}

            {/* Day cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "0" }}>
              {loading
                ? Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} style={{ borderRadius: "16px", border: "1.5px solid #E2E8F0", background: "#FFF", padding: "20px 8px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <Shimmer w="28px" h="11px" r="4px" />
                      <Shimmer w="32px" h="28px" r="6px" />
                      <Shimmer w="24px" h="24px" r="50%" />
                    </div>
                  ))
                : DAYS.map(({ short }, i) => {
                    const slot = slots[i];
                    const isAvail = !!slot?.enabled;
                    const { date } = getDayDate(weekStart, i);
                    return (
                      <div key={i}
                        className={`avail-day-card${isAvail ? " avail-day-card-active" : ""}`}
                        onClick={() => toggleDay(i)}
                        style={{
                          background: isAvail ? "linear-gradient(145deg, #22C55E, #16A34A)" : "#FFF",
                          border: `1.5px solid ${isAvail ? "#16A34A" : "#E2E8F0"}`,
                          borderRadius: "16px",
                          cursor: isPast ? "default" : "pointer",
                          boxShadow: isAvail ? "0 4px 14px rgba(34,197,94,0.3)" : "0 1px 3px rgba(0,0,0,0.05)",
                          animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`,
                          userSelect: "none",
                          display: "flex", flexDirection: "column", alignItems: "center",
                          padding: "18px 8px 16px", gap: "6px",
                        }}>
                        <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.08em", color: isAvail ? "rgba(255,255,255,0.75)" : "#94A3B8" }}>
                          {short}
                        </span>
                        <span style={{ fontSize: "24px", fontWeight: "800", lineHeight: 1, color: isAvail ? "#FFF" : "#1E293B" }}>
                          {date}
                        </span>
                        <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: isAvail ? "rgba(255,255,255,0.22)" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px", transition: "background 0.2s" }}>
                          {isAvail
                            ? <Check size={13} color="#FFF" strokeWidth={3} />
                            : <span style={{ fontSize: "14px", color: "#CBD5E1" }}>–</span>
                          }
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* Submission summary — below the calendar */}
            {lastSaved && lastSaved.weekStart === weekStart && (
              <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: "14px", padding: "16px 18px", animation: "fadeSlideUp 0.3s ease both" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <svg width="16" height="16" fill="none" stroke="#16A34A" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#15803D", margin: 0 }}>Submitted for {fmtWeekRange(lastSaved.weekStart)}</p>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {lastSaved.entries.map(e => (
                    <div key={e.day} style={{ background: "#DCFCE7", border: "1px solid #86EFAC", borderRadius: "8px", padding: "6px 12px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803D" }}>{e.day.slice(0,3)}</span>
                      <span style={{ fontSize: "11px", color: "#166534", marginLeft: "6px" }}>{fmtTime(e.from)} – {fmtTime(e.to)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column: Set Hours + Save */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Panel header */}
              <div style={{ padding: "16px 20px", borderBottom: "1px solid #F1F5F9", background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)", display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E" }} />
                <p style={{ fontSize: "13px", fontWeight: "700", color: "#F8FAFC", textTransform: "uppercase", letterSpacing: "0.06em" }}>Set Hours</p>
                {enabledCount > 0 && (
                  <span style={{ marginLeft: "auto", background: "rgba(34,197,94,0.2)", color: "#4ADE80", fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px", border: "1px solid rgba(34,197,94,0.3)" }}>
                    {enabledCount} day{enabledCount !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {/* Time rows */}
              {loading ? (
                <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  {[1,2].map(i => <Shimmer key={i} w="100%" h="48px" r="10px" />)}
                </div>
              ) : enabledCount === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center" }}>
                  <div style={{ marginBottom: "10px" }}><Calendar size={32} color="#94A3B8" /></div>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>No days selected</p>
                  <p style={{ fontSize: "12px", color: "#CBD5E1", marginTop: "4px" }}>Tap a day card to get started</p>
                </div>
              ) : (
                <div>
                  {DAYS.map((day, i) => {
                    const slot = slots[i];
                    if (!slot?.enabled) return null;
                    const timeError = slot.from >= slot.to;
                    const { date, month } = getDayDate(weekStart, i);
                    return (
                      <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid #F8FAFC", display: "flex", flexDirection: "column", gap: "10px", animation: "fadeSlideUp 0.25s ease both" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{day.full}</p>
                            <p style={{ fontSize: "11px", color: "#94A3B8" }}>{date} {month}</p>
                          </div>
                          {timeError && <span style={{ fontSize: "11px", color: "#DC2626", fontWeight: "600", background: "#FFF1F2", padding: "2px 8px", borderRadius: "6px" }}>Invalid range</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <input type="time" className="avail-time" value={slot.from}
                            onChange={e => updateSlot(i, "from", e.target.value)}
                            min={outletHours.open || undefined}
                            max={outletHours.close || undefined}
                            disabled={isPast}
                            style={{ flex: 1, padding: "8px 10px", border: `1.5px solid ${timeError ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: "#1E293B", background: "#F8FAFC", cursor: isPast ? "not-allowed" : "text", transition: "border-color 0.15s" }} />
                          <span style={{ fontSize: "11px", color: "#94A3B8", fontWeight: "600", flexShrink: 0 }}>to</span>
                          <input type="time" className="avail-time" value={slot.to}
                            onChange={e => updateSlot(i, "to", e.target.value)}
                            min={outletHours.open || undefined}
                            max={outletHours.close || undefined}
                            disabled={isPast}
                            style={{ flex: 1, padding: "8px 10px", border: `1.5px solid ${timeError ? "#FCA5A5" : "#E2E8F0"}`, borderRadius: "10px", fontSize: "13px", fontWeight: "600", color: timeError ? "#DC2626" : "#1E293B", background: timeError ? "#FFF1F2" : "#F8FAFC", cursor: isPast ? "not-allowed" : "text", transition: "border-color 0.15s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Save button */}
            {!isPast && !loading && (
              <button className="save-btn" onClick={handleSave}
                disabled={saving || enabledCount === 0}
                style={{ width: "100%", padding: "14px", borderRadius: "12px", fontSize: "15px", fontWeight: "700", border: "none", background: saving || enabledCount === 0 ? "#CBD5E1" : "#2563EB", color: "#FFF", cursor: saving || enabledCount === 0 ? "not-allowed" : "pointer", boxShadow: enabledCount > 0 ? "0 4px 16px rgba(37,99,235,0.3)" : "none", transition: "all 0.18s" }}>
                {saving ? "Saving…" : enabledCount === 0 ? "Select days to save" : `Save Availability — ${enabledCount} day${enabledCount !== 1 ? "s" : ""}`}
              </button>
            )}

          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#FFF", padding: "13px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both", display: "flex", alignItems: "center", gap: "8px" }}>
          {toast.type === "success" ? <Check size={16} /> : <X size={16} />} {toast.msg}
        </div>
      )}

      {showOverwrite && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, background: "rgba(15,23,42,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "32px", maxWidth: "420px", width: "90%", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "fadeSlideUp 0.25s ease both" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
              <svg width="22" height="22" fill="none" stroke="#D97706" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", margin: "0 0 8px" }}>Overwrite availability?</h3>
            <p style={{ fontSize: "14px", color: "#64748B", lineHeight: 1.6, margin: "0 0 24px" }}>
              You've already submitted availability for <strong>{fmtWeekRange(weekStart)}</strong>. Saving again will replace your previous submission.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowOverwrite(false)}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#FFF", fontSize: "14px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={() => { setShowOverwrite(false); doSave(); }}
                style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "#2563EB", fontSize: "14px", fontWeight: "700", color: "#FFF", cursor: "pointer" }}>
                Yes, overwrite
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </CasualLayout>
  );
}
