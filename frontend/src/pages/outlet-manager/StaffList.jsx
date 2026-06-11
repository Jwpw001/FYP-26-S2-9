import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

if (typeof document !== "undefined" && !document.getElementById("mgr-staff-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-staff-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .staff-card { transition: box-shadow 0.18s, transform 0.18s; }
    .staff-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
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

export default function StaffList() {
  const goTo  = useGoTo();
  const user  = getUser();
  const userId = user?.user_id;

  const [staff,       setStaff]       = useState([]);
  const [skills,      setSkills]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("all");
  const [filterSkill, setFilterSkill] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;

        const [{ data: staffData }, { data: skillData }, { data: tagData }] = await Promise.all([
          supabase.from("staff")
            .select("staff_id, outlet_id, staff_type, is_active, users(user_id, full_name, email, role)")
            .eq("outlet_id", oid),
          supabase.from("skills").select("skill_id, name"),
          supabase.from("user_skill_tags").select("user_id, skill_id, skills(name)"),
        ]);

        if (cancelled) return;

        const enriched = (staffData || []).map(s => ({
          ...s,
          skillTags: (tagData || [])
            .filter(t => t.user_id === s.users?.user_id)
            .map(t => ({ id: t.skill_id, name: t.skills?.name })),
        }));

        setStaff(enriched);
        setSkills(skillData || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = (s.users?.full_name?.toLowerCase() || "").includes(q) || (s.users?.email?.toLowerCase() || "").includes(q);
    const matchType   = filterType  === "all" || s.staff_type === filterType;
    const matchSkill  = filterSkill === "all" || s.skillTags?.some(t => String(t.id) === filterSkill);
    return matchSearch && matchType && matchSkill;
  });

  const activeCount   = staff.filter(s => s.is_active).length;
  const inactiveCount = staff.filter(s => !s.is_active).length;

  const TABS = [
    { value: "all",     label: `All (${staff.length})` },
    { value: "regular", label: `Regular (${staff.filter(s => s.staff_type === "regular").length})` },
    { value: "casual",  label: `Casual (${staff.filter(s => s.staff_type === "casual").length})` },
  ];

  return (
    <ManagerLayout title="Staff">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Staff Members</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${staff.length} total`}
            </p>
          </div>
          <button onClick={() => goTo("/outlet-manager/staff/new")}
            style={{ padding: "10px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", border: "none", background: "#2563EB", color: "#FFF", cursor: "pointer" }}>
            + Add Staff
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", marginBottom: "16px", width: "fit-content" }}>
          {TABS.map(t => (
            <button key={t.value} onClick={() => setFilterType(t.value)}
              style={{ padding: "7px 16px", background: filterType === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "13px", fontWeight: filterType === t.value ? "600" : "500", color: filterType === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filterType === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search + skill filter */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="15" height="15" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              style={{ width: "100%", padding: "9px 13px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFF", color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
          </div>
          <select value={filterSkill} onChange={e => setFilterSkill(e.target.value)}
            style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFF", color: "#1E293B", cursor: "pointer" }}>
            <option value="all">All skills</option>
            {skills.map(sk => <option key={sk.skill_id} value={String(sk.skill_id)}>{sk.name}</option>)}
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
                <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                  <Shimmer w="70px" h="22px" r="100px" />
                  <Shimmer w="70px" h="22px" r="100px" />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <Shimmer w="60px" h="28px" r="8px" />
                  <Shimmer w="70px" h="28px" r="8px" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "60px", textAlign: "center" }}>
            <p style={{ fontSize: "32px", marginBottom: "10px" }}>👥</p>
            <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>No staff found</p>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {filtered.map((m, i) => (
                <StaffCard key={m.staff_id} member={m} index={i} onNav={() => goTo(`/outlet-manager/staff/${m.staff_id}`)} />
              ))}
            </div>
            <p style={{ textAlign: "center", fontSize: "13px", color: "#94A3B8", marginTop: "20px" }}>
              Showing {filtered.length} of {staff.length} staff members
            </p>
          </>
        )}

      </div>
    </ManagerLayout>
  );
}

function StaffCard({ member: m, index, onNav }) {
  const name     = m.users?.full_name || "—";
  const email    = m.users?.email    || "—";
  const initials = name[0]?.toUpperCase() || "?";
  const bgColor  = avatarColor(name);

  return (
    <div className="staff-card"
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${index * 0.05}s both` }}>

      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: bgColor, color: "#FFF", fontSize: "16px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          <p style={{ fontSize: "12px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
        </div>
      </div>

      {/* Type + skill tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
        <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
          {m.staff_type === "regular" ? "Regular" : "Casual"}
        </span>
        {m.skillTags?.slice(0, 2).map(t => (
          <span key={t.id} style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "500", background: "#F1F5F9", color: "#475569" }}>{t.name}</span>
        ))}
        {m.skillTags?.length > 2 && (
          <span style={{ padding: "3px 8px", borderRadius: "100px", fontSize: "11px", background: "#E2E8F0", color: "#64748B" }}>+{m.skillTags.length - 2}</span>
        )}
      </div>

      {/* Footer: status + view */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
          {m.is_active ? "Active" : "Inactive"}
        </span>
        <button onClick={onNav}
          style={{ padding: "6px 14px", borderRadius: "8px", border: "1.5px solid #E2E8F0", background: "#FFF", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
          View →
        </button>
      </div>
    </div>
  );
}
