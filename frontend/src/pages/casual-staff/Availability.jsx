import { useState, useEffect, useMemo } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { Check, ChevronLeft, ChevronRight, Clock, Calendar, X, Repeat } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("casual-avail-styles")) {
  const style = document.createElement("style");
  style.id = "casual-avail-styles";
  style.textContent = `
    @keyframes pageIn  { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0}          to{background-position:600px 0} }
    @keyframes popIn   { 0%{opacity:0;transform:scale(0.93)} 60%{transform:scale(1.02)} 100%{opacity:1;transform:scale(1)} }
    @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
  `;
  document.head.appendChild(style);
}

// day_of_week: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addWeeks(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtWeekLabel(weekStart) {
  const s = new Date(weekStart);
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-SG", opts)} – ${e.toLocaleDateString("en-SG", opts)}, ${e.getFullYear()}`;
}

function fmtWeekLabelShort(weekStr) {
  return fmtWeekLabel(new Date(`${weekStr}T00:00:00`));
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function DayDots({ activeDays, size = 6 }) {
  return (
    <div style={{ display: "flex", gap: "3px" }}>
      {DAY_SHORT.map((d, i) => (
        <div key={d} title={d}
          style={{ width: `${size}px`, height: `${size}px`, borderRadius: "50%", background: activeDays?.[i] === "1" ? "#2563EB" : "#E2E8F0" }} />
      ))}
    </div>
  );
}

export default function CasualAvailability() {
  // Default: show next week so the user plans ahead
  const [weekStart, setWeekStart] = useState(() => addWeeks(getWeekStart(new Date()), 1));
  const weekStartStr = toDateStr(weekStart);

  const [periods, setPeriods]           = useState([]);
  const [checked, setChecked]           = useState(new Set());
  const [hasExplicit, setHasExplicit]   = useState(false);
  const [standingByPeriod, setStandingByPeriod] = useState({});
  const [loadingWeek, setLoadingWeek]   = useState(true);

  const [history, setHistory]           = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [savingPattern, setSavingPattern] = useState(false);
  const [toast, setToast]               = useState(null);

  const [patternModal, setPatternModal] = useState(false);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), ok ? 3000 : 5000);
  }

  async function loadWeek() {
    setLoadingWeek(true);
    try {
      const res = await api.get(`/api/casual/period-availability?week_start_date=${weekStartStr}`);
      setPeriods(res.periods || []);
      setHasExplicit(!!res.has_explicit_submission);
      setStandingByPeriod(res.standing_by_period || {});
      if (res.has_explicit_submission) {
        setChecked(new Set(res.explicit_period_ids || []));
      } else {
        // Nothing explicit yet — pre-check whatever the standing pattern covers on any day, as a
        // starting point the worker can accept or adjust before submitting.
        const covered = Object.keys(res.standing_by_period || {}).map(Number);
        setChecked(new Set(covered));
      }
      setSaved(false);
    } catch {
      showToast("Couldn't load this week's availability.", false);
    } finally {
      setLoadingWeek(false);
    }
  }

  async function loadHistory() {
    setLoadingHistory(true);
    try {
      const res = await api.get("/api/casual/period-availability/history");
      setHistory(res.history || []);
    } catch {
      // non-fatal — log panel just stays empty
    } finally {
      setLoadingHistory(false);
    }
  }

  useEffect(() => { loadWeek(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [weekStartStr]);
  useEffect(() => { loadHistory(); }, []);

  const periodsByBranch = useMemo(() => {
    const grouped = {};
    periods.forEach(p => {
      const key = p.branch_name || `Branch ${p.branch_id}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(p);
    });
    return Object.entries(grouped);
  }, [periods]);

  function toggle(periodId) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(periodId)) next.delete(periodId); else next.add(periodId);
      return next;
    });
    setSaved(false);
  }

  async function submit() {
    setSaving(true);
    try {
      await api.put("/api/casual/period-availability", { week_start_date: weekStartStr, period_ids: [...checked] });
      setSaved(true);
      setHasExplicit(true);
      showToast("Availability saved.");
      loadHistory();
    } catch (err) {
      showToast(err.message || "Submission failed.", false);
    } finally {
      setSaving(false);
    }
  }

  async function setAsUsualPattern() {
    setSavingPattern(true);
    try {
      const res = await api.post("/api/casual/period-availability/set-as-standing", { week_start_date: weekStartStr });
      showToast(res.message || "Saved as your usual pattern.");
      loadWeek();
    } catch (err) {
      showToast(err.message || "Couldn't save your usual pattern.", false);
    } finally {
      setSavingPattern(false);
    }
  }

  const setCount = checked.size;
  const isPastWeek = weekStartStr < toDateStr(getWeekStart(new Date()));

  return (
    <CasualLayout title="Availability">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Weekly Availability</h2>
            <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
              Tick the shift periods you can work, then submit for your manager to review.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={() => setPatternModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFF", color: "#2563EB", border: "1.5px solid #BFDBFE", borderRadius: "10px", padding: "10px 18px", fontSize: "20px", fontWeight: "700", cursor: "pointer" }}>
              <Repeat size={15} /> Usual pattern
            </button>
            <button onClick={submit} disabled={saving || isPastWeek}
              style={{ display: "flex", alignItems: "center", gap: "8px", background: saved ? "#22C55E" : "#2563EB", color: "#FFF", border: "none", borderRadius: "10px", padding: "10px 22px", fontSize: "21px", fontWeight: "700", cursor: saving || isPastWeek ? "not-allowed" : "pointer", opacity: saving || isPastWeek ? 0.7 : 1, transition: "background 0.2s", flexShrink: 0 }}>
              {saved ? <><Check size={15} strokeWidth={3} /> Saved!</> : saving ? "Saving…" : "Submit Availability"}
            </button>
          </div>
        </div>

        {/* ── Week selector ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "16px" }}>
          <button onClick={() => setWeekStart(w => addWeeks(w, -1))}
            disabled={weekStartStr <= toDateStr(getWeekStart(new Date()))}
            style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: weekStartStr <= toDateStr(getWeekStart(new Date())) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: weekStartStr <= toDateStr(getWeekStart(new Date())) ? 0.4 : 1 }}>
            <ChevronLeft size={16} color="#64748B" />
          </button>
          <div style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", minWidth: "260px", textAlign: "center" }}>
            Week of {fmtWeekLabel(weekStart)}
          </div>
          <button onClick={() => setWeekStart(w => addWeeks(w, 1))}
            style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronRight size={16} color="#64748B" />
          </button>
        </div>

        {/* ── Explicit vs pattern-covered indicator ───────────────────── */}
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <span style={{ fontSize: "17px", fontWeight: "600", color: hasExplicit ? "#166534" : "#B45309", background: hasExplicit ? "#DCFCE7" : "#FEF3C7", borderRadius: "999px", padding: "4px 14px" }}>
            {hasExplicit ? "Explicitly set for this week" : "Showing your usual pattern — not yet submitted for this week"}
          </span>
        </div>

        {/* ── Period grid, grouped by branch ──────────────────────────── */}
        {loadingWeek ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
            {[1, 2].map(i => <Shimmer key={i} h="100px" r="14px" />)}
          </div>
        ) : periods.length === 0 ? (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "36px", textAlign: "center", marginBottom: "24px" }}>
            <p style={{ fontSize: "20px", color: "#94A3B8" }}>No shift periods set up yet for your branches — check back once your manager configures them.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" }}>
            {periodsByBranch.map(([branchName, list]) => (
              <div key={branchName} style={{ background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px" }}>
                <h4 style={{ fontSize: "19px", fontWeight: "700", color: "#64748B", marginBottom: "12px", textTransform: "uppercase", letterSpacing: "0.03em" }}>{branchName}</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {list.map(p => {
                    const isChecked = checked.has(p.period_id);
                    const patternCovers = (standingByPeriod[p.period_id] || []).length > 0;
                    return (
                      <label key={p.period_id} onClick={() => toggle(p.period_id)}
                        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 14px", borderRadius: "10px", border: `2px solid ${isChecked ? "#2563EB" : "#E2E8F0"}`, background: isChecked ? "#EFF6FF" : "#FFF", cursor: "pointer", transition: "all 0.15s" }}>
                        <div style={{ width: "22px", height: "22px", borderRadius: "6px", border: `2px solid ${isChecked ? "#2563EB" : "#CBD5E1"}`, background: isChecked ? "#2563EB" : "#FFF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {isChecked && <Check size={14} color="#FFF" strokeWidth={3} />}
                        </div>
                        <div style={{ flex: 1, minWidth: "160px" }}>
                          <div style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>{p.name}</div>
                          <div style={{ fontSize: "17px", color: "#64748B" }}>{p.start_time}–{p.end_time}</div>
                        </div>
                        <DayDots activeDays={p.active_days} />
                        {!hasExplicit && patternCovers && (
                          <span style={{ fontSize: "15px", fontWeight: "600", color: "#B45309", background: "#FEF3C7", borderRadius: "6px", padding: "2px 8px", whiteSpace: "nowrap" }}>usual</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Summary bar ───────────────────────────────────────────── */}
        <div style={{ background: setCount > 0 ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${setCount > 0 ? "#BFDBFE" : "#E2E8F0"}`, borderRadius: "12px", padding: "12px 20px", marginBottom: "32px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <Clock size={15} color={setCount > 0 ? "#2563EB" : "#94A3B8"} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "20px", fontWeight: "600", color: setCount > 0 ? "#1E40AF" : "#94A3B8" }}>
            {setCount === 0
              ? "No periods selected — tick any period above."
              : `${setCount} period${setCount !== 1 ? "s" : ""} selected for this week`}
          </span>
          {hasExplicit && (
            <button onClick={setAsUsualPattern} disabled={savingPattern}
              style={{ marginLeft: "auto", background: "none", border: "none", color: "#2563EB", fontSize: "18px", fontWeight: "700", cursor: savingPattern ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              <Repeat size={14} /> {savingPattern ? "Saving…" : "Set as my usual pattern"}
            </button>
          )}
        </div>

        {/* ── Availability Log ──────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Calendar size={16} color="#64748B" />
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B" }}>Availability Log</h3>
            <span style={{ fontSize: "19px", color: "#94A3B8", marginLeft: "4px" }}>— weeks you've explicitly submitted</span>
          </div>

          {loadingHistory ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3].map(i => <Shimmer key={i} h="56px" r="12px" />)}
            </div>
          ) : history.length === 0 ? (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "36px", textAlign: "center" }}>
              <Calendar size={28} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: "20px", color: "#94A3B8" }}>No submissions yet — tick your periods above and hit Submit.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.map(({ week_start_date, periods: weekPeriods }, idx) => {
                const isCurrent = week_start_date === weekStartStr;
                return (
                  <div key={week_start_date}
                    style={{ background: isCurrent ? "#F0F9FF" : "#FFF", border: `1.5px solid ${isCurrent ? "#BAE6FD" : "#E2E8F0"}`, borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", animation: `pageIn 0.3s ease ${idx * 0.04}s both` }}>
                    <div style={{ minWidth: "220px" }}>
                      <span style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>
                        {fmtWeekLabelShort(week_start_date)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
                      {weekPeriods.map((p, i) => (
                        <span key={`${p.period_id}-${i}`}
                          style={{ fontSize: "18px", fontWeight: "600", color: "#1E40AF", background: "#DBEAFE", borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                          {p.name}{p.branch_name ? ` · ${p.branch_name}` : ""}
                        </span>
                      ))}
                    </div>
                    {isCurrent && (
                      <span style={{ fontSize: "18px", fontWeight: "700", color: "#0369A1", background: "#E0F2FE", borderRadius: "6px", padding: "3px 9px", flexShrink: 0 }}>
                        Viewing
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ── Usual pattern editor modal ───────────────────────────────── */}
      {patternModal && (
        <StandingPatternModal onClose={() => { setPatternModal(false); loadWeek(); }} showToast={showToast} />
      )}

      {/* ── Toast ─────────────────────────────────────────────────── */}
      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.ok ? "#22C55E" : "#EF4444", color: "#FFF", padding: "12px 20px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "pageIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </CasualLayout>
  );
}

// ── Standing (recurring) pattern editor — a real day×period grid, since the standing table is
// the one dimension where day_of_week actually applies per period. ──────────────────────────
function StandingPatternModal({ onClose, showToast }) {
  const [periods, setPeriods]   = useState([]);
  const [checked, setChecked]   = useState(new Set()); // Set of "periodId:dow"
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get("/api/casual/standing-availability");
        if (cancelled) return;
        setPeriods(res.periods || []);
        setChecked(new Set((res.standing || []).map(s => `${s.period_id}:${s.day_of_week}`)));
      } catch {
        if (!cancelled) showToast("Couldn't load your usual pattern.", false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount; showToast is
    // recreated every parent render, and depending on it here would cancel/restart this fetch on
    // every parent re-render (e.g. background notification polling), which starved it forever.
  }, []);

  function toggle(periodId, dow) {
    const key = `${periodId}:${dow}`;
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const entries = [...checked].map(key => {
        const [period_id, day_of_week] = key.split(":").map(Number);
        return { period_id, day_of_week };
      });
      await api.put("/api/casual/standing-availability", { entries });
      showToast("Usual pattern saved.");
      onClose();
    } catch (err) {
      showToast(err.message || "Couldn't save your usual pattern.", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.15s ease both" }}>
      <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "640px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
          <div>
            <h3 style={{ fontSize: "23px", fontWeight: "800", color: "#1E293B" }}>Your usual pattern</h3>
            <p style={{ fontSize: "18px", color: "#64748B", marginTop: "3px" }}>Used automatically for any week you haven't explicitly submitted.</p>
          </div>
          <button onClick={onClose}
            style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={15} color="#64748B" />
          </button>
        </div>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "16px 0" }}>
            {[1, 2, 3].map(i => <Shimmer key={i} h="40px" r="8px" />)}
          </div>
        ) : periods.length === 0 ? (
          <p style={{ fontSize: "19px", color: "#94A3B8", margin: "24px 0", textAlign: "center" }}>No shift periods available yet.</p>
        ) : (
          <div style={{ overflowX: "auto", margin: "16px 0" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "480px" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", fontSize: "16px", color: "#64748B", padding: "6px 8px" }}>Period</th>
                  {DAY_SHORT.map(d => (
                    <th key={d} style={{ fontSize: "16px", color: "#64748B", padding: "6px 4px", textAlign: "center" }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periods.map(p => (
                  <tr key={p.period_id}>
                    <td style={{ fontSize: "18px", fontWeight: "600", color: "#1E293B", padding: "6px 8px", whiteSpace: "nowrap" }}>
                      {p.name}
                      <div style={{ fontSize: "14px", fontWeight: "400", color: "#94A3B8" }}>{p.branch_name}</div>
                    </td>
                    {DAY_SHORT.map((d, dow) => {
                      const runsThisDay = p.active_days?.[dow] === "1";
                      const isChecked = checked.has(`${p.period_id}:${dow}`);
                      return (
                        <td key={d} style={{ textAlign: "center", padding: "6px 4px" }}>
                          <button
                            disabled={!runsThisDay}
                            onClick={() => toggle(p.period_id, dow)}
                            title={runsThisDay ? "" : `${p.name} doesn't run on ${d}`}
                            style={{
                              width: "28px", height: "28px", borderRadius: "6px",
                              border: `2px solid ${!runsThisDay ? "#F1F5F9" : isChecked ? "#2563EB" : "#CBD5E1"}`,
                              background: !runsThisDay ? "#F8FAFC" : isChecked ? "#2563EB" : "#FFF",
                              cursor: runsThisDay ? "pointer" : "not-allowed",
                            }}>
                            {isChecked && <Check size={14} color="#FFF" strokeWidth={3} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px", background: "#F1F5F9", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
            Cancel
          </button>
          <button onClick={save} disabled={saving || loading}
            style={{ flex: 2, padding: "11px", background: "#2563EB", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", color: "#FFF", cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Saving…" : "Save usual pattern"}
          </button>
        </div>
      </div>
    </div>
  );
}
