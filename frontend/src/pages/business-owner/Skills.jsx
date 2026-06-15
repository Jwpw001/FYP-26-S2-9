import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { Plus, Trash2, Tag } from "lucide-react";

export default function BOSkills() {
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState(null);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    fetch("/api/business/outlets", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        const list = d.outlets || [];
        setOutlets(list);
        if (list.length > 0) setSelectedOutlet(list[0].outlet_id);
      }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedOutlet) return;
    fetch(`/api/business/outlets/${selectedOutlet}/skills`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setSkills(d.skills || []));
  }, [selectedOutlet]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newSkill.trim()) return;
    setAdding(true); setError("");
    try {
      const res = await fetch(`/api/business/outlets/${selectedOutlet}/skills`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newSkill.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setNewSkill("");
      setSkills(prev => [...prev, data.skill]);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (skill_id) => {
    await fetch(`/api/business/outlets/${selectedOutlet}/skills/${skill_id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    setSkills(prev => prev.filter(s => s.skill_id !== skill_id));
  };

  return (
    <BusinessOwnerLayout title="Skill Tags">
      {loading ? <p style={{ color: "#64748B" }}>Loading…</p> : outlets.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px" }}>
          <p style={{ color: "#94A3B8" }}>Create an outlet first before managing skill tags.</p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "24px" }}>
            <label style={{ fontSize: "13px", fontWeight: "600", color: "#374151", display: "block", marginBottom: "8px" }}>Select Outlet</label>
            <select value={selectedOutlet || ""} onChange={e => setSelectedOutlet(Number(e.target.value))}
              style={{ padding: "9px 14px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", background: "#FFF", minWidth: "240px" }}>
              {outlets.map(o => <option key={o.outlet_id} value={o.outlet_id}>{o.name}</option>)}
            </select>
          </div>

          <div style={s.panel}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>
                Skills · <span style={{ color: "#64748B", fontWeight: "500" }}>{outlets.find(o => o.outlet_id === selectedOutlet)?.name}</span>
              </h3>
              <span style={{ fontSize: "12px", color: "#94A3B8" }}>{skills.length} tag{skills.length !== 1 ? "s" : ""}</span>
            </div>

            <form onSubmit={handleAdd} style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <input value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="e.g. Bartending, Food Safety…"
                style={{ flex: 1, padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none" }} />
              <button type="submit" disabled={adding || !newSkill.trim()} style={s.btnPrimary}>
                <Plus size={15} /> Add
              </button>
            </form>
            {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}

            {skills.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94A3B8" }}>
                <Tag size={32} color="#CBD5E1" />
                <p style={{ marginTop: "10px" }}>No skill tags yet for this outlet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {skills.map(skill => (
                  <div key={skill.skill_id} style={s.tag}>
                    <Tag size={12} />
                    <span>{skill.name}</span>
                    <button onClick={() => handleDelete(skill.skill_id)} style={s.deleteBtn}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

const s = {
  panel: { background: "#FFF", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  tag: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#FEF3C7", color: "#92400E", padding: "6px 12px", borderRadius: "100px", fontSize: "13px", fontWeight: "600", border: "1px solid #FDE68A" },
  deleteBtn: { background: "none", border: "none", cursor: "pointer", color: "#B45309", display: "flex", alignItems: "center", padding: "0 0 0 4px" },
};
