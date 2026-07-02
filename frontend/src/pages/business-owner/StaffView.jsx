import { useState, useEffect } from "react";
import { api } from "../../lib/api";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useBusinessContext } from "../../context/BusinessContext";
import { LayoutList, Network, Building2, ShieldCheck, User, X, Mail, Briefcase, Star } from "lucide-react";
import { getUser } from "../../utils/auth";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("bo-sv2-styles")) {
  const s = document.createElement("style");
  s.id = "bo-sv2-styles";
  s.textContent = `
    @keyframes pageIn  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes modalIn { from{opacity:0;transform:scale(0.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
    .sv-clickable { cursor:pointer; transition: transform 0.15s, box-shadow 0.15s; }
    .sv-clickable:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 8px 28px rgba(0,0,0,0.13) !important; }
    .sv-tab { transition:all 0.15s; }
    .sv-tab:hover { opacity:0.85; }
    .sv-mode { transition:all 0.15s; }
  `;
  document.head.appendChild(s);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
const OUTLET_ACCENT = [
  { border:"#6366F1", bg:"linear-gradient(135deg,#EEF2FF,#E0E7FF)", text:"#4338CA", dot:"#6366F1" },
  { border:"#F59E0B", bg:"linear-gradient(135deg,#FFFBEB,#FEF3C7)", text:"#92400E", dot:"#F59E0B" },
  { border:"#10B981", bg:"linear-gradient(135deg,#ECFDF5,#D1FAE5)", text:"#065F46", dot:"#10B981" },
  { border:"#EC4899", bg:"linear-gradient(135deg,#FDF2F8,#FCE7F3)", text:"#9D174D", dot:"#EC4899" },
  { border:"#3B82F6", bg:"linear-gradient(135deg,#EFF6FF,#DBEAFE)", text:"#1E40AF", dot:"#3B82F6" },
  { border:"#8B5CF6", bg:"linear-gradient(135deg,#F5F3FF,#EDE9FE)", text:"#5B21B6", dot:"#8B5CF6" },
];

function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function outletAccent(id) { return OUTLET_ACCENT[(id || 0) % OUTLET_ACCENT.length]; }

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

function AvatarBubble({ name, size = 40, isManager = false, isOwner = false }) {
  const bg = avatarColor(name);
  const ring = isOwner ? "#F59E0B" : isManager ? "#F59E0B" : "transparent";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: isOwner ? "linear-gradient(135deg,#334155,#0F172A)" : bg, color: "#fff", fontSize: size * 0.38, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", border: `2.5px solid ${ring}`, boxShadow: isOwner ? `0 0 0 3px rgba(245,158,11,0.25)` : isManager ? `0 0 0 3px rgba(245,158,11,0.2)` : "none" }}>
        {isOwner ? <Star size={size * 0.38} color="#F59E0B" fill="#F59E0B" /> : name?.[0]?.toUpperCase() || "?"}
      </div>
      {(isManager || isOwner) && (
        <div style={{ position: "absolute", bottom: -2, right: -2, width: size * 0.34, height: size * 0.34, borderRadius: "50%", background: "#F59E0B", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size * 0.18, color: "#fff" }}>★</span>
        </div>
      )}
    </div>
  );
}

// ── Staff Detail Modal ───────────────────────────────────────────────────────
function StaffModal({ person, onClose }) {
  if (!person) return null;
  const isManager = person.role === "manager";
  const bg = avatarColor(person.name);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: "20px", width: "360px", boxShadow: "0 24px 64px rgba(0,0,0,0.22)", animation: "modalIn 0.22s ease", overflow: "hidden" }}>
        {/* Header gradient */}
        <div style={{ background: isManager ? "linear-gradient(135deg,#78350F,#92400E)" : "linear-gradient(135deg,#1E3A5F,#0F172A)", padding: "28px 24px 20px", position: "relative" }}>
          <button onClick={onClose} style={{ position: "absolute", top: "14px", right: "14px", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "8px", width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}>
            <X size={15} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: bg, color: "#fff", fontSize: 24, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", border: "3px solid rgba(255,255,255,0.3)", boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>
              {person.name?.[0]?.toUpperCase()}
            </div>
            <div>
              <p style={{ fontSize: "18px", fontWeight: "800", color: "#fff", marginBottom: "4px" }}>{person.name}</p>
              <span style={{ display: "inline-block", fontSize: "11px", fontWeight: "700", color: isManager ? "#FCD34D" : "#94A3B8", background: "rgba(255,255,255,0.12)", padding: "3px 10px", borderRadius: "99px", letterSpacing: "0.05em" }}>
                {isManager ? "★ OUTLET MANAGER" : person.staffType === "casual" ? "CASUAL STAFF" : "REGULAR STAFF"}
              </span>
            </div>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "20px 24px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <Row icon={<Mail size={15} color="#64748B" />} label="Email" value={person.email || "—"} />
            <Row icon={<Building2 size={15} color="#64748B" />} label="Outlet" value={person.outletName || "—"} />
            <Row icon={<Briefcase size={15} color="#64748B" />} label="Role" value={isManager ? "Outlet Manager" : person.staffType === "casual" ? "Casual Staff" : "Regular Staff"} />
            {person.experienceLevel && <Row icon={<Star size={15} color="#64748B" />} label="Experience" value={person.experienceLevel.charAt(0).toUpperCase() + person.experienceLevel.slice(1)} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
      <div style={{ marginTop: 1 }}>{icon}</div>
      <div>
        <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>{value}</p>
      </div>
    </div>
  );
}

// ── Normal list view ─────────────────────────────────────────────────────────
function NormalView({ outlets, outletData, loading, staffLabel, locationLabel, onSelectStaff, onSelectManager }) {
  const [activeOutlet, setActiveOutlet] = useState("all");
  const visible = activeOutlet === "all" ? outlets : outlets.filter(o => String(o.outlet_id) === activeOutlet);

  return (
    <div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "24px", flexWrap: "wrap" }}>
        {["all", ...outlets.map(o => String(o.outlet_id))].map((id, idx) => {
          const label = id === "all" ? `All ${locationLabel}s` : outlets.find(o => String(o.outlet_id) === id)?.name;
          const ac = id !== "all" ? outletAccent(Number(id)) : null;
          const isActive = activeOutlet === id;
          return (
            <button key={id} className="sv-tab" onClick={() => setActiveOutlet(id)}
              style={{ padding: "6px 16px", borderRadius: "99px", fontSize: "13px", fontWeight: "600", border: isActive && ac ? `1.5px solid ${ac.border}` : "1.5px solid transparent", cursor: "pointer", background: isActive ? (ac ? ac.bg : "#0F172A") : "#F1F5F9", color: isActive ? (ac ? ac.text : "#FFF") : "#475569" }}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "12px" }}>
          {Array.from({ length: 6 }).map((_, i) => <Shimmer key={i} h="88px" r="14px" />)}
        </div>
      ) : visible.map(outlet => {
        const { managers = [], staff = [] } = outletData[outlet.outlet_id] || {};
        const managerIds = new Set(managers.map(m => String(m.user_id)));
        const ac = outletAccent(outlet.outlet_id);
        return (
          <div key={outlet.outlet_id} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: ac.border }} />
              <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#1E293B" }}>{outlet.name}</h3>
              <span style={{ fontSize: "11px", color: "#94A3B8" }}>{managers.length} manager{managers.length !== 1 ? "s" : ""} · {staff.length} {staffLabel.toLowerCase()}</span>
            </div>
            {staff.length === 0 && managers.length === 0 ? (
              <div style={{ padding: "24px", background: "#F8FAFC", border: "1.5px dashed #E2E8F0", borderRadius: "12px", textAlign: "center" }}>
                <p style={{ fontSize: "13px", color: "#94A3B8" }}>No staff at this outlet yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))", gap: "10px" }}>
                {managers.map(m => (
                  <div key={`m${m.user_id}`} className="sv-clickable"
                    onClick={() => onSelectManager({ name: m.full_name, email: m.email, role: "manager", outletName: outlet.name })}
                    style={{ background: "#FFFBEB", border: `1.5px solid #FCD34D`, borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <AvatarBubble name={m.full_name} size={44} isManager />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</p>
                        <span style={{ fontSize: "10px", fontWeight: "700", color: "#92400E", background: "#FEF3C7", padding: "1px 7px", borderRadius: "99px", flexShrink: 0 }}>Manager</span>
                      </div>
                      <p style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>{m.email}</p>
                    </div>
                  </div>
                ))}
                {staff.filter(s => !managerIds.has(String(s.users?.user_id))).map(s => {
                  const name = s.users?.full_name || "—";
                  return (
                    <div key={s.staff_id} className="sv-clickable"
                      onClick={() => onSelectStaff(s.staff_id)}
                      style={{ background: "#FFF", border: "1.5px solid #E2E8F0", borderRadius: "14px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <AvatarBubble name={name} size={44} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                          <span style={{ fontSize: "10px", fontWeight: "600", color: s.staff_type === "regular" ? "#1E40AF" : "#6B21A8", background: s.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", padding: "1px 7px", borderRadius: "99px", flexShrink: 0 }}>
                            {s.staff_type === "regular" ? "Regular" : "Casual"}
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>{s.users?.email || "—"}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Org chart view ───────────────────────────────────────────────────────────
function OrgView({ outlets, outletData, loading, ownerName, staffLabel, onSelectStaff, onSelectManager }) {
  if (loading) {
    return (
      <div style={{ display: "flex", gap: "24px", justifyContent: "center", paddingTop: "40px" }}>
        {Array.from({ length: 3 }).map((_, i) => <Shimmer key={i} w="220px" h="340px" r="16px" />)}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", paddingBottom: "20px" }}>
      <div style={{ minWidth: "max-content", display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

        {/* ── Business Owner ── */}
        <div style={{ background: "linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)", borderRadius: "20px", padding: "20px 28px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 8px 32px rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <AvatarBubble name={ownerName} size={56} isOwner />
          <div>
            <p style={{ fontSize: "16px", fontWeight: "800", color: "#FFF", letterSpacing: "-0.01em" }}>{ownerName}</p>
            <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", fontWeight: "700", color: "#FCD34D", background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.3)", padding: "2px 10px", borderRadius: "99px", letterSpacing: "0.06em" }}>BUSINESS OWNER</span>
          </div>
        </div>

        {/* Vertical stem */}
        {outlets.length > 0 && (
          <svg width="2" height="36" style={{ display: "block" }}>
            <line x1="1" y1="0" x2="1" y2="36" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" />
          </svg>
        )}

        {/* ── Outlet columns ── */}
        {outlets.length > 0 && (
          <div style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
            {outlets.map((outlet, oi) => {
              const { managers = [], staff = [] } = outletData[outlet.outlet_id] || {};
              const managerIds = new Set(managers.map(m => String(m.user_id)));
              const regularStaff = staff.filter(s => !managerIds.has(String(s.users?.user_id)));
              const ac = outletAccent(outlet.outlet_id);

              return (
                <div key={outlet.outlet_id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  {/* Connector dot */}
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: ac.border, boxShadow: `0 0 8px ${ac.border}`, marginBottom: 2 }} />

                  {/* Outlet card — whole column */}
                  <div style={{ border: `2px solid ${ac.border}`, borderRadius: "20px", background: "#FFF", boxShadow: `0 4px 20px ${ac.border}22`, overflow: "hidden", minWidth: "320px", maxWidth: "420px" }}>

                    {/* Outlet header */}
                    <div style={{ background: ac.bg, borderBottom: `1.5px solid ${ac.border}33`, padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                      <div style={{ width: 38, height: 38, borderRadius: "10px", background: ac.border, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 3px 10px ${ac.border}55` }}>
                        <Building2 size={18} color="#fff" />
                      </div>
                      <p style={{ fontSize: "13px", fontWeight: "800", color: ac.text, textAlign: "center", lineHeight: 1.3 }}>{outlet.name}</p>
                      <span style={{ fontSize: "10px", fontWeight: "600", color: ac.text, background: `${ac.border}18`, padding: "2px 8px", borderRadius: "99px" }}>{staff.length} {staffLabel.toLowerCase()}</span>
                    </div>

                    {/* Managers section */}
                    {managers.length > 0 && (
                      <div style={{ padding: "12px 12px 0" }}>
                        <p style={{ fontSize: "9px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", textAlign: "center" }}>Manager</p>
                        <div style={{ display: "grid", gridTemplateColumns: managers.length > 1 ? "1fr 1fr" : "1fr", gap: "8px" }}>
                          {managers.map(m => (
                            <div key={m.user_id} className="sv-clickable"
                              onClick={() => onSelectManager({ name: m.full_name, email: m.email, role: "manager", outletName: outlet.name })}
                              style={{ background: "linear-gradient(135deg,#FFFBEB,#FEF3C7)", border: "1.5px solid #FCD34D", borderRadius: "12px", padding: "10px 12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", boxShadow: "0 2px 8px rgba(245,158,11,0.15)", textAlign: "center" }}>
                              <AvatarBubble name={m.full_name} size={36} isManager />
                              <div style={{ minWidth: 0, width: "100%" }}>
                                <p style={{ fontSize: "12px", fontWeight: "700", color: "#78350F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.full_name}</p>
                                <span style={{ fontSize: "9px", fontWeight: "700", color: "#92400E", background: "#FEF3C7", padding: "1px 6px", borderRadius: "99px" }}>★ Manager</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Divider if both exist */}
                    {managers.length > 0 && regularStaff.length > 0 && (
                      <div style={{ margin: "10px 12px", borderTop: "1px dashed #E2E8F0" }} />
                    )}

                    {/* Staff section */}
                    {regularStaff.length > 0 && (
                      <div style={{ padding: managers.length > 0 ? "0 12px 12px" : "12px 12px" }}>
                        {regularStaff.length > 0 && (
                          <p style={{ fontSize: "9px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", textAlign: "center" }}>Staff</p>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                          {regularStaff.map(s => {
                            const name = s.users?.full_name || "—";
                            const isCasual = s.staff_type === "casual";
                            return (
                              <div key={s.staff_id} className="sv-clickable"
                                onClick={() => onSelectStaff(s.staff_id)}
                                style={{ background: isCasual ? "#F5F3FF" : "#F8FAFC", border: `1.5px solid ${isCasual ? "#DDD6FE" : "#E2E8F0"}`, borderRadius: "10px", padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", textAlign: "center" }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarColor(name), color: "#fff", fontSize: 13, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                  {name[0]?.toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0, width: "100%" }}>
                                  <p style={{ fontSize: "11px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
                                  <span style={{ fontSize: "9px", fontWeight: "600", color: isCasual ? "#6B21A8" : "#3730A3", background: isCasual ? "#EDE9FE" : "#E0E7FF", padding: "1px 6px", borderRadius: "99px" }}>
                                    {isCasual ? "Casual" : "Regular"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {managers.length === 0 && regularStaff.length === 0 && (
                      <div style={{ padding: "20px 12px", textAlign: "center" }}>
                        <p style={{ fontSize: "11px", color: "#CBD5E1", fontStyle: "italic" }}>No staff yet</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function StaffView() {
  const { staffLabel, locationLabel } = useBusinessContext();
  const owner = getUser();
  const goTo = useGoTo();

  const [outlets, setOutlets]       = useState([]);
  const [outletData, setOutletData] = useState({});
  const [loading, setLoading]       = useState(true);
  const [mode, setMode]             = useState("normal");
  const [selected, setSelected]     = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { outlets: ol = [] } = await api.get("/api/business/outlets");
        setOutlets(ol);
        const entries = await Promise.all(
          ol.map(async o => {
            const [mRes, sRes] = await Promise.all([
              api.get(`/api/business/outlets/${o.outlet_id}/managers`),
              api.get(`/api/business/outlets/${o.outlet_id}/staff`),
            ]);
            return [o.outlet_id, { managers: mRes.managers || [], staff: sRes.staff || [] }];
          })
        );
        setOutletData(Object.fromEntries(entries));
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const totalManagers = Object.values(outletData).reduce((a, d) => a + (d.managers?.length || 0), 0);
  const totalStaff    = Object.values(outletData).reduce((a, d) => a + (d.staff?.length || 0), 0);

  return (
    <BusinessOwnerLayout title="Staff">
      <div style={{ animation: "pageIn 0.3s ease" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: "10px", padding: "8px 16px" }}>
              <ShieldCheck size={15} color="#D97706" />
              <span style={{ fontSize: "13px", color: "#92400E", fontWeight: "600" }}>Managers</span>
              <strong style={{ fontSize: "16px", color: "#78350F" }}>{loading ? "—" : totalManagers}</strong>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#EFF6FF", border: "1.5px solid #BFDBFE", borderRadius: "10px", padding: "8px 16px" }}>
              <User size={15} color="#3B82F6" />
              <span style={{ fontSize: "13px", color: "#1E40AF", fontWeight: "600" }}>{staffLabel}</span>
              <strong style={{ fontSize: "16px", color: "#1E40AF" }}>{loading ? "—" : totalStaff}</strong>
            </div>
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "4px", gap: "2px" }}>
            {[["normal", <LayoutList size={14} />, "List"], ["org", <Network size={14} />, "Org Chart"]].map(([m, icon, label]) => (
              <button key={m} className="sv-mode" onClick={() => setMode(m)}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", background: mode === m ? "#FFF" : "transparent", color: mode === m ? "#1E293B" : "#64748B", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {/* View */}
        {mode === "normal" ? (
          <NormalView outlets={outlets} outletData={outletData} loading={loading} staffLabel={staffLabel} locationLabel={locationLabel}
            onSelectStaff={id => goTo(`/business-owner/staff/${id}`)} onSelectManager={setSelected} />
        ) : (
          <div style={{ background: "linear-gradient(135deg,#F8FAFC 0%,#F1F5F9 100%)", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "36px 28px" }}>
            <OrgView outlets={outlets} outletData={outletData} loading={loading} ownerName={owner?.full_name || "Business Owner"} staffLabel={staffLabel}
              onSelectStaff={id => goTo(`/business-owner/staff/${id}`)} onSelectManager={setSelected} />
            <p style={{ textAlign: "center", fontSize: "11px", color: "#CBD5E1", marginTop: "24px" }}>Click any card to view details</p>
          </div>
        )}

        {selected && <StaffModal person={selected} onClose={() => setSelected(null)} />}
      </div>
    </BusinessOwnerLayout>
  );
}
