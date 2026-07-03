import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { useBusinessContext } from "../../context/BusinessContext";
import { LayoutList, Network, Building2 } from "lucide-react";

if (typeof document !== "undefined" && !document.getElementById("mgr-staff-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-staff-styles";
  style.textContent = `
    @keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
    @keyframes shimmer { from { background-position:-600px 0; } to { background-position:600px 0; } }
    @keyframes pageIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
    .staff-card { transition: box-shadow 0.18s, transform 0.18s; }
    .staff-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.1) !important; }
    .sv-clickable { cursor:pointer; transition: transform 0.15s, box-shadow 0.15s; }
    .sv-clickable:hover { transform:translateY(-3px) scale(1.02); box-shadow:0 8px 28px rgba(0,0,0,0.13) !important; }
    .sv-mode { transition:all 0.15s; }
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
  const { staffLabel } = useBusinessContext();
  const userId = user?.user_id;

  const [staff,       setStaff]       = useState([]);
  const [skills,      setSkills]      = useState([]);
  const [outletName,  setOutletName]  = useState("");
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState("all");
  const [filterSkill, setFilterSkill] = useState("all");
  const [mode,        setMode]        = useState("normal");

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

        const [{ data: staffData }, libRes, outletSkillsRes, { data: outletRow }] = await Promise.all([
          supabase.from("staff")
            .select("staff_id, outlet_id, staff_type, is_active, experience_level, years_of_experience, users(user_id, full_name, email, role)")
            .eq("outlet_id", oid),
          api.get("/api/business/skills").catch(() => ({ skills: [] })),
          api.get(`/api/skills/outlet/${oid}`).catch(() => ({ skills: [] })),
          supabase.from("outlets").select("name").eq("outlet_id", oid).single(),
        ]);

        if (cancelled) return;

        const assignments = outletSkillsRes.skills || [];
        const enriched = (staffData || []).filter(s => s.users?.role !== "outlet_manager").map(s => ({
          ...s,
          skillTags: assignments
            .filter(a => a.staff_id === s.staff_id)
            .map(a => ({ id: a.skill_id, name: a.name })),
        }));

        setStaff(enriched);
        setSkills(libRes.skills || []);
        setOutletName(outletRow?.name || "");
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
    <ManagerLayout title={staffLabel}>
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Staff Members</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${staff.length} total`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            {/* Mode toggle */}
            <div style={{ display: "flex", background: "#F1F5F9", borderRadius: "10px", padding: "4px", gap: "2px" }}>
              {[["normal", <LayoutList size={14} />, "List"], ["org", <Network size={14} />, "Org Chart"]].map(([m, icon, label]) => (
                <button key={m} className="sv-mode" onClick={() => setMode(m)}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: "600", background: mode === m ? "#FFF" : "transparent", color: mode === m ? "#1E293B" : "#64748B", boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <button onClick={() => goTo("/outlet-manager/staff/new")}
              style={{ padding: "10px 18px", borderRadius: "10px", fontSize: "14px", fontWeight: "600", border: "none", background: "#2563EB", color: "#FFF", cursor: "pointer" }}>
              + Add Staff
            </button>
          </div>
        </div>

        {mode === "org" ? (
          <div style={{ background: "linear-gradient(135deg,#F8FAFC 0%,#F1F5F9 100%)", border: "1px solid #E2E8F0", borderRadius: "20px", padding: "36px 28px" }}>
            <OrgChartView managerName={user?.full_name || "Manager"} outletName={outletName} staff={staff} loading={loading}
              staffLabel={staffLabel} onSelectStaff={id => goTo(`/outlet-manager/staff/${id}`)} />
            <p style={{ textAlign: "center", fontSize: "11px", color: "#CBD5E1", marginTop: "24px" }}>Click any card to view details</p>
          </div>
        ) : (
        <>
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
      onClick={onNav}
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${index * 0.05}s both`, cursor: "pointer" }}>

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

      {/* Type + experience + skill tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "16px" }}>
        <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
          {m.staff_type === "regular" ? "Regular" : "Casual"}
        </span>
      </div>

      {/* Footer: status only */}
      <div style={{ paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
          {m.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}

// ── Org chart view (single outlet: manager → regular/casual staff) ──────────
function AvatarBubble({ name, size = 40, isManager = false }) {
  const bg = avatarColor(name);
  const ring = isManager ? "#F59E0B" : "transparent";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: "50%", background: bg, color: "#fff", fontSize: size * 0.38, fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", border: `2.5px solid ${ring}`, boxShadow: isManager ? "0 0 0 3px rgba(245,158,11,0.2)" : "none" }}>
        {name?.[0]?.toUpperCase() || "?"}
      </div>
      {isManager && (
        <div style={{ position: "absolute", bottom: -2, right: -2, width: size * 0.34, height: size * 0.34, borderRadius: "50%", background: "#F59E0B", border: "2px solid #fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: size * 0.18, color: "#fff" }}>★</span>
        </div>
      )}
    </div>
  );
}

function OrgChartView({ managerName, outletName, staff, loading, staffLabel, onSelectStaff }) {
  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", paddingTop: "40px" }}>
        <Shimmer w="320px" h="340px" r="16px" />
      </div>
    );
  }

  const regularStaff = staff.filter(s => s.staff_type === "regular");
  const casualStaff  = staff.filter(s => s.staff_type === "casual");

  function StaffTile({ s }) {
    const name = s.users?.full_name || "—";
    const isCasual = s.staff_type === "casual";
    return (
      <div className="sv-clickable"
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
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>

      {/* ── Manager (root) ── */}
      <div style={{ background: "linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)", borderRadius: "20px", padding: "20px 28px", display: "flex", alignItems: "center", gap: "16px", boxShadow: "0 8px 32px rgba(15,23,42,0.4)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <AvatarBubble name={managerName} size={56} isManager />
        <div>
          <p style={{ fontSize: "16px", fontWeight: "800", color: "#FFF", letterSpacing: "-0.01em" }}>{managerName}</p>
          <span style={{ display: "inline-block", marginTop: "4px", fontSize: "10px", fontWeight: "700", color: "#FCD34D", background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.3)", padding: "2px 10px", borderRadius: "99px", letterSpacing: "0.06em" }}>OUTLET MANAGER</span>
        </div>
      </div>

      {/* Vertical stem */}
      <svg width="2" height="36" style={{ display: "block" }}>
        <line x1="1" y1="0" x2="1" y2="36" stroke="#CBD5E1" strokeWidth="2" strokeDasharray="4 3" />
      </svg>

      {/* ── Outlet box ── */}
      <div style={{ border: "2px solid #6366F1", borderRadius: "20px", background: "#FFF", boxShadow: "0 4px 20px rgba(99,102,241,0.13)", overflow: "hidden", minWidth: "320px", maxWidth: "480px" }}>

        <div style={{ background: "linear-gradient(135deg,#EEF2FF,#E0E7FF)", borderBottom: "1.5px solid rgba(99,102,241,0.2)", padding: "14px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
          <div style={{ width: 38, height: 38, borderRadius: "10px", background: "#6366F1", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(99,102,241,0.35)" }}>
            <Building2 size={18} color="#fff" />
          </div>
          <p style={{ fontSize: "13px", fontWeight: "800", color: "#4338CA", textAlign: "center", lineHeight: 1.3 }}>{outletName || "Your Outlet"}</p>
          <span style={{ fontSize: "10px", fontWeight: "600", color: "#4338CA", background: "rgba(99,102,241,0.1)", padding: "2px 8px", borderRadius: "99px" }}>{staff.length} {staffLabel.toLowerCase()}</span>
        </div>

        {staff.length === 0 ? (
          <div style={{ padding: "20px 12px", textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: "#CBD5E1", fontStyle: "italic" }}>No staff yet</p>
          </div>
        ) : (
          <>
            {regularStaff.length > 0 && (
              <div style={{ padding: "12px 12px 0" }}>
                <p style={{ fontSize: "9px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", textAlign: "center" }}>Regular</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {regularStaff.map(s => <StaffTile key={s.staff_id} s={s} />)}
                </div>
              </div>
            )}
            {regularStaff.length > 0 && casualStaff.length > 0 && (
              <div style={{ margin: "10px 12px", borderTop: "1px dashed #E2E8F0" }} />
            )}
            {casualStaff.length > 0 && (
              <div style={{ padding: regularStaff.length > 0 ? "0 12px 12px" : "12px 12px" }}>
                <p style={{ fontSize: "9px", fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px", textAlign: "center" }}>Casual</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {casualStaff.map(s => <StaffTile key={s.staff_id} s={s} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
