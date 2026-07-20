import { useState, useEffect } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import SearchableSelect from "../../components/SearchableSelect";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { UpgradePlanModal } from "../../components/UpgradePlanModal";
import { SG_HOLIDAYS } from "../../data/sgHolidays";
import {
  Clock, Calendar, Save, RotateCcw, Check, Minus, Plus,
  Users, Award, TrendingUp, BarChart3, Scale, Loader2, Settings2, Zap, Pencil, X, Building2, CreditCard,
} from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const PLAN_BADGE = {
  free:       { label: "Free",       color: "#64748B", bg: "#F1F5F9" },
  premium:    { label: "Premium",    color: "#2563EB", bg: "#EFF6FF" },
  enterprise: { label: "Enterprise", color: "#7C3AED", bg: "#F5F3FF" },
};

const WEIGHTS = [
  { key: "weight_availability", label: "Availability", icon: Users, color: "#2563EB" },
  { key: "weight_skills", label: "Skills match", icon: Award, color: "#7C3AED" },
  { key: "weight_attendance", label: "Attendance", icon: TrendingUp, color: "#059669" },
  { key: "weight_performance", label: "Performance", icon: BarChart3, color: "#EA580C" },
  { key: "weight_workload", label: "Workload", icon: Scale, color: "#0891B2" },
];

const ALLOC_DEFAULTS = { weight_availability: 40, weight_skills: 30, weight_attendance: 15, weight_performance: 10, weight_workload: 5 };

const DEFAULT_SETTINGS = {
  operating_days: [1,1,1,1,1,0,0],
  open_time: "09:00", close_time: "18:00",
  holidays: SG_HOLIDAYS.map(h => ({ ...h })),
  work_hours_day: 8, max_work_hours_day: 12,
  max_consecutive_days: 6, allow_overtime: false, min_workers_per_assignment: 1,
};

function DonutChart({ weights, size = 160 }) {
  const total = weights.reduce((s, w) => s + w.value, 0);
  if (total === 0) return null;
  const strokeW = 22;
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

function parseSettings(s) {
  return {
    operating_days: s.operating_days ? s.operating_days.split("").map(Number) : [1,1,1,1,1,0,0],
    open_time: s.open_time?.slice(0, 5) || "09:00",
    close_time: s.close_time?.slice(0, 5) || "18:00",
    holidays: s.holidays?.length ? s.holidays : SG_HOLIDAYS.map(h => ({ ...h })),
    work_hours_day: s.work_hours_day ?? 8,
    max_work_hours_day: s.max_work_hours_day ?? 12,
    max_consecutive_days: s.max_consecutive_days ?? 6,
    allow_overtime: s.allow_overtime ?? false,
    min_workers_per_assignment: s.min_workers_per_assignment ?? 1,
  };
}

export default function BOSettings() {
  const [branches, setBranches] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [settings, setSettings] = useState(null);
  const [alloc, setAlloc] = useState(null);

  const [savedSettings, setSavedSettings] = useState(null);
  const [savedAlloc, setSavedAlloc] = useState(null);

  const [editingSetup, setEditingSetup] = useState(false);
  const [editingAlloc, setEditingAlloc] = useState(false);

  const [plan, setPlan] = useState(null);
  const [showUpgrade, setShowUpgrade] = useState(false);

  useEffect(() => {
    api.get("/api/business/branches").then(r => {
      const list = r.branches || [];
      setBranches(list);
      if (list.length > 0) setSelectedId(list[0].branch_id);
    });
    const user = getUser();
    if (user?.user_id) {
      supabase.from("businesses").select("plan").eq("owner_id", user.user_id).maybeSingle()
        .then(({ data }) => setPlan(data?.plan || "free"));
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadBranchSettings(selectedId);
  }, [selectedId]);

  async function loadBranchSettings(branchId) {
    setLoading(true);
    setEditingSetup(false);
    setEditingAlloc(false);
    setError("");
    setSuccess("");
    try {
      const r = await api.get(`/api/business/branches/${branchId}/settings`);
      const s = r.settings ? parseSettings(r.settings) : { ...DEFAULT_SETTINGS };
      const a = r.allocation ? { ...ALLOC_DEFAULTS, ...r.allocation } : { ...ALLOC_DEFAULTS };
      setSettings(s);
      setSavedSettings(JSON.parse(JSON.stringify(s)));
      setAlloc(a);
      setSavedAlloc({ ...a });
    } catch { }
    finally { setLoading(false); }
  }

  function setS(key, val) { setSettings(p => ({ ...p, [key]: val })); }
  function setA(key, val) { setAlloc(p => ({ ...p, [key]: val })); }

  function toggleDay(i) {
    if (!editingSetup) return;
    const days = [...settings.operating_days];
    days[i] = days[i] === 1 ? 0 : 1;
    setS("operating_days", days);
  }

  function toggleHoliday(i) {
    if (!editingSetup) return;
    const holidays = [...settings.holidays];
    holidays[i] = { ...holidays[i], enabled: !holidays[i].enabled };
    setS("holidays", holidays);
  }

  function cancelSetup() {
    setSettings(JSON.parse(JSON.stringify(savedSettings)));
    setEditingSetup(false);
    setError("");
  }

  function cancelAlloc() {
    setAlloc({ ...savedAlloc });
    setEditingAlloc(false);
    setError("");
  }

  function adjustWeight(key, delta) {
    if (!editingAlloc) return;
    const current = alloc[key] || 0;
    const newVal = Math.max(0, Math.min(100, current + delta));
    if (newVal === current) return;
    const others = WEIGHTS.filter(w => w.key !== key);
    const othersTotal = others.reduce((s, w) => s + alloc[w.key], 0);
    setA(key, newVal);
    if (othersTotal === 0) return;
    const remaining = 100 - newVal;
    let distributed = 0;
    others.forEach((w, i) => {
      if (i === others.length - 1) {
        setA(w.key, Math.max(0, remaining - distributed));
      } else {
        const share = Math.round((alloc[w.key] / othersTotal) * remaining);
        setA(w.key, Math.max(0, share));
        distributed += Math.max(0, share);
      }
    });
  }

  async function saveSettings() {
    setSaving("settings"); setError(""); setSuccess("");
    try {
      await api.put(`/api/business/branches/${selectedId}/settings`, {
        ...settings,
        operating_days: settings.operating_days.join(""),
      });
      setSavedSettings(JSON.parse(JSON.stringify(settings)));
      setEditingSetup(false);
      setSuccess("Branch settings saved.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  }

  async function saveAllocation() {
    setSaving("alloc"); setError(""); setSuccess("");
    const total = WEIGHTS.reduce((s, w) => s + (alloc[w.key] || 0), 0);
    if (total !== 100) { setError("Weights must sum to 100%."); setSaving(null); return; }
    try {
      await api.put(`/api/business/branches/${selectedId}/settings/allocation`, alloc);
      setSavedAlloc({ ...alloc });
      setEditingAlloc(false);
      setSuccess("Allocation preferences saved.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) { setError(err.message); }
    finally { setSaving(null); }
  }

  const allocTotal = WEIGHTS.reduce((s, w) => s + (alloc?.[w.key] || 0), 0);
  const allocValid = allocTotal === 100;
  const donutData = WEIGHTS.map(w => ({ color: w.color, value: alloc?.[w.key] || 0 }));
  const disabledInput = { ...inputStyle, background: "#F8FAFC", color: "#64748B", cursor: "default" };

  return (
    <BusinessOwnerLayout title="Settings">
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", overflow: "hidden" }}>

        {/* Branch selector bar */}
        <div style={{ padding: "16px 32px", borderBottom: "1px solid #F1F5F9", background: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Building2 size={16} color="#64748B" />
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#64748B" }}>Branch:</span>
            <SearchableSelect
              options={branches.map(o => ({ value: o.branch_id, label: o.name }))}
              value={selectedId || ""}
              onChange={v => setSelectedId(Number(v))}
              clearable={false}
              style={{ minWidth: "200px" }}
            />
            {branches.length === 0 && <span style={{ fontSize: "13px", color: "#94A3B8" }}>No branches yet</span>}
          </div>

          {/* Billing & Plan */}
          {plan && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: PLAN_BADGE[plan]?.color || "#64748B", background: PLAN_BADGE[plan]?.bg || "#F1F5F9", padding: "4px 11px", borderRadius: "100px", letterSpacing: "0.03em", textTransform: "uppercase" }}>
                {PLAN_BADGE[plan]?.label || plan} Plan
              </span>
              <button onClick={() => setShowUpgrade(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#fff", fontSize: "13px", fontWeight: "600", color: "#334155", cursor: "pointer" }}>
                <CreditCard size={14} /> Manage Plan
              </button>
            </div>
          )}
        </div>

        {showUpgrade && (
          <UpgradePlanModal
            currentPlan={plan}
            onClose={() => setShowUpgrade(false)}
            onUpgraded={newPlan => setPlan(newPlan)}
          />
        )}

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}>
            <Loader2 size={28} color="#94A3B8" style={{ animation: "spin 1s linear infinite" }} />
          </div>
        ) : !selectedId || branches.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#94A3B8" }}>
            <Building2 size={40} style={{ marginBottom: "12px" }} />
            <p style={{ fontSize: "14px" }}>No branches available. Create a branch first.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

            {/* ── LEFT COLUMN: Schedule & Rules ── */}
            <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", borderRight: "1px solid #F1F5F9" }}>

              {(error || success) && (
                <div style={{ background: error ? "#FEF2F2" : "#F0FDF4", border: `1px solid ${error ? "#FECACA" : "#BBF7D0"}`, borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: error ? "#DC2626" : "#16A34A", display: "flex", alignItems: "center", gap: "6px" }}>
                  {success && <Check size={14} strokeWidth={2.5} />}
                  {error || success}
                </div>
              )}

              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "28px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Settings2 size={20} color="#2563EB" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 style={{ fontSize: "18px", fontWeight: "800", color: "#0F172A", marginBottom: "2px" }}>Branch setup</h2>
                    <p style={{ fontSize: "12px", color: "#94A3B8" }}>Operating schedule, work rules, and public holidays</p>
                  </div>
                </div>
                {!editingSetup ? (
                  <button onClick={() => setEditingSetup(true)} style={btnEdit}>
                    <Pencil size={14} /> Edit
                  </button>
                ) : (
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={cancelSetup} style={btnCancel}>
                      <X size={14} /> Cancel
                    </button>
                    <button onClick={saveSettings} disabled={saving === "settings"} style={{ ...btnSave, opacity: saving === "settings" ? 0.7 : 1 }}>
                      {saving === "settings" ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={14} />}
                      {saving === "settings" ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>

              {/* Operating Days */}
              <p style={sectionLabel}>Operating days</p>
              <div style={{ display: "flex", gap: "8px", marginBottom: "28px", flexWrap: "wrap" }}>
                {DAYS.map((day, i) => (
                  <button key={day} type="button" onClick={() => toggleDay(i)}
                    disabled={!editingSetup}
                    style={{ padding: "8px 18px", borderRadius: "100px", border: `1.5px solid ${settings.operating_days[i] ? "#2563EB" : "#E2E8F0"}`, background: settings.operating_days[i] ? "#EFF6FF" : "#fff", color: settings.operating_days[i] ? "#2563EB" : "#94A3B8", fontSize: "13px", fontWeight: "600", cursor: editingSetup ? "pointer" : "default", transition: "all 0.15s", opacity: !editingSetup && !settings.operating_days[i] ? 0.5 : 1 }}>
                    {day}
                  </button>
                ))}
              </div>

              {/* Operating Hours */}
              <p style={sectionLabel}>Operating hours</p>
              <div style={{ display: "flex", gap: "16px", marginBottom: "28px" }}>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Open time</label>
                  <div style={{ position: "relative" }}>
                    <Clock size={14} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input type="time" value={settings.open_time} onChange={e => setS("open_time", e.target.value)}
                      disabled={!editingSetup}
                      style={{ ...(editingSetup ? inputStyle : disabledInput), paddingLeft: "34px" }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={fieldLabel}>Close time</label>
                  <div style={{ position: "relative" }}>
                    <Clock size={14} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
                    <input type="time" value={settings.close_time} onChange={e => setS("close_time", e.target.value)}
                      disabled={!editingSetup}
                      style={{ ...(editingSetup ? inputStyle : disabledInput), paddingLeft: "34px" }} />
                  </div>
                </div>
              </div>

              {/* Work Rules */}
              <p style={sectionLabel}>Work rules</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
                <NumField label="Standard hours/day" value={settings.work_hours_day} onChange={v => setS("work_hours_day", v)} min={1} max={24} disabled={!editingSetup} />
                <NumField label="Max hours/day" value={settings.max_work_hours_day} onChange={v => setS("max_work_hours_day", v)} min={1} max={24} disabled={!editingSetup} />
                <NumField label="Max consecutive days" value={settings.max_consecutive_days} onChange={v => setS("max_consecutive_days", v)} min={1} max={14} disabled={!editingSetup} />
                <NumField label="Min workers/assignment" value={settings.min_workers_per_assignment} onChange={v => setS("min_workers_per_assignment", v)} min={1} max={50} disabled={!editingSetup} />
              </div>

              {/* Overtime Toggle */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", background: "#F8FAFC", border: "1.5px solid #E2E8F0", borderRadius: "12px" }}>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>Allow overtime</p>
                  <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>Workers can be scheduled beyond standard hours</p>
                </div>
                <button type="button" onClick={() => editingSetup && setS("allow_overtime", !settings.allow_overtime)}
                  disabled={!editingSetup}
                  style={{ width: "44px", height: "24px", borderRadius: "12px", border: "none", background: settings.allow_overtime ? "#2563EB" : "#D1D5DB", cursor: editingSetup ? "pointer" : "default", position: "relative", transition: "background 0.2s", opacity: editingSetup ? 1 : 0.7 }}>
                  <div style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: settings.allow_overtime ? "23px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.15)" }} />
                </button>
              </div>
            </div>

            {/* ── RIGHT COLUMN: Holidays + Allocation ── */}
            <div style={{ width: "420px", flexShrink: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "#FAFBFE" }}>

              {/* Public Holidays */}
              <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid #F1F5F9" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                  <Calendar size={16} color="#2563EB" />
                  <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>Public holidays</h3>
                  <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px", background: "#EEF2FF", color: "#4F46E5", border: "1px solid #C7D2FE" }}>
                    SG 2026
                  </span>
                  {!editingSetup && (
                    <span style={{ fontSize: "10px", color: "#94A3B8", marginLeft: "auto" }}>Edit to change</span>
                  )}
                </div>
                <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "12px", maxHeight: "240px", overflowY: "auto" }}>
                  {settings.holidays.map((h, i) => (
                    <div key={h.date} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: i < settings.holidays.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                      <div>
                        <p style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{h.name}</p>
                        <p style={{ fontSize: "11px", color: "#94A3B8" }}>{h.date}</p>
                      </div>
                      <button type="button" onClick={() => toggleHoliday(i)}
                        disabled={!editingSetup}
                        style={{ width: "36px", height: "20px", borderRadius: "10px", border: "none", background: h.enabled ? "#22C55E" : "#D1D5DB", cursor: editingSetup ? "pointer" : "default", position: "relative", transition: "background 0.2s", flexShrink: 0, opacity: editingSetup ? 1 : 0.7 }}>
                        <div style={{ width: "14px", height: "14px", borderRadius: "50%", background: "#fff", position: "absolute", top: "3px", left: h.enabled ? "19px" : "3px", transition: "left 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.15)" }} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Smart Allocation */}
              <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Zap size={16} color="#F59E0B" />
                    <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>Smart allocation</h3>
                  </div>
                  {!editingAlloc ? (
                    <button onClick={() => setEditingAlloc(true)} style={btnEditSm}>
                      <Pencil size={12} /> Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={cancelAlloc} style={btnCancelSm}>
                        <X size={12} /> Cancel
                      </button>
                      <button onClick={saveAllocation} disabled={saving === "alloc" || !allocValid}
                        style={{ ...btnSaveSm, opacity: (saving === "alloc" || !allocValid) ? 0.6 : 1 }}>
                        {saving === "alloc" ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={12} />}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", position: "relative" }}>
                  <div style={{ position: "relative", width: "160px", height: "160px" }}>
                    <DonutChart weights={donutData} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: "26px", fontWeight: "800", color: allocValid ? "#0F172A" : "#DC2626", lineHeight: 1, transition: "color 0.3s" }}>{allocTotal}</span>
                      <span style={{ fontSize: "10px", color: "#94A3B8", fontWeight: "600", marginTop: "2px" }}>of 100%</span>
                      {allocValid && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10px", fontWeight: "700", color: "#16A34A", marginTop: "4px" }}>
                          <Check size={10} strokeWidth={3} /> Balanced
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {WEIGHTS.map(w => {
                    const Icon = w.icon;
                    const val = alloc?.[w.key] || 0;
                    return (
                      <div key={w.key} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 8px", borderRadius: "10px", transition: "background 0.15s" }}
                        onMouseEnter={e => { if (editingAlloc) e.currentTarget.style.background = "#F1F5F9"; }}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <div style={{ width: "28px", height: "28px", borderRadius: "7px", background: w.color + "12", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Icon size={13} color={w.color} strokeWidth={2.2} />
                        </div>
                        <span style={{ flex: 1, fontSize: "13px", fontWeight: "600", color: "#1E293B" }}>{w.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          {editingAlloc ? (
                            <button type="button" onClick={() => adjustWeight(w.key, -5)} disabled={val <= 0}
                              style={{ ...stepBtn, borderColor: "#E2E8F0", background: val > 0 ? "#fff" : "#F8FAFC", color: val > 0 ? "#475569" : "#CBD5E1", cursor: val > 0 ? "pointer" : "not-allowed" }}>
                              <Minus size={12} strokeWidth={2.5} />
                            </button>
                          ) : null}
                          <div style={{ width: "46px", textAlign: "center", background: w.color + "10", borderRadius: "7px", padding: "3px 0" }}>
                            <span style={{ fontSize: "14px", fontWeight: "800", color: w.color }}>{val}%</span>
                          </div>
                          {editingAlloc ? (
                            <button type="button" onClick={() => adjustWeight(w.key, 5)} disabled={val >= 100}
                              style={{ ...stepBtn, borderColor: w.color + "40", background: w.color + "10", color: w.color, cursor: val < 100 ? "pointer" : "not-allowed" }}>
                              <Plus size={12} strokeWidth={2.5} />
                            </button>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {editingAlloc && (
                  <div style={{ textAlign: "center", marginTop: "12px" }}>
                    <button type="button" onClick={() => setAlloc({ ...ALLOC_DEFAULTS })}
                      style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "600", color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}
                      onMouseEnter={e => e.currentTarget.style.color = "#475569"}
                      onMouseLeave={e => e.currentTarget.style.color = "#94A3B8"}>
                      <RotateCcw size={11} /> Reset to defaults
                    </button>
                  </div>
                )}
              </div>

              <div style={{ padding: "12px 20px", borderTop: "1px solid #F1F5F9", flexShrink: 0 }}>
                <p style={{ fontSize: "10px", color: "#CBD5E1", textAlign: "center", lineHeight: 1.5 }}>
                  Settings are saved per branch and used by AI scheduling for that branch.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}

function NumField({ label, value, onChange, min, max, disabled }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} min={min} max={max}
        disabled={disabled}
        style={disabled ? { ...inputStyle, background: "#F8FAFC", color: "#64748B", cursor: "default" } : inputStyle} />
    </div>
  );
}

const sectionLabel = { fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px", marginTop: "4px", display: "flex", alignItems: "center" };
const fieldLabel = { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" };
const inputStyle = { width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "14px", color: "#0F172A", outline: "none", boxSizing: "border-box", background: "#fff" };

const btnEdit = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: "13px", fontWeight: "700", cursor: "pointer", transition: "all 0.15s" };
const btnCancel = { display: "inline-flex", alignItems: "center", gap: "5px", padding: "10px 16px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" };
const btnSave = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 20px", borderRadius: "10px", border: "none", background: "#2563EB", color: "#fff", fontSize: "13px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 8px rgba(37,99,235,0.25)", transition: "opacity 0.15s" };

const btnEditSm = { display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#fff", color: "#475569", fontSize: "12px", fontWeight: "700", cursor: "pointer" };
const btnCancelSm = { display: "inline-flex", alignItems: "center", gap: "4px", padding: "7px 12px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: "12px", fontWeight: "600", cursor: "pointer" };
const btnSaveSm = { display: "inline-flex", alignItems: "center", gap: "5px", padding: "7px 14px", borderRadius: "8px", border: "none", background: "#2563EB", color: "#fff", fontSize: "12px", fontWeight: "700", cursor: "pointer", boxShadow: "0 2px 6px rgba(37,99,235,0.2)", transition: "opacity 0.15s" };

const stepBtn = { width: "26px", height: "26px", borderRadius: "7px", border: "1.5px solid", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" };
