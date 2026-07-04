import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { X, Plus, Check, Trash2 } from "lucide-react";

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

function SkillSetsTab({ staffId }) {
  const [assigned, setAssigned] = useState([]);
  const [library,  setLibrary]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  const [adding,   setAdding]   = useState(false);
  const [selSkill, setSelSkill] = useState(null);
  const [selLevel, setSelLevel] = useState("junior");
  const [selYears, setSelYears] = useState("");
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/api/skills/staff/${staffId}`).catch(() => ({ skills: [] })),
      api.get("/api/business/skills").catch(() => ({ skills: [] })),
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
        skill_id: selSkill, experience_level: selLevel, years_of_experience: selYears,
      });
      if (!r.success) throw new Error(r.message || "Failed");
      setAssigned(prev => [...prev, r.skill]);
      setSelSkill(null); setSelLevel("junior"); setSelYears("");
      setAdding(false);
    } catch (e) { setError(e.message || "Failed to save skill."); }
    finally { setSaving(false); }
  }

  async function handleRemove(skill_id) {
    try {
      await api.delete(`/api/skills/staff/${staffId}/${skill_id}`);
      setAssigned(prev => prev.filter(s => s.skill_id !== skill_id));
    } catch (e) { console.error(e); }
  }

  if (loading) return <p style={{ color:"#94A3B8", fontSize:"13px" }}>Loading…</p>;

  return (
    <div>
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

      {assigned.length === 0 && !adding ? (
        <div style={{ padding:"30px 16px", textAlign:"center", background:"#F8FAFC", borderRadius:"10px", border:"1.5px dashed #CBD5E1" }}>
          <p style={{ fontSize:"13px", color:"#94A3B8" }}>No skills assigned yet. Click "Add Skill Set" to get started.</p>
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom: adding ? "16px" : "0" }}>
          {assigned.map(sk => {
            const m = LEVEL_META[sk.experience_level] || null;
            return (
              <div key={sk.skill_id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 16px", background:"#F8FAFC", borderRadius:"10px", border:"1px solid #E2E8F0" }}>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", margin:"0 0 4px" }}>{sk.name}</p>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    {m ? (
                      <span style={{ fontSize:"11px", fontWeight:"700", padding:"2px 10px", borderRadius:"99px", background:m.bg, color:m.color, border:`1px solid ${m.border}` }}>{m.label}</span>
                    ) : (
                      <span style={{ fontSize:"11px", color:"#CBD5E1" }}>No level set</span>
                    )}
                    {sk.years_of_experience != null && (
                      <span style={{ fontSize:"12px", color:"#64748B", fontWeight:"600" }}>{sk.years_of_experience} yr{Number(sk.years_of_experience) !== 1 ? "s" : ""} experience</span>
                    )}
                  </div>
                </div>
                <button onClick={() => handleRemove(sk.skill_id)} style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"7px", padding:"5px 7px", cursor:"pointer", display:"flex", alignItems:"center", flexShrink:0 }}>
                  <X size={12} color="#DC2626" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div style={{ background:"#F8FAFC", border:"1.5px solid #E2E8F0", borderRadius:"12px", padding:"18px", marginTop:"4px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"14px" }}>
            <p style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", margin:0 }}>New Skill Set</p>
            <button onClick={() => { setAdding(false); setSelSkill(null); setSelLevel("junior"); setSelYears(""); setError(""); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#94A3B8", fontSize:"12px", display:"inline-flex", alignItems:"center", gap:"4px" }}><X size={12} /> Cancel</button>
          </div>
          {error && <p style={{ fontSize:"12px", color:"#DC2626", marginBottom:"10px", background:"#FEF2F2", padding:"8px 10px", borderRadius:"7px" }}>{error}</p>}

          <p style={{ fontSize:"11px", fontWeight:"700", color:"#94A3B8", marginBottom:"7px" }}>1 · SKILL</p>
          {library.length === 0 ? (
            <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"14px" }}>No skills in library yet — add some in Skills settings.</p>
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
              const m = LEVEL_META[l]; const active = selLevel === l;
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

export default function BOStaffProfile() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [member, setMember]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const [form, setForm] = useState({
    full_name: "", staff_type: "regular", default_work_days: "1111100", is_active: true,
  });

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("staff")
        .select("staff_id, staff_type, default_work_days, hired_at, is_active, outlet_id, users(user_id, full_name, email)")
        .eq("staff_id", id).single();
      if (!data) { goTo("/business-owner/staff"); return; }
      setMember(data);
      setForm({ full_name: data.users?.full_name || "", staff_type: data.staff_type || "regular", default_work_days: data.default_work_days || "1111100", is_active: data.is_active ?? true });
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function toggleDay(idx) {
    const arr = form.default_work_days.padEnd(7,"0").split("");
    arr[idx] = arr[idx] === "1" ? "0" : "1";
    setForm(p => ({ ...p, default_work_days: arr.join("") }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      await supabase.from("users").update({ full_name: form.full_name.trim() }).eq("user_id", member.users.user_id);
      await supabase.from("staff").update({ staff_type: form.staff_type, default_work_days: form.staff_type === "regular" ? form.default_work_days : null, is_active: form.is_active }).eq("staff_id", id);
      setSuccess("Profile updated successfully.");
      setEditing(false);
      await fetchProfile();
    } catch (e) { setError("Failed to save."); }
    finally { setSaving(false); }
  }

  async function toggleActive() {
    const v = !member.is_active;
    await supabase.from("staff").update({ is_active: v }).eq("staff_id", id);
    setMember(p => ({ ...p, is_active: v }));
    setForm(p => ({ ...p, is_active: v }));
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await supabase.from("staff").delete().eq("staff_id", id);
      await supabase.from("users").delete().eq("user_id", member.users?.user_id);
      goTo("/business-owner/staff");
    } catch (e) { setError("Failed to delete."); setDeleting(false); setShowDelete(false); }
  }

  if (loading) return <BusinessOwnerLayout title="Staff Profile"><div style={{ textAlign:"center", padding:"60px", color:"#64748B" }}>Loading…</div></BusinessOwnerLayout>;

  const name = member.users?.full_name || "?";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
  const color = avatarColor(name);
  const workDays = (form.default_work_days || "0000000").padEnd(7,"0");

  return (
    <BusinessOwnerLayout title="Staff Profile">
      <button style={s.back} onClick={() => goTo("/business-owner/staff")}>← Back to Staff</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ ...s.avatarLg, background: color }}>{initials}</div>
          <h2 style={s.profileName}>{member.users?.full_name}</h2>
          <p style={s.profileEmail}>{member.users?.email}</p>
          <span style={{ ...s.typeBadge, background: member.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: member.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
            {member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual"}
          </span>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ ...s.statusBadge, background: member.is_active ? "#DCFCE7" : "#F3F4F6", color: member.is_active ? "#166534" : "#6B7280" }}>{member.is_active ? "Active" : "Inactive"}</span>
          </div>
          {member.hired_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Hired</span>
              <span style={s.metaVal}>{new Date(member.hired_at).toLocaleDateString("en-SG", { year:"numeric", month:"short", day:"numeric" })}</span>
            </div>
          )}
          <div style={s.cardActions}>
            <button style={{ ...s.actionBtn, background: member.is_active ? "#FEF3C7" : "#DCFCE7", color: member.is_active ? "#92400E" : "#166534", border: member.is_active ? "1px solid #FDE68A" : "1px solid #BBF7D0" }} onClick={toggleActive}>
              {member.is_active ? "⏸ Deactivate" : "▶ Reactivate"}
            </button>
            <p style={{ fontSize:"11px", color:"#94A3B8", textAlign:"center", marginTop:"6px", lineHeight:1.4 }}>
              {member.is_active ? "Deactivating prevents shift assignment." : "Reactivating allows shift assignment again."}
            </p>
            <button style={{ ...s.actionBtn, marginTop:"8px", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA", display:"inline-flex", alignItems:"center", justifyContent:"center", gap:"6px" }} onClick={() => setShowDelete(true)}>
              <Trash2 size={14} /> Delete Staff
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={s.formCard}>
          {/* Profile Details */}
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
                      style={{ flex:1, padding:"9px 12px", borderRadius:"10px", cursor:"pointer", fontWeight:"700", fontSize:"12px",
                        background: form.staff_type === opt.val ? "#EEF2FF" : "#F8FAFC",
                        color:      form.staff_type === opt.val ? "#4338CA" : "#94A3B8",
                        border:     `2px solid ${form.staff_type === opt.val ? "#6366F1" : "#E2E8F0"}` }}>
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
                      return <button key={day} type="button" onClick={() => toggleDay(idx)} style={{ padding:"7px 11px", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer", background: active ? "#2563EB" : "#F1F5F9", color: active ? "#fff" : "#64748B", border: active ? "1.5px solid #2563EB" : "1.5px solid #E2E8F0" }}>{day}</button>;
                    })}
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {DAYS.map((day, idx) => {
                      const active = (member.default_work_days || "0000000").padEnd(7,"0")[idx] === "1";
                      return <span key={day} style={{ padding:"5px 10px", borderRadius:"8px", fontSize:"12px", fontWeight:"700", background: active ? "#DBEAFE" : "#F1F5F9", color: active ? "#1E40AF" : "#94A3B8", border: `1.5px solid ${active ? "#BFDBFE" : "#E2E8F0"}` }}>{day}</span>;
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Skill Sets */}
          <div style={{ borderTop:"1.5px solid #F1F5F9", paddingTop:"20px" }}>
            <h3 style={{ ...s.formTitle, marginBottom:"16px" }}>Skill Sets</h3>
            <SkillSetsTab staffId={id} />
          </div>
        </div>
      </div>

      {showDelete && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ marginBottom:"12px" }}><Trash2 size={36} color="#EF4444" /></div>
            <h3 style={{ fontSize:"18px", fontWeight:"800", color:"#1E293B", marginBottom:"10px" }}>Delete Staff Member?</h3>
            <p style={{ fontSize:"14px", color:"#64748B", lineHeight:1.6, marginBottom:"24px" }}>This will permanently remove <strong>{member.users?.full_name}</strong>. This cannot be undone.</p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button style={s.cancelBtn} onClick={() => setShowDelete(false)} disabled={deleting}>Cancel</button>
              <button style={{ padding:"9px 20px", borderRadius:"8px", background:"#EF4444", color:"#fff", border:"none", fontSize:"13px", fontWeight:"600", cursor:"pointer" }} onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout: { display:"grid", gridTemplateColumns:"280px 1fr", gap:"20px", alignItems:"start" },
  profileCard: { background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px", textAlign:"center" },
  avatarLg: { width:"72px", height:"72px", borderRadius:"50%", color:"#fff", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" },
  profileName: { fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" },
  profileEmail: { fontSize:"13px", color:"#64748B", marginBottom:"12px" },
  typeBadge: { display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600", marginBottom:"16px" },
  metaRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:"1px solid #F1F5F9", fontSize:"13px" },
  metaLabel: { color:"#64748B", fontWeight:"500" },
  metaVal: { color:"#1E293B", fontWeight:"600" },
  statusBadge: { padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  cardActions: { marginTop:"16px", display:"flex", flexDirection:"column", gap:"4px" },
  actionBtn: { width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer" },
  formCard: { background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px" },
  formHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1E293B" },
  editBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  cancelBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  saveBtn: { background:"#2563EB", border:"none", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#fff", cursor:"pointer" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"16px", marginBottom:"24px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" },
  value: { fontSize:"14px", color:"#1E293B", fontWeight:"500" },
  input: { display:"block", width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px", color:"#1E293B", background:"#fff", boxSizing:"border-box" },
  hint: { fontSize:"11px", color:"#94A3B8", marginTop:"4px" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal: { background:"#fff", borderRadius:"16px", padding:"32px 28px", width:"360px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
};
