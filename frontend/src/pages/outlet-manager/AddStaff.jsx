import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { Search } from "lucide-react";

export default function AddStaff() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [outletId, setOutletId]         = useState(null);
  const [operatingDays, setOperatingDays] = useState(null); // "1111100" from branch_settings
  const [skills, setSkills]             = useState([]);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [selectedSkills, setSelectedSkills] = useState([]); // [{skill_id, name, experience_level, years_of_experience}]

  const [skillSearch, setSkillSearch] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    full_name: "", username: "", email: "", password: "", staff_type: "regular",
    default_work_days: "1111100", hired_at: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: myStaff }, skillRes] = await Promise.all([
        supabase.from("staff").select("branch_id")
          .eq("user_id", userId).eq("is_active", true).limit(1),
        api.get("/api/business/skills/assignable").catch(() => ({ skills: [] })),
      ]);
      let oid = myStaff?.[0]?.branch_id || null;
      if (!oid) {
        const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
        oid = omRow?.[0]?.branch_id || null;
      }
      if (cancelled) return;
      setOutletId(oid);
      setSkills(skillRes.skills || []);

      if (oid) {
        const { data: settings } = await supabase
          .from("branch_settings")
          .select("operating_days")
          .eq("branch_id", oid)
          .maybeSingle();
        if (!cancelled && settings?.operating_days) {
          setOperatingDays(settings.operating_days);
          setForm(p => ({ ...p, default_work_days: settings.operating_days }));
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const LEVELS = ["junior", "intermediate", "senior", "lead"];

  function toggleSkill(skill) {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skill_id === skill.skill_id);
      if (exists) return prev.filter(s => s.skill_id !== skill.skill_id);
      return [...prev, { skill_id: skill.skill_id, name: skill.name, experience_level: "junior", years_of_experience: "" }];
    });
  }

  function updateSkillField(skill_id, field, value) {
    setSelectedSkills(prev => prev.map(s => s.skill_id === skill_id ? { ...s, [field]: value } : s));
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
        branch_id: outletId,
        staff_type: form.staff_type,
        default_work_days: form.staff_type === "regular" ? form.default_work_days : null,
        hired_at: form.hired_at || null,
        skill_assignments: selectedSkills.map(s => ({
          skill_id: s.skill_id,
          experience_level: s.experience_level || null,
          years_of_experience: s.years_of_experience !== "" ? Number(s.years_of_experience) : null,
        })),
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
              <input style={s.input} placeholder="e.g. Sarah Tan" autoComplete="off"
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
              <input style={s.input} placeholder="e.g. sarah_tan" autoComplete="off"
                value={form.username}
                onChange={e => setForm(p => ({ ...p, username: e.target.value.toLowerCase().replace(/\s+/g, "_") }))} />
              <p style={s.hint}>Auto-filled from name. You can edit it.</p>
            </div>
            <div style={s.field}>
              <label style={s.label}>Email Address *</label>
              <input style={s.input} type="email" placeholder="sarah@example.com" autoComplete="off"
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
                  autoComplete="new-password"
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
                <option value="casual">Casual Staff</option>
              </select>
            </div>
            {form.staff_type === "regular" && (
              <div style={s.field}>
                <label style={s.label}>Default Work Days</label>
                <div style={s.daysRow}>
                  {DAYS.map((day, idx) => {
                    const active    = form.default_work_days[idx] === "1";
                    const allowed   = !operatingDays || operatingDays[idx] === "1";
                    return (
                      <button key={day} type="button"
                        disabled={!allowed}
                        style={{
                          ...s.dayBtn,
                          ...(active ? s.dayBtnActive : {}),
                          ...(!allowed ? { opacity: 0.3, cursor: "not-allowed" } : {}),
                        }}
                        onClick={() => {
                          if (!allowed) return;
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
          {skills.length > 4 && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"#F7F6F3", borderRadius:"9px", padding:"8px 12px", border:"1px solid #E5E2DC", marginBottom:"14px" }}>
              <Search size={13} color="#7A7870" strokeWidth={2}/>
              <input value={skillSearch} onChange={e => setSkillSearch(e.target.value)}
                placeholder="Search skills…"
                style={{ border:"none", outline:"none", fontSize:"12px", color:"#1C1B18", background:"transparent", flex:1, fontFamily:"inherit" }}/>
              {skillSearch && <button onClick={() => setSkillSearch("")} style={{ background:"none", border:"none", color:"#7A7870", cursor:"pointer", fontSize:"15px", lineHeight:1, padding:"0" }}>×</button>}
            </div>
          )}
          <div style={s.skillGridNew}>
            {skills.filter(sk => sk.name.toLowerCase().includes(skillSearch.toLowerCase())).map((sk) => {
              const active = selectedSkills.some(s => s.skill_id === sk.skill_id);
              return (
                <button key={sk.skill_id} type="button"
                  style={{ ...s.skillCardNew, ...(active ? s.skillCardNewActive : {}) }}
                  onMouseEnter={(e) => {
                    if (!active) { e.currentTarget.style.background = "#F7F6F3"; e.currentTarget.style.borderColor = "#D8D5CE"; }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) { e.currentTarget.style.background = "#FFFFFF"; e.currentTarget.style.borderColor = "#E5E2DC"; }
                  }}
                  onClick={() => toggleSkill(sk)}>
                  <div style={{ ...s.skillCardAvatar, background: active ? "#FFFFFF" : "#7A7870", color: active ? "#1C1B18" : "#FFFFFF" }}>
                    {sk.name[0]?.toUpperCase()}
                  </div>
                  <p style={{ ...s.skillCardName, color: active ? "#FFFFFF" : "#1C1B18" }}>{sk.name}</p>
                  {active && (
                    <div style={s.skillCardCheck}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {skills.length === 0 && (
            <p style={s.noSkills}>No skill sets added yet. Add them in Skill Tags first.</p>
          )}

          {/* Experience details for selected skills */}
          {selectedSkills.length > 0 && (
            <div style={{ marginTop: "18px", display: "flex", flexDirection: "column", gap: "10px" }}>
              <p style={{ fontSize: "11px", fontWeight: "700", color: "#7A7870", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Experience Details
              </p>
              {selectedSkills.map(sel => (
                <div key={sel.skill_id} style={{ background: "#F7F6F3", border: "1px solid #E5E2DC", borderRadius: "10px", padding: "12px 14px" }}>
                  <p style={{ fontSize: "13px", fontWeight: "700", color: "#1C1B18", marginBottom: "10px" }}>{sel.name}</p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px" }}>
                    {LEVELS.map(lv => (
                      <button key={lv} type="button"
                        onClick={() => updateSkillField(sel.skill_id, "experience_level", lv)}
                        style={{
                          padding: "4px 12px", borderRadius: "99px", fontSize: "11px", fontWeight: "700", cursor: "pointer",
                          background: sel.experience_level === lv ? "#1C1B18" : "#FFFFFF",
                          color: sel.experience_level === lv ? "#FFFFFF" : "#7A7870",
                          border: `1.5px solid ${sel.experience_level === lv ? "#1C1B18" : "#D8D5CE"}`,
                        }}>
                        {lv.charAt(0).toUpperCase() + lv.slice(1)}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#7A7870", marginRight: "6px" }}>Years</span>
                    <button type="button"
                      onClick={() => updateSkillField(sel.skill_id, "years_of_experience", Math.max(0, (Number(sel.years_of_experience) || 0) - 1))}
                      style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1.5px solid #D8D5CE", background: "#FFFFFF", color: "#1C1B18", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}>
                      −
                    </button>
                    <div style={{ minWidth: "52px", height: "28px", background: "#FFFFFF", border: "1.5px solid #D8D5CE", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "700", color: "#1C1B18" }}>
                        {sel.years_of_experience !== "" && sel.years_of_experience != null ? sel.years_of_experience : "—"}
                      </span>
                      {(sel.years_of_experience !== "" && sel.years_of_experience != null) && (
                        <span style={{ fontSize: "10px", color: "#7A7870", fontWeight: "600" }}>yr{Number(sel.years_of_experience) !== 1 ? "s" : ""}</span>
                      )}
                    </div>
                    <button type="button"
                      onClick={() => updateSkillField(sel.skill_id, "years_of_experience", (Number(sel.years_of_experience) || 0) + 1)}
                      style={{ width: "28px", height: "28px", borderRadius: "50%", border: "1.5px solid #D8D5CE", background: "#FFFFFF", color: "#1C1B18", fontSize: "16px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, flexShrink: 0 }}>
                      +
                    </button>
                    {(sel.years_of_experience !== "" && sel.years_of_experience != null && Number(sel.years_of_experience) > 0) && (
                      <button type="button" onClick={() => updateSkillField(sel.skill_id, "years_of_experience", "")}
                        style={{ background: "none", border: "none", color: "#A09D97", cursor: "pointer", fontSize: "13px", marginLeft: "2px", padding: "0 2px" }}>×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
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
  skillGridNew: { display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(150px, 1fr))", gap:"12px" },
  skillCardNew: {
    background:"#FFFFFF",
    border:"1.5px solid #E5E2DC",
    borderRadius:"14px",
    padding:"16px 14px",
    cursor:"pointer",
    textAlign:"center",
    display:"flex",
    flexDirection:"column",
    alignItems:"center",
    gap:"10px",
    transition:"all 0.2s ease",
    position:"relative",
  },
  skillCardNewActive: {
    background:"#1C1B18",
    borderColor:"#1C1B18",
  },
  skillCardAvatar: {
    width:"40px",
    height:"40px",
    borderRadius:"50%",
    background:"#7A7870",
    color:"#FFFFFF",
    fontSize:"16px",
    fontWeight:"700",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    flexShrink:0,
  },
  skillCardName: {
    fontSize:"13px",
    fontWeight:"600",
    color:"#1C1B18",
    margin:0,
    lineHeight:"1.3",
    wordBreak:"break-word",
  },
  skillCardCheck: {
    position:"absolute",
    top:"8px",
    right:"8px",
    width:"24px",
    height:"24px",
    background:"#1C1B18",
    borderRadius:"6px",
    color:"#FFFFFF",
    display:"flex",
    alignItems:"center",
    justifyContent:"center",
    flexShrink:0,
  },
  noSkills: { fontSize:"13px", color:"#A09D97" },
  actions: { display:"flex", justifyContent:"flex-end", gap:"10px" },
  cancelBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"10px",
    padding:"10px 20px", fontSize:"14px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  saveBtn: { background:"#1C1B18", border:"none", borderRadius:"10px",
    padding:"10px 20px", fontSize:"14px", fontWeight:"700", color:"#FFFFFF", cursor:"pointer" },
};
