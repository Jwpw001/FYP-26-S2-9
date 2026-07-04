import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";
import { Pause, Play, Trash2 } from "lucide-react";

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(n="") { return AVATAR_COLORS[(n.charCodeAt(0)||0)%AVATAR_COLORS.length]; }

function Stars({ value }) {
  const n = Number(value||5);
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"2px" }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={i<=Math.round(n)?"#F59E0B":"none"} stroke={i<=Math.round(n)?"#F59E0B":"#CBD5E1"} strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
      <span style={{ fontSize:"12px", color:"#64748B", marginLeft:"4px", fontWeight:"600" }}>{n.toFixed(1)}</span>
    </span>
  );
}

export default function KrewbyWorkerDetail() {
  const { id } = useParams();
  const goTo   = useGoTo();

  const [worker,  setWorker]  = useState(null);
  const [user,    setUser]    = useState(null);
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [showDel, setShowDel] = useState(false);
  const [deleting,setDeleting]= useState(false);
  const [toast,   setToast]   = useState(null);
  const [form,    setForm]    = useState({ preferred_location:"" });

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: w } = await supabase.from("krewby_workers")
        .select("krewby_worker_id,user_id,preferred_location,rating,total_jobs,is_active").eq("krewby_worker_id", id).single();
      if (!w || cancelled) { goTo("/system-admin/krewby-workers"); return; }

      const { data: u } = await supabase.from("users").select("user_id,full_name,email,created_at").eq("user_id", w.user_id).single();

      // Recent assignments
      const { data: assignData } = await supabase.from("shift_assignments")
        .select("assignment_id,status,shifts(title,shift_date,outlets(name))").eq("krewby_worker_id", id)
        .order("assignment_id", { ascending:false }).limit(5);

      if (!cancelled) {
        setWorker(w); setUser(u||null);
        setJobs((assignData||[]).filter(a => a.shifts));
        setForm({ preferred_location: w.preferred_location||"" });
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase.from("krewby_workers")
      .update({ preferred_location: form.preferred_location.trim()||null }).eq("krewby_worker_id", id);
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setWorker(prev => ({ ...prev, preferred_location: form.preferred_location.trim()||null }));
    setEditing(false);
    showToast("Worker updated.");
  }

  async function toggleActive() {
    const newVal = !worker.is_active;
    await supabase.from("krewby_workers").update({ is_active: newVal }).eq("krewby_worker_id", id);
    setWorker(prev => ({ ...prev, is_active: newVal }));
    showToast(newVal ? "Worker activated." : "Worker deactivated.");
  }

  async function handleDelete() {
    setDeleting(true);
    await supabase.from("krewby_workers").delete().eq("krewby_worker_id", id);
    if (user) await supabase.from("users").delete().eq("user_id", user.user_id);
    goTo("/system-admin/krewby-workers");
  }

  if (loading) return <AdminLayout title="Worker Detail"><div style={{ padding:"60px", textAlign:"center", color:"#64748B" }}>Loading…</div></AdminLayout>;

  const name     = user?.full_name || "?";
  const initials = name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);

  return (
    <AdminLayout title="Worker Detail">
      <button onClick={() => goTo("/system-admin/krewby-workers")} style={s.back}>← Back to Krewby Workers</button>

      <div style={s.layout}>
        {/* Left card */}
        <div style={s.profileCard}>
          <div style={{ width:"72px", height:"72px", borderRadius:"50%", background:avatarColor(name), color:"#FFF", fontSize:"26px", fontWeight:"800", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 14px" }}>
            {initials}
          </div>
          <h2 style={s.profileName}>{name}</h2>
          <p style={s.profileSub}>{user?.email}</p>
          <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", background:"rgba(59,130,246,0.1)", color:"#1D4ED8", marginBottom:"16px" }}>
            Krewby Worker
          </span>

          <div style={s.metaRow}>
            <span style={s.metaLabel}>Status</span>
            <span style={{ padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600", background: worker.is_active?"#DCFCE7":"#F1F5F9", color: worker.is_active?"#166534":"#94A3B8" }}>
              {worker.is_active ? "Active" : "Inactive"}
            </span>
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Rating</span>
            <Stars value={worker.rating} />
          </div>
          <div style={s.metaRow}>
            <span style={s.metaLabel}>Total Jobs</span>
            <span style={s.metaVal}>{worker.total_jobs||0}</span>
          </div>
          {worker.preferred_location && (
            <div style={s.metaRow}>
              <span style={s.metaLabel}>Area</span>
              <span style={{ ...s.metaVal, fontSize:"12px" }}>{worker.preferred_location}</span>
            </div>
          )}

          <div style={{ marginTop:"16px", display:"flex", flexDirection:"column", gap:"8px" }}>
            <button onClick={toggleActive}
              style={{ width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer", background: worker.is_active?"#FEF3C7":"#DCFCE7", color: worker.is_active?"#92400E":"#166534", border: worker.is_active?"1px solid #FDE68A":"1px solid #BBF7D0" }}>
              {worker.is_active
                ? <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", justifyContent:"center" }}><Pause size={14}/> Deactivate</span>
                : <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", justifyContent:"center" }}><Play size={14}/> Activate</span>}
            </button>
            <button onClick={() => setShowDel(true)}
              style={{ width:"100%", padding:"9px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", cursor:"pointer", background:"#FEF2F2", color:"#991B1B", border:"1px solid #FECACA" }}>
              <span style={{ display:"inline-flex", alignItems:"center", gap:"4px", justifyContent:"center" }}><Trash2 size={14}/> Delete Worker</span>
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
                  <button onClick={() => { setEditing(false); setForm({ preferred_location:worker.preferred_location||"" }); }} style={s.cancelBtn}>Cancel</button>
                  <button onClick={handleSave} disabled={saving} style={s.saveBtn}>{saving ? "Saving…" : "Save"}</button>
                </div>
            }
          </div>

          <div style={s.fields}>
            <Field label="Full Name"><p style={s.value}>{name}</p></Field>
            <Field label="Email"><p style={s.value}>{user?.email||"—"}</p></Field>
            <Field label="Preferred Location">
              {editing
                ? <input value={form.preferred_location} onChange={e => setForm(p=>({...p,preferred_location:e.target.value}))} style={s.input} placeholder="e.g. Central Singapore" autoFocus />
                : <p style={s.value}>{worker.preferred_location || <span style={{ color:"#CBD5E1" }}>Not set</span>}</p>}
            </Field>
            {user?.created_at && (
              <Field label="Joined">
                <p style={s.value}>{new Date(user.created_at).toLocaleDateString("en-SG",{year:"numeric",month:"short",day:"numeric"})}</p>
              </Field>
            )}
          </div>

          {/* Recent jobs */}
          <div style={{ borderTop:"1px solid #F1F5F9", paddingTop:"20px" }}>
            <h4 style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", marginBottom:"14px" }}>
              Recent Job Assignments ({jobs.length})
            </h4>
            {jobs.length === 0 ? (
              <p style={{ fontSize:"13px", color:"#94A3B8" }}>No assignments yet.</p>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {jobs.map(j => (
                  <div key={j.assignment_id} style={{ display:"flex", alignItems:"center", gap:"12px", padding:"10px 14px", background:"#F8FAFC", borderRadius:"10px", border:"1px solid #F1F5F9" }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:"13px", fontWeight:"600", color:"#1E293B" }}>{j.shifts.title||"Shift"}</p>
                      <p style={{ fontSize:"11px", color:"#64748B" }}>{j.shifts.outlets?.name} · {j.shifts.shift_date}</p>
                    </div>
                    <span style={{ fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px",
                      background: j.status==="completed"?"#DCFCE7":j.status==="assigned"?"#DBEAFE":"#F1F5F9",
                      color: j.status==="completed"?"#166534":j.status==="assigned"?"#1E40AF":"#64748B" }}>
                      {j.status}
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
            <p style={{ fontSize:"32px", marginBottom:"10px", display:"flex", justifyContent:"center", color:"#991B1B" }}><Trash2 size={32}/></p>
            <h3 style={s.modalTitle}>Delete Worker?</h3>
            <p style={s.modalBody}>This will permanently remove <strong>{name}</strong> and all their records.</p>
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
