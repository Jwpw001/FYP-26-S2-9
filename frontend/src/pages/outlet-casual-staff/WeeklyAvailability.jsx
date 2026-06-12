import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

if (typeof document !== "undefined" && !document.getElementById("casual-avail-styles")) {
  const style = document.createElement("style");
  style.id = "casual-avail-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .avail-row { transition: background 0.15s; }
    .avail-row:hover { background: #F8FAFC !important; }
    .avail-toggle-on  { background: #2563EB !important; color: #fff !important; border-color: #2563EB !important; }
    .avail-toggle-off { background: #F1F5F9 !important; color: #64748B !important; border-color: #E2E8F0 !important; }
    .avail-time-input:focus { outline: none; border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); }
    .week-nav-btn:hover:not(:disabled) { background: #DBEAFE !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

const DAYS = [
  { short: "Mon", full: "Monday" },
  { short: "Tue", full: "Tuesday" },
  { short: "Wed", full: "Wednesday" },
  { short: "Thu", full: "Thursday" },
  { short: "Fri", full: "Friday" },
  { short: "Sat", full: "Saturday" },
  { short: "Sun", full: "Sunday" },
];
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
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function fmtWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end   = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-SG", opts)} – ${end.toLocaleDateString("en-SG", opts)}`;
}

export default function WeeklyAvailability() {
  const user = getUser();
  const userId = user?.user_id;

  const [weekOffset, setWeekOffset] = useState(1);
  const weekStart = getWeekStart(weekOffset);

  const [slots, setSlots]       = useState({});
  const [existing, setExisting] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [staffId, setStaffId]   = useState(null);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      const { data: myStaff } = await supabase
        .from("staff").select("staff_id")
        .eq("user_id", userId).limit(1);
      const sid = myStaff?.[0]?.staff_id;
      if (cancelled) return;
      setStaffId(sid || null);
      if (!sid) { setExisting([]); setSlots({}); setLoading(false); return; }

      const { data } = await supabase
        .from("casual_availability")
        .select("availability_id, day_of_week, available_from, available_to, week_start_date")
        .eq("staff_id", sid)
        .eq("week_start_date", weekStart);

      if (!cancelled) {
        setExisting(data || []);
        const filled = {};
        (data || []).forEach(row => {
          const idx = DAY_NUMS.indexOf(row.day_of_week);
          if (idx >= 0) filled[idx] = {
            enabled: true,
            from: row.available_from?.slice(0, 5) || "09:00",
            to:   row.available_to?.slice(0, 5)   || "18:00",
          };
        });
        setSlots(filled);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId, weekStart]);

  function toggleDay(idx) {
    setSlots(prev => {
      if (prev[idx]?.enabled) {
        const next = { ...prev };
        delete next[idx];
        return next;
      }
      return { ...prev, [idx]: { enabled: true, from: "09:00", to: "18:00" } };
    });
  }

  function updateSlot(idx, field, val) {
    setSlots(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: val } }));
  }

  async function handleSave() {
    if (!staffId) { showToast("No staff record found.", "error"); return; }

    // Validate times
    for (const [idx, slot] of Object.entries(slots)) {
      if (slot.enabled && slot.from >= slot.to) {
        showToast(`${DAYS[Number(idx)].full}: end time must be after start time.`, "error");
        return;
      }
    }

    setSaving(true);
    try {
      if (existing.length > 0) {
        await supabase.from("casual_availability")
          .delete().eq("staff_id", staffId).eq("week_start_date", weekStart);
      }
      const toInsert = Object.entries(slots)
        .filter(([, v]) => v.enabled)
        .map(([idx, v]) => ({
          staff_id: staffId,
          week_start_date: weekStart,
          day_of_week: DAY_NUMS[Number(idx)],
          available_from: v.from + ":00",
          available_to:   v.to   + ":00",
        }));

      if (toInsert.length > 0) {
        const { error: err } = await supabase.from("casual_availability").insert(toInsert);
        if (err) throw err;
      }
      setExisting(toInsert);
      showToast(`Availability saved for ${fmtWeekRange(weekStart)}.`);
    } catch (err) {
      showToast("Failed to save. Please try again.", "error");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const isPast = weekOffset <= 0;
  const enabledCount = Object.values(slots).filter(v => v.enabled).length;

  const weekLabel = weekOffset === 1 ? "Next week" : weekOffset === 0 ? "This week" : `${weekOffset} weeks ahead`;

  return (
    <CasualLayout title="Weekly Availability">
      <div style={{ animation: "pageIn 0.4s ease both", maxWidth: "780px" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Weekly Availability</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
            Toggle the days you're available and set your hours for each day.
          </p>
        </div>

        {/* Week navigator */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "16px 20px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <button
            className="week-nav-btn"
            onClick={() => setWeekOffset(p => p - 1)}
            disabled={weekOffset <= 1}
            style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", fontSize: "18px", cursor: weekOffset <= 1 ? "not-allowed" : "pointer", color: weekOffset <= 1 ? "#CBD5E1" : "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}>
            ‹
          </button>

          <div style={{ flex: 1, textAlign: "center", padding: "0 16px" }}>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{fmtWeekRange(weekStart)}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px" }}>
              {weekLabel}
              {!isPast && enabledCount > 0 && (
                <span style={{ marginLeft: "8px", background: "#DBEAFE", color: "#1D4ED8", fontSize: "11px", fontWeight: "700", padding: "1px 8px", borderRadius: "100px" }}>
                  {enabledCount} day{enabledCount !== 1 ? "s" : ""} selected
                </span>
              )}
            </p>
          </div>

          <button
            className="week-nav-btn"
            onClick={() => setWeekOffset(p => p + 1)}
            disabled={weekOffset >= 4}
            style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", fontSize: "18px", cursor: weekOffset >= 4 ? "not-allowed" : "pointer", color: weekOffset >= 4 ? "#CBD5E1" : "#2563EB", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s", flexShrink: 0 }}>
            ›
          </button>
        </div>

        {isPast && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "12px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: "500", marginBottom: "20px" }}>
            ⚠️ You cannot edit availability for past or current weeks. Use the arrow to select a future week.
          </div>
        )}

        {/* Day rows */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", marginBottom: "20px" }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px 130px", gap: "0", padding: "10px 20px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <span style={th}>Day</span>
            <span style={th}>Status</span>
            <span style={{ ...th, textAlign: "center" }}>From</span>
            <span style={{ ...th, textAlign: "center" }}>To</span>
          </div>

          {loading ? (
            Array.from({ length: 7 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 130px 130px", gap: "0", padding: "16px 20px", borderBottom: i < 6 ? "1px solid #F1F5F9" : "none", alignItems: "center" }}>
                <Shimmer w="60px" h="13px" r="5px" />
                <Shimmer w="60px" h="28px" r="100px" />
                <div style={{ display: "flex", justifyContent: "center" }}><Shimmer w="90px" h="36px" r="8px" /></div>
                <div style={{ display: "flex", justifyContent: "center" }}><Shimmer w="90px" h="36px" r="8px" /></div>
              </div>
            ))
          ) : (
            DAYS.map((day, idx) => {
              const slot = slots[idx];
              const enabled = !!slot?.enabled;
              const isWeekend = idx >= 5;

              return (
                <div
                  key={day.short}
                  className="avail-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px 1fr 130px 130px",
                    gap: "0",
                    padding: "14px 20px",
                    borderBottom: idx < 6 ? "1px solid #F1F5F9" : "none",
                    alignItems: "center",
                    background: enabled ? "#F0F7FF" : "#FFFFFF",
                    animation: `fadeSlideUp 0.3s ease ${idx * 0.04}s both`,
                  }}>

                  {/* Day label */}
                  <div>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: enabled ? "#1D4ED8" : "#1E293B" }}>{day.full}</p>
                    <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>{getDayDate(weekStart, idx)}</p>
                  </div>

                  {/* Toggle */}
                  <div>
                    <button
                      className={enabled ? "avail-toggle-on" : "avail-toggle-off"}
                      onClick={() => !isPast && toggleDay(idx)}
                      disabled={isPast}
                      style={{
                        padding: "6px 16px", borderRadius: "100px", fontSize: "12px", fontWeight: "700",
                        border: "1.5px solid", cursor: isPast ? "not-allowed" : "pointer",
                        transition: "all 0.15s",
                      }}>
                      {enabled ? "✓ Available" : "Off"}
                    </button>
                  </div>

                  {/* From time */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    {enabled ? (
                      <input
                        type="time"
                        className="avail-time-input"
                        value={slot.from}
                        onChange={e => updateSlot(idx, "from", e.target.value)}
                        disabled={isPast}
                        style={{
                          width: "110px", padding: "8px 10px",
                          border: "1.5px solid #BFDBFE", borderRadius: "9px",
                          fontSize: "14px", fontWeight: "500", color: "#1E293B",
                          background: "#FFFFFF", textAlign: "center",
                          cursor: isPast ? "not-allowed" : "text",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>—</span>
                    )}
                  </div>

                  {/* To time */}
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    {enabled ? (
                      <input
                        type="time"
                        className="avail-time-input"
                        value={slot.to}
                        onChange={e => updateSlot(idx, "to", e.target.value)}
                        disabled={isPast}
                        style={{
                          width: "110px", padding: "8px 10px",
                          border: slot.from >= slot.to ? "1.5px solid #FCA5A5" : "1.5px solid #BFDBFE",
                          borderRadius: "9px",
                          fontSize: "14px", fontWeight: "500", color: "#1E293B",
                          background: slot.from >= slot.to ? "#FFF1F2" : "#FFFFFF",
                          textAlign: "center",
                          cursor: isPast ? "not-allowed" : "text",
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}
                      />
                    ) : (
                      <span style={{ fontSize: "13px", color: "#CBD5E1" }}>—</span>
                    )}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Summary + Save */}
        {!isPast && !loading && (
          <>
            {enabledCount > 0 && (
              <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "14px 18px", marginBottom: "16px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                <span style={{ fontSize: "13px", fontWeight: "600", color: "#1D4ED8" }}>📋 Selected:</span>
                {DAYS.map((day, idx) => {
                  const slot = slots[idx];
                  if (!slot?.enabled) return null;
                  return (
                    <span key={idx} style={{ background: "#DBEAFE", color: "#1E40AF", fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "100px" }}>
                      {day.short} {slot.from}–{slot.to}
                    </span>
                  );
                })}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={saving || enabledCount === 0}
              style={{
                width: "100%", padding: "14px",
                background: saving ? "#93C5FD" : enabledCount === 0 ? "#E2E8F0" : "#2563EB",
                color: enabledCount === 0 ? "#94A3B8" : "#FFFFFF",
                border: "none", borderRadius: "12px",
                fontSize: "15px", fontWeight: "700",
                cursor: saving || enabledCount === 0 ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}>
              {saving
                ? "Saving…"
                : enabledCount === 0
                  ? "Select at least one day to save"
                  : `Save Availability — ${enabledCount} day${enabledCount !== 1 ? "s" : ""} selected`}
            </button>
          </>
        )}

      </div>

      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "13px 22px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
          animation: "toastIn 0.3s ease both",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          {toast.type === "success" ? "✓" : "✕"} {toast.msg}
        </div>
      )}
    </CasualLayout>
  );
}

const th = {
  fontSize: "11px", fontWeight: "700", color: "#94A3B8",
  textTransform: "uppercase", letterSpacing: "0.06em",
};
