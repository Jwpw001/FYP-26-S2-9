import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { Building2, MapPin, Users, ShieldCheck, Clock, Trash2, Star } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-outletdetail-styles")) {
  const style = document.createElement("style");
  style.id = "bo-outletdetail-styles";
  style.textContent = `
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    .bo-staff-card { transition: box-shadow 0.18s, transform 0.18s; }
    .bo-staff-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .bo-manager-row { transition: background 0.15s; border-radius: 8px; padding: 4px 6px; margin-left: -6px; margin-right: -6px; }
    .bo-manager-row:hover { background: #FFFBEB; }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function OutletDetail() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [outlet, setOutlet]       = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");

  const [staff, setStaff]               = useState([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [managers, setManagers]               = useState([]);
  const [managersLoading, setManagersLoading] = useState(true);

  const [form, setForm] = useState({ name: "", address: "", open_time: "", close_time: "" });

  useEffect(() => { fetchOutlet(); fetchStaff(); fetchManagers(); }, [id]);

  async function fetchOutlet() {
    setLoading(true);
    try {
      const data = await api.get("/api/business/outlets");
      const found = (data.outlets || []).find(o => String(o.outlet_id) === String(id));
      if (!found) { goTo("/business-owner/outlets"); return; }
      setOutlet(found);
      setForm({ name: found.name || "", address: found.address || "", open_time: fmtTimeInput(found.open_time), close_time: fmtTimeInput(found.close_time) });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaff() {
    setStaffLoading(true);
    try {
      const data = await api.get(`/api/business/outlets/${id}/staff`);
      setStaff(data.staff || []);
    } catch (err) {
      console.error(err);
    } finally {
      setStaffLoading(false);
    }
  }

  async function fetchManagers() {
    setManagersLoading(true);
    try {
      const data = await api.get(`/api/business/outlets/${id}/managers`);
      setManagers(data.managers || []);
    } catch (err) {
      console.error(err);
    } finally {
      setManagersLoading(false);
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Outlet name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    try {
      const data = await api.patch(`/api/business/outlets/${id}`, {
        name: form.name.trim(),
        address: form.address.trim(),
        open_time: form.open_time ? form.open_time + ":00" : undefined,
        close_time: form.close_time ? form.close_time + ":00" : undefined,
      });
      setOutlet(data.outlet);
      setSuccess("Outlet updated successfully.");
      setEditing(false);
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.delete(`/api/business/outlets/${id}`);
      goTo("/business-owner/outlets");
    } catch (err) {
      setError(err.message || "Failed to delete outlet. Please try again.");
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <BusinessOwnerLayout title="Outlet Details">
        <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>
          Loading outlet…
        </div>
      </BusinessOwnerLayout>
    );
  }

  return (
    <BusinessOwnerLayout title="Outlet Details">
      <button style={s.back} onClick={() => goTo("/business-owner/outlets")}>← Back to Outlets</button>

      <div style={s.layout}>
        {/* ── Left: outlet card ── */}
        <div style={s.profileCard}>
          <div style={s.avatarLg}><Building2 size={28} color="#F59E0B" /></div>
          <h2 style={s.profileName}>{outlet.name}</h2>
          {outlet.address ? (
            <p style={s.profileMeta}><MapPin size={12} /> {outlet.address}</p>
          ) : (
            <p style={s.profileMetaMuted}>No address set</p>
          )}

          <div style={s.managerSection}>
            <p style={s.managerLabel}><ShieldCheck size={12} /> Outlet Manager</p>
            {managersLoading ? (
              <Shimmer w="100%" h="34px" r="9px" />
            ) : managers.length === 0 ? (
              <p style={s.managerEmpty}>No manager assigned yet.</p>
            ) : (
              managers.map(m => (
                <div key={m.user_id} className="bo-manager-row" style={{ ...s.managerRow }}>
                  <div style={s.managerAvatar}>{m.full_name?.[0]?.toUpperCase() || "?"}</div>
                  <div style={{ minWidth: 0, textAlign: "left" }}>
                    <p style={s.managerName}>{m.full_name}</p>
                    <p style={s.managerEmail}>{m.email}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={s.cardActions}>
            <button
              style={{ ...s.actionBtn, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} /> Delete Outlet
            </button>
            <p style={{ fontSize: "11px", color: "#94A3B8", textAlign: "center", marginTop: "6px", lineHeight: 1.4 }}>
              Deleting also removes this outlet's staff, shifts, and reports.
            </p>
          </div>
        </div>

        {/* ── Right: edit form ── */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Outlet Details</h3>
            {!editing ? (
              <button style={s.editBtn} onClick={() => { setEditing(true); setError(""); setSuccess(""); }}>Edit</button>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <button style={s.cancelBtn} onClick={() => { setEditing(false); setError(""); setForm({ name: outlet.name, address: outlet.address || "", open_time: fmtTimeInput(outlet.open_time), close_time: fmtTimeInput(outlet.close_time) }); }}>Cancel</button>
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
              <label style={s.label}>Outlet Name</label>
              {editing
                ? <input style={s.input} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                : <p style={s.value}>{outlet.name}</p>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Address</label>
              {editing
                ? <input style={s.input} value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} placeholder="e.g. 123 Main St, City" />
                : <p style={s.value}>{outlet.address || "—"}</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={s.field}>
                <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Opening Time</label>
                {editing
                  ? <input type="time" style={s.input} value={form.open_time} onChange={e => setForm(p => ({ ...p, open_time: e.target.value }))} />
                  : <p style={s.value}>{fmtTimeDisplay(outlet.open_time) || "—"}</p>}
              </div>
              <div style={s.field}>
                <label style={s.label}><Clock size={12} style={{ marginRight: 4 }} />Closing Time</label>
                {editing
                  ? <input type="time" style={s.input} value={form.close_time} onChange={e => setForm(p => ({ ...p, close_time: e.target.value }))} />
                  : <p style={s.value}>{fmtTimeDisplay(outlet.close_time) || "—"}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Staff at this outlet ── */}
      <div style={s.staffSection}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h3 style={s.formTitle}>Staff at this Outlet</h3>
          <span style={{ fontSize: "12px", color: "#94A3B8" }}>
            {staffLoading ? "Loading…" : `${staff.length} member${staff.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {staffLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="120px" h="14px" r="6px" />
                    <div style={{ marginTop: "6px" }}><Shimmer w="150px" h="12px" r="5px" /></div>
                  </div>
                </div>
                <Shimmer w="70px" h="22px" r="100px" />
              </div>
            ))}
          </div>
        ) : staff.length === 0 ? (
          <div style={s.staffEmpty}>
            <Users size={36} color="#CBD5E1" />
            <p style={{ fontSize: "14px", color: "#94A3B8", marginTop: "10px" }}>No staff assigned to this outlet yet.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {staff.map((m, i) => {
              const name = m.users?.full_name || "—";
              const initials = name[0]?.toUpperCase() || "?";
              const color = avatarColor(name);
              const isManager = managers.some(mgr => Number(mgr.user_id) === Number(m.users?.user_id));
              return (
                <div key={m.staff_id} className="bo-staff-card" style={{ ...s.staffCard, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`, border: isManager ? "1.5px solid #FCD34D" : "1px solid #E2E8F0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ ...s.staffAvatar, background: color }}>{initials}</div>
                      {isManager && (
                        <div style={{ position: "absolute", bottom: -2, right: -2, width: 16, height: 16, borderRadius: "50%", background: "#F59E0B", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Star size={8} color="#fff" fill="#fff" />
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                        {isManager && <span style={{ fontSize: 10, fontWeight: 700, color: "#92400E", background: "#FEF3C7", padding: "1px 7px", borderRadius: 99, flexShrink: 0 }}>Manager</span>}
                      </div>
                      <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.users?.email || "—"}</p>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
                      {m.staff_type === "regular" ? "Regular" : "Casual"}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
                      {m.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Delete Confirmation Modal ── */}
      {showDeleteConfirm && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={s.modalIcon}><Trash2 size={36} color="#EF4444" /></div>
            <h3 style={s.modalTitle}>Delete Outlet?</h3>
            <p style={s.modalBody}>
              This will permanently remove <strong>{outlet.name}</strong> along with its staff, shifts, and reports.
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
    </BusinessOwnerLayout>
  );
}

function fmtTimeInput(t) {
  if (!t) return "";
  return t.slice(0, 5);
}

function fmtTimeDisplay(t) {
  if (!t) return null;
  const parts = String(t).split(":");
  if (parts.length < 2) return t;
  const hour = Number(parts[0]);
  const m = parts[1];
  if (isNaN(hour)) return t;
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0 },
  layout: { display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" },

  profileCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px", textAlign: "center" },
  avatarLg: { width: "72px", height: "72px", borderRadius: "16px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" },
  profileName: { fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "6px" },
  profileMeta: { display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", fontSize: "13px", color: "#64748B", marginBottom: "12px" },
  profileMetaMuted: { fontSize: "13px", color: "#94A3B8", marginBottom: "12px" },
  cardActions: { marginTop: "16px", display: "flex", flexDirection: "column", gap: "4px" },
  actionBtn: { width: "100%", padding: "9px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },

  managerSection: { marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #F1F5F9", textAlign: "left" },
  managerLabel: { display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" },
  managerEmpty: { fontSize: "13px", color: "#94A3B8" },
  managerRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" },
  managerAvatar: { width: "32px", height: "32px", borderRadius: "50%", background: "#F59E0B", color: "#1C1917", fontSize: "13px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  managerName: { fontSize: "13px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  managerEmail: { fontSize: "11px", color: "#64748B", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },

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

  staffSection: { marginTop: "20px" },
  staffEmpty: { textAlign: "center", padding: "40px 20px", background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px" },
  staffCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" },
  staffAvatar: { width: "44px", height: "44px", borderRadius: "50%", color: "#FFFFFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "#FFFFFF", borderRadius: "16px", padding: "32px 28px", width: "360px", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalIcon: { fontSize: "36px", marginBottom: "12px" },
  modalTitle: { fontSize: "18px", fontWeight: "800", color: "#1E293B", marginBottom: "10px" },
  modalBody: { fontSize: "14px", color: "#64748B", lineHeight: 1.6, marginBottom: "24px" },
  modalActions: { display: "flex", gap: "10px", justifyContent: "center" },
};
