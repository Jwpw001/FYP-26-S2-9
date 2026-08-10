import { useState } from "react";
import { Calendar } from "lucide-react";
import { api } from "../lib/api";

// Shared "public holidays" panel: ad-hoc closure marking (POST /branches/:id/closures,
// cancels any existing shifts on that date and notifies affected staff) plus the
// treat_public_holidays_as_working toggle and the per-holiday enable/disable list. Extracted so
// business-owner/BranchDetail.jsx doesn't grow a third divergent copy of what manager/Settings.jsx
// and business-owner/Settings.jsx already implement inline (near-identically) themselves.
export default function BranchHolidaySettings({
  branchId,
  holidays = [],
  treatPublicHolidaysAsWorking = false,
  onToggleWorking,   // (newVal) => void — omit to hide the toggle row entirely
  onHolidayToggle,   // (index) => void — omit to render the list read-only
  editable = true,   // gates onToggleWorking / onHolidayToggle interactivity
  onClosed,          // () => void — called after a closure is successfully marked, to let the caller refresh
  yearLabel = "SG 2026",
  compact = false,
}) {
  const [closureDate, setClosureDate] = useState("");
  const [closureReason, setClosureReason] = useState("");
  const [closureSaving, setClosureSaving] = useState(false);
  const [closureResult, setClosureResult] = useState("");
  const [closureError, setClosureError] = useState("");

  async function markClosed() {
    if (!closureDate || !branchId) return;
    setClosureSaving(true); setClosureError(""); setClosureResult("");
    try {
      const r = await api.post(`/api/business/branches/${branchId}/closures`, { date: closureDate, reason: closureReason });
      setClosureResult(r.cancelled_shifts > 0
        ? `Marked closed. ${r.cancelled_shifts} shift(s) cancelled, ${r.notified} staff notified.`
        : "Marked closed.");
      setClosureDate(""); setClosureReason("");
      onClosed?.();
      setTimeout(() => setClosureResult(""), 5000);
    } catch (err) {
      setClosureError(err.message);
    } finally {
      setClosureSaving(false);
    }
  }

  const f = compact ? { title: "13px", sub: "11px", name: "12px", date: "11px", input: "12px", toggleW: 34, toggleH: 18, dotW: 12, dotH: 12 }
                     : { title: "21px", sub: "17px", name: "20px", date: "18px", input: "17px", toggleW: 40, toggleH: 22, dotW: 16, dotH: 16 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
        <Calendar size={compact ? 14 : 16} color="#2563EB" />
        <h3 style={{ fontSize: f.title, fontWeight: "700", color: "#1E293B" }}>Public holidays</h3>
        <span style={{ fontSize: f.date, fontWeight: "700", padding: "2px 8px", borderRadius: "100px", background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE" }}>
          {yearLabel}
        </span>
      </div>

      {onToggleWorking && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "10px", marginBottom: "10px" }}>
          <div>
            <p style={{ fontSize: f.sub, fontWeight: "600", color: "#1E293B" }}>Work through public holidays</p>
            <p style={{ fontSize: f.date, color: "#94A3B8", marginTop: "1px" }}>Off by default — generated shifts skip public holidays</p>
          </div>
          <button type="button" disabled={!editable} onClick={() => editable && onToggleWorking(!treatPublicHolidaysAsWorking)}
            style={{ width: `${f.toggleW}px`, height: `${f.toggleH}px`, borderRadius: "11px", border: "none", background: treatPublicHolidaysAsWorking ? "#2563EB" : "#D1D5DB", cursor: editable ? "pointer" : "default", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: editable ? 1 : 0.7 }}>
            <div style={{ width: `${f.dotW}px`, height: `${f.dotH}px`, borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: treatPublicHolidaysAsWorking ? `${f.toggleW - f.dotW - 3}px` : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        <input type="date" value={closureDate} onChange={e => setClosureDate(e.target.value)} style={{ flex: 1, padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: f.input }} />
        <input type="text" placeholder="Reason (optional)" value={closureReason} onChange={e => setClosureReason(e.target.value)} style={{ flex: 1, padding: "7px 9px", border: "1.5px solid #E2E8F0", borderRadius: "8px", fontSize: f.input }} />
        <button onClick={markClosed} disabled={!closureDate || closureSaving}
          style={{ background: "#1E293B", color: "#fff", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: f.input, fontWeight: "700", cursor: closureDate ? "pointer" : "default", opacity: closureDate ? 1 : 0.5, whiteSpace: "nowrap" }}>
          {closureSaving ? "…" : "Mark closed"}
        </button>
      </div>
      {closureResult && <p style={{ fontSize: f.date, color: "#166534", marginBottom: "10px" }}>{closureResult}</p>}
      {closureError && <p style={{ fontSize: f.date, color: "#DC2626", marginBottom: "10px" }}>{closureError}</p>}

      <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", maxHeight: compact ? "200px" : "240px", overflowY: "auto" }}>
        {holidays.length === 0 ? (
          <p style={{ fontSize: f.sub, color: "#CBD5E1", textAlign: "center", padding: "20px" }}>No holidays data.</p>
        ) : holidays.map((h, i) => {
          const rowEditable = editable && !!onHolidayToggle;
          return (
            <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", borderBottom: i < holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
              <div>
                <p style={{ fontSize: f.name, fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
                <p style={{ fontSize: f.date, color: "#94A3B8" }}>{h.date}</p>
              </div>
              <button type="button" onClick={() => rowEditable && onHolidayToggle(i)} disabled={!rowEditable}
                style={{ width: `${f.toggleW - 4}px`, height: `${f.toggleH - 2}px`, borderRadius: "9px", border: "none", background: h.enabled ? "#22C55E" : "#D1D5DB", cursor: rowEditable ? "pointer" : "default", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: rowEditable ? 1 : 0.7 }}>
                <div style={{ width: `${f.dotW - 2}px`, height: `${f.dotH - 2}px`, borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: h.enabled ? `${f.toggleW - f.dotW - 3}px` : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
