import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-shifts-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-shifts-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes aiPulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background: "#F3F4F6", color: "#6B7280" },
  published: { background: "#DCFCE7", color: "#166534" },
  completed: { background: "#DBEAFE", color: "#1E40AF" },
  cancelled: { background: "#FEE2E2", color: "#991B1B" },
};

function Shimmer({ w = "100%", h = "16px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

export default function ShiftsList() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [shifts, setShifts]         = useState([]);
  const [krewbyAssigned, setKrewbyAssigned] = useState([]); // [{ shift_id, role_id, status }]
  const [outletInfo, setOutletInfo] = useState({ outlet_id: null, open_time: null, close_time: null });
  const [skillOptions, setSkillOptions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [view, setView]             = useState("list");
  const [filterStatus, setFilter]   = useState("all");
  const [weekOffset, setWeekOffset] = useState(0);

  // AI Create modal state
  // step: 'form' | 'recommending' | 'recommend' | 'assigning'
  const [aiCreate, setAiCreate] = useState(null);
  const [aiCreateForm, setAiCreateForm] = useState({ title: "", start_time: "", end_time: "", roles: [{ role_name: "", skill_id: "", headcount: 1 }] });
  const [aiCreateError, setAiCreateError] = useState("");
  const [aiCreateAssigning, setAiCreateAssigning] = useState(null); // staff_id being assigned

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [{ data: myStaff }, { data: skillRows }] = await Promise.all([
          supabase.from("staff").select("outlet_id").eq("user_id", userId).eq("is_active", true).limit(1),
          supabase.from("skills").select("skill_id, name").order("name"),
        ]);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;

        if (!cancelled) setSkillOptions(skillRows || []);

        const { data: outletData } = await supabase
          .from("outlets").select("open_time, close_time").eq("outlet_id", oid).single();
        if (!cancelled) {
          setOutletInfo({
            outlet_id: oid,
            open_time:  outletData?.open_time  ? String(outletData.open_time).slice(0, 5)  : null,
            close_time: outletData?.close_time ? String(outletData.close_time).slice(0, 5) : null,
          });
        }

        const { data: shiftRows } = await supabase
          .from("shifts")
          .select("shift_id, title, shift_date, start_time, end_time, status, outlet_id, shift_roles ( role_id, headcount ), shift_assignments ( assignment_id )")
          .eq("outlet_id", oid)
          .order("shift_date", { ascending: false });

        // Auto-complete published shifts whose date has passed
        const today = new Date().toISOString().split("T")[0];
        const toComplete = (shiftRows || [])
          .filter(s => s.status === "published" && s.shift_date < today)
          .map(s => s.shift_id);
        if (toComplete.length > 0) {
          await supabase.from("shifts").update({ status: "completed" }).in("shift_id", toComplete);
          (shiftRows || []).forEach(s => {
            if (toComplete.includes(s.shift_id)) s.status = "completed";
          });
        }

        if (!cancelled) setShifts(shiftRows || []);

        // Load krewby requests for this outlet to factor into fill status
        const { data: krewbyRows } = await supabase
          .from("krewby_requests")
          .select("shift_id, role_id, status")
          .eq("outlet_id", oid)
          .in("status", ["assigned", "approved"]);
        if (!cancelled) setKrewbyAssigned(krewbyRows || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function getWeekDates() {
    const dates = [];
    const now = new Date();
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      dates.push(d);
    }
    return dates;
  }

  async function openAiCreate(dateStr) {
    setAiCreateError("");
    setAiCreateForm({
      title: "",
      start_time: outletInfo.open_time || "09:00",
      end_time: outletInfo.close_time || "17:00",
      roles: [{ role_name: "", skill_id: "", headcount: 1 }],
    });
    setAiCreate({ step: "form", date: dateStr });
    // Refresh skills in case page-load fetch missed them
    const { data: freshSkills } = await supabase.from("skills").select("skill_id, name").order("name");
    if (freshSkills?.length) setSkillOptions(freshSkills);
  }

  async function handleAiCreateSubmit() {
    setAiCreateError("");
    const { title, start_time, end_time, roles } = aiCreateForm;
    if (!outletInfo.outlet_id) { setAiCreateError("Outlet not loaded yet. Please wait and try again."); return; }
    if (!start_time || !end_time) { setAiCreateError("Start and end time are required."); return; }
    if (end_time <= start_time) { setAiCreateError("End time must be after start time."); return; }
    if (roles.some(r => !r.role_name.trim())) { setAiCreateError("All roles must have a name."); return; }

    setAiCreate(prev => ({ ...prev, step: "recommending" }));
    try {
      // Create shift
      const { data: shift, error: shiftErr } = await supabase
        .from("shifts")
        .insert({
          outlet_id: outletInfo.outlet_id,
          title: title.trim() || null,
          shift_date: aiCreate.date,
          start_time,
          end_time,
          status: "draft",
          created_by: userId,
        })
        .select().single();
      if (shiftErr) throw shiftErr;

      // Create roles
      const roleRows = roles.map(r => ({
        shift_id: shift.shift_id,
        role_name: r.role_name.trim(),
        skill_id: r.skill_id ? Number(r.skill_id) : null,
        headcount: Number(r.headcount) || 1,
      }));
      const { error: roleErr } = await supabase.from("shift_roles").insert(roleRows);
      if (roleErr) throw roleErr;

      // Get AI recommendations
      const result = await api.post(`/api/recommendations/shift/${shift.shift_id}`);
      const newShift = { ...shift, shift_roles: [] };
      setShifts(prev => [newShift, ...prev]);
      setAiCreate({ step: "recommend", date: aiCreate.date, shift, recommendations: result.recommendations || [], assignedStaffIds: new Set() });
    } catch (err) {
      console.error(err);
      setAiCreateError(err?.message || "Failed to create shift. Please try again.");
      setAiCreate(prev => ({ ...prev, step: "form" }));
    }
  }

  async function handleAiCreateAssign(staffId, roleId, staffName) {
    const numStaffId = Number(staffId);
    const numRoleId = Number(roleId);
    setAiCreateAssigning(numStaffId);
    try {
      const { error: err } = await supabase.from("shift_assignments").insert({
        shift_id: aiCreate.shift.shift_id,
        role_id: numRoleId,
        staff_id: numStaffId,
        status: "assigned",
        acknowledged: false,
      });
      if (err) throw err;
      setAiCreate(prev => ({
        ...prev,
        assignedStaffIds: new Set([...prev.assignedStaffIds, numStaffId]),
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setAiCreateAssigning(null);
    }
  }

  const weekDates = getWeekDates();

  const filtered = shifts.filter(s => filterStatus === "all" || s.status === filterStatus);

  function getFillStatus(shift) {
    const roles = shift.shift_roles || [];
    const totalNeeded = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
    if (totalNeeded === 0) return null;
    const krewbyCount = krewbyAssigned.filter(k => k.shift_id === shift.shift_id).length;
    const totalAssigned = (shift.shift_assignments?.length || 0) + krewbyCount;
    if (totalAssigned >= totalNeeded) return "full";
    return "partial";
  }

  function getShiftsForDate(date) {
    const dateStr = date.toISOString().split("T")[0];
    return shifts.filter(s => s.shift_date === dateStr);
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const STATUS_CHIPS = [
    { value: "all",       label: "All" },
    { value: "draft",     label: "Draft" },
    { value: "published", label: "Published" },
    { value: "completed", label: "Completed" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <ManagerLayout title="Shifts">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Shifts</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{shifts.length} total shifts</p>
          </div>
          <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "18px", flexWrap: "wrap", alignItems: "center" }}>
          {/* View toggle */}
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
            {["list", "calendar"].map(v => (
              <ViewToggleBtn key={v} label={v === "list" ? "List" : "Calendar"} active={view === v} onClick={() => setView(v)} />
            ))}
          </div>

          {/* Status chips */}
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {STATUS_CHIPS.map(chip => (
              <StatusChip key={chip.value} label={chip.label} active={filterStatus === chip.value} onClick={() => setFilter(chip.value)} status={chip.value} />
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
              <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "14px 18px", gap: "8px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                <Shimmer w="80%" h="14px" r="6px" />
                <Shimmer w="60%" h="14px" r="6px" />
                <Shimmer w="70%" h="14px" r="6px" />
                <Shimmer w="50px" h="20px" r="100px" />
                <Shimmer w="70px" h="22px" r="100px" />
                <Shimmer w="58px" h="28px" r="7px" />
              </div>
            ))}
          </div>
        ) : view === "list" ? (
          filtered.length === 0 ? (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px 40px", textAlign: "center" }}>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>📅</div>
              <p style={{ fontSize: "18px", fontWeight: "700", color: "#1E293B", marginBottom: "8px" }}>No shifts yet</p>
              <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>Create your first shift to get started.</p>
              <CreateShiftBtn onClick={() => goTo("/outlet-manager/shifts/new")} />
            </div>
          ) : (
            <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
                <span>Date</span><span>Title</span><span>Time</span><span>Roles</span><span>Status</span><span></span>
              </div>
              {filtered.map(shift => (
                <ShiftRow key={shift.shift_id} shift={shift} fill={getFillStatus(shift)} onNav={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)} />
              ))}
            </div>
          )
        ) : (
          /* Calendar view */
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
              <WeekNavBtn label="←" onClick={() => setWeekOffset(p => p - 1)} />
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B" }}>
                {fmtDateShort(weekDates[0])} – {fmtDateShort(weekDates[6])}
              </span>
              <WeekNavBtn label="→" onClick={() => setWeekOffset(p => p + 1)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", minHeight: "400px" }}>
              {weekDates.map((date, i) => {
                const dayShifts = getShiftsForDate(date);
                const isToday = date.toDateString() === new Date().toDateString();
                return (
                  <div key={i} style={{ borderRight: i < 6 ? "1px solid #F1F5F9" : "none", padding: "10px", minHeight: "140px", background: isToday ? "#F0F7FF" : "transparent" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", marginBottom: "3px" }}>{DAYS[i]}</span>
                      <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: isToday ? "#2563EB" : "transparent", color: isToday ? "#fff" : "#1E293B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700" }}>
                        {date.getDate()}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      {dayShifts.map(shift => (
                        <div key={shift.shift_id}
                          style={{ padding: "4px 6px", borderRadius: "6px", cursor: "pointer", fontSize: "11px", ...STATUS_STYLES[shift.status] }}
                          onClick={() => goTo(`/outlet-manager/shifts/${shift.shift_id}`)}>
                          <p style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "1px" }}>{shift.title || "Shift"}</p>
                          <p style={{ opacity: 0.75 }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</p>
                        </div>
                      ))}
                      <div
                        style={{ color: "#94A3B8", fontSize: "13px", textAlign: "center", cursor: "pointer", padding: "3px", borderRadius: "6px", border: "1px dashed #E2E8F0", marginTop: dayShifts.length > 0 ? "2px" : 0 }}
                        onClick={() => openAiCreate(date.toISOString().split("T")[0])}>
                        ✦+
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── AI Create Shift Modal ─────────────────────────────────────────── */}
      {aiCreate && (
        <div style={ms.overlay} onClick={() => aiCreate.step !== "recommending" && setAiCreate(null)}>
          <div style={ms.modal} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={ms.header}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "15px", color: "#6366F1" }}>✦</span>
                  <span style={ms.title}>
                    {aiCreate.step === "form" ? "AI-Powered Shift Creator" :
                     aiCreate.step === "recommending" ? "Creating & Analysing…" :
                     "AI Staff Suggestions"}
                  </span>
                </div>
                <p style={ms.sub}>{fmtDateLong(aiCreate.date)}</p>
              </div>
              {aiCreate.step !== "recommending" && (
                <button style={ms.closeBtn} onClick={() => setAiCreate(null)}>✕</button>
              )}
            </div>

            {/* Step 1: Form */}
            {aiCreate.step === "form" && (
              <div>
                {aiCreateError && <div style={ms.error}>{aiCreateError}</div>}

                <div style={ms.field}>
                  <label style={ms.label}>Shift Title (optional)</label>
                  <input style={ms.input} placeholder="e.g. Morning Shift"
                    value={aiCreateForm.title}
                    onChange={e => setAiCreateForm(p => ({ ...p, title: e.target.value }))} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                  <div>
                    <label style={ms.label}>Start Time *</label>
                    <input style={ms.input} type="time"
                      value={aiCreateForm.start_time}
                      min={outletInfo.open_time || undefined}
                      max={outletInfo.close_time || undefined}
                      onChange={e => setAiCreateForm(p => ({ ...p, start_time: e.target.value }))} />
                  </div>
                  <div>
                    <label style={ms.label}>End Time *</label>
                    <input style={ms.input} type="time"
                      value={aiCreateForm.end_time}
                      min={aiCreateForm.start_time || outletInfo.open_time || undefined}
                      max={outletInfo.close_time || undefined}
                      onChange={e => setAiCreateForm(p => ({ ...p, end_time: e.target.value }))} />
                  </div>
                </div>
                {(outletInfo.open_time || outletInfo.close_time) && (
                  <p style={ms.hint}>Operating hours: {fmtTime(outletInfo.open_time)} – {fmtTime(outletInfo.close_time)}</p>
                )}

                <div style={{ marginTop: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <label style={{ ...ms.label, marginBottom: 0 }}>Roles *</label>
                    <button style={ms.addRoleBtn} onClick={() => setAiCreateForm(p => ({ ...p, roles: [...p.roles, { role_name: "", skill_id: "", headcount: 1 }] }))}>
                      + Add Role
                    </button>
                  </div>
                  {aiCreateForm.roles.map((role, idx) => (
                    <div key={idx} style={ms.roleRow}>
                      <input style={ms.roleInput} placeholder="Role name (e.g. Cashier)"
                        value={role.role_name}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, role_name: e.target.value } : r) }))} />
                      <select style={ms.roleSelect}
                        value={role.skill_id}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, skill_id: e.target.value } : r) }))}>
                        <option value="">Any skill</option>
                        {skillOptions.map(sk => <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
                      </select>
                      <input style={ms.roleHC} type="number" min="1" max="20" placeholder="HC"
                        value={role.headcount}
                        onChange={e => setAiCreateForm(p => ({ ...p, roles: p.roles.map((r, i) => i === idx ? { ...r, headcount: e.target.value } : r) }))} />
                      {aiCreateForm.roles.length > 1 && (
                        <button style={ms.removeRoleBtn} onClick={() => setAiCreateForm(p => ({ ...p, roles: p.roles.filter((_, i) => i !== idx) }))}>✕</button>
                      )}
                    </div>
                  ))}
                </div>

                <button style={ms.aiSubmitBtn} onClick={handleAiCreateSubmit}>
                  ✦ Create & Get AI Suggestions
                </button>
              </div>
            )}

            {/* Step 2: Loading */}
            {aiCreate.step === "recommending" && (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: "32px", marginBottom: "14px", animation: "aiPulse 1.2s ease infinite" }}>✦</div>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "#4338CA" }}>Creating shift and analysing staff…</p>
                <p style={{ fontSize: "13px", color: "#6D28D9", opacity: 0.7, marginTop: "6px" }}>Groq AI is picking the best people for your roles</p>
              </div>
            )}

            {/* Step 3: Recommendations */}
            {aiCreate.step === "recommend" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <p style={{ fontSize: "13px", color: "#64748B" }}>
                    Shift <strong>{aiCreate.shift.title || "created"}</strong> · {aiCreate.shift.start_time?.slice(0,5)} – {aiCreate.shift.end_time?.slice(0,5)}
                  </p>
                  <button style={ms.viewShiftBtn} onClick={() => { setAiCreate(null); goTo(`/outlet-manager/shifts/${aiCreate.shift.shift_id}`); }}>
                    View Shift →
                  </button>
                </div>

                {aiCreate.recommendations.length === 0 ? (
                  <p style={{ fontSize: "13px", color: "#64748B", padding: "20px 0", textAlign: "center" }}>No staff available to suggest for these roles.</p>
                ) : (
                  aiCreate.recommendations.map(rec => (
                    <div key={rec.role_id} style={{ marginBottom: "18px" }}>
                      <p style={ms.recRoleLabel}>{rec.role_name}</p>
                      {(rec.suggestions || []).map((sug, i) => {
                        const isAssigned = aiCreate.assignedStaffIds.has(Number(sug.staff_id));
                        return (
                          <div key={sug.staff_id} style={{
                            ...ms.sugRow,
                            borderColor: i === 0 ? "#A5B4FC" : "#E2E8F0",
                            background: isAssigned ? "#F0FDF4" : i === 0 ? "#F5F3FF" : "#FAFAFA",
                          }}>
                            <div style={{ ...ms.rankBadge, background: i === 0 ? "#6366F1" : "#CBD5E1" }}>{i + 1}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                <span style={ms.sugName}>{sug.name}</span>
                                <span style={{
                                  ...ms.confBadge,
                                  background: sug.confidence === "high" ? "#DCFCE7" : sug.confidence === "medium" ? "#FFFBEB" : "#FEE2E2",
                                  color: sug.confidence === "high" ? "#166534" : sug.confidence === "medium" ? "#92400E" : "#991B1B",
                                }}>{sug.confidence}</span>
                              </div>
                              <p style={ms.sugReason}>{sug.reason}</p>
                            </div>
                            <button
                              style={{
                                ...ms.assignBtn,
                                background: isAssigned ? "#22C55E" : i === 0 ? "#6366F1" : "#2563EB",
                                opacity: aiCreateAssigning === Number(sug.staff_id) ? 0.6 : 1,
                              }}
                              disabled={isAssigned || !!aiCreateAssigning}
                              onClick={() => handleAiCreateAssign(sug.staff_id, rec.role_id, sug.name)}
                            >
                              {isAssigned ? "✓ Assigned" : aiCreateAssigning === Number(sug.staff_id) ? "…" : "Assign"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ShiftRow({ shift, fill, onNav }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onNav}
      style={{
        display: "grid", gridTemplateColumns: "1.5fr 2fr 1.2fr 1.2fr 1fr 80px",
        padding: "13px 18px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s", cursor: "pointer",
      }}>
      <span style={{ fontWeight: "600" }}>{fmtDate(shift.shift_date)}</span>
      <span style={{ fontWeight: "500" }}>{shift.title || "Untitled Shift"}</span>
      <span style={{ color: "#64748B" }}>{shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}</span>
      <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ color: "#64748B" }}>{shift.shift_roles?.length || 0} role{shift.shift_roles?.length !== 1 ? "s" : ""}</span>
        {fill === "full" && (
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22C55E", flexShrink: 0, display: "inline-block" }} />
        )}
        {fill === "partial" && shift.status === "published" && (
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#DC2626", background: "#FEF2F2", border: "1px solid #FECACA", padding: "1px 7px", borderRadius: "100px", whiteSpace: "nowrap" }}>
            Understaffed
          </span>
        )}
      </span>
      <span>
        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize", ...STATUS_STYLES[shift.status] }}>
          {shift.status}
        </span>
      </span>
      <button
        onClick={e => { e.stopPropagation(); onNav(); }}
        style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
        View →
      </button>
    </div>
  );
}

function CreateShiftBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#1D4ED8" : "#2563EB", color: "#FFFFFF", border: "none",
        padding: "10px 18px", borderRadius: "10px", fontSize: "14px",
        fontWeight: "600", cursor: "pointer", transition: "background 0.15s",
      }}>
      + Create Shift
    </button>
  );
}

function ViewToggleBtn({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 16px", background: active ? "#FFFFFF" : "transparent",
        border: "none", borderRadius: "7px", fontSize: "13px",
        fontWeight: active ? "600" : "500", color: active ? "#1E293B" : "#64748B",
        cursor: "pointer", boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function StatusChip({ label, active, onClick, status }) {
  const statusMap = {
    all:       { activeBg: "#EFF6FF", activeBorder: "#2563EB", activeColor: "#2563EB" },
    draft:     { activeBg: "#F9FAFB", activeBorder: "#9CA3AF", activeColor: "#374151" },
    published: { activeBg: "#F0FDF4", activeBorder: "#22C55E", activeColor: "#166534" },
    completed: { activeBg: "#EFF6FF", activeBorder: "#3B82F6", activeColor: "#1E40AF" },
    cancelled: { activeBg: "#FEF2F2", activeBorder: "#EF4444", activeColor: "#991B1B" },
  };
  const m = statusMap[status] || statusMap.all;
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 13px", borderRadius: "100px", fontSize: "12px", fontWeight: "600",
        cursor: "pointer",
        border: active ? `1.5px solid ${m.activeBorder}` : "1.5px solid #E2E8F0",
        background: active ? m.activeBg : "#FFFFFF",
        color: active ? m.activeColor : "#64748B",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function WeekNavBtn({ label, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: "32px", height: "32px", borderRadius: "8px",
        background: hovered ? "#EFF6FF" : "#F8FAFC",
        border: "1px solid #E2E8F0", fontSize: "14px",
        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
        color: hovered ? "#2563EB" : "#64748B", transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "short", month: "short", day: "numeric" });
}

function fmtDateShort(d) {
  return d.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function fmtDateLong(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function fmtTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const ms = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  modal: { background: "#FFFFFF", borderRadius: "18px", padding: "28px", width: "100%", maxWidth: "540px", maxHeight: "85vh", overflowY: "auto", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", animation: "modalIn 0.25s ease both" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" },
  title: { fontSize: "16px", fontWeight: "800", color: "#4338CA" },
  sub: { fontSize: "12px", color: "#6D28D9", opacity: 0.8, marginTop: "3px" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", color: "#94A3B8", cursor: "pointer", padding: "2px 6px", lineHeight: 1 },
  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "9px 12px", borderRadius: "8px", fontSize: "13px", marginBottom: "14px" },
  field: { marginBottom: "14px" },
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "5px" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  hint: { fontSize: "12px", color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "7px", padding: "6px 10px", marginTop: "6px" },
  addRoleBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  roleRow: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "8px" },
  roleInput: { flex: 2, minWidth: 0, padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  roleSelect: { flex: 1.5, minWidth: 0, padding: "9px 8px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  roleHC: { width: "62px", flexShrink: 0, padding: "9px 8px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#1E293B", background: "#FFF", boxSizing: "border-box" },
  removeRoleBtn: { background: "none", border: "none", fontSize: "13px", color: "#EF4444", cursor: "pointer", padding: "4px", flexShrink: 0 },
  aiSubmitBtn: { marginTop: "22px", width: "100%", padding: "12px", background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: "700", color: "#FFF", cursor: "pointer", letterSpacing: "0.01em" },
  viewShiftBtn: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "8px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" },
  recRoleLabel: { fontSize: "11px", fontWeight: "700", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" },
  sugRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", marginBottom: "6px" },
  rankBadge: { width: "22px", height: "22px", borderRadius: "50%", color: "#FFF", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sugName: { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  confBadge: { fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "100px" },
  sugReason: { fontSize: "12px", color: "#64748B", marginTop: "2px", lineHeight: 1.4 },
  assignBtn: { border: "none", borderRadius: "7px", padding: "7px 13px", fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer", flexShrink: 0, transition: "background 0.2s" },
};
