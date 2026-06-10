import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function AddStaff() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name:"", email:"", role:"regular_staff", staff_type:"regular", hired_at:"", default_work_days:"" });
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/account/skills").then(res => setSkills(res.data || [])).catch(console.error);
  }, []);

  function toggleSkill(skillId) {
    setSelectedSkills(prev => prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await api.post("/api/staff", { ...form, skill_ids: selectedSkills });
      navigate("/outlet-manager/staff");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  return (
    <ManagerLayout title="Add Staff">
      <button style={s.back} onClick={() => navigate("/outlet-manager/staff")}>← Back to Staff</button>
      <div style={s.card}>
        <h2 style={s.heading}>Add New Staff Member</h2>
        {error && <div style={s.error}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div style={s.grid}>
            <div style={s.field}>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} value={form.full_name} onChange={e => setForm({...form, full_name:e.target.value})} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email *</label>
              <input style={s.input} type="email" value={form.email} onChange={e => setForm({...form, email:e.target.value})} required />
            </div>
            <div style={s.field}>
              <label style={s.label}>Staff Type *</label>
              <select style={s.input} value={form.staff_type} onChange={e => setForm({...form, staff_type:e.target.value, role: e.target.value === "regular" ? "regular_staff" : "outlet_casual_staff"})}>
                <option value="regular">Regular Staff</option>
                <option value="casual">Outlet Casual Staff</option>
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>Hire Date</label>
              <input style={s.input} type="date" value={form.hired_at} onChange={e => setForm({...form, hired_at:e.target.value})} />
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Skill Tags</label>
            <div style={s.skillGrid}>
              {skills.map(skill => (
                <div key={skill.skill_id}
                  style={{ ...s.skillTag, ...(selectedSkills.includes(skill.skill_id) ? s.skillTagActive : {}) }}
                  onClick={() => toggleSkill(skill.skill_id)}>
                  {skill.name}
                </div>
              ))}
            </div>
          </div>
          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={() => navigate("/outlet-manager/staff")}>Cancel</button>
            <button type="submit" style={s.submitBtn} disabled={loading}>{loading ? "Adding…" : "Add Staff Member"}</button>
          </div>
        </form>
      </div>
    </ManagerLayout>
  );
}
const s = {
  back:{ background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#7A7870", cursor:"pointer", marginBottom:"20px", padding:0 },
  card:{ background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"28px" },
  heading:{ fontSize:"18px", fontWeight:"800", color:"#1C1B18", marginBottom:"20px" },
  error:{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B", padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  grid:{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" },
  field:{ display:"flex", flexDirection:"column", gap:"6px", marginBottom:"16px" },
  label:{ fontSize:"13px", fontWeight:"600", color:"#55524A" },
  input:{ padding:"10px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px", background:"#FFFFFF", color:"#1C1B18" },
  skillGrid:{ display:"flex", flexWrap:"wrap", gap:"8px" },
  skillTag:{ padding:"6px 12px", border:"1.5px solid #E5E2DC", borderRadius:"100px", fontSize:"13px", fontWeight:"500", color:"#55524A", cursor:"pointer", background:"#F7F6F3" },
  skillTagActive:{ background:"#1C1B18", color:"#FFFFFF", border:"1.5px solid #1C1B18" },
  actions:{ display:"flex", justifyContent:"flex-end", gap:"10px", marginTop:"24px" },
  cancelBtn:{ background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"9px", padding:"10px 20px", fontSize:"13px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  submitBtn:{ background:"#1C1B18", border:"none", borderRadius:"9px", padding:"10px 20px", fontSize:"13px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
};
