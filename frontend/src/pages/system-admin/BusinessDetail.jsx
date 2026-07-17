import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { ArrowLeft, MapPin, Users, ChevronRight, Star, Calendar, GitBranch } from "lucide-react";

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
    .branch-card{transition:box-shadow 0.15s,border-color 0.15s,transform 0.15s}
    .branch-card:hover{box-shadow:0 8px 24px rgba(37,99,235,0.1)!important;border-color:#BFDBFE!important;transform:translateY(-2px)}
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

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: biz }, { data: outletRows }] = await Promise.all([
      supabase.from("businesses").select("business_id, name, description, created_at, plan").eq("business_id", id).single(),
      supabase.from("branches").select("branch_id, name, address, staff(staff_id)").eq("business_id", id).order("name"),
    ]);
    if (!biz) { navigate("/system-admin/businesses"); return; }
    setBusiness(biz);
    setOutlets(outletRows || []);
    setLoading(false);
  }

  async function changePlan(newPlan) {
    setPlanSaving(true);
    await supabase.from("businesses").update({ plan: newPlan }).eq("business_id", id);
    setBusiness(b => ({ ...b, plan: newPlan }));
    setPlanSaving(false);
  }

  const bizColor = business ? avatarColor(business.name) : "#3B82F6";
  const totalStaff = outlets.reduce((sum, o) => sum + (o.staff?.length ?? 0), 0);

  return (
    <AdminLayout title="Business Detail">
      <div style={{ animation: "pageIn 0.35s ease both" }}>

        <button onClick={() => navigate("/system-admin/businesses")}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "20px", padding: 0 }}>
          <ArrowLeft size={15} /> Back to Businesses
        </button>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
                <Shimmer w="72px" h="72px" r="16px" />
                <div style={{ flex: 1 }}>
                  <Shimmer w="220px" h="20px" r="6px" />
                  <div style={{ marginTop: "10px" }}><Shimmer w="340px" h="13px" r="5px" /></div>
                </div>
              </div>
            </div>
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "28px" }}>
              <Shimmer w="160px" h="18px" r="6px" />
              <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="76px" r="12px" />)}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

            {/* ── Hero card ── */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "28px 30px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
                {/* Avatar */}
                <div style={{ width: "68px", height: "68px", borderRadius: "18px", background: bizColor, color: "#FFF", fontSize: "26px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 14px ${bizColor}44` }}>
                  {business.name[0]?.toUpperCase()}
                </div>

                {/* Name + description */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0F172A", letterSpacing: "-0.3px" }}>{business.name}</h2>
                  {business.description && (
                    <p style={{ fontSize: "13px", color: "#64748B", marginTop: "4px", lineHeight: 1.5 }}>{business.description}</p>
                  )}
                </div>

                {/* Plan pills */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", display: "flex", alignItems: "center", gap: "4px", marginRight: "2px" }}>
                    <Star size={11} /> Plan
                  </span>
                  {["free","premium","enterprise"].map(p => {
                    const ps = PLAN_STYLES[p];
                    const active = business.plan === p;
                    return (
                      <button key={p} onClick={() => !active && changePlan(p)} disabled={planSaving}
                        style={{ padding: "5px 14px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", cursor: active ? "default" : "pointer",
                          border: `1.5px solid ${active ? ps.border : "#E2E8F0"}`,
                          background: active ? ps.bg : "transparent",
                          color: active ? ps.color : "#CBD5E1",
                          opacity: planSaving ? 0.6 : 1,
                          transition: "all 0.15s" }}>
                        {ps.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stat chips */}
              <div style={{ display: "flex", gap: "10px", marginTop: "20px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "8px 14px" }}>
                  <GitBranch size={13} color="#2563EB" />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#2563EB" }}>{outlets.length}</span>
                  <span style={{ fontSize: "12px", color: "#3B82F6", fontWeight: "500" }}>{outlets.length === 1 ? "Branch" : "Branches"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "8px 14px" }}>
                  <Users size={13} color="#16A34A" />
                  <span style={{ fontSize: "13px", fontWeight: "700", color: "#16A34A" }}>{totalStaff}</span>
                  <span style={{ fontSize: "12px", color: "#22C55E", fontWeight: "500" }}>Staff</span>
                </div>
                {business.created_at && (
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "8px 14px" }}>
                    <Calendar size={13} color="#64748B" />
                    <span style={{ fontSize: "12px", color: "#64748B", fontWeight: "500" }}>
                      Registered {new Date(business.created_at).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ── Branches section ── */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "18px", padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ marginBottom: "18px" }}>
                <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0F172A" }}>Branches</h3>
                <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "3px" }}>
                  {outlets.length} {outlets.length === 1 ? "branch" : "branches"} under this business
                </p>
              </div>

              {outlets.length === 0 ? (
                <div style={{ textAlign: "center", padding: "48px 20px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <GitBranch size={22} color="#3B82F6" />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No branches yet</p>
                  <p style={{ fontSize: "13px", color: "#94A3B8" }}>No branches have been created for this business.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "12px" }}>
                  {outlets.map((outlet, i) => {
                    const oColor = avatarColor(outlet.name);
                    const staffCount = outlet.staff?.length ?? 0;
                    return (
                      <div key={outlet.branch_id} className="branch-card"
                        onClick={() => navigate(`/system-admin/outlets/${outlet.branch_id}`)}
                        style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", border: "1px solid #E2E8F0", borderRadius: "14px", background: "#FAFAFA", animation: `fadeSlideUp 0.25s ease ${i * 0.04}s both`, cursor: "pointer" }}>
                        <div style={{ width: "42px", height: "42px", borderRadius: "11px", background: oColor, color: "#FFF", fontSize: "16px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {outlet.name[0]?.toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outlet.name}</p>
                          <p style={{ fontSize: "12px", color: "#94A3B8", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {outlet.address || <span style={{ fontStyle: "italic", color: "#CBD5E1" }}>No address set</span>}
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", background: "#EFF6FF", padding: "3px 9px", borderRadius: "100px" }}>
                            <Users size={11} color="#2563EB" />
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "#2563EB" }}>{staffCount}</span>
                          </div>
                          <ChevronRight size={14} color="#CBD5E1" />
                        </div>
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
