import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { Plus, Building2, MapPin } from "lucide-react";

export default function BOOutlets() {
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", location: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const token = localStorage.getItem("token");

  const load = () => {
    setLoading(true);
    fetch("/api/business/outlets", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => setOutlets(d.outlets || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/business/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setShowForm(false);
      setForm({ name: "", location: "", description: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BusinessOwnerLayout title="Outlets">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <p style={{ color: "#64748B", fontSize: "14px" }}>{outlets.length} outlet{outlets.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setShowForm(true)} style={s.btnPrimary}>
          <Plus size={15} /> Add Outlet
        </button>
      </div>

      {showForm && (
        <div style={s.formCard}>
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "20px" }}>New Outlet</h3>
          <form onSubmit={handleCreate}>
            <Field label="Outlet Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Downtown Branch" />
            <Field label="Location" value={form.location} onChange={v => setForm(p => ({ ...p, location: v }))} placeholder="e.g. 123 Main St, City" />
            <Field label="Description" value={form.description} onChange={v => setForm(p => ({ ...p, description: v }))} placeholder="Optional description" />
            {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" disabled={submitting} style={s.btnPrimary}>{submitting ? "Creating…" : "Create Outlet"}</button>
              <button type="button" onClick={() => { setShowForm(false); setError(""); }} style={s.btnSecondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p style={{ color: "#64748B" }}>Loading…</p> : outlets.length === 0 ? (
        <div style={s.empty}>
          <Building2 size={40} color="#CBD5E1" />
          <p style={{ color: "#94A3B8", marginTop: "12px" }}>No outlets yet. Create your first outlet.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {outlets.map(o => (
            <div key={o.outlet_id} style={s.card}>
              <div style={s.cardIcon}><Building2 size={18} color="#F59E0B" /></div>
              <div style={{ flex: 1 }}>
                <p style={s.cardName}>{o.name}</p>
                {o.location && <p style={s.cardMeta}><MapPin size={12} /> {o.location}</p>}
                {o.description && <p style={s.cardDesc}>{o.description}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </BusinessOwnerLayout>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

const s = {
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  formCard: { background: "#FFF", borderRadius: "14px", padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: "24px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  card: { background: "#FFF", borderRadius: "14px", padding: "20px", display: "flex", gap: "14px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" },
  cardIcon: { width: "40px", height: "40px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardName: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  cardMeta: { display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#64748B", marginTop: "4px" },
  cardDesc: { fontSize: "12px", color: "#94A3B8", marginTop: "6px" },
  empty: { textAlign: "center", padding: "60px 20px" },
};
