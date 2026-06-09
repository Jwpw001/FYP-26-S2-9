import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import CasualLayout from "../../components/layout/CasualLayout";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const DAY_NUMS = [1,2,3,4,5,6,0]; // matches day_of_week (0=Sun in JS, but 1=Mon in DB)

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d.toISOString().split("T")[0];
}

export default function WeeklyAvailability() {
  const user = getUser();
  const userId = user?.user_id;

  const [weekOffset, setWeekOffset] = useState(1); // default next week
  const weekStart = getWeekStart(weekOffset);

  const [slots, setSlots]     = useState({}); // { dayIndex: { from, to, enabled } }
  const [existing, setExisting] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError]     = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("casual_availability")
        .select("availability_id, day_of_week, available_from, available_to, week_start_date")
        .eq("staff_id", userId)
        .eq("week_start_date", weekStart);

      if (!cancelled) {
        setExisting(data || []);
        // Pre-fill slots from existing data
        const filled = {};
        (data || []).forEach(row => {
          const idx = DAY_NUMS.indexOf(row.day_of_week);
          if (idx >= 0) filled[idx] = {
            enabled: true,
            from: row.available_from?.slice(0,5) || "09:00",
            to: row.available_to?.slice(0,5) || "18:00",
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
      return { ...prev, [idx]: { enabled:true, from:"09:00", to:"18:00" } };
    });
  }

  function updateSlot(idx, field, val) {
    setSlots(prev => ({ ...prev, [idx]: { ...prev[idx], [field]: val } }));
  }

  async function handleSave() {
    setSaving(true); setError(""); setSuccess("");
    try {
      // Delete existing for this week
      if (existing.length > 0) {
        await supabase.from("casual_availability")
          .delete().eq("staff_id", userId).eq("week_start_date", weekStart);
      }
      // Insert new slots
      const toInsert = Object.entries(slots)
        .filter(([, v]) => v.enabled)
        .map(([idx, v]) => ({
          staff_id: userId,
          week_start_date: weekStart,
          day_of_week: DAY_NUMS[Number(idx)],
          available_from: v.from + ":00",
          available_to: v.to + ":00",
        }));

      if (toInsert.length > 0) {
        const { error: err } = await supabase
          .from("casual_availability").insert(toInsert);
        if (err) throw err;
      }

      setSuccess(`Availability saved for week of ${fmtWeekStart(weekStart)}.`);
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function fmtWeekStart(d) {
    return new Date(d).toLocaleDateString("en-SG", { month:"short", day:"numeric" });
  }

  const isPast = weekOffset <= 0;

  return (
    <CasualLayout title="Weekly Availability">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Weekly Availability</h2>
          <p style={s.sub}>Submit the days and times you're available to work.</p>
        </div>
      </div>

      {/* Week selector */}
      <div style={s.weekSelector}>
        <button style={s.weekBtn} onClick={() => setWeekOffset(p => p - 1)}
          disabled={weekOffset <= 1}>←</button>
        <div style={s.weekLabel}>
          <p style={s.weekTitle}>Week of {fmtWeekStart(weekStart)}</p>
          <p style={s.weekSub}>
            {weekOffset === 1 ? "Next week" : weekOffset === 0 ? "This week" : `${weekOffset} weeks ahead`}
          </p>
        </div>
        <button style={s.weekBtn} onClick={() => setWeekOffset(p => p + 1)}
          disabled={weekOffset >= 4}>→</button>
      </div>

      {isPast && (
        <div style={s.warning}>
          You cannot edit availability for past weeks.
        </div>
      )}

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {loading ? (
        <div style={s.loading}>Loading…</div>
      ) : (
        <>
          <div style={s.daysGrid}>
            {DAYS.map((day, idx) => {
              const slot = slots[idx];
              const enabled = !!slot?.enabled;
              return (
                <div key={day} style={{ ...s.dayCard, ...(enabled ? s.dayCardActive : {}) }}>
                  <div style={s.dayHeader}>
                    <div>
                      <p style={s.dayName}>{day}</p>
                      <p style={s.dayDate}>{getDayDate(weekStart, idx)}</p>
                    </div>
                    <button
                      style={{ ...s.toggle, ...(enabled ? s.toggleOn : {}) }}
                      onClick={() => !isPast && toggleDay(idx)}
                      disabled={isPast}
                    >
                      {enabled ? "Available" : "Off"}
                    </button>
                  </div>
                  {enabled && (
                    <div style={s.timeRow}>
                      <div style={s.timeField}>
                        <label style={s.timeLabel}>From</label>
                        <input style={s.timeInput} type="time" value={slot.from}
                          onChange={e => updateSlot(idx, "from", e.target.value)}
                          disabled={isPast} />
                      </div>
                      <div style={s.timeField}>
                        <label style={s.timeLabel}>To</label>
                        <input style={s.timeInput} type="time" value={slot.to}
                          onChange={e => updateSlot(idx, "to", e.target.value)}
                          disabled={isPast} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {!isPast && (
            <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Availability"}
            </button>
          )}
        </>
      )}
    </CasualLayout>
  );
}

function getDayDate(weekStart, dayOffset) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayOffset);
  return d.toLocaleDateString("en-SG", { month:"short", day:"numeric" });
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  weekSelector: { display:"flex", alignItems:"center", gap:"16px",
    background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px",
    padding:"16px 20px", marginBottom:"16px" },
  weekBtn: { width:"36px", height:"36px", borderRadius:"8px",
    background:"#F7F6F3", border:"1px solid #E5E2DC",
    fontSize:"16px", cursor:"pointer", display:"flex",
    alignItems:"center", justifyContent:"center" },
  weekLabel: { flex:1, textAlign:"center" },
  weekTitle: { fontSize:"16px", fontWeight:"700", color:"#1C1B18" },
  weekSub: { fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  warning: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  loading: { textAlign:"center", padding:"40px", color:"#7A7870", fontSize:"14px" },
  daysGrid: { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",
    gap:"12px", marginBottom:"20px" },
  dayCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"12px", padding:"14px", transition:"border-color 0.15s" },
  dayCardActive: { border:"1.5px solid #1C1B18" },
  dayHeader: { display:"flex", justifyContent:"space-between", alignItems:"center" },
  dayName: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  dayDate: { fontSize:"12px", color:"#7A7870", marginTop:"1px" },
  toggle: { padding:"4px 10px", borderRadius:"100px", fontSize:"12px",
    fontWeight:"600", border:"1.5px solid #E5E2DC",
    background:"#F7F6F3", color:"#7A7870", cursor:"pointer" },
  toggleOn: { background:"#1C1B18", color:"#FFFFFF", border:"1.5px solid #1C1B18" },
  timeRow: { display:"flex", gap:"8px", marginTop:"12px" },
  timeField: { flex:1 },
  timeLabel: { display:"block", fontSize:"11px", fontWeight:"600",
    color:"#7A7870", marginBottom:"4px" },
  timeInput: { width:"100%", padding:"7px 8px", border:"1.5px solid #D8D5CE",
    borderRadius:"8px", fontSize:"13px", background:"#FFFFFF",
    color:"#1C1B18", boxSizing:"border-box" },
  saveBtn: { width:"100%", padding:"13px", background:"#1C1B18", color:"#FFFFFF",
    border:"none", borderRadius:"12px", fontSize:"15px",
    fontWeight:"700", cursor:"pointer" },
};
