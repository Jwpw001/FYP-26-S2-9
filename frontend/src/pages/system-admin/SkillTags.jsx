import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import AdminLayout from "../../components/layout/AdminLayout";

export default function SkillTags() {
  const user = getUser();
  const [skills, setSkills]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [newName, setNewName]   = useState("");
  const [newDesc, setNewDesc]   = useState("");
  const [adding, setAdding]     = useState(false);
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("skills").select("skill_id, name, description, created_by")
        .order("name");
      if (!cancelled) { setSkills(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAdd() {
    if (!newName.trim()) { setError("Skill name is required."); return; }
    setAdding(true); setError(""); setSuccess("");
    const { data, error: err } = await supabase
      .from("skills")
      .insert({ name: newName.trim(), description: newDesc.trim() || null,
        created_by: user.user_id })
      .select().single();
    setAdding(false);
    if (err) {
      setError(err.message.includes("unique") ? "A skill with that name already exists." : err.message);
      return;
    }
    setSkills(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setNewName(""); setNewDesc(""); setSuccess("Skill tag added.");
  }

  async function handleUpdate(id) {
    if (!editName.trim()) return;
    const { error: err } = await supabase
      .from("skills").update({ name: editName.trim() }).eq("skill_id", id);
    if (err) { setError(err.message); return; }
    setSkills(prev => prev.map(s => s.skill_id === id ? { ...s, name: editName.trim() } : s));
    setEditId(null); setSuccess("Skill tag updated.");
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this skill tag? It will be removed from all assigned staff.")) return;
    const { error: err } = await supabase.from("skills").delete().eq("skill_id", id);
    if (err) { setError("Cannot delete — skill may be in use."); return; }
    setSkills(prev => prev.filter(s => s.skill_id !== id));
    setSuccess("Skill tag deleted.");
  }

  return (
    <AdminLayout title="Skill Tags">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Skill Tags</h2>
          <p style={s.sub}>{skills.length} tags · used for staff and shift role matching</p>
        </div>
      </div>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {/* Add new */}
      <div style={s.addCard}>
        <h3 style={s.addTitle}>Add New Skill Tag</h3>
        <div style={s.addRow}>
          <input style={s.input} placeholder="Skill name e.g. Barista"
            value={newName} onChange={e => { setNewName(e.target.value); setError(""); }} />
          <input style={s.input} placeholder="Description (optional)"
            value={newDesc} onChange={e => setNewDesc(e.target.value)} />
          <button style={s.addBtn} onClick={handleAdd} disabled={adding}>
            {adding ? "Adding…" : "+ Add"}
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : skills.length === 0 ? (
        <div style={s.empty}>No skill tags yet. Add one above.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>Skill Name</span>
            <span>Description</span>
            <span>Actions</span>
          </div>
          {skills.map(sk => (
            <div key={sk.skill_id} style={s.row}>
              {editId === sk.skill_id ? (
                <>
                  <input style={{ ...s.input, margin:0 }} value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleUpdate(sk.skill_id)} />
                  <span style={s.cell}>{sk.description || "—"}</span>
                  <div style={s.rowActions}>
                    <button style={s.saveBtn} onClick={() => handleUpdate(sk.skill_id)}>Save</button>
                    <button style={s.cancelBtn} onClick={() => setEditId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <span style={s.skillName}>{sk.name}</span>
                  <span style={s.cell}>{sk.description || <span style={s.muted}>—</span>}</span>
                  <div style={s.rowActions}>
                    <button style={s.editBtn}
                      onClick={() => { setEditId(sk.skill_id); setEditName(sk.name); }}>
                      Edit
                    </button>
                    <button style={s.deleteBtn} onClick={() => handleDelete(sk.skill_id)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  addCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  addTitle: { fontSize:"14px", fontWeight:"700", color:"#1C1B18", marginBottom:"12px" },
  addRow: { display:"flex", gap:"10px", flexWrap:"wrap" },
  input: { flex:1, minWidth:"160px", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  addBtn: { padding:"9px 18px", background:"#1C1B18", color:"#FFFFFF",
    border:"none", borderRadius:"9px", fontSize:"14px", fontWeight:"600", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  tableHead: { display:"grid", gridTemplateColumns:"2fr 3fr 160px",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"12px" },
  row: { display:"grid", gridTemplateColumns:"2fr 3fr 160px",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"12px", fontSize:"13px" },
  skillName: { fontWeight:"600", color:"#1C1B18" },
  cell: { color:"#55524A" },
  muted: { color:"#A09D97" },
  rowActions: { display:"flex", gap:"6px" },
  editBtn: { padding:"5px 12px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"7px", fontSize:"12px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
  deleteBtn: { padding:"5px 12px", background:"#FEF2F2", border:"1px solid #FECACA",
    borderRadius:"7px", fontSize:"12px", fontWeight:"600", color:"#991B1B", cursor:"pointer" },
  saveBtn: { padding:"5px 12px", background:"#1C1B18", border:"none",
    borderRadius:"7px", fontSize:"12px", fontWeight:"600", color:"#FFFFFF", cursor:"pointer" },
  cancelBtn: { padding:"5px 12px", background:"#F7F6F3", border:"1px solid #E5E2DC",
    borderRadius:"7px", fontSize:"12px", fontWeight:"600", color:"#1C1B18", cursor:"pointer" },
};
