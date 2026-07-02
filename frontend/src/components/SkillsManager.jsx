import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Plus, X, Edit2, Check, Palette } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sm-styles")) {
  const s = document.createElement("style");
  s.id = "sm-styles";
  s.textContent = `
    .sm-tag { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:99px; font-size:12px; font-weight:700; cursor:default; transition:opacity 0.15s; }
    .sm-tag.clickable { cursor:pointer; }
    .sm-tag.clickable:hover { opacity:0.75; }
    .sm-chip-del { background:none; border:none; cursor:pointer; padding:0; display:flex; align-items:center; opacity:0.6; }
    .sm-chip-del:hover { opacity:1; }
  `;
  document.head.appendChild(s);
}

const PALETTE = ["#6366F1","#8B5CF6","#EC4899","#EF4444","#F59E0B","#10B981","#3B82F6","#14B8A6","#F97316","#84CC16"];
const LEVELS  = ["junior","intermediate","senior","lead"];
const LEVEL_META = {
  junior:       { label:"Junior",       bg:"#DBEAFE", color:"#1D4ED8" },
  intermediate: { label:"Intermediate", bg:"#FEF3C7", color:"#92400E" },
  senior:       { label:"Senior",       bg:"#DCFCE7", color:"#166534" },
  lead:         { label:"Lead",         bg:"#EDE9FE", color:"#5B21B6" },
};

// ── Skill tag pill ────────────────────────────────────────────────────────────
export function SkillTag({ skill, onRemove }) {
  const bg  = skill.color + "22";
  const col = skill.color;
  return (
    <span className="sm-tag" style={{ background: bg, color: col, border: `1.5px solid ${col}33` }}>
      {skill.name}
      {onRemove && (
        <button className="sm-chip-del" onClick={() => onRemove(skill.skill_id)} title="Remove">
          <X size={10} color={col} />
        </button>
      )}
    </span>
  );
}

// ── Business skill library manager (BO / Manager settings) ───────────────────
export function SkillLibrary({ compact = false }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PALETTE[0]);
  const [editing, setEditing] = useState(null); // { skill_id, name, color }
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get("/api/skills/business");
      setSkills(r.skills || []);
    } catch { } finally { setLoading(false); }
  }

  async function handleAdd() {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      const r = await api.post("/api/skills/business", { name: newName.trim(), color: newColor });
      setSkills(prev => [...prev, r.skill].sort((a,b) => a.name.localeCompare(b.name)));
      setNewName(""); setAdding(false);
    } catch { } finally { setSaving(false); }
  }

  async function handleUpdate() {
    if (!editing?.name.trim()) return;
    setSaving(true);
    try {
      const r = await api.patch(`/api/skills/business/${editing.skill_id}`, { name: editing.name, color: editing.color });
      setSkills(prev => prev.map(s => s.skill_id === editing.skill_id ? r.skill : s));
      setEditing(null);
    } catch { } finally { setSaving(false); }
  }

  async function handleDelete(skill_id) {
    if (!confirm("Delete this skill? It will be removed from all staff.")) return;
    try {
      await api.delete(`/api/skills/business/${skill_id}`);
      setSkills(prev => prev.filter(s => s.skill_id !== skill_id));
    } catch { }
  }

  const INP = { padding:"7px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", outline:"none", fontFamily:"inherit", color:"#1E293B", background:"#fff" };

  return (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding: compact ? "16px" : "20px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
        <div>
          <p style={{ fontSize:"14px", fontWeight:"800", color:"#1E293B", margin:0 }}>Skill Library</p>
          <p style={{ fontSize:"12px", color:"#94A3B8", margin:"2px 0 0" }}>{skills.length} skill{skills.length !== 1 ? "s" : ""} defined for this business</p>
        </div>
        <button onClick={() => { setAdding(true); setEditing(null); }} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 14px", borderRadius:"8px", background:"#6366F1", color:"#fff", border:"none", fontSize:"12px", fontWeight:"700", cursor:"pointer" }}>
          <Plus size={13} /> Add Skill
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div style={{ display:"flex", gap:"8px", alignItems:"center", marginBottom:"12px", padding:"12px", background:"#F8FAFC", borderRadius:"10px", border:"1px solid #E2E8F0" }}>
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAdd()} placeholder="Skill name…" style={{ ...INP, flex:1 }} />
          <div style={{ display:"flex", gap:"4px" }}>
            {PALETTE.map(c => (
              <button key={c} onClick={() => setNewColor(c)} style={{ width:18, height:18, borderRadius:"50%", background:c, border: newColor === c ? "2px solid #1E293B" : "2px solid transparent", cursor:"pointer", padding:0 }} />
            ))}
          </div>
          <button onClick={handleAdd} disabled={saving || !newName.trim()} style={{ padding:"7px 12px", borderRadius:"8px", background:"#6366F1", color:"#fff", border:"none", fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setAdding(false)} style={{ padding:"7px 10px", borderRadius:"8px", background:"#F1F5F9", color:"#64748B", border:"none", fontSize:"12px", cursor:"pointer" }}>Cancel</button>
        </div>
      )}

      {/* Skill list */}
      {loading ? (
        <p style={{ fontSize:"13px", color:"#94A3B8" }}>Loading…</p>
      ) : skills.length === 0 ? (
        <p style={{ fontSize:"13px", color:"#94A3B8", textAlign:"center", padding:"20px 0" }}>No skills yet — add your first skill above.</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
          {skills.map(s => (
            <div key={s.skill_id} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              {editing?.skill_id === s.skill_id ? (
                <>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:editing.color, flexShrink:0 }} />
                  <input value={editing.name} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} style={{ ...INP, flex:1 }} />
                  <div style={{ display:"flex", gap:"3px" }}>
                    {PALETTE.map(c => (
                      <button key={c} onClick={() => setEditing(p => ({ ...p, color: c }))} style={{ width:16, height:16, borderRadius:"50%", background:c, border: editing.color === c ? "2px solid #1E293B" : "2px solid transparent", cursor:"pointer", padding:0 }} />
                    ))}
                  </div>
                  <button onClick={handleUpdate} disabled={saving} style={{ padding:"5px 10px", borderRadius:"7px", background:"#6366F1", color:"#fff", border:"none", fontSize:"11px", fontWeight:"700", cursor:"pointer" }}><Check size={11} /></button>
                  <button onClick={() => setEditing(null)} style={{ padding:"5px 8px", borderRadius:"7px", background:"#F1F5F9", color:"#64748B", border:"none", cursor:"pointer" }}><X size={11} /></button>
                </>
              ) : (
                <>
                  <span className="sm-tag" style={{ background: s.color+"22", color: s.color, border:`1.5px solid ${s.color}33`, flex:1, justifyContent:"flex-start" }}>{s.name}</span>
                  <button onClick={() => { setEditing({ ...s }); setAdding(false); }} style={{ padding:"4px 8px", borderRadius:"7px", background:"#F8FAFC", border:"1px solid #E2E8F0", cursor:"pointer", color:"#64748B" }}><Edit2 size={11} /></button>
                  <button onClick={() => handleDelete(s.skill_id)} style={{ padding:"4px 8px", borderRadius:"7px", background:"#FEF2F2", border:"1px solid #FECACA", cursor:"pointer", color:"#DC2626" }}><X size={11} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Staff skill + level + years editor ───────────────────────────────────────
export function StaffSkillEditor({ staffId, currentLevel, currentYears, onSaved }) {
  const [library,       setLibrary]      = useState([]);
  const [assigned,      setAssigned]     = useState([]);
  const [initAssigned,  setInitAssigned] = useState([]);
  const [level,         setLevel]        = useState(currentLevel || "junior");
  const [initLevel,     setInitLevel]    = useState(currentLevel || "junior");
  const [years,         setYears]        = useState(currentYears != null ? String(currentYears) : "");
  const [initYears,     setInitYears]    = useState(currentYears != null ? String(currentYears) : "");
  const [saving,        setSaving]       = useState(false);
  const [saved,         setSaved]        = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/api/business/skills"),
      api.get(`/api/skills/staff/${staffId}`),
    ]).then(([lib, asg]) => {
      setLibrary(lib.skills || []);
      const ids = (asg.skills || []).map(s => s.skill_id);
      setAssigned(ids);
      setInitAssigned(ids);
    }).catch(console.error);
  }, [staffId]);

  useEffect(() => {
    setLevel(currentLevel || "junior");
    setInitLevel(currentLevel || "junior");
  }, [currentLevel]);

  useEffect(() => {
    const y = currentYears != null ? String(currentYears) : "";
    setYears(y); setInitYears(y);
  }, [currentYears]);

  const isDirty = level !== initLevel || years !== initYears ||
    assigned.length !== initAssigned.length || assigned.some(id => !initAssigned.includes(id));

  function toggle(skill_id) {
    setAssigned(prev => prev.includes(skill_id) ? prev.filter(id => id !== skill_id) : [...prev, skill_id]);
  }

  async function handleSave() {
    setSaving(true); setSaved(false);
    try {
      await Promise.all([
        api.put(`/api/skills/staff/${staffId}`, { skill_ids: assigned }),
        api.patch(`/api/skills/staff/${staffId}/level`, { experience_level: level, years_of_experience: years }),
      ]);
      setInitAssigned([...assigned]);
      setInitLevel(level);
      setInitYears(years);
      setSaved(true);
      onSaved?.({ level, years });
      setTimeout(() => setSaved(false), 2000);
    } catch { } finally { setSaving(false); }
  }

  const lm = LEVEL_META[level] || LEVEL_META.junior;

  return (
    <div style={{ background:"#fff", border:"1px solid #E2E8F0", borderRadius:"14px", padding:"20px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"18px" }}>
        <p style={{ fontSize:"14px", fontWeight:"800", color:"#1E293B", margin:0 }}>Skills & Experience</p>
        {(isDirty || saved) && (
          <button onClick={handleSave} disabled={saving} style={{ padding:"6px 16px", borderRadius:"8px", background: saved ? "#16A34A" : "#6366F1", color:"#fff", border:"none", fontSize:"12px", fontWeight:"700", cursor:"pointer", opacity: saving ? 0.7 : 1, transition:"background 0.2s" }}>
            {saving ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
          </button>
        )}
      </div>

      {/* 1. Skills */}
      <p style={{ fontSize:"12px", fontWeight:"700", color:"#64748B", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Skills</p>
      {library.length === 0 ? (
        <p style={{ fontSize:"12px", color:"#94A3B8", marginBottom:"20px" }}>No skills in library yet — go to Skills in the sidebar to add some.</p>
      ) : (
        <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginBottom:"20px" }}>
          {library.map(s => {
            const active = assigned.includes(s.skill_id);
            return (
              <button key={s.skill_id} onClick={() => toggle(s.skill_id)} className="sm-tag clickable"
                style={{ background: active ? "#1E293B" : "#F8FAFC", color: active ? "#fff" : "#64748B", border:`1.5px solid ${active ? "#1E293B" : "#E2E8F0"}`, fontWeight:700, gap:"4px", fontSize:"12px", padding:"5px 12px", borderRadius:"99px" }}>
                {active && <Check size={10} />}{s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div style={{ borderTop:"1px solid #F1F5F9", marginBottom:"18px" }} />

      {/* 2. Experience Level */}
      <p style={{ fontSize:"12px", fontWeight:"700", color:"#64748B", marginBottom:"8px", textTransform:"uppercase", letterSpacing:"0.05em" }}>Experience Level</p>
      <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"16px" }}>
        {LEVELS.map(l => {
          const m = LEVEL_META[l];
          const active = level === l;
          return (
            <button key={l} onClick={() => setLevel(l)} style={{ padding:"6px 18px", borderRadius:"99px", border:`1.5px solid ${active ? m.color : "#E2E8F0"}`, background: active ? m.bg : "#F8FAFC", color: active ? m.color : "#94A3B8", fontSize:"12px", fontWeight:"700", cursor:"pointer", transition:"all 0.15s" }}>
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 3. Years of experience */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <p style={{ fontSize:"12px", fontWeight:"700", color:"#64748B", margin:0, textTransform:"uppercase", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>Years of Experience</p>
        <input type="number" min="0" step="0.5" value={years} onChange={e => setYears(e.target.value)} placeholder="e.g. 3"
          style={{ width:"80px", padding:"6px 10px", borderRadius:"8px", border:"1.5px solid #E2E8F0", fontSize:"13px", outline:"none", fontFamily:"inherit", color:"#1E293B" }} />
        {years && level && (
          <span style={{ fontSize:"12px", fontWeight:"700", padding:"4px 12px", borderRadius:"99px", background: lm.bg, color: lm.color }}>
            {lm.label} · {years} yr{Number(years) !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
