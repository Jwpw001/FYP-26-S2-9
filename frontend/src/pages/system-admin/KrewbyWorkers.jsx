import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

export default function KrewbyWorkers() {
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [showing, setShowing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");
  const [form, setForm]         = useState({
    full_name: "", email: "", username: "", password: "", preferred_location: ""
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase
        .from("krewby_workers")
        .select(`
          krewby_worker_id, preferred_location, rating, total_jobs, is_active,
          users ( user_id, full_name, email )
        `)
        .order("krewby_worker_id");
      if (!cancelled) { setWorkers(data || []); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  async function toggleActive(workerId, current) {
    await supabase.from("krewby_workers")
      .update({ is_active: !current }).eq("krewby_worker_id", workerId);
    setWorkers(prev => prev.map(w =>
      w.krewby_worker_id === workerId ? { ...w, is_active: !current } : w
    ));
  }

  async function handleAdd() {
    if (!form.full_name.trim()) { setError("Full name is required."); return; }
    if (!form.email.trim())     { setError("Email is required."); return; }
    if (!form.username.trim())  { setError("Username is required."); return; }
    if (!form.password.trim() || form.password.length < 6) {
      setError("Password must be at least 6 characters."); return;
    }

    setSaving(true); setError(""); setSuccess("");

    // Step 1: Create Supabase Auth account
    const { error: authErr } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password.trim(),
    });

    if (authErr) { setSaving(false); setError(authErr.message); return; }

    // Step 2: Insert into users table
    const { data: userData, error: userErr } = await supabase
      .from("users")
      .insert({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        role: "krewby_casual_worker",
      })
      .select()
      .single();

    if (userErr) { setSaving(false); setError(userErr.message); return; }

    // Step 3: Insert into krewby_workers table
    const { data: workerData, error: workerErr } = await supabase
      .from("krewby_workers")
      .insert({
        user_id: userData.user_id,
        preferred_location: form.preferred_location.trim() || null,
        rating: 5.0,
        total_jobs: 0,
        is_active: true,
      })
      .select(`
        krewby_worker_id, preferred_location, rating, total_jobs, is_active,
        users ( user_id, full_name, email )
      `)
      .single();

    setSaving(false);
    if (workerErr) { setError(workerErr.message); return; }

    setWorkers(prev => [...prev, workerData]);
    setForm({ full_name: "", email: "", username: "", password: "", preferred_location: "" });
    setShowing(false);
    setSuccess("Krewby Worker added successfully.");
  }

  const filtered = workers.filter(w => {
    const q = search.toLowerCase();
    return (w.users?.full_name?.toLowerCase() || "").includes(q) ||
           (w.users?.email?.toLowerCase() || "").includes(q);
  });

  return (
    <AdminLayout title="Krewby Workers">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Krewby Workers</h2>
          <p style={s.sub}>{workers.filter(w => w.is_active).length} active workers</p>
        </div>
        <button style={s.addBtn} onClick={() => { setShowing(!showing); setError(""); setSuccess(""); }}>
          {showing ? "Cancel" : "+ Add Krewby Worker"}
        </button>
      </div>

      {error   && <div style={s.errorMsg}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {showing && (
        <div style={s.formCard}>
          <h3 style={s.formTitle}>Add New Krewby Worker</h3>
          <div style={s.fields}>
            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label}>Full Name *</label>
                <input style={s.input} placeholder="e.g. John Tan"
                  value={form.full_name}
                  onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Username *</label>
                <input style={s.input} placeholder="e.g. andrea_worker"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
              </div>
            </div>
            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label}>Email *</label>
                <input style={s.input} placeholder="e.g. andrea@gmail.com" type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Password *</label>
                <input style={s.input} placeholder="Min 6 characters" type="password"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>
            <div style={s.fieldRow}>
              <div style={s.field}>
                <label style={s.label}>Preferred Location</label>
                <input style={s.input} placeholder="e.g. Central Singapore"
                  value={form.preferred_location}
                  onChange={e => setForm(p => ({ ...p, preferred_location: e.target.value }))} />
              </div>
            </div>
          </div>
          <button style={s.saveBtn} onClick={handleAdd} disabled={saving}>
            {saving ? "Adding…" : "Add Worker"}
          </button>
        </div>
      )}

      <input style={s.search} placeholder="Search by name or email…"
        value={search} onChange={e => setSearch(e.target.value)} />

      {loading ? (
        <div style={s.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No workers found.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>Name</span><span>Email</span>
            <span>Rating</span><span>Jobs</span>
            <span>Location</span><span>Status</span><span></span>
          </div>
          {filtered.map(w => (
            <div key={w.krewby_worker_id} style={s.row}>
              <div style={s.nameCell}>
                <div style={s.avatar}>{w.users?.full_name?.[0]?.toUpperCase() || "W"}</div>
                <span style={s.name}>{w.users?.full_name || "—"}</span>
              </div>
              <span style={s.cell}>{w.users?.email || "—"}</span>
              <span style={s.cell}>⭐ {Number(w.rating || 5).toFixed(1)}</span>
              <span style={s.cell}>{w.total_jobs || 0}</span>
              <span style={s.cell}>{w.preferred_location || "—"}</span>
              <span>
                <span style={{
                  ...s.statusBadge,
                  background: w.is_active ? "#DCFCE7" : "#F3F4F6",
                  color: w.is_active ? "#166534" : "#6B7280",
                }}>
                  {w.is_active ? "Active" : "Inactive"}
                </span>
              </span>
              <button style={{
                ...s.toggleBtn,
                background: w.is_active ? "#FEF2F2" : "#F0FDF4",
                color: w.is_active ? "#991B1B" : "#166534",
              }}
                onClick={() => toggleActive(w.krewby_worker_id, w.is_active)}>
                {w.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  );
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"16px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  addBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 18px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  errorMsg: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginBottom:"16px" },
  formCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"24px", marginBottom:"20px" },
  formTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"16px" },
  fields: { display:"flex", flexDirection:"column", gap:"14px", marginBottom:"20px" },
  fieldRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" },
  field: {},
  label: { display:"block", fontSize:"12px", fontWeight:"600",
    color:"#7A7870", marginBottom:"5px" },
  input: { display:"block", width:"100%", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  saveBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 20px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  search: { display:"block", width:"100%", maxWidth:"360px", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px",
    background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box", marginBottom:"16px" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  tableHead: { display:"grid",
    gridTemplateColumns:"2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"8px" },
  row: { display:"grid",
    gridTemplateColumns:"2fr 2fr 0.8fr 0.6fr 1.5fr 1fr 100px",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"8px", fontSize:"13px" },
  nameCell: { display:"flex", alignItems:"center", gap:"10px" },
  avatar: { width:"30px", height:"30px", borderRadius:"50%", background:"#E5E2DC",
    color:"#55524A", display:"flex", alignItems:"center", justifyContent:"center",
    fontSize:"12px", fontWeight:"700", flexShrink:0 },
  name: { fontWeight:"600", color:"#1C1B18", overflow:"hidden",
    textOverflow:"ellipsis", whiteSpace:"nowrap" },
  cell: { color:"#55524A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  statusBadge: { display:"inline-block", padding:"2px 8px",
    borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  toggleBtn: { padding:"5px 10px", border:"none", borderRadius:"7px",
    fontSize:"12px", fontWeight:"600", cursor:"pointer" },
};