import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import { useGoTo } from "../../components/PageTransition";
import { ArrowLeft, MapPin, Users, ShieldCheck } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("sa-outlet-kf")) {
  const st = document.createElement("style");
  st.id = "sa-outlet-kf";
  st.textContent = `
    @keyframes pageIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    .od-card{transition:box-shadow 0.18s,transform 0.18s}
    .od-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
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

export default function OutletDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const goTo = useGoTo();
  const [outlet,   setOutlet]   = useState(null);
  const [managers, setManagers] = useState([]);
  const [staff,    setStaff]    = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => { load(); }, [id]);

  async function load() {
    setLoading(true);
    const [{ data: outletData }, { data: allStaff }, { data: skillData }] = await Promise.all([
      supabase.from("branches").select("branch_id, name, address, business_id, businesses(name)").eq("branch_id", id).single(),
      supabase.from("staff").select("staff_id, staff_type, is_active, user_id, users(user_id, full_name, email, role)").eq("branch_id", id).order("staff_id"),
      supabase.from("user_skill_tags").select("user_id, skills(name)"),
    ]);
    if (!outletData) { navigate(-1); return; }
    setOutlet(outletData);

    const skillMap = {};
    (skillData || []).forEach(r => {
      if (!skillMap[r.user_id]) skillMap[r.user_id] = [];
      if (r.skills?.name) skillMap[r.user_id].push(r.skills.name);
    });

    const rows = (allStaff || []).map(s => ({ ...s, skillNames: skillMap[s.user_id] || [] }));
    setManagers(rows.filter(s => s.users?.role === "outlet_manager").map(s => ({ ...s, is_primary: true })));
    setStaff(rows.filter(s => s.users?.role !== "outlet_manager"));
    setLoading(false);
  }

  const activeCount = staff.filter(s => s.is_active).length;
  const backPath = `/system-admin/outlets/${id}`;

  return (
    <AdminLayout title="Outlet Staff">
      <div style={{ animation: "pageIn 0.35s ease both" }}>

        <button onClick={() => goTo(`/system-admin/businesses/${outlet?.business_id ?? ""}`)}
          style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748B", fontSize: "13px", fontWeight: "600", cursor: "pointer", marginBottom: "22px", padding: 0 }}>
          <ArrowLeft size={15} /> Back to {outlet?.businesses?.name ?? "Business"}
        </button>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Shimmer h="90px" r="16px" />
            <Shimmer h="120px" r="16px" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "16px" }}>
              {[1,2,3,4].map(i => <Shimmer key={i} h="130px" r="16px" />)}
            </div>
          </div>
        ) : (
          <>
            {/* Outlet header */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px 24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: avatarColor(outlet.name), color: "#FFF", fontSize: "20px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {outlet.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: "17px", fontWeight: "800", color: "#0F172A" }}>{outlet.name}</h2>
                {outlet.address && (
                  <p style={{ fontSize: "13px", color: "#64748B", marginTop: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={12} /> {outlet.address}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <div style={{ textAlign: "center", background: "#ECFDF5", borderRadius: "10px", padding: "10px 18px" }}>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#059669" }}>{activeCount}</p>
                  <p style={{ fontSize: "11px", fontWeight: "600", color: "#6EE7B7", marginTop: "2px" }}>Active</p>
                </div>
                <div style={{ textAlign: "center", background: "#F8FAFC", borderRadius: "10px", padding: "10px 18px" }}>
                  <p style={{ fontSize: "18px", fontWeight: "800", color: "#94A3B8" }}>{staff.length - activeCount}</p>
                  <p style={{ fontSize: "11px", fontWeight: "600", color: "#CBD5E1", marginTop: "2px" }}>Inactive</p>
                </div>
              </div>
            </div>

            {/* Managers section */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", marginBottom: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
                <ShieldCheck size={16} color="#7C3AED" />
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>Managers</h3>
                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>{managers.length} assigned</span>
              </div>

              {managers.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#CBD5E1", fontStyle: "italic" }}>No managers assigned to this outlet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "14px" }}>
                  {managers.map((m, i) => {
                    const name   = m.users?.full_name || m.users?.email || "Unknown";
                    const email  = m.users?.email || "";
                    const skills = m.skillNames || [];
                    const color  = avatarColor(name);
                    return (
                      <div key={m.staff_id} className="od-card"
                        onClick={() => goTo(`/system-admin/managers/${m.users?.user_id}`, { state: { from: backPath } })}
                        style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.28s ease ${i * 0.05}s both`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: color, color: "#FFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {name[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                          </div>
                        </div>
                        {skills.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                            {skills.slice(0,3).map(sk => (
                              <span key={sk} style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: "#F1F5F9", color: "#475569" }}>{sk}</span>
                            ))}
                            {skills.length > 3 && <span style={{ fontSize: "11px", color: "#94A3B8", padding: "2px 4px" }}>+{skills.length - 3}</span>}
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                          <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: "#EDE9FE", color: "#6D28D9" }}>Manager</span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#CBD5E1" }} />
                            {m.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Staff section */}
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "18px" }}>
                <Users size={16} color="#3B82F6" />
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#0F172A" }}>Staff Members</h3>
                <span style={{ marginLeft: "auto", fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>{staff.length} total</span>
              </div>

              {staff.length === 0 ? (
                <div style={{ textAlign: "center", padding: "50px 20px" }}>
                  <div style={{ width: "52px", height: "52px", borderRadius: "14px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
                    <Users size={22} color="#3B82F6" />
                  </div>
                  <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "6px" }}>No staff assigned</p>
                  <p style={{ fontSize: "13px", color: "#94A3B8" }}>Staff assigned to this outlet will appear here.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "16px" }}>
                  {staff.map((s, i) => {
                    const name   = s.users?.full_name || "—";
                    const email  = s.users?.email || "—";
                    const skills = s.skillNames || [];
                    const color  = avatarColor(name);
                    return (
                      <div key={s.staff_id} className="od-card"
                        onClick={() => goTo(`/system-admin/staff/${s.staff_id}`, { state: { from: backPath } })}
                        style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`, cursor: "pointer" }}>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: color, color: "#FFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            {name[0]?.toUpperCase() || "?"}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "14px", fontWeight: "700", color: "#0F172A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
                          </div>
                        </div>

                        {skills.length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" }}>
                            {skills.slice(0,3).map(sk => (
                              <span key={sk} style={{ fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "100px", background: "#F1F5F9", color: "#475569" }}>{sk}</span>
                            ))}
                            {skills.length > 3 && <span style={{ fontSize: "11px", color: "#94A3B8", padding: "2px 4px" }}>+{skills.length - 3}</span>}
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                          <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
                            background: s.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
                            color: s.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
                            {s.staff_type === "regular" ? "Regular" : "Casual"}
                          </span>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "12px", fontWeight: "600", color: s.is_active ? "#16A34A" : "#94A3B8" }}>
                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: s.is_active ? "#22C55E" : "#CBD5E1" }} />
                            {s.is_active ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
