import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function CreateShift() {
  const navigate = useNavigate();
  const user = getUser();
  const [form, setForm] = useState({ title: "", shift_date: "", start_time: "", end_time: "" });
  const [roles, setRoles] = useState([{ role_name: "", skill_id: "", headcount: 1 }]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/skills").then(res => setSkills(res.skills || res.data || [])).catch(console.error);
  }, []);

  function addRole() { setRoles(prev => [...prev, { role_name: "", skill_id: "", headcount: 1 }]); }
  function removeRole(i) { setRoles(prev => prev.filter((_, idx) => idx !== i)); }
  function updateRole(i, field, value) { setRoles(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r)); }

  async function handleSave(status) {
    if (!form.shift_date || !form.start_time || !form.end_time) {
      setError("Date, start time and end time are required.");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await api.post("/api/shifts", {
        ...form,
        status,
        roles: roles.filter(r => r.role_name.trim())
      });
      // Backend returns { success, shift } — navigate to the new shift
      const newShiftId = res.shift?.shift_id;
      if (newShiftId) {
        navigate(`/outlet-manager/shifts/${newShiftId}`);
      } else {
        navigate("/outlet-manager/shifts");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ManagerLayout title="Create Shift">
      <button style={s.back} onClick={() => navigate("/outlet-manager/shifts")}>← Back to Shifts</button>
      <div style={s.card}>
        <h2 style={s.heading}>Create New Shift</h2>
        {error && <div style={s.error}>{error}</div>}
        <div style={s.grid}>
          <div style={s.field}>
            <label style={s.label}>Shift Title</label>
            <input style={s.input} placeholder="e.g. Morning Shift" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Date *</label>
            <input style={s.input} type="date" value={form.shift_date} onChange={e => setForm({ ...form, shift_date: e.target.value })} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Start Time *</label>
            <input style={s.input} type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} required />
          </div>
          <div style={s.field}>
            <label style={s.label}>End Time *</label>
            <input style={s.input} type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} required />
          </div>
        </div>

        <div style={s.rolesSection}>
          <div style={s.rolesHeader}>
            <h3 style={s.sectionTitle}>Roles & Headcount</h3>
            <button style={s.addRoleBtn} type="button" onClick={addRole}>+ Add Role</button>
          </div>
          {roles.map((role, i) => (
            <div key={i} style={s.roleRow}>
              <div style={s.field}>
                <label style={s.label}>Role Name</label>
                <input style={s.input} placeholder="e.g. Barista" value={role.role_name} onChange={e => updateRole(i, "role_name", e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Required Skill</label>
                <select style={s.input} value={role.skill_id} onChange={e => updateRole(i, "skill_id", e.target.value)}>
                  <option value="">No specific skill</option>
                  {skills.map(sk => <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>)}
                </select>
              </div>
              <div style={s.field}>
                <label style={s.label}>Headcount</label>
                <input style={{ ...s.input, width: "80px" }} type="number" min="1" value={role.headcount} onChange={e => updateRole(i, "headcount", Number(e.target.value))} />
              </div>
              {roles.length > 1 && (
                <button style={s.removeBtn} type="button" onClick={() => removeRole(i)}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div style={s.actions}>
          <button style={s.draftBtn} onClick={() => handleSave("draft")} disabled={loading}>Save as Draft</button>
          <button style={s.publishBtn} onClick={() => handleSave("published")} disabled={loading}>
            {loading ? "Saving…" : "Publish Shift"}
          </button>
        </div>
      </div>
    </ManagerLayout>
  );
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#7A7870", cursor: "pointer", marginBottom: "20px", padding: 0 },
  card: { background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px", padding: "28px" },
  heading: { fontSize: "18px", fontWeight: "800", color: "#1C1B18", marginBottom: "20px" },
  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" },
  field: { display: "flex", flexDirection: "column", gap: "6px" },
  label: { fontSize: "13px", fontWeight: "600", color: "#55524A" },
  input: { padding: "10px 13px", border: "1.5px solid #D8D5CE", borderRadius: "9px", fontSize: "14px", background: "#FFFFFF", color: "#1C1B18" },
  rolesSection: { marginBottom: "24px" },
  rolesHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  addRoleBtn: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "7px", padding: "6px 12px", fontSize: "13px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" },
  roleRow: { display: "flex", gap: "12px", alignItems: "flex-end", padding: "12px", background: "#F7F6F3", borderRadius: "10px", marginBottom: "8px", flexWrap: "wrap" },
  removeBtn: { background: "none", border: "none", color: "#991B1B", cursor: "pointer", fontSize: "16px", paddingBottom: "8px" },
  actions: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  draftBtn: { background: "#F7F6F3", border: "1px solid #E5E2DC", borderRadius: "9px", padding: "10px 20px", fontSize: "13px", fontWeight: "600", color: "#1C1B18", cursor: "pointer" },
  publishBtn: { background: "#1C1B18", border: "none", borderRadius: "9px", padding: "10px 20px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: "pointer" },
};
