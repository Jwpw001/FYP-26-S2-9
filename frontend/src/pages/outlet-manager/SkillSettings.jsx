import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { useBusinessContext } from "../../context/BusinessContext";
import { Plus, X, Search, CheckCircle2, Sparkles, PartyPopper } from "lucide-react";

export default function SkillSettings() {
  const { industry, schedulingMode } = useBusinessContext();
  const [skills,      setSkills]      = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [apiIndustry, setApiIndustry] = useState("");
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [newSkill,    setNewSkill]    = useState("");
  const [pendingName, setPendingName] = useState("");
  const [newDesc,     setNewDesc]     = useState("");
  const [adding,      setAdding]      = useState(false);
  const [deleting,    setDeleting]    = useState(null);
  const [error,       setError]       = useState("");
  const [success,     setSuccess]     = useState("");

  const skillLabel = schedulingMode === "flexible" ? "Skills & Competencies"
    : industry === "healthcare" ? "Certifications"
    : industry === "education"  ? "Subjects"
    : industry === "beauty"     ? "Specialisations"
    : "Skill Tags";

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/api/business/skills");
      setSkills(r.skills || []);
      setSuggestions(r.suggestions || []);
      setApiIndustry(r.industry || "");
    } catch { } finally { setLoading(false); }
  }

  async function addSkill(name, description = "") {
    const n = name.trim();
    if (!n) return;
    if (skills.some(s => s.name.toLowerCase() === n.toLowerCase())) { setError(`"${n}" already exists.`); return; }
    setAdding(true); setError("");
    try {
      await api.post("/api/business/skills", { name: n, description: description || "" });
      setNewSkill("");
      setSuccess(`"${n}" added!`);
      setTimeout(() => setSuccess(""), 2500);
      await load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  async function removeSkill(skill_id) {
    setDeleting(skill_id);
    try {
      await api.delete(`/api/business/skills/${skill_id}`);
      setSkills(prev => prev.filter(s => s.skill_id !== skill_id));
    } catch { } finally { setDeleting(null); }
  }

  const filtered = skills.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const industryLabel = apiIndustry === "f&b" ? "F&B" : apiIndustry ? apiIndustry.charAt(0).toUpperCase() + apiIndustry.slice(1) : "";

  return (
    <ManagerLayout title={skillLabel}>
      <div style={{ display:"flex", height:"calc(100vh - 60px)", overflow:"hidden", animation:"pageSlideUp 0.25s ease both" }}>

        {/* ── LEFT: Your Skills ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"28px 32px", overflow:"hidden", borderRight:"1px solid #F1F5F9" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexShrink:0 }}>
            <div>
              <h2 style={{ fontSize:"18px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>{skillLabel}</h2>
              <p style={{ fontSize:"12px", color:"#94A3B8" }}>
                {skills.length} skill{skills.length !== 1 ? "s" : ""} · powers AI scheduling and staff assignment
              </p>
            </div>
            {skills.length > 0 && (
              <span style={{ fontSize:"13px", fontWeight:"800", color:"#3B82F6", background:"#EFF6FF", padding:"4px 12px", borderRadius:"100px" }}>
                {skills.length}
              </span>
            )}
          </div>

          {!pendingName && (
            <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexShrink:0 }}>
              <input
                value={newSkill}
                onChange={e => { setNewSkill(e.target.value); setError(""); }}
                onKeyDown={e => {
                  if (e.key === "Enter" && newSkill.trim()) {
                    if (skills.some(s => s.name.toLowerCase() === newSkill.trim().toLowerCase())) { setError(`"${newSkill.trim()}" already exists.`); return; }
                    setPendingName(newSkill.trim()); setNewSkill(""); setError("");
                  }
                }}
                placeholder="Type a skill name and press Enter…"
                style={{ flex:1, padding:"10px 14px", borderRadius:"10px", border:"1.5px solid #E2E8F0", fontSize:"13px", color:"#1E293B", outline:"none", fontFamily:"inherit", background:"#fff" }}/>
              <button onClick={() => {
                  if (!newSkill.trim()) return;
                  if (skills.some(s => s.name.toLowerCase() === newSkill.trim().toLowerCase())) { setError(`"${newSkill.trim()}" already exists.`); return; }
                  setPendingName(newSkill.trim()); setNewSkill(""); setError("");
                }}
                disabled={!newSkill.trim()}
                style={{ padding:"10px 18px", borderRadius:"10px", border:"none", background: newSkill.trim() ? "#3B82F6" : "#F1F5F9", color: newSkill.trim() ? "#fff" : "#94A3B8", fontSize:"13px", fontWeight:"700", cursor: newSkill.trim() ? "pointer" : "not-allowed", whiteSpace:"nowrap", flexShrink:0 }}>
                Next →
              </button>
            </div>
          )}

          {pendingName && (
            <div style={{ marginBottom:"16px", flexShrink:0, background:"#EFF6FF", border:"1.5px solid #BFDBFE", borderRadius:"12px", padding:"16px", animation:"pageSlideUp 0.2s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", fontWeight:"800", color:"#fff", flexShrink:0 }}>
                  {pendingName[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize:"13px", fontWeight:"700", color:"#1E40AF" }}>{pendingName}</p>
                  <p style={{ fontSize:"11px", color:"#60A5FA" }}>Add a short description (optional)</p>
                </div>
              </div>
              <textarea
                autoFocus value={newDesc} onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); } }}
                placeholder="e.g. Designs user interfaces and experiences for web and mobile products…"
                rows={2}
                style={{ width:"100%", padding:"9px 12px", borderRadius:"9px", border:"1.5px solid #BFDBFE", fontSize:"12px", color:"#1E293B", outline:"none", fontFamily:"inherit", background:"#fff", resize:"none", boxSizing:"border-box", lineHeight:1.5 }}/>
              <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                <button onClick={() => { setPendingName(""); setNewDesc(""); }}
                  style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid #BFDBFE", background:"#fff", fontSize:"12px", fontWeight:"600", color:"#64748B", cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={() => { addSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); }} disabled={adding}
                  style={{ flex:1, padding:"7px 14px", borderRadius:"8px", border:"none", background:"#3B82F6", color:"#fff", fontSize:"12px", fontWeight:"700", cursor:"pointer", boxShadow:"0 2px 8px rgba(59,130,246,0.3)" }}>
                  {adding ? "Saving…" : "Save Skill →"}
                </button>
                <button onClick={() => { addSkill(pendingName, ""); setPendingName(""); setNewDesc(""); }} disabled={adding}
                  style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid #BFDBFE", background:"#fff", fontSize:"12px", fontWeight:"600", color:"#60A5FA", cursor:"pointer" }}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {(error || success) && (
            <p style={{ fontSize:"12px", color: error ? "#DC2626" : "#059669", marginBottom:"12px", flexShrink:0, display:"flex", alignItems:"center", gap:"4px" }}>
              {error || <><CheckCircle2 size={13} color="#059669" /> {success}</>}
            </p>
          )}

          {skills.length > 3 && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"#F8FAFC", borderRadius:"9px", padding:"8px 12px", border:"1px solid #E8EDF5", marginBottom:"14px", flexShrink:0 }}>
              <Search size={13} color="#94A3B8" strokeWidth={2}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
                style={{ border:"none", outline:"none", fontSize:"12px", color:"#1E293B", background:"transparent", flex:1, fontFamily:"inherit" }}/>
              {search && <button onClick={() => setSearch("")} style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", lineHeight:1, padding:"0", display:"flex", alignItems:"center" }}><X size={13} /></button>}
            </div>
          )}

          <div style={{ flex:1, overflowY:"auto" }}>
            {loading ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
                {Array.from({length:6}).map((_,i) => (
                  <div key={i} style={{ height:"100px", borderRadius:"16px", background:"linear-gradient(90deg,#F1F5F9 25%,#E8EDF5 50%,#F1F5F9 75%)", backgroundSize:"400px 100%", animation:"shimmer 1.4s infinite linear" }}/>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"60%", textAlign:"center", gap:"12px" }}>
                <div style={{ width:"52px", height:"52px", borderRadius:"50%", background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {search ? <Search size={22} color="#64748B" /> : <Sparkles size={22} color="#64748B" />}
                </div>
                <div>
                  <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", marginBottom:"4px" }}>
                    {search ? "No skills match" : "No skills added yet"}
                  </p>
                  <p style={{ fontSize:"12px", color:"#94A3B8", lineHeight:1.6 }}>
                    {search ? "Try a different keyword." : "Pick from the suggestions on the right →"}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
                {filtered.map((sk, i) => (
                  <div key={sk.skill_id}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"18px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`pageSlideUp 0.2s ease ${i*0.04}s both`, position:"relative" }}>
                    <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:"#3B82F6", color:"#fff", fontSize:"16px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"12px" }}>
                      {sk.name[0]?.toUpperCase()}
                    </div>
                    <p style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B", marginBottom:"6px", lineHeight:1.3 }}>{sk.name}</p>
                    <p style={{ fontSize:"11px", color:"#64748B", lineHeight:1.5, minHeight:"30px" }}>{sk.description || "—"}</p>
                    <button onClick={() => removeSkill(sk.skill_id)} disabled={deleting === sk.skill_id}
                      style={{ position:"absolute", top:"12px", right:"12px", width:"26px", height:"26px", borderRadius:"7px", border:"none", background:"transparent", color:"#CBD5E1", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s", opacity: deleting === sk.skill_id ? 0.4 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background="#FEE2E2"; e.currentTarget.style.color="#EF4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#CBD5E1"; }}>
                      <X size={12} strokeWidth={2.5}/>
                    </button>
                    <div style={{ marginTop:"12px", paddingTop:"10px", borderTop:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:"5px" }}>
                      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#22C55E", display:"inline-block" }}/>
                      <span style={{ fontSize:"11px", fontWeight:"600", color:"#16A34A" }}>Active</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Suggestions ── */}
        <div style={{ width:"340px", flexShrink:0, display:"flex", flexDirection:"column", background:"#FAFBFE", overflow:"hidden" }}>
          <div style={{ padding:"28px 24px 16px", flexShrink:0, borderBottom:"1px solid #F1F5F9" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"3px" }}>
              <h3 style={{ fontSize:"14px", fontWeight:"700", color:"#1E293B" }}>Suggested Skills</h3>
              {industryLabel && (
                <span style={{ fontSize:"10px", fontWeight:"700", padding:"2px 8px", borderRadius:"100px", background:"#EEF2FF", color:"#4F46E5", border:"1px solid #C7D2FE" }}>
                  {industryLabel}
                </span>
              )}
            </div>
            <p style={{ fontSize:"11px", color:"#94A3B8" }}>Click any skill to add it to your list</p>
          </div>
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {suggestions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 16px" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:"8px" }}><PartyPopper size={22} color="#3B82F6" /></div>
                <p style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", marginBottom:"4px" }}>All suggestions added!</p>
                <p style={{ fontSize:"11px", color:"#94A3B8" }}>You can still type custom skills in the input.</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {suggestions.map((s, i) => (
                  <div key={s.skill_id} onClick={() => addSkill(s.name, s.description)}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", cursor:"pointer", animation:`pageSlideUp 0.2s ease ${i*0.03}s both`, transition:"box-shadow 0.15s, transform 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform="translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform=""; }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                      <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#F1F5F9", color:"#64748B", fontSize:"14px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:"13px", fontWeight:"700", color:"#1E293B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</p>
                        {s.description && <p style={{ fontSize:"11px", color:"#64748B", marginTop:"1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.description}</p>}
                      </div>
                    </div>
                    <div style={{ paddingTop:"10px", borderTop:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:"11px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px", background:"#F1F5F9", color:"#64748B" }}>Suggested</span>
                      <div style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"11px", fontWeight:"600", color:"#3B82F6" }}>
                        <Plus size={11} strokeWidth={2.5} color="#3B82F6"/> Add
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding:"14px 20px", borderTop:"1px solid #F1F5F9", flexShrink:0 }}>
            <p style={{ fontSize:"10px", color:"#CBD5E1", textAlign:"center", lineHeight:1.5 }}>
              Skills are shared across all locations and used by AI to assign the right staff.
            </p>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
