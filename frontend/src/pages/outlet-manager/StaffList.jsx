import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-staff-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-staff-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes popIn {
      0%   { opacity: 0; transform: scale(0.93); }
      60%  { transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes pageIn {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const AVATAR_COLORS = ["#6366F1","#F59E0B","#10B981","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

function avatarColor(name = "") {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Shimmer({ w = "100%", h = "16px", r = "8px", style: extra = {} }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
      ...extra,
    }} />
  );
}

export default function StaffList() {
  const goTo = useGoTo();
  const user = getUser();
  const userId = user?.user_id;

  const [staff, setStaff]             = useState([]);
  const [skills, setSkills]           = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [filterType, setFilterType]   = useState("all");
  const [filterSkill, setFilterSkill] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        // Find the manager's outlet
        const { data: myStaff } = await supabase
          .from("staff").select("outlet_id")
          .eq("user_id", userId).eq("is_active", true).limit(1);
        const oid = myStaff?.[0]?.outlet_id;
        if (!oid || cancelled) return;

        // Fetch all staff for this outlet + their skill tags in parallel
        const [{ data: staffData }, { data: skillData }, { data: tagData }] = await Promise.all([
          supabase.from("staff")
            .select("staff_id, outlet_id, staff_type, is_active, users(user_id, full_name, email, role)")
            .eq("outlet_id", oid).eq("is_active", true),
          supabase.from("skills").select("skill_id, name"),
          supabase.from("user_skill_tags")
            .select("user_id, skill_id, skills(name)"),
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
        console.error("StaffList load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const filtered = staff.filter(s => {
    const q = search.toLowerCase();
    const matchSearch =
      (s.users?.full_name?.toLowerCase() || "").includes(q) ||
      (s.users?.email?.toLowerCase() || "").includes(q);
    const matchType  = filterType === "all" || s.staff_type === filterType;
    const matchSkill = filterSkill === "all" || s.skillTags?.some(t => String(t.id) === filterSkill);
    return matchSearch && matchType && matchSkill;
  });

  const TYPE_CHIPS = [
    { value: "all",     label: "All" },
    { value: "regular", label: "Regular" },
    { value: "casual",  label: "Casual" },
  ];

  return (
    <ManagerLayout title="Staff">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", color: "#1E293B" }}>Staff Members</h2>
            <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
              {staff.length} total · {staff.filter(m => m.is_active).length} active
            </p>
          </div>
          <AddStaffBtn onClick={() => goTo("/outlet-manager/staff/new")} />
        </div>

        {/* Search + filter chips */}
        <div style={{ marginBottom: "18px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <svg style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              width="16" height="16" fill="none" stroke="#94A3B8" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              style={{ width: "100%", padding: "9px 13px 9px 36px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "14px", background: "#FFFFFF", color: "#1E293B", outline: "none", boxSizing: "border-box" }}
              placeholder="Search by name or email…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Type chips */}
          <div style={{ display: "flex", gap: "6px" }}>
            {TYPE_CHIPS.map(chip => (
              <FilterChip key={chip.value} label={chip.label} active={filterType === chip.value} onClick={() => setFilterType(chip.value)} />
            ))}
          </div>

          {/* Skill select */}
          <select
            style={{ padding: "9px 13px", border: "1.5px solid #E2E8F0", borderRadius: "10px", fontSize: "13px", background: "#FFFFFF", color: "#1E293B", cursor: "pointer" }}
            value={filterSkill} onChange={e => setFilterSkill(e.target.value)}>
            <option value="all">All skills</option>
            {skills.map(sk => (
              <option key={sk.skill_id} value={String(sk.skill_id)}>{sk.name}</option>
            ))}
          </select>
        </div>

        {/* Table card */}
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 2fr 1fr 80px", padding: "11px 18px", background: "#F8FAFC", fontSize: "12px", fontWeight: "600", color: "#64748B", gap: "8px", borderBottom: "1px solid #E2E8F0" }}>
            <span>Name</span><span>Email</span><span>Type</span><span>Skills</span><span>Status</span><span></span>
          </div>

          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 2fr 1fr 80px", padding: "14px 18px", gap: "8px", borderBottom: "1px solid #F1F5F9", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                  <Shimmer w="34px" h="34px" r="50%" />
                  <Shimmer w="100px" h="14px" r="6px" />
                </div>
                <Shimmer w="80%" h="14px" r="6px" />
                <Shimmer w="60px" h="22px" r="100px" />
                <div style={{ display: "flex", gap: "6px" }}>
                  <Shimmer w="52px" h="20px" r="100px" />
                  <Shimmer w="52px" h="20px" r="100px" />
                </div>
                <Shimmer w="50px" h="14px" r="6px" />
                <Shimmer w="58px" h="28px" r="7px" />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px", color: "#64748B", fontSize: "14px" }}>
              No staff found.
            </div>
          ) : (
            filtered.map(m => <StaffRow key={m.staff_id} member={m} onNav={() => goTo(`/outlet-manager/staff/${m.staff_id}`)} />)
          )}
        </div>

      </div>
    </ManagerLayout>
  );
}

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 14px", borderRadius: "100px", fontSize: "13px", fontWeight: "600",
        cursor: "pointer", border: active ? "1.5px solid #2563EB" : "1.5px solid #E2E8F0",
        background: active ? "#EFF6FF" : "#FFFFFF",
        color: active ? "#2563EB" : "#64748B",
        transition: "all 0.15s",
      }}>
      {label}
    </button>
  );
}

function AddStaffBtn({ onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#1D4ED8" : "#2563EB", color: "#FFFFFF", border: "none",
        padding: "10px 18px", borderRadius: "10px", fontSize: "14px",
        fontWeight: "600", cursor: "pointer", transition: "background 0.15s",
        display: "flex", alignItems: "center", gap: "6px",
      }}>
      + Add Staff
    </button>
  );
}

function StaffRow({ member: m, onNav }) {
  const [hovered, setHovered] = useState(false);
  const name = m.users?.full_name || "";
  const initials = name?.[0]?.toUpperCase() || "?";
  const bgColor = avatarColor(name);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid", gridTemplateColumns: "2fr 2fr 1fr 2fr 1fr 80px",
        padding: "13px 18px", gap: "8px", alignItems: "center",
        borderBottom: "1px solid #F1F5F9", fontSize: "13px", color: "#1E293B",
        background: hovered ? "#F8FAFC" : "transparent",
        transition: "background 0.15s", cursor: "pointer",
      }}
      onClick={onNav}>

      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: bgColor, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 }}>
          {initials}
        </div>
        <span style={{ fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name || "—"}</span>
      </div>

      <span style={{ color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.users?.email || "—"}</span>

      <span>
        <span style={{
          display: "inline-block", padding: "3px 9px", borderRadius: "100px", fontSize: "11px", fontWeight: "600",
          background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
          color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8",
        }}>
          {m.staff_type === "regular" ? "Regular" : "Casual"}
        </span>
      </span>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
        {m.skillTags?.length > 0
          ? m.skillTags.slice(0, 2).map(t => (
              <span key={t.id} style={{ background: "#F1F5F9", color: "#475569", padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "500" }}>{t.name}</span>
            ))
          : <span style={{ color: "#94A3B8", fontSize: "12px" }}>None</span>
        }
        {m.skillTags?.length > 2 && (
          <span style={{ background: "#E2E8F0", color: "#64748B", padding: "2px 7px", borderRadius: "100px", fontSize: "11px" }}>+{m.skillTags.length - 2}</span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "13px", color: "#64748B" }}>
        <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: m.is_active ? "#22C55E" : "#D1D5DB", flexShrink: 0 }} />
        {m.is_active ? "Active" : "Inactive"}
      </div>

      <button
        onClick={e => { e.stopPropagation(); onNav(); }}
        style={{ background: "none", border: "1px solid #E2E8F0", borderRadius: "7px", padding: "5px 10px", fontSize: "12px", fontWeight: "600", color: "#2563EB", cursor: "pointer" }}>
        View →
      </button>
    </div>
  );
}
