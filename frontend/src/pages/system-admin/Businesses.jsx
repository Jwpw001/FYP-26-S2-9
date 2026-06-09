import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

export default function Businesses() {
  const [outlets, setOutlets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showing, setShowing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [form, setForm]         = useState({ name:"", address:"" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("outlets").select("outlet_id, name, address").order("name");
      if (!cancelled) { setOutlets(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAdd() {
    if (!form.name.trim()) { setError("Business name is required."); return; }
    setSaving(true); setError(""); setSuccess("");
    const { data, error: err } = await supabase
      .from("outlets")
      .insert({ name: form.name.trim(), address: form.address.trim() || null })
      .select().single();
    setSaving(false);
    if (err) { setError(err.message); return; }
    setOutlets(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setForm({ name:"", address:"" });
    setShowing(false);
    setSuccess("Business registered successfully.");
  }

  return (
    <AdminLayout title="Businesses">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Registered Businesses</h2>
          <p style={s.sub}>{outlets.length} outlets registered</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowing(!showing); setError(""); }}>
          {showing ? "Cancel" : "+ Register Business"}
        </button>
      </div>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {showing && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>Register New Business</h3>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Business / Outlet Name *</label>
              <input style={s.input} placeholder="e.g. The Coffee Club Orchard"
                value={form.name} onChange={e => setForm(p => ({ ...p, name:e.target.value }))} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Address</label>
              <input style={s.input} placeholder="e.g. 176 Orchard Road, Singapore 238843"
                value={form.address} onChange={e => setForm(p => ({ ...p, address:e.target.value }))} />
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleAdd} disabled={saving}>
            {saving ? "Saving…" : "Register Business"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : outlets.length === 0 ? (
        <div style={s.empty}>No businesses registered yet.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>#</span><span>Business Name</span><span>Address</span>
          </div>
          {outlets.map(o => (
            <div key={o.outlet_id} style={s.row}>
              <span style={s.id}>{o.outlet_id}</span>
              <span style={s.name}>{o.name}</span>
              <span style={s.cell}>{o.address || <span style={s.muted}>Not set</span>}</span>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  addBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 18px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  formCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px", marginBottom:"20px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  saveBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 20px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  tableHead: { display:"grid", gridTemplateColumns:"60px 2fr 3fr",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"12px" },
  row: { display:"grid", gridTemplateColumns:"60px 2fr 3fr",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"12px", fontSize:"13px" },
  id: { color:"#A09D97", fontWeight:"600" },
  name: { fontWeight:"600", color:"#1C1B18" },
  cell: { color:"#55524A" },
  muted: { color:"#A09D97" },
};
