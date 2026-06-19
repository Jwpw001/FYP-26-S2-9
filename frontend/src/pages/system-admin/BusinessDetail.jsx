import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { ArrowLeft, Building2, MapPin, Users, ChevronRight, Star } from "lucide-react";

const PLAN_STYLES = {
  free:       { label: "Free",       bg: "#F1F5F9", color: "#64748B", border: "#E2E8F0" },
  premium:    { label: "Premium",    bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
  enterprise: { label: "Enterprise", bg: "#FDF4FF", color: "#9333EA", border: "#E9D5FF" },
};

if (typeof document !== "undefined" && !document.getElementById("sa-biz-detail-kf")) {
  const st = document.createElement("style");
  st.id = "sa-biz-detail-kf";
  st.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
    .outlet-card{transition:box-shadow 0.15s,border-color 0.15s}
    .outlet-card:hover{box-shadow:0 4px 16px rgba(0,0,0,0.08)!important;border-color:#BFDBFE!important}
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

export default function BusinessDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [business, setBusiness] = useState(null);
  const [outlets, setOutlets]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [planSaving, setPlanSaving] = useState(false);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: biz }, { data: outletRows }] = await Promise.all([
      supabase.from("businesses").select("business_id, name, description, created_at, plan").eq("business_id", id).single(),
      supabase.from("outlets").select("outlet_id, name, address, staff(staff_id)").eq("business_id", id).order("name"),
    ]);
    if (!biz) { navigate("/system-admin/businesses"); return; }
    setBusiness(biz);
    setOutlets(outletRows || []);
    setLoading(false);
  }

  const bizColor = business ? avatarColor(business.name) : "#3B82F6";

  async function changePlan(newPlan) {
    setPlanSaving(true);
    await supabase.from("businesses").update({ plan: newPlan }).eq("business_id", id);
    setBusiness(b => ({ ...b, plan: newPlan }));
    setPlanSaving(false);
  }

  return (
    <AdminLayout title="Business Detail">
      <div style={{ animation: "pageIn 0.35s ease both" }}>

        <button onClick={() => navigate("/system-admin/businesses")}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "22px", padding: 0 }}>
          <ArrowLeft size={15} /> Back to Businesses
        </button>

        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px" }}>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <Shimmer w="72px" h="72px" r="16px" />
              <div style={{ marginTop: "16px" }}><Shimmer w="80%" h="18px" r="6px" /></div>
              <div style={{ marginTop: "10px" }}><Shimmer w="60%" h="13px" r="5px" /></div>
            </div>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <Shimmer w="160px" h="18px" r="6px" />
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="70px" r="12px" />)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "20px", alignItems: "start" }}>

            {/* Left — Business profile */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ width: "72px", height: "72px", borderRadius: "18px", background: bizColor, color: "#FFF", fontSize: "26px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                  {business.name[0]?.toUpperCase()}
                </div>
                <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A", marginBottom: "6px" }}>{business.name}</h2>
                {business.description && <p style={{ fontSize: "13px", color: "#64748B", lineHeight: 1.5 }}>{business.description}</p>}
              </div>

              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "5px" }}><MapPin size={13} /> Outlets</span>
                  <span style={{ fontWeight: "700", color: "#1E293B" }}>{outlets.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#64748B", display: "flex", alignItems: "center", gap: "5px" }}><Users size={13} /> Total Staff</span>
                  <span style={{ fontWeight: "700", color: "#1E293B" }}>{outlets.reduce((sum, o) => sum + (o.staff?.length ?? 0), 0)}</span>
                </div>
                {business.created_at && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                    <span style={{ color: "#64748B" }}>Registered</span>
                    <span style={{ fontWeight: "600", color: "#1E293B" }}>{new Date(business.created_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>

              {/* Plan management */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: "16px", marginTop: "4px" }}>
                <p style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Star size={11} /> Plan
                </p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["free","premium","enterprise"].map(p => {
                    const ps = PLAN_STYLES[p];
                    const active = business.plan === p;
                    return (
                      <button key={p} onClick={() => !active && changePlan(p)} disabled={planSaving}
                        style={{ padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", cursor: active ? "default" : "pointer",
                          border: `1.5px solid ${active ? ps.border : "#E2E8F0"}`,
                          background: active ? ps.bg : "transparent",
                          color: active ? ps.color : "#94A3B8",
                          opacity: planSaving ? 0.6 : 1,
                          transition: "all 0.15s" }}>
                        {ps.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right — Outlets */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ marginBottom: "20px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>Outlets</h3>
                <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px" }}>{outlets.length} outlet{outlets.length !== 1 ? "s" : ""} under this business</p>
              </div>

              {outlets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <MapPin size={22} color="#3B82F6" />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No outlets yet</p>
                  <p style={{ fontSize: "13px", color: "#94A3B8" }}>No outlets have been created for this business.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {outlets.map((outlet, i) => {
                    const oColor = avatarColor(outlet.name);
                    const staffCount = outlet.staff?.length ?? 0;
                    return (
                      <div key={outlet.outlet_id} className="outlet-card"
                        onClick={() => navigate(`/system-admin/outlets/${outlet.outlet_id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px", border: "1px solid #E2E8F0", borderRadius: "13px", background: "#FAFAFA", animation: `fadeSlideUp 0.25s ease ${i * 0.04}s both`, cursor: "pointer" }}>
                        <div style={{ width: "44px", height: "44px", borderRadius: "11px", background: oColor, color: "#FFF", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {outlet.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outlet.name}</p>
                          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {outlet.address || <span style={{ color: "#CBD5E1", fontStyle: "italic" }}>No address set</span>}
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#EFF6FF", padding: "4px 10px", borderRadius: "100px", flexShrink: 0 }}>
                          <Users size={12} color="#2563EB" />
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "#2563EB" }}>{staffCount}</span>
                        </div>
                        <ChevronRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
