import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

export default function AddStaff() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId] = useState(null);
  const [skills, setSkills]     = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [selectedSkills, setSelectedSkills] = useState([]);

  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", password: "", staff_type: "regular",
    default_work_days: "1111100", hired_at: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: myStaff }, { data: skillRows }] = await Promise.all([
        supabase.from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1),
        supabase.from("skills").select("skill_id, name").order("name"),
      ]);
      if (!cancelled) {
        setOutletId(myStaff?.[0]?.outlet_id || null);
        setSkills(skillRows || []);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  function toggleSkill(skillId) {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    );
  }

  async function handleSubmit() {
    if (!form.full_name.trim())        { setError("Full name is required."); return; }
    if (!form.username.trim())         { setError("Username is required."); return; }
    if (!form.email.trim())            { setError("Email is required."); return; }
    if (!form.password.trim())         { setError("Password is required."); return; }
    if (form.password.length < 6)      { setError("Password must be at least 6 characters."); return; }
    if (!outletId)                     { setError("No outlet found for your account."); return; }

    setSaving(true); setError("");

    try {
      await api.post("/api/auth/create-staff", {
        full_name: form.full_name.trim(),
        username: form.username.trim().toLowerCase().replace(/\s+/g, "_"),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        role: form.staff_type === "regular" ? "regular_staff" : "outlet_casual_staff",
        outlet_id: outletId,
        staff_type: form.staff_type,
        default_work_days: form.staff_type === "regular" ? form.default_work_days : null,
        hired_at: form.hired_at || null,
        skill_ids: selectedSkills,
      });

      setSuccess("Staff member added successfully!");
      setTimeout(() => goTo("/outlet-manager/staff"), 1500);
    } catch (err) {
      setError(err.message || "Failed to add staff. Please try again.");
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <ManagerLayout title="Add New Staff">
      <button style={s.back} onClick={() => goTo("/outlet-manager/staff")}>
        ← Back to Staff
      </button>

      <div style={s.layout}>
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Staff Details</h3>

          {error   && <div style={s.error}>{error}</div>}
          {success && <div style={s.successMsg}>{success}</div>}

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} placeholder="e.g. Sarah Tan"
                value={form.full_name}
                onChange={e => {
                  const name = e.target.value;
                  setForm(p => ({
                    ...p,
                    full_name: name,
                    // Auto-fill username only if user hasn't manually changed it
                    username: p.username === p.full_name.trim().toLowerCase().replace(/\s+/g, "_")
                      ? name.trim().toLowerCase().replace(/\s+/g, "_")
                      : p.username,
                  }));
                }} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Username *</label>
              <input style={s.input} placeholder="e.g. sarah_tan"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} />
              <p style={s.hint}>Auto-filled from name. You can edit it.</p>
            </div>
            <div style={s.field}>
              <label style={s.label}>Email Address *</label>
              <input style={s.input} type="email" placeholder="sarah@example.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              <p style={s.hint}>They will use this email to log in.</p>
            </div>
            <div style={s.field}>
              <label style={s.label}>Password *</label>
              <div style={{ position: "relative" }}>
                <input
                  style={{ ...s.input, paddingRight: "40px" }}
                  type={showPassword ? "text" : "password"}
                  placeholder="Minimum 6 characters"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#94A3B8", padding: "2px" }}>
                  {showPassword
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              <p style={s.hint}>Staff will use this password to log in.</p>
            </div>
            <div style={s.field}>
              <label style={s.label}>Staff Type</label>
              <select style={s.input} value={form.staff_type}
                onChange={e => setForm(p => ({ ...p, staff_type: e.target.value }))}>
                <option value="regular">Regular Staff</option>
                <option value="casual">Outlet Casual Staff</option>
              </select>
            </div>
            {form.staff_type === "regular" && (
              <div style={s.field}>
                <label style={s.label}>Default Work Days</label>
                <div style={s.daysRow}>
                  {DAYS.map((day, idx) => {
                    const active = form.default_work_days[idx] === "1";
                    return (
                      <button key={day} type="button"
                        style={{ ...s.dayBtn, ...(active ? s.dayBtnActive : {}) }}
                        onClick={() => {
                          const arr = form.default_work_days.split("");
                          arr[idx] = active ? "0" : "1";
                          setForm(p => ({ ...p, default_work_days: arr.join("") }));
                        }}>
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={s.field}>
              <label style={s.label}>Hire Date</label>
              <input style={s.input} type="date" value={form.hired_at}
                onChange={e => setForm(p => ({ ...p, hired_at: e.target.value }))} />
            </div>
          </div>
        </div>

        <div style={s.section}>
          <h3 style={s.sectionTitle}>Skill Tags</h3>
          <p style={s.sectionSub}>Select the skills this staff member has.</p>
          <div style={s.skillGrid}>
            {skills.map(sk => {
              const active = selectedSkills.includes(sk.skill_id);
              return (
                <button key={sk.skill_id} type="button"
                  style={{ ...s.skillChip, ...(active ? s.skillChipActive : {}) }}
                  onClick={() => toggleSkill(sk.skill_id)}>
                  {sk.name}
                </button>
              );
            })}
          </div>
          {skills.length === 0 && (
            <p style={s.noSkills}>No skill tags set up yet. Add them in System Admin → Skill Tags.</p>
          )}
        </div>
      </div>

      <div style={s.actions}>
        <button style={s.cancelBtn} onClick={() => goTo("/outlet-manager/staff")}>
          Cancel
        </button>
        <button style={s.saveBtn} onClick={handleSubmit} disabled={saving}>
          {saving ? "Adding…" : "Add Staff Member"}
        </button>
      </div>
    </ManagerLayout>
  );
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600",
    color:"#7A7870", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"20px", marginBottom:"20px" },
  section: { background:"#FFFFFF", border:"1px solid #E5E2DC", borderRadius:"14px", padding:"24px" },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"4px" },
  sectionSub: { fontSize:"13px", color:"#7A7870", marginBottom:"16px" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600", color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px", border:"1.5px solid #D8D5CE",
    borderRadius:"9px", fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  hint: { fontSize:"11px", color:"#A09D97", marginTop:"4px" },
  daysRow: { display:"flex", gap:"6px", flexWrap:"wrap" },
  dayBtn: { padding:"6px 10px", border:"1.5px solid #E5E2DC", borderRadius:"8px",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", background:"#F7F6F3", cursor:"pointer" },
  dayBtnActive: { background:"#1C1B18", color:"#FFFFFF", border:"1.5px solid #1C1B18" },
  skillGrid: { display:"flex", flexWrap:"wrap", gap:"8px" },
  skillChip: { padding:"7px 14px", border:"1.5px solid #E5E2DC", borderRadius:"100px",
    fontSize:"13px", fontWeight:"500", color:"#55524A", background:"#F7F6F3", cursor:"pointer" },
  skillChipActive: { background:"#1C1B18", color:"#FFFFFF", border:"1.5px solid #1C1B18" },
  noSkills: { fontSize:"13px", color:"#A09D97" },
  actions: { display:"flex", justifyContent:"flex-end", gap:"10px" },
  cancelBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px",
    padding:"10px 20px", fontSize:"14px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  saveBtn: { background:"#1C1B18", border:"none", borderRadius:"10px",
    padding:"10px 20px", fontSize:"14px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
};
