import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(n="") { return AVATAR_COLORS[(n.charCodeAt(0)||0)%AVATAR_COLORS.length]; }

export default function BusinessDetail() {
  const { id } = useParams();
  const goTo   = useGoTo();

  const [outlet,   setOutlet]   = useState(null);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [showDel,  setShowDel]  = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast,    setToast]    = useState(null);
  const [form,     setForm]     = useState({ name:"", address:"" });

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: o }, { data: staffData }] = await Promise.all([
        supabase.from("outlets").select("outlet_id,name,address").eq("outlet_id", id).single(),
        supabase.from("staff").select("staff_id,staff_type,is_active,users(full_name,email)").eq("outlet_id", id),
      ]);
      if (cancelled) return;
      if (!o) { goTo("/system-admin/businesses"); return; }
      setOutlet(o);
      setForm({ name: o.name, address: o.address||"" });
      setStaff(staffData||[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSave() {
    if (!form.name.trim()) { showToast("Name is required.", "error"); return; }
    setSaving(true);
    const { error } = await supabase.from("outlets").update({ name: form.name.trim(), address: form.address.trim()||null }).eq("outlet_id", id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setOutlet(prev => ({ ...prev, ...form }));
    setEditing(false);
    showToast("Business updated.");
  }

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from("outlets").delete().eq("outlet_id", id);
    if (error) { showToast(error.message, "error"); setDeleting(false); setShowDel(false); return; }
    goTo("/system-admin/businesses");
  }

  if (loading) return <AdminLayout title="Business Detail"><div style={{ padding:"60px", textAlign:"center", color:"#64748B" }}>Loading…</div></AdminLayout>;

  const activeStaff = staff.filter(s => s.is_active).length;

  return (
    <AdminLayout title="Business Detail">
      <button onClick={() => goTo("/system-admin/businesses")} style={s.back}>← Back to Businesses</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ width:"72px", height:"72px", borderRadius:"16px", background:avatarColor(outlet.name), color:"#FFF", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            {outlet.name[0]?.toUpperCase()}
          </div>
          <h2 style={s.profileName}>{outlet.name}</h2>
          <p style={s.profileSub}>{outlet.address || "No address set"}</p>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Total Staff</span>
            <span style={s.metaVal}>{staff.length}</span>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Active Staff</span>
            <span style={{ ...s.metaVal, color:"#16A34A" }}>{activeStaff}</span>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Outlet ID</span>
            <span style={s.metaVal}>#{outlet.outlet_id}</span>
          </div>

          <div style={{ marginTop:"16px", display:"flex", flexDirection:"column", gap:"8px" }}>
            <button onClick={() => setShowDel(true)}
              style={{ width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA" }}>
              🗑 Delete Business
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div style={s.formCard}>
          <div style={s.formHeader}>
            <h3 style={s.formTitle}>Business Details</h3>
            {!editing
              ? <button onClick={() => setEditing(true)} style={s.editBtn}>Edit</button>
              : <div style={{ display:"flex", gap:"8px" }}>
                  <button onClick={() => { setEditing(false); setForm({ name:outlet.name, address:outlet.address||"" }); }} style={s.cancelBtn}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={s.saveBtn}>{saving ? "Saving…" : "Save"}</button>
                </div>
            }
          </div>

          <div style={s.fields}>
            <Field label="Outlet Name">
              {editing ? <input value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))} style={s.input} autoFocus />
                       : <p style={s.value}>{outlet.name}</p>}
            </Field>
            <Field label="Address">
              {editing ? <input value={form.address} onChange={e => setForm(p=>({...p,address:e.target.value}))} style={s.input} placeholder="e.g. 176 Orchard Road, Singapore" />
                       : <p style={s.value}>{outlet.address || <span style={{ color:"#CBD5E1" }}>Not set</span>}</p>}
            </Field>
          </div>

          {/* Staff list */}
          <div style={{ borderTop:"1px solid #F1F5F9", paddingTop:"20px" }}>
            <h4 style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", marginBottom:"14px" }}>
              Staff at this Outlet ({staff.length})
            </h4>
            {staff.length === 0 ? (
              <p style={{ fontSize:"13px", color:"#94A3B8" }}>No staff assigned yet.</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {staff.map(m => (
                  <div key={m.staff_id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background:"#F8FAFC", borderRadius:"10px", border:"1px solid #F1F5F9" }}>
                    <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:avatarColor(m.users?.full_name||""), color:"#FFF", fontSize:"13px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {m.users?.full_name?.[0]?.toUpperCase()||"?"}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:"13px", fontWeight:"600", color:"#1E293B" }}>{m.users?.full_name||"—"}</p>
                      <p style={{ fontSize:"11px", color:"#64748B" }}>{m.users?.email||""} · {m.staff_type}</p>
                    </div>
                    <span style={{ fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px", background: m.is_active?"#DCFCE7":"#F1F5F9", color: m.is_active?"#166534":"#94A3B8" }}>
                      {m.is_active?"Active":"Inactive"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showDel && (
        <div style={s.overlay} onClick={() => setShowDel(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>🗑</p>
            <h3 style={s.modalTitle}>Delete Business?</h3>
            <p style={s.modalBody}>This will permanently remove <strong>{outlet.name}</strong>. This cannot be undone.</p>
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
  profileSub: { fontSize:"13px", color:"#64748B", marginBottom:"16px" },
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
