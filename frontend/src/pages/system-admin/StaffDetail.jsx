import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
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
  const location = useLocation();
  const backPath = location.state?.from || "/system-admin/staff";

  const [member,    setMember]    = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [assigned,  setAssigned]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    const { data: staffRow } = await supabase
      .from("staff")
      .select("staff_id,staff_type,default_work_days,hired_at,is_active,branch_id,users(user_id,full_name,email),branches(name)")
      .eq("staff_id", id).single();

    if (!staffRow) { goTo("/system-admin/staff"); return; }

    const [{ data: skillRows }, { data: tagRows }] = await Promise.all([
      supabase.from("skills").select("skill_id,name").order("name"),
      supabase.from("user_skill_tags").select("skill_id").eq("user_id", staffRow.users?.user_id),
    ]);

    setMember(staffRow);
    setAllSkills(skillRows || []);
    setAssigned((tagRows||[]).map(t => t.skill_id));
    setLoading(false);
  }

  if (loading) return <AdminLayout title="Staff Profile"><div style={{ padding:"60px", textAlign:"center", color:"#64748B" }}>Loading…</div></AdminLayout>;

  const name = member.users?.full_name || "?";
  const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

  return (
    <AdminLayout title="Staff Profile">
      <button style={s.back} onClick={() => goTo(backPath)}>← Back</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ ...s.avatarLg, background: avatarColor(name) }}>{initials}</div>
          <h2 style={s.profileName}>{name}</h2>
          <p style={s.profileEmail}>{member.users?.email}</p>
          <span style={{ ...s.typeBadge, background: member.staff_type==="regular"?"#DBEAFE":"#F3E8FF", color: member.staff_type==="regular"?"#1E40AF":"#6B21A8" }}>
            {member.staff_type==="regular"?"Regular Staff":"Branch Casual"}
          </span>

          {member.branches?.name && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Branch</span>
              <span style={s.metaVal}>{member.branches.name}</span>
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

          <div style={{ marginTop:"16px", padding:"12px", background:"#F8FAFC", borderRadius:"9px", border:"1px solid #F1F5F9" }}>
            <p style={{ fontSize:"12px", color:"#94A3B8", textAlign:"center", lineHeight:1.5 }}>
              Staff management is handled by the manager.
            </p>
          </div>
        </div>

        {/* Right — read-only details */}
        <div style={s.formCard}>
          <h3 style={{ ...s.formTitle, marginBottom:"20px" }}>Profile Details</h3>

          <div style={s.fields}>
            <Field label="Full Name"><p style={s.value}>{member.users?.full_name}</p></Field>
            <Field label="Email"><p style={s.value}>{member.users?.email}</p></Field>
            <Field label="Staff Type"><p style={s.value}>{member.staff_type==="regular"?"Regular Staff":"Casual Staff"}</p></Field>
            {member.staff_type==="regular" && (
              <Field label="Default Work Days">
                <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                  {DAYS.map((day,idx) => {
                    const on = (member.default_work_days||"0000000").padEnd(7,"0")[idx]==="1";
                    return <span key={day} style={{ padding:"5px 10px", borderRadius:"8px", fontSize:"12px", fontWeight:"700",
                      background:on?"#DBEAFE":"#F1F5F9", color:on?"#1E40AF":"#94A3B8", border:`1.5px solid ${on?"#BFDBFE":"#E2E8F0"}` }}>{day}</span>;
                  })}
                </div>
              </Field>
            )}
          </div>

          <div style={{ borderTop:"1px solid #F1F5F9", paddingTop:"20px" }}>
            <h4 style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", marginBottom:"12px" }}>Skill Tags</h4>
            {assigned.length === 0
              ? <p style={{ fontSize:"13px", color:"#94A3B8" }}>No skill tags assigned.</p>
              : <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
                  {allSkills.filter(sk => assigned.includes(sk.skill_id)).map(sk => (
                    <span key={sk.skill_id}
                      style={{ padding:"6px 12px", borderRadius:"100px", fontSize:"13px", fontWeight:"500",
                        background:"#0F172A", color:"#FFF", border:"1.5px solid #0F172A" }}>
                      {sk.name}
                    </span>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

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
