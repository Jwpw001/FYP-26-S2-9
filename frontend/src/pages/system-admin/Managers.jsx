import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

export default function Managers() {
  const [managers, setManagers] = useState([]);
  const [outlets, setOutlets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showing, setShowing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [form, setForm]         = useState({ full_name:"", email:"", outlet_id:"" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [{ data: mgrs }, { data: outs }] = await Promise.all([
        supabase.from("users").select("user_id, full_name, email, role")
          .eq("role", "outlet_manager").order("full_name"),
        supabase.from("outlets").select("outlet_id, name").order("name"),
      ]);
      if (!cancelled) {
        setManagers(mgrs || []);
        setOutlets(outs || []);
        setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function handleAdd() {
    if (!form.full_name.trim() || !form.email.trim()) {
      setError("Name and email are required."); return;
    }
    setSaving(true); setError(""); setSuccess("");
    try {
      // Insert into users table
      const { data: newUser, error: err } = await supabase
        .from("users")
        .insert({ full_name: form.full_name.trim(),
          email: form.email.trim().toLowerCase(), role:"outlet_manager" })
        .select().single();

      if (err) {
        setError(err.message.includes("unique") ? "Email already exists." : err.message);
        return;
      }

      setManagers(prev => [...prev, newUser].sort((a,b) => a.full_name.localeCompare(b.full_name)));
      setForm({ full_name:"", email:"", outlet_id:"" });
      setShowing(false);
      setSuccess("Manager account created. They can log in once Supabase Auth is set up.");
    } catch {
      setError("Failed to create account.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="Outlet Managers">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Outlet Managers</h2>
          <p style={s.sub}>{managers.length} manager accounts</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowing(!showing); setError(""); }}>
          {showing ? "Cancel" : "+ Add Manager"}
        </button>
      </div>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {showing && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>Create Manager Account</h3>
          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Full Name *</label>
              <input style={s.input} placeholder="e.g. Sarah Tan"
                value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name:e.target.value }))} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Email *</label>
              <input style={s.input} type="email" placeholder="e.g. sarah@krewby.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email:e.target.value }))} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Assign to Outlet</label>
              <select style={s.input} value={form.outlet_id}
                onChange={e => setForm(p => ({ ...p, outlet_id:e.target.value }))}>
                <option value="">Select outlet (optional)</option>
                {outlets.map(o => (
                  <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleAdd} disabled={saving}>
            {saving ? "Creating…" : "Create Account"}
          </button>
        </div>
      )}

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : managers.length === 0 ? (
        <div style={s.empty}>No managers yet.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>Name</span><span>Email</span><span>Status</span>
          </div>
          {managers.map(m => (
            <div key={m.user_id} style={s.row}>
              <div style={s.nameCell}>
                <div style={s.avatar}>{m.full_name?.[0]?.toUpperCase() || "M"}</div>
                <span style={s.name}>{m.full_name}</span>
              </div>
              <span style={s.cell}>{m.email}</span>
              <span style={s.activeBadge}>Active</span>
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
  tableHead: { display:"grid", gridTemplateColumns:"2fr 2fr 100px",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"12px" },
  row: { display:"grid", gridTemplateColumns:"2fr 2fr 100px",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"12px", fontSize:"13px" },
  nameCell: { display:"flex", alignItems:"center", gap:"10px" },
  avatar: { width:"30px", height:"30px", borderRadius:"50%", background:"#E5E2DC",
    color:"#55524A", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:"12px", fontWeight:"700", flexShrink:0 },
  name: { fontWeight:"600", color:"#1C1B18" },
  cell: { color:"#55524A" },
  activeBadge: { display:"inline-block", background:"#DCFCE7", color:"#166534",
    padding:"2px 8px", borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
};
