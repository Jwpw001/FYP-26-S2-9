import { useState, useEffect } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { api } from "../../lib/api";
import { Tag, Search, Building2, Layers, Sparkles } from "lucide-react";

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
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px 22px", display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
      <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A", lineHeight: 1.1 }}>{value}</p>
        <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B", marginTop: "2px" }}>{label}</p>
        {sub && <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>{sub}</p>}
      </div>
    </div>
  );
}

function BranchCard({ branch, q }) {
  const [open, setOpen] = useState(true);
  const skills = branch.skills;
  const visibleSkills = q
    ? skills.filter(s => s.name.toLowerCase().includes(q))
    : skills;

  return (
    <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: "16px", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: "14px", padding: "18px 20px", background: "none", border: "none", borderBottom: open ? "1px solid #F1F5F9" : "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#EFF6FF", border: "1px solid #BFDBFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Building2 size={17} color="#3B82F6" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: "800", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{branch.name}</p>
          <p style={{ fontSize: "11px", color: "#94A3B8", marginTop: "1px" }}>
            {skills.length} skill{skills.length !== 1 ? "s" : ""} assigned
          </p>
        </div>
        <span style={{ fontSize: "11px", fontWeight: "700", color: skills.length > 0 ? "#3B82F6" : "#94A3B8", background: skills.length > 0 ? "#EFF6FF" : "#F8FAFC", border: `1px solid ${skills.length > 0 ? "#BFDBFE" : "#E2E8F0"}`, padding: "3px 10px", borderRadius: "100px", flexShrink: 0 }}>
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {/* Skills */}
      {open && (
        <div style={{ padding: "16px 20px 20px" }}>
          {visibleSkills.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0", gap: "8px" }}>
              <Tag size={20} color="#CBD5E1" />
              <p style={{ fontSize: "12px", color: "#CBD5E1", fontStyle: "italic" }}>
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
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 13px", borderRadius: "100px", background: p.bg, border: `1px solid ${p.border}`, fontSize: "12px", fontWeight: "700", color: p.text, cursor: skill.description ? "help" : "default" }}>
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

export default function BOSkills() {
  const [branches, setBranches] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");

  useEffect(() => {
    api.get("/api/business/branch-skills-summary")
      .then(r => setBranches(r.branches || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Skill Tags</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
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
              style={{ border: "none", outline: "none", fontSize: "13px", color: "#1E293B", background: "transparent", flex: 1, fontFamily: "inherit" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ background: "none", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: "17px", lineHeight: 1, padding: 0 }}>×</button>
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
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>
              {search ? "No results found" : "No skill data yet"}
            </p>
            <p style={{ fontSize: "13px", color: "#94A3B8", maxWidth: "320px", margin: "0 auto", lineHeight: 1.6 }}>
              {search
                ? "Try a different keyword or clear the search."
                : "Skills will appear here once they're assigned to your branches via the Branches settings."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "14px" }}>
            {filtered.map(branch => (
              <BranchCard key={branch.branch_id} branch={branch} q={q} />
            ))}
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}
