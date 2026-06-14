import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-kf";
  st.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes toastIn { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes modalIn { from{opacity:0;transform:scale(0.96) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .biz-card{transition:box-shadow 0.18s,transform 0.18s,border-color 0.15s}
    .biz-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important;border-color:#BFDBFE!important}
    .sa-input:focus{outline:none;border-color:#3B82F6!important;box-shadow:0 0 0 3px rgba(59,130,246,0.12)}
  `;
  document.head.appendChild(st);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

const EMPTY = { name: "", description: "" };

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [toast, setToast]           = useState(null);

  function showToast(msg, type = "success") { setToast({ msg, type }); setTimeout(() => setToast(null), 3200); }

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("businesses")
      .select("business_id, name, description, outlets(outlet_id)")
      .order("name");
    setBusinesses(data || []);
    setLoading(false);
  }

  async function handleAdd() {
    if (!form.name.trim()) { showToast("Business name is required.", "error"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("businesses")
      .insert({ name: form.name.trim(), description: form.description.trim() || null })
      .select("business_id, name, description, outlets(outlet_id)")
      .single();
    setSaving(false);
    if (error) { showToast(error.message, "error"); return; }
    setBusinesses(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(EMPTY);
    setShowModal(false);
    showToast("Business registered successfully.");
  }

  return (
    <AdminLayout title="Businesses">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "28px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Businesses</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
              {loading ? "Loading…" : `${businesses.length} business${businesses.length !== 1 ? "es" : ""} registered`}
            </p>
          </div>
          <button onClick={() => { setForm(EMPTY); setShowModal(true); }}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", border: "none", background: "#3B82F6", color: "#FFF", cursor: "pointer" }}>
            + Register Business
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", gap: "14px", marginBottom: "16px" }}>
                  <Shimmer w="52px" h="52px" r="12px" />
                  <div style={{ flex: 1 }}><Shimmer w="60%" h="16px" r="6px" /><div style={{ marginTop: "8px" }}><Shimmer w="80%" h="12px" r="5px" /></div></div>
                </div>
                <Shimmer w="100px" h="24px" r="8px" />
              </div>
            ))}
          </div>
        ) : businesses.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "80px", textAlign: "center" }}>
            <div style={{ width: "60px", height: "60px", borderRadius: "16px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <Building2 size={28} color="#3B82F6" />
            </div>
            <p style={{ fontSize: "16px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No businesses yet</p>
            <p style={{ fontSize: "13px", color: "#94A3B8" }}>Register a business to start creating outlets for managers.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: "16px" }}>
            {businesses.map((biz, i) => {
              const outletCount = biz.outlets?.length ?? 0;
              const color = avatarColor(biz.name);
              return (
                <div key={biz.business_id} className="biz-card"
                  onClick={() => navigate(`/system-admin/businesses/${biz.business_id}`)}
                  style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.05}s both`, cursor: "pointer" }}>

                  <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "16px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "13px", background: color, color: "#FFF", fontSize: "20px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {biz.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biz.name}</p>
                      {biz.description && (
                        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{biz.description}</p>
                      )}
                    </div>
                    <ChevronRight size={16} color="#CBD5E1" style={{ flexShrink: 0, marginTop: "2px" }} />
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 12px", background: outletCount > 0 ? "#EFF6FF" : "#F8FAFC", borderRadius: "9px", border: `1px solid ${outletCount > 0 ? "#BFDBFE" : "#E2E8F0"}` }}>
                    <MapPin size={13} color={outletCount > 0 ? "#2563EB" : "#94A3B8"} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: outletCount > 0 ? "#2563EB" : "#94A3B8" }}>
                      {outletCount} outlet{outletCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Register Business Modal */}
      {showModal && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.5)", backdropFilter: "blur(3px)" }} onClick={() => setShowModal(false)} />
          <div style={{ position: "relative", background: "#FFF", borderRadius: "18px", width: "460px", maxWidth: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "modalIn 0.22s ease both", overflow: "hidden" }}>
            <div style={{ height: "3px", background: "linear-gradient(90deg,#3B82F6,#8B5CF6)" }} />
            <div style={{ padding: "26px 28px 24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "22px" }}>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#3B82F6", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "4px" }}>New Business</p>
                  <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>Register a Business</h3>
                </div>
                <button onClick={() => setShowModal(false)}
                  style={{ width: "30px", height: "30px", borderRadius: "8px", border: "none", background: "#F1F5F9", color: "#94A3B8", fontSize: "18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Business Name *</label>
                  <input autoFocus className="sa-input" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    onKeyDown={e => e.key === "Enter" && handleAdd()}
                    placeholder="e.g. The Coffee Club"
                    style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", color: "#0F172A", background: "#FAFAFA", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#374151", marginBottom: "6px" }}>Description <span style={{ color: "#94A3B8", fontWeight: "400" }}>(optional)</span></label>
                  <textarea className="sa-input" value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Brief description of the business…"
                    rows={3}
                    style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", color: "#0F172A", background: "#FAFAFA", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
                <button onClick={() => setShowModal(false)} disabled={saving}
                  style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E2E8F0", background: "#FFF", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleAdd} disabled={saving || !form.name.trim()}
                  style={{ flex: 2, padding: "11px", borderRadius: "10px", border: "none", background: !form.name.trim() ? "#E2E8F0" : "#3B82F6", color: !form.name.trim() ? "#94A3B8" : "#FFF", fontSize: "13px", fontWeight: "700", cursor: !form.name.trim() || saving ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
                  {saving ? "Registering…" : "Register Business"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 99999, background: toast.type === "success" ? "#22C55E" : "#EF4444", color: "#FFF", padding: "12px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", boxShadow: "0 4px 20px rgba(0,0,0,0.15)", animation: "toastIn 0.3s ease both" }}>
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
}
