import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { createPortal } from "react-dom";
import { ArrowLeft, Building2, MapPin, Pencil, Trash2, Plus, Users, ChevronRight } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-detail-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-detail-kf";
  st.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    @keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .outlet-card{transition:box-shadow 0.15s,border-color 0.15s}
    .outlet-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08)!important;border-color:#BFDBFE!important}
    .bd-input:focus{outline:none;border-color:#3B82F6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}
  `;
  document.head.appendChild(st);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [business, setBusiness]   = useState(null);
  const [outlets, setOutlets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [toast, setToast]         = useState(null);

  // Business edit
  const [editingBiz, setEditingBiz]     = useState(false);
  const [bizForm, setBizForm]           = useState({ name: "", description: "" });
  const [savingBiz, setSavingBiz]       = useState(false);

  // Delete business
  const [showDelBiz, setShowDelBiz]     = useState(false);
  const [deletingBiz, setDeletingBiz]   = useState(false);

  // Add outlet modal
  const [showOutletModal, setShowOutletModal]   = useState(false);
  const [outletForm, setOutletForm]             = useState({ name: "", address: "" });
  const [savingOutlet, setSavingOutlet]         = useState(false);

  // Edit outlet
  const [editingOutlet, setEditingOutlet]       = useState(null); // outlet object
  const [editOutletForm, setEditOutletForm]     = useState({ name: "", address: "" });
  const [savingEditOutlet, setSavingEditOutlet] = useState(false);

  // Delete outlet
  const [deleteOutletTarget, setDeleteOutletTarget] = useState(null);
  const [deletingOutlet, setDeletingOutlet]         = useState(false);

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: biz }, { data: outletRows }] = await Promise.all([
      supabase.from("businesses").select("business_id, name, description, created_at").eq("business_id", id).single(),
      supabase.from("outlets").select("outlet_id, name, address, staff(staff_id)").eq("business_id", id).order("name"),
    ]);
    if (!biz) { navigate("/system-admin/businesses"); return; }
    setBusiness(biz);
    setBizForm({ name: biz.name, description: biz.description || "" });
    setOutlets(outletRows || []);
    setLoading(false);
  }

  // ── Business actions ──
  async function handleSaveBiz() {
    if (!bizForm.name.trim()) { showToast("Name is required.", "error"); return; }
    setSavingBiz(true);
    const { error } = await supabase.from("businesses")
      .update({ name: bizForm.name.trim(), description: bizForm.description.trim() || null })
      .eq("business_id", id);
    setSavingBiz(false);
    if (error) { showToast(error.message, "error"); return; }
    setBusiness(prev => ({ ...prev, name: bizForm.name.trim(), description: bizForm.description.trim() || null }));
    setEditingBiz(false);
    showToast("Business updated.");
  }

  async function handleDeleteBiz() {
    setDeletingBiz(true);
    const { error } = await supabase.from("businesses").delete().eq("business_id", id);
    if (error) { showToast(error.message, "error"); setDeletingBiz(false); return; }
    navigate("/system-admin/businesses");
  }

  // ── Outlet actions ──
  async function handleAddOutlet() {
    if (!outletForm.name.trim()) { showToast("Outlet name is required.", "error"); return; }
    setSavingOutlet(true);
    const { data, error } = await supabase.from("outlets")
      .insert({ name: outletForm.name.trim(), address: outletForm.address.trim() || null, business_id: Number(id) })
      .select("outlet_id, name, address, staff(staff_id)")
      .single();
    setSavingOutlet(false);
    if (error) { showToast(error.message, "error"); return; }
    setOutlets(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setOutletForm({ name: "", address: "" });
    setShowOutletModal(false);
    showToast("Outlet created.");
  }

  async function handleSaveOutlet() {
    if (!editOutletForm.name.trim()) { showToast("Outlet name is required.", "error"); return; }
    setSavingEditOutlet(true);
    const { error } = await supabase.from("outlets")
      .update({ name: editOutletForm.name.trim(), address: editOutletForm.address.trim() || null })
      .eq("outlet_id", editingOutlet.outlet_id);
    setSavingEditOutlet(false);
    if (error) { showToast(error.message, "error"); return; }
    setOutlets(prev => prev.map(o => o.outlet_id === editingOutlet.outlet_id
      ? { ...o, name: editOutletForm.name.trim(), address: editOutletForm.address.trim() || null }
      : o
    ).sort((a, b) => a.name.localeCompare(b.name)));
    setEditingOutlet(null);
    showToast("Outlet updated.");
  }

  async function handleDeleteOutlet() {
    setDeletingOutlet(true);
    const { error } = await supabase.from("outlets").delete().eq("outlet_id", deleteOutletTarget.outlet_id);
    if (error) { showToast(error.message, "error"); setDeletingOutlet(false); return; }
    setOutlets(prev => prev.filter(o => o.outlet_id !== deleteOutletTarget.outlet_id));
    setDeleteOutletTarget(null);
    showToast("Outlet deleted.");
  }

  const bizColor = business ? avatarColor(business.name) : "#3B82F6";

  return (
    <AdminLayout title="Business Detail">
      <div style={{ animation: "pageIn 0.35s ease both" }}>

        <button onClick={() => navigate("/system-admin/businesses")}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "22px", padding: 0 }}>
          <ArrowLeft size={15} /> Back to Businesses
        </button>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <Shimmer w="72px" h="72px" r="16px" />
              <div style={{ marginTop: "16px" }}><Shimmer w="80%" h="18px" r="6px" /></div>
              <div style={{ marginTop: "10px" }}><Shimmer w="60%" h="13px" r="5px" /></div>
            </div>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <Shimmer w="160px" h="18px" r="6px" />
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="70px" r="12px" />)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", alignItems: "start" }}>

            {/* Left — Business profile */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: bizColor, color: "#FFF", fontSize: "26px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {business.name[0]?.toUpperCase()}
                </div>

                {editingBiz ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px", textAlign: "left" }}>
                    <input className="bd-input" value={bizForm.name}
                      onChange={e => setBizForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="Business name"
                      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", fontWeight: "700", color: "#0F172A", background: "#FAFAFA", boxSizing: "border-box" }} />
                    <textarea className="bd-input" value={bizForm.description}
                      onChange={e => setBizForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Description (optional)"
                      rows={2}
                      style={{ width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "13px", color: "#475569", background: "#FAFAFA", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button onClick={() => { setEditingBiz(false); setBizForm({ name: business.name, description: business.description || "" }); }} disabled={savingBiz}
                        style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>Cancel</button>
                      <button onClick={handleSaveBiz} disabled={savingBiz}
                        style={{ flex: 2, padding: "8px", borderRadius: "8px", border: "none", background: "#3B82F6", color: "#FFF", fontSize: "13px", fontWeight: "700", cursor: "pointer" }}>{savingBiz ? "Saving…" : "Save"}</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>{business.name}</h2>
                    {business.description && <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>{business.description}</p>}
                  </>
                )}
              </div>

              {/* Stats */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "5px" }}><MapPin size={13} /> Outlets</span>
                  <span style={{ fontWeight: "700", color: "#1E293B" }}>{outlets.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "5px" }}><Users size={13} /> Total Staff</span>
                  <span style={{ fontWeight: "700", color: "#1E293B" }}>{outlets.reduce((sum, o) => sum + (o.staff?.length ?? 0), 0)}</span>
                </div>

              </div>

              {/* Actions */}
              {!editingBiz && (
                <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px", marginTop: "4px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <button onClick={() => setEditingBiz(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", padding: "9px", borderRadius: "9px", border: "1.5px solid #E2E8F0", background: "#F8FAFC", color: "#1E293B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    <Pencil size={13} /> Edit Business
                  </button>
                  <button onClick={() => setShowDelBiz(true)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", width: "100%", padding: "9px", borderRadius: "9px", border: "1px solid #FECACA", background: "#FEF2F2", color: "#991B1B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    <Trash2 size={13} /> Delete Business
                  </button>
                </div>
              )}
            </div>

            {/* Right — Outlets */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <div>
                  <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>Outlets</h3>
                  <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{outlets.length} outlet{outlets.length !== 1 ? "s" : ""} under this business</p>
                </div>
                <button onClick={() => { setOutletForm({ name: "", address: "" }); setShowOutletModal(true); }}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "8px 14px", borderRadius: "9px", border: "none", background: "#3B82F6", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                  <Plus size={14} /> Add Outlet
                </button>
              </div>

              {outlets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <MapPin size={22} color="#3B82F6" />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No outlets yet</p>
                  <p style={{ fontSize: "13px", color: "#94A3B8", marginBottom: "18px" }}>Add your first outlet for managers to use.</p>
                  <button onClick={() => { setOutletForm({ name: "", address: "" }); setShowOutletModal(true); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "9px 18px", borderRadius: "9px", border: "none", background: "#3B82F6", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                    <Plus size={14} /> Add First Outlet
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {outlets.map((outlet, i) => {
                    const oColor = avatarColor(outlet.name);
                    const staffCount = outlet.staff?.length ?? 0;
                    return (
                      <div key={outlet.outlet_id} className="outlet-card"
                        onClick={() => navigate(`/system-admin/outlets/${outlet.outlet_id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", border: "1px solid #E2E8F0", borderRadius: "13px", background: "#FAFAFA", animation: `fadeSlideUp 0.25s ease ${i * 0.04}s both`, cursor: "pointer" }}>
                        <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: oColor, color: "#FFF", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {outlet.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outlet.name}</p>
                          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {outlet.address || <span style={{ color: "#CBD5E1", fontStyle: "italic" }}>No address set</span>}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#EFF6FF", padding: "4px 10px", borderRadius: "100px", flexShrink: 0 }}>
                          <Users size={12} color="#2563EB" />
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#2563EB" }}>{staffCount}</span>
                        </div>
                        <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add Outlet Modal */}
      {showOutletModal && createPortal(
        <Modal title="Add Outlet" subtitle="Create a new outlet under this business" onClose={() => setShowOutletModal(false)} accentColor="#3B82F6">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <FormField label="Outlet Name *">
              <input autoFocus className="bd-input" value={outletForm.name}
                onChange={e => setOutletForm(p => ({ ...p, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleAddOutlet()}
                placeholder="e.g. The Coffee Club Orchard"
                style={inputStyle} />
            </FormField>
            <FormField label="Address">
              <input className="bd-input" value={outletForm.address}
                onChange={e => setOutletForm(p => ({ ...p, address: e.target.value }))}
                placeholder="e.g. 176 Orchard Road, Singapore 238843"
                style={inputStyle} />
            </FormField>
          </div>
          <ModalActions
            onCancel={() => setShowOutletModal(false)} cancelDisabled={savingOutlet}
            onConfirm={handleAddOutlet} confirmDisabled={savingOutlet || !outletForm.name.trim()}
            confirmLabel={savingOutlet ? "Creating…" : "Create Outlet"} />
        </Modal>,
        document.body
      )}

      {/* Edit Outlet Modal */}
      {editingOutlet && createPortal(
        <Modal title="Edit Outlet" subtitle={`Editing: ${editingOutlet.name}`} onClose={() => setEditingOutlet(null)} accentColor="#6366F1">
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <FormField label="Outlet Name *">
              <input autoFocus className="bd-input" value={editOutletForm.name}
                onChange={e => setEditOutletForm(p => ({ ...p, name: e.target.value }))}
                style={inputStyle} />
            </FormField>
            <FormField label="Address">
              <input className="bd-input" value={editOutletForm.address}
                onChange={e => setEditOutletForm(p => ({ ...p, address: e.target.value }))}
                placeholder="e.g. 176 Orchard Road, Singapore"
                style={inputStyle} />
            </FormField>
          </div>
          <ModalActions
            onCancel={() => setEditingOutlet(null)} cancelDisabled={savingEditOutlet}
            onConfirm={handleSaveOutlet} confirmDisabled={savingEditOutlet || !editOutletForm.name.trim()}
            confirmLabel={savingEditOutlet ? "Saving…" : "Save Changes"} confirmBg="#6366F1" />
        </Modal>,
        document.body
      )}

      {/* Delete Outlet Confirm */}
      {deleteOutletTarget && createPortal(
        <Modal title="Delete Outlet?" subtitle={`This will permanently remove "${deleteOutletTarget.name}".`} onClose={() => setDeleteOutletTarget(null)} accentColor="#EF4444">
          <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6, marginBottom: "4px" }}>
            Staff assigned to this outlet will lose their outlet assignment. This cannot be undone.
          </p>
          <ModalActions
            onCancel={() => setDeleteOutletTarget(null)} cancelDisabled={deletingOutlet}
            onConfirm={handleDeleteOutlet} confirmDisabled={deletingOutlet}
            confirmLabel={deletingOutlet ? "Deleting…" : "Yes, Delete"} confirmBg="#EF4444" />
        </Modal>,
        document.body
      )}

      {/* Delete Business Confirm */}
      {showDelBiz && createPortal(
        <Modal title="Delete Business?" subtitle={`This will remove "${business?.name}" and all its outlets.`} onClose={() => setShowDelBiz(false)} accentColor="#EF4444">
          <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.6, marginBottom: "4px" }}>
            All outlets and associated data will be permanently deleted. This cannot be undone.
          </p>
          <ModalActions
            onCancel={() => setShowDelBiz(false)} cancelDisabled={deletingBiz}
            onConfirm={handleDeleteBiz} confirmDisabled={deletingBiz}
            confirmLabel={deletingBiz ? "Deleting…" : "Yes, Delete Business"} confirmBg="#EF4444" />
        </Modal>,
        document.body
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 99999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#FFF", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}

// ── Shared helpers ──

const inputStyle = { width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", color: "#0F172A", background: "#FAFAFA", boxSizing: "border-box" };

function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, subtitle, onClose, accentColor = "#3B82F6", children }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={onClose} />
      <div style={{ position: "relative", background: "#FFF", borderRadius: "18px", width: "440px", maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "modalIn 0.22s ease both", overflow: "hidden" }}>
        <div style={{ height: "3px", background: accentColor }} />
        <div style={{ padding: "24px 26px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "#0F172A" }}>{title}</h3>
              {subtitle && <p style={{ fontSize: "12.5px", color: "#94A3B8", marginTop: "3px" }}>{subtitle}</p>}
            </div>
            <button onClick={onClose}
              style={{ width: "28px", height: "28px", borderRadius: "7px", border: "none", background: "#F1F5F9", color: "#94A3B8", fontSize: "17px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function ModalActions({ onCancel, cancelDisabled, onConfirm, confirmDisabled, confirmLabel, confirmBg = "#3B82F6" }) {
  return (
    <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
      <button onClick={onCancel} disabled={cancelDisabled}
        style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
        Cancel
      </button>
      <button onClick={onConfirm} disabled={confirmDisabled}
        style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: confirmDisabled ? "#E2E8F0" : confirmBg, color: confirmDisabled ? "#94A3B8" : "#FFF", fontSize: "13px", fontWeight: "700", cursor: confirmDisabled ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
        {confirmLabel}
      </button>
    </div>
  );
}
