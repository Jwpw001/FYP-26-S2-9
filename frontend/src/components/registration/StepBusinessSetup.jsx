import { useState } from "react";
import { Clock, Calendar, AlertTriangle } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StepBusinessSetup({ form, set, setField, error, onNext, onSkip, onBack }) {
  const [focused, setFocused] = useState(null);

  function toggleDay(i) {
    const days = [...form.operating_days];
    days[i] = days[i] === 1 ? 0 : 1;
    setField("operating_days", days);
  }

  function toggleHoliday(i) {
    const holidays = [...form.holidays];
    holidays[i] = { ...holidays[i], enabled: !holidays[i].enabled };
    setField("holidays", holidays);
  }

  return (
    <>
      <button onClick={onBack} style={backBtn}>← Back</button>

      <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Business setup</h2>
      <p style={{ fontSize: "21px", color: "#64748B", marginBottom: "28px" }}>Configure your operating schedule and work rules. You can change these later.</p>

      {error && <div style={errorBox}>{error}</div>}

      {/* Operating Days */}
      <p style={sectionLabel}>Operating days</p>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {DAYS.map((day, i) => (
          <button key={day} type="button" onClick={() => toggleDay(i)}
            style={{ padding: "8px 16px", borderRadius: "100px", border: `1.5px solid ${form.operating_days[i] ? "#2563EB" : "#E2E8F0"}`, background: form.operating_days[i] ? "#EFF6FF" : "#fff", color: form.operating_days[i] ? "#2563EB" : "#94A3B8", fontSize: "20px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" }}>
            {day}
          </button>
        ))}
      </div>

      {/* Operating Hours */}
      <p style={sectionLabel}>Operating hours</p>
      <div style={{ display: "flex", gap: "16px", marginBottom: "24px" }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Open time</label>
          <div style={{ position: "relative" }}>
            <Clock size={14} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="time" value={form.open_time} onChange={set("open_time")}
              style={{ ...inputStyle, paddingLeft: "34px" }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Close time</label>
          <div style={{ position: "relative" }}>
            <Clock size={14} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input type="time" value={form.close_time} onChange={set("close_time")}
              style={{ ...inputStyle, paddingLeft: "34px" }} />
          </div>
        </div>
      </div>

      {/* Work Rules */}
      <p style={sectionLabel}>Work rules</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
        <NumberField label="Standard hours/day" value={form.work_hours_day} onChange={v => setField("work_hours_day", v)} min={1} max={24} />
        <NumberField label="Max hours/day" value={form.max_work_hours_day} onChange={v => setField("max_work_hours_day", v)} min={1} max={24} />
        <NumberField label="Max consecutive days" value={form.max_consecutive_days} onChange={v => setField("max_consecutive_days", v)} min={1} max={14} />
      </div>

      {/* Overtime Toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", marginBottom: "24px" }}>
        <div>
          <p style={{ fontSize: "21px", fontWeight: "600", color: "#1E293B" }}>Allow overtime</p>
          <p style={{ fontSize: "19px", color: "#94A3B8", marginTop: "2px" }}>Workers can be scheduled beyond standard hours</p>
        </div>
        <button type="button" onClick={() => setField("allow_overtime", !form.allow_overtime)}
          style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", background: form.allow_overtime ? "#2563EB" : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
          <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: form.allow_overtime ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
        </button>
      </div>

      {/* Public Holidays */}
      <p style={sectionLabel}>
        <Calendar size={14} style={{ marginRight: "6px", verticalAlign: "middle" }} />
        Singapore public holidays
      </p>
      <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", maxHeight: "240px", overflowY: "auto", marginBottom: "28px" }}>
        {form.holidays.map((h, i) => (
          <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: i < form.holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
            <div>
              <p style={{ fontSize: "20px", fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
              <p style={{ fontSize: "19px", color: "#94A3B8" }}>{h.date}</p>
            </div>
            <button type="button" onClick={() => toggleHoliday(i)}
              style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", background: h.enabled ? "#22C55E" : "#D1D5DB", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: h.enabled ? "19px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
            </button>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onSkip}
          style={{ flex: 1, padding: "14px", background: "#fff", color: "#64748B", border: "1.5px solid #E2E8F0", borderRadius: "12px", fontSize: "22px", fontWeight: "600", cursor: "pointer" }}>
          Skip for now
        </button>
        <button type="button" onClick={onNext}
          style={{ flex: 1, padding: "14px", background: "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "22px", fontWeight: "700", cursor: "pointer" }}>
          Next →
        </button>
      </div>
    </>
  );
}

function NumberField({ label, value, onChange, min, max }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max}
        style={inputStyle} />
    </div>
  );
}

const backBtn = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "20px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" };
const errorBox = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "20px", color: "#DC2626" };
const sectionLabel = { fontSize: "18px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", marginTop: "4px", display: "flex", alignItems: "center" };
const fieldLabel = { display: "block", fontSize: "20px", fontWeight: "600", color: "#374151", marginBottom: "6px" };
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "21px", color: "#0F172A", outline: "none", boxSizing: "border-box", background: "#fff" };
