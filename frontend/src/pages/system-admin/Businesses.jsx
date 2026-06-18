import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useNavigate } from "react-router-dom";
import { Building2, MapPin, ChevronRight } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-biz-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-kf";
  st.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .biz-card{transition:box-shadow 0.18s,transform 0.18s,border-color 0.15s}
    .biz-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.1)!important;border-color:#BFDBFE!important}
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

export default function Businesses() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState([]);
  const [loading, setLoading]       = useState(true);

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

  return (
    <AdminLayout title="Businesses">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#0F172A" }}>Businesses</h2>
          <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px" }}>
            {loading ? "Loading…" : `${businesses.length} business${businesses.length !== 1 ? "es" : ""} registered`}
          </p>
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

    </AdminLayout>
  );
}
