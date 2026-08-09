import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import { api } from "../../lib/api";
import StaffLayout from "../../components/layout/StaffLayout";
// Layout is injected by the casual wrapper so the same component serves both roles
import { RefreshCw, AlertCircle, ChevronLeft, ChevronRight, X } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-swaps-styles")) {
  const style = document.createElement("style");
  style.id = "staff-swaps-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes popIn { 0%{opacity:0;transform:scale(0.93)} 60%{transform:scale(1.02)} 100%{opacity:1;transform:scale(1)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeIn { from{opacity:0} to{opacity:1} }
    .swap-shift-row:hover { background: #F8FAFC !important; }
    .swap-req-btn:hover { background: #1D4ED8 !important; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const STATUS_COLORS = {
  pending:   { bg: "#FFFBEB", color: "#D97706", border: "#FDE68A" },
  approved:  { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
  rejected:  { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  cancelled: { bg: "#F3F4F6", color: "#6B7280", border: "#E5E7EB" },
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getWeekStart(date) {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtWeekRange(start) {
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const s = start.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
  const e = end.toLocaleDateString("en-SG",   { month: "short", day: "numeric", year: "numeric" });
  return `${s} – ${e}`;
}

function toLocalDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

function WeekCalendar({ weekStart, requests, shifts = [] }) {
  const todayStr = toLocalDateStr(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d;
  });

  const events = requests
    .filter(r => r.status !== "approved")
    .map(r => {
      const shift = r._shifts;
      return { id: r.swap_id, date: shift?.shift_date, title: shift?.title || (r.request_type === "swap" ? "Swap" : "Replace"), status: r.status, type: r.request_type };
    }).filter(e => e.date);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", border: "1px solid #F1F5F9", borderRadius: "12px", overflow: "hidden" }}>
      {days.map((d, i) => {
        const dayStr    = toLocalDateStr(d);
        const isToday   = dayStr === todayStr;
        const hits      = events.filter(e => e.date === dayStr);
        const dayShifts = shifts.filter(s => s.shifts?.shift_date === dayStr);
        return (
          <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", background: isToday ? "#EFF6FF" : "#FFF" }}>
            <div style={{ padding: "10px 6px 8px", textAlign: "center", borderBottom: "1px solid #F1F5F9" }}>
              <p style={{ fontSize: "16px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>{DAY_LABELS[i]}</p>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", margin: "0 auto", background: isToday ? "#2563EB" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ fontSize: "20px", fontWeight: isToday ? "800" : "600", color: isToday ? "#FFF" : "#1E293B" }}>{d.getDate()}</p>
              </div>
            </div>
            <div style={{ padding: "5px 3px", minHeight: "64px", display: "flex", flexDirection: "column", gap: "3px" }}>
              {dayShifts.map(s => (
                <div key={s.assignment_id}
                  style={{ borderLeft: "3px solid #7C3AED", background: "#EDE9FE", borderRadius: "0 5px 5px 0", padding: "3px 5px", overflow: "hidden" }}>
                  <p style={{ fontSize: "16px", fontWeight: "700", color: "#4C1D95", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {s.shifts?.title || "Shift"}
                  </p>
                  <p style={{ fontSize: "15px", color: "#7C3AED" }}>{s.shifts?.start_time?.slice(0,5)}</p>
                </div>
              ))}
              {hits.map(e => {
                const sc = STATUS_COLORS[e.status] || STATUS_COLORS.pending;
                return (
                  <div key={e.id} title={`${e.title} — ${e.status}`}
                    style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, borderRadius: "4px", padding: "2px 4px", fontSize: "15px", fontWeight: "700", opacity: e.status === "rejected" ? 0.45 : 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: e.status === "rejected" ? "line-through" : "none" }}>
                    {e.type === "swap" ? "↔ " : "▲ "}{e.title}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SwapRequests({ Layout = StaffLayout }) {
  const user   = getUser();
  const userId = user?.user_id;

  const [myShifts,       setMyShifts]       = useState([]);
  const [calendarShifts, setCalendarShifts] = useState([]);
  const [requests,       setRequests]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [filter,         setFilter]         = useState("all");
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState("");
  const [toast,          setToast]          = useState(null);
  const [staffId,        setStaffId]        = useState(null);
  const [weekStart,      setWeekStart]      = useState(() => getWeekStart(new Date()));

  // Swap modal
  const [swapModal, setSwapModal] = useState(null); // selected assignment object
  const [swapForm,  setSwapForm]  = useState({ request_type: "swap", reason: "" });

  // Edit modal for pending swap requests
  const [editModal,  setEditModal]  = useState(null); // swap_requests row
  const [editForm,   setEditForm]   = useState({ request_type: "swap", reason: "" });
  const [editSaving, setEditSaving] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCancelSwap(swapId) {
    if (!window.confirm("Cancel this swap/replacement request?")) return;
    const { error: err } = await supabase
      .from("swap_requests").update({ status: "cancelled" }).eq("swap_id", swapId);
    if (err) { showToast("Failed to cancel request.", "error"); return; }
    setRequests(prev => prev.map(r => r.swap_id === swapId ? { ...r, status: "cancelled" } : r));
    showToast("Request cancelled.");
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setEditSaving(true);
    const { error: err } = await supabase.from("swap_requests")
      .update({ request_type: editForm.request_type, reason: editForm.reason.trim() || null })
      .eq("swap_id", editModal.swap_id);
    setEditSaving(false);
    if (err) { showToast("Failed to save changes.", "error"); return; }
    setRequests(prev => prev.map(r =>
      r.swap_id === editModal.swap_id
        ? { ...r, request_type: editForm.request_type, reason: editForm.reason.trim() || null }
        : r
    ));
    setEditModal(null);
    showToast("Request updated.");
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const today = toLocalDateStr(new Date());
        const { data: myStaff } = await supabase.from("staff").select("staff_id").eq("user_id", userId).limit(1);
        const sid = myStaff?.[0]?.staff_id;
        if (cancelled) return;
        setStaffId(sid || null);
        if (!sid) { setMyShifts([]); setRequests([]); setLoading(false); return; }

        const [{ data: assignments }, { data: reqs }] = await Promise.all([
          supabase.from("task_assignments")
            .select("assignment_id, shift_id, shifts ( shift_id, title, shift_date, start_time, end_time, status )")
            .eq("staff_id", sid),
          supabase.from("swap_requests")
            .select("swap_id, request_type, reason, status, responded_at, requester_assign")
            .eq("requester_id", sid).order("swap_id", { ascending: false }),
        ]);

        if (!cancelled) {
          const allAssignments = assignments || [];

          // Build a lookup map so we can attach shift details without a broken join
          const assignMap = {};
          allAssignments.forEach(a => { assignMap[a.assignment_id] = a; });

          const enrichedReqs = (reqs || []).map(r => ({
            ...r,
            _shifts: assignMap[r.requester_assign]?.shifts || null,
          }));

          // Assignment IDs whose swap/replacement was approved — hide from calendar + upcoming list
          const approvedAssignIds = new Set(
            enrichedReqs.filter(r => r.status === "approved").map(r => r.requester_assign)
          );

          const visibleAssignments = allAssignments.filter(a => !approvedAssignIds.has(a.assignment_id));
          setCalendarShifts(visibleAssignments);

          const now = new Date();
          const upcomingPublished = visibleAssignments.filter(a => {
            if (!a.shifts || a.shifts.status !== "published") return false;
            const d = a.shifts.shift_date;
            if (!d) return false;
            if (d > today) return true;
            if (d < today) return false;
            // Same day — only include if shift hasn't ended yet
            const endTime = a.shifts.end_time?.slice(0, 5);
            if (!endTime) return true;
            const [eh, em] = endTime.split(":").map(Number);
            const shiftEnd = new Date();
            shiftEnd.setHours(eh, em, 0, 0);
            return now < shiftEnd;
          });
          setMyShifts(upcomingPublished);
          setRequests(enrichedReqs);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  async function handleSubmit() {
    if (!swapModal || !staffId) return;
    const duplicate = requests.find(r =>
      r.status === "pending" &&
      String(r.requester_assign) === String(swapModal.assignment_id)
    );
    if (duplicate) { setError("You already have a pending request for this shift."); return; }
    setSaving(true); setError("");
    try {
      // The DB trigger blocks new requests if there's an approved one on the same date.
      // When a manager re-assigns the staff back to the shift, the old approved request
      // is now superseded — cancel it first so the insert can proceed.
      // Only cancel the approved request for this exact assignment, not all approved swaps on the same day
      const superseded = requests.filter(
        r => r.status === "approved" && Number(r.requester_assign) === Number(swapModal.assignment_id)
      );
      if (superseded.length > 0) {
        const ids = superseded.map(r => r.swap_id);
        await supabase.from("swap_requests").update({ status: "cancelled" }).in("swap_id", ids);
        setRequests(prev => prev.map(r => ids.includes(r.swap_id) ? { ...r, status: "cancelled" } : r));
      }

      const { data, error: err } = await supabase.from("swap_requests")
        .insert({ requester_id: staffId, requester_assign: Number(swapModal.assignment_id), request_type: swapForm.request_type, reason: swapForm.reason.trim() || null, status: "pending" })
        .select().single();
      if (err) throw err;
      const enriched = { ...data, _shifts: swapModal.shifts };
      setRequests(prev => [enriched, ...prev]);
      setSwapModal(null);
      showToast("Request submitted successfully.");

      api.post("/api/notifications/notify-my-managers", {
        type: "swap_request",
        title: data.request_type === "swap" ? "New Swap Request" : "New Replacement Request",
        message: `${user?.full_name || "A staff member"} requested a ${data.request_type} for ${swapModal.shifts?.title || "a shift"} on ${fmtDate(swapModal.shifts?.shift_date)}.`,
        related_entity: "swap_requests",
        related_id: data.swap_id,
      }).catch(() => {});
    } catch (err) {
      setError(err.message || "Failed to submit request.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const FILTER_TABS = [
    { value: "all", label: "All" }, { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
  ];
  const filtered     = filter === "all" ? requests : requests.filter(r => r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <Layout title="Swap Requests">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Swap & Replacement Requests</h2>
          <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>
            {pendingCount > 0 ? `${pendingCount} pending` : "No pending requests"} · tap a shift below to request a swap or replacement
          </p>
        </div>

        {/* Your Upcoming Shifts — task-style list */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 22px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", marginBottom: "14px" }}>Your Upcoming Shifts</h3>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ display: "flex", gap: "14px", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F1F5F9" }}>
                  <Shimmer w="50px" h="50px" r="10px" />
                  <div style={{ flex: 1 }}><Shimmer w="55%" h="14px" r="5px" /><div style={{ marginTop: "7px" }}><Shimmer w="38%" h="11px" r="5px" /></div></div>
                  <Shimmer w="110px" h="34px" r="8px" />
                </div>
              ))}
            </div>
          ) : myShifts.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 0" }}>
              <RefreshCw size={28} color="#CBD5E1" style={{ margin: "0 auto 10px" }} />
              <p style={{ fontSize: "21px", color: "#94A3B8" }}>No upcoming published shifts to request a swap for.</p>
            </div>
          ) : (
            myShifts.map((a, idx) => {
              const shift = a.shifts;
              const d = new Date((shift?.shift_date || "") + "T00:00:00");
              const dayAbbr = shift?.shift_date ? d.toLocaleDateString("en-SG", { weekday: "short" }).toUpperCase() : "—";
              const dayNum  = shift?.shift_date ? d.getDate() : "—";
              const hasExisting = requests.some(r =>
                r.status !== "rejected" && r.status !== "cancelled" &&
                String(r.requester_assign) === String(a.assignment_id)
              );
              return (
                <div key={a.assignment_id} className="swap-shift-row"
                  style={{ display: "flex", alignItems: "center", gap: "16px", padding: "13px 0", borderBottom: "1px solid #F1F5F9", cursor: "default", borderRadius: "6px", transition: "background 0.12s", animation: `fadeSlideUp 0.3s ease ${idx * 0.06}s both` }}>
                  {/* Date block */}
                  <div style={{ minWidth: "50px", textAlign: "center", background: "#EFF6FF", borderRadius: "10px", padding: "8px 4px", flexShrink: 0 }}>
                    <p style={{ fontSize: "17px", fontWeight: "700", color: "#2563EB", textTransform: "uppercase", letterSpacing: "0.04em" }}>{dayAbbr}</p>
                    <p style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B", lineHeight: 1.1 }}>{dayNum}</p>
                  </div>
                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "21px", fontWeight: "600", color: "#1E293B", marginBottom: "2px" }}>{shift?.title || "Shift"}</p>
                    <p style={{ fontSize: "19px", color: "#64748B" }}>
                      {shift?.start_time?.slice(0, 5)} – {shift?.end_time?.slice(0, 5)}
                      <span style={{ marginLeft: "10px", color: "#CBD5E1" }}>·</span>
                      <span style={{ marginLeft: "8px" }}>{fmtDate(shift?.shift_date)}</span>
                    </p>
                  </div>
                  {/* Action */}
                  {hasExisting ? (
                    <span style={{ padding: "5px 14px", background: "#FFFBEB", color: "#D97706", border: "1px solid #FDE68A", borderRadius: "100px", fontSize: "19px", fontWeight: "600", flexShrink: 0 }}>
                      Requested
                    </span>
                  ) : (
                    <button className="swap-req-btn"
                      onClick={() => { setSwapModal(a); setSwapForm({ request_type: "swap", reason: "" }); setError(""); }}
                      style={{ padding: "8px 18px", background: "#2563EB", color: "#FFF", border: "none", borderRadius: "8px", fontSize: "20px", fontWeight: "600", cursor: "pointer", flexShrink: 0, transition: "background 0.15s" }}>
                      ↔ Request Swap
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Week Calendar */}
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); }} style={navBtn}>
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>{fmtWeekRange(weekStart)}</span>
            <button onClick={() => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); }} style={navBtn}>
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "14px", marginBottom: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#EDE9FE", border: "1px solid #7C3AED" }} />
              <span style={{ fontSize: "18px", fontWeight: "600", color: "#64748B" }}>Your Shift</span>
            </div>
            {[["pending", "Pending"], ["approved", "Approved"], ["rejected", "Rejected"]].map(([key, label]) => {
              const sc = STATUS_COLORS[key];
              return (
                <div key={key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: sc.bg, border: `1px solid ${sc.border}` }} />
                  <span style={{ fontSize: "18px", fontWeight: "600", color: "#64748B" }}>{label}</span>
                </div>
              );
            })}
          </div>

          {loading ? <Shimmer h="120px" r="12px" /> : <WeekCalendar weekStart={weekStart} requests={requests} shifts={calendarShifts} />}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
          {FILTER_TABS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding: "7px 16px", background: filter === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "20px", fontWeight: filter === t.value ? "600" : "500", color: filter === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filter === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Requests list */}
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
                  <Shimmer w="160px" h="16px" r="6px" /><Shimmer w="70px" h="24px" r="100px" />
                </div>
                <Shimmer w="200px" h="13px" r="5px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div style={{ marginBottom: "12px" }}><RefreshCw size={36} color="#CBD5E1" /></div>
            <p style={{ fontSize: "21px", fontWeight: "600", color: "#64748B" }}>No {filter === "all" ? "" : filter + " "}swap requests</p>
            <p style={{ fontSize: "20px", color: "#94A3B8", marginTop: "6px" }}>Tap a shift above when you need to swap or find cover.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {filtered.map((r, i) => {
              const shift = r._shifts;
              const typeColor = r.request_type === "swap" ? { bg: "#EFF6FF", color: "#1D4ED8" } : { bg: "#F5F3FF", color: "#6D28D9" };
              return (
                <div key={r.swap_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.06}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <span style={{ padding: "5px 12px", borderRadius: "100px", fontSize: "19px", fontWeight: "700", background: typeColor.bg, color: typeColor.color }}>
                      {r.request_type === "swap"
                        ? <><RefreshCw size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />Shift Swap</>
                        : <><AlertCircle size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }} />Replacement</>}
                    </span>
                    <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "19px", fontWeight: "600", ...statusStyle(r.status) }}>
                      {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                    </span>
                  </div>
                  {shift && (
                    <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "12px 0", borderTop: "1px solid #F1F5F9", borderBottom: r.reason ? "1px solid #F1F5F9" : "none" }}>
                      <InfoItem label="Shift" value={shift.title || "Shift"} />
                      <InfoItem label="Date"  value={fmtDate(shift.shift_date)} />
                      <InfoItem label="Time"  value={`${shift.start_time?.slice(0,5)} – ${shift.end_time?.slice(0,5)}`} />
                    </div>
                  )}
                  {r.reason && <p style={{ fontSize: "20px", color: "#64748B", fontStyle: "italic", marginTop: "12px" }}>"{r.reason}"</p>}
                  {r.status === "pending" && (
                    <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #F1F5F9", display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button onClick={() => { setEditModal(r); setEditForm({ request_type: r.request_type, reason: r.reason || "" }); }}
                        style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                        Edit
                      </button>
                      <button onClick={() => handleCancelSwap(r.swap_id)}
                        style={{ padding: "5px 12px", borderRadius: "8px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Swap request modal */}
      {swapModal && (
        <div onClick={e => e.target === e.currentTarget && setSwapModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.15s ease both" }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "420px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>

            {/* Shift info header */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
              {(() => {
                const shift = swapModal.shifts;
                const d = shift?.shift_date ? new Date(shift.shift_date + "T00:00:00") : null;
                return (
                  <>
                    <div style={{ minWidth: "54px", textAlign: "center", background: "#EFF6FF", borderRadius: "10px", padding: "9px 6px", flexShrink: 0 }}>
                      <p style={{ fontSize: "17px", fontWeight: "700", color: "#2563EB", textTransform: "uppercase" }}>{d ? d.toLocaleDateString("en-SG", { weekday: "short" }).toUpperCase() : "—"}</p>
                      <p style={{ fontSize: "23px", fontWeight: "900", color: "#1E293B", lineHeight: 1 }}>{d ? d.getDate() : "—"}</p>
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B", lineHeight: 1.2 }}>{shift?.title || "Shift"}</h3>
                      <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
                        {fmtDate(shift?.shift_date)} · {shift?.start_time?.slice(0,5)} – {shift?.end_time?.slice(0,5)}
                      </p>
                    </div>
                  </>
                );
              })()}
              <button onClick={() => setSwapModal(null)}
                style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px", cursor: "pointer", flexShrink: 0, display: "flex" }}>
                <X size={15} color="#64748B" />
              </button>
            </div>

            {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 14px", borderRadius: "9px", fontSize: "20px", marginBottom: "16px" }}>{error}</div>}

            {/* Request type */}
            <div style={{ marginBottom: "18px" }}>
              <p style={lbl}>Request Type</p>
              <div style={{ display: "flex", gap: "8px" }}>
                {[
                  { value: "swap",        label: "↔  Swap",        activeBg: "#EFF6FF", activeColor: "#1E40AF", activeBorder: "#2563EB" },
                  { value: "replacement", label: "▲ Replacement",  activeBg: "#F5F3FF", activeColor: "#5B21B6", activeBorder: "#7C3AED" },
                ].map(opt => {
                  const active = swapForm.request_type === opt.value;
                  return (
                    <button key={opt.value} onClick={() => setSwapForm(p => ({ ...p, request_type: opt.value }))}
                      style={{ flex: 1, padding: "10px 8px", border: `2px solid ${active ? opt.activeBorder : "#E2E8F0"}`, background: active ? opt.activeBg : "#FFF", borderRadius: "10px", fontSize: "20px", fontWeight: "700", color: active ? opt.activeColor : "#94A3B8", cursor: "pointer", transition: "all 0.15s" }}>
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reason */}
            <div style={{ marginBottom: "24px" }}>
              <p style={lbl}>Reason <span style={{ fontWeight: "400", color: "#CBD5E1" }}>(optional)</span></p>
              <textarea value={swapForm.reason} onChange={e => setSwapForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="e.g. Family commitment, medical appointment…"
                style={{ ...inp, minHeight: "80px", resize: "vertical" }} />
            </div>

            {/* Actions */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setSwapModal(null)}
                style={{ flex: 1, padding: "11px", background: "#F1F5F9", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={saving}
                style={{ flex: 2, padding: "11px", background: saving ? "#93C5FD" : "#2563EB", border: "none", borderRadius: "10px", fontSize: "21px", fontWeight: "700", color: "#FFF", cursor: saving ? "default" : "pointer", transition: "background 0.15s" }}>
                {saving ? "Submitting…" : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit swap modal */}
      {editModal && (
        <div onClick={e => e.target === e.currentTarget && setEditModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 10001, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", animation: "fadeIn 0.15s ease both" }}>
          <div style={{ background: "#FFF", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "400px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "20px" }}>Edit Request</h3>
            <div style={{ marginBottom: "16px" }}>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Request Type</p>
              <div style={{ display: "flex", gap: "10px" }}>
                {["swap", "replacement"].map(t => (
                  <button key={t} onClick={() => setEditForm(f => ({ ...f, request_type: t }))}
                    style={{ flex: 1, padding: "9px", borderRadius: "9px", border: `1.5px solid ${editForm.request_type === t ? "#6366F1" : "#E2E8F0"}`, background: editForm.request_type === t ? "#EEF2FF" : "#F8FAFC", color: editForm.request_type === t ? "#4F46E5" : "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: "20px" }}>
              <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Reason <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></p>
              <textarea value={editForm.reason} onChange={e => setEditForm(f => ({ ...f, reason: e.target.value }))}
                placeholder="Explain why you need this swap or replacement…"
                style={{ width: "100%", minHeight: "80px", borderRadius: "10px", border: "1.5px solid #E2E8F0", padding: "10px 12px", fontSize: "13px", resize: "vertical", boxSizing: "border-box", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setEditModal(null)} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B", fontSize: "14px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={editSaving} style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: editSaving ? "#A5B4FC" : "#6366F1", color: "#FFF", fontSize: "14px", fontWeight: "700", cursor: editSaving ? "default" : "pointer" }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 9999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#fff", padding: "12px 20px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </Layout>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "18px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "21px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function statusStyle(status) {
  const map = {
    pending:   { background: "#FFFBEB", color: "#D97706" },
    approved:  { background: "#DCFCE7", color: "#166534" },
    rejected:  { background: "#FEE2E2", color: "#991B1B" },
    cancelled: { background: "#F3F4F6", color: "#6B7280" },
  };
  return map[status] || map.pending;
}

const lbl = { display: "block", fontSize: "19px", fontWeight: "600", color: "#64748B", marginBottom: "6px" };
const inp = { display: "block", width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "21px", background: "#FFF", color: "#1E293B", boxSizing: "border-box" };
const navBtn = { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", color: "#475569" };
