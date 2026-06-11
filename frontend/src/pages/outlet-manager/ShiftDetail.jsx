import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-shift-detail-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-shift-detail-styles";
  style.textContent = `
    @keyframes fadeSlideUp {
      from { opacity: 0; transform: translateY(18px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      from { background-position: -600px 0; }
      to   { background-position:  600px 0; }
    }
    @keyframes modalIn {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

const STATUS_STYLES = {
  draft:     { background:"#F3F4F6", color:"#6B7280" },
  published: { background:"#DCFCE7", color:"#166534" },
  completed: { background:"#DBEAFE", color:"#1E40AF" },
  cancelled: { background:"#FEE2E2", color:"#991B1B" },
};

function Shimmer({ w = "100%", h = "16px", r = "8px" }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: r,
      background: "linear-gradient(90deg,#F1F5F9 25%,#E2E8F0 50%,#F1F5F9 75%)",
      backgroundSize: "600px 100%",
      animation: "shimmer 1.4s infinite linear",
    }} />
  );
}

async function fetchEnrichedAssignments(shiftId) {
  const { data: assignData } = await supabase
    .from("shift_assignments")
    .select(`assignment_id, role_id, staff_id, status, acknowledged`)
    .eq("shift_id", shiftId);

  const staffIds = (assignData || []).map(a => a.staff_id).filter(Boolean);
  let staffUserMap = {};

  if (staffIds.length > 0) {
    const { data: staffRows } = await supabase
      .from("staff")
      .select(`staff_id, user_id`)
      .in("staff_id", staffIds);

    const userIds = (staffRows || []).map(s => s.user_id).filter(Boolean);
    let userMap = {};

    if (userIds.length > 0) {
      const { data: userRows } = await supabase
        .from("users")
        .select(`user_id, full_name, email`)
        .in("user_id", userIds);
      (userRows || []).forEach(u => { userMap[u.user_id] = u; });
    }

    (staffRows || []).forEach(s => {
      staffUserMap[s.staff_id] = userMap[s.user_id] || {};
    });
  }

  return (assignData || []).map(a => ({
    ...a,
    userInfo: staffUserMap[a.staff_id] || {},
  }));
}

export default function ShiftDetail() {
  const { id } = useParams();
  const goTo = useGoTo();

  const [shift, setShift]             = useState(null);
  const [roles, setRoles]             = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [publishing, setPublishing]   = useState(false);
  const [toast, setToast]             = useState(null);

  // Assign modal state
  const [assignModal, setAssignModal]         = useState(null); // { role }
  const [candidates, setCandidates]           = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [assigning, setAssigning]             = useState(false);

  // Conflict modal state
  const [conflictModal, setConflictModal] = useState(null); // { hardBlocks, warnings }

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { data: shiftData } = await supabase
          .from("shifts")
          .select(`shift_id, title, shift_date, start_time, end_time, status, outlet_id, outlets ( name, address )`)
          .eq("shift_id", id).single();
        if (!shiftData || cancelled) return;
        setShift(shiftData);

        const { data: roleData } = await supabase
          .from("shift_roles")
          .select(`role_id, role_name, skill_id, headcount, skills ( name )`)
          .eq("shift_id", id);

        const enriched = await fetchEnrichedAssignments(id);

        if (!cancelled) {
          const rolesWithAssignments = (roleData || []).map(role => ({
            ...role,
            shift_assignments: enriched.filter(a => a.role_id === role.role_id),
          }));
          setRoles(rolesWithAssignments);
          setAssignments(enriched);
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

  // ── Open assign modal ──────────────────────────────────────────────────────
  async function openAssignModal(role) {
    setAssignModal({ role });
    setLoadingCandidates(true);
    setCandidates([]);
    try {
      // Fetch active staff in outlet
      const { data: staffRows } = await supabase
        .from("staff")
        .select(`staff_id, staff_type, user_id`)
        .eq("outlet_id", shift.outlet_id)
        .eq("is_active", true);

      const userIds = (staffRows || []).map(s => s.user_id).filter(Boolean);
      const staffIds = (staffRows || []).map(s => s.staff_id);

      // Fetch user info
      let userMap = {};
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users").select(`user_id, full_name, email`).in("user_id", userIds);
        (userRows || []).forEach(u => { userMap[u.user_id] = u; });
      }

      // Fetch skill tags
      let skillMap = {};
      if (userIds.length > 0) {
        const { data: skillRows } = await supabase
          .from("user_skill_tags").select(`user_id, skill_id`).in("user_id", userIds);
        (skillRows || []).forEach(r => {
          if (!skillMap[r.user_id]) skillMap[r.user_id] = [];
          skillMap[r.user_id].push(r.skill_id);
        });
      }

      // Fetch approved leave on shift date
      const { data: leaveRows } = await supabase
        .from("availability")
        .select("staff_id")
        .eq("status", "approved")
        .lte("start_date", shift.shift_date)
        .gte("end_date", shift.shift_date);
      const onLeaveIds = new Set((leaveRows || []).map(l => l.staff_id));

      // Fetch staff assigned to other shifts on same date (double-booking check)
      const { data: otherAssignRows } = await supabase
        .from("shift_assignments")
        .select(`staff_id, shifts!inner(shift_date)`)
        .neq("shift_id", Number(id));
      const doubleBookedIds = new Set(
        (otherAssignRows || [])
          .filter(a => a.shifts?.shift_date === shift.shift_date)
          .map(a => a.staff_id)
      );

      // Already assigned to THIS shift
      const assignedStaffIds = new Set(assignments.map(a => a.staff_id).filter(Boolean));

      const result = (staffRows || [])
        .map(staff => {
          const user = userMap[staff.user_id] || {};
          const skillIds = skillMap[staff.user_id] || [];
          const hasSkill = !role.skill_id || skillIds.includes(role.skill_id);
          const isOnLeave = onLeaveIds.has(staff.staff_id);
          const isDoubleBooked = doubleBookedIds.has(staff.staff_id);
          const isAlreadyAssigned = assignedStaffIds.has(staff.staff_id);

          if (isAlreadyAssigned) return null; // already on this shift

          let score = 0;
          const badges = [];

          if (hasSkill) { score += 10; badges.push("skill"); }
          if (!isOnLeave) score += 5;
          if (!isDoubleBooked) score += 3;

          if (isOnLeave) badges.push("leave");
          if (isDoubleBooked) badges.push("double");

          return {
            staff_id: staff.staff_id,
            full_name: user.full_name || user.email || "Unknown",
            email: user.email || "",
            staff_type: staff.staff_type,
            hasSkill,
            isOnLeave,
            isDoubleBooked,
            score,
            badges,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score);

      setCandidates(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCandidates(false);
    }
  }

  // ── Assign staff ──────────────────────────────────────────────────────────
  async function assignStaff(staffId, roleId) {
    setAssigning(true);
    try {
      const { error: err } = await supabase.from("shift_assignments").insert({
        shift_id: Number(id),
        role_id: roleId,
        staff_id: staffId,
        status: "assigned",
        acknowledged: false,
      });
      if (err) throw err;

      const { data: roleData } = await supabase
        .from("shift_roles")
        .select(`role_id, role_name, skill_id, headcount, skills ( name )`)
        .eq("shift_id", id);

      const enriched = await fetchEnrichedAssignments(id);
      const rolesWithAssignments = (roleData || []).map(role => ({
        ...role,
        shift_assignments: enriched.filter(a => a.role_id === role.role_id),
      }));
      setRoles(rolesWithAssignments);
      setAssignments(enriched);
      setAssignModal(null);
      setCandidates([]);
      showToast("Staff assigned successfully.");
    } catch (err) {
      showToast("Failed to assign staff.", "error");
      console.error(err);
    } finally {
      setAssigning(false);
    }
  }

  // ── Remove assignment ─────────────────────────────────────────────────────
  async function removeAssignment(assignmentId) {
    await supabase.from("shift_assignments").delete().eq("assignment_id", assignmentId);
    setRoles(prev => prev.map(r => ({
      ...r,
      shift_assignments: (r.shift_assignments || []).filter(a => a.assignment_id !== assignmentId),
    })));
    setAssignments(prev => prev.filter(a => a.assignment_id !== assignmentId));
    showToast("Assignment removed.");
  }

  // ── Publish with conflict checks ──────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true);
    try {
      const hardBlocks = [];
      const warnings = [];

      // Understaffing check
      for (const role of roles) {
        const filled = role.shift_assignments?.length || 0;
        if (filled < (role.headcount || 1)) {
          warnings.push(`Role "${role.role_name}" is understaffed (${filled}/${role.headcount || 1})`);
        }
      }

      // Get all assigned staff IDs
      const allAssignedIds = assignments.map(a => a.staff_id).filter(Boolean);

      if (allAssignedIds.length > 0) {
        // Hard block: approved leave overlap
        const { data: leaveRows } = await supabase
          .from("availability")
          .select("staff_id")
          .eq("status", "approved")
          .lte("start_date", shift.shift_date)
          .gte("end_date", shift.shift_date)
          .in("staff_id", allAssignedIds);

        const leaveConflictIds = new Set((leaveRows || []).map(l => l.staff_id));

        if (leaveConflictIds.size > 0) {
          // Get names for those staff
          const conflictAssignments = assignments.filter(a => leaveConflictIds.has(a.staff_id));
          conflictAssignments.forEach(a => {
            hardBlocks.push(`${a.userInfo?.full_name || "Unknown"} has approved leave on this date`);
          });
        }

        // Warning: double-booking on same date in other shifts
        const { data: otherShiftAssigns } = await supabase
          .from("shift_assignments")
          .select(`staff_id, shifts!inner(shift_date, title)`)
          .neq("shift_id", Number(id))
          .in("staff_id", allAssignedIds);

        (otherShiftAssigns || [])
          .filter(a => a.shifts?.shift_date === shift.shift_date)
          .forEach(a => {
            const found = assignments.find(x => x.staff_id === a.staff_id);
            const name = found?.userInfo?.full_name || "Unknown";
            warnings.push(`${name} is also assigned to "${a.shifts?.title || "another shift"}" on the same date`);
          });
      }

      if (hardBlocks.length > 0 || warnings.length > 0) {
        setPublishing(false);
        setConflictModal({ hardBlocks, warnings });
        return;
      }

      // No conflicts — publish
      await doPublish();
    } catch (err) {
      showToast("Failed to check conflicts.", "error");
      console.error(err);
      setPublishing(false);
    }
  }

  async function doPublish() {
    setPublishing(true);
    const { error: err } = await supabase.from("shifts").update({ status: "published" }).eq("shift_id", id);
    setPublishing(false);
    if (err) { showToast("Failed to publish.", "error"); return; }
    setShift(prev => ({ ...prev, status: "published" }));
    showToast("Shift published successfully!");
    setConflictModal(null);
  }

  async function handleUnpublish() {
    await supabase.from("shifts").update({ status: "draft" }).eq("shift_id", id);
    setShift(prev => ({ ...prev, status: "draft" }));
    showToast("Shift moved back to draft.");
  }

  async function handleDelete() {
    if (!window.confirm("Delete this shift? This cannot be undone.")) return;
    await supabase.from("shifts").delete().eq("shift_id", id);
    goTo("/outlet-manager/shifts");
  }

  if (loading) {
    return (
      <ManagerLayout title="Shift Detail">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <Shimmer w="120px" h="14px" />
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "24px" }}>
            <Shimmer w="200px" h="22px" r="6px" />
            <div style={{ marginTop: "10px" }}><Shimmer w="300px" h="14px" /></div>
          </div>
          {[1,2].map(i => (
            <div key={i} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px" }}>
              <Shimmer w="150px" h="16px" />
              <div style={{ marginTop: "12px" }}><Shimmer w="100%" h="48px" r="10px" /></div>
            </div>
          ))}
        </div>
      </ManagerLayout>
    );
  }

  if (!shift) return <ManagerLayout title="Shift Detail"><div style={s.empty}>Shift not found.</div></ManagerLayout>;

  const totalRoles    = roles.reduce((sum, r) => sum + (r.headcount || 1), 0);
  const totalAssigned = roles.reduce((sum, r) => sum + (r.shift_assignments?.length || 0), 0);
  const isFullyStaffed = totalAssigned >= totalRoles;

  return (
    <ManagerLayout title="Shift Detail">
      <button style={s.back} onClick={() => goTo("/outlet-manager/shifts")}>← Back to Shifts</button>

      <div style={s.shiftCard}>
        <div style={s.shiftCardTop}>
          <div>
            <div style={s.shiftTitleRow}>
              <h2 style={s.shiftTitle}>{shift.title || "Untitled Shift"}</h2>
              <span style={{ ...s.badge, ...STATUS_STYLES[shift.status] }}>{shift.status}</span>
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
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  {publishing ? "Checking…" : "Publish Shift"}
                </button>
              </>
            )}
            {shift.status === "published" && (
              <button style={s.unpublishBtn} onClick={handleUnpublish}>Move to Draft</button>
            )}
          </div>
        </div>
        <div style={s.staffingSummary}>
          <div style={s.staffingBar}>
            <div style={{
              ...s.staffingFill,
              width: totalRoles > 0 ? `${Math.min(100, (totalAssigned / totalRoles) * 100)}%` : "0%",
              background: isFullyStaffed ? "#22C55E" : "#F59E0B",
            }} />
          </div>
          <span style={s.staffingText}>
            {totalAssigned}/{totalRoles} positions filled{isFullyStaffed && " · ✓ Ready to publish"}
          </span>
        </div>
      </div>

      <h3 style={s.sectionTitle}>Roles & Assignments</h3>

      {roles.length === 0 ? (
        <div style={s.empty}>No roles defined for this shift.</div>
      ) : (
        roles.map(role => {
          const filled = role.shift_assignments?.length || 0;
          const needed = role.headcount || 1;
          const isFull = filled >= needed;
          return (
            <div key={role.role_id} style={{ ...s.roleCard, animation: "fadeSlideUp 0.3s ease both" }}>
              <div style={s.roleCardTop}>
                <div>
                  <p style={s.roleName}>{role.role_name}</p>
                  <p style={s.roleMeta}>
                    {role.skills?.name ? `Requires: ${role.skills.name} · ` : ""}{filled}/{needed} filled
                  </p>
                </div>
                <div style={s.roleActions}>
                  <span style={{ ...s.fillBadge, background: isFull ? "#DCFCE7" : "#FFFBEB", color: isFull ? "#166534" : "#D97706" }}>
                    {isFull ? "✓ Full" : `${needed - filled} needed`}
                  </span>
                  {shift.status !== "completed" && shift.status !== "cancelled" && (
                    <button style={s.assignBtn} onClick={() => openAssignModal(role)}>
                      Assign Staff
                    </button>
                  )}
                </div>
              </div>

              {(role.shift_assignments || []).map(a => (
                <div key={a.assignment_id} style={s.assignedRow}>
                  <div style={s.assignedAvatar}>
                    {a.userInfo?.full_name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={s.assignedInfo}>
                    <p style={s.assignedName}>{a.userInfo?.full_name || a.userInfo?.email || "Unknown"}</p>
                    <p style={s.assignedEmail}>{a.userInfo?.email}</p>
                  </div>
                  <div style={s.assignedRight}>
                    {a.acknowledged
                      ? <span style={s.ackTagYes}>✓ Acknowledged</span>
                      : <span style={s.ackTagNo}>Pending acknowledgement</span>
                    }
                    {shift.status === "draft" && (
                      <button style={s.removeBtn} onClick={() => removeAssignment(a.assignment_id)}>✕</button>
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

      {/* ── Assign Staff Modal ─────────────────────────────────────────────── */}
      {assignModal && (
        <div style={s.modalOverlay} onClick={() => setAssignModal(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Assign Staff — {assignModal.role.role_name}</h3>
              <button style={s.closeBtn} onClick={() => setAssignModal(null)}>✕</button>
            </div>

            {assignModal.role.skills?.name && (
              <p style={s.modalSubtitle}>Required skill: <strong>{assignModal.role.skills.name}</strong></p>
            )}

            {loadingCandidates ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "12px" }}>
                {[1,2,3].map(i => <Shimmer key={i} h="56px" r="10px" />)}
              </div>
            ) : candidates.length === 0 ? (
              <div style={s.empty}>No available staff found for this role.</div>
            ) : (
              <div style={s.candidateList}>
                {candidates.map((c, i) => {
                  const isTop = i < 3 && c.hasSkill && !c.isOnLeave && !c.isDoubleBooked;
                  const isUnavailable = c.isOnLeave || c.isDoubleBooked;
                  return (
                    <div key={c.staff_id} style={{
                      ...s.candidateRow,
                      opacity: isUnavailable ? 0.6 : 1,
                      borderColor: isTop ? "#BFDBFE" : "#E2E8F0",
                      background: isTop ? "#F0F7FF" : "#FAFAFA",
                    }}>
                      <div style={s.candidateAvatar}>
                        {c.full_name[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <p style={s.candidateName}>{c.full_name}</p>
                          {isTop && (
                            <span style={s.recBadge}>✓ Recommended</span>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "3px" }}>
                          {!c.hasSkill && <span style={s.warningTag}>Missing skill</span>}
                          {c.isOnLeave && <span style={s.warningTag}>On leave</span>}
                          {c.isDoubleBooked && <span style={s.warningTag}>Double-booked</span>}
                          {c.hasSkill && !c.isOnLeave && !c.isDoubleBooked && (
                            <span style={s.okTag}>
                              {c.staff_type === "regular" ? "Regular staff" : "Casual staff"}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        style={{ ...s.doAssignBtn, opacity: assigning ? 0.6 : 1 }}
                        onClick={() => assignStaff(c.staff_id, assignModal.role.role_id)}
                        disabled={assigning}
                      >
                        {assigning ? "…" : "Assign"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Conflict Modal ─────────────────────────────────────────────────── */}
      {conflictModal && (
        <div style={s.modalOverlay}>
          <div style={{ ...s.modal, maxWidth: "480px" }}>
            <div style={s.modalHeader}>
              <h3 style={{ ...s.modalTitle, color: "#991B1B" }}>⚠ Publish Conflicts</h3>
              <button style={s.closeBtn} onClick={() => setConflictModal(null)}>✕</button>
            </div>

            {conflictModal.hardBlocks.length > 0 && (
              <div style={s.conflictBlock}>
                <p style={s.conflictBlockTitle}>Cannot publish — hard blocks:</p>
                {conflictModal.hardBlocks.map((b, i) => (
                  <div key={i} style={s.conflictItem}>
                    <span style={s.conflictDot} />
                    <span style={{ fontSize: "13px", color: "#7F1D1D" }}>{b}</span>
                  </div>
                ))}
              </div>
            )}

            {conflictModal.warnings.length > 0 && (
              <div style={{ ...s.conflictBlock, background: "#FFFBEB", borderColor: "#FDE68A" }}>
                <p style={{ ...s.conflictBlockTitle, color: "#92400E" }}>Warnings (can override):</p>
                {conflictModal.warnings.map((w, i) => (
                  <div key={i} style={s.conflictItem}>
                    <span style={{ ...s.conflictDot, background: "#F59E0B" }} />
                    <span style={{ fontSize: "13px", color: "#78350F" }}>{w}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "16px" }}>
              <button style={s.cancelConflictBtn} onClick={() => setConflictModal(null)}>Cancel</button>
              {conflictModal.hardBlocks.length === 0 && (
                <button style={s.overrideBtn} onClick={doPublish} disabled={publishing}>
                  {publishing ? "Publishing…" : "Publish Anyway"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 9999,
          background: toast.type === "success" ? "#22C55E" : "#EF4444",
          color: "#fff", padding: "12px 20px", borderRadius: "10px",
          fontSize: "14px", fontWeight: "600",
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          animation: "toastIn 0.3s ease both",
        }}>
          {toast.msg}
        </div>
      )}
    </ManagerLayout>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

const s = {
  back: { background: "none", border: "none", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer", marginBottom: "20px", padding: 0 },
  empty: { textAlign: "center", padding: "40px", color: "#64748B", fontSize: "14px" },
  shiftCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "20px", marginBottom: "24px" },
  shiftCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "12px" },
  shiftTitleRow: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" },
  shiftTitle: { fontSize: "20px", fontWeight: "800", color: "#1E293B" },
  badge: { display: "inline-block", padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", textTransform: "capitalize" },
  shiftMeta: { fontSize: "14px", color: "#64748B" },
  shiftActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  deleteBtn: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: "#991B1B", cursor: "pointer" },
  publishBtn: { background: "#2563EB", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: "pointer" },
  publishBtnWarn: { background: "#D97706" },
  unpublishBtn: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "9px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: "#1E293B", cursor: "pointer" },
  staffingSummary: { display: "flex", alignItems: "center", gap: "12px" },
  staffingBar: { flex: 1, height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" },
  staffingFill: { height: "100%", borderRadius: "100px", transition: "width 0.3s ease" },
  staffingText: { fontSize: "13px", color: "#64748B", fontWeight: "500", whiteSpace: "nowrap" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "14px" },
  roleCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", marginBottom: "12px" },
  roleCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" },
  roleName: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  roleMeta: { fontSize: "12px", color: "#64748B", marginTop: "2px" },
  roleActions: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  fillBadge: { padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" },
  assignBtn: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "7px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" },
  assignedRow: { display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "#F8FAFC", borderRadius: "8px", marginBottom: "6px" },
  assignedAvatar: { width: "28px", height: "28px", borderRadius: "50%", background: "#E2E8F0", color: "#64748B", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "700", flexShrink: 0 },
  assignedInfo: { flex: 1 },
  assignedName: { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  assignedEmail: { fontSize: "11px", color: "#64748B" },
  assignedRight: { display: "flex", alignItems: "center", gap: "6px" },
  ackTagYes: { fontSize: "11px", color: "#059669", fontWeight: "600", background: "#ECFDF5", padding: "2px 7px", borderRadius: "100px" },
  ackTagNo: { fontSize: "11px", color: "#D97706", fontWeight: "500", background: "#FFFBEB", padding: "2px 7px", borderRadius: "100px" },
  removeBtn: { background: "none", border: "none", fontSize: "13px", color: "#94A3B8", cursor: "pointer", padding: "2px 5px", fontWeight: "600", lineHeight: 1 },
  emptyRole: { fontSize: "12px", color: "#94A3B8", textAlign: "center", padding: "10px" },
  // Modal
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" },
  modal: { background: "#FFFFFF", borderRadius: "16px", padding: "28px", width: "100%", maxWidth: "560px", maxHeight: "80vh", overflowY: "auto", animation: "modalIn 0.25s ease both", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" },
  modalTitle: { fontSize: "17px", fontWeight: "700", color: "#1E293B" },
  modalSubtitle: { fontSize: "13px", color: "#64748B", marginBottom: "14px" },
  closeBtn: { background: "none", border: "none", fontSize: "18px", color: "#94A3B8", cursor: "pointer", padding: "2px 6px", lineHeight: 1 },
  candidateList: { display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" },
  candidateRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E2E8F0" },
  candidateAvatar: { width: "34px", height: "34px", borderRadius: "50%", background: "#2563EB", color: "#FFF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: "700", flexShrink: 0 },
  candidateName: { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  recBadge: { fontSize: "10px", fontWeight: "700", color: "#1D4ED8", background: "#DBEAFE", padding: "2px 6px", borderRadius: "100px" },
  warningTag: { fontSize: "10px", fontWeight: "600", color: "#991B1B", background: "#FEE2E2", padding: "2px 6px", borderRadius: "100px" },
  okTag: { fontSize: "10px", fontWeight: "600", color: "#059669", background: "#ECFDF5", padding: "2px 6px", borderRadius: "100px" },
  doAssignBtn: { background: "#2563EB", border: "none", borderRadius: "7px", padding: "7px 14px", fontSize: "12px", fontWeight: "600", color: "#FFF", cursor: "pointer", flexShrink: 0 },
  // Conflict modal
  conflictBlock: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "10px", padding: "14px 16px", marginBottom: "12px" },
  conflictBlockTitle: { fontSize: "12px", fontWeight: "700", color: "#991B1B", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.04em" },
  conflictItem: { display: "flex", alignItems: "flex-start", gap: "8px", marginBottom: "4px" },
  conflictDot: { width: "6px", height: "6px", borderRadius: "50%", background: "#EF4444", flexShrink: 0, marginTop: "5px" },
  cancelConflictBtn: { background: "#F1F5F9", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "600", color: "#64748B", cursor: "pointer" },
  overrideBtn: { background: "#D97706", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer" },
};
