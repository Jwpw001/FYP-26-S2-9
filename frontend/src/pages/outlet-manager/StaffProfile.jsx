import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [member, setMember]     = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [assigned, setAssigned] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [editing, setEditing]   = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  const [form, setForm] = useState({
    full_name: "", email: "", staff_type: "regular",
    default_work_days: "", is_active: true,
  });

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const { data: staffRow } = await supabase
        .from("staff")
        .select(`
          staff_id, staff_type, default_work_days, hired_at, is_active, outlet_id,
          users ( user_id, full_name, email, role )
        `)
        .eq("staff_id", id)
        .single();

      if (!staffRow) { navigate("/outlet-manager/staff"); return; }

      const { data: skillRows } = await supabase
        .from("skills").select("skill_id, name").order("name");

      const { data: tagRows } = await supabase
        .from("user_skill_tags")
        .select("skill_id")
        .eq("user_id", staffRow.users?.user_id);

      setMember(staffRow);
      setAllSkills(skillRows || []);
      setAssigned((tagRows || []).map(t => t.skill_id));
      setForm({
        full_name: staffRow.users?.full_name || "",
        email: staffRow.users?.email || "",
        staff_type: staffRow.staff_type || "regular",
        default_work_days: staffRow.default_work_days || "",
        is_active: staffRow.is_active ?? true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSkill(skillId) {
    setAssigned(prev =>
      prev.includes(skillId)
        ? prev.filter(s => s !== skillId)
        : [...prev, skillId]
    );
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      // Update users table
      await supabase
        .from("users")
        .update({ full_name: form.full_name.trim() })
        .eq("user_id", member.users.user_id);

      // Update staff table
      await supabase
        .from("staff")
        .update({
          staff_type: form.staff_type,
          default_work_days: form.default_work_days,
          is_active: form.is_active,
        })
        .eq("staff_id", id);

      // Sync skill tags — delete all then reinsert
      await supabase
        .from("user_skill_tags")
        .delete()
        .eq("user_id", member.users.user_id);

      if (assigned.length > 0) {
        await supabase
          .from("user_skill_tags")
          .insert(assigned.map(skill_id => ({
            user_id: member.users.user_id,
            skill_id,
          })));
      }

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
    await supabase
      .from("staff")
      .update({ is_active: newVal })
      .eq("staff_id", id);
    setMember(prev => ({ ...prev, is_active: newVal }));
    setForm(prev => ({ ...prev, is_active: newVal }));
  }

  if (loading) {
    return (
      <ManagerLayout title="Staff Profile">
        <div style={s.loading}>Loading profile…</div>
      </ManagerLayout>
    );
  }

  return (
    <ManagerLayout title="Staff Profile">
      {/* Back */}
      <button style={s.back} onClick={() => navigate("/outlet-manager/staff")}>
        ← Back to Staff
      </button>

      <div style={s.layout}>
        {/* Left — profile card */}
        <div style={s.profileCard}>
          <div style={s.avatarLg}>
            {member.users?.full_name?.[0]?.toUpperCase() || "?"}
          </div>
          <h2 style={s.profileName}>{member.users?.full_name}</h2>
          <p style={s.profileEmail}>{member.users?.email}</p>
          <span style={{
            ...s.typeBadge,
            background: member.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
            color: member.staff_type === "regular" ? "#1E40AF" : "#6B21A8",
          }}>
            {member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual"}
          </span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{
              ...s.statusBadge,
              background: member.is_active ? "#DCFCE7" : "#F3F4F6",
              color: member.is_active ? "#166534" : "#6B7280",
            }}>
              {member.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {member.hired_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Hired</span>
              <span style={s.metaVal}>
                {new Date(member.hired_at).toLocaleDateString("en-SG", {
                  year: "numeric", month: "short", day: "numeric",
                })}
              </span>
            </div>
          )}

          <div style={s.cardActions}>
            <button
              style={{ ...s.actionBtn, background: member.is_active ? "#FEE2E2" : "#DCFCE7",
                color: member.is_active ? "#991B1B" : "#166534" }}
              onClick={toggleActive}
            >
              {member.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        </div>

        {/* Right — edit form */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Profile Details</h3>
            {!editing ? (
              <button style={s.editBtn} onClick={() => setEditing(true)}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={s.cancelBtn} onClick={() => { setEditing(false); setError(""); }}>
                  Cancel
                </button>
                <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {error && <div style={s.error}>{error}</div>}
          {success && <div style={s.successMsg}>{success}</div>}

          {/* Fields */}
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              {editing ? (
                <input
                  style={s.input}
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                />
              ) : (
                <p style={s.value}>{member.users?.full_name}</p>
              )}
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <p style={s.value}>{member.users?.email}</p>
              {editing && <p style={s.hint}>Email cannot be changed here.</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Staff Type</label>
              {editing ? (
                <select
                  style={s.input}
                  value={form.staff_type}
                  onChange={e => setForm(p => ({ ...p, staff_type: e.target.value }))}
                >
                  <option value="regular">Regular Staff</option>
                  <option value="casual">Outlet Casual Staff</option>
                </select>
              ) : (
                <p style={s.value}>
                  {member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual Staff"}
                </p>
              )}
            </div>

            {form.staff_type === "regular" && (
              <div style={s.field}>
                <label style={s.label}>Default Work Days</label>
                {editing ? (
                  <input
                    style={s.input}
                    value={form.default_work_days}
                    placeholder="e.g. 1011011 (Mon–Sun, 1=work)"
                    onChange={e => setForm(p => ({ ...p, default_work_days: e.target.value }))}
                  />
                ) : (
                  <p style={s.value}>{member.default_work_days || "Not set"}</p>
                )}
              </div>
            )}
          </div>

          {/* Skill Tags */}
          <div style={s.skillSection}>
            <h4 style={s.skillTitle}>Skill Tags</h4>
            <div style={s.skillGrid}>
              {allSkills.map(sk => {
                const active = assigned.includes(sk.skill_id);
                return (
                  <button
                    key={sk.skill_id}
                    style={{
                      ...s.skillChip,
                      background: active ? "#1C1B18" : "#F7F6F3",
                      color: active ? "#FFFFFF" : "#55524A",
                      border: active ? "1.5px solid #1C1B18" : "1.5px solid #E5E2DC",
                      cursor: editing ? "pointer" : "default",
                    }}
                    onClick={() => editing && toggleSkill(sk.skill_id)}
                    disabled={!editing}
                  >
                    {sk.name}
                  </button>
                );
              })}
            </div>
            {editing && (
              <p style={s.hint}>Click to toggle skill tags for this staff member.</p>
            )}
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}

const s = {
  loading: { textAlign: "center", padding: "60px", color: "#7A7870", fontSize: "14px" },
  back: {
    background: "none", border: "none", fontSize: "13px", fontWeight: "600",
    color: "#7A7870", cursor: "pointer", marginBottom: "20px", padding: 0,
  },
  layout: {
    display: "grid", gridTemplateColumns: "280px 1fr",
    gap: "20px", alignItems: "start",
  },
  profileCard: {
    background: "#FFFFFF", border: "1px solid #E5E2DC", borderRadius: "14px",
    padding: "24px", textAlign: "center",
  },
  avatarLg: {
    width: "72px", height: "72px", borderRadius: "50%", background: "#E5E2DC",
    color: "#1C1B18", fontSize: "28px", fontWeight: "800",
    display: "flex", alignItems: "center", justifyContent: "center",
    margin: "0 auto 14px",
  },
  profileName: { fontSize: "17px", fontWeight: "800", color: "#1C1B18", marginBottom: "4px" },
  profileEmail: { fontSize: "13px", color: "#7A7870", marginBottom: "12px" },
  typeBadge: {
    display: "inline-block", padding: "3px 10px", borderRadius: "100px",
    fontSize: "12px", fontWeight: "600", marginBottom: "16px",
  },
  metaRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 0", borderTop: "1px solid #F0EDE8", fontSize: "13px",
  },
  metaLabel: { color: "#7A7870", fontWeight: "500" },
  metaVal: { color: "#1C1B18", fontWeight: "600" },
  statusBadge: {
    padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
  },
  cardActions: { marginTop: "16px" },
  actionBtn: {
    width: "100%", padding: "9px", border: "none", borderRadius: "9px",
    fontSize: "13px", fontWeight: "600", cursor: "pointer",
  },

  formCard: {
    background: "#FFFFFF", border: "1px solid #E5E2DC",
    borderRadius: "14px", padding: "24px",
  },
  formHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "20px",
  },
  formTitle: { fontSize: "15px", fontWeight: "700", color: "#1C1B18" },
  editBtn: {
    background: "#F7F6F3", border: "1px solid #E5E2DC", borderRadius: "8px",
    padding: "7px 14px", fontSize: "13px", fontWeight: "600",
    color: "#1C1B18", cursor: "pointer",
  },
  cancelBtn: {
    background: "#F7F6F3", border: "1px solid #E5E2DC", borderRadius: "8px",
    padding: "7px 14px", fontSize: "13px", fontWeight: "600",
    color: "#1C1B18", cursor: "pointer",
  },
  saveBtn: {
    background: "#1C1B18", border: "none", borderRadius: "8px",
    padding: "7px 14px", fontSize: "13px", fontWeight: "600",
    color: "#FFFFFF", cursor: "pointer",
  },

  error: {
    background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B",
    padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px",
  },
  successMsg: {
    background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534",
    padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px",
  },

  fields: { display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" },
  field: {},
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#7A7870", marginBottom: "5px" },
  value: { fontSize: "14px", color: "#1C1B18", fontWeight: "500" },
  input: {
    display: "block", width: "100%", padding: "9px 12px",
    border: "1.5px solid #D8D5CE", borderRadius: "9px",
    fontSize: "14px", color: "#1C1B18", background: "#FFFFFF",
    boxSizing: "border-box",
  },
  hint: { fontSize: "11px", color: "#A09D97", marginTop: "4px" },

  skillSection: { borderTop: "1px solid #F0EDE8", paddingTop: "20px" },
  skillTitle: { fontSize: "13px", fontWeight: "700", color: "#1C1B18", marginBottom: "12px" },
  skillGrid: { display: "flex", flexWrap: "wrap", gap: "8px" },
  skillChip: {
    padding: "6px 12px", borderRadius: "100px", fontSize: "13px",
    fontWeight: "500", transition: "all 0.15s",
  },
};
