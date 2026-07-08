import { useState, useEffect } from "react";
import { Search, X, Plus, Sparkles, Check } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

if (typeof document !== "undefined" && !document.getElementById("reg-roles-kf")) {
  const s = document.createElement("style");
  s.id = "reg-roles-kf";
  s.textContent = `
    @keyframes rolePop { from{opacity:0;transform:scale(0.85)} to{opacity:1;transform:scale(1)} }
    @keyframes chipIn { from{opacity:0;transform:scale(0.8) translateY(4px)} to{opacity:1;transform:scale(1) translateY(0)} }
    @keyframes shimmer { from{background-position:-400px 0} to{background-position:400px 0} }
    .role-chip { transition: all 0.18s cubic-bezier(.4,0,.2,1); cursor: pointer; user-select: none; }
    .role-chip:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .role-chip:active { transform: scale(0.96); }
    .sel-chip { animation: chipIn 0.25s cubic-bezier(.34,1.56,.64,1) both; }
    .sel-chip:hover { transform: translateY(-1px); }
    .custom-input:focus { outline: none; border-color: #2563EB !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.12) !important; }
  `;
  document.head.appendChild(s);
}

const PALETTES = [
  { bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", hoverBg: "#DBEAFE" },
  { bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE", hoverBg: "#EDE9FE" },
  { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", hoverBg: "#FFEDD5" },
  { bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0", hoverBg: "#DCFCE7" },
  { bg: "#FFF1F2", text: "#BE123C", border: "#FECDD3", hoverBg: "#FFE4E6" },
  { bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC", hoverBg: "#CFFAFE" },
  { bg: "#FEFCE8", text: "#A16207", border: "#FEF08A", hoverBg: "#FEF9C3" },
  { bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD", hoverBg: "#E0F2FE" },
];
function palette(name) {
  const i = (name?.charCodeAt(0) || 0) % PALETTES.length;
  return PALETTES[i];
}

export default function StepWorkforceRoles({ form, setField, error, onNext, onSkip, onBack }) {
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [allSkills, setAllSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoveredSkill, setHoveredSkill] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase.from("skills").select("skill_id,name,description").order("name")
      .then(({ data }) => { if (!cancelled) { setAllSkills(data || []); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  const selected = form.business_roles;
  const selectedNames = new Set(selected.map(s => s.role_name));

  const filtered = allSkills.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) && !selectedNames.has(s.name)
  );

  function addRole(name) {
    if (selectedNames.has(name)) return;
    const skill = allSkills.find(s => s.name === name);
    setField("business_roles", [...selected, { role_name: name, description: skill?.description || "", is_suggested: true }]);
  }

  function removeRole(name) {
    setField("business_roles", selected.filter(s => s.role_name !== name));
  }

  function addCustom() {
    const name = customInput.trim();
    if (!name || selected.some(s => s.role_name.toLowerCase() === name.toLowerCase())) return;
    setField("business_roles", [...selected, { role_name: name, is_suggested: false }]);
    setCustomInput("");
  }

  const hasMinimum = selected.length === 0 || selected.length >= 3;

  return (
    <>
      <button onClick={onBack} style={backBtn}>← Back</button>

      <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>Workforce roles</h2>
      <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "24px" }}>Pick from existing skill tags or create custom roles for your business.</p>

      {error && <div style={errorBox}>{error}</div>}

      {/* Selected roles */}
      <div style={{ background: selected.length > 0 ? "#fff" : "#F8FAFC", border: `1.5px ${selected.length > 0 ? "solid" : "dashed"} ${selected.length > 0 ? "#E2E8F0" : "#CBD5E1"}`, borderRadius: "16px", padding: "18px 20px", marginBottom: "20px", minHeight: "68px", transition: "all 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: selected.length > 0 ? "12px" : "0" }}>
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {selected.length > 0 ? `Selected roles (${selected.length})` : "No roles selected yet"}
          </p>
          {selected.length > 0 && selected.length < 3 && (
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#F59E0B", background: "#FFFBEB", padding: "2px 8px", borderRadius: "100px", border: "1px solid #FDE68A" }}>
              Need {3 - selected.length} more
            </span>
          )}
          {selected.length >= 3 && (
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#16A34A", background: "#F0FDF4", padding: "2px 8px", borderRadius: "100px", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: "3px" }}>
              <Check size={10} strokeWidth={3} /> Good to go
            </span>
          )}
        </div>
        {selected.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {selected.map((r, i) => {
              const p = palette(r.role_name);
              return (
                <span key={r.role_name} className="sel-chip"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 10px 6px 12px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", background: p.bg, color: p.text, border: `1.5px solid ${p.border}`, animationDelay: `${i * 0.04}s` }}>
                  {r.role_name}
                  <button type="button" onClick={() => removeRole(r.role_name)}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", borderRadius: "50%", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = p.border}
                    onMouseLeave={e => e.currentTarget.style.background = "none"}>
                    <X size={13} color={p.text} strokeWidth={2.5} />
                  </button>
                </span>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Click skill tags below to add them</p>
        )}
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: "14px" }}>
        <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", zIndex: 1 }} />
        <input className="custom-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search skill tags…"
          style={{ width: "100%", padding: "11px 14px 11px 38px", borderRadius: "12px", border: "1.5px solid #E2E8F0", fontSize: "13px", background: "#fff", color: "#1E293B", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s" }} />
        {search && (
          <button type="button" onClick={() => setSearch("")}
            style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "#F1F5F9", border: "none", borderRadius: "50%", width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={12} color="#64748B" />
          </button>
        )}
      </div>

      {/* Skills grid */}
      <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "16px", padding: "16px", marginBottom: "20px", maxHeight: "260px", overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{ width: `${70 + (i % 3) * 30}px`, height: "32px", borderRadius: "10px", background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "400px 100%", animation: "shimmer 1.4s infinite linear" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontSize: "13px", color: "#94A3B8" }}>{search ? `No skill tags matching "${search}"` : "All skill tags selected"}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {filtered.map(skill => {
              const p = palette(skill.name);
              const isHovered = hoveredSkill === skill.skill_id;
              return (
                <button key={skill.skill_id} type="button" className="role-chip"
                  onClick={() => addRole(skill.name)}
                  onMouseEnter={() => setHoveredSkill(skill.skill_id)}
                  onMouseLeave={() => setHoveredSkill(null)}
                  style={{
                    padding: "6px 14px", borderRadius: "10px",
                    border: `1.5px solid ${isHovered ? p.border : "#E8ECF1"}`,
                    background: isHovered ? p.bg : "#FAFBFC",
                    color: isHovered ? p.text : "#475569",
                    fontSize: "13px", fontWeight: isHovered ? "600" : "500",
                    display: "flex", alignItems: "center", gap: "5px",
                  }}>
                  <Plus size={13} strokeWidth={isHovered ? 2.5 : 2} style={{ transition: "transform 0.15s", transform: isHovered ? "rotate(0deg)" : "rotate(0deg)" }} />
                  {skill.name}
                </button>
              );
            })}
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <p style={{ fontSize: "11px", color: "#CBD5E1", textAlign: "center", marginTop: "12px" }}>
            {filtered.length} skill tag{filtered.length !== 1 ? "s" : ""} available
          </p>
        )}
      </div>

      {/* Custom role */}
      <div style={{ background: "#fff", border: "1.5px solid #E2E8F0", borderRadius: "16px", padding: "16px 20px", marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
          <Sparkles size={14} color="#7C3AED" />
          <p style={{ fontSize: "12px", fontWeight: "700", color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.05em" }}>Create custom role</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input className="custom-input" value={customInput} onChange={e => setCustomInput(e.target.value)} placeholder="e.g. Team Lead, Shift Runner…"
            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addCustom())}
            style={{ flex: 1, padding: "10px 14px", borderRadius: "10px", border: "1.5px solid #E2E8F0", fontSize: "13px", background: "#FAFBFC", color: "#1E293B", boxSizing: "border-box", transition: "border-color 0.15s, box-shadow 0.15s" }} />
          <button type="button" onClick={addCustom} disabled={!customInput.trim()}
            style={{ padding: "10px 20px", borderRadius: "10px", border: "none", background: customInput.trim() ? "linear-gradient(135deg, #7C3AED, #6D28D9)" : "#E2E8F0", color: customInput.trim() ? "#fff" : "#94A3B8", fontSize: "13px", fontWeight: "600", cursor: customInput.trim() ? "pointer" : "not-allowed", transition: "all 0.15s", boxShadow: customInput.trim() ? "0 2px 8px rgba(124,58,237,0.3)" : "none" }}>
            + Add
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "12px" }}>
        <button type="button" onClick={onSkip}
          style={{ flex: 1, padding: "14px", background: "#fff", color: "#64748B", border: "1.5px solid #E2E8F0", borderRadius: "12px", fontSize: "15px", fontWeight: "600", cursor: "pointer", transition: "all 0.15s" }}>
          Skip for now
        </button>
        <button type="button" onClick={onNext} disabled={!hasMinimum}
          style={{ flex: 1, padding: "14px", background: hasMinimum ? "#2563EB" : "#93C5FD", color: "#fff", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: "700", cursor: hasMinimum ? "pointer" : "not-allowed", transition: "all 0.15s", boxShadow: hasMinimum ? "0 2px 8px rgba(37,99,235,0.3)" : "none" }}>
          Next →
        </button>
      </div>
    </>
  );
}

const backBtn = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "28px" };
const errorBox = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "20px", fontSize: "13px", color: "#DC2626" };
