import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";

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
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.from("users").select("user_id,full_name,email,role").eq("role","outlet_manager").order("full_name")
      .then(({ data: mgrs }) => {
        if (!cancelled) { setManagers(mgrs || []); setLoading(false); }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminLayout title="Outlet Managers">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ marginBottom:"24px" }}>
          <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Outlet Managers</h2>
          <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
            {loading ? "Loading…" : `${managers.length} manager${managers.length !== 1 ? "s" : ""}`}
          </p>
        </div>

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

    </AdminLayout>
  );
}
