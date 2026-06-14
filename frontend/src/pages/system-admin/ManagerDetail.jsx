import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(n="") { return AVATAR_COLORS[(n.charCodeAt(0)||0)%AVATAR_COLORS.length]; }

export default function ManagerDetail() {
  const { id } = useParams();
  const goTo   = useGoTo();
  const location = useLocation();
  const backPath = location.state?.from || "/system-admin/managers";

  const [manager, setManager] = useState(null);
  const [outlet,  setOutlet]  = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [deleting,setDeleting]= useState(false);
  const [toast,   setToast]   = useState(null);
  const [form,    setForm]    = useState({ full_name:"", is_active:true });

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: mgr }, { data: outs }] = await Promise.all([
        supabase.from("users").select("user_id,full_name,email,is_active,created_at").eq("user_id", id).single(),
        supabase.from("outlets").select("outlet_id,name").order("name"),
      ]);
      if (cancelled) return;
      if (!mgr) { goTo("/system-admin/managers"); return; }

      // Try to find which outlet this manager is linked to via staff table
      const { data: staffRow } = await supabase.from("staff").select("outlet_id,outlets(name)").eq("user_id", id).limit(1).single();

      setManager(mgr);
      setOutlet(staffRow?.outlets || null);
      setOutlets(outs||[]);
      setForm({ full_name: mgr.full_name, is_active: mgr.is_active ?? true });
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSave() {
    if (!form.full_name.trim()) { showToast("Name is required.", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("users").update({ full_name: form.full_name.trim(), is_active: form.is_active }).eq("user_id", id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setManager(prev => ({ ...prev, full_name: form.full_name.trim(), is_active: form.is_active }));
    setEditing(false);
    showToast("Manager updated.");
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("users").delete().eq("user_id", id);
    if (error) { showToast(error.message, "error"); setDeleting(false); setShowDel(false); return; }
    goTo("/system-admin/managers");
  }

  if (loading) return <AdminLayout title="Manager Detail"><div style={{ padding:"60px", textAlign:"center", color:"#64748B" }}>Loading…</div></AdminLayout>;

  const initials = manager.full_name?.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2) || "?";

  return (
    <AdminLayout title="Manager Detail">
      <button onClick={() => goTo(backPath)} style={s.back}>← Back</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:avatarColor(manager.full_name), color:"#FFF", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            {initials}
          </div>
          <h2 style={s.profileName}>{manager.full_name}</h2>
          <p style={s.profileSub}>{manager.email}</p>
          <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", background:"#DBEAFE", color:"#1E40AF", marginBottom:"16px" }}>
            Outlet Manager
          </span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", background: manager.is_active?"#DCFCE7":"#F1F5F9", color: manager.is_active?"#166534":"#94A3B8" }}>
              {manager.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          {outlet && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Outlet</span>
              <span style={s.metaVal}>{outlet.name}</span>
            </div>
          )}
          {manager.created_at && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Joined</span>
              <span style={s.metaVal}>{new Date(manager.created_at).toLocaleDateString("en-SG",{year:"numeric",month:"short",day:"numeric"})}</span>
            </div>
          )}

          <div style={{ marginTop:"16px", display:"flex", flexDirection:"column", gap:"8px" }}>
            <button onClick={() => setShowDel(true)}
              style={{ width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA" }}>
              🗑 Delete Manager
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Profile Details</h3>
            {!editing
              ? <button onClick={() => setEditing(true)} style={s.editBtn}>Edit</button>
              : <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={() => { setEditing(false); setForm({ full_name:manager.full_name, is_active:manager.is_active }); }} style={s.cancelBtn}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={s.saveBtn}>{saving ? "Saving…" : "Save"}</button>
                </div>
            }
          </div>

          <div style={s.fields}>
            <Field label="Full Name">
              {editing ? <input value={form.full_name} onChange={e => setForm(p=>({...p,full_name:e.target.value}))} style={s.input} autoFocus />
                       : <p style={s.value}>{manager.full_name}</p>}
            </Field>
            <Field label="Email">
              <p style={s.value}>{manager.email}</p>
              {editing && <p style={{ fontSize:"11px", color:"#94A3B8", marginTop:"4px" }}>Email cannot be changed here.</p>}
            </Field>
            <Field label="Role">
              <p style={s.value}>Outlet Manager</p>
            </Field>
            {editing && (
              <Field label="Account Status">
                <select value={form.is_active ? "active" : "inactive"} onChange={e => setForm(p=>({...p,is_active:e.target.value==="active"}))} style={s.input}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </Field>
            )}
            {outlet && (
              <Field label="Assigned Outlet">
                <p style={s.value}>{outlet.name}</p>
              </Field>
            )}
          </div>
        </div>
      </div>

      {showDel && (
        <div style={s.overlay} onClick={() => setShowDel(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>🗑</p>
            <h3 style={s.modalTitle}>Delete Manager?</h3>
            <p style={s.modalBody}>This will permanently remove <strong>{manager.full_name}</strong>. This cannot be undone.</p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button onClick={() => setShowDel(false)} style={s.cancelBtn}>Cancel</button>
              <button onClick={handleDelete} disabled={deleting} style={{ padding:"8px 20px", borderRadius:"9px", border:"none", background:"#EF4444", color:"#FFF", fontSize:"13px", fontWeight:"700", cursor:"pointer" }}>
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position:"fixed", bottom:"28px", right:"28px", zIndex:9999, background: toast.type==="success"?"#22C55E":"#EF4444", color:"#FFF", padding:"12px 20px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>{toast.msg}</div>}
    </AdminLayout>
  );
}

function Field({ label, children }) {
  return <div><label style={s.label}>{label}</label>{children}</div>;
}

const s = {
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer", marginBottom:"20px", padding:0 },
  layout: { display:"grid", gridTemplateColumns:"280px 1fr", gap:"20px", alignItems:"start" },
  profileCard: { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px", textAlign:"center" },
  profileName: { fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"4px" },
  profileSub: { fontSize:"13px", color:"#64748B", marginBottom:"12px" },
  metaRow: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderTop:"1px solid #F1F5F9", fontSize:"13px" },
  metaLabel: { color:"#64748B", fontWeight:"500" },
  metaVal: { color:"#1E293B", fontWeight:"600" },
  formCard: { background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"24px" },
  formHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1E293B" },
  editBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  cancelBtn: { background:"#F1F5F9", border:"1px solid #E2E8F0", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#1E293B", cursor:"pointer" },
  saveBtn: { background:"#3B82F6", border:"none", borderRadius:"8px", padding:"7px 14px", fontSize:"13px", fontWeight:"600", color:"#FFF", cursor:"pointer" },
  fields: { display:"flex", flexDirection:"column", gap:"16px", marginBottom:"24px" },
  label: { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" },
  value: { fontSize:"14px", color:"#1E293B", fontWeight:"500" },
  input: { display:"block", width:"100%", padding:"9px 12px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"14px", color:"#1E293B", background:"#FFF", boxSizing:"border-box", outline:"none" },
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:9000, display:"flex", alignItems:"center", justifyContent:"center" },
  modal: { background:"#FFF", borderRadius:"16px", padding:"32px 28px", width:"360px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  modalTitle: { fontSize:"18px", fontWeight:"800", color:"#1E293B", marginBottom:"10px" },
  modalBody: { fontSize:"14px", color:"#64748B", lineHeight:1.6, marginBottom:"24px" },
};
