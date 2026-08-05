import { useState } from "react";
import { Users, Award, TrendingUp, BarChart3, Scale, Check, RotateCcw, Minus, Plus } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("reg-alloc-kf")) {
  const s = document.createElement("style");
  s.id = "reg-alloc-kf";
  s.textContent = `
    @keyframes allocFadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .alloc-row { transition: background 0.15s; border-radius: 10px; }
    .alloc-row:hover { background: #F8FAFC; }
    .alloc-btn { transition: all 0.15s; }
    .alloc-btn:hover:not(:disabled) { transform: scale(1.1); }
    .alloc-btn:active:not(:disabled) { transform: scale(0.95); }
  `;
  document.head.appendChild(s);
}

const WEIGHTS = [
  { key: "weight_availability", label: "Availability", icon: Users, color: "#2563EB" },
  { key: "weight_skills", label: "Skills match", icon: Award, color: "#7C3AED" },
  { key: "weight_attendance", label: "Attendance", icon: TrendingUp, color: "#059669" },
  { key: "weight_performance", label: "Performance", icon: BarChart3, color: "#EA580C" },
  { key: "weight_workload", label: "Workload", icon: Scale, color: "#0891B2" },
];

const DEFAULTS = { weight_availability: 40, weight_skills: 30, weight_attendance: 15, weight_performance: 10, weight_workload: 5 };

function DonutChart({ weights, size = 200 }) {
  const total = weights.reduce((s, w) => s + w.value, 0);
  if (total === 0) return null;
  const strokeW = 28;
  const r = (size - strokeW) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  const gap = 0.008;
  const arcs = weights.filter(w => w.value > 0).map(w => {
    const pct = w.value / total;
    const offset = cumulative;
    cumulative += pct;
    return { ...w, pct, offset };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.06))" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={strokeW} />
      {arcs.map((arc, i) => {
        const dashLen = Math.max(0, (arc.pct - gap) * circumference);
        return (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={arc.color} strokeWidth={strokeW}
            strokeDasharray={`${dashLen} ${circumference}`}
            strokeDashoffset={`${-(arc.offset + gap / 2) * circumference}`}
            strokeLinecap="round"
            style={{ transition: "all 0.5s cubic-bezier(.4,0,.2,1)" }} />
        );
      })}
    </svg>
  );
}

export default function StepAllocationPrefs({ form, setField, error, onSubmit, onSkip, onBack, loading }) {
  const total = WEIGHTS.reduce((sum, w) => sum + (form[w.key] || 0), 0);
  const isValid = total === 100;

  function adjust(key, delta) {
    const current = form[key] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    if (newVal === current) return;

    const others = WEIGHTS.filter(w => w.key !== key);
    const othersTotal = others.reduce((s, w) => s + form[w.key], 0);

    setField(key, newVal);

    if (othersTotal === 0 && delta < 0) return;
    if (othersTotal === 0) return;

    const remaining = 100 - newVal;
    let distributed = 0;
    others.forEach((w, i) => {
      if (i === others.length - 1) {
        setField(w.key, Math.max(0, remaining - distributed));
      } else {
        const share = Math.round((form[w.key] / othersTotal) * remaining);
        setField(w.key, Math.max(0, share));
        distributed += Math.max(0, share);
      }
    });
  }

  function resetDefaults() {
    Object.entries(DEFAULTS).forEach(([k, v]) => setField(k, v));
  }

  const donutData = WEIGHTS.map(w => ({ color: w.color, value: form[w.key] || 0 }));

  return (
    <>
      <button onClick={onBack} style={backBtn}>← Back</button>

      <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Smart allocation</h2>
      <p style={{ fontSize: "21px", color: "#64748B", marginBottom: "24px" }}>Configure how Krewby's AI ranks workers for shift recommendations.</p>

      {error && <div style={errorBox}>{error}</div>}

      {/* Main card */}
      <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "20px", padding: "32px", marginBottom: "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: "allocFadeIn 0.4s ease both" }}>

        {/* Donut + center text */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px", position: "relative" }}>
          <div style={{ position: "relative", width: "200px", height: "200px" }}>
            <DonutChart weights={donutData} />
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "32px", fontWeight: "800", color: isValid ? "#0F172A" : "#DC2626", lineHeight: 1, transition: "color 0.3s" }}>{total}</span>
              <span style={{ fontSize: "19px", color: "#94A3B8", fontWeight: "600", marginTop: "2px" }}>out of 100%</span>
              {isValid && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "18px", fontWeight: "700", color: "#16A34A", marginTop: "6px" }}>
                  <Check size={11} strokeWidth={3} /> Balanced
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Weight rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {WEIGHTS.map(w => {
            const Icon = w.icon;
            const val = form[w.key] || 0;
            return (
              <div key={w.key} className="alloc-row"
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px" }}>
                {/* Color dot + icon */}
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: w.color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={15} color={w.color} strokeWidth={2.2} />
                </div>

                {/* Label */}
                <span style={{ flex: 1, fontSize: "21px", fontWeight: "600", color: "#1E293B" }}>{w.label}</span>

                {/* Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button type="button" className="alloc-btn" onClick={() => adjust(w.key, -5)} disabled={val <= 0}
                    style={{ width: "28px", height: "28px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: val > 0 ? "#fff" : "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", cursor: val > 0 ? "pointer" : "not-allowed", color: val > 0 ? "#475569" : "#CBD5E1" }}>
                    <Minus size={13} strokeWidth={2.5} />
                  </button>

                  <div style={{ width: "52px", textAlign: "center", background: w.color + "10", borderRadius: "8px", padding: "4px 0" }}>
                    <span style={{ fontSize: "21px", fontWeight: "800", color: w.color }}>{val}%</span>
                  </div>

                  <button type="button" className="alloc-btn" onClick={() => adjust(w.key, 5)} disabled={val >= 100}
                    style={{ width: "28px", height: "28px", borderRadius: "8px", border: `1.5px solid ${w.color}40`, background: w.color + "10", display: "flex", alignItems: "center", justifyContent: "center", cursor: val < 100 ? "pointer" : "not-allowed", color: w.color }}>
                    <Plus size={13} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reset */}
        <div style={{ textAlign: "center", marginTop: "16px" }}>
          <button type="button" onClick={resetDefaults}
            style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "19px", fontWeight: "600", color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px", transition: "color 0.15s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#475569"}
            onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}>
            <RotateCcw size={12} /> Reset to defaults
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onSkip}
          style={{ flex: 1, padding: "14px", background: "#fff", color: "#64748B", border: "1.5px solid #E2E8F0", borderRadius: "12px", fontSize: "22px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" }}>
          Skip for now
        </button>
        <button type="button" onClick={onSubmit} disabled={loading}
          style={{ flex: 1, padding: "14px", background: loading ? "#93C5FD" : "#2563EB", color: "#fff", border: "none", borderRadius: "12px", fontSize: "22px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.15s", boxShadow: loading ? "none" : "0 2px 8px rgba(37,99,235,0.3)" }}>
          {loading ? "Creating account…" : "Create my business →"}
        </button>
      </div>
    </>
  );
}

const backBtn = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "20px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" };
const errorBox = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "20px", color: "#DC2626" };
