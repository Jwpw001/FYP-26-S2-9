import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";

import ManagerLayout from "../../components/layout/ManagerLayout";

const STATUS_STYLES = {
  draft:     { background:"#F3F4F6", color:"#6B7280" },
  published: { background:"#DCFCE7", color:"#166534" },
  completed: { background:"#DBEAFE", color:"#1E40AF" },
  cancelled: { background:"#FEE2E2", color:"#991B1B" },
};

export default function ShiftDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shift, setShift]           = useState(null);
  const [roles, setRoles]           = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError]           = useState("");
  const [success, setSuccess]       = useState("");

  // For recommendation panel
  const [activeRole, setActiveRole]         = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loadingRec, setLoadingRec]         = useState(false);
  const [assigning, setAssigning]           = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: shiftData } = await supabase
          .from("shifts")
          .select(`
            shift_id, title, shift_date, start_time, end_time, status, outlet_id,
            outlets ( name, address )
          `)
          .eq("shift_id", id).single();

        if (!shiftData || cancelled) return;
        setShift(shiftData);

        const { data: roleData } = await supabase
          .from("shift_roles")
          .select(`
            role_id, role_name, skill_id, headcount,
            skills ( name ),
            shift_assignments (
              assignment_id, staff_id, status, acknowledged,
              users:staff_id ( user_id, full_name, email )
            )
          `)
          .eq("shift_id", id);

        if (!cancelled) {
          setRoles(roleData || []);
          const allAssignments = (roleData || [])
            .flatMap(r => (r.shift_assignments || []).map(a => ({ ...a, role_id: r.role_id })));
          setAssignments(allAssignments);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function loadRecommendations(role) {
    setActiveRole(role);
    setLoadingRec(true);
    setRecommendations([]);
    try {
      // Get staff in outlet with matching skill
      const { data: staffRows } = await supabase
        .from("staff")
        .select(`
          staff_id, staff_type, is_active,
          users ( user_id, full_name, email ),
          user_skill_tags:users!inner ( user_skill_tags ( skill_id ) )
        `)
        .eq("outlet_id", shift.outlet_id)
        .eq("is_active", true);

      // Get already assigned staff for this shift
      const assignedStaffIds = assignments.map(a => a.staff_id).filter(Boolean);

      // Get leave requests that overlap with shift date
      const { data: leaveRows } = await supabase
        .from("availability")
        .select("staff_id")
        .eq("status", "approved")
        .lte("start_date", shift.shift_date)
        .gte("end_date", shift.shift_date);

      const onLeaveIds = (leaveRows || []).map(l => l.staff_id);

      // Filter and score candidates
      const candidates = (staffRows || [])
        .map(staff => {
          const userId = staff.users?.user_id;
          const skillIds = staff.users?.user_skill_tags?.flatMap(u =>
            u.user_skill_tags?.map(t => t.skill_id) || []
          ) || [];

          const hasSkill = !role.skill_id || skillIds.includes(role.skill_id);
          const isOnLeave = onLeaveIds.includes(staff.staff_id);
          const isAssigned = assignedStaffIds.includes(staff.staff_id);

          if (!hasSkill || isOnLeave || isAssigned) return null;

          return {
            staff_id: staff.staff_id,
            user_id: userId,
            full_name: staff.users?.full_name,
            email: staff.users?.email,
            hasSkill,
            staff_type: staff.staff_type,
            reason: `${hasSkill ? "✓ Skill match" : ""}${staff.staff_type === "regular" ? " · Regular staff" : " · Casual staff"}`,
          };
        })
        .filter(Boolean);

      setRecommendations(candidates);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRec(false);
    }
  }

  async function assignStaff(staffId, roleId) {
    setAssigning(true);
    try {
      const { error: err } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: Number(id),
          role_id: roleId,
          staff_id: staffId,
          status: "assigned",
          acknowledged: false,
        });

      if (err) throw err;

      // Refresh
      const { data: roleData } = await supabase
        .from("shift_roles")
        .select(`
          role_id, role_name, skill_id, headcount,
          skills ( name ),
          shift_assignments (
            assignment_id, staff_id, status, acknowledged,
            users:staff_id ( user_id, full_name, email )
          )
        `)
        .eq("shift_id", id);

      setRoles(roleData || []);
      setActiveRole(null);
      setRecommendations([]);
      setSuccess("Staff assigned successfully.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError("Failed to assign staff.");
      console.error(err);
    } finally {
      setAssigning(false);
    }
  }

  async function removeAssignment(assignmentId) {
    await supabase.from("shift_assignments")
      .delete().eq("assignment_id", assignmentId);

    setRoles(prev => prev.map(r => ({
      ...r,
      shift_assignments: (r.shift_assignments || [])
        .filter(a => a.assignment_id !== assignmentId)
    })));
    setSuccess("Assignment removed.");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handlePublish() {
    // Conflict checks
    const conflicts = [];
    for (const role of roles) {
      const assigned = role.shift_assignments?.length || 0;
      if (assigned < (role.headcount || 1)) {
        conflicts.push(`Role "${role.role_name}" is understaffed (${assigned}/${role.headcount || 1})`);
      }
    }

    if (conflicts.length > 0) {
      const proceed = window.confirm(
        `Warning:\n${conflicts.join("\n")}\n\nPublish anyway?`
      );
      if (!proceed) return;
    }

    setPublishing(true);
    const { error: err } = await supabase
      .from("shifts")
      .update({ status: "published" })
      .eq("shift_id", id);

    setPublishing(false);
    if (err) { setError("Failed to publish."); return; }
    setShift(prev => ({ ...prev, status: "published" }));
    setSuccess("Shift published successfully!");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleUnpublish() {
    await supabase.from("shifts").update({ status: "draft" }).eq("shift_id", id);
    setShift(prev => ({ ...prev, status: "draft" }));
    setSuccess("Shift moved back to draft.");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;
    await supabase.from("shifts").delete().eq("shift_id", id);
    navigate("/outlet-manager/shifts");
  }

  if (loading) {
    return (
      <ManagerLayout title="Shift Detail">
        <div style={s.loading}>Loading shift…</div>
      </ManagerLayout>
    );
  }

  if (!shift) {
    return (
      <ManagerLayout title="Shift Detail">
        <div style={s.loading}>Shift not found.</div>
      </ManagerLayout>
    );
  }

  const totalRoles = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
  const totalAssigned = roles.reduce((sum, r) =>
    sum + (r.shift_assignments?.length || 0), 0);
  const isFullyStaffed = totalAssigned >= totalRoles;

  return (
    <ManagerLayout title="Shift Detail">
      <button style={s.back} onClick={() => navigate("/outlet-manager/shifts")}>
        ← Back to Shifts
      </button>

      {error   && <div style={s.error}>{error}</div>}
      {success && <div style={s.successMsg}>{success}</div>}

      {/* Shift info header */}
      <div style={s.shiftCard}>
        <div style={s.shiftCardTop}>
          <div>
            <div style={s.shiftTitleRow}>
              <h2 style={s.shiftTitle}>{shift.title || "Untitled Shift"}</h2>
              <span style={{ ...s.badge, ...STATUS_STYLES[shift.status] }}>
                {shift.status}
              </span>
            </div>
            <p style={s.shiftMeta}>
              {fmtDate(shift.shift_date)} · {shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}
              {shift.outlets?.name && ` · ${shift.outlets.name}`}
            </p>
          </div>
          <div style={s.shiftActions}>
            {shift.status === "draft" && (
              <>
                <button style={s.deleteBtn} onClick={handleDelete}>Delete</button>
                <button
                  style={{ ...s.publishBtn, ...(isFullyStaffed ? {} : s.publishBtnWarn) }}
                  onClick={handlePublish} disabled={publishing}>
                  {publishing ? "Publishing…" : "Publish Shift"}
                </button>
              </>
            )}
            {shift.status === "published" && (
              <button style={s.unpublishBtn} onClick={handleUnpublish}>
                Move to Draft
              </button>
            )}
          </div>
        </div>

        {/* Staffing summary */}
        <div style={s.staffingSummary}>
          <div style={s.staffingBar}>
            <div style={{
              ...s.staffingFill,
              width: totalRoles > 0 ? `${Math.min(100, (totalAssigned / totalRoles) * 100)}%` : "0%",
              background: isFullyStaffed ? "#22C55E" : "#F59E0B",
            }} />
          </div>
          <span style={s.staffingText}>
            {totalAssigned}/{totalRoles} positions filled
            {isFullyStaffed && " ✓ Ready to publish"}
          </span>
        </div>
      </div>

      <div style={s.layout}>
        {/* Roles & assignments */}
        <div style={s.rolesSection}>
          <h3 style={s.sectionTitle}>Roles & Assignments</h3>
          {roles.length === 0 ? (
            <div style={s.empty}>No roles defined for this shift.</div>
          ) : (
            roles.map(role => {
              const filled = role.shift_assignments?.length || 0;
              const needed = role.headcount || 1;
              const isFull = filled >= needed;
              return (
                <div key={role.role_id} style={s.roleCard}>
                  <div style={s.roleCardTop}>
                    <div>
                      <p style={s.roleName}>{role.role_name}</p>
                      <p style={s.roleMeta}>
                        {role.skills?.name && `Requires: ${role.skills.name} · `}
                        {filled}/{needed} filled
                      </p>
                    </div>
                    <div style={s.roleActions}>
                      <span style={{
                        ...s.fillBadge,
                        background: isFull ? "#DCFCE7" : "#FFFBEB",
                        color: isFull ? "#166534" : "#D97706",
                      }}>
                        {isFull ? "✓ Full" : `${needed - filled} needed`}
                      </span>
                      {!isFull && shift.status !== "published" && (
                        <button style={s.recommendBtn}
                          onClick={() => loadRecommendations(role)}>
                          Recommend Staff
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Assigned staff */}
                  {(role.shift_assignments || []).map(a => (
                    <div key={a.assignment_id} style={s.assignedRow}>
                      <div style={s.assignedAvatar}>
                        {a.staff?.users?.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div style={s.assignedInfo}>
                        <p style={s.assignedName}>{a.staff?.users?.full_name || "Unknown"}</p>
                        <p style={s.assignedEmail}>{a.staff?.users?.email}</p>
                      </div>
                      <div style={s.assignedRight}>
                        {a.acknowledged && (
                          <span style={s.ackTag}>✓ Acknowledged</span>
                        )}
                        {shift.status === "draft" && (
                          <button style={s.removeAssignBtn}
                            onClick={() => removeAssignment(a.assignment_id)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {filled === 0 && (
                    <div style={s.emptyRole}>No staff assigned yet.</div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Recommendation panel */}
        {activeRole && (
          <div style={s.recPanel}>
            <div style={s.recPanelHeader}>
              <h3 style={s.sectionTitle}>
                Staff for "{activeRole.role_name}"
              </h3>
              <button style={s.closeBtn} onClick={() => setActiveRole(null)}>✕</button>
            </div>

            {loadingRec ? (
              <div style={s.empty}>Finding recommendations…</div>
            ) : recommendations.length === 0 ? (
              <div style={s.empty}>No available staff found for this role.</div>
            ) : (
              <div style={s.recList}>
                {recommendations.map((rec, i) => (
                  <div key={rec.staff_id} style={s.recCard}>
                    <div style={s.recRank}>#{i + 1}</div>
                    <div style={s.recInfo}>
                      <p style={s.recName}>{rec.full_name}</p>
                      <p style={s.recReason}>{rec.reason}</p>
                    </div>
                    <button style={s.assignBtn}
                      onClick={() => assignStaff(rec.staff_id, activeRole.role_id)}
                      disabled={assigning}>
                      {assigning ? "…" : "Assign"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", {
    weekday:"long", year:"numeric", month:"long", day:"numeric",
  });
}

const s = {
  loading: { textAlign:"center", padding:"60px", color:"#7A7870", fontSize:"14px" },
  back: { background:"none", border:"none", fontSize:"13px", fontWeight:"600",
    color:"#7A7870", cursor:"pointer", marginBottom:"20px", padding:0 },
  error: { background:"#FEF2F2", border:"1px solid #FECACA", color:"#991B1B",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },
  successMsg: { background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534",
    padding:"10px 12px", borderRadius:"9px", fontSize:"13px", marginBottom:"16px" },

  /* Shift header card */
  shiftCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", marginBottom:"20px" },
  shiftCardTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"16px", flexWrap:"wrap", gap:"12px" },
  shiftTitleRow: { display:"flex", alignItems:"center", gap:"10px", marginBottom:"6px" },
  shiftTitle: { fontSize:"20px", fontWeight:"800", color:"#1C1B18" },
  badge: { display:"inline-block", padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600", textTransform:"capitalize" },
  shiftMeta: { fontSize:"14px", color:"#7A7870" },
  shiftActions: { display:"flex", gap:"8px", flexWrap:"wrap" },
  deleteBtn: { background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:"9px",
    padding:"8px 14px", fontSize:"13px", fontWeight:"600",
    color:"#991B1B", cursor:"pointer" },
  publishBtn: { background:"#1C1B18", border:"none", borderRadius:"9px",
    padding:"8px 16px", fontSize:"13px", fontWeight:"700",
    color:"#FFFFFF", cursor:"pointer" },
  publishBtnWarn: { background:"#D97706" },
  unpublishBtn: { background:"#F7F6F3", border:"1px solid #E5E2DC", borderRadius:"9px",
    padding:"8px 14px", fontSize:"13px", fontWeight:"600",
    color:"#1C1B18", cursor:"pointer" },

  /* Staffing bar */
  staffingSummary: { display:"flex", alignItems:"center", gap:"12px" },
  staffingBar: { flex:1, height:"6px", background:"#F0EDE8", borderRadius:"100px",
    overflow:"hidden" },
  staffingFill: { height:"100%", borderRadius:"100px",
    transition:"width 0.3s ease" },
  staffingText: { fontSize:"13px", color:"#55524A", fontWeight:"500",
    whiteSpace:"nowrap" },

  layout: { display:"grid", gridTemplateColumns: "1fr auto",
    gap:"20px", alignItems:"start" },
  rolesSection: { minWidth:0 },
  sectionTitle: { fontSize:"15px", fontWeight:"700", color:"#1C1B18", marginBottom:"14px" },
  empty: { textAlign:"center", padding:"24px", color:"#7A7870", fontSize:"14px" },

  /* Role cards */
  roleCard: { background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"12px", padding:"16px", marginBottom:"12px" },
  roleCardTop: { display:"flex", justifyContent:"space-between",
    alignItems:"flex-start", marginBottom:"12px", flexWrap:"wrap", gap:"8px" },
  roleName: { fontSize:"15px", fontWeight:"700", color:"#1C1B18" },
  roleMeta: { fontSize:"12px", color:"#7A7870", marginTop:"2px" },
  roleActions: { display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" },
  fillBadge: { padding:"3px 8px", borderRadius:"100px",
    fontSize:"11px", fontWeight:"600" },
  recommendBtn: { background:"#EFF6FF", border:"1px solid #BFDBFE",
    borderRadius:"7px", padding:"5px 10px", fontSize:"12px",
    fontWeight:"600", color:"#1D4ED8", cursor:"pointer" },

  /* Assigned staff */
  assignedRow: { display:"flex", alignItems:"center", gap:"10px",
    padding:"8px 10px", background:"#F7F6F3", borderRadius:"8px",
    marginBottom:"6px" },
  assignedAvatar: { width:"28px", height:"28px", borderRadius:"50%",
    background:"#E5E2DC", color:"#55524A", display:"flex",
    alignItems:"center", justifyContent:"center",
    fontSize:"12px", fontWeight:"700", flexShrink:0 },
  assignedInfo: { flex:1 },
  assignedName: { fontSize:"13px", fontWeight:"600", color:"#1C1B18" },
  assignedEmail: { fontSize:"11px", color:"#7A7870" },
  assignedRight: { display:"flex", alignItems:"center", gap:"6px" },
  ackTag: { fontSize:"11px", color:"#059669", fontWeight:"600" },
  removeAssignBtn: { background:"none", border:"none", fontSize:"12px",
    color:"#991B1B", cursor:"pointer", fontWeight:"600" },
  emptyRole: { fontSize:"12px", color:"#A09D97", textAlign:"center",
    padding:"8px" },

  /* Recommendation panel */
  recPanel: { width:"320px", background:"#FFFFFF", border:"1px solid #E5E2DC",
    borderRadius:"14px", padding:"20px", position:"sticky", top:"80px" },
  recPanelHeader: { display:"flex", justifyContent:"space-between",
    alignItems:"center", marginBottom:"14px" },
  closeBtn: { background:"none", border:"none", fontSize:"16px",
    color:"#7A7870", cursor:"pointer", padding:"2px 6px" },
  recList: { display:"flex", flexDirection:"column", gap:"8px" },
  recCard: { display:"flex", alignItems:"center", gap:"10px",
    padding:"10px 12px", background:"#F7F6F3",
    borderRadius:"10px" },
  recRank: { fontSize:"12px", fontWeight:"700", color:"#A09D97",
    minWidth:"20px" },
  recInfo: { flex:1 },
  recName: { fontSize:"13px", fontWeight:"600", color:"#1C1B18" },
  recReason: { fontSize:"11px", color:"#059669", marginTop:"2px" },
  assignBtn: { background:"#1C1B18", border:"none", borderRadius:"7px",
    padding:"6px 12px", fontSize:"12px", fontWeight:"600",
    color:"#FFFFFF", cursor:"pointer", flexShrink:0 },
};
