import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

export default function KrewbyWorkers() {
  const [workers, setWorkers]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");

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
      </div>

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
    alignItems:"flex-start", marginBottom:"16px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
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
