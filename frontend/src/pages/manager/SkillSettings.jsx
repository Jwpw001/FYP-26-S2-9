import { useState, useEffect } from "react";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { api } from "../../lib/api";
import { Plus, X, Search, CheckCircle2, Sparkles, PartyPopper } from "lucide-react";

export default function SkillSettings() {
  const [branchId,     setBranchId]     = useState(null);
  const [noBranch,     setNoBranch]     = useState(false);
  const [skills,       setSkills]       = useState([]);
  const [suggestions,  setSuggestions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [suggestSearch,setSuggestSearch]= useState("");
  const [newSkill,     setNewSkill]     = useState("");
  const [pendingName,  setPendingName]  = useState("");
  const [newDesc,      setNewDesc]      = useState("");
  const [adding,       setAdding]       = useState(false);
  const [deleting,     setDeleting]     = useState(null);
  const [error,        setError]        = useState("");
  const [success,      setSuccess]      = useState("");

  useEffect(() => {
    // Load global suggestions immediately regardless of branch assignment
    api.get("/api/skills/global")
      .then(r => setSuggestions(r.skills || []))
      .catch(() => {});

    // Then try to find this manager's branch
    api.get("/api/account/branch").then(r => {
      setBranchId(r.branch_id);
      return loadSkills(r.branch_id);
    }).catch(() => {
      setNoBranch(true);
      setLoading(false);
    });
  }, []);

  async function loadSkills(bid) {
    setLoading(true);
    try {
      // Fetch branch skills and global skills independently so one failure doesn't block the other
      const [branchRes, globalRes] = await Promise.allSettled([
        api.get(`/api/business/branches/${bid}/skills`),
        api.get("/api/skills/global"),
      ]);
      const branchSkills = branchRes.status === "fulfilled" ? (branchRes.value.skills || []) : [];
      const globalSkills = globalRes.status === "fulfilled" ? (globalRes.value.skills || []) : [];
      const linkedIds = new Set(branchSkills.map(s => s.skill_id));
      setSkills(branchSkills);
      if (globalSkills.length > 0) setSuggestions(globalSkills.filter(s => !linkedIds.has(s.skill_id)));
    } catch { }
    finally { setLoading(false); }
  }

  // Called when clicking a suggestion — sends existing skill_id as reference
  async function addFromSuggestion(skill_id) {
    if (!branchId) return;
    setAdding(true); setError("");
    try {
      await api.post(`/api/business/branches/${branchId}/skills`, { skill_id });
      await loadSkills(branchId);
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  // Called when typing a custom skill name
  async function addCustomSkill(name, description = "") {
    const n = name.trim();
    if (!n || !branchId) return;
    if (skills.some(s => s.name.toLowerCase() === n.toLowerCase())) {
      setError(`"${n}" already exists.`); return;
    }
    setAdding(true); setError("");
    try {
      await api.post(`/api/business/branches/${branchId}/skills`, { name: n, description: description || "" });
      setNewSkill("");
      setSuccess(`"${n}" added!`);
      setTimeout(() => setSuccess(""), 2500);
      await loadSkills(branchId);
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  async function removeSkill(skill_id) {
    if (!branchId) return;
    setDeleting(skill_id);
    try {
      await api.delete(`/api/business/branches/${branchId}/skills/${skill_id}`);
      await loadSkills(branchId);
    } catch { } finally { setDeleting(null); }
  }

  const filtered = skills.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredSuggestions = suggestions.filter(s => s.name.toLowerCase().includes(suggestSearch.toLowerCase()));

  return (
    <ManagerLayout title="Skill Tags">
      <div style={{ display:"flex", height:"calc(100vh - 60px)", overflow:"hidden", animation:"pageSlideUp 0.25s ease both" }}>

        {/* ── LEFT: Branch Skills ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", padding:"28px 32px", overflow:"hidden", borderRight:"1px solid #F1F5F9" }}>

          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px", flexShrink:0 }}>
            <div>
              <h2 style={{ fontSize:"23px", fontWeight:"800", color:"#0F172A", marginBottom:"2px" }}>Skill Tags</h2>
              <p style={{ fontSize:"19px", color:"#94A3B8" }}>
                {skills.length} skill{skills.length !== 1 ? "s" : ""} · powers AI scheduling and staff assignment
              </p>
            </div>
            {skills.length > 0 && (
              <span style={{ fontSize:"20px", fontWeight:"800", color:"#3B82F6", background:"#EFF6FF", padding:"4px 12px", borderRadius:"100px" }}>
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
                style={{ flex:1, padding:"10px 14px", borderRadius:"10px", border:"1.5px solid #E2E8F0", fontSize:"20px", color:"#1E293B", outline:"none", fontFamily:"inherit", background:"#fff" }}/>
              <button
                onClick={() => {
                  if (!newSkill.trim()) return;
                  if (skills.some(s => s.name.toLowerCase() === newSkill.trim().toLowerCase())) { setError(`"${newSkill.trim()}" already exists.`); return; }
                  setPendingName(newSkill.trim()); setNewSkill(""); setError("");
                }}
                disabled={!newSkill.trim()}
                style={{ padding:"10px 18px", borderRadius:"10px", border:"none", background: newSkill.trim() ? "#3B82F6" : "#F1F5F9", color: newSkill.trim() ? "#fff" : "#94A3B8", fontSize:"20px", fontWeight:"700", cursor: newSkill.trim() ? "pointer" : "not-allowed", whiteSpace:"nowrap", flexShrink:0 }}>
                Next →
              </button>
            </div>
          )}

          {pendingName && (
            <div style={{ marginBottom:"16px", flexShrink:0, background:"#EFF6FF", border:"1.5px solid #BFDBFE", borderRadius:"12px", padding:"16px", animation:"pageSlideUp 0.2s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"#3B82F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px", fontWeight:"800", color:"#fff", flexShrink:0 }}>
                  {pendingName[0]?.toUpperCase()}
                </div>
                <div>
                  <p style={{ fontSize:"20px", fontWeight:"700", color:"#1E40AF" }}>{pendingName}</p>
                  <p style={{ fontSize:"18px", color:"#60A5FA" }}>Add a short description (optional)</p>
                </div>
              </div>
              <textarea
                autoFocus value={newDesc} onChange={e => setNewDesc(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCustomSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); } }}
                placeholder="e.g. Designs user interfaces and experiences for web and mobile products…"
                rows={2}
                style={{ width:"100%", padding:"9px 12px", borderRadius:"9px", border:"1.5px solid #BFDBFE", fontSize:"19px", color:"#1E293B", outline:"none", fontFamily:"inherit", background:"#fff", resize:"none", boxSizing:"border-box", lineHeight:1.5 }}/>
              <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                <button onClick={() => { setPendingName(""); setNewDesc(""); }}
                  style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid #BFDBFE", background:"#fff", fontSize:"19px", fontWeight:"600", color:"#64748B", cursor:"pointer" }}>
                  Cancel
                </button>
                <button onClick={() => { addCustomSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); }} disabled={adding}
                  style={{ flex:1, padding:"7px 14px", borderRadius:"8px", border:"none", background:"#3B82F6", color:"#fff", fontSize:"19px", fontWeight:"700", cursor:"pointer", boxShadow:"0 2px 8px rgba(59,130,246,0.3)" }}>
                  {adding ? "Saving…" : "Save Skill →"}
                </button>
                <button onClick={() => { addCustomSkill(pendingName, ""); setPendingName(""); setNewDesc(""); }} disabled={adding}
                  style={{ padding:"7px 14px", borderRadius:"8px", border:"1px solid #BFDBFE", background:"#fff", fontSize:"19px", fontWeight:"600", color:"#60A5FA", cursor:"pointer" }}>
                  Skip
                </button>
              </div>
            </div>
          )}

          {(error || success) && (
            <p style={{ fontSize:"19px", color: error ? "#DC2626" : "#059669", marginBottom:"12px", flexShrink:0, display:"flex", alignItems:"center", gap:"4px" }}>
              {error || <><CheckCircle2 size={13} color="#059669" /> {success}</>}
            </p>
          )}

          {skills.length > 3 && (
            <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"#F8FAFC", borderRadius:"9px", padding:"8px 12px", border:"1px solid #E8EDF5", marginBottom:"14px", flexShrink:0 }}>
              <Search size={13} color="#94A3B8" strokeWidth={2}/>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skills…"
                style={{ border:"none", outline:"none", fontSize:"19px", color:"#1E293B", background:"transparent", flex:1, fontFamily:"inherit" }}/>
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
                  <p style={{ fontSize:"21px", fontWeight:"700", color:"#1E293B", marginBottom:"4px" }}>
                    {search ? "No skills match" : "No skills added yet"}
                  </p>
                  <p style={{ fontSize:"19px", color:"#94A3B8", lineHeight:1.6 }}>
                    {search ? "Try a different keyword." : "Pick from the suggestions on the right →"}
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))", gap:"12px" }}>
                {filtered.map((sk, i) => (
                  <div key={sk.skill_id}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"18px 16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`pageSlideUp 0.2s ease ${i*0.04}s both`, position:"relative" }}>
                    <div style={{ width:"42px", height:"42px", borderRadius:"50%", background:"#3B82F6", color:"#fff", fontSize:"21px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", marginBottom:"12px" }}>
                      {sk.name[0]?.toUpperCase()}
                    </div>
                    <p style={{ fontSize:"21px", fontWeight:"700", color:"#1E293B", marginBottom:"6px", lineHeight:1.3 }}>{sk.name}</p>
                    <p style={{ fontSize:"18px", color:"#64748B", lineHeight:1.5, minHeight:"30px" }}>{sk.description || "—"}</p>
                    <button onClick={() => removeSkill(sk.skill_id)} disabled={deleting === sk.skill_id}
                      style={{ position:"absolute", top:"12px", right:"12px", width:"26px", height:"26px", borderRadius:"7px", border:"none", background:"transparent", color:"#CBD5E1", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.12s", opacity: deleting === sk.skill_id ? 0.4 : 1 }}
                      onMouseEnter={e => { e.currentTarget.style.background="#FEE2E2"; e.currentTarget.style.color="#EF4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#CBD5E1"; }}>
                      <X size={12} strokeWidth={2.5}/>
                    </button>
                    <div style={{ marginTop:"12px", paddingTop:"10px", borderTop:"1px solid #F1F5F9", display:"flex", alignItems:"center", gap:"5px" }}>
                      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#22C55E", display:"inline-block" }}/>
                      <span style={{ fontSize:"18px", fontWeight:"600", color:"#16A34A" }}>Active</span>
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
            <h3 style={{ fontSize:"21px", fontWeight:"700", color:"#1E293B", marginBottom:"3px" }}>Suggested Skills</h3>
            <p style={{ fontSize:"18px", color:"#94A3B8", marginBottom:"12px" }}>Click any skill to add it to your branch</p>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"#F8FAFC", borderRadius:"9px", padding:"7px 12px", border:"1px solid #E8EDF5" }}>
              <Search size={13} color="#94A3B8" strokeWidth={2}/>
              <input value={suggestSearch} onChange={e => setSuggestSearch(e.target.value)}
                placeholder="Search suggestions…"
                style={{ border:"none", outline:"none", fontSize:"19px", color:"#1E293B", background:"transparent", flex:1, fontFamily:"inherit" }}/>
              {suggestSearch && <button onClick={() => setSuggestSearch("")} style={{ background:"none", border:"none", color:"#94A3B8", cursor:"pointer", fontSize:"22px", lineHeight:1, padding:"0" }}>×</button>}
            </div>
          </div>
          {noBranch && (
            <div style={{ margin:"12px 16px 0", padding:"10px 14px", background:"#FFF7ED", border:"1px solid #FED7AA", borderRadius:"10px" }}>
              <p style={{ fontSize:"18px", fontWeight:"600", color:"#92400E" }}>No branch assigned yet</p>
              <p style={{ fontSize:"18px", color:"#B45309", marginTop:"2px" }}>Ask your business owner to assign you to a branch before you can add skills.</p>
            </div>
          )}
          <div style={{ flex:1, overflowY:"auto", padding:"12px 16px" }}>
            {suggestions.length === 0 && !noBranch ? (
              <div style={{ textAlign:"center", padding:"40px 16px" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:"8px" }}><PartyPopper size={22} color="#3B82F6" /></div>
                <p style={{ fontSize:"20px", fontWeight:"700", color:"#1E293B", marginBottom:"4px" }}>All suggestions added!</p>
                <p style={{ fontSize:"18px", color:"#94A3B8" }}>You can still type custom skills in the input.</p>
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"40px 16px" }}>
                <div style={{ display:"flex", justifyContent:"center", marginBottom:"8px" }}><Search size={22} color="#94A3B8" /></div>
                <p style={{ fontSize:"20px", fontWeight:"700", color:"#1E293B", marginBottom:"4px" }}>No matches</p>
                <p style={{ fontSize:"18px", color:"#94A3B8" }}>Try a different keyword.</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {filteredSuggestions.map((s, i) => (
                  <div key={s.skill_id} onClick={() => !noBranch && addFromSuggestion(s.skill_id)}
                    style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"16px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", cursor: noBranch ? "default" : "pointer", opacity: noBranch ? 0.6 : 1, animation:`pageSlideUp 0.2s ease ${i*0.03}s both`, transition:"box-shadow 0.15s, transform 0.15s" }}
                    onMouseEnter={e => { if (!noBranch) { e.currentTarget.style.boxShadow="0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform="translateY(-1px)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)"; e.currentTarget.style.transform=""; }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
                      <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:"#F1F5F9", color:"#64748B", fontSize:"21px", fontWeight:"700", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                        {s.name[0]?.toUpperCase()}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:"20px", fontWeight:"700", color:"#1E293B", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.name}</p>
                        {s.description && <p style={{ fontSize:"18px", color:"#64748B", marginTop:"1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.description}</p>}
                      </div>
                    </div>
                    <div style={{ paddingTop:"10px", borderTop:"1px solid #F1F5F9", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <span style={{ fontSize:"18px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px", background:"#F1F5F9", color:"#64748B" }}>Suggested</span>
                      <div style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"18px", fontWeight:"600", color:"#3B82F6" }}>
                        <Plus size={11} strokeWidth={2.5} color="#3B82F6"/> Add
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding:"14px 20px", borderTop:"1px solid #F1F5F9", flexShrink:0 }}>
            <p style={{ fontSize:"17px", color:"#CBD5E1", textAlign:"center", lineHeight:1.5 }}>
              Skills are scoped to this branch and used by AI to assign the right staff to tasks.
            </p>
          </div>
        </div>
      </div>
    </ManagerLayout>
  );
}
