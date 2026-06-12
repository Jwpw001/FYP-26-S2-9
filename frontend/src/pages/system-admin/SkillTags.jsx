import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import AdminLayout from "../../components/layout/AdminLayout";

if (typeof document !== "undefined" && !document.getElementById("sa-skill-kf")) {
  const s = document.createElement("style");
  s.id = "sa-skill-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .skill-card{transition:box-shadow 0.18s,transform 0.18s}
    .skill-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
  `;
  document.head.appendChild(s);
}

const TAG_BG   = ["#EFF6FF","#F5F3FF","#FFF7ED","#F0FDF4","#FFF1F2","#ECFEFF","#FEFCE8"];
const TAG_TEXT = ["#1D4ED8","#6D28D9","#C2410C","#15803D","#BE123C","#0E7490","#A16207"];
function chipStyle(name) {
  const i = (name?.charCodeAt(0)||0) % TAG_BG.length;
  return { background: TAG_BG[i], color: TAG_TEXT[i] };
}
function Shimmer({ w="100%", h="16px", r="8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}

export default function SkillTags() {
  const user = getUser();
  const [skills,       setSkills]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [newName,      setNewName]      = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [adding,       setAdding]       = useState(false);
  const [editId,       setEditId]       = useState(null);
  const [editName,     setEditName]     = useState("");
  const [editDesc,     setEditDesc]     = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast,        setToast]        = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("skills").select("skill_id,name,description,created_by").order("name")
      .then(({ data }) => { if (!cancelled) { setSkills(data||[]); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  async function handleAdd() {
    if (!newName.trim()) { showToast("Skill name is required.", "error"); return; }
    setAdding(true);
    const { data, error } = await supabase.from("skills")
      .insert({ name: newName.trim(), description: newDesc.trim()||null, created_by: user?.user_id??null })
      .select().single();
    setAdding(false);
    if (error) { showToast(error.message.includes("unique") ? "A skill with that name already exists." : error.message, "error"); return; }
    setSkills(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setNewName(""); setNewDesc("");
    showToast("Skill tag added.");
  }

  async function handleUpdate(id) {
    if (!editName.trim()) return;
    const { error } = await supabase.from("skills").update({ name: editName.trim(), description: editDesc.trim()||null }).eq("skill_id", id);
    if (error) { showToast(error.message, "error"); return; }
    setSkills(prev => prev.map(s => s.skill_id===id ? { ...s, name:editName.trim(), description:editDesc.trim()||null } : s));
    setEditId(null);
    showToast("Skill tag updated.");
  }

  async function confirmDelete() {
    const id = deleteTarget.skill_id;
    const { error } = await supabase.from("skills").delete().eq("skill_id", id);
    setDeleteTarget(null);
    if (error) { showToast("Cannot delete — skill may be in use.", "error"); return; }
    setSkills(prev => prev.filter(s => s.skill_id !== id));
    showToast("Skill tag deleted.");
  }

  return (
    <AdminLayout title="Skill Tags">

      {/* Delete confirm modal */}
      {deleteTarget && (
        <div style={{ position:"fixed", inset:0, background:"rgba(15,23,42,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}
          onClick={() => setDeleteTarget(null)}>
          <div style={{ background:"#FFF", borderRadius:"16px", padding:"28px", width:"100%", maxWidth:"400px", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ width:"48px", height:"48px", borderRadius:"50%", margin:"0 auto 14px", background:"#FEF2F2", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:"22px" }}>⚠️</span>
            </div>
            <h3 style={{ fontSize:"17px", fontWeight:"800", color:"#1E293B", marginBottom:"8px" }}>Delete skill tag?</h3>
            <p style={{ fontSize:"13px", color:"#64748B", lineHeight:1.6, marginBottom:"22px" }}>
              <strong>{deleteTarget.name}</strong> will be removed from all assigned staff.
            </p>
            <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
              <button onClick={() => setDeleteTarget(null)}
                style={{ background:"#F1F5F9", border:"none", borderRadius:"9px", padding:"8px 16px", fontSize:"13px", fontWeight:"600", color:"#64748B", cursor:"pointer" }}>Cancel</button>
              <button onClick={confirmDelete}
                style={{ background:"#EF4444", border:"none", borderRadius:"9px", padding:"8px 18px", fontSize:"13px", fontWeight:"700", color:"#FFF", cursor:"pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ marginBottom:"24px" }}>
          <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Skill Tags</h2>
          <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
            {loading ? "Loading…" : `${skills.length} tag${skills.length!==1?"s":""} · used for staff and shift role matching`}
          </p>
        </div>

        {/* Add form */}
        <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"22px", marginBottom:"24px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#0F172A", marginBottom:"14px" }}>Add New Skill Tag</h3>
          <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", alignItems:"flex-end" }}>
            <div style={{ flex:"1 1 160px" }}>
              <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"5px" }}>Skill Name *</label>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAdd()}
                placeholder="e.g. Barista"
                style={{ width:"100%", padding:"9px 13px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
            </div>
            <div style={{ flex:"2 1 220px" }}>
              <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"5px" }}>Description (optional)</label>
              <input value={newDesc} onChange={e => setNewDesc(e.target.value)} onKeyDown={e => e.key==="Enter" && handleAdd()}
                placeholder="Brief description of this skill…"
                style={{ width:"100%", padding:"9px 13px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"13px", outline:"none", boxSizing:"border-box" }} />
            </div>
            <button onClick={handleAdd} disabled={adding}
              style={{ padding:"9px 20px", borderRadius:"9px", fontSize:"13px", fontWeight:"600", border:"none", background: adding ? "#93C5FD" : "#3B82F6", color:"#FFF", cursor: adding ? "not-allowed" : "pointer", flexShrink:0, height:"38px" }}>
              {adding ? "Adding…" : "+ Add Tag"}
            </button>
          </div>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"14px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"20px" }}>
                <Shimmer w="100px" h="22px" r="100px" />
                <div style={{ marginTop:"10px" }}><Shimmer w="80%" h="13px" r="5px" /></div>
                <div style={{ marginTop:"14px", display:"flex", gap:"8px" }}>
                  <Shimmer w="50px" h="28px" r="8px" />
                  <Shimmer w="58px" h="28px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : skills.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>🏷️</p>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#64748B" }}>No skill tags yet</p>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"14px" }}>
            {skills.map((sk, i) => {
              const cs = chipStyle(sk.name);
              const isEditing = editId === sk.skill_id;
              return (
                <div key={sk.skill_id} className="skill-card"
                  style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"18px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.04}s both` }}>

                  {isEditing ? (
                    <>
                      <input autoFocus value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if(e.key==="Enter") handleUpdate(sk.skill_id); if(e.key==="Escape") setEditId(null); }}
                        style={{ width:"100%", padding:"7px 11px", border:"1.5px solid #BFDBFE", borderRadius:"8px", fontSize:"13px", fontWeight:"600", outline:"none", boxSizing:"border-box", marginBottom:"8px" }} />
                      <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)"
                        style={{ width:"100%", padding:"7px 11px", border:"1.5px solid #E2E8F0", borderRadius:"8px", fontSize:"12px", outline:"none", boxSizing:"border-box", marginBottom:"12px" }} />
                      <div style={{ display:"flex", gap:"8px" }}>
                        <button onClick={() => handleUpdate(sk.skill_id)}
                          style={{ padding:"5px 12px", borderRadius:"7px", border:"none", background:"#3B82F6", color:"#FFF", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>Save</button>
                        <button onClick={() => setEditId(null)}
                          style={{ padding:"5px 12px", borderRadius:"7px", border:"1px solid #E2E8F0", background:"#F1F5F9", color:"#64748B", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span style={{ display:"inline-block", padding:"4px 12px", borderRadius:"100px", fontSize:"13px", fontWeight:"700", marginBottom:"10px", ...cs }}>
                        {sk.name}
                      </span>
                      <p style={{ fontSize:"12px", color: sk.description ? "#64748B" : "#CBD5E1", marginBottom:"14px", minHeight:"18px" }}>
                        {sk.description || "No description"}
                      </p>
                      <div style={{ display:"flex", gap:"8px", paddingTop:"12px", borderTop:"1px solid #F1F5F9" }}>
                        <button onClick={() => { setEditId(sk.skill_id); setEditName(sk.name); setEditDesc(sk.description||""); }}
                          style={{ padding:"5px 12px", borderRadius:"7px", border:"1.5px solid #E2E8F0", background:"#FFF", color:"#475569", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>Edit</button>
                        <button onClick={() => setDeleteTarget(sk)}
                          style={{ padding:"5px 12px", borderRadius:"7px", border:"1.5px solid #FECACA", background:"#FEF2F2", color:"#991B1B", fontSize:"12px", fontWeight:"600", cursor:"pointer" }}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position:"fixed", bottom:"28px", right:"28px", zIndex:9999, background: toast.type==="success" ? "#22C55E" : "#EF4444", color:"#FFF", padding:"12px 20px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", boxShadow:"0 4px 20px rgba(0,0,0,0.15)", animation:"toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}
