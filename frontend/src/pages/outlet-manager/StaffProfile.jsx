import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [skills, setSkills] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [profileRes, skillsRes] = await Promise.all([
          api.get(`/api/staff/${id}`),
          api.get("/api/skills"),
        ]);
        // staffController returns { success, staff }
        const staffData = profileRes.staff || profileRes.data;
        setProfile(staffData);
        setSkills(skillsRes.skills || skillsRes.data || []);
        setSelectedSkills((staffData?.user_skill_tags || []).map(t => t.skill_id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  function toggleSkill(skillId) {
    setSelectedSkills(prev =>
      prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]
    );
  }

  async function handleSave() {
    setSaving(true); setError("");
    try {
      await api.patch(`/api/staff/${id}`, {
        full_name: profile.users?.full_name,
        email: profile.users?.email,
        staff_type: profile.staff_type,
        hired_at: profile.hired_at,
        skill_ids: selectedSkills,
      });
      setSuccess("Profile updated.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await api.patch(`/api/staff/${id}`, { is_active: !profile.is_active });
      setProfile(prev => ({ ...prev, is_active: !prev.is_active }));
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <ManagerLayout title="Staff Profile"><div style={s.loading}>Loading…</div></ManagerLayout>;
  if (!profile) return <ManagerLayout title="Staff Profile"><div style={s.loading}>Staff not found.</div></ManagerLayout>;

  return (
    <ManagerLayout title="Staff Profile">
      <button style={s.back} onClick={() => navigate("/outlet-manager/staff")}>← Back to Staff</button>
      {error && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      <div style={s.card}>
        <div style={s.profileTop}>
          <div style={s.avatar}>{profile.users?.full_name?.[0]?.toUpperCase() || "?"}</div>
          <div>
            <h2 style={s.name}>{profile.users?.full_name || profile.users?.email}</h2>
            <p style={s.email}>{profile.users?.email}</p>
            <span style={{
              ...s.typeBadge,
              background: profile.staff_type === "regular" ? "#DBEAFE" : "#F5F3FF",
              color: profile.staff_type === "regular" ? "#1E40AF" : "#6D28D9"
            }}>
              {profile.staff_type === "regular" ? "Regular Staff" : "Outlet Casual Staff"}
            </span>
          </div>
          <button
            style={{
              ...s.activeBtn,
              background: profile.is_active ? "#FEF2F2" : "#DCFCE7",
              color: profile.is_active ? "#991B1B" : "#166534"
            }}
            onClick={toggleActive}
          >
            {profile.is_active ? "Deactivate" : "Reactivate"}
          </button>
        </div>

        <div style={s.grid}>
          <div style={s.field}>
            <label style={s.label}>Full Name</label>
            <input style={s.input} value={profile.users?.full_name || ""}
              onChange={e => setProfile(prev => ({ ...prev, users: { ...prev.users, full_name: e.target.value } }))} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Email</label>
            <input style={s.input} value={profile.users?.email || ""}
              onChange={e => setProfile(prev => ({ ...prev, users: { ...prev.users, email: e.target.value } }))} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Staff Type</label>
            <select style={s.input} value={profile.staff_type}
              onChange={e => setProfile(prev => ({ ...prev, staff_type: e.target.value }))}>
              <option value="regular">Regular Staff</option>
              <option value="casual">Outlet Casual Staff</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>Hire Date</label>
            <input style={s.input} type="date" value={profile.hired_at?.split("T")[0] || ""}
              onChange={e => setProfile(prev => ({ ...prev, hired_at: e.target.value }))} />
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
          <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </ManagerLayout>
  );
}

const s = {
  loading: { textAlign: "center", padding: "60px", color: "#7A7870" },
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#7A7870", cursor: "pointer", marginBottom: "20px", padding: 0 },
  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "28px" },
  profileTop: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px", flexWrap: "wrap" },
  avatar: { width: "56px", height: "56px", borderRadius: "50%", background: "#E5E2DC", color: "#55524A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: "700", flexShrink: 0 },
  name: { fontSize: "18px", fontWeight: "800", color: "#1C1B18" },
  email: { fontSize: "13px", color: "#7A7870", marginTop: "2px" },
  typeBadge: { display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", marginTop: "6px" },
  activeBtn: { marginLeft: "auto", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#55524A" },
  input: { padding: "10px 13px", border: "1.5px solid #D8D5CE", borderRadius: "9px", fontSize: "14px", background: "#FFFFFF", color: "#1C1B18" },
  skillGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  skillTag: { padding: "6px 12px", border: "1.5px solid #E5E2DC", borderRadius: "100px", fontSize: "13px", fontWeight: "500", color: "#55524A", cursor: "pointer", background: "#F7F6F3" },
  skillTagActive: { background: "#1C1B18", color: "#FFFFFF", border: "1.5px solid #1C1B18" },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: "8px" },
  saveBtn: { background: "#1C1B18", border: "none", borderRadius: "9px", padding: "10px 20px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: "pointer" },
};
