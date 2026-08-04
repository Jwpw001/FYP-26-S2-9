import { useState, useEffect } from "react";
import { Users, MapPin } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import AdminLayout from "../../components/layout/AdminLayout";
import SearchableSelect from "../../components/SearchableSelect";
import { useGoTo } from "../../components/PageTransition";
import UserAvatar from "../../components/UserAvatar";

if (typeof document !== "undefined" && !document.getElementById("sa-staff-kf")) {
  const s = document.createElement("style");
  s.id = "sa-staff-kf";
  s.textContent = `
    @keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer { from{background-position:-600px 0} to{background-position:600px 0} }
    @keyframes pageIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .sa-staff-card{transition:box-shadow 0.18s,transform 0.18s}
    .sa-staff-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.08)!important}
  `;
  document.head.appendChild(s);
}

const AVATAR_COLORS = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#EF4444","#06B6D4"];
function avatarColor(name = "") { return AVATAR_COLORS[(name.charCodeAt(0)||0) % AVATAR_COLORS.length]; }
function Shimmer({ w="100%", h="16px", r="8px" }) {
  return <div style={{ width:w, height:h, borderRadius:r, background:"linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)", backgroundSize:"600px 100%", animation:"shimmer 1.4s infinite linear" }} />;
}

export default function AdminStaff() {
  const goTo = useGoTo();
  const [staff,   setStaff]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState("all");   // all | regular | casual
  const [branch,  setBranch]  = useState("");       // branch filter
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      supabase.from("staff").select("staff_id,staff_type,is_active,branch_id,user_id,users(full_name,email,role,avatar_url),branches(name)").order("staff_id"),
      supabase.from("branches").select("branch_id,name").order("name"),
      supabase.from("user_skill_tags").select("user_id,skills(name)"),
    ]).then(([{ data: staffData }, { data: branchData }, { data: skillData }]) => {
      if (!cancelled) {
        const skillMap = {};
        (skillData || []).forEach(row => {
          if (!skillMap[row.user_id]) skillMap[row.user_id] = [];
          if (row.skills?.name) skillMap[row.user_id].push(row.skills.name);
        });
        const staffWithSkills = (staffData || [])
          .map(s => ({ ...s, skillNames: skillMap[s.user_id] || [] }));
        setStaff(staffWithSkills);
        setBranches(branchData || []);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const filtered = staff.filter(s => {
    const name  = s.users?.full_name?.toLowerCase() || "";
    const email = s.users?.email?.toLowerCase() || "";
    const q     = search.toLowerCase();
    if (q && !name.includes(q) && !email.includes(q)) return false;
    if (filter === "manager" && s.users?.role !== "manager") return false;
    if (filter === "regular" && s.staff_type !== "regular") return false;
    if (filter === "casual"  && s.staff_type !== "casual")  return false;
    if (branch && String(s.branch_id) !== branch) return false;
    return true;
  });

  const counts = {
    all:     staff.length,
    manager: staff.filter(s => s.users?.role === "manager").length,
    regular: staff.filter(s => s.staff_type === "regular").length,
    casual:  staff.filter(s => s.staff_type === "casual").length,
  };

  const TABS = [
    { key:"all",     label:"All" },
    { key:"manager", label:"Managers" },
    { key:"regular", label:"Regular" },
    { key:"casual",  label:"Casual" },
  ];

  return (
    <AdminLayout title="Staff">
      <div style={{ animation:"pageIn 0.4s ease both" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
          <div>
            <h2 style={{ fontSize:"25px", fontWeight:"800", color:"#0F172A" }}>All Staff</h2>
            <p style={{ fontSize:"20px", color:"#64748B", marginTop:"2px" }}>
              {loading ? "Loading…" : `${counts.active} active · ${counts.all} total`}
            </p>
          </div>
        </div>

        {/* Filters row */}
        <div style={{ display:"flex", gap:"12px", marginBottom:"20px", flexWrap:"wrap", alignItems:"center" }}>
          {/* Type tabs */}
          <div style={{ display:"flex", background:"#F1F5F9", borderRadius:"10px", padding:"3px", gap:"2px" }}>
            {TABS.map(t => (
              <button key={t.key} onClick={() => setFilter(t.key)}
                style={{ padding:"6px 14px", borderRadius:"8px", border:"none", fontSize:"20px", fontWeight:"600", cursor:"pointer",
                  background: filter===t.key ? "#FFF" : "transparent",
                  color: filter===t.key ? "#1E293B" : "#64748B",
                  boxShadow: filter===t.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
                {t.label} <span style={{ fontSize:"18px", color: filter===t.key?"#3B82F6":"#94A3B8", marginLeft:"4px" }}>
                  {t.key==="all"?counts.all:t.key==="regular"?counts.regular:counts.casual}
                </span>
              </button>
            ))}
          </div>

          {/* Branch filter */}
          <SearchableSelect
            options={branches.map(o => ({ value: String(o.branch_id), label: o.name }))}
            value={branch}
            onChange={setBranch}
            placeholder="All Branches"
            style={{ minWidth: "170px" }}
          />

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            style={{ flex:1, minWidth:"200px", maxWidth:"320px", padding:"8px 13px", border:"1.5px solid #E2E8F0", borderRadius:"9px", fontSize:"20px", outline:"none" }} />
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"20px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
                  <Shimmer w="44px" h="44px" r="50%" />
                  <div style={{ flex:1 }}>
                    <Shimmer w="120px" h="13px" r="5px" />
                    <div style={{ marginTop:"6px" }}><Shimmer w="160px" h="11px" r="5px" /></div>
                  </div>
                </div>
                <Shimmer w="70px" h="20px" r="100px" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"60px", textAlign:"center" }}>
            <p style={{ fontSize:"28px", marginBottom:"10px" }}><Users size={28} color="#64748B" /></p>
            <p style={{ fontSize:"22px", fontWeight:"600", color:"#64748B" }}>No staff found</p>
          </div>
        ) : (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))", gap:"16px" }}>
              {filtered.map((s, i) => {
                const name   = s.users?.full_name || "—";
                const email  = s.users?.email || "—";
                const skills = s.skillNames || [];
                return (
                  <div key={s.staff_id} className="sa-staff-card"
                    style={{ background:"#FFF", border:"1px solid #E2E8F0", borderRadius:"16px", padding:"20px",
                      boxShadow:"0 1px 4px rgba(0,0,0,0.04)", animation:`fadeSlideUp 0.3s ease ${i*0.04}s both`, cursor:"pointer" }}
                    onClick={() => goTo(`/system-admin/staff/${s.staff_id}`)}>

                    <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"14px" }}>
                      <UserAvatar name={name} avatar_url={s.users?.avatar_url} size={44} />
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:"21px", fontWeight:"700", color:"#0F172A", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</p>
                        <p style={{ fontSize:"19px", color:"#64748B", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{email}</p>
                      </div>
                    </div>

                    {/* Branch */}
                    {s.branches?.name && (
                      <p style={{ fontSize:"18px", color:"#94A3B8", marginBottom:"10px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        <MapPin size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} /> {s.branches.name}
                      </p>
                    )}

                    {/* Skill tags */}
                    {skills.length > 0 && (
                      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px", marginBottom:"12px" }}>
                        {skills.slice(0,3).map(sk => (
                          <span key={sk} style={{ fontSize:"18px", fontWeight:"600", padding:"2px 8px", borderRadius:"100px", background:"#F1F5F9", color:"#475569" }}>{sk}</span>
                        ))}
                        {skills.length > 3 && <span style={{ fontSize:"18px", color:"#94A3B8", padding:"2px 4px" }}>+{skills.length-3}</span>}
                      </div>
                    )}

                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", paddingTop:"12px", borderTop:"1px solid #F1F5F9" }}>
                      <span style={{ padding:"3px 10px", borderRadius:"100px", fontSize:"18px", fontWeight:"600",
                        background: s.staff_type==="regular"?"#DBEAFE":"#F3E8FF",
                        color: s.staff_type==="regular"?"#1E40AF":"#6B21A8" }}>
                        {s.staff_type==="regular"?"Regular":"Casual"}
                      </span>
                      <span style={{ display:"inline-flex", alignItems:"center", gap:"5px", fontSize:"19px", fontWeight:"600",
                        color: s.is_active?"#16A34A":"#94A3B8" }}>
                        <span style={{ width:"6px", height:"6px", borderRadius:"50%", background: s.is_active?"#22C55E":"#CBD5E1" }} />
                        {s.is_active?"Active":"Inactive"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p style={{ textAlign:"center", fontSize:"20px", color:"#94A3B8", marginTop:"20px" }}>
              Showing {filtered.length} of {staff.length} staff
            </p>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
