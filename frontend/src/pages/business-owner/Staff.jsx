import { useEffect, useState } from "react";
import BusinessOwnerLayout from "../../components/layout/BusinessOwnerLayout";
import { useGoTo } from "../../components/PageTransition";
import { api } from "../../lib/api";
import { Users, Building2, Search, ShieldCheck } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("bo-staff-styles")) {
  const style = document.createElement("style");
  style.id = "bo-staff-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .bo-allstaff-card { transition: box-shadow 0.18s, transform 0.18s; }
    .bo-allstaff-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize: "600px 100%", animation: "shimmer 1.4s infinite linear" }} />;
}

export default function BOStaff() {
  const goTo = useGoTo();
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterOutlet, setFilterOutlet] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    Promise.all([
      api.get("/api/business/staff"),
      api.get("/api/business/managers"),
    ]).then(([staffRes, mgrRes]) => {
      const staffRows = (staffRes.staff || []).map(s => ({
        key: `staff-${s.staff_id}`,
        nav: `/business-owner/staff/${s.staff_id}`,
        name: s.users?.full_name || "—",
        email: s.users?.email || "—",
        type: s.staff_type === "regular" ? "regular" : "casual",
        outlet_id: s.outlet_id,
        outlet_name: s.outlet_name,
        is_active: s.is_active,
      }));
      const managerRows = (mgrRes.managers || []).map(m => ({
        key: `manager-${m.user_id}`,
        nav: `/business-owner/managers/${m.user_id}`,
        name: m.full_name || "—",
        email: m.email || "—",
        type: "manager",
        outlet_id: m.outlet_id,
        outlet_name: m.outlet_name,
        is_active: m.is_active,
      }));
      setPeople([...managerRows, ...staffRows]);
    }).finally(() => setLoading(false));
  }, []);

  const outlets = [...new Map(people.map(p => [p.outlet_id, p.outlet_name])).entries()];

  const filtered = people.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q);
    const matchOutlet = filterOutlet === "all" || String(p.outlet_id) === filterOutlet;
    const matchType = filterType === "all" || p.type === filterType;
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? p.is_active : !p.is_active);
    return matchSearch && matchOutlet && matchType && matchStatus;
  });

  const managerCount = people.filter(p => p.type === "manager").length;
  const regularCount = people.filter(p => p.type === "regular").length;
  const casualCount  = people.filter(p => p.type === "casual").length;
  const activeCount   = people.filter(p => p.is_active).length;
  const inactiveCount = people.filter(p => !p.is_active).length;

  const TYPE_TABS = [
    { value: "all",     label: `All (${people.length})` },
    { value: "manager", label: `Managers (${managerCount})` },
    { value: "regular", label: `Regular (${regularCount})` },
    { value: "casual",  label: `Casual (${casualCount})` },
  ];

  const STATUS_TABS = [
    { value: "all",      label: "All" },
    { value: "active",   label: `Active (${activeCount})` },
    { value: "inactive", label: `Inactive (${inactiveCount})` },
  ];

  const typeBadge = (type) => {
    if (type === "manager") return { background: "#FEF3C7", color: "#92400E", label: "Manager" };
    if (type === "regular") return { background: "#DBEAFE", color: "#1E40AF", label: "Regular" };
    return { background: "#F3E8FF", color: "#6B21A8", label: "Casual" };
  };

  return (
    <BusinessOwnerLayout title="All Staff">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>All Staff</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${people.length} total across all outlets`}
            </p>
          </div>
        </div>

        {/* Type filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "12px", width: "fit-content", flexWrap: "wrap" }}>
          {TYPE_TABS.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              style={{ padding: "7px 16px", background: filterType === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filterType === t.value ? "600" : "500", color: filterType === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filterType === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
          {STATUS_TABS.map(t => (
            <button key={t.value} onClick={() => setFilterStatus(t.value)}
              style={{ padding: "7px 16px", background: filterStatus === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filterStatus === t.value ? "600" : "500", color: filterStatus === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filterStatus === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + outlet filter */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <Search size={15} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ width: "100%", padding: "9px 13px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFF", color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
          </div>
          <select value={filterOutlet} onChange={e => setFilterOutlet(e.target.value)}
            style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFF", color: "#1E293B", cursor: "pointer" }}>
            <option value="all">All outlets</option>
            {outlets.map(([id, name]) => <option key={id} value={String(id)}>{name}</option>)}
          </select>
        </div>

        {/* Cards grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "22px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "18px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex: 1 }}>
                    <Shimmer w="120px" h="14px" r="6px" />
                    <div style={{ marginTop: "6px" }}><Shimmer w="150px" h="12px" r="5px" /></div>
                  </div>
                </div>
                <Shimmer w="90px" h="22px" r="100px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center" }}>
            <Users size={40} color="#CBD5E1" />
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B", marginTop: "12px" }}>No staff found</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {filtered.map((p, i) => {
                const initials = p.name[0]?.toUpperCase() || "?";
                const bgColor = avatarColor(p.name);
                const badge = typeBadge(p.type);
                return (
                  <div key={p.key} className="bo-allstaff-card"
                    onClick={() => goTo(p.nav)}
                    style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${i * 0.04}s both`, cursor: "pointer" }}>

                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
                      <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: bgColor, color: "#FFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {p.type === "manager" ? <ShieldCheck size={18} /> : initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</p>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: badge.background, color: badge.color }}>
                        {badge.label}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: "#F1F5F9", color: "#475569" }}>
                        <Building2 size={11} /> {p.outlet_name}
                      </span>
                    </div>

                    <div style={{ paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: p.is_active ? "#16A34A" : "#94A3B8" }}>
                        <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: p.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
                        {p.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#94A3B8", marginTop: "20px" }}>
              Showing {filtered.length} of {people.length} people
            </p>
          </>
        )}
      </div>
    </BusinessOwnerLayout>
  );
}
