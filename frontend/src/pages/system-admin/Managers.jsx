import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";

if (typeof document !== "undefined" && !document.getElementById("sa-mgr-kf")) {
  const s = document.createElement("style");
  s.id = "sa-mgr-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    .mgr-card{transition:box-shadow 0.18s,transform 0.18s}
    .mgr-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important}
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

export default function Managers() {
  const goTo = useGoTo();
  const [managers, setManagers] = useState([]);
  const [outlets,  setOutlets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showing,  setShowing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState(null);
  const [form,     setForm]     = useState({ full_name:"", email:"", username:"", password:"", outlet_id:"" });
  const [showPass, setShowPass] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("users").select("user_id,full_name,email,role").eq("role","outlet_manager").order("full_name"),
      supabase.from("outlets").select("outlet_id,name").order("name"),
    ]).then(([{ data: mgrs }, { data: outs }]) => {
      if (!cancelled) { setManagers(mgrs || []); setOutlets(outs || []); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, []);

  function showToast(msg, type="success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); }

  async function handleAdd() {
    if (!form.full_name.trim()) { showToast("Full name is required.", "error"); return; }
    if (!form.email.trim())     { showToast("Email is required.", "error"); return; }
    if (!form.username.trim())  { showToast("Username is required.", "error"); return; }
    if (!form.password.trim())  { showToast("Password is required.", "error"); return; }
    if (form.password.length < 6) { showToast("Password must be at least 6 characters.", "error"); return; }
    setSaving(true);
    try {
      const res = await api.post("/api/auth/create-manager", {
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        username: form.username.trim().toLowerCase(),
        password: form.password,
        outlet_id: form.outlet_id || null,
      });
      setManagers(prev => [...prev, res.user].sort((a,b) => a.full_name.localeCompare(b.full_name)));
      setForm({ full_name:"", email:"", username:"", password:"", outlet_id:"" });
      setShowing(false);
      showToast("Manager account created successfully.");
    } catch (err) {
      showToast(err.message || "Failed to create account.", "error");
    } finally { setSaving(false); }
  }

  return (
    <AdminLayout title="Outlet Managers">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Outlet Managers</h2>
            <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
              {loading ? "Loading…" : `${managers.length} manager${managers.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button onClick={() => setShowing(s => !s)}
            style={{ padding:"10px 18px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", border:"none", background: showing ? "#F1F5F9" : "#3B82F6", color: showing ? "#64748B" : "#FFF", cursor:"pointer" }}>
            {showing ? "Cancel" : "+ Add Manager"}
          </button>
        </div>

        {showing && (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"24px", marginBottom:"24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", animation:"fadeSlideUp 0.3s ease both" }}>
            <h3 style={{ fontSize:"15px", fontWeight:"700", color:"#0F172A", marginBottom:"18px" }}>Create Manager Account</h3>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px", marginBottom:"18px" }}>
              <div>
                <label style={fl}>Full Name *</label>
                <input autoFocus value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                  placeholder="e.g. Sarah Tan" style={fi} />
              </div>
              <div>
                <label style={fl}>Email *</label>
                <input type="email" autoComplete="off" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. sarah@krewby.com" style={fi} />
              </div>
              <div>
                <label style={fl}>Username *</label>
                <input autoComplete="off" value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="e.g. sarah.tan" style={fi} />
              </div>
              <div>
                <label style={fl}>Password *</label>
                <div style={{ position:"relative" }}>
                  <input type={showPass ? "text" : "password"} autoComplete="new-password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 6 characters" style={{ ...fi, paddingRight:"44px" }} />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position:"absolute", right:"12px", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#64748B", fontSize:"12px", fontWeight:"600" }}>
                    {showPass ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div style={{ gridColumn:"1 / -1" }}>
                <label style={fl}>Assign to Outlet (optional)</label>
                <select value={form.outlet_id} onChange={e => setForm(p => ({ ...p, outlet_id: e.target.value }))}
                  style={{ ...fi, background:"#FFF" }}>
                  <option value="">Select outlet</option>
                  {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
                </select>
              </div>
            </div>
            <button onClick={handleAdd} disabled={saving}
              style={{ padding:"10px 22px", borderRadius:"10px", fontSize:"14px", fontWeight:"600", border:"none", background: saving ? "#93C5FD" : "#3B82F6", color:"#FFF", cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "Creating…" : "Create Account"}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"22px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex:1 }}><Shimmer w="120px" h="14px" r="6px" /><div style={{ marginTop:"6px" }}><Shimmer w="160px" h="12px" r="5px" /></div></div>
                </div>
                <Shimmer w="70px" h="22px" r="100px" />
              </div>
            ))}
          </div>
        ) : managers.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"32px", marginBottom:"10px" }}>👤</p>
            <p style={{ fontSize:"16px", fontWeight:"600", color:"#64748B" }}>No managers yet</p>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
              {managers.map((m, i) => (
                <div key={m.user_id} className="mgr-card" onClick={() => goTo(`/system-admin/managers/${m.user_id}`)}
                  style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"20px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.05}s both`, cursor:"pointer" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"16px" }}>
                    <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:avatarColor(m.full_name), color:"#FFF", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                      {m.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:"14px", fontWeight:"700", color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.full_name}</p>
                      <p style={{ fontSize:"12px", color:"#64748B", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.email}</p>
                    </div>
                  </div>
                  <div style={{ paddingTop:"12px", borderTop:"1px solid #F1F5F9" }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:"6px", fontSize:"13px", fontWeight:"600", color:"#16A34A" }}>
                      <span style={{ width:"7px", height:"7px", borderRadius:"50%", background:"#22C55E", display:"inline-block" }} />
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ textAlign:"center", fontSize:"13px", color:"#94A3B8", marginTop:"20px" }}>
              Showing {managers.length} manager{managers.length !== 1 ? "s" : ""}
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

const fl = { display:"block", fontSize:"12px", fontWeight:"600", color:"#64748B", marginBottom:"6px" };
const fi = { width:"100%", padding:"10px 14px", border:"1.5px solid #E2E8F0", borderRadius:"10px", fontSize:"14px", outline:"none", boxSizing:"border-box" };
