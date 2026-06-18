import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("sa-kw-kf")) {
  const s = document.createElement("style");
  s.id = "sa-kw-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .kw-card{transition:box-shadow 0.18s,transform 0.18s}
    .kw-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important}
  `;
  document.head.appendChild(s);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") {
  return AVATAR_COLORS[(name.charCodeAt(0) || 0) % AVATAR_COLORS.length];
}
function Shimmer({ w="100%", h="16px", r="8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}
function Stars({ value }) {
  const n = Number(value || 5);
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:"2px" }}>
      {[1,2,3,4,5].map(i => (
        <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i<=Math.round(n)?"#F59E0B":"none"} stroke={i<=Math.round(n)?"#F59E0B":"#CBD5E1"} strokeWidth="2">
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
        </svg>
      ))}
      <span style={{ fontSize:"11px", color:"#64748B", marginLeft:"3px" }}>{n.toFixed(1)}</span>
    </span>
  );
}

export default function KrewbyWorkers() {
  const goTo = useGoTo();
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: workerRows } = await supabase.from("krewby_workers")
        .select("krewby_worker_id,user_id,preferred_location,rating,total_jobs,is_active").order("krewby_worker_id");
      const userIds = [...new Set((workerRows||[]).map(w => w.user_id))];
      let usersMap = {};
      if (userIds.length) {
        const { data: userRows } = await supabase.from("users").select("user_id,full_name,email").in("user_id", userIds);
        (userRows||[]).forEach(u => { usersMap[u.user_id] = u; });
      }
      if (!cancelled) { setWorkers((workerRows||[]).map(w => ({ ...w, user: usersMap[w.user_id]||null }))); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  async function toggleActive(id, current) {

    const { error } = await supabase.from("krewby_workers").update({ is_active: !current }).eq("krewby_worker_id", id);
    if (error) { showToast(error.message, "error"); return; }
    setWorkers(prev => prev.map(w => w.krewby_worker_id === id ? { ...w, is_active: !current } : w));
    showToast(!current ? "Worker activated." : "Worker deactivated.");
  }

  const activeCount   = workers.filter(w => w.is_active).length;
  const inactiveCount = workers.filter(w => !w.is_active).length;

  const filtered = workers.filter(w => {
    const q = search.toLowerCase();
    const matchSearch = (w.user?.full_name?.toLowerCase()||"").includes(q) || (w.user?.email?.toLowerCase()||"").includes(q);
    const matchFilter = filter==="all" || (filter==="active" && w.is_active) || (filter==="inactive" && !w.is_active);
    return matchSearch && matchFilter;
  });

  const TABS = [
    { value:"all",      label:`All (${workers.length})` },
    { value:"active",   label:`Active (${activeCount})` },
    { value:"inactive", label:`Inactive (${inactiveCount})` },
  ];

  return (
    <AdminLayout title="Krewby Workers">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ marginBottom:"24px" }}>
          <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Krewby Workers</h2>
          <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
            {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${workers.length} total`}
          </p>
        </div>

        {/* Filter tabs */}
        <div style={{ display:"flex", gap:"4px", background:"#F1F5F9", padding:"4px", borderRadius:"10px", marginBottom:"16px", width:"fit-content" }}>
          {TABS.map(t => (
            <button key={t.value} onClick={() => setFilter(t.value)}
              style={{ padding:"7px 16px", background: filter===t.value ? "#FFF" : "transparent", border:"none", borderRadius:"7px", fontSize:"13px", fontWeight: filter===t.value ? "600" : "500", color: filter===t.value ? "#1E293B" : "#64748B", cursor:"pointer", boxShadow: filter===t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition:"all 0.15s", whiteSpace:"nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position:"relative", maxWidth:"360px", marginBottom:"20px" }}>
          <svg style={{ position:"absolute", left:"12px", top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }} width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            style={{ width:"100%", padding:"9px 13px 9px 36px", border:"1.5px solid #E2E8F0", borderRadius:"10px", fontSize:"13px", background:"#FFF", color:"#1E293B", outline:"none", boxSizing:"border-box" }} />
        </div>

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"22px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex:1 }}><Shimmer w="120px" h="14px" r="6px" /><div style={{ marginTop:"6px" }}><Shimmer w="160px" h="12px" r="5px" /></div></div>
                </div>
                <div style={{ display:"flex", gap:"12px", marginBottom:"14px" }}>
                  <Shimmer w="80px" h="13px" r="5px" />
                  <Shimmer w="40px" h="13px" r="5px" />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between" }}>
                  <Shimmer w="60px" h="22px" r="100px" />
                  <Shimmer w="80px" h="28px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>👷</p>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#64748B" }}>No workers found</p>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
              {filtered.map((w, i) => (
                <div key={w.krewby_worker_id} className="kw-card" onClick={() => goTo(`/system-admin/krewby-workers/${w.krewby_worker_id}`)}
                  style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`, cursor:"pointer" }}>

                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                    <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:avatarColor(w.user?.full_name||""), color:"#FFF", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {w.user?.full_name?.[0]?.toUpperCase()||"?"}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:"14px", fontWeight:"700", color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.user?.full_name||"—"}</p>
                      <p style={{ fontSize:"12px", color:"#64748B", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.user?.email||"—"}</p>
                    </div>
                  </div>

                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"10px", marginBottom:"16px" }}>
                    <div><p style={{ fontSize:"11px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em" }}>Jobs</p><p style={{ fontSize:"16px", fontWeight:"800", color:"#1E293B" }}>{w.total_jobs||0}</p></div>
                    <div><p style={{ fontSize:"11px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em" }}>Rating</p><Stars value={w.rating} /></div>
                    <div><p style={{ fontSize:"11px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em" }}>Area</p><p style={{ fontSize:"12px", color:"#475569", fontWeight:"500", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{w.preferred_location||"—"}</p></div>
                  </div>

                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", paddingTop:"12px", borderTop:"1px solid #F1F5F9" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"13px", fontWeight:"600", color: w.is_active ? "#16A34A" : "#94A3B8" }}>
                      <span style={{ width:"7px", height:"7px", borderRadius:"50%", background: w.is_active ? "#22C55E" : "#D1D5DB", display:"inline-block" }} />
                      {w.is_active ? "Active" : "Inactive"}
                    </span>
                    <button onClick={() => toggleActive(w.krewby_worker_id, w.is_active)}
                      style={{ padding:"5px 12px", borderRadius:"8px", fontSize:"12px", fontWeight:"600", border: w.is_active ? "1.5px solid #FECACA" : "1.5px solid #BBF7D0", background: w.is_active ? "#FEF2F2" : "#F0FDF4", color: w.is_active ? "#991B1B" : "#166534", cursor:"pointer" }}>
                      {w.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign:"center", fontSize:"13px", color:"#94A3B8", marginTop:"20px" }}>
              Showing {filtered.length} of {workers.length} workers
            </p>
          </>
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
