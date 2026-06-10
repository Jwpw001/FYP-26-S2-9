import { useState } from "react";
import { api } from "../../lib/api";
import WorkerLayout from "../../components/layout/WorkerLayout";

const DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

export default function WorkerAvailability() {
  const [availability, setAvailability] = useState(DAYS.map((_, i) => ({ day_of_week: i+1, available: false, available_from:"09:00", available_to:"17:00" })));
  const [weekStart, setWeekStart] = useState(getNextMonday());
  const [preferredLocation, setPreferredLocation] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  function getNextMonday() {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 1 : 8 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().split("T")[0];
  }

  function toggleDay(i) {
    setAvailability(prev => prev.map((a, idx) => idx === i ? { ...a, available: !a.available } : a));
  }
  function updateSlot(i, field, value) {
    setAvailability(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  }

  async function handleSave() {
    setLoading(true); setError("");
    try {
      const slots = availability.filter(a => a.available).map(a => ({
        week_start_date: weekStart,
        day_of_week: a.day_of_week,
        available_from: a.available_from,
        available_to: a.available_to,
      }));
      await api.post("/api/krewby/availability", { week_start_date: weekStart, slots, preferred_location: preferredLocation });
      setSuccess("Availability saved!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <WorkerLayout title="My Availability">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>My Availability</h2>
          <p style={s.sub}>Set your availability for the upcoming week</p>
        </div>
        <input style={s.input} type="date" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
      </div>
      {success && <div style={s.successMsg}>{success}</div>}
      {error && <div style={s.error}>{error}</div>}
      <div style={s.field}>
        <label style={s.label}>Preferred Work Area</label>
        <input style={s.input} placeholder="e.g. Orchard, Tampines, Any" value={preferredLocation} onChange={e => setPreferredLocation(e.target.value)} />
      </div>
      <div style={s.daysList}>
        {DAYS.map((day, i) => (
          <div key={day} style={{ ...s.dayCard, ...(availability[i].available ? s.dayCardActive : {}) }}>
            <div style={s.dayTop}>
              <div style={s.dayCheck}>
                <input type="checkbox" checked={availability[i].available} onChange={() => toggleDay(i)} id={`day-${i}`} />
                <label htmlFor={`day-${i}`} style={s.dayLabel}>{day}</label>
              </div>
              {availability[i].available && (
                <div style={s.timeSlot}>
                  <input style={s.timeInput} type="time" value={availability[i].available_from} onChange={e => updateSlot(i, "available_from", e.target.value)} />
                  <span style={s.timeSep}>–</span>
                  <input style={s.timeInput} type="time" value={availability[i].available_to} onChange={e => updateSlot(i, "available_to", e.target.value)} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div style={s.footer}>
        <p style={s.footerNote}>{availability.filter(a => a.available).length} days selected</p>
        <button style={s.saveBtn} onClick={handleSave} disabled={loading}>{loading ? "Saving…" : "Save Availability"}</button>
      </div>
    </WorkerLayout>
  );
}
const s = {
  headerRow:{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading:{ fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub:{ fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  successMsg:{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  error:{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  field:{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"16px" },
  label:{ fontSize:"13px", fontWeight:"600", color:"#55524A" },
  input:{ padding:"9px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px", background:"#FFFFFF", maxWidth:"300px" },
  daysList:{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"24px" },
  dayCard:{ background:"#FFFFFF", border:"1.5px solid #E5E2DC", borderRadius:"12px", padding:"16px" },
  dayCardActive:{ border:"1.5px solid #1C1B18", background:"#F7F6F3" },
  dayTop:{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:"12px" },
  dayCheck:{ display:"flex", alignItems:"center", gap:"10px" },
  dayLabel:{ fontSize:"15px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  timeSlot:{ display:"flex", alignItems:"center", gap:"8px" },
  timeInput:{ padding:"7px 10px", border:"1.5px solid #D8D5CE", borderRadius:"8px", fontSize:"13px" },
  timeSep:{ color:"#7A7870", fontWeight:"600" },
  footer:{ display:"flex", justifyContent:"space-between", alignItems:"center" },
  footerNote:{ fontSize:"13px", color:"#7A7870" },
  saveBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"10px 24px", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
};
