import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Plus, Building2, MapPin, ArrowRight } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-outlet-styles")) {
  const style = document.createElement("style");
  style.id = "bo-outlet-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .bo-outlet-card { transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s; position: relative; overflow: hidden; }
    .bo-outlet-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(217,119,6,0.14) !important; border-color: #FDE9C2 !important; }
    .bo-outlet-card:hover .bo-outlet-arrow { opacity: 1; transform: translateX(0); }
    .bo-outlet-card:hover .bo-outlet-icon { background: #F59E0B !important; }
    .bo-outlet-card:hover .bo-outlet-icon svg { stroke: #fff !important; }
    .bo-outlet-arrow { opacity: 0; transform: translateX(-6px); transition: opacity 0.2s, transform 0.2s; }
  `;
  document.head.appendChild(style);
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function BOOutlets() {
  const goTo = useGoTo();
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api.get("/api/business/outlets")
      .then(d => setOutlets(d.outlets || []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError("");
    try {
      await api.post("/api/business/outlets", form);
      setShowForm(false);
      setForm({ name: "", address: "" });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BusinessOwnerLayout title="Outlets">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Outlets</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${outlets.length} outlet${outlets.length !== 1 ? "s" : ""} across your business`}
            </p>
          </div>
          <button onClick={() => setShowForm(v => !v)} style={s.btnPrimary}>
            <Plus size={15} /> Add Outlet
          </button>
        </div>

        {showForm && (
          <div style={{ ...s.formCard, animation: "fadeSlideUp 0.3s ease both" }}>
            <h3 style={s.formTitle}>New Outlet</h3>
            <form onSubmit={handleCreate}>
              <div style={s.fieldsRow}>
                <Field label="Outlet Name *" value={form.name} onChange={v => setForm(p => ({ ...p, name: v }))} placeholder="e.g. Downtown Branch" />
                <Field label="Address" value={form.address} onChange={v => setForm(p => ({ ...p, address: v }))} placeholder="e.g. 123 Main St, City" />
              </div>
              {error && <p style={{ color: "#EF4444", fontSize: "13px", marginBottom: "12px" }}>{error}</p>}
              <div style={{ display: "flex", gap: "10px" }}>
                <button type="submit" disabled={submitting} style={s.btnPrimary}>{submitting ? "Creating…" : "Create Outlet"}</button>
                <button type="button" onClick={() => { setShowForm(false); setError(""); }} style={s.btnSecondary}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", display: "flex", gap: "16px" }}>
                <Shimmer w="52px" h="52px" r="12px" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="50%" h="17px" r="6px" />
                  <div style={{ marginTop: "10px" }}><Shimmer w="70%" h="13px" r="5px" /></div>
                </div>
              </div>
            ))}
          </div>
        ) : outlets.length === 0 ? (
          <div style={s.empty}>
            <Building2 size={40} color="#CBD5E1" />
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No outlets yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8", marginTop: "4px" }}>Create your first outlet to get started.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "18px" }}>
            {outlets.map((o, i) => (
              <div key={o.outlet_id} className="bo-outlet-card" style={{ ...s.card, animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both` }} onClick={() => goTo(`/business-owner/outlets/${o.outlet_id}`)}>
                <div className="bo-outlet-icon" style={s.cardIcon}><Building2 size={22} color="#D97706" /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={s.cardName}>{o.name}</p>
                  {o.address ? <p style={s.cardMeta}><MapPin size={13} /> {o.address}</p> : <p style={s.cardMetaMuted}>No address set</p>}
                </div>
                <ArrowRight className="bo-outlet-arrow" size={18} color="#D97706" style={{ flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div style={{ flex: 1, marginBottom: "14px" }}>
      <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", outline: "none", boxSizing: "border-box" }} />
    </div>
  );
}

const s = {
  btnPrimary: { display: "inline-flex", alignItems: "center", gap: "6px", background: "#F59E0B", color: "#1C1917", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", cursor: "pointer" },
  btnSecondary: { background: "#F1F5F9", color: "#475569", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", cursor: "pointer" },
  formCard: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", marginBottom: "24px" },
  formTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" },
  fieldsRow: { display: "flex", gap: "16px" },
  card: { background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", display: "flex", gap: "16px", alignItems: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", cursor: "pointer" },
  cardIcon: { width: "52px", height: "52px", borderRadius: "12px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" },
  cardName: { fontSize: "17px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  cardMeta: { display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#64748B", marginTop: "5px" },
  cardMetaMuted: { fontSize: "13px", color: "#94A3B8", marginTop: "5px" },
  empty: { textAlign: "center", padding: "60px 20px", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px" },
};
