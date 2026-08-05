import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import SearchableSelect from "../../components/SearchableSelect";
import { useGoTo } from "../../components/PageTransition";
import { Users } from "lucide-react";
import UserAvatar from "../../components/UserAvatar";

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
  const [filterType,   setFilterType]   = useState("all");
  const [filterSkill,  setFilterSkill]  = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: myStaff } = await supabase
          .from("staff").select("branch_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        let oid = myStaff?.[0]?.branch_id;
        if (!oid) {
          const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
          oid = omRow?.[0]?.branch_id;
        }
        if (!oid || cancelled) return;

        const [staffRes, skillsRes, branchSkillsRes] = await Promise.all([
          api.get("/api/staff").catch(() => ({ staff: [] })),
          api.get(`/api/skills/branch/${oid}`).catch(() => ({ skills: [] })),
          api.get(`/api/business/branches/${oid}/skills`).catch(() => ({ skills: [] })),
        ]);
        const staffData = staffRes.staff || [];

        if (cancelled) return;

        // Build a map: staff_id → skill tags from the backend response
        const tagsByStaffId = {};
        for (const t of (skillsRes.skills || [])) {
          if (!tagsByStaffId[t.staff_id]) tagsByStaffId[t.staff_id] = [];
          tagsByStaffId[t.staff_id].push({ id: t.skill_id, name: t.name });
        }

        const enriched = (staffData || []).filter(s => s.users?.role !== "manager").map(s => ({
          ...s,
          skillTags: tagsByStaffId[s.staff_id] || [],
        }));

        // Filter options should reflect this branch's own assigned skill catalog — not whatever
        // tags happen to be on the listed staff, which can include skills from another branch
        // for a pool-based casual worker who's only here via a cross-branch preference.
        const branchSkills = (branchSkillsRes.skills || [])
          .map(s => ({ skill_id: s.skill_id, name: s.name }))
          .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

        setStaff(enriched);
        setSkills(branchSkills);
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
    const matchType   = filterType   === "all" || s.staff_type === filterType;
    const matchSkill  = filterSkill  === "all" || s.skillTags?.some(t => String(t.id) === filterSkill);
    const matchStatus = filterStatus === "all" || (filterStatus === "active" ? s.is_active : !s.is_active);
    return matchSearch && matchType && matchSkill && matchStatus;
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
            <h2 style={{ fontSize: "25px", fontWeight: "800", color: "#1E293B" }}>Staff Members</h2>
            <p style={{ fontSize: "20px", color: "#64748B", marginTop: "2px" }}>
              {loading ? "Loading…" : `${activeCount} active · ${inactiveCount} inactive · ${staff.length} total`}
            </p>
          </div>
          <button onClick={() => goTo("/manager/staff/new")}
            style={{ padding: "10px 18px", borderRadius: "10px", fontSize: "21px", fontWeight: "600", border: "none", background: "#2563EB", color: "#FFF", cursor: "pointer" }}>
            + Add Staff
          </button>
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
            {TABS.map(t => (
              <button key={t.value} onClick={() => setFilterType(t.value)}
                style={{ padding: "7px 16px", background: filterType === t.value ? "#FFF" : "transparent", border: "none", borderRadius: "7px", fontSize: "20px", fontWeight: filterType === t.value ? "600" : "500", color: filterType === t.value ? "#1E293B" : "#64748B", cursor: "pointer", boxShadow: filterType === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
            {[
              { value: "all",      label: "All status" },
              { value: "active",   label: `Active (${activeCount})` },
              { value: "inactive", label: `Inactive (${inactiveCount})` },
            ].map(t => (
              <button key={t.value} onClick={() => setFilterStatus(t.value)}
                style={{
                  padding: "7px 14px", border: "none", borderRadius: "7px", fontSize: "20px", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                  background: filterStatus === t.value ? (t.value === "active" ? "#DCFCE7" : t.value === "inactive" ? "#FEE2E2" : "#FFF") : "transparent",
                  color: filterStatus === t.value ? (t.value === "active" ? "#16A34A" : t.value === "inactive" ? "#DC2626" : "#1E293B") : "#64748B",
                  fontWeight: filterStatus === t.value ? "600" : "500",
                  boxShadow: filterStatus === t.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}>
                {t.label}
              </button>
            ))}
          </div>
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
              style={{ width: "100%", padding: "9px 13px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "20px", background: "#FFF", color: "#1E293B", outline: "none", boxSizing: "border-box" }} />
          </div>
          <SearchableSelect
            options={skills.map(sk => ({ value: String(sk.skill_id), label: sk.name }))}
            value={filterSkill === "all" ? "" : filterSkill}
            onChange={v => setFilterSkill(v === "" ? "all" : v)}
            placeholder="All skills"
            style={{ minWidth: "170px" }}
          />
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
            <div style={{ marginBottom: "10px" }}><Users size={32} color="#64748B" /></div>
            <p style={{ fontSize: "21px", fontWeight: "600", color: "#64748B" }}>No staff found</p>
          </div>
        ) : filterType === "all" ? (
          <>
            {["regular", "casual"].map(type => {
              const group = filtered.filter(m => m.staff_type === type);
              if (group.length === 0) return null;
              return (
                <div key={type} style={{ marginBottom: "28px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "18px", fontWeight: "700", background: type === "regular" ? "#DBEAFE" : "#F3E8FF", color: type === "regular" ? "#1E40AF" : "#6B21A8" }}>
                      {type === "regular" ? "Regular" : "Casual"}
                    </span>
                    <span style={{ fontSize: "20px", fontWeight: "600", color: "#64748B" }}>({group.length})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
                    {group.map((m, i) => (
                      <StaffCard key={m.staff_id} member={m} index={i} onNav={() => goTo(`/manager/staff/${m.staff_id}`)} />
                    ))}
                  </div>
                </div>
              );
            })}
            <p style={{ textAlign: "center", fontSize: "20px", color: "#94A3B8", marginTop: "4px" }}>
              Showing {filtered.length} of {staff.length} staff members
            </p>
          </>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
              {filtered.map((m, i) => (
                <StaffCard key={m.staff_id} member={m} index={i} onNav={() => goTo(`/manager/staff/${m.staff_id}`)} />
              ))}
            </div>
            <p style={{ textAlign: "center", fontSize: "20px", color: "#94A3B8", marginTop: "20px" }}>
              Showing {filtered.length} of {staff.length} staff members
            </p>
          </>
        )}

      </div>
    </ManagerLayout>
  );
}

function StaffCard({ member: m, index, onNav }) {
  const name  = m.users?.full_name || "—";
  const email = m.users?.email    || "—";

  return (
    <div className="staff-card"
      onClick={onNav}
      style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "16px", padding: "20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", animation: `fadeSlideUp 0.3s ease ${index * 0.05}s both`, cursor: "pointer" }}>

      {/* Avatar + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
        <UserAvatar name={name} avatar_url={m.users?.avatar_url} size={44} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: "21px", fontWeight: "700", color: "#1E293B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</p>
          <p style={{ fontSize: "19px", color: "#64748B", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</p>
        </div>
        <span style={{ padding: "3px 9px", borderRadius: "100px", fontSize: "17px", fontWeight: "700", flexShrink: 0, background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF", color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8" }}>
          {m.staff_type === "regular" ? "Regular" : "Casual"}
        </span>
      </div>

      {/* Skill tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "14px", minHeight: "24px" }}>
        {m.skillTags?.length === 0 ? (
          <span style={{ fontSize: "19px", color: "#CBD5E1" }}>No skills assigned</span>
        ) : (
          <>
            {m.skillTags.slice(0, 3).map(t => (
              <span key={t.id} style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "18px", fontWeight: "500", background: "#F1F5F9", color: "#475569" }}>{t.name}</span>
            ))}
            {m.skillTags.length > 3 && (
              <span style={{ padding: "3px 8px", borderRadius: "100px", fontSize: "18px", background: "#E2E8F0", color: "#64748B" }}>+{m.skillTags.length - 3}</span>
            )}
          </>
        )}
      </div>

      {/* Footer: status */}
      <div style={{ paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "20px", fontWeight: "600", color: m.is_active ? "#16A34A" : "#94A3B8" }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", display: "inline-block" }} />
          {m.is_active ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
