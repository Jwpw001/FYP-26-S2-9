import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name="") {
  let h=0; for(let i=0;i<name.length;i++) h=name.charCodeAt(i)+((h<<5)-h);
  return AVATAR_COLORS[Math.abs(h)%AVATAR_COLORS.length];
}

export default function AdminStaffDetail() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [member,    setMember]    = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [assigned,  setAssigned]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [showDel,   setShowDel]   = useState(false);
  const [editing,   setEditing]   = useState(false);
  const [error,     setError]     = useState("");
  const [success,   setSuccess]   = useState("");
  const [form, setForm] = useState({ full_name:"", staff_type:"regular", default_work_days:"1111100", is_active:true });

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    const { data: staffRow } = await supabase
      .from("staff")
      .select("staff_id,staff_type,default_work_days,hired_at,is_active,outlet_id,users(user_id,full_name,email),outlets(name)")
      .eq("staff_id", id).single();

    if (!staffRow) { goTo("/system-admin/staff"); return; }

    const [{ data: skillRows }, { data: tagRows }] = await Promise.all([
      supabase.from("skills").select("skill_id,name").order("name"),
      supabase.from("user_skill_tags").select("skill_id").eq("user_id", staffRow.users?.user_id),
    ]);

    setMember(staffRow);
    setAllSkills(skillRows || []);
    setAssigned((tagRows||[]).map(t => t.skill_id));
    setForm({
      full_name: staffRow.users?.full_name || "",
      staff_type: staffRow.staff_type || "regular",
      default_work_days: staffRow.default_work_days || "1111100",
      is_active: staffRow.is_active ?? true,
    });
    setLoading(false);
  }

  function toggleSkill(skillId) {
    setAssigned(prev => prev.includes(skillId) ? prev.filter(s=>s!==skillId) : [...prev,skillId]);
  }
  function toggleDay(idx) {
    const arr = form.default_work_days.padEnd(7,"0").split("");
    arr[idx] = arr[idx]==="1" ? "0" : "1";
    setForm(p => ({ ...p, default_work_days: arr.join("") }));
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    await supabase.from("users").update({ full_name: form.full_name.trim() }).eq("user_id", member.users.user_id);
    await supabase.from("staff").update({
      staff_type: form.staff_type,
      default_work_days: form.staff_type==="regular" ? form.default_work_days : null,
      is_active: form.is_active,
    }).eq("staff_id", id);
    await supabase.from("user_skill_tags").delete().eq("user_id", member.users.user_id);
    if (assigned.length > 0) {
      await supabase.from("user_skill_tags").insert(assigned.map(skill_id => ({ user_id: member.users.user_id, skill_id })));
    }
    setSaving(false);
    setSuccess("Profile updated successfully.");
    setEditing(false);
    await fetchProfile();
  }

  async function toggleActive() {
    const newVal = !member.is_active;
    await supabase.from("staff").update({ is_active: newVal }).eq("staff_id", id);
    setMember(prev => ({ ...prev, is_active: newVal }));
    setForm(prev => ({ ...prev, is_active: newVal }));
  }

  async function handleDelete() {
    setDeleting(true);
    const userId = member.users?.user_id;
    await supabase.from("user_skill_tags").delete().eq("user_id", userId);
    await supabase.from("staff").delete().eq("staff_id", id);
    await supabase.from("users").delete().eq("user_id", userId);
    goTo("/system-admin/staff");
  }

  if (loading) return <AdminLayout title="Staff Profile"><div style={{ padding:"60px", textAlign:"center", color:"#64748B" }}>Loading…</div></AdminLayout>;

  const name = member.users?.full_name || "?";
  const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
  const workDays = (form.default_work_days||"0000000").padEnd(7,"0");

  return (
    <AdminLayout title="Staff Profile">
      <button style={s.back} onClick={() => goTo("/system-admin/staff")}>← Back to Staff</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ ...s.avatarLg, background: avatarColor(name) }}>{initials}</div>
          <h2 style={s.profileName}>{name}</h2>
          <p style={s.profileEmail}>{member.users?.email}</p>
          <span style={{ ...s.typeBadge, background: member.staff_type==="regular"?"#DBEAFE":"#F3E8FF", color: member.staff_type==="regular"?"#1E40AF":"#6B21A8" }}>
            {member.staff_type==="regular"?"Regular Staff":"Outlet Casual"}
          </span>

          {member.outlets?.name && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Outlet</span>
              <span style={s.metaVal}>{member.outlets.name}</span>
            </div>
          )}
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ ...s.statusBadge, background: member.is_active?"#DCFCE7":"#F3F4F6", color: member.is_active?"#166534":"#6B7280" }}>
              {member.is_active?"Active":"Inactive"}
            </span>
          </div>
          {member.hired_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Hired</span>
              <span style={s.metaVal}>{new Date(member.hired_at).toLocaleDateString("en-SG",{year:"numeric",month:"short",day:"numeric"})}</span>
            </div>
          )}

          <div style={s.cardActions}>
            <button onClick={toggleActive}
              style={{ ...s.actionBtn, background: member.is_active?"#FEF3C7":"#DCFCE7", color: member.is_active?"#92400E":"#166534", border: member.is_active?"1px solid #FDE68A":"1px solid #BBF7D0" }}>
              {member.is_active?"Deactivate":"Reactivate"}
            </button>
            <button onClick={() => setShowDel(true)}
              style={{ ...s.actionBtn, marginTop:"8px", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA" }}>
              Delete Staff
            </button>
          </div>
        </div>

        {/* Right form */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Profile Details</h3>
            {!editing
              ? <button style={s.editBtn} onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>Edit</button>
              : <div style={{ display:"flex", gap:"8px" }}>
                  <button style={s.cancelBtn} onClick={() => { setEditing(false); setError(""); fetchProfile(); }}>Cancel</button>
                  <button style={s.saveBtn} onClick={handleSave} disabled={saving}>{saving?"Saving…":"Save"}</button>
                </div>
            }
          </div>

          {error   && <div style={s.errBox}>{error}</div>}
          {success && <div style={s.okBox}>{success}</div>}

          <div style={s.fields}>
            <Field label="Full Name">
              {editing ? <input style={s.input} value={form.full_name} onChange={e=>setForm(p=>({...p,full_name:e.target.value}))} />
                       : <p style={s.value}>{member.users?.full_name}</p>}
            </Field>
            <Field label="Email">
              <p style={s.value}>{member.users?.email}</p>
              {editing && <p style={s.hint}>Email cannot be changed here.</p>}
            </Field>
            <Field label="Staff Type">
              {editing
                ? <select style={s.input} value={form.staff_type} onChange={e=>setForm(p=>({...p,staff_type:e.target.value}))}>
                    <option value="regular">Regular Staff</option>
                    <option value="casual">Outlet Casual Staff</option>
                  </select>
                : <p style={s.value}>{member.staff_type==="regular"?"Regular Staff":"Outlet Casual Staff"}</p>}
            </Field>

            {form.staff_type==="regular" && (
              <Field label="Default Work Days">
                {editing ? (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {DAYS.map((day,idx) => {
                      const on = workDays[idx]==="1";
                      return <button key={day} type="button" onClick={() => toggleDay(idx)}
                        style={{ padding:"7px 11px", borderRadius:"8px", fontSize:"12px", fontWeight:"700", cursor:"pointer",
                          background:on?"#2563EB":"#F1F5F9", color:on?"#FFF":"#64748B", border:`1.5px solid ${on?"#2563EB":"#E2E8F0"}` }}>
                        {day}
                      </button>;
                    })}
                  </div>
                ) : (
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {DAYS.map((day,idx) => {
                      const on = (member.default_work_days||"0000000").padEnd(7,"0")[idx]==="1";
                      return <span key={day} style={{ padding:"5px 10px", borderRadius:"8px", fontSize:"12px", fontWeight:"700",
                        background:on?"#DBEAFE":"#F1F5F9", color:on?"#1E40AF":"#94A3B8", border:`1.5px solid ${on?"#BFDBFE":"#E2E8F0"}` }}>{day}</span>;
                    })}
                  </div>
                )}
              </Field>
            )}
          </div>

          <div style={{ borderTop:"1px solid #F1F5F9", paddingTop:"20px" }}>
            <h4 style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", marginBottom:"12px" }}>Skill Tags</h4>
            {editing && <p style={s.hint}>Click to toggle skill tags.</p>}
            <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginTop:"8px" }}>
              {allSkills.map(sk => {
                const on = assigned.includes(sk.skill_id);
                return (
                  <button key={sk.skill_id}
                    onClick={() => editing && toggleSkill(sk.skill_id)} disabled={!editing}
                    style={{ padding:"6px 12px", borderRadius:"100px", fontSize:"13px", fontWeight:"500", transition:"all 0.15s", cursor:editing?"pointer":"default",
                      background:on?"#0F172A":"#F1F5F9", color:on?"#FFF":"#64748B",
                      border:`1.5px solid ${on?"#0F172A":"#E2E8F0"}`, opacity:editing?1:on?1:0.6 }}>
                    {sk.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {showDel && (
        <div style={s.overlay} onClick={() => setShowDel(false)}>
          <div style={s.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ fontSize:"36px", marginBottom:"12px" }}>🗑</div>
            <h3 style={{ fontSize:"18px", fontWeight:"800", color:"#1E293B", marginBottom:"10px" }}>Delete Staff Member?</h3>
            <p style={{ fontSize:"14px", color:"#64748B", lineHeight:1.6, marginBottom:"24px" }}>
              This will permanently remove <strong>{name}</strong> and all their records.
            </p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button style={s.cancelBtn} onClick={() => setShowDel(false)} disabled={deleting}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting}
                style={{ background:"#EF4444", border:"none", borderRadius:"8px", padding:"8px 20px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" }}>
                {deleting?"Deleting…":"Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return <div><label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" }}>{label}</label>{children}</div>;
}

const s = {
  back:        { background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout:      { display:"grid", gridTemplateColumns:"280px 1fr", gap:"20px", alignItems:"start" },
  profileCard: { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px", textAlign:"center" },
  avatarLg:    { width:"72px", height:"72px", borderRadius:"50%", color:"#FFF", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" },
  profileName: { fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" },
  profileEmail:{ fontSize:"13px", color:"#64748B", marginBottom:"12px" },
  typeBadge:   { display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"12px", fontWeight:"600", marginBottom:"16px" },
  metaRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:"1px solid #F1F5F9", fontSize:"13px" },
  metaLabel:   { color:"#64748B", fontWeight:"500" },
  metaVal:     { color:"#1E293B", fontWeight:"600", fontSize:"12px", textAlign:"right", maxWidth:"60%" },
  statusBadge: { padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  cardActions: { marginTop:"16px", display:"flex", flexDirection:"column", gap:"4px" },
  actionBtn:   { width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer" },
  formCard:    { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px" },
  formHeader:  { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  formTitle:   { fontSize:"15px", fontWeight:"700", color:"#1E293B" },
  editBtn:     { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  cancelBtn:   { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  saveBtn:     { background:"#2563EB", border:"none", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#FFF", cursor:"pointer" },
  errBox:      { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  okBox:       { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  fields:      { display:"flex", flexDirection:"column", gap:"16px", marginBottom:"24px" },
  label:       { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" },
  value:       { fontSize:"14px", color:"#1E293B", fontWeight:"500" },
  input:       { display:"block", width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px", color:"#1E293B", background:"#FFF", boxSizing:"border-box" },
  hint:        { fontSize:"11px", color:"#94A3B8", marginTop:"4px" },
  overlay:     { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal:       { background:"#FFF", borderRadius:"16px", padding:"32px 28px", width:"360px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
};
