import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { X, Plus, Check, Pause, Play, Trash2, Pencil } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("staff-profile-styles")) {
  const el = document.createElement("style");
  el.id = "staff-profile-styles";
  el.textContent = `@keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }`;
  document.head.appendChild(el);
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
const LEVELS = ["junior","intermediate","senior","lead"];
const LEVEL_META = {
  junior:       { label:"Junior",       bg:"#DBEAFE", color:"#1D4ED8", border:"#93C5FD" },
  intermediate: { label:"Intermediate", bg:"#FEF3C7", color:"#92400E", border:"#FCD34D" },
  senior:       { label:"Senior",       bg:"#DCFCE7", color:"#166534", border:"#86EFAC" },
  lead:         { label:"Lead",         bg:"#EDE9FE", color:"#5B21B6", border:"#C4B5FD" },
};

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function LevelBadge({ level, years }) {
  const m = LEVEL_META[level] || LEVEL_META.junior;
  return (
    <span style={{ fontSize:"11px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:m.bg, color:m.color, border:`1px solid ${m.border}` }}>
      {m.label}{years ? ` · ${years}yr` : ""}
    </span>
  );
}

// ── Skill Sets Tab ────────────────────────────────────────────────────────────
function SkillSetsTab({ staffId }) {
  const [assigned, setAssigned] = useState([]);
  const [library,  setLibrary]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");

  // Add-skill form
  const [selSkill, setSelSkill] = useState(null);
  const [selLevel, setSelLevel] = useState("junior");
  const [selYears, setSelYears] = useState("");
  const [adding,   setAdding]   = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [saveOk,   setSaveOk]   = useState(false);

  // Edit-skill form
  const [editingId,    setEditingId]    = useState(null); // skill_id being edited
  const [editLevel,    setEditLevel]    = useState("junior");
  const [editYears,    setEditYears]    = useState("");
  const [editSaving,   setEditSaving]   = useState(false);
  const [editError,    setEditError]    = useState("");

  // Remove confirmation
  const [confirmSkill, setConfirmSkill] = useState(null); // { skill_id, name }
  const [removing,     setRemoving]     = useState(false);
  const [removeError,  setRemoveError]  = useState("");

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/skills/staff/${staffId}`).catch(() => ({ skills: [] })),
      api.get("/api/business/skills/assignable").catch(() => ({ skills: [] })),
    ]).then(([asg, lib]) => {
      setAssigned(asg.skills || []);
      setLibrary(lib.skills || []);
    }).finally(() => setLoading(false));
  }, [staffId]);

  const assignedIds = assigned.map(s => s.skill_id);
  const available   = library.filter(s => !assignedIds.includes(s.skill_id));

  async function handleAdd() {
    if (!selSkill) return;
    setSaving(true); setError("");
    try {
      const r = await api.post(`/api/skills/staff/${staffId}`, {
        skill_id: selSkill,
        experience_level: selLevel,
        years_of_experience: selYears,
      });
      if (!r.success) throw new Error(r.message || "Failed to save");
      setAssigned(prev => [...prev, r.skill]);
      setSelSkill(null); setSelLevel("junior"); setSelYears("");
      setAdding(false);
      setSaveOk(true); setTimeout(() => setSaveOk(false), 2000);
    } catch (e) {
      setError(e.message || "Failed to save skill.");
    } finally { setSaving(false); }
  }

  async function confirmRemove() {
    if (!confirmSkill) return;
    setRemoving(true); setRemoveError("");
    try {
      await api.delete(`/api/skills/staff/${staffId}/${confirmSkill.skill_id}`);
      setAssigned(prev => prev.filter(s => s.skill_id !== confirmSkill.skill_id));
      setConfirmSkill(null);
    } catch (e) {
      setRemoveError(e.message || "Failed to remove skill. Please try again.");
    } finally {
      setRemoving(false);
    }
  }

  function startEdit(sk) {
    setEditingId(sk.skill_id);
    setEditLevel(sk.experience_level || "junior");
    setEditYears(sk.years_of_experience ?? "");
    setEditError("");
  }

  async function handleEditSave(skill_id) {
    setEditSaving(true); setEditError("");
    try {
      await api.patch(`/api/skills/staff/${staffId}/${skill_id}`, {
        experience_level: editLevel,
        years_of_experience: editYears !== "" ? Number(editYears) : null,
      });
      setAssigned(prev => prev.map(s =>
        s.skill_id === skill_id
          ? { ...s, experience_level: editLevel, years_of_experience: editYears !== "" ? Number(editYears) : null }
          : s
      ));
      setEditingId(null);
    } catch (e) {
      setEditError(e.message || "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  }

  if (loading) return <p style={{ color:"#94A3B8", fontSize:"13px" }}>Loading…</p>;

  return (
    <div>
      {/* Header row */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
        <span style={{ fontSize:"12px", fontWeight:"700", color:"#64748B", textTransform:"uppercase", letterSpacing:"0.05em" }}>
          {assigned.length} skill{assigned.length !== 1 ? "s" : ""} assigned
        </span>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"6px 14px", borderRadius:"8px", background:"#F1F5F9", border:"1px solid #E2E8F0", fontSize:"12px", fontWeight:"700", color:"#1E293B", cursor:"pointer" }}>
            <Plus size={12} /> Add Skill Set
          </button>
        )}
      </div>

      {/* Assigned list */}
      {assigned.length === 0 && !adding ? (
        <div style={{ padding:"30px 16px", textAlign:"center", background:"#F8FAFC", borderRadius:"10px", border:"1.5px dashed #CBD5E1" }}>
          <p style={{ fontSize:"13px", color:"#94A3B8" }}>No skills assigned yet. Click "Add Skill Set" to get started.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom: adding ? "16px" : "0" }}>
          {assigned.map(sk => {
            const m = LEVEL_META[sk.experience_level] || null;
            const isEditing = editingId === sk.skill_id;
            return (
              <div key={sk.skill_id} style={{ background:"#F8FAFC", borderRadius:"10px", border:`1px solid ${isEditing ? "#6366F1" : "#E2E8F0"}`, overflow:"hidden" }}>
                {/* View row */}
                <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px" }}>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", margin:"0 0 4px" }}>{sk.name}</p>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      {m ? (
                        <span style={{ fontSize:"11px", fontWeight:"700", padding:"2px 10px", borderRadius:"99px", background:m.bg, color:m.color, border:`1px solid ${m.border}` }}>
                          {m.label}
                        </span>
                      ) : (
                        <span style={{ fontSize:"11px", color:"#CBD5E1" }}>No level set</span>
                      )}
                      {sk.years_of_experience != null && (
                        <span style={{ fontSize:"12px", color:"#64748B", fontWeight:"600" }}>
                          {sk.years_of_experience} yr{Number(sk.years_of_experience) !== 1 ? "s" : ""} experience
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => isEditing ? setEditingId(null) : startEdit(sk)}
                    style={{ background: isEditing ? "#EEF2FF" : "#F1F5F9", border:`1px solid ${isEditing ? "#C7D2FE" : "#E2E8F0"}`, borderRadius:"7px", padding:"5px 7px", cursor:"pointer", display:"flex", alignItems:"center", flexShrink:0 }}>
                    <Pencil size={12} color={isEditing ? "#4338CA" : "#64748B"} />
                  </button>
                  <button onClick={() => { setConfirmSkill({ skill_id: sk.skill_id, name: sk.name }); setRemoveError(""); }} style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"7px", padding:"5px 7px", cursor:"pointer", display:"flex", alignItems:"center", flexShrink:0 }}>
                    <X size={12} color="#DC2626" />
                  </button>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ borderTop:"1px solid #E2E8F0", padding:"14px 16px", background:"#fff" }}>
                    {editError && <p style={{ fontSize:"12px", color:"#DC2626", marginBottom:"10px" }}>{editError}</p>}
                    <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>EXPERIENCE LEVEL</p>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"14px" }}>
                      {LEVELS.map(l => {
                        const lm = LEVEL_META[l];
                        const active = editLevel === l;
                        return (
                          <button key={l} onClick={() => setEditLevel(l)}
                            style={{ padding:"5px 14px", borderRadius:"99px", border:`1.5px solid ${active ? lm.color : "#E2E8F0"}`, background: active ? lm.bg : "#fff", color: active ? lm.color : "#94A3B8", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                            {lm.label}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>YEARS OF EXPERIENCE</p>
                    <input type="number" min="0" step="0.5" value={editYears} onChange={e => setEditYears(e.target.value)} placeholder="e.g. 3"
                      style={{ width:"110px", padding:"7px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", outline:"none", fontFamily:"inherit", color:"#1E293B", background:"#fff", marginBottom:"14px" }} />
                    <div style={{ display:"flex", gap:"8px" }}>
                      <button onClick={() => handleEditSave(sk.skill_id)} disabled={editSaving}
                        style={{ padding:"7px 20px", borderRadius:"8px", background:"#6366F1", color:"#fff", border:"none", fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: editSaving ? 0.6 : 1 }}>
                        {editSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        style={{ padding:"7px 14px", borderRadius:"8px", background:"#F1F5F9", color:"#64748B", border:"none", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Remove confirmation modal ── */}
      {confirmSkill && (
        <div style={{ position:"fixed", inset:0, background:"rgba(2,6,23,0.5)", backdropFilter:"blur(4px)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}
          onClick={() => !removing && setConfirmSkill(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:"16px", padding:"28px 24px", width:"340px", maxWidth:"100%", boxShadow:"0 24px 60px rgba(0,0,0,0.2)", textAlign:"center" }}>
            <div style={{ width:52, height:52, borderRadius:"50%", background:"#FEF2F2", border:"2px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
              <X size={22} color="#DC2626" />
            </div>
            <h3 style={{ fontSize:"16px", fontWeight:"800", color:"#0F172A", marginBottom:"8px" }}>Remove Skill?</h3>
            <p style={{ fontSize:"13px", color:"#64748B", lineHeight:1.6, marginBottom:"6px" }}>
              This will remove <strong style={{ color:"#0F172A" }}>{confirmSkill.name}</strong> from this staff member's profile.
            </p>
            <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"22px" }}>
              The staff member will no longer see this skill in their profile.
            </p>
            {removeError && (
              <p style={{ fontSize:"12px", color:"#DC2626", fontWeight:"600", background:"#FEF2F2", padding:"8px 12px", borderRadius:"8px", marginBottom:"14px" }}>{removeError}</p>
            )}
            <div style={{ display:"flex", gap:"10px" }}>
              <button onClick={() => setConfirmSkill(null)} disabled={removing}
                style={{ flex:1, padding:"10px", borderRadius:"10px", border:"1.5px solid #E2E8F0", background:"#F8FAFC", color:"#64748B", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={confirmRemove} disabled={removing}
                style={{ flex:1, padding:"10px", borderRadius:"10px", border:"none", background: removing ? "#FCA5A5" : "#EF4444", color:"#fff", fontSize:"13px", fontWeight:"700", cursor: removing ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }}>
                {removing ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add form — shown only when adding */}
      {adding && (
        <div style={{ background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"18px", marginTop:"4px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <p style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", margin:0 }}>New Skill Set</p>
            <button onClick={() => { setAdding(false); setSelSkill(null); setSelLevel("junior"); setSelYears(""); setError(""); }}
              style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:"12px", display:"inline-flex", alignItems:"center", gap:"3px" }}><X size={11} /> Cancel</button>
          </div>

          {error && <p style={{ fontSize:"12px", color:"#DC2626", marginBottom:"10px", background:"#FEF2F2", padding:"8px 10px", borderRadius:"7px" }}>{error}</p>}

          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>1 · SKILL</p>
          {library.length === 0 ? (
            <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"14px" }}>No skills in library yet — add some in the Skills sidebar.</p>
          ) : available.length === 0 ? (
            <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"14px" }}>All library skills are already assigned.</p>
          ) : (
            <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"16px" }}>
              {available.map(s => {
                const active = selSkill === s.skill_id;
                return (
                  <button key={s.skill_id} onClick={() => setSelSkill(active ? null : s.skill_id)}
                    style={{ padding:"5px 14px", borderRadius:"99px", border:`1.5px solid ${active ? "#6366F1" : "#E2E8F0"}`, background: active ? "#EEF2FF" : "#fff", color: active ? "#4338CA" : "#64748B", fontSize:"12px", fontWeight:"700", cursor:"pointer", display:"flex", alignItems:"center", gap:"4px" }}>
                    {active && <Check size={9} />}{s.name}
                  </button>
                );
              })}
            </div>
          )}

          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>2 · EXPERIENCE LEVEL</p>
          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"16px" }}>
            {LEVELS.map(l => {
              const m = LEVEL_META[l];
              const active = selLevel === l;
              return (
                <button key={l} onClick={() => setSelLevel(l)} style={{ padding:"6px 16px", borderRadius:"99px", border:`1.5px solid ${active ? m.color : "#E2E8F0"}`, background: active ? m.bg : "#fff", color: active ? m.color : "#94A3B8", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
                  {m.label}
                </button>
              );
            })}
          </div>

          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>3 · YEARS OF EXPERIENCE</p>
          <input type="number" min="0" step="0.5" value={selYears} onChange={e => setSelYears(e.target.value)} placeholder="e.g. 3"
            style={{ width:"120px", padding:"7px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", outline:"none", fontFamily:"inherit", color:"#1E293B", background:"#fff", marginBottom:"16px" }} />

          <div style={{ display:"flex", gap:"8px" }}>
            <button onClick={handleAdd} disabled={!selSkill || saving}
              style={{ padding:"8px 24px", borderRadius:"8px", background:"#6366F1", color:"#fff", border:"none", fontSize:"13px", fontWeight:"700", cursor: selSkill ? "pointer" : "not-allowed", opacity: (!selSkill || saving) ? 0.6 : 1 }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => { setAdding(false); setSelSkill(null); setSelLevel("junior"); setSelYears(""); setError(""); }}
              style={{ padding:"8px 16px", borderRadius:"8px", background:"#F1F5F9", color:"#64748B", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── KPI Modal ─────────────────────────────────────────────────────────────────
const KPI_PERIODS = [
  { label: "7D",  days: 7  },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

function KpiModal({ staffId, staffName, staffType, onClose }) {
  const [period,  setPeriod]  = useState(1);
  const [loading, setLoading] = useState(true);
  const [kpi,     setKpi]     = useState(null);

  useEffect(() => {
    if (!staffId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const now      = new Date();
        const today    = now.toISOString().slice(0, 10);
        const start    = new Date(now); start.setDate(now.getDate() - KPI_PERIODS[period].days);
        const startStr = start.toISOString().slice(0, 10);

        const [{ data: assigns }, { data: tsheets }, { data: leave }] = await Promise.all([
          supabase.from("shift_assignments")
            .select("assignment_id, shifts!inner(shift_date, title, start_time, end_time)")
            .eq("staff_id", staffId)
            .gte("shifts.shift_date", startStr)
            .lte("shifts.shift_date", today)
            .order("shifts(shift_date)", { ascending: false }),
          supabase.from("timesheets")
            .select("timesheet_id, status, hours_worked, log_date, description")
            .eq("staff_id", staffId)
            .gte("log_date", startStr)
            .lte("log_date", today)
            .order("log_date", { ascending: false }),
          supabase.from("availability")
            .select("request_id, status, start_date, end_date, reason")
            .eq("staff_id", staffId)
            .gte("start_date", startStr)
            .lte("start_date", today)
            .order("start_date", { ascending: false }),
        ]);

        if (cancelled) return;

        const ts         = tsheets || [];
        const tsApproved = ts.filter(t => t.status === "approved");
        const tsPending  = ts.filter(t => t.status === "pending").length;
        const tsRejected = ts.filter(t => t.status === "rejected").length;
        const hoursLogged = tsApproved.reduce((s, t) => s + parseFloat(t.hours_worked || 0), 0);
        const tsTotal    = ts.length;
        const approvalRate = tsTotal > 0 ? Math.round((tsApproved.length / tsTotal) * 100) : null;
        const shifts     = (assigns  || []).length;
        const leaveCount = (leave    || []).length;

        const shiftScore  = Math.min(shifts * 8, 25);
        const hoursScore  = Math.min(hoursLogged / 2, 25);
        const tsScore     = approvalRate != null ? (approvalRate / 100) * 35 : 17;
        const leaveScore  = Math.max(0, 15 - leaveCount * 3);
        const score       = Math.round(shiftScore + hoursScore + tsScore + leaveScore);

        setKpi({
          shifts, hoursLogged, tsApproved: tsApproved.length, tsPending, tsRejected,
          tsTotal, approvalRate, leaveCount, score,
          shiftList:    assigns  || [],
          timesheetList: ts,
          leaveList:    leave    || [],
          periodStart:  startStr,
          periodEnd:    today,
        });
      } catch (err) {
        console.error("KPI load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [staffId, period]);

  const scoreColor = !kpi ? "#64748B" : kpi.score >= 80 ? "#16A34A" : kpi.score >= 55 ? "#D97706" : "#DC2626";
  const scoreBg    = !kpi ? "#F8FAFC" : kpi.score >= 80 ? "#F0FDF4"  : kpi.score >= 55 ? "#FFFBEB" : "#FEF2F2";

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
  }

  function downloadPDF() {
    if (!kpi) return;
    const periodLabel = KPI_PERIODS[period].label;
    const scoreLabel  = kpi.score >= 80 ? "Excellent" : kpi.score >= 55 ? "Average" : "Needs Improvement";
    const barApproved = kpi.tsTotal > 0 ? Math.round((kpi.tsApproved / kpi.tsTotal) * 100) : 0;
    const barPending  = kpi.tsTotal > 0 ? Math.round((kpi.tsPending  / kpi.tsTotal) * 100) : 0;
    const barRejected = kpi.tsTotal > 0 ? Math.round((kpi.tsRejected / kpi.tsTotal) * 100) : 0;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>KPI Report — ${staffName}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; color:#1E293B; background:#fff; padding:40px; }
  h1 { font-size:22px; font-weight:800; color:#0F172A; margin-bottom:4px; }
  .sub { font-size:13px; color:#64748B; margin-bottom:28px; }
  .badge { display:inline-block; padding:3px 10px; border-radius:100px; font-size:11px; font-weight:700; }
  .grid4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
  .card { border:1px solid #E2E8F0; border-radius:10px; padding:14px 16px; }
  .card-lbl { font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
  .card-val { font-size:24px; font-weight:800; color:#0F172A; }
  .card-unit { font-size:13px; font-weight:600; color:#94A3B8; }
  .section { margin-bottom:24px; }
  .section-title { font-size:13px; font-weight:700; color:#0F172A; margin-bottom:10px; border-bottom:1.5px solid #F1F5F9; padding-bottom:6px; }
  .score-box { border-radius:12px; padding:16px 20px; display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; background:${scoreBg}; border:1px solid ${scoreColor}40; }
  .score-val { font-size:36px; font-weight:800; color:${scoreColor}; }
  .score-lbl { font-size:14px; font-weight:700; color:${scoreColor}; }
  .score-sub { font-size:11px; color:#64748B; margin-top:3px; }
  .bar-wrap { height:10px; border-radius:100px; overflow:hidden; background:#F1F5F9; margin-bottom:6px; display:flex; }
  .bar-g { background:#22C55E; }
  .bar-a { background:#F59E0B; }
  .bar-r { background:#EF4444; }
  .bar-labels { display:flex; gap:14px; font-size:11px; font-weight:600; margin-bottom:16px; }
  table { width:100%; border-collapse:collapse; font-size:12px; margin-bottom:4px; }
  th { padding:8px 10px; text-align:left; font-size:10px; font-weight:700; color:#94A3B8; text-transform:uppercase; letter-spacing:.05em; border-bottom:1.5px solid #F1F5F9; }
  td { padding:8px 10px; border-bottom:1px solid #F8FAFC; color:#374151; }
  .tag { display:inline-block; padding:2px 8px; border-radius:100px; font-size:10px; font-weight:700; }
  .tag-approved { background:#F0FDF4; color:#16A34A; }
  .tag-pending  { background:#FFFBEB; color:#D97706; }
  .tag-rejected { background:#FEF2F2; color:#DC2626; }
  .footer { margin-top:32px; font-size:11px; color:#CBD5E1; text-align:right; }
  @media print { body { padding:24px; } }
</style></head><body>
  <h1>${staffName}</h1>
  <p class="sub">
    <span class="badge" style="background:${staffType==="regular"?"#DBEAFE":"#EDE9FE"};color:${staffType==="regular"?"#1E40AF":"#5B21B6"}">${staffType==="regular"?"Regular Staff":"Casual Staff"}</span>
    &nbsp;·&nbsp; KPI Report — Last ${periodLabel} &nbsp;·&nbsp; ${fmtDate(kpi.periodStart)} to ${fmtDate(kpi.periodEnd)}
  </p>

  <div class="score-box">
    <div>
      <p class="score-lbl">${scoreLabel}</p>
      <p class="score-sub">Shifts · Hours Logged · Timesheets · Leave Taken</p>
    </div>
    <div class="score-val">${kpi.score}<span style="font-size:18px;font-weight:600;color:#94A3B8">/100</span></div>
  </div>

  <div class="grid4">
    <div class="card"><p class="card-lbl">Shifts Assigned</p><p class="card-val">${kpi.shifts}</p></div>
    <div class="card"><p class="card-lbl">Hours Logged</p><p class="card-val">${kpi.hoursLogged.toFixed(1)}<span class="card-unit">h</span></p></div>
    <div class="card"><p class="card-lbl">Timesheets</p><p class="card-val">${kpi.tsTotal}</p></div>
    <div class="card"><p class="card-lbl">Leave Requests</p><p class="card-val">${kpi.leaveCount}</p></div>
  </div>

  ${kpi.tsTotal > 0 ? `
  <div class="section">
    <p class="section-title">Timesheet Status Breakdown</p>
    <div class="bar-wrap">
      <div class="bar-g" style="flex:${kpi.tsApproved}"></div>
      <div class="bar-a" style="flex:${kpi.tsPending}"></div>
      <div class="bar-r" style="flex:${kpi.tsRejected}"></div>
    </div>
    <div class="bar-labels">
      ${kpi.tsApproved > 0 ? `<span style="color:#16A34A">✓ ${kpi.tsApproved} Approved (${barApproved}%)</span>` : ""}
      ${kpi.tsPending  > 0 ? `<span style="color:#D97706">⏳ ${kpi.tsPending} Pending (${barPending}%)</span>` : ""}
      ${kpi.tsRejected > 0 ? `<span style="color:#DC2626">✗ ${kpi.tsRejected} Rejected (${barRejected}%)</span>` : ""}
    </div>
  </div>` : ""}

  ${kpi.timesheetList.length > 0 ? `
  <div class="section">
    <p class="section-title">Timesheet History</p>
    <table><thead><tr><th>Date</th><th>Hours</th><th>Status</th><th>Description</th></tr></thead><tbody>
      ${kpi.timesheetList.slice(0, 15).map(t => `<tr>
        <td>${fmtDate(t.log_date)}</td>
        <td>${parseFloat(t.hours_worked || 0).toFixed(1)}h</td>
        <td><span class="tag tag-${t.status}">${t.status}</span></td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.description || "—"}</td>
      </tr>`).join("")}
    </tbody></table>
  </div>` : ""}

  ${kpi.leaveList.length > 0 ? `
  <div class="section">
    <p class="section-title">Leave Requests</p>
    <table><thead><tr><th>Start</th><th>End</th><th>Status</th><th>Reason</th></tr></thead><tbody>
      ${kpi.leaveList.map(l => `<tr>
        <td>${fmtDate(l.start_date)}</td>
        <td>${fmtDate(l.end_date)}</td>
        <td><span class="tag tag-${l.status}">${l.status}</span></td>
        <td>${l.reason || "—"}</td>
      </tr>`).join("")}
    </tbody></table>
  </div>` : ""}

  <p class="footer">Generated ${new Date().toLocaleString("en-SG")} · Krewby</p>
</body></html>`;

    const w = window.open("", "_blank", "width=900,height=700");
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={ms.modal}>
        {/* Header */}
        <div style={ms.header}>
          <div>
            <h2 style={ms.title}>Performance KPI</h2>
            <p style={ms.sub}>{staffName} · {staffType === "regular" ? "Regular Staff" : "Casual Staff"}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {/* Period tabs */}
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "8px", padding: "3px", gap: "2px" }}>
              {KPI_PERIODS.map((p, i) => (
                <button key={p.label} onClick={() => setPeriod(i)}
                  style={{ padding: "5px 14px", borderRadius: "6px", border: "none", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s",
                    background: period === i ? "#FFF" : "transparent",
                    color: period === i ? "#1E293B" : "#64748B",
                    boxShadow: period === i ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                  {p.label}
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ background: "#F1F5F9", border: "none", borderRadius: "8px", padding: "7px 9px", cursor: "pointer", display: "flex", alignItems: "center" }}>
              <X size={16} color="#64748B" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={ms.body}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ height: "64px", borderRadius: "10px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
              ))}
            </div>
          ) : !kpi ? (
            <p style={{ textAlign: "center", color: "#94A3B8", padding: "40px 0" }}>Failed to load KPI data.</p>
          ) : (
            <>
              {/* Score banner */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: scoreBg, border: `1px solid ${scoreColor}30`, borderRadius: "12px", padding: "16px 20px", marginBottom: "20px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: scoreColor, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {kpi.score >= 80 ? "Excellent" : kpi.score >= 55 ? "Average" : "Needs Improvement"}
                  </p>
                  <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "3px" }}>
                    {kpi.periodStart && `${kpi.periodStart} → ${kpi.periodEnd}`}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "36px", fontWeight: "800", color: scoreColor, lineHeight: 1 }}>{kpi.score}</span>
                  <span style={{ fontSize: "14px", fontWeight: "600", color: "#94A3B8" }}>/100</span>
                </div>
              </div>

              {/* 4 metric cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginBottom: "20px" }}>
                {[
                  { label: "Shifts Assigned", value: kpi.shifts,                  unit: "",  color: "#2563EB", bg: "#EFF6FF" },
                  { label: "Hours Logged",    value: kpi.hoursLogged.toFixed(1),  unit: "h", color: "#059669", bg: "#ECFDF5" },
                  { label: "Timesheets",      value: kpi.tsTotal,                 unit: "",  color: "#7C3AED", bg: "#F5F3FF" },
                  { label: "Leave Requests",  value: kpi.leaveCount,              unit: "",  color: "#D97706", bg: "#FFFBEB" },
                ].map(m => (
                  <div key={m.label} style={{ background: m.bg, border: `1px solid ${m.color}20`, borderRadius: "10px", padding: "14px 16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: "700", color: m.color, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px", opacity: 0.8 }}>{m.label}</p>
                    <p style={{ fontSize: "26px", fontWeight: "800", color: "#0F172A", lineHeight: 1 }}>
                      {m.value}<span style={{ fontSize: "13px", fontWeight: "600", color: "#94A3B8", marginLeft: "2px" }}>{m.unit}</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Timesheet breakdown */}
              {kpi.tsTotal > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Timesheet Status</p>
                  <div style={{ display: "flex", height: "10px", borderRadius: "100px", overflow: "hidden", background: "#F1F5F9", marginBottom: "8px" }}>
                    {kpi.tsApproved > 0 && <div style={{ flex: kpi.tsApproved, background: "#22C55E" }} />}
                    {kpi.tsPending  > 0 && <div style={{ flex: kpi.tsPending,  background: "#F59E0B" }} />}
                    {kpi.tsRejected > 0 && <div style={{ flex: kpi.tsRejected, background: "#EF4444" }} />}
                  </div>
                  <div style={{ display: "flex", gap: "16px" }}>
                    {kpi.tsApproved > 0 && <span style={{ fontSize: "12px", color: "#16A34A", fontWeight: "600" }}>✓ {kpi.tsApproved} approved</span>}
                    {kpi.tsPending  > 0 && <span style={{ fontSize: "12px", color: "#D97706", fontWeight: "600" }}>⏳ {kpi.tsPending} pending</span>}
                    {kpi.tsRejected > 0 && <span style={{ fontSize: "12px", color: "#DC2626", fontWeight: "600" }}>✗ {kpi.tsRejected} rejected</span>}
                  </div>
                </div>
              )}

              {/* Timesheet history table */}
              {kpi.timesheetList.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Timesheet History</p>
                  <div style={{ border: "1px solid #F1F5F9", borderRadius: "10px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                          {["Date", "Hours", "Status", "Description"].map(h => (
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpi.timesheetList.slice(0, 8).map((t, i) => (
                          <tr key={t.timesheet_id} style={{ borderBottom: i < Math.min(kpi.timesheetList.length, 8) - 1 ? "1px solid #F8FAFC" : "none" }}>
                            <td style={{ padding: "9px 12px", color: "#374151" }}>{fmtDate(t.log_date)}</td>
                            <td style={{ padding: "9px 12px", fontWeight: "700", color: "#0F172A" }}>{parseFloat(t.hours_worked || 0).toFixed(1)}h</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px",
                                background: t.status === "approved" ? "#F0FDF4" : t.status === "pending" ? "#FFFBEB" : "#FEF2F2",
                                color:      t.status === "approved" ? "#16A34A" : t.status === "pending" ? "#D97706" : "#DC2626" }}>
                                {t.status}
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px", color: "#64748B", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Leave requests */}
              {kpi.leaveList.length > 0 && (
                <div>
                  <p style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Leave Requests</p>
                  <div style={{ border: "1px solid #F1F5F9", borderRadius: "10px", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
                          {["Start", "End", "Status", "Reason"].map(h => (
                            <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: "10px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {kpi.leaveList.map((l, i) => (
                          <tr key={l.request_id} style={{ borderBottom: i < kpi.leaveList.length - 1 ? "1px solid #F8FAFC" : "none" }}>
                            <td style={{ padding: "9px 12px", color: "#374151" }}>{fmtDate(l.start_date)}</td>
                            <td style={{ padding: "9px 12px", color: "#374151" }}>{fmtDate(l.end_date)}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <span style={{ fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "100px",
                                background: l.status === "approved" ? "#F0FDF4" : l.status === "pending" ? "#FFFBEB" : "#FEF2F2",
                                color:      l.status === "approved" ? "#16A34A" : l.status === "pending" ? "#D97706" : "#DC2626" }}>
                                {l.status}
                              </span>
                            </td>
                            <td style={{ padding: "9px 12px", color: "#64748B" }}>{l.reason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {kpi.shifts === 0 && kpi.tsTotal === 0 && kpi.leaveCount === 0 && (
                <p style={{ textAlign: "center", color: "#94A3B8", fontSize: "13px", padding: "20px 0" }}>No activity recorded for this period.</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={ms.footer}>
          <p style={{ fontSize: "11px", color: "#94A3B8" }}>Score = Shifts (25) + Hours (25) + Timesheets (35) + Leave (15)</p>
          <button onClick={downloadPDF} disabled={loading || !kpi}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "9px", background: "#2563EB", color: "#FFF", border: "none", fontSize: "13px", fontWeight: "700", cursor: loading || !kpi ? "not-allowed" : "pointer", opacity: loading || !kpi ? 0.5 : 1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

const ms = {
  overlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 9100, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" },
  modal:   { background: "#FFF", borderRadius: "18px", width: "100%", maxWidth: "760px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.2)" },
  header:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 },
  title:   { fontSize: "17px", fontWeight: "800", color: "#0F172A" },
  sub:     { fontSize: "12px", color: "#94A3B8", marginTop: "2px" },
  body:    { flex: 1, overflowY: "auto", padding: "20px 24px" },
  footer:  { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 24px", borderTop: "1px solid #F1F5F9", flexShrink: 0 },
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function StaffProfile() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [member, setMember]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showKpiModal,      setShowKpiModal]      = useState(false);
  const [editing, setEditing]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [form, setForm] = useState({
    full_name: "", staff_type: "regular",
    default_work_days: "1111100", is_active: true,
  });

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data: staffRow } = await supabase
        .from("staff")
        .select("staff_id, staff_type, default_work_days, hired_at, is_active, outlet_id, users(user_id, full_name, email, role)")
        .eq("staff_id", id)
        .single();

      if (!staffRow) { goTo("/outlet-manager/staff"); return; }
      setMember(staffRow);
      setForm({
        full_name:         staffRow.users?.full_name || "",
        staff_type:        staffRow.staff_type || "regular",
        default_work_days: staffRow.default_work_days || "1111100",
        is_active:         staffRow.is_active ?? true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleDay(idx) {
    const arr = form.default_work_days.padEnd(7, "0").split("");
    arr[idx] = arr[idx] === "1" ? "0" : "1";
    setForm(p => ({ ...p, default_work_days: arr.join("") }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await supabase.from("users").update({ full_name: form.full_name.trim() }).eq("user_id", member.users.user_id);
      await supabase.from("staff").update({
        staff_type:        form.staff_type,
        default_work_days: form.staff_type === "regular" ? form.default_work_days : null,
        is_active:         form.is_active,
      }).eq("staff_id", id);
      setSuccess("Profile updated successfully.");
      setEditing(false);
      await fetchProfile();
    } catch (err) {
      setError("Failed to save. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const newVal = !member.is_active;
    await supabase.from("staff").update({ is_active: newVal }).eq("staff_id", id);
    setMember(prev => ({ ...prev, is_active: newVal }));
    setForm(prev => ({ ...prev, is_active: newVal }));
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const userId = member.users?.user_id;
      await supabase.from("staff").delete().eq("staff_id", id);
      await supabase.from("users").delete().eq("user_id", userId);
      goTo("/outlet-manager/staff");
    } catch (err) {
      setError("Failed to delete staff. Please try again.");
      console.error(err);
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <ManagerLayout title="Staff Profile">
        <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>Loading profile…</div>
      </ManagerLayout>
    );
  }

  const name = member.users?.full_name || "?";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const color = avatarColor(name);
  const workDays = (form.default_work_days || "0000000").padEnd(7, "0");

  return (
    <ManagerLayout title="Staff Profile">
      <button style={s.back} onClick={() => goTo("/outlet-manager/staff")}>← Back to Staff</button>

      <div style={s.layout}>
        {/* ── Left: profile card ── */}
        <div style={s.profileCard}>
          <div style={{ ...s.avatarLg, background: color }}>{initials}</div>
          <h2 style={s.profileName}>{member.users?.full_name}</h2>
          <p style={s.profileEmail}>{member.users?.email}</p>
          <span style={{ ...s.typeBadge, background: member.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: member.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
            {member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual"}
          </span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ ...s.statusBadge, background: member.is_active ? "#DCFCE7" : "#F3F4F6", color: member.is_active ? "#166534" : "#6B7280" }}>
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {member.hired_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Hired</span>
              <span style={s.metaVal}>{new Date(member.hired_at).toLocaleDateString("en-SG", { year:"numeric", month:"short", day:"numeric" })}</span>
            </div>
          )}

          <div style={s.cardActions}>
            <button style={{ ...s.actionBtn, background: member.is_active ? "#FEF3C7" : "#DCFCE7", color: member.is_active ? "#92400E" : "#166534", border: member.is_active ? "1px solid #FDE68A" : "1px solid #BBF7D0", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }} onClick={toggleActive}>
              {member.is_active ? <><Pause size={13} /> Deactivate</> : <><Play size={13} /> Reactivate</>}
            </button>
            <p style={{ fontSize:"11px", color:"#94A3B8", textAlign:"center", marginTop:"6px", lineHeight:1.4 }}>
              {member.is_active ? "Deactivating prevents shift assignment but keeps staff on the list." : "Reactivating allows this staff to be assigned shifts again."}
            </p>
            <button style={{ ...s.actionBtn, marginTop:"8px", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }} onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={13} /> Delete Staff
            </button>
            <button style={{ ...s.actionBtn, marginTop:"8px", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", display:"flex", alignItems:"center", justifyContent:"center", gap:"6px" }} onClick={() => setShowKpiModal(true)}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              View KPI
            </button>
          </div>
        </div>

        {/* ── Right: single scrollable panel ── */}
        <div style={s.formCard}>
          {/* ── Profile Details section ── */}
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Profile Details</h3>
            {!editing ? (
              <button style={s.editBtn} onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>Edit</button>
            ) : (
              <div style={{ display:"flex", gap:"8px" }}>
                <button style={s.cancelBtn} onClick={() => { setEditing(false); setError(""); fetchProfile(); }}>Cancel</button>
                <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            )}
          </div>

          {error   && <div style={s.error}>{error}</div>}
          {success && <div style={s.successMsg}>{success}</div>}

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              {editing ? <input style={s.input} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} /> : <p style={s.value}>{member.users?.full_name}</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <p style={s.value}>{member.users?.email}</p>
              {editing && <p style={s.hint}>Email cannot be changed here.</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Staff Type</label>
              {editing ? (
                <div style={{ display:"flex", gap:"8px" }}>
                  {[{ val:"regular", label:"Regular Staff" }, { val:"casual", label:"Casual Staff" }].map(opt => (
                    <button key={opt.val} type="button" onClick={() => setForm(p => ({ ...p, staff_type: opt.val }))}
                      style={{ flex:1, padding:"9px 12px", borderRadius:"10px", cursor:"pointer", fontWeight:"700", fontSize:"12px", transition:"all 0.15s",
                        background: form.staff_type === opt.val ? "#EEF2FF" : "#F8FAFC",
                        color:      form.staff_type === opt.val ? "#4338CA" : "#94A3B8",
                        border:     `2px solid ${form.staff_type === opt.val ? "#6366F1" : "#E2E8F0"}`,
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : (
                <p style={s.value}>{member.staff_type === "regular" ? "Regular Staff" : "Casual Staff"}</p>
              )}
            </div>

            {form.staff_type === "regular" && (
              <div style={s.field}>
                <label style={s.label}>Default Work Days</label>
                {editing ? (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {DAYS.map((day, idx) => {
                      const active = workDays[idx] === "1";
                      return (
                        <button key={day} type="button" onClick={() => toggleDay(idx)}
                          style={{ padding:"7px 11px", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer",
                            background: active ? "#2563EB" : "#F1F5F9", color: active ? "#fff" : "#64748B",
                            border: active ? "1.5px solid #2563EB" : "1.5px solid #E2E8F0" }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {DAYS.map((day, idx) => {
                      const active = (member.default_work_days || "0000000").padEnd(7,"0")[idx] === "1";
                      return (
                        <span key={day} style={{ padding:"5px 10px", borderRadius:"8px", fontSize:"12px", fontWeight:"700",
                          background: active ? "#DBEAFE" : "#F1F5F9", color: active ? "#1E40AF" : "#94A3B8",
                          border: `1.5px solid ${active ? "#BFDBFE" : "#E2E8F0"}` }}>
                          {day}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Skill Sets section ── */}
          <div style={{ borderTop:"1.5px solid #F1F5F9", paddingTop:"20px" }}>
            <h3 style={{ ...s.formTitle, marginBottom:"16px" }}>Skill Sets</h3>
            <SkillSetsTab staffId={id} />
          </div>

        </div>
      </div>

      {/* ── KPI Modal ── */}
      {showKpiModal && (
        <KpiModal
          staffId={member?.staff_id}
          staffName={member?.users?.full_name || "Staff"}
          staffType={member?.staff_type || "regular"}
          onClose={() => setShowKpiModal(false)}
        />
      )}

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ ...s.modalIcon, display:"flex", justifyContent:"center" }}><Trash2 size={36} color="#DC2626" /></div>
            <h3 style={s.modalTitle}>Delete Staff Member?</h3>
            <p style={s.modalBody}>This will permanently remove <strong>{member.users?.full_name}</strong> and all their records. This cannot be undone.</p>
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button style={{ ...s.actionBtn, background:"#EF4444", color:"#FFF", border:"none", padding:"9px 20px", width:"auto" }} onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ManagerLayout>
  );
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout: { display:"grid", gridTemplateColumns:"280px 1fr", gap:"20px", alignItems:"start" },

  profileCard: { background:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px", textAlign:"center" },
  avatarLg: { width:"72px", height:"72px", borderRadius:"50%", color:"#FFFFFF", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" },
  profileName: { fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" },
  profileEmail: { fontSize:"13px", color:"#64748B", marginBottom:"12px" },
  typeBadge: { display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600", marginBottom:"16px" },
  metaRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:"1px solid #F1F5F9", fontSize:"13px" },
  metaLabel: { color:"#64748B", fontWeight:"500" },
  metaVal: { color:"#1E293B", fontWeight:"600" },
  statusBadge: { padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  cardActions: { marginTop:"16px", display:"flex", flexDirection:"column", gap:"4px" },
  actionBtn: { width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer" },

  formCard: { background:"#FFFFFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px" },
  formHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1E293B" },
  editBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  cancelBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  saveBtn: { background:"#2563EB", border:"none", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#FFFFFF", cursor:"pointer" },

  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },

  fields: { display:"flex", flexDirection:"column", gap:"16px", marginBottom:"24px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" },
  value: { fontSize:"14px", color:"#1E293B", fontWeight:"500" },
  input: { display:"block", width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px", color:"#1E293B", background:"#FFFFFF", boxSizing:"border-box" },
  hint: { fontSize:"11px", color:"#94A3B8", marginTop:"4px" },

  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal: { background:"#FFFFFF", borderRadius:"16px", padding:"32px 28px", width:"360px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  modalIcon: { fontSize:"36px", marginBottom:"12px" },
  modalTitle: { fontSize:"18px", fontWeight:"800", color:"#1E293B", marginBottom:"10px" },
  modalBody: { fontSize:"14px", color:"#64748B", lineHeight:1.6, marginBottom:"24px" },
  modalActions: { display:"flex", gap:"10px", justifyContent:"center" },
};
