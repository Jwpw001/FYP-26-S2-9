import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";

if (typeof document !== "undefined" && !document.getElementById("bo-skill-kf")) {
  const s = document.createElement("style");
  s.id = "bo-skill-kf";
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
  let hash = 0;
  for (let i = 0; i < (name?.length || 0); i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const idx = Math.abs(hash) % TAG_BG.length;
  return { background: TAG_BG[idx], color: TAG_TEXT[idx] };
}
function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function BOSkills() {
  const [skills,  setSkills]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");

  useEffect(() => {
    supabase.from("skills").select("skill_id, name, description").order("name")
      .then(({ data }) => { setSkills(data || []); setLoading(false); });
  }, []);

  const filtered = skills.filter(sk =>
    sk.name.toLowerCase().includes(search.toLowerCase()) ||
    (sk.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <BusinessOwnerLayout title="Skill Tags">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Skill Tags</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${skills.length} skill tag${skills.length !== 1 ? "s" : ""} available for staff assignment`}
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "12px", padding: "14px 16px", marginBottom: "22px" }}>
          <span style={{ fontSize: "16px", flexShrink: 0 }}>ℹ️</span>
          <p style={{ fontSize: "13px", color: "#1D4ED8", lineHeight: 1.5 }}>
            Skill tags are managed by the system administrator. You can assign these tags to your staff members from their profile page.
          </p>
        </div>

        {/* Search */}
        <div style={{ position: "relative", maxWidth: "360px", marginBottom: "20px" }}>
          <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skill tags…"
            style={{ width: "100%", padding: "9px 13px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFF", color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
        </div>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "12px" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px" }}>
                <Shimmer w="90px" h="22px" r="100px" />
                <div style={{ marginTop: "8px" }}><Shimmer w="75%" h="12px" r="5px" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center" }}>
            <p style={{ fontSize: "32px", marginBottom: "10px" }}>🏷️</p>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>
              {search ? "No tags match your search" : "No skill tags yet"}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: "12px" }}>
            {filtered.map((sk, i) => {
              const cs = chipStyle(sk.name);
              return (
                <div key={sk.skill_id}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.03}s both` }}>
                  <span style={{ display: "inline-block", padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", marginBottom: "8px", ...cs }}>
                    {sk.name}
                  </span>
                  <p style={{ fontSize: "12px", color: sk.description ? "#64748B" : "#CBD5E1", lineHeight: 1.4 }}>
                    {sk.description || "No description"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}
