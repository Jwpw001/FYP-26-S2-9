import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function StaffProfile() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [member, setMember]       = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [assigned, setAssigned]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

      const [{ data: skillRows }, { data: tagRows }] = await Promise.all([
        supabase.from("skills").select("skill_id, name").order("name"),
        supabase.from("user_skill_tags").select("skill_id").eq("user_id", staffRow.users?.user_id),
      ]);

      setMember(staffRow);
      setAllSkills(skillRows || []);
      setAssigned((tagRows || []).map(t => t.skill_id));
      setForm({
        full_name: staffRow.users?.full_name || "",
        staff_type: staffRow.staff_type || "regular",
        default_work_days: staffRow.default_work_days || "1111100",
        is_active: staffRow.is_active ?? true,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toggleSkill(skillId) {
    setAssigned(prev => prev.includes(skillId) ? prev.filter(s => s !== skillId) : [...prev, skillId]);
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
      await supabase.from("users")
        .update({ full_name: form.full_name.trim() })
        .eq("user_id", member.users.user_id);

      await supabase.from("staff")
        .update({
          staff_type: form.staff_type,
          default_work_days: form.staff_type === "regular" ? form.default_work_days : null,
          is_active: form.is_active,
        })
        .eq("staff_id", id);

      await supabase.from("user_skill_tags").delete().eq("user_id", member.users.user_id);
      if (assigned.length > 0) {
        await supabase.from("user_skill_tags")
          .insert(assigned.map(skill_id => ({ user_id: member.users.user_id, skill_id })));
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
    await supabase.from("staff").update({ is_active: newVal }).eq("staff_id", id);
    setMember(prev => ({ ...prev, is_active: newVal }));
    setForm(prev => ({ ...prev, is_active: newVal }));
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const userId = member.users?.user_id;
      // Delete skill tags, staff record, then user record
      await supabase.from("user_skill_tags").delete().eq("user_id", userId);
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
        <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>
          Loading profile…
        </div>
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
          <span style={{
            ...s.typeBadge,
            background: member.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
            color: member.staff_type === "regular" ? "#1E40AF" : "#6B21A8",
          }}>
            {member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual"}
          </span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ ...s.statusBadge,
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
                {new Date(member.hired_at).toLocaleDateString("en-SG", { year:"numeric", month:"short", day:"numeric" })}
              </span>
            </div>
          )}

          <div style={s.cardActions}>
            {/* Active toggle — controls shift assignment eligibility */}
            <button
              style={{ ...s.actionBtn,
                background: member.is_active ? "#FEF3C7" : "#DCFCE7",
                color: member.is_active ? "#92400E" : "#166534",
                border: member.is_active ? "1px solid #FDE68A" : "1px solid #BBF7D0",
              }}
              onClick={toggleActive}
            >
              {member.is_active ? "⏸ Deactivate" : "▶ Reactivate"}
            </button>
            <p style={{ fontSize: "11px", color: "#94A3B8", textAlign: "center", marginTop: "6px", lineHeight: 1.4 }}>
              {member.is_active
                ? "Deactivating prevents shift assignment but keeps staff on the list."
                : "Reactivating allows this staff to be assigned shifts again."}
            </p>

            {/* Delete — permanent removal */}
            <button
              style={{ ...s.actionBtn, marginTop: "8px",
                background: "#FEF2F2", color: "#991B1B",
                border: "1px solid #FECACA",
              }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑 Delete Staff
            </button>
          </div>
        </div>

        {/* ── Right: edit form ── */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Profile Details</h3>
            {!editing ? (
              <button style={s.editBtn} onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={s.cancelBtn} onClick={() => { setEditing(false); setError(""); fetchProfile(); }}>Cancel</button>
                <button style={s.saveBtn} onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </div>

          {error   && <div style={s.error}>{error}</div>}
          {success && <div style={s.successMsg}>{success}</div>}

          <div style={s.fields}>
            {/* Full Name */}
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              {editing
                ? <input style={s.input} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                : <p style={s.value}>{member.users?.full_name}</p>}
            </div>

            {/* Email (read-only) */}
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <p style={s.value}>{member.users?.email}</p>
              {editing && <p style={s.hint}>Email cannot be changed here.</p>}
            </div>

            {/* Staff Type */}
            <div style={s.field}>
              <label style={s.label}>Staff Type</label>
              {editing ? (
                <select style={s.input} value={form.staff_type}
                  onChange={e => setForm(p => ({ ...p, staff_type: e.target.value }))}>
                  <option value="regular">Regular Staff</option>
                  <option value="casual">Outlet Casual Staff</option>
                </select>
              ) : (
                <p style={s.value}>{member.staff_type === "regular" ? "Regular Staff" : "Outlet Casual Staff"}</p>
              )}
            </div>

            {/* Default Work Days — day toggle buttons */}
            {form.staff_type === "regular" && (
              <div style={s.field}>
                <label style={s.label}>Default Work Days</label>
                {editing ? (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {DAYS.map((day, idx) => {
                      const active = workDays[idx] === "1";
                      return (
                        <button key={day} type="button"
                          onClick={() => toggleDay(idx)}
                          style={{
                            padding: "7px 11px", borderRadius: "8px", fontSize: "12px",
                            fontWeight: "700", cursor: "pointer", transition: "all 0.12s",
                            background: active ? "#2563EB" : "#F1F5F9",
                            color: active ? "#FFFFFF" : "#64748B",
                            border: active ? "1.5px solid #2563EB" : "1.5px solid #E2E8F0",
                          }}>
                          {day}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {DAYS.map((day, idx) => {
                      const active = (member.default_work_days || "0000000").padEnd(7,"0")[idx] === "1";
                      return (
                        <span key={day} style={{
                          padding: "5px 10px", borderRadius: "8px", fontSize: "12px", fontWeight: "700",
                          background: active ? "#DBEAFE" : "#F1F5F9",
                          color: active ? "#1E40AF" : "#94A3B8",
                          border: `1.5px solid ${active ? "#BFDBFE" : "#E2E8F0"}`,
                        }}>
                          {day}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Skill Tags */}
          <div style={s.skillSection}>
            <h4 style={s.skillTitle}>Skill Tags</h4>
            <p style={s.hint}>{editing ? "Click to toggle skill tags." : ""}</p>
            <div style={s.skillGrid}>
              {allSkills.map(sk => {
                const active = assigned.includes(sk.skill_id);
                return (
                  <button key={sk.skill_id}
                    style={{
                      ...s.skillChip,
                      background: active ? "#0F172A" : "#F1F5F9",
                      color: active ? "#FFFFFF" : "#64748B",
                      border: `1.5px solid ${active ? "#0F172A" : "#E2E8F0"}`,
                      cursor: editing ? "pointer" : "default",
                      opacity: editing ? 1 : active ? 1 : 0.6,
                    }}
                    onClick={() => editing && toggleSkill(sk.skill_id)}
                    disabled={!editing}
                  >
                    {sk.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalIcon}>🗑</div>
            <h3 style={s.modalTitle}>Delete Staff Member?</h3>
            <p style={s.modalBody}>
              This will permanently remove <strong>{member.users?.full_name}</strong> and all their records.
              This cannot be undone.
            </p>
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </button>
              <button
                style={{ ...s.actionBtn, background: "#EF4444", color: "#FFF", border: "none", padding: "9px 20px", width: "auto" }}
                onClick={handleDelete}
                disabled={deleting}
              >
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
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0 },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" },

  profileCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", textAlign: "center" },
  avatarLg: { width: "72px", height: "72px", borderRadius: "50%", color: "#FFFFFF", fontSize: "26px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" },
  profileName: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" },
  profileEmail: { fontSize: "13px", color: "#64748B", marginBottom: "12px" },
  typeBadge: { display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", marginBottom: "16px" },
  metaRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #F1F5F9", fontSize: "13px" },
  metaLabel: { color: "#64748B", fontWeight: "500" },
  metaVal: { color: "#1E293B", fontWeight: "600" },
  statusBadge: { padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" },
  cardActions: { marginTop: "16px", display: "flex", flexDirection: "column", gap: "4px" },
  actionBtn: { width: "100%", padding: "9px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },

  formCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" },
  formHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" },
  formTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  editBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  cancelBtn: { background: "#F1F5F9", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  saveBtn: { background: "#2563EB", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "600", color: "#FFFFFF", cursor: "pointer" },

  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },

  fields: { display: "flex", flexDirection: "column", gap: "16px", marginBottom: "24px" },
  field: {},
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" },
  value: { fontSize: "14px", color: "#1E293B", fontWeight: "500" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFFFFF", boxSizing: "border-box" },
  hint: { fontSize: "11px", color: "#94A3B8", marginTop: "4px" },

  skillSection: { borderTop: "1px solid #F1F5F9", paddingTop: "20px" },
  skillTitle: { fontSize: "13px", fontWeight: "700", color: "#1E293B", marginBottom: "12px" },
  skillGrid: { display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "8px" },
  skillChip: { padding: "6px 12px", borderRadius: "100px", fontSize: "13px", fontWeight: "500", transition: "all 0.15s" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "16px", padding: "32px 28px", width: "360px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalIcon: { fontSize: "36px", marginBottom: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: "800", color: "#1E293B", marginBottom: "10px" },
  modalBody: { fontSize: "14px", color: "#64748B", lineHeight: 1.6, marginBottom: "24px" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "center" },
};
