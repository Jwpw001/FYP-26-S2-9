import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-kf")) {
  const s = document.createElement("style");
  s.id = "sa-biz-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .biz-card{transition:box-shadow 0.18s,transform 0.18s}
    .biz-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important}
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

export default function Businesses() {
  const goTo = useGoTo();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showing, setShowing] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [toast,   setToast]   = useState(null);
  const [form,    setForm]    = useState({ name: "", address: "" });

  useEffect(() => {
    let cancelled = false;
    supabase.from("outlets").select("outlet_id,name,address").order("name")
      .then(({ data }) => { if (!cancelled) { setOutlets(data || []); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  async function handleAdd() {
    if (!form.name.trim()) { showToast("Business name is required.", "error"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("outlets")
      .insert({ name: form.name.trim(), address: form.address.trim() || null })
      .select().single();
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setOutlets(prev => [...prev, data].sort((a,b) => a.name.localeCompare(b.name)));
    setForm({ name: "", address: "" });
    setShowing(false);
    showToast("Business registered successfully.");
  }

  return (
    <AdminLayout title="Businesses">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Registered Businesses</h2>
            <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
              {loading ? "Loading…" : `${outlets.length} outlet${outlets.length !== 1 ? "s" : ""} registered`}
            </p>
          </div>
          <button onClick={() => setShowing(s => !s)}
            style={{ padding:"10px 18px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", border:"none", background: showing ? "#F1F5F9" : "#3B82F6", color: showing ? "#64748B" : "#FFF", cursor:"pointer" }}>
            {showing ? "Cancel" : "+ Register Business"}
          </button>
        </div>

        {showing && (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"24px", marginBottom:"24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", animation:"fadeSlideUp 0.3s ease both" }}>
            <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#0F172A", marginBottom:"18px" }}>Register New Business</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px", marginBottom:"18px" }}>
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" }}>Business / Outlet Name *</label>
                <input autoFocus value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} onKeyDown={e => e.key==="Enter" && handleAdd()}
                  placeholder="e.g. The Coffee Club Orchard"
                  style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box" }} />
              </div>
              <div>
                <label style={{ display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" }}>Address</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} onKeyDown={e => e.key==="Enter" && handleAdd()}
                  placeholder="e.g. 176 Orchard Road, Singapore 238843"
                  style={{ width:"100%", padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box" }} />
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding:"10px 22px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", border:"none", background: saving ? "#93C5FD" : "#3B82F6", color:"#FFF", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Saving…" : "Register Business"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"16px" }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"22px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <Shimmer w="140px" h="14px" r="6px" />
                </div>
                <Shimmer w="80%" h="13px" r="5px" />
              </div>
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>🏢</p>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#64748B" }}>No businesses registered yet</p>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:"16px" }}>
              {outlets.map((o, i) => (
                <div key={o.outlet_id} className="biz-card" onClick={() => goTo(`/system-admin/businesses/${o.outlet_id}`)}
                  style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
                    <div style={{ width:"44px", height:"44px", borderRadius:"12px", background:avatarColor(o.name), color:"#FFF", fontSize:"18px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {o.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <p style={{ fontSize:"15px", fontWeight:"700", color:"#0F172A" }}>{o.name}</p>
                  </div>
                  <div style={{ paddingTop:"12px", borderTop:"1px solid #F1F5F9" }}>
                    <p style={{ fontSize:"12px", fontWeight:"600", color:"#94A3B8", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:"3px" }}>Address</p>
                    <p style={{ fontSize:"13px", color: o.address ? "#475569" : "#CBD5E1" }}>{o.address || "Not set"}</p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign:"center", fontSize:"13px", color:"#94A3B8", marginTop:"20px" }}>
              Showing {outlets.length} outlet{outlets.length !== 1 ? "s" : ""}
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
