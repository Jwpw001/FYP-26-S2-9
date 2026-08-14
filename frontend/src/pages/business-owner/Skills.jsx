import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { api } from "../../lib/api";
import { Tag, Search, Building2, Layers, Sparkles, Pencil, X, Plus, CheckCircle2 } from "lucide-react";

const CHIP_PALETTES = [
  { bg: "#EFF6FF", border: "#BFDBFE", dot: "#3B82F6", text: "#1D4ED8" },
  { bg: "#F0FDF4", border: "#BBF7D0", dot: "#22C55E", text: "#15803D" },
  { bg: "#FDF4FF", border: "#E9D5FF", dot: "#A855F7", text: "#7E22CE" },
  { bg: "#FFF7ED", border: "#FED7AA", dot: "#F97316", text: "#C2410C" },
  { bg: "#FFF1F2", border: "#FECDD3", dot: "#F43F5E", text: "#BE123C" },
  { bg: "#F0FDFA", border: "#99F6E4", dot: "#14B8A6", text: "#0F766E" },
];
function chipPalette(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CHIP_PALETTES[Math.abs(h) % CHIP_PALETTES.length];
}

function StatCard({ icon, label, value, sub }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: "150px" }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A", lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: "19px", fontWeight: "600", color: "#64748B", marginTop: "2px" }}>{label}</p>
        {sub && <p style={{ fontSize: "18px", color: "#94A3B8", marginTop: "1px" }}>{sub}</p>}
      </div>
    </div>
  );
}

function BranchCard({ branch, q, onEdit }) {
  const [open, setOpen] = useState(true);
  const skills = branch.skills;
  const visibleSkills = q
    ? skills.filter(s => s.name.toLowerCase().includes(q))
    : skills;

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", borderBottom: open ? "1px solid #F1F5F9" : "none" }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Building2 size={17} color="#3B82F6" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: "21px", fontWeight: "800", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{branch.name}</p>
            <p style={{ fontSize: "18px", color: "#94A3B8", marginTop: "1px" }}>
              {skills.length} skill{skills.length !== 1 ? "s" : ""} assigned
            </p>
          </div>
        </button>
        <button
          onClick={() => onEdit(branch)}
          style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "18px", fontWeight: "700", color: "#3B82F6", background: "#EFF6FF", border: "1px solid #BFDBFE", padding: "5px 12px", borderRadius: "100px", flexShrink: 0, cursor: "pointer" }}>
          <Pencil size={11} strokeWidth={2.5} /> Edit
        </button>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ fontSize: "18px", fontWeight: "700", color: skills.length > 0 ? "#3B82F6" : "#94A3B8", background: skills.length > 0 ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${skills.length > 0 ? "#BFDBFE" : "#E2E8F0"}`, padding: "5px 12px", borderRadius: "100px", flexShrink: 0, cursor: "pointer" }}>
          {open ? "Hide" : "Show"}
        </button>
      </div>

      {/* Skills */}
      {open && (
        <div style={{ padding: "16px 20px 20px" }}>
          {visibleSkills.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: "8px" }}>
              <Tag size={20} color="#CBD5E1" />
              <p style={{ fontSize: "19px", color: "#CBD5E1", fontStyle: "italic" }}>
                {q ? "No matching skills." : "No skills assigned yet."}
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {visibleSkills.map(skill => {
                const p = chipPalette(skill.name);
                return (
                  <div key={skill.skill_id}
                    title={skill.description || undefined}
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 13px", borderRadius: "100px", background: p.bg, border: `1px solid ${p.border}`, fontSize: "19px", fontWeight: "700", color: p.text, cursor: skill.description ? "help" : "default" }}>
                    <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: p.dot, display: "inline-block", flexShrink: 0 }} />
                    {skill.name}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// P3, Category B: the "outlet" key/label pair here is the retail-industry type (same three
// values as the backend's INDUSTRY_BUCKETS), not the pre-rename Outlet-Manager actor name. The
// displayed label "Outlet" is UI copy — left unchanged; renaming it to "Retail" is a product
// decision, not a stale-reference cleanup, so it isn't done here.
const INDUSTRY_META = {
  fnb:    { label: "F&B",    emoji: "🍽️" },
  clinic: { label: "Clinic", emoji: "🩺" },
  outlet: { label: "Outlet", emoji: "🛍️" },
};

function EditSkillsModal({ branch, onClose }) {
  const [skills, setSkills]           = useState([]);
  const [industry, setIndustryState]  = useState(null);
  const [buckets, setBuckets]         = useState([]);
  const [reuse, setReuse]             = useState([]);
  const [catalog, setCatalog]         = useState([]);
  const [savingIndustry, setSavingIndustry] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [newSkill, setNewSkill]       = useState("");
  const [pendingName, setPendingName] = useState("");
  const [newDesc, setNewDesc]         = useState("");
  const [adding, setAdding]           = useState(false);
  const [deleting, setDeleting]       = useState(null);
  const [editingSkill, setEditingSkill] = useState(null); // skill_id being edited
  const [editName, setEditName]       = useState("");
  const [editDesc, setEditDesc]       = useState("");
  const [savingEdit, setSavingEdit]   = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");
  const [changed, setChanged]         = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [branchRes, suggRes] = await Promise.allSettled([
        api.get(`/api/business/branches/${branch.branch_id}/skills`),
        api.get(`/api/business/branches/${branch.branch_id}/skill-suggestions`),
      ]);
      setSkills(branchRes.status === "fulfilled" ? (branchRes.value.skills || []) : []);
      if (suggRes.status === "fulfilled") {
        setIndustryState(suggRes.value.industry || null);
        setBuckets(suggRes.value.buckets || []);
        setReuse(suggRes.value.reuse || []);
        setCatalog(suggRes.value.catalog || []);
      }
    } catch { }
    finally { setLoading(false); }
  }

  async function chooseIndustry(key) {
    setSavingIndustry(true); setError("");
    try {
      await api.put(`/api/business/branches/${branch.branch_id}/settings`, { industry: key });
      await load();
    } catch (err) { setError(err.message); }
    finally { setSavingIndustry(false); }
  }

  async function addFromSuggestion(skill_id) {
    setAdding(true); setError("");
    try {
      await api.post(`/api/business/branches/${branch.branch_id}/skills`, { skill_id });
      setChanged(true);
      await load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  function startEdit(sk) {
    setEditingSkill(sk.skill_id); setEditName(sk.name); setEditDesc(sk.description || ""); setError("");
  }

  async function saveEdit() {
    const n = editName.trim();
    if (!n) return;
    setSavingEdit(true); setError("");
    try {
      await api.patch(`/api/business/branches/${branch.branch_id}/skills/${editingSkill}`, { name: n, description: editDesc });
      setEditingSkill(null);
      setChanged(true);
      await load();
    } catch (err) { setError(err.message); }
    finally { setSavingEdit(false); }
  }

  async function addCustomSkill(name, description = "") {
    const n = name.trim();
    if (!n) return;
    if (skills.some(s => s.name.toLowerCase() === n.toLowerCase())) {
      setError(`"${n}" already exists.`); return;
    }
    setAdding(true); setError("");
    try {
      await api.post(`/api/business/branches/${branch.branch_id}/skills`, { name: n, description: description || "" });
      setNewSkill("");
      setSuccess(`"${n}" added!`);
      setChanged(true);
      setTimeout(() => setSuccess(""), 2500);
      await load();
    } catch (err) { setError(err.message); }
    finally { setAdding(false); }
  }

  async function removeSkill(skill_id) {
    setDeleting(skill_id);
    try {
      await api.delete(`/api/business/branches/${branch.branch_id}/skills/${skill_id}`);
      setChanged(true);
      await load();
    } catch { } finally { setDeleting(null); }
  }

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", backdropFilter: "blur(2px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(changed); }}>
      <div style={{ background: "#FFF", borderRadius: "20px", width: "100%", maxWidth: "820px", maxHeight: "88vh", display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.25)", overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #F1F5F9", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Tag size={17} color="#2563EB" />
            </div>
            <div>
              <h3 style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B" }}>Edit Skill Tags</h3>
              <p style={{ fontSize: "19px", color: "#94A3B8" }}>{branch.name}</p>
            </div>
          </div>
          <button onClick={() => onClose(changed)} style={{ width: "32px", height: "32px", borderRadius: "8px", border: "1px solid #E2E8F0", background: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#64748B" }}>
            <X size={16} />
          </button>
        </div>

        <div className="responsive-stack-2col" style={{ display: "grid", gridTemplateColumns: "1fr 300px", overflow: "hidden", flex: 1, minHeight: 0 }}>
          {/* Left: current skills for this branch */}
          <div style={{ overflowY: "auto", padding: "22px 24px", borderRight: "1px solid #F1F5F9", display: "flex", flexDirection: "column" }}>
            {!pendingName && (
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexShrink: 0 }}>
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
                  style={{ flex: 1, padding: "9px 13px", borderRadius: "9px", border: "1.5px solid #E2E8F0", fontSize: "20px", color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#fff" }} />
                <button
                  onClick={() => {
                    if (!newSkill.trim()) return;
                    if (skills.some(s => s.name.toLowerCase() === newSkill.trim().toLowerCase())) { setError(`"${newSkill.trim()}" already exists.`); return; }
                    setPendingName(newSkill.trim()); setNewSkill(""); setError("");
                  }}
                  disabled={!newSkill.trim()}
                  style={{ padding: "9px 16px", borderRadius: "9px", border: "none", background: newSkill.trim() ? "#3B82F6" : "#F1F5F9", color: newSkill.trim() ? "#fff" : "#94A3B8", fontSize: "20px", fontWeight: "700", cursor: newSkill.trim() ? "pointer" : "not-allowed", whiteSpace: "nowrap", flexShrink: 0 }}>
                  Next →
                </button>
              </div>
            )}

            {pendingName && (
              <div style={{ marginBottom: "14px", flexShrink: 0, background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: "12px", padding: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "19px", fontWeight: "800", color: "#fff", flexShrink: 0 }}>
                    {pendingName[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: "20px", fontWeight: "700", color: "#1E40AF" }}>{pendingName}</p>
                    <p style={{ fontSize: "18px", color: "#60A5FA" }}>Add a short description (optional)</p>
                  </div>
                </div>
                <textarea
                  autoFocus value={newDesc} onChange={e => setNewDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCustomSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); } }}
                  placeholder="e.g. Prepares espresso-based drinks to standard…"
                  rows={2}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "9px", border: "1.5px solid #BFDBFE", fontSize: "19px", color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#fff", resize: "none", boxSizing: "border-box", lineHeight: 1.5 }} />
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button onClick={() => { setPendingName(""); setNewDesc(""); }}
                    style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #BFDBFE", background: "#fff", fontSize: "19px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={() => { addCustomSkill(pendingName, newDesc); setPendingName(""); setNewDesc(""); }} disabled={adding}
                    style={{ flex: 1, padding: "7px 14px", borderRadius: "8px", border: "none", background: "#3B82F6", color: "#fff", fontSize: "19px", fontWeight: "700", cursor: "pointer" }}>
                    {adding ? "Saving…" : "Save Skill →"}
                  </button>
                  <button onClick={() => { addCustomSkill(pendingName, ""); setPendingName(""); setNewDesc(""); }} disabled={adding}
                    style={{ padding: "7px 14px", borderRadius: "8px", border: "1px solid #BFDBFE", background: "#fff", fontSize: "19px", fontWeight: "600", color: "#60A5FA", cursor: "pointer" }}>
                    Skip
                  </button>
                </div>
              </div>
            )}

            {(error || success) && (
              <p style={{ fontSize: "19px", color: error ? "#DC2626" : "#059669", marginBottom: "12px", flexShrink: 0, display: "flex", alignItems: "center", gap: "4px" }}>
                {error || <><CheckCircle2 size={13} color="#059669" /> {success}</>}
              </p>
            )}

            <div style={{ flex: 1 }}>
              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "10px" }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ height: "90px", borderRadius: "14px", background: "linear-gradient(90deg,#F1F5F9 25%,#E8EDF5 50%,#F1F5F9 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.4s infinite linear" }} />
                  ))}
                </div>
              ) : skills.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: "8px", textAlign: "center" }}>
                  <Sparkles size={20} color="#CBD5E1" />
                  <p style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B" }}>No skills added yet</p>
                  <p style={{ fontSize: "19px", color: "#94A3B8" }}>Pick from the suggestions on the right, or type a custom one above.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: "10px" }}>
                  {skills.map(sk => editingSkill === sk.skill_id ? (
                    <div key={sk.skill_id}
                      style={{ background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: "14px", padding: "12px", gridColumn: "1 / -1" }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Skill name"
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1.5px solid #BFDBFE", fontSize: "19px", color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#fff", boxSizing: "border-box", marginBottom: "6px" }} />
                      <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Description (optional)" rows={2}
                        style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1.5px solid #BFDBFE", fontSize: "18px", color: "#1E293B", outline: "none", fontFamily: "inherit", background: "#fff", resize: "none", boxSizing: "border-box", lineHeight: 1.5, marginBottom: "8px" }} />
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => setEditingSkill(null)}
                          style={{ padding: "6px 14px", borderRadius: "8px", border: "1px solid #BFDBFE", background: "#fff", fontSize: "18px", fontWeight: "600", color: "#64748B", cursor: "pointer" }}>
                          Cancel
                        </button>
                        <button onClick={saveEdit} disabled={savingEdit || !editName.trim()}
                          style={{ flex: 1, padding: "6px 14px", borderRadius: "8px", border: "none", background: "#3B82F6", color: "#fff", fontSize: "18px", fontWeight: "700", cursor: "pointer", opacity: savingEdit || !editName.trim() ? 0.6 : 1 }}>
                          {savingEdit ? "Saving…" : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={sk.skill_id}
                      style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", position: "relative" }}>
                      <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#3B82F6", color: "#fff", fontSize: "20px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                        {sk.name[0]?.toUpperCase()}
                      </div>
                      <p style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B", marginBottom: "4px", lineHeight: 1.3, paddingRight: "36px" }}>{sk.name}</p>
                      <p style={{ fontSize: "18px", color: "#64748B", lineHeight: 1.5, minHeight: "26px" }}>{sk.description || "—"}</p>
                      <div style={{ position: "absolute", top: "10px", right: "10px", display: "flex", gap: "2px" }}>
                        <button onClick={() => startEdit(sk)}
                          style={{ width: "22px", height: "22px", borderRadius: "6px", border: "none", background: "transparent", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#EFF6FF"; e.currentTarget.style.color = "#3B82F6"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#CBD5E1"; }}>
                          <Pencil size={11} strokeWidth={2.5} />
                        </button>
                        <button onClick={() => removeSkill(sk.skill_id)} disabled={deleting === sk.skill_id}
                          style={{ width: "22px", height: "22px", borderRadius: "6px", border: "none", background: "transparent", color: "#CBD5E1", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: deleting === sk.skill_id ? 0.4 : 1 }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#FEE2E2"; e.currentTarget.style.color = "#EF4444"; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#CBD5E1"; }}>
                          <X size={12} strokeWidth={2.5} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: suggestions */}
          <div style={{ display: "flex", flexDirection: "column", background: "#FAFBFE", overflow: "hidden" }}>
            <div style={{ padding: "20px 18px 12px", flexShrink: 0, borderBottom: "1px solid #F1F5F9" }}>
              <h4 style={{ fontSize: "20px", fontWeight: "700", color: "#1E293B", marginBottom: "3px" }}>Suggested Skills</h4>
              <p style={{ fontSize: "18px", color: "#94A3B8" }}>Click to add to this branch</p>
            </div>

            {/* Industry picker — reused for role-tag suggestions, and to switch buckets later */}
            <div style={{ padding: "12px 14px 0", flexShrink: 0 }}>
              <p style={{ fontSize: "17px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>
                {industry ? "Branch type" : "What kind of branch is this?"}
              </p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {buckets.map(b => {
                  const meta = INDUSTRY_META[b.key] || { label: b.label, emoji: "🏷️" };
                  const isActive = industry === b.key;
                  return (
                    <button key={b.key} type="button" onClick={() => !isActive && chooseIndustry(b.key)} disabled={savingIndustry}
                      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "100px", border: `1.5px solid ${isActive ? "#3B82F6" : "#E2E8F0"}`, background: isActive ? "#EFF6FF" : "#fff", color: isActive ? "#1D4ED8" : "#475569", fontSize: "18px", fontWeight: "700", cursor: isActive ? "default" : "pointer", opacity: savingIndustry ? 0.6 : 1 }}>
                      <span>{meta.emoji}</span> {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 12px" }}>
              {reuse.length === 0 && catalog.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 12px" }}>
                  <p style={{ fontSize: "19px", color: "#94A3B8" }}>
                    {industry ? "No more suggestions for this branch type — try another one above, or type a custom skill." : "Pick a branch type above for role-tag suggestions, or type a custom skill."}
                  </p>
                </div>
              ) : (
                <>
                  {reuse.length > 0 && (
                    <div style={{ marginBottom: catalog.length > 0 ? "18px" : 0 }}>
                      <p style={{ fontSize: "17px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        From your other branches
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {reuse.map(s => (
                          <div key={s.skill_id} onClick={() => addFromSuggestion(s.skill_id)}
                            style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#F1F5F9", color: "#64748B", fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {s.name[0]?.toUpperCase()}
                              </div>
                              <p style={{ fontSize: "19px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", fontSize: "18px", fontWeight: "600", color: "#3B82F6" }}>
                              <Plus size={11} strokeWidth={2.5} color="#3B82F6" /> Add
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {catalog.length > 0 && (
                    <div>
                      <p style={{ fontSize: "17px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        Suggested for {(INDUSTRY_META[industry] || {}).label || industry}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {catalog.map(s => (
                          <div key={s.skill_id} onClick={() => addFromSuggestion(s.skill_id)}
                            style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "8px" }}>
                              <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: "#F1F5F9", color: "#64748B", fontSize: "19px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                {s.name[0]?.toUpperCase()}
                              </div>
                              <p style={{ fontSize: "19px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</p>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", fontSize: "18px", fontWeight: "600", color: "#3B82F6" }}>
                              <Plus size={11} strokeWidth={2.5} color="#3B82F6" /> Add
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function BOSkills() {
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [editingBranch, setEditingBranch] = useState(null);

  useEffect(() => { loadBranches(); }, []);

  function loadBranches() {
    return api.get("/api/business/branch-skills-summary")
      .then(r => setBranches(r.branches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  function closeEditModal(didChange) {
    setEditingBranch(null);
    if (didChange) loadBranches();
  }

  const q = search.toLowerCase();
  const filtered = branches
    .map(b => ({ ...b, skills: b.skills.filter(s => !q || s.name.toLowerCase().includes(q)) }))
    .filter(b => !q || b.name.toLowerCase().includes(q) || b.skills.length > 0);

  const totalSkills = branches.reduce((sum, b) => sum + b.skills.length, 0);
  const uniqueNames = new Set(branches.flatMap(b => b.skills.map(s => s.name))).size;

  return (
    <BusinessOwnerLayout title="Skill Tags">
      <div style={{ animation: "pageIn 0.3s ease both" }}>

        {/* Page header */}
        <div style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#0F172A" }}>Skill Tags</h2>
          <p style={{ fontSize: "20px", color: "#64748B", marginTop: "3px" }}>
            Skills assigned to each branch across your business
          </p>
        </div>

        {/* Stat cards */}
        {!loading && (
          <div style={{ display: "flex", gap: "14px", marginBottom: "28px", flexWrap: "wrap" }}>
            <StatCard
              icon={<Building2 size={20} color="#3B82F6" />}
              label="Branches"
              value={branches.length}
              sub="with skill assignments"
            />
            <StatCard
              icon={<Layers size={20} color="#8B5CF6" />}
              label="Total Assignments"
              value={totalSkills}
              sub="across all branches"
            />
            <StatCard
              icon={<Sparkles size={20} color="#F59E0B" />}
              label="Unique Skills"
              value={uniqueNames}
              sub="distinct skill types"
            />
          </div>
        )}

        {/* Search */}
        {!loading && branches.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "9px", background: "#F8FAFC", borderRadius: "11px", padding: "10px 15px", border: "1.5px solid #E2E8F0", marginBottom: "20px", maxWidth: "400px" }}>
            <Search size={14} color="#94A3B8" strokeWidth={2} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search branches or skills…"
              style={{ border: "none", outline: "none", fontSize: "20px", color: "#1E293B", background: "transparent", flex: 1, fontFamily: "inherit" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "22px", lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "14px" }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: "140px", borderRadius: "16px", background: "linear-gradient(90deg,#F1F5F9 25%,#E8EDF5 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "80px 40px", textAlign: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <Tag size={24} color="#CBD5E1" />
            </div>
            <p style={{ fontSize: "22px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {search ? "No results found" : "No skill data yet"}
            </p>
            <p style={{ fontSize: "20px", color: "#94A3B8", maxWidth: "320px", margin: "0 auto", lineHeight: 1.6 }}>
              {search
                ? "Try a different keyword or clear the search."
                : "Skills will appear here once they're assigned to your branches via the Branches settings."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px" }}>
            {filtered.map(branch => (
              <BranchCard key={branch.branch_id} branch={branch} q={q} onEdit={setEditingBranch} />
            ))}
          </div>
        )}
      </div>

      {editingBranch && <EditSkillsModal branch={editingBranch} onClose={closeEditModal} />}
    </BusinessOwnerLayout>
  );
}
