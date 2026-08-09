import { useState, useEffect } from "react";
import CasualLayout from "../../components/layout/CasualLayout";
import { api } from "../../lib/api";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { Check, ChevronLeft, ChevronRight, Clock, Calendar, X } from "lucide-react";

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
const DAYS = [
  { label: "Monday",    short: "Mon", value: 0 },
  { label: "Tuesday",   short: "Tue", value: 1 },
  { label: "Wednesday", short: "Wed", value: 2 },
  { label: "Thursday",  short: "Thu", value: 3 },
  { label: "Friday",    short: "Fri", value: 4 },
  { label: "Saturday",  short: "Sat", value: 5 },
  { label: "Sunday",    short: "Sun", value: 6 },
];
const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_FROM = "09:00";
const DEFAULT_TO   = "17:00";

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
  // Use local-time parts to avoid UTC offset shifting the date
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

function getDayDate(weekStart, dayValue) {
  // dayValue 0=Mon → +0 days, 6=Sun → +6 days
  const d = new Date(weekStart);
  d.setDate(d.getDate() + dayValue);
  return d;
}

function calcHours(from, to) {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = (th * 60 + tm) - (fh * 60 + fm);
  if (diff <= 0) return "0";
  return (diff / 60).toFixed(1).replace(/\.0$/, "");
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function CasualAvailability() {
  const user   = getUser();
  const userId = user?.user_id;

  // Default: show next week so the user plans ahead
  const [weekStart, setWeekStart] = useState(() => addWeeks(getWeekStart(new Date()), 1));

  // { [dayValue]: { from, to } } for the currently viewed week
  const [schedule, setSchedule] = useState({});

  // Modal
  const [modal, setModal]               = useState(null); // { dayValue, label, date }
  const [modalAvailable, setModalAvail] = useState(true);
  const [modalFrom, setModalFrom]       = useState(DEFAULT_FROM);
  const [modalTo, setModalTo]           = useState(DEFAULT_TO);

  const [staffId, setStaffId]               = useState(null);
  const [saving, setSaving]                 = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [toast, setToast]                   = useState(null);
  const [history, setHistory]               = useState([]); // [[weekStr, days[]], ...]
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingWeek, setLoadingWeek]       = useState(false);
  const [overwriteConfirm, setOverwriteConfirm] = useState(null); // { existingDays } | null

  const weekStartStr = toDateStr(weekStart);

  function showToast(msg, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), ok ? 3000 : 5000);
  }

  // ── Load staff_id and submission history ─────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function load() {
      const { data: staffRow } = await supabase
        .from("staff").select("staff_id").eq("user_id", userId).maybeSingle();
      if (cancelled || !staffRow) { setLoadingHistory(false); return; }
      setStaffId(staffRow.staff_id);

      const { data: rows } = await supabase
        .from("casual_availability")
        .select("week_start_date, day_of_week, available_from, available_to")
        .eq("staff_id", staffRow.staff_id)
        .order("week_start_date", { ascending: false });

      if (cancelled) return;
      setHistory(groupByWeek(rows || []));
      setLoadingHistory(false);
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Load existing days for currently viewed week ──────────────────────────
  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;
    async function loadWeek() {
      setLoadingWeek(true);
      const { data: rows } = await supabase
        .from("casual_availability")
        .select("day_of_week, available_from, available_to")
        .eq("staff_id", staffId)
        .eq("week_start_date", weekStartStr);
      if (cancelled) return;
      const map = {};
      (rows || []).forEach(r => {
        map[r.day_of_week] = {
          from: r.available_from?.slice(0, 5) || DEFAULT_FROM,
          to:   r.available_to?.slice(0, 5)   || DEFAULT_TO,
        };
      });
      setSchedule(map);
      setSaved(false);
      setLoadingWeek(false);
    }
    loadWeek();
    return () => { cancelled = true; };
  }, [staffId, weekStartStr]);

  function groupByWeek(rows) {
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.week_start_date]) grouped[r.week_start_date] = [];
      grouped[r.week_start_date].push(r);
    });
    return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a));
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openModal(day) {
    const existing = schedule[day.value];
    setModalAvail(!!existing);
    setModalFrom(existing?.from || DEFAULT_FROM);
    setModalTo(existing?.to   || DEFAULT_TO);
    setModal({ dayValue: day.value, label: day.label, date: getDayDate(weekStart, day.value) });
  }

  function confirmModal() {
    if (modalAvailable) {
      setSchedule(prev => ({ ...prev, [modal.dayValue]: { from: modalFrom, to: modalTo } }));
    } else {
      setSchedule(prev => { const n = { ...prev }; delete n[modal.dayValue]; return n; });
    }
    setSaved(false);
    setModal(null);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  function submit() {
    if (setCount === 0) {
      showToast("Click the day cards above to set your hours first.", false);
      return;
    }
    if (weekStartStr < toDateStr(getWeekStart(new Date()))) {
      showToast("Cannot submit availability for a past week.", false);
      return;
    }
    const existing = history.find(([weekStr]) => weekStr === weekStartStr);
    if (existing) {
      setOverwriteConfirm({ existingDays: existing[1] });
      return;
    }
    doSubmit();
  }

  async function doSubmit() {
    setOverwriteConfirm(null);
    setSaving(true);
    try {
      const availability = Object.entries(schedule).map(([dv, times]) => ({
        day_of_week:    Number(dv),
        available_from: times.from + ":00",
        available_to:   times.to   + ":00",
      }));
      await api.post("/api/casual/availability/submit", { week_start_date: weekStartStr, availability });
      setSaved(true);
      showToast("Availability submitted! Your manager has been notified.");

      // Refresh history
      if (staffId) {
        const { data: rows } = await supabase
          .from("casual_availability")
          .select("week_start_date, day_of_week, available_from, available_to")
          .eq("staff_id", staffId)
          .order("week_start_date", { ascending: false });
        setHistory(groupByWeek(rows || []));
      }
    } catch (err) {
      showToast(err.message || "Submission failed.", false);
    } finally {
      setSaving(false);
    }
  }

  const setCount = Object.keys(schedule).length;

  return (
    <CasualLayout title="Availability">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Weekly Availability</h2>
            <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
              Click a day card to set your hours, then submit for your manager to review.
            </p>
          </div>
          <button onClick={submit} disabled={saving}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: saved ? "#22C55E" : setCount === 0 ? "#94A3B8" : "#2563EB", color: "#FFF", border: "none", borderRadius: "10px", padding: "10px 22px", fontSize: "21px", fontWeight: "700", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "background 0.2s", flexShrink: 0 }}>
            {saved ? <><Check size={15} strokeWidth={3} /> Submitted!</> : saving ? "Submitting…" : setCount === 0 ? "Set days first ↑" : "Submit Availability"}
          </button>
        </div>

        {/* ── Week selector ─────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", marginBottom: "20px" }}>
          <button onClick={() => { setWeekStart(w => addWeeks(w, -1)); setSaved(false); }}
            disabled={weekStartStr <= toDateStr(getWeekStart(new Date()))}
            style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: weekStartStr <= toDateStr(getWeekStart(new Date())) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: weekStartStr <= toDateStr(getWeekStart(new Date())) ? 0.4 : 1 }}>
            <ChevronLeft size={16} color="#64748B" />
          </button>
          <div style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", minWidth: "260px", textAlign: "center" }}>
            Week of {fmtWeekLabel(weekStart)}
          </div>
          <button onClick={() => { setWeekStart(w => addWeeks(w, 1)); setSaved(false); }}
            style={{ width: "34px", height: "34px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ChevronRight size={16} color="#64748B" />
          </button>
        </div>

        {/* ── 7 day cards in a single row ───────────────────────────── */}
        {loadingWeek ? (
          <div className="responsive-hscroll">
          <div className="responsive-hscroll-inner" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "20px", "--hscroll-min-width": "640px" }}>
            {Array.from({ length: 7 }).map((_, i) => <Shimmer key={i} h="130px" r="14px" />)}
          </div>
          </div>
        ) : (
          <div className="responsive-hscroll">
          <div className="responsive-hscroll-inner" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "10px", marginBottom: "20px", "--hscroll-min-width": "640px" }}>
            {DAYS.map(day => {
              const s = schedule[day.value];
              const date = getDayDate(weekStart, day.value);
              return (
                <button key={day.value} onClick={() => openModal(day)}
                  style={{
                    background: s ? "#EFF6FF" : "#FFF",
                    border: `2px solid ${s ? "#2563EB" : "#E2E8F0"}`,
                    borderRadius: "14px", padding: "14px 8px",
                    cursor: "pointer", textAlign: "center",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                    minHeight: "130px", transition: "all 0.15s",
                  }}>
                  {/* Day name */}
                  <span style={{ fontSize: "20px", fontWeight: "800", color: s ? "#1E40AF" : "#64748B" }}>
                    {day.short}
                  </span>
                  {/* Date */}
                  <span style={{ fontSize: "18px", color: s ? "#60A5FA" : "#CBD5E1" }}>
                    {date.toLocaleDateString("en-SG", { month: "short", day: "numeric" })}
                  </span>
                  {/* Content */}
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", width: "100%" }}>
                    {s ? (
                      <>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E" }} />
                        <span style={{ fontSize: "17px", fontWeight: "700", color: "#1D4ED8", wordBreak: "break-all" }}>
                          {s.from}
                        </span>
                        <span style={{ fontSize: "17px", color: "#60A5FA" }}>–</span>
                        <span style={{ fontSize: "17px", fontWeight: "700", color: "#1D4ED8", wordBreak: "break-all" }}>
                          {s.to}
                        </span>
                        <span style={{ fontSize: "16px", fontWeight: "600", color: "#2563EB", background: "#DBEAFE", borderRadius: "4px", padding: "1px 5px", marginTop: "2px" }}>
                          {calcHours(s.from, s.to)}h
                        </span>
                      </>
                    ) : (
                      <>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#E2E8F0" }} />
                        <span style={{ fontSize: "17px", color: "#CBD5E1" }}>Tap to set</span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          </div>
        )}

        {/* ── Summary bar ───────────────────────────────────────────── */}
        <div style={{ background: setCount > 0 ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${setCount > 0 ? "#BFDBFE" : "#E2E8F0"}`, borderRadius: "12px", padding: "12px 20px", marginBottom: "32px", display: "flex", alignItems: "center", gap: "10px" }}>
          <Clock size={15} color={setCount > 0 ? "#2563EB" : "#94A3B8"} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: "20px", fontWeight: "600", color: setCount > 0 ? "#1E40AF" : "#94A3B8" }}>
            {setCount === 0
              ? "No days selected — click any card above to set your hours."
              : `${setCount} day${setCount !== 1 ? "s" : ""} set for this week · click a card to edit · hit Submit when ready`}
          </span>
          {setCount > 0 && (
            <div style={{ display: "flex", gap: "5px", marginLeft: "auto" }}>
              {DAYS.map(d => (
                <div key={d.value} title={d.label}
                  style={{ width: "8px", height: "8px", borderRadius: "50%", background: schedule[d.value] ? "#2563EB" : "#E2E8F0", flexShrink: 0 }} />
              ))}
            </div>
          )}
        </div>

        {/* ── Availability Log ──────────────────────────────────────── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
            <Calendar size={16} color="#64748B" />
            <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B" }}>Availability Log</h3>
            <span style={{ fontSize: "19px", color: "#94A3B8", marginLeft: "4px" }}>— every submission goes to your manager</span>
          </div>

          {loadingHistory ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {[1, 2, 3].map(i => <Shimmer key={i} h="56px" r="12px" />)}
            </div>
          ) : history.length === 0 ? (
            <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "36px", textAlign: "center" }}>
              <Calendar size={28} color="#CBD5E1" style={{ margin: "0 auto 8px" }} />
              <p style={{ fontSize: "20px", color: "#94A3B8" }}>No submissions yet — set your hours above and hit Submit.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {history.map(([weekStr, days], idx) => {
                const sorted = [...days].sort((a, b) => a.day_of_week - b.day_of_week);
                const isCurrent = weekStr === weekStartStr;
                return (
                  <div key={weekStr}
                    style={{ background: isCurrent ? "#F0F9FF" : "#FFF", border: `1.5px solid ${isCurrent ? "#BAE6FD" : "#E2E8F0"}`, borderRadius: "12px", padding: "14px 18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", animation: `pageIn 0.3s ease ${idx * 0.04}s both` }}>
                    <div style={{ minWidth: "220px" }}>
                      <span style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>
                        {fmtWeekLabel(weekStr)}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", flex: 1 }}>
                      {sorted.map(d => (
                        <span key={d.day_of_week}
                          style={{ fontSize: "18px", fontWeight: "600", color: "#1E40AF", background: "#DBEAFE", borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                          {DAY_SHORT[d.day_of_week]} {d.available_from?.slice(0, 5)}–{d.available_to?.slice(0, 5)}
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

      {/* ── Day modal ───────────────────────────────────────────────── */}
      {modal && (
        <div
          onClick={e => e.target === e.currentTarget && setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.15s ease both" }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "380px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>

            {/* Modal header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
              <div>
                <h3 style={{ fontSize: "23px", fontWeight: "800", color: "#1E293B" }}>{modal.label}</h3>
                <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
                  {modal.date.toLocaleDateString("en-SG", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <button onClick={() => setModal(null)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={15} color="#64748B" />
              </button>
            </div>

            {/* Available / Not available toggle */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <button onClick={() => setModalAvail(true)}
                style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${modalAvailable ? "#2563EB" : "#E2E8F0"}`, background: modalAvailable ? "#EFF6FF" : "#FFF", fontSize: "20px", fontWeight: "700", color: modalAvailable ? "#1E40AF" : "#94A3B8", cursor: "pointer", transition: "all 0.15s" }}>
                Available
              </button>
              <button onClick={() => setModalAvail(false)}
                style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${!modalAvailable ? "#EF4444" : "#E2E8F0"}`, background: !modalAvailable ? "#FEF2F2" : "#FFF", fontSize: "20px", fontWeight: "700", color: !modalAvailable ? "#B91C1C" : "#94A3B8", cursor: "pointer", transition: "all 0.15s" }}>
                Not Available
              </button>
            </div>

            {/* Time inputs */}
            {modalAvailable && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "14px 16px", background: "#F8FAFC", borderRadius: "12px", marginBottom: "10px" }}>
                  <Clock size={15} color="#2563EB" style={{ flexShrink: 0 }} />
                  <input type="time" value={modalFrom} onChange={e => setModalFrom(e.target.value)}
                    style={{ border: "1.5px solid #BFDBFE", borderRadius: "8px", padding: "7px 10px", fontSize: "21px", color: "#1E293B", background: "#FFF", outline: "none", flex: 1 }} />
                  <span style={{ fontSize: "19px", color: "#94A3B8", flexShrink: 0 }}>to</span>
                  <input type="time" value={modalTo} onChange={e => setModalTo(e.target.value)}
                    style={{ border: "1.5px solid #BFDBFE", borderRadius: "8px", padding: "7px 10px", fontSize: "21px", color: "#1E293B", background: "#FFF", outline: "none", flex: 1 }} />
                </div>
                <p style={{ fontSize: "19px", fontWeight: "600", color: "#2563EB", textAlign: "center", marginBottom: "20px" }}>
                  {calcHours(modalFrom, modalTo)} hours available
                </p>
              </>
            )}

            {!modalAvailable && <div style={{ height: "12px" }} />}

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setModal(null)}
                style={{ flex: 1, padding: "11px", background: "#F1F5F9", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={confirmModal}
                style={{ flex: 2, padding: "11px", background: modalAvailable ? "#2563EB" : "#EF4444", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", color: "#FFF", cursor: "pointer" }}>
                {modalAvailable ? "Set Available" : "Mark Not Available"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Overwrite confirmation modal ─────────────────────────────── */}
      {overwriteConfirm && (
        <div
          onClick={e => e.target === e.currentTarget && setOverwriteConfirm(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.15s ease both" }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "400px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>
            <h3 style={{ fontSize: "23px", fontWeight: "800", color: "#1E293B", marginBottom: "8px" }}>Already submitted for this week</h3>
            <p style={{ fontSize: "20px", color: "#64748B", lineHeight: 1.6, marginBottom: "16px" }}>
              You already submitted availability for <strong>Week of {fmtWeekLabel(weekStart)}</strong>:
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
              {[...overwriteConfirm.existingDays].sort((a, b) => a.day_of_week - b.day_of_week).map(d => (
                <span key={d.day_of_week} style={{ fontSize: "18px", fontWeight: "600", color: "#1E40AF", background: "#DBEAFE", borderRadius: "6px", padding: "3px 8px", whiteSpace: "nowrap" }}>
                  {DAY_SHORT[d.day_of_week]} {d.available_from?.slice(0, 5)}–{d.available_to?.slice(0, 5)}
                </span>
              ))}
            </div>
            <p style={{ fontSize: "20px", color: "#64748B", marginBottom: "22px" }}>
              Submitting now will overwrite that with what you've set above. Continue?
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setOverwriteConfirm(null)}
                style={{ flex: 1, padding: "11px", background: "#F1F5F9", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={doSubmit}
                style={{ flex: 1, padding: "11px", background: "#2563EB", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", color: "#FFF", cursor: "pointer" }}>
                Overwrite & Submit
              </button>
            </div>
          </div>
        </div>
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
