import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";

if (typeof document !== "undefined" && !document.getElementById("sa-skill-kf")) {
  const s = document.createElement("style");
  s.id = "sa-skill-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
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
  const [skills,  setSkills]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    supabase.from("skills").select("skill_id,name,description").order("name")
      .then(({ data }) => { if (!cancelled) { setSkills(data||[]); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <AdminLayout title="Skill Tags">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ marginBottom:"24px" }}>
          <h2 style={{ fontSize:"22px", fontWeight:"800", color:"#0F172A" }}>Skill Tags</h2>
          <p style={{ fontSize:"13px", color:"#64748B", marginTop:"2px" }}>
            {loading ? "Loading…" : `${skills.length} tag${skills.length!==1?"s":""} · used for staff and shift role matching`}
          </p>
        </div>

        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"14px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"20px" }}>
                <Shimmer w="100px" h="22px" r="100px" />
                <div style={{ marginTop:"10px" }}><Shimmer w="80%" h="13px" r="5px" /></div>
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
              return (
                <div key={sk.skill_id}
                  style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"18px", boxShadow:"0 1px 3px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.04}s both` }}>
                  <span style={{ display:"inline-block", padding:"4px 12px", borderRadius:"100px", fontSize:"13px", fontWeight:"700", marginBottom:"10px", ...cs }}>
                    {sk.name}
                  </span>
                  <p style={{ fontSize:"12px", color: sk.description ? "#64748B" : "#CBD5E1", minHeight:"18px" }}>
                    {sk.description || "No description"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
