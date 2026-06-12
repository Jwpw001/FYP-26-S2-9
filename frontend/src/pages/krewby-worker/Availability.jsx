import { useState, useEffect } from "react";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import WorkerLayout from "../../components/layout/WorkerLayout";

if (typeof document !== "undefined" && !document.getElementById("worker-avail-styles")) {
  const style = document.createElement("style");
  style.id = "worker-avail-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes toastIn { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
    .avail-day-card { transition: box-shadow 0.15s, transform 0.15s; }
    .avail-day-card:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08) !important; }
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

function getWeekStart(offset = 0) {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtWeek(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-SG", opts)} – ${end.toLocaleDateString("en-SG", opts)}`;
}

function isoDate(base, dayIndex) {
  const d = new Date(base);
  d.setDate(d.getDate() + dayIndex);
  return d.toISOString().split("T")[0];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
  );
}

export default function WorkerAvailability() {
  const user   = getUser();
  const userId = user?.user_id;

  const [weekOffset,     setWeekOffset]     = useState(0);
  const [avail,          setAvail]          = useState({});
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState(null);
  const [expandedNotes,  setExpandedNotes]  = useState({});

  const weekStart = getWeekStart(weekOffset);
  const weekLabel = fmtWeek(weekStart);
  const isPast    = weekOffset < 0;

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setExpandedNotes({});
      const weekStartStr = weekStart.toISOString().split("T")[0];
      try {
        const res = await api.get(`/api/auth/worker-availability?week_start=${weekStartStr}`);
        if (!cancelled) {
          // res.availability is array of day_of_week integers that are available
          const availDays = new Set(res.availability || []);
          const init = {};
          DAYS.forEach((_, i) => {
            init[isoDate(weekStart, i)] = { available: availDays.has(i), note: "" };
          });
          setAvail(init);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, weekOffset]);

  function toggle(date) {
    if (isPast) return;
    setAvail(prev => ({ ...prev, [date]: { ...prev[date], available: !prev[date]?.available } }));
  }

  function setNote(date, val) {
    setAvail(prev => ({ ...prev, [date]: { ...prev[date], note: val } }));
  }

  function toggleNote(date) {
    setExpandedNotes(prev => ({ ...prev, [date]: !prev[date] }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];
      const days = DAYS.map((_, i) => ({
        day_of_week: i,
        available:   avail[isoDate(weekStart, i)]?.available ?? false,
      }));
      await api.post("/api/auth/worker-availability", { week_start: weekStartStr, days });
      showToast("Availability saved successfully!");
    } catch (err) {
      console.error(err);
      showToast(err.message || "Failed to save.", "error");
    } finally {
      setSaving(false);
    }
  }

  const availCount = DAYS.filter((_, i) => avail[isoDate(weekStart, i)]?.available).length;

  return (
    <WorkerLayout title="Availability">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>My Availability</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
            Tap a day to mark yourself as available. Your coordinator will see this when assigning shifts.
          </p>
        </div>

        {/* Week navigator */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <button onClick={() => setWeekOffset(o => o - 1)}
            style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}>
            ‹
          </button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{weekLabel}</p>
            {weekOffset === 0 && (
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6", background: "#EFF6FF", padding: "2px 8px", borderRadius: "100px", marginTop: "4px", display: "inline-block" }}>
                Current week
              </span>
            )}
            {weekOffset === 1 && (
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#0D9488", background: "#F0FDFA", padding: "2px 8px", borderRadius: "100px", marginTop: "4px", display: "inline-block" }}>
                Next week
              </span>
            )}
            {weekOffset < 0 && (
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#92400E", background: "#FFFBEB", padding: "2px 8px", borderRadius: "100px", marginTop: "4px", display: "inline-block" }}>
                Past week (read-only)
              </span>
            )}
          </div>
          <button onClick={() => setWeekOffset(o => o + 1)}
            style={{ width: "36px", height: "36px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", flexShrink: 0 }}>
            ›
          </button>
        </div>

        {/* Progress summary */}
        {!loading && (
          <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px", animation: "fadeSlideUp 0.3s ease 0.1s both" }}>
            <div style={{ flex: 1, height: "8px", borderRadius: "100px", background: "#F1F5F9", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(availCount / 7) * 100}%`, background: availCount > 0 ? "#22C55E" : "#E2E8F0", borderRadius: "100px", transition: "width 0.3s ease" }} />
            </div>
            <span style={{ fontSize: "13px", fontWeight: "600", color: availCount > 0 ? "#16A34A" : "#94A3B8", flexShrink: 0 }}>
              {availCount} / 7 days
            </span>
          </div>
        )}

        {/* Day cards — horizontal grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "24px" }}>
          {DAYS.map(({ short }, i) => {
            const date    = isoDate(weekStart, i);
            const isAvail = avail[date]?.available ?? false;
            const note    = avail[date]?.note ?? "";
            const showNote = !!expandedNotes[date];

            return (
              <div key={date} className="avail-day-card"
                style={{ background: isAvail ? "#22C55E" : "#FFF", border: `1.5px solid ${isAvail ? "#22C55E" : "#E2E8F0"}`, borderRadius: "16px", overflow: "visible", boxShadow: isAvail ? "0 4px 14px rgba(34,197,94,0.25)" : "0 1px 3px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`, cursor: !isPast ? "pointer" : "default", userSelect: "none" }}
                onClick={() => !isPast && toggle(date)}>

                {/* Card body */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "16px 8px 14px", gap: "6px" }}>
                  {/* Day abbrev */}
                  <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", color: isAvail ? "rgba(255,255,255,0.75)" : "#94A3B8" }}>
                    {short}
                  </span>

                  {/* Date number */}
                  <span style={{ fontSize: "22px", fontWeight: "800", lineHeight: 1, color: isAvail ? "#FFF" : "#1E293B" }}>
                    {new Date(date).getDate()}
                  </span>

                  {/* Status dot / checkmark */}
                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: isAvail ? "rgba(255,255,255,0.2)" : "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", marginTop: "2px", transition: "background 0.2s" }}>
                    {isAvail
                      ? <span style={{ fontSize: "13px", color: "#FFF" }}>✓</span>
                      : <span style={{ fontSize: "13px", color: "#CBD5E1" }}>–</span>
                    }
                  </div>
                </div>

                {/* Note badge (below card, outside click area) */}
                {!isPast && isAvail && (
                  <div style={{ padding: "0 6px 10px" }} onClick={e => e.stopPropagation()}>
                    {!showNote ? (
                      <button onClick={e => { e.stopPropagation(); toggleNote(date); }}
                        style={{ width: "100%", padding: "4px 0", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: "8px", fontSize: "10px", fontWeight: "600", color: note ? "#FFF" : "rgba(255,255,255,0.7)", cursor: "pointer", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {note ? `📝 ${note}` : "+ note"}
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <input
                          autoFocus
                          value={note}
                          onChange={e => setNote(date, e.target.value)}
                          onKeyDown={e => e.key === "Enter" && toggleNote(date)}
                          placeholder="e.g. after 2pm"
                          style={{ width: "100%", padding: "5px 7px", border: "1.5px solid rgba(255,255,255,0.4)", borderRadius: "7px", fontSize: "11px", color: "#1E293B", outline: "none", background: "#FFF", boxSizing: "border-box" }}
                        />
                        <button onClick={() => toggleNote(date)}
                          style={{ padding: "4px", borderRadius: "7px", border: "none", background: "rgba(255,255,255,0.9)", color: "#16A34A", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Save button */}
        {!isPast && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            {loading ? null : (
              <>
                <button onClick={() => {
                  const dates = DAYS.map((_, i) => isoDate(weekStart, i));
                  const all = {};
                  dates.forEach(d => { all[d] = { ...avail[d], available: true }; });
                  setAvail(all);
                }} style={{ padding: "10px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", cursor: "pointer" }}>
                  Select All
                </button>
                <button onClick={() => {
                  const dates = DAYS.map((_, i) => isoDate(weekStart, i));
                  const none = {};
                  dates.forEach(d => { none[d] = { ...avail[d], available: false }; });
                  setAvail(none);
                }} style={{ padding: "10px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", cursor: "pointer" }}>
                  Clear All
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "10px 28px", borderRadius: "10px", fontSize: "14px", fontWeight: "700", border: "none", background: saving ? "#93C5FD" : "#3B82F6", color: "#FFF", cursor: saving ? "not-allowed" : "pointer", boxShadow: "0 2px 10px rgba(59,130,246,0.3)" }}>
                  {saving ? "Saving…" : "Save Availability"}
                </button>
              </>
            )}
          </div>
        )}

      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#FFF", padding: "13px 22px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </WorkerLayout>
  );
}
