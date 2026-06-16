import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { Building2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-managerdetail-styles")) {
  const style = document.createElement("style");
  style.id = "bo-managerdetail-styles";
  style.textContent = `@keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }`;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function BOManagerDetail() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [manager, setManager] = useState(null);
  const [outlet, setOutlet]   = useState(null);
  const [isPrimary, setIsPrimary] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const [form, setForm] = useState({ full_name: "" });

  useEffect(() => { fetchProfile(); }, [id]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const data = await api.get(`/api/business/managers/${id}`);
      setManager(data.manager);
      setOutlet(data.outlet);
      setIsPrimary(data.is_primary);
      setForm({ full_name: data.manager.full_name || "" });
    } catch (err) {
      console.error(err);
      goTo("/business-owner/outlets");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const data = await api.patch(`/api/business/managers/${id}`, { full_name: form.full_name.trim() });
      setManager(data.manager);
      setSuccess("Profile updated successfully.");
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    const newVal = !manager.is_active;
    try {
      const data = await api.patch(`/api/business/managers/${id}`, { is_active: newVal });
      setManager(data.manager);
    } catch (err) {
      setError(err.message || "Failed to update status.");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/business/managers/${id}`);
      goTo(`/business-owner/outlets/${outlet.outlet_id}`);
    } catch (err) {
      setError(err.message || "Failed to remove manager. Please try again.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <BusinessOwnerLayout title="Manager Profile">
        <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>
          Loading profile…
        </div>
      </BusinessOwnerLayout>
    );
  }

  const name = manager.full_name || "?";
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  const color = avatarColor(name);

  return (
    <BusinessOwnerLayout title="Manager Profile">
      <button style={s.back} onClick={() => goTo(`/business-owner/outlets/${outlet.outlet_id}`)}>← Back to Outlet</button>

      <div style={s.layout}>
        {/* ── Left: profile card ── */}
        <div style={s.profileCard}>
          <div style={{ ...s.avatarLg, background: color }}>{initials}</div>
          <h2 style={s.profileName}>{manager.full_name}</h2>
          <p style={s.profileEmail}>{manager.email}</p>
          <span style={s.typeBadge}>Outlet Manager</span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Outlet</span>
            <span style={s.metaVal}><Building2 size={12} style={{ marginRight: "4px", verticalAlign: "-1px" }} />{outlet.name}</span>
          </div>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ ...s.statusBadge,
              background: manager.is_active ? "#DCFCE7" : "#F3F4F6",
              color: manager.is_active ? "#166534" : "#6B7280",
            }}>
              {manager.is_active ? "Active" : "Inactive"}
            </span>
          </div>

          {manager.created_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Joined</span>
              <span style={s.metaVal}>
                {new Date(manager.created_at).toLocaleDateString("en-SG", { year:"numeric", month:"short", day:"numeric" })}
              </span>
            </div>
          )}

          <div style={s.cardActions}>
            <button
              style={{ ...s.actionBtn,
                background: manager.is_active ? "#FEF3C7" : "#DCFCE7",
                color: manager.is_active ? "#92400E" : "#166534",
                border: manager.is_active ? "1px solid #FDE68A" : "1px solid #BBF7D0",
              }}
              onClick={toggleActive}
            >
              {manager.is_active ? "⏸ Deactivate" : "▶ Reactivate"}
            </button>

            <button
              style={{ ...s.actionBtn, marginTop: "8px",
                background: "#FEF2F2", color: "#991B1B",
                border: "1px solid #FECACA",
              }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              🗑 Remove Manager
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
            <div style={s.field}>
              <label style={s.label}>Full Name</label>
              {editing
                ? <input style={s.input} value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
                : <p style={s.value}>{manager.full_name}</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Email</label>
              <p style={s.value}>{manager.email}</p>
              {editing && <p style={s.hint}>Email cannot be changed here.</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Assigned Outlet</label>
              <p style={s.value}>{outlet.name}{isPrimary ? " (Primary)" : ""}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalIcon}>🗑</div>
            <h3 style={s.modalTitle}>Remove Manager?</h3>
            <p style={s.modalBody}>
              This will permanently remove <strong>{manager.full_name}</strong> and their account.
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
                {deleting ? "Removing…" : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0 },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" },

  profileCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", textAlign: "center" },
  avatarLg: { width: "72px", height: "72px", borderRadius: "50%", color: "#FFFFFF", fontSize: "26px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" },
  profileName: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "4px" },
  profileEmail: { fontSize: "13px", color: "#64748B", marginBottom: "12px" },
  typeBadge: { display: "inline-block", padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", marginBottom: "16px", background: "#FEF3C7", color: "#92400E" },
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
  saveBtn: { background: "#F59E0B", border: "none", borderRadius: "8px", padding: "7px 14px", fontSize: "13px", fontWeight: "700", color: "#1C1917", cursor: "pointer" },

  error: { background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },
  successMsg: { background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 12px", borderRadius: "9px", fontSize: "13px", marginBottom: "16px" },

  fields: { display: "flex", flexDirection: "column", gap: "16px" },
  field: {},
  label: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" },
  value: { fontSize: "14px", color: "#1E293B", fontWeight: "500" },
  input: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFFFFF", boxSizing: "border-box" },
  hint: { fontSize: "11px", color: "#94A3B8", marginTop: "4px" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "16px", padding: "32px 28px", width: "360px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalIcon: { fontSize: "36px", marginBottom: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: "800", color: "#1E293B", marginBottom: "10px" },
  modalBody: { fontSize: "14px", color: "#64748B", lineHeight: 1.6, marginBottom: "24px" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "center" },
};
