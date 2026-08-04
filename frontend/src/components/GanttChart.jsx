import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X } from "lucide-react";

// ── Shared date helpers ──────────────────────────────────────────────────────
export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function dayDiff(a, b) {
  const A = new Date(a + "T00:00:00");
  const B = new Date(b + "T00:00:00");
  return Math.round((B - A) / 86400000);
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const NAME_COL_WIDTH = 190;
const LANE_HEIGHT = 40;

/** Pack overlapping bars into separate lanes (rows) so none visually collide. */
function packLanes(bars) {
  const sorted = [...bars].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
  const laneEnds = []; // last `end` date placed in each lane
  const placed = [];
  for (const bar of sorted) {
    let laneIdx = laneEnds.findIndex(end => bar.start > end);
    if (laneIdx === -1) { laneIdx = laneEnds.length; laneEnds.push(bar.end); }
    else laneEnds[laneIdx] = bar.end;
    placed.push({ ...bar, lane: laneIdx });
  }
  return { laneCount: Math.max(1, laneEnds.length), bars: placed };
}

/**
 * Horizontal timeline / Gantt view.
 * rows: [{ id, name, sublabel, avatarColor, bars: [{ id, start, end, label, bg, color, border, onClick }] }]
 * rangeStart: Date (first day shown), numDays: how many day columns to render.
 */
export default function GanttChart({ rangeStart, numDays, rows, emptyLabel = "Nothing to show for this range." }) {
  const todayStr = toDateStr(new Date());
  const rangeStartStr = toDateStr(rangeStart);
  const days = Array.from({ length: numDays }, (_, i) => {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const dayPct = 100 / numDays;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, height: "100%" }}>
      {/* Header row */}
      <div style={{ display: "flex", borderBottom: "1px solid #E2E8F0", background: "#F8FAFC", flexShrink: 0 }}>
        <div style={{ width: NAME_COL_WIDTH, flexShrink: 0, padding: "10px 14px", fontSize: "18px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.04em", borderRight: "1px solid #E2E8F0" }}>
          Staff
        </div>
        <div style={{ display: "flex", flex: 1 }}>
          {days.map((d, i) => {
            const dStr = toDateStr(d);
            const isToday = dStr === todayStr;
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div key={i} style={{
                width: `${dayPct}%`, flexShrink: 0, textAlign: "center", padding: "7px 0",
                background: isToday ? "#EFF6FF" : isWeekend ? "#F1F5F9" : "transparent",
                borderRight: i < numDays - 1 ? "1px solid #F1F5F9" : "none",
              }}>
                <div style={{ fontSize: "16px", fontWeight: "700", color: isToday ? "#2563EB" : "#94A3B8" }}>{DAY_LABELS[(d.getDay() + 6) % 7]}</div>
                <div style={{ fontSize: "18px", fontWeight: isToday ? "800" : "600", color: isToday ? "#2563EB" : "#1E293B" }}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", fontSize: "20px", color: "#94A3B8" }}>{emptyLabel}</div>
        ) : (
          rows.map(row => {
            const { laneCount, bars: packedBars } = packLanes(row.bars);
            const rowHeight = laneCount * LANE_HEIGHT;
            return (
              <div key={row.id} style={{ display: "flex", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ width: NAME_COL_WIDTH, flexShrink: 0, padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px", borderRight: "1px solid #E2E8F0" }}>
                  <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: row.avatarColor || "#6366F1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", fontWeight: "700", flexShrink: 0 }}>
                    {row.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "19px", fontWeight: "700", color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</p>
                    {row.sublabel && <p style={{ fontSize: "17px", color: "#94A3B8" }}>{row.sublabel}</p>}
                  </div>
                </div>
                <div style={{ position: "relative", flex: 1, height: `${rowHeight}px` }}>
                  {/* Weekend/today column shading */}
                  <div style={{ position: "absolute", inset: 0, display: "flex" }}>
                    {days.map((d, i) => {
                      const dStr = toDateStr(d);
                      const isToday = dStr === todayStr;
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      return (
                        <div key={i} style={{ width: `${dayPct}%`, flexShrink: 0, background: isToday ? "#EFF6FF" : isWeekend ? "#FAFAFA" : "transparent", borderRight: i < numDays - 1 ? "1px solid #F8FAFC" : "none" }} />
                      );
                    })}
                  </div>
                  {/* Lane divider lines (only when there's more than one lane) */}
                  {laneCount > 1 && Array.from({ length: laneCount - 1 }).map((_, i) => (
                    <div key={i} style={{ position: "absolute", top: `${(i + 1) * LANE_HEIGHT}px`, left: 0, right: 0, height: "1px", background: "#F1F5F9" }} />
                  ))}
                  {/* Bars */}
                  {packedBars.map(bar => {
                    const startClamped = bar.start < rangeStartStr ? rangeStartStr : bar.start;
                    const rangeEndStr = toDateStr(days[numDays - 1]);
                    const endClamped = bar.end > rangeEndStr ? rangeEndStr : bar.end;
                    const left = dayDiff(rangeStartStr, startClamped) * dayPct;
                    const width = (dayDiff(startClamped, endClamped) + 1) * dayPct;
                    if (left + width <= 0 || left >= 100) return null;
                    return (
                      <button key={bar.id} title={bar.title}
                        onClick={bar.onClick}
                        style={{
                          position: "absolute", top: `${bar.lane * LANE_HEIGHT + 6}px`, left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)`, height: "28px",
                          background: bar.bg || "#DBEAFE", color: bar.color || "#1D4ED8", border: `1px solid ${bar.border || "#BFDBFE"}`,
                          borderRadius: "7px", display: "flex", alignItems: "center", padding: "0 8px",
                          fontSize: "18px", fontWeight: "700", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          cursor: "pointer", opacity: bar.faded ? 0.5 : 1, textAlign: "left", fontFamily: "inherit",
                        }}>
                        {bar.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Small reusable range navigator: "← [date range] →" with a Today button. */
export function RangeNav({ rangeStart, numDays, onChange }) {
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + numDays - 1);
  const fmt = d => d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
  const fmtYear = d => d.toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });

  function shift(days) {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + days);
    onChange(d);
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", flexShrink: 0 }}>
      <button onClick={() => shift(-numDays)} style={navBtnStyle}>←</button>
      <span style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B", minWidth: "180px", textAlign: "center" }}>
        {fmt(rangeStart)} – {fmtYear(rangeEnd)}
      </span>
      <button onClick={() => shift(numDays)} style={navBtnStyle}>→</button>
      <button onClick={() => onChange(startOfWeek(new Date()))} style={{ ...navBtnStyle, width: "auto", padding: "0 12px", fontSize: "19px", fontWeight: "600" }}>Today</button>
    </div>
  );
}

export function startOfWeek(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Wraps a Gantt block (range nav + chart) with a fullscreen toggle.
 * Inline by default; when expanded, covers the full viewport in a fixed overlay.
 */
export function FullscreenPanel({ title, children }) {
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e) { if (e.key === "Escape") setFullscreen(false); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  if (!fullscreen) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "8px" }}>
          <button onClick={() => setFullscreen(true)} title="Expand to full screen"
            style={{ width: "30px", height: "30px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
            <Maximize2 size={14} />
          </button>
        </div>
        {children}
      </div>
    );
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 20000, background: "#FFFFFF", display: "flex", flexDirection: "column", padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexShrink: 0 }}>
        {title && <h2 style={{ fontSize: "23px", fontWeight: "800", color: "#1E293B" }}>{title}</h2>}
        <button onClick={() => setFullscreen(false)} title="Exit full screen (Esc)"
          style={{ marginLeft: "auto", width: "34px", height: "34px", borderRadius: "9px", border: "1px solid #E2E8F0", background: "#F8FAFC", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#475569" }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>,
    document.body
  );
}

const navBtnStyle = {
  width: "30px", height: "30px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF",
  cursor: "pointer", fontSize: "21px", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
};
