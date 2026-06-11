import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";

export default function StaffList() {
  const navigate = useNavigate();
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
        // Get user's staff record to find their outlet
        const myStaff = await api.get(`/api/staff`);
        // Filter to find the staff record for current user
        const myStaffRecord = myStaff.staff?.find(s => s.users?.user_id === userId && s.is_active);
        const oid = myStaffRecord?.outlet_id;

        if (!oid || cancelled) return;

        // Fetch all staff and skills in one parallel call
        const [staffData, skillData] = await Promise.all([
          api.get(`/api/staff`),
          api.get(`/api/skills`)
        ]);

        if (cancelled) return;

        // Backend already filters by outlet; is_active guard as safety net
        const filteredStaff = staffData.staff?.filter(s => s.is_active) || [];

        // skill tags are already nested in each staff record via user_skill_tags include
        const enriched = filteredStaff.map(s => ({
          ...s,
          skillTags: (s.users?.user_skill_tags || []).map(t => ({
            id: t.skill_id,
            name: t.skills?.name || `Skill ${t.skill_id}`
          }))
        }));

        setStaff(enriched);
        setSkills(skillData.skills || []);
      } catch (err) {
        console.error(err);
        // Fallback: try to get skills even if staff fails
        try {
          const skillData = await api.get(`/api/skills`);
          setSkills(skillData.skills || []);
        } catch (skillErr) {
          console.error(skillErr);
        }
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
    const matchSkill = filterSkill === "all" ||
      s.skillTags?.some(t => String(t.id) === filterSkill);
    return matchSearch && matchType && matchSkill;
  });

  return (
    <ManagerLayout title="Staff">
      <div style={s.headerRow}>
        <div>
          <h2 style={s.heading}>Staff Members</h2>
          <p style={s.sub}>
            {staff.length} total · {staff.filter(m => m.is_active).length} active
          </p>
        </div>
        <button style={s.addBtn} onClick={() => navigate("/outlet-manager/staff/new")}>
          + Add Staff
        </button>
      </div>

      <div style={s.filters}>
        <input style={s.search} placeholder="Search by name or email…"
          value={search} onChange={e => setSearch(e.target.value)} />
        <select style={s.select} value={filterType}
          onChange={e => setFilterType(e.target.value)}>
          <option value="all">All types</option>
          <option value="regular">Regular Staff</option>
          <option value="casual">Outlet Casual</option>
        </select>
        <select style={s.select} value={filterSkill}
          onChange={e => setFilterSkill(e.target.value)}>
          <option value="all">All skills</option>
          {skills.map(sk => (
            <option key={sk.skill_id} value={String(sk.skill_id)}>{sk.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={s.empty}>Loading staff…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No staff found.</div>
      ) : (
        <div style={s.card}>
          <div style={s.tableHead}>
            <span>Name</span><span>Email</span>
            <span>Type</span><span>Skills</span>
            <span>Status</span><span></span>
          </div>
          {filtered.map(m => (
            <div key={m.staff_id} style={s.row}>
              <div style={s.nameCell}>
                <div style={s.avatar}>
                  {m.users?.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <span style={s.name}>{m.users?.full_name || "—"}</span>
              </div>
              <span style={s.cell}>{m.users?.email || "—"}</span>
              <span>
                <span style={{
                  ...s.tag,
                  background: m.staff_type === "regular" ? "#DBEAFE" : "#F3E8FF",
                  color: m.staff_type === "regular" ? "#1E40AF" : "#6B21A8",
                }}>
                  {m.staff_type === "regular" ? "Regular" : "Casual"}
                </span>
              </span>
              <div style={s.skillsCell}>
                {m.skillTags?.length > 0
                  ? m.skillTags.slice(0, 2).map(t => (
                      <span key={t.id} style={s.skillTag}>{t.name}</span>
                    ))
                  : <span style={s.noSkill}>None</span>
                }
                {m.skillTags?.length > 2 && (
                  <span style={s.moreTag}>+{m.skillTags.length - 2}</span>
                )}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"5px", fontSize:"13px" }}>
                <span style={{ ...s.dot, background: m.is_active ? "#22C55E" : "#D1D5DB" }} />
                {m.is_active ? "Active" : "Inactive"}
              </div>
              <button style={s.viewBtn}
                onClick={() => navigate(`/outlet-manager/staff/${m.staff_id}`)}>
                View →
              </button>
            </div>
          ))}
        </div>
      )}
    </ManagerLayout>
  );
}

const s = {
  headerRow: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" },
  heading: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  sub: { fontSize:"13px", color:"#7A7870", marginTop:"2px" },
  addBtn: { background:"#1C1B18", color:"#FFFFFF", border:"none",
    padding:"10px 18px", borderRadius:"10px", fontSize:"14px",
    fontWeight:"600", cursor:"pointer" },
  filters: { display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap" },
  search: { flex:1, minWidth:"200px", padding:"9px 13px",
    border:"1.5px solid #D8D5CE", borderRadius:"9px", fontSize:"14px",
    background:"#FFFFFF", color:"#1C1B18", boxSizing:"border-box" },
  select: { padding:"9px 13px", border:"1.5px solid #D8D5CE", borderRadius:"9px",
    fontSize:"14px", background:"#FFFFFF", color:"#1C1B18", cursor:"pointer" },
  empty: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  card: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", overflow:"hidden" },
  tableHead: { display:"grid", gridTemplateColumns:"2fr 2fr 1fr 2fr 1fr 80px",
    padding:"10px 16px", background:"#F7F6F3",
    fontSize:"12px", fontWeight:"600", color:"#7A7870", gap:"8px" },
  row: { display:"grid", gridTemplateColumns:"2fr 2fr 1fr 2fr 1fr 80px",
    padding:"12px 16px", borderTop:"1px solid #F0EDE8",
    alignItems:"center", gap:"8px", fontSize:"13px", color:"#1C1B18" },
  nameCell: { display:"flex", alignItems:"center", gap:"10px" },
  avatar: { width:"32px", height:"32px", borderRadius:"50%",
    background:"#E5E2DC", color:"#55524A", display:"flex",
    alignItems:"center", justifyContent:"center",
    fontSize:"13px", fontWeight:"700", flexShrink:0 },
  name: { fontWeight:"600", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  cell: { overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" },
  tag: { display:"inline-block", padding:"2px 8px",
    borderRadius:"100px", fontSize:"11px", fontWeight:"600" },
  skillsCell: { display:"flex", flexWrap:"wrap", gap:"4px", alignItems:"center" },
  skillTag: { background:"#F0EDE8", color:"#55524A",
    padding:"2px 7px", borderRadius:"100px", fontSize:"11px", fontWeight:"500" },
  noSkill: { color:"#A09D97", fontSize:"12px" },
  moreTag: { background:"#E5E2DC", color:"#55524A",
    padding:"2px 7px", borderRadius:"100px", fontSize:"11px" },
  dot: { display:"inline-block", width:"7px", height:"7px",
    borderRadius:"50%", flexShrink:0 },
  viewBtn: { background:"none", border:"1px solid #E5E2DC", borderRadius:"7px",
    padding:"5px 10px", fontSize:"12px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },
};