import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Users, Building2, ClipboardList, CalendarDays, Download, TrendingUp, TrendingDown, ChevronUp, ChevronDown } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-reports-kf")) {
  const s = document.createElement("style");
  s.id = "sa-reports-kf";
  s.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .rpt-tab:hover { background:#F1F5F9!important; }
    .rpt-row:hover { background:#F8FAFC!important; }
    .rpt-sort:hover { color:#0F172A!important; }
  `;
  document.head.appendChild(s);
}

const PERIODS = [
  { label: "7D",  days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const ROLE_LABELS = {
  system_admin:          "System Admin",
  outlet_manager:        "Outlet Manager",
  regular_staff:         "Regular Staff",
  outlet_casual_staff:   "Outlet Casual Staff",
  krewby_casual_worker:  "Krewby Worker",
  business_owner:        "Business Owner",
};

function Shimmer({ w = "100%", h = "16px", r = "6px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear", flexShrink: 0 }} />;
}

function delta(curr, prev) {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

function TrendBadge({ pct }) {
  if (pct === null) return null;
  const up = pct >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "11px", fontWeight: "700", color: up ? "#16A34A" : "#DC2626", background: up ? "#F0FDF4" : "#FEF2F2", padding: "2px 7px", borderRadius: "100px" }}>
      <Icon size={11} /> {Math.abs(pct)}%
    </span>
  );
}

/* ── SVG multi-line chart ──
   The coordinate system is percentage-based (W=100) so the geometry can
   stretch to fill the full card width via preserveAspectRatio="none".
   Text and point markers are rendered as an HTML overlay instead of SVG
   <text>/<circle> — otherwise that same non-uniform stretch would distort
   them into flattened, stretched glyphs and ellipses.
   A hover crosshair (tracked via onMouseMove over the wrapper) plus gradient
   area fills and always-visible point dots keep the chart from reading as
   mostly-blank space when one series has a single outlier spike. */
function LineChart({ series, labels, height = 140 }) {
  const W = 100;
  const H = height;
  // PAD.left/right are percentages of W (the viewBox is percentage-based),
  // while PAD.top/bottom are real pixels of H — keep left/right small or the
  // Y-axis label gutter eats a huge chunk of the card as blank space.
  const PAD = { top: 16, right: 2, bottom: 28, left: 5 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const [hoverI, setHoverI] = useState(null);

  const allVals = series.flatMap(s => s.data);
  const maxV = Math.max(...allVals, 1);
  const n = labels.length;

  function px(i) { return PAD.left + (i / Math.max(n - 1, 1)) * chartW; }
  function py(v) { return PAD.top + (1 - v / maxV) * chartH; }

  function path(data) {
    if (data.length === 0) return "";
    return data.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  }
  function area(data, fill, key) {
    if (data.length === 0) return null;
    const line = path(data);
    const close = ` L${px(data.length - 1).toFixed(1)},${(PAD.top + chartH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + chartH).toFixed(1)} Z`;
    return (
      <path key={key} d={line + close}
        fill={fill} stroke="none" />
    );
  }

  function handleMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || n === 0) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (n - 1));
    setHoverI(Math.max(0, Math.min(n - 1, idx)));
  }

  // y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t, i) => ({ k: i, v: Math.round(t * maxV), y: PAD.top + (1 - t) * chartH }));
  // x-axis labels: show first, middle, last
  const xShow = n <= 7 ? labels.map((l, i) => ({ l, i })) : [0, Math.floor((n - 1) / 2), n - 1].map(i => ({ l: labels[i], i }));

  const tipLeftPct = hoverI !== null ? px(hoverI) : 0;
  const tipAlign = tipLeftPct > 72 ? "right" : tipLeftPct < 18 ? "left" : "center";

  return (
    <div style={{ position: "relative", width: "100%", height: H, cursor: "crosshair" }}
      onMouseMove={handleMove} onMouseLeave={() => setHoverI(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ overflow: "visible", display: "block" }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={"grad-" + i} id={`sa-lc-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>
        {/* Grid lines */}
        {ticks.map(t => (
          <line key={t.k} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y}
            stroke="#F1F5F9" strokeWidth="0.5" />
        ))}
        {/* Areas + Lines */}
        {series.map((s, i) => area(s.data, `url(#sa-lc-grad-${i})`, s.label + "-area"))}
        {series.map(s => (
          <path key={s.label} d={path(s.data)}
            fill="none" stroke={s.color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        ))}
        {/* Hover crosshair */}
        {hoverI !== null && (
          <line x1={px(hoverI)} y1={PAD.top} x2={px(hoverI)} y2={PAD.top + chartH}
            stroke="#94A3B8" strokeWidth="0.5" strokeDasharray="1.5,1.5" vectorEffect="non-scaling-stroke" />
        )}
      </svg>

      {/* Y labels — HTML overlay, positioned as % of the chart box */}
      {ticks.map(t => (
        <span key={t.k} style={{ position: "absolute", left: 0, top: `${(t.y / H) * 100}%`, transform: "translateY(-50%)", width: `${PAD.left}%`, paddingRight: "5px", boxSizing: "border-box", textAlign: "right", fontSize: "11px", fontWeight: 500, color: "#94A3B8" }}>
          {t.v}
        </span>
      ))}
      {/* X labels */}
      {xShow.map(({ l, i }) => (
        <span key={i} style={{ position: "absolute", left: `${px(i)}%`, bottom: 0, transform: "translateX(-50%)", fontSize: "11px", color: hoverI === i ? "#0F172A" : "#94A3B8", fontWeight: hoverI === i ? 700 : 500, whiteSpace: "nowrap", transition: "color 0.1s" }}>
          {l}
        </span>
      ))}
      {/* Point dots — every point gets a small marker so the chart never reads as blank;
          the hovered column and the final day pop larger for emphasis. */}
      {series.map(s => s.data.map((v, i) => {
        const isLast = i === s.data.length - 1;
        const isHover = hoverI === i;
        const size = isHover ? 9 : isLast ? 7 : 4.5;
        return (
          <div key={s.label + "-dot-" + i} style={{
            position: "absolute", left: `${px(i)}%`, top: `${(py(v) / H) * 100}%`,
            transform: "translate(-50%,-50%)", width: `${size}px`, height: `${size}px`,
            borderRadius: "50%", background: s.color,
            opacity: hoverI === null ? (isLast ? 1 : 0.55) : (isHover ? 1 : 0.25),
            boxShadow: isHover ? `0 0 0 3px #fff, 0 3px 8px ${s.color}77` : "0 0 0 2px #fff",
            transition: "width 0.12s ease, height 0.12s ease, opacity 0.12s ease",
            pointerEvents: "none",
          }} />
        );
      }))}

      {/* Hover tooltip */}
      {hoverI !== null && (
        <div style={{
          position: "absolute", top: "2px",
          left: tipAlign === "center" ? `${tipLeftPct}%` : tipAlign === "left" ? `${tipLeftPct}%` : undefined,
          right: tipAlign === "right" ? `${100 - tipLeftPct}%` : undefined,
          transform: tipAlign === "center" ? "translateX(-50%)" : "none",
          background: "#0F172A", color: "#FFF", borderRadius: "9px", padding: "9px 12px",
          fontSize: "11.5px", pointerEvents: "none", boxShadow: "0 8px 20px rgba(0,0,0,0.22)",
          whiteSpace: "nowrap", zIndex: 5,
        }}>
          <div style={{ fontWeight: 800, marginBottom: "5px", color: "#F1F5F9" }}>{labels[hoverI]}</div>
          {series.map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "7px", marginTop: "3px" }}>
              <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, color: "#CBD5E1", fontWeight: 500 }}>{s.label}</span>
              <span style={{ fontWeight: 700 }}>{s.data[hoverI] ?? 0}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Sortable table ── */
function SortableTable({ columns, rows, emptyMsg = "No data" }) {
  const [sortCol, setSortCol] = useState(0);
  const [sortDir, setSortDir] = useState("desc");

  function handleSort(i) {
    if (sortCol === i) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(i); setSortDir("desc"); }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol];
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #F1F5F9" }}>
            {columns.map((col, i) => (
              <th key={col} onClick={() => handleSort(i)}
                className="rpt-sort"
                style={{ padding: "8px 12px", textAlign: i === 0 ? "left" : "right", fontWeight: "700", fontSize: "11px", color: sortCol === i ? "#0F172A" : "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", cursor: "pointer", whiteSpace: "nowrap", userSelect: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", justifyContent: i === 0 ? "flex-start" : "flex-end" }}>
                  {col} {sortCol === i && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 ? (
            <tr><td colSpan={columns.length} style={{ padding: "32px", textAlign: "center", color: "#94A3B8", fontSize: "13px" }}>{emptyMsg}</td></tr>
          ) : sorted.map((row, ri) => (
            <tr key={ri} className="rpt-row" style={{ borderBottom: "1px solid #F8FAFC" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: "10px 12px", textAlign: ci === 0 ? "left" : "right", color: ci === 0 ? "#1E293B" : "#374151", fontWeight: ci === 0 ? "600" : "500" }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── KPI card ── */
function KpiCard({ label, value, sub, pct, color = "#2563EB", bg = "#EFF6FF", icon, loading }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: bg, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "17px", flexShrink: 0 }}>{icon}</div>
        {!loading && <TrendBadge pct={pct} />}
      </div>
      {loading ? (
        <><Shimmer w="60px" h="26px" r="6px" /><div style={{ marginTop: "6px" }}><Shimmer w="90px" h="11px" r="5px" /></div></>
      ) : (
        <>
          <p style={{ fontSize: "26px", fontWeight: "800", color: "#0F172A", lineHeight: 1, marginBottom: "4px" }}>{value}</p>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>{label}</p>
          {sub && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "2px" }}>{sub}</p>}
        </>
      )}
    </div>
  );
}

/* ── Semantic colors for known statuses ── */
const STATUS_STYLE = {
  completed: { color: "#16A34A" },
  assigned:  { color: "#2563EB" },
  open:      { color: "#D97706" },
  cancelled: { color: "#DC2626" },
  published: { color: "#2563EB" },
  draft:     { color: "#64748B" },
  approved:  { color: "#16A34A" },
  pending:   { color: "#D97706" },
  rejected:  { color: "#DC2626" },
};

/* ── Palette for series without a fixed semantic color (e.g. industries) ── */
const PALETTE = ["#2563EB", "#059669", "#DB2777", "#D97706", "#7C3AED", "#0891B2", "#DC2626", "#65A30D", "#0EA5E9", "#EA580C"];

/* ── Donut chart: stacked stroke-dasharray arcs, count in the center ──
   Segments and the paired legend rows share a lifted `hovered`/`onHover`
   state (see DonutPanel) so pointing at either highlights both. */
function DonutChart({ data, size = 108, thickness = 15, hovered, onHover }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const hoveredEntry = data.find(d => d.label === hovered);
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0, overflow: "visible" }}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {total === 0 ? (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F5F9" strokeWidth={thickness} />
        ) : data.map(d => {
          const frac = d.count / total;
          const dash = Math.max(frac * c - (data.length > 1 ? 1.5 : 0), 0);
          const isHovered = hovered === d.label;
          const dim = hovered && !isHovered;
          const el = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color}
              strokeWidth={isHovered ? thickness + 4 : thickness} strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-offset}
              strokeLinecap="round" opacity={dim ? 0.35 : 1}
              onMouseEnter={() => onHover(d.label)} onMouseLeave={() => onHover(null)}
              style={{ cursor: "pointer", transition: "stroke-width 0.15s ease, opacity 0.15s ease" }} />
          );
          offset += frac * c;
          return el;
        })}
      </g>
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.24} fontWeight="800" fill="#0F172A" style={{ transition: "font-size 0.15s" }}>
        {hoveredEntry ? hoveredEntry.count : total}
      </text>
      <text x="50%" y="68%" textAnchor="middle" dominantBaseline="central" fontSize={size * 0.095} fontWeight="600" fill="#94A3B8" style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {hoveredEntry ? (typeof hoveredEntry.label === "string" ? hoveredEntry.label.replace(/_/g, " ").slice(0, 12) : hoveredEntry.label) : "total"}
      </text>
    </svg>
  );
}

/* ── Legend list paired with a DonutChart ── */
function DonutLegend({ data, capitalize = true, hovered, onHover }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0) return <p style={{ color: "#94A3B8", fontSize: "13px", padding: "8px 0" }}>No data</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1, minWidth: 0 }}>
      {data.map(d => {
        const isHovered = hovered === d.label;
        return (
          <div key={d.label}
            onMouseEnter={() => onHover(d.label)} onMouseLeave={() => onHover(null)}
            style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px", cursor: "pointer", padding: "3px 6px", margin: "0 -6px", borderRadius: "7px", background: isHovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
            <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: d.color, flexShrink: 0, transform: isHovered ? "scale(1.25)" : "scale(1)", transition: "transform 0.15s" }} />
            <span style={{ flex: 1, minWidth: 0, color: isHovered ? "#0F172A" : "#374151", fontWeight: isHovered ? "700" : "600", textTransform: capitalize ? "capitalize" : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeof d.label === "string" ? d.label.replace(/_/g, " ") : d.label}</span>
            <span style={{ fontWeight: "700", color: "#0F172A" }}>{d.count}</span>
            <span style={{ color: "#94A3B8", fontSize: "11px", width: "34px", textAlign: "right" }}>{total ? Math.round((d.count / total) * 100) : 0}%</span>
          </div>
        );
      })}
    </div>
  );
}

/* ── A card panel combining a donut chart + legend for a status/category breakdown ── */
function DonutPanel({ title, sub, data, loading, skeletonRows = 3 }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
          <Shimmer w="108px" h="108px" r="50%" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1 }}>
            {Array.from({ length: skeletonRows }).map((_, i) => <Shimmer key={i} h="14px" />)}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <DonutChart data={data} hovered={hovered} onHover={setHovered} />
          <DonutLegend data={data} hovered={hovered} onHover={setHovered} />
        </div>
      )}
    </div>
  );
}

/* ── Horizontal bar chart: one bar per category, scaled to the max value.
   Hovering a row brightens/lifts its bar and highlights the row background. */
function BarChart({ data, barHeight = 10 }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0) return <p style={{ color: "#94A3B8", fontSize: "13px", padding: "8px 0" }}>No data</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "13px" }}>
      {data.map((d, i) => {
        const isHovered = hovered === d.label;
        const pct = total ? Math.round((d.count / total) * 100) : 0;
        return (
          <div key={d.label}
            onMouseEnter={() => setHovered(d.label)} onMouseLeave={() => setHovered(null)}
            style={{ cursor: "pointer", padding: "5px 7px", margin: "-5px -7px", borderRadius: "9px", background: isHovered ? "#F8FAFC" : "transparent", transition: "background 0.15s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: isHovered ? "700" : "600", color: isHovered ? "#0F172A" : "#1E293B", textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {typeof d.label === "string" ? d.label.replace(/_/g, " ") : d.label}
              </span>
              <span style={{ fontSize: "12.5px", fontWeight: "700", color: d.color, flexShrink: 0, marginLeft: "8px" }}>
                {d.sub && <span style={{ color: "#16A34A", fontWeight: 600, marginRight: "8px" }}>{d.sub}</span>}
                {d.count} <span style={{ color: "#94A3B8", fontWeight: 600 }}>({pct}%)</span>
              </span>
            </div>
            <div style={{ height: `${barHeight}px`, background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" }}>
              <div style={{
                width: `${(d.count / max) * 100}%`, height: "100%", borderRadius: "100px",
                background: d.color,
                filter: isHovered ? "brightness(1.12)" : "none",
                transform: isHovered ? "scaleY(1.25)" : "scaleY(1)",
                transformOrigin: "center",
                boxShadow: isHovered ? `0 2px 10px ${d.color}66` : "none",
                transition: "width 0.6s ease, filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Card panel wrapping a BarChart, mirroring DonutPanel's chrome ── */
function BarPanel({ title, sub, data, loading, skeletonRows = 4 }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {Array.from({ length: skeletonRows }).map((_, i) => <Shimmer key={i} h="24px" />)}
        </div>
      ) : (
        <BarChart data={data} />
      )}
    </div>
  );
}

/* ── Vertical (column) bar chart — bars rise from a shared baseline with a
   value bubble that pops above the hovered column. Good for comparing a
   handful of categories side by side instead of stacking them as rows. */
function VerticalBarChart({ data, height = 180 }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(...data.map(d => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);
  if (data.length === 0) return <p style={{ color: "#94A3B8", fontSize: "13px", padding: "8px 0" }}>No data</p>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: `${height}px`, padding: "28px 4px 0" }}>
      {data.map(d => {
        const isHovered = hovered === d.label;
        const pct = total ? Math.round((d.count / total) * 100) : 0;
        const barPct = Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0);
        return (
          <div key={d.label}
            onMouseEnter={() => setHovered(d.label)} onMouseLeave={() => setHovered(null)}
            style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", cursor: "pointer", position: "relative" }}>
            {isHovered && (
              <div style={{ position: "absolute", bottom: `calc(${barPct}% + 10px)`, background: "#0F172A", color: "#FFF", borderRadius: "7px", padding: "5px 9px", fontSize: "11.5px", fontWeight: 700, whiteSpace: "nowrap", boxShadow: "0 6px 16px rgba(0,0,0,0.2)", zIndex: 2 }}>
                {d.count} <span style={{ color: "#94A3B8", fontWeight: 600 }}>({pct}%)</span>
              </div>
            )}
            <div style={{ width: "100%", maxWidth: "42px", height: "100%", display: "flex", alignItems: "flex-end", borderRadius: "7px 7px 0 0", overflow: "hidden", background: "#F8FAFC" }}>
              <div style={{
                width: "100%", height: `${barPct}%`, background: d.color, borderRadius: "6px 6px 0 0",
                filter: isHovered ? "brightness(1.12)" : "none",
                transform: isHovered ? "scaleX(1.12)" : "scaleX(1)",
                transformOrigin: "bottom",
                boxShadow: isHovered ? `0 -2px 12px ${d.color}55` : "none",
                transition: "height 0.6s ease, filter 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
              }} />
            </div>
            <span style={{ marginTop: "8px", fontSize: "11px", fontWeight: isHovered ? 700 : 600, color: isHovered ? "#0F172A" : "#64748B", textTransform: "capitalize", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
              {typeof d.label === "string" ? d.label.replace(/_/g, " ") : d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Card panel wrapping a VerticalBarChart ── */
function VerticalBarPanel({ title, sub, data, loading, height = 180 }) {
  return (
    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>{title}</h3>
      <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "6px" }}>{sub}</p>
      {loading ? (
        <div style={{ display: "flex", alignItems: "flex-end", gap: "10px", height: `${height}px`, padding: "28px 4px 0" }}>
          {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} w="100%" h={`${30 + Math.random() * 60}%`} r="6px 6px 0 0" />)}
        </div>
      ) : (
        <VerticalBarChart data={data} height={height} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AdminReports() {
  const [period, setPeriod] = useState(1); // index into PERIODS
  const [loading, setLoading] = useState(true);

  // KPIs
  const [kpis, setKpis] = useState({ users: 0, usersPrev: 0, businesses: 0, bizPrev: 0, requests: 0, reqPrev: 0, shifts: 0, shiftsPrev: 0 });

  // Chart data
  const [chartLabels, setChartLabels] = useState([]);
  const [chartSeries, setChartSeries] = useState([]);

  // Tables
  const [bizTable, setBizTable]           = useState([]);
  const [requestsByStatus, setReqStatus]  = useState([]);
  const [shiftsByStatus, setShiftStatus]  = useState([]);
  const [usersByRole, setUsersByRole]     = useState([]);
  const [leaveStats, setLeaveStats]       = useState([]);
  const [workerStats, setWorkerStats]     = useState([]);
  const [industryStats, setIndustryStats] = useState([]);

  // Raw for export
  const [rawData, setRawData] = useState({});

  const days = PERIODS[period].days;

  const load = useCallback(async () => {
    setLoading(true);

    const now = new Date();
    const periodStart = new Date(now); periodStart.setDate(now.getDate() - days);
    const prevStart   = new Date(now); prevStart.setDate(now.getDate() - days * 2);
    const pStartISO = periodStart.toISOString();
    const prevISO   = prevStart.toISOString();

    const [
      { data: usersAll },
      { data: bizAll },
      { data: reqAll },
      { data: shiftsAll },
      { data: attendAll },
      { data: leaveAll },
    ] = await Promise.all([
      supabase.from("users").select("user_id, role, created_at, is_active"),
      supabase.from("businesses").select("business_id, name, industry, created_at, outlets(outlet_id, staff(staff_id))"),
      supabase.from("krewby_requests").select("request_id, status, created_at, shift_date"),
      supabase.from("shifts").select("shift_id, status, shift_date, outlet_id"),
      supabase.from("attendance").select("attendance_id, status, clock_in"),
      supabase.from("availability").select("request_id, status, leave_type, start_date"),
    ]);

    const users = usersAll || [];
    const biz   = bizAll   || [];
    const reqs  = reqAll   || [];
    const shifts = shiftsAll || [];
    const leave = leaveAll || [];

    // ── KPIs ──
    const inPeriod = (ts) => ts && new Date(ts) >= periodStart;
    const inPrev   = (ts) => ts && new Date(ts) >= prevStart && new Date(ts) < periodStart;

    const newUsers  = users.filter(u => inPeriod(u.created_at)).length;
    const prevUsers = users.filter(u => inPrev(u.created_at)).length;
    const newBiz    = biz.filter(b => inPeriod(b.created_at)).length;
    const prevBiz   = biz.filter(b => inPrev(b.created_at)).length;
    const newReqs   = reqs.filter(r => inPeriod(r.created_at)).length;
    const prevReqs  = reqs.filter(r => inPrev(r.created_at)).length;
    const newShifts = shifts.filter(s => inPeriod(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    const prevShifts= shifts.filter(s => inPrev(s.shift_date ? s.shift_date + "T00:00:00" : null)).length;
    setKpis({ users: newUsers, usersPrev: prevUsers, businesses: newBiz, bizPrev: prevBiz, requests: newReqs, reqPrev: prevReqs, shifts: newShifts, shiftsPrev: prevShifts });

    // ── Chart: daily series ──
    const dayCount = Math.min(days, 30);
    const dayLabels = Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(5, 10); // MM-DD
    });
    const dayKeys = dayLabels.map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (dayCount - 1 - i));
      return d.toISOString().slice(0, 10);
    });

    function dailyCount(items, getDate) {
      const map = {};
      items.forEach(it => {
        const d = getDate(it)?.slice(0, 10);
        if (d && dayKeys.includes(d)) map[d] = (map[d] || 0) + 1;
      });
      return dayKeys.map(k => map[k] || 0);
    }

    setChartLabels(dayLabels);
    setChartSeries([
      { label: "New Users",       data: dailyCount(users, u => u.created_at), color: "#2563EB" },
      { label: "Krewby Requests", data: dailyCount(reqs,  r => r.created_at), color: "#DB2777" },
      { label: "Shifts",          data: dailyCount(shifts, s => s.shift_date ? s.shift_date : null), color: "#D97706" },
    ]);

    // ── Businesses table ──
    const bizRows = biz.map(b => ({
      name: b.name,
      industry: b.industry || "—",
      outlets: b.outlets?.length ?? 0,
      staff: b.outlets?.reduce((s, o) => s + (o.staff?.length ?? 0), 0) ?? 0,
      registered: b.created_at ? new Date(b.created_at).toLocaleDateString("en-GB") : "—",
    })).sort((a, b) => b.outlets - a.outlets);
    setBizTable(bizRows);

    // ── Businesses by industry ──
    const industryMap = {};
    biz.forEach(b => { const k = b.industry || "unspecified"; industryMap[k] = (industryMap[k] || 0) + 1; });
    setIndustryStats(Object.entries(industryMap).map(([label, count], i) => ({ label, count, color: PALETTE[i % PALETTE.length] })).sort((a, b) => b.count - a.count));

    // ── Krewby requests by status ──
    const reqMap = {};
    reqs.forEach(r => { reqMap[r.status] = (reqMap[r.status] || 0) + 1; });
    setReqStatus(Object.entries(reqMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    // ── Shifts by status ──
    const shiftMap = {};
    shifts.forEach(s => { shiftMap[s.status] = (shiftMap[s.status] || 0) + 1; });
    setShiftStatus(Object.entries(shiftMap).map(([s, c]) => ({ status: s, count: c })).sort((a, b) => b.count - a.count));

    // ── Users by role ──
    const roleMap = {};
    users.forEach(u => {
      const label = ROLE_LABELS[u.role] || u.role;
      if (!roleMap[label]) roleMap[label] = { total: 0, active: 0 };
      roleMap[label].total++;
      if (u.is_active) roleMap[label].active++;
    });
    setUsersByRole(Object.entries(roleMap).map(([role, v]) => ({ role, ...v })).sort((a, b) => b.total - a.total));

    // ── Leave/availability ──
    const leaveMap = {};
    leave.forEach(l => { leaveMap[l.status] = (leaveMap[l.status] || 0) + 1; });
    setLeaveStats(Object.entries(leaveMap).map(([s, c]) => ({ status: s, count: c })));

    // ── Worker stats ──
    const workerData = users.filter(u => u.role === "krewby_casual_worker");
    setWorkerStats([
      { label: "Total Workers", value: workerData.length },
      { label: "Active",        value: workerData.filter(u => u.is_active).length },
      { label: "Inactive",      value: workerData.filter(u => !u.is_active).length },
    ]);

    // Store raw for export
    setRawData({ users, biz: bizRows, reqs, shifts, leave, period: PERIODS[period].label });

    setLoading(false);
  }, [days, period]);

  useEffect(() => { load(); }, [load]);

  // ── CSV export ──
  function downloadCSV() {
    const today = new Date().toISOString().slice(0, 10);
    const lines = [];

    lines.push(`Krewby Platform Report — ${PERIODS[period].label} period`);
    lines.push(`Generated,${today}`);
    lines.push("");

    lines.push("KPI SUMMARY");
    lines.push("Metric,This Period,Previous Period,Change %");
    lines.push(`New Users,${kpis.users},${kpis.usersPrev},${delta(kpis.users, kpis.usersPrev)}%`);
    lines.push(`New Businesses,${kpis.businesses},${kpis.bizPrev},${delta(kpis.businesses, kpis.bizPrev)}%`);
    lines.push(`Krewby Requests,${kpis.requests},${kpis.reqPrev},${delta(kpis.requests, kpis.reqPrev)}%`);
    lines.push(`Shifts,${kpis.shifts},${kpis.shiftsPrev},${delta(kpis.shifts, kpis.shiftsPrev)}%`);
    lines.push("");

    lines.push("BUSINESSES");
    lines.push("Name,Industry,Outlets,Staff,Registered");
    bizTable.forEach(b => lines.push(`"${b.name}","${b.industry}",${b.outlets},${b.staff},${b.registered}`));
    lines.push("");

    lines.push("USERS BY ROLE");
    lines.push("Role,Total,Active");
    usersByRole.forEach(r => lines.push(`"${r.role}",${r.total},${r.active}`));
    lines.push("");

    lines.push("KREWBY REQUESTS BY STATUS");
    lines.push("Status,Count");
    requestsByStatus.forEach(r => lines.push(`${r.status},${r.count}`));
    lines.push("");

    lines.push("SHIFTS BY STATUS");
    lines.push("Status,Count");
    shiftsByStatus.forEach(s => lines.push(`${s.status},${s.count}`));
    lines.push("");

    lines.push("LEAVE REQUESTS BY STATUS");
    lines.push("Status,Count");
    leaveStats.forEach(l => lines.push(`${l.status},${l.count}`));
    lines.push("");

    lines.push("DAILY ACTIVITY");
    lines.push(["Date", ...chartSeries.map(s => s.label)].join(","));
    chartLabels.forEach((lbl, i) => {
      lines.push([lbl, ...chartSeries.map(s => s.data[i] ?? 0)].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `krewby-report-${PERIODS[period].label}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── PDF export ──
  function downloadPDF() {
    const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    let y = 15;

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, pageW, 24, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Krewby — Platform Report", 14, 13);
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Period: ${PERIODS[period].label}   Generated: ${today}`, pageW - 14, 13, { align: "right" });
    y = 34;

    // KPIs
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("KPI Summary", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Metric", "This Period", "Prev Period", "Δ %"]],
      body: [
        ["New Users",       kpis.users,      kpis.usersPrev,  `${delta(kpis.users, kpis.usersPrev)}%`],
        ["New Businesses",  kpis.businesses, kpis.bizPrev,    `${delta(kpis.businesses, kpis.bizPrev)}%`],
        ["Krewby Requests", kpis.requests,   kpis.reqPrev,    `${delta(kpis.requests, kpis.reqPrev)}%`],
        ["Shifts",          kpis.shifts,     kpis.shiftsPrev, `${delta(kpis.shifts, kpis.shiftsPrev)}%`],
      ],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // Businesses
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Businesses", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Business", "Industry", "Outlets", "Staff", "Registered"]],
      body: bizTable.map(b => [b.name, b.industry, b.outlets, b.staff, b.registered]),
      headStyles: { fillColor: [37, 99, 235], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Users by Role", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Role", "Total", "Active"]],
      body: usersByRole.map(r => [r.role, r.total, r.active]),
      headStyles: { fillColor: [8, 145, 178], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    // Side by side: requests + shifts
    autoTable(doc, {
      startY: y,
      head: [["Krewby Requests", "Count"]],
      body: requestsByStatus.map(r => [r.status, r.count]),
      headStyles: { fillColor: [219, 39, 119], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: 14, right: pageW / 2 + 2 },
    });
    autoTable(doc, {
      startY: y,
      head: [["Shifts", "Count"]],
      body: shiftsByStatus.map(s => [s.status, s.count]),
      headStyles: { fillColor: [217, 119, 6], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 1: { halign: "right" } },
      margin: { left: pageW / 2 + 2, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;

    if (y > 210) { doc.addPage(); y = 20; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Daily Activity", 14, y); y += 3;
    autoTable(doc, {
      startY: y,
      head: [["Date", ...chartSeries.map(s => s.label)]],
      body: chartLabels.map((lbl, i) => [lbl, ...chartSeries.map(s => s.data[i] ?? 0)]),
      headStyles: { fillColor: [124, 58, 237], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: Object.fromEntries(chartSeries.map((_, i) => [i + 1, { halign: "right" }])),
      margin: { left: 14, right: 14 },
    });

    doc.save(`krewby-report-${PERIODS[period].label}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <AdminLayout title="Reports">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Platform Analytics</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Real-time overview across all platform activity</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Period tabs */}
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "3px", gap: "2px" }}>
              {PERIODS.map((p, i) => (
                <button key={p.label} onClick={() => setPeriod(i)} className="rpt-tab"
                  style={{ padding: "6px 16px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "background 0.15s", background: period === i ? "#FFF" : "transparent", color: period === i ? "#0F172A" : "#64748B", boxShadow: period === i ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={downloadCSV} disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#374151", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
              <Download size={14} /> CSV
            </button>
            <button onClick={downloadPDF} disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: "none", background: "#0F172A", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.5 : 1 }}>
              <Download size={14} /> PDF
            </button>
          </div>
        </div>

        {/* ── KPI Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "14px", marginBottom: "20px" }}>
          <KpiCard loading={loading} icon={<Users size={18} />} label="New Users"       value={kpis.users}      pct={delta(kpis.users, kpis.usersPrev)}      sub={`vs prev ${PERIODS[period].label}`} color="#2563EB" bg="#EFF6FF" />
          <KpiCard loading={loading} icon={<Building2 size={18} />} label="New Businesses"  value={kpis.businesses} pct={delta(kpis.businesses, kpis.bizPrev)}    sub={`vs prev ${PERIODS[period].label}`} color="#059669" bg="#ECFDF5" />
          <KpiCard loading={loading} icon={<ClipboardList size={18} />} label="Krewby Requests" value={kpis.requests}   pct={delta(kpis.requests, kpis.reqPrev)}     sub={`vs prev ${PERIODS[period].label}`} color="#DB2777" bg="#FDF2F8" />
          <KpiCard loading={loading} icon={<CalendarDays size={18} />} label="Shifts"          value={kpis.shifts}     pct={delta(kpis.shifts, kpis.shiftsPrev)}    sub={`vs prev ${PERIODS[period].label}`} color="#D97706" bg="#FFFBEB" />
        </div>

        {/* ── Activity Chart ── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A" }}>Daily Activity</h3>
              <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Last {Math.min(days, 30)} days</p>
            </div>
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
              {chartSeries.map(s => (
                <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "3px", borderRadius: "2px", background: s.color }} />
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748B" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
          {loading ? (
            <div style={{ height: "280px", display: "flex", alignItems: "flex-end", gap: "4px" }}>
              {Array.from({ length: 20 }).map((_, i) => <Shimmer key={i} w="100%" h={`${20 + Math.random() * 80}px`} r="3px" />)}
            </div>
          ) : (
            <LineChart series={chartSeries} labels={chartLabels} height={280} />
          )}
        </div>

        {/* ── Businesses by Industry (vertical bar) + Krewby Requests (donut) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <VerticalBarPanel title="Businesses by Industry" sub="All registered businesses" loading={loading}
            data={industryStats} />
          <DonutPanel title="Krewby Requests" sub="Breakdown by status (all time)" loading={loading}
            data={requestsByStatus.map((r, i) => ({ label: r.status, count: r.count, color: STATUS_STYLE[r.status]?.color || PALETTE[i % PALETTE.length] }))} />
        </div>

        {/* ── Shifts (vertical bar) + Leave Requests (donut) ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
          <VerticalBarPanel title="Shifts" sub="Breakdown by status (all time)" loading={loading}
            data={shiftsByStatus.map((r, i) => ({ label: r.status, count: r.count, color: STATUS_STYLE[r.status]?.color || PALETTE[i % PALETTE.length] }))} />
          <DonutPanel title="Leave Requests" sub="All time, by approval status" loading={loading}
            data={leaveStats.map((l, i) => ({ label: l.status, count: l.count, color: STATUS_STYLE[l.status]?.color || PALETTE[i % PALETTE.length] }))} />
        </div>

        {/* ── Users by Role (bar) ── */}
        <BarPanel title="Users by Role" sub="All registered accounts" loading={loading} skeletonRows={5}
          data={usersByRole.map((r, i) => ({ label: r.role, count: r.total, color: PALETTE[i % PALETTE.length], sub: `${r.active} active` }))} />
        <div style={{ marginBottom: "20px" }} />

        {/* ── Businesses Table (detail) ── */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", marginBottom: "4px" }}>Businesses</h3>
          <p style={{ fontSize: "12px", color: "#94A3B8", marginBottom: "16px" }}>Click a column header to sort</p>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {Array.from({ length: 4 }).map((_, i) => <Shimmer key={i} h="36px" />)}
            </div>
          ) : (
            <SortableTable
              columns={["Business", "Industry", "Outlets", "Staff", "Registered"]}
              rows={bizTable.map(b => [b.name, b.industry, b.outlets, b.staff, b.registered])}
              emptyMsg="No businesses yet"
            />
          )}
        </div>

      </div>
    </AdminLayout>
  );
}
