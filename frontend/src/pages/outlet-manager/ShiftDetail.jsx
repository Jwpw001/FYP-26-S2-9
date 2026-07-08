import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { useGoTo } from "../../components/PageTransition";
import { Sparkles, X, Check, AlertTriangle, Users } from "lucide-react";
import { api } from "../../lib/api";
import { getUser } from "../../utils/auth";

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
    @keyframes aiPulse {
      0%,100% { opacity: 1; } 50% { opacity: 0.5; }
    }
    @keyframes aiPanelIn {
      from { opacity: 0; transform: translateY(12px); }
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
  const user = getUser();

  const [shift, setShift]             = useState(null);
  const [roles, setRoles]             = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [publishing, setPublishing]   = useState(false);
  const [toast, setToast]             = useState(null);

  // Add role form
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [roleForm, setRoleForm]         = useState({ role_name: "", headcount: 1, skill_id: "" });
  const [skillOptions, setSkillOptions] = useState([]);
  const [savingRole, setSavingRole]     = useState(false);

  // Assign modal state
  const [assignModal, setAssignModal]         = useState(null); // { role }
  const [candidates, setCandidates]           = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [assigning, setAssigning]             = useState(false);

  // Conflict modal state
  const [conflictModal, setConflictModal] = useState(null); // { hardBlocks, warnings }

  // Confirm modal state — { title, body, confirmLabel, danger, onConfirm }
  const [confirmModal, setConfirmModal] = useState(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // AI recommendation panel
  const [aiPanel, setAiPanel] = useState(null); // null | { loading: true } | { recommendations: [] }
  const [aiAssigning, setAiAssigning] = useState(null); // staff_id being assigned

  // Krewby requests for this shift
  const [krewbyRequests, setKrewbyRequests] = useState([]); // [{ request_id, role_id, status, worker_name }]
  const [krewbyModal, setKrewbyModal] = useState(null); // { role }
  const [krewbyNote, setKrewbyNote] = useState("");
  const [krewbySubmitting, setKrewbySubmitting] = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function reloadRoles() {
    const [{ data: roleData }, { data: assignData }] = await Promise.all([
      supabase.from("shift_roles")
        .select("role_id, role_name, skill_id, headcount, skills(name)")
        .eq("shift_id", id),
      supabase.from("shift_assignments")
        .select("assignment_id, role_id, staff_id, status, acknowledged")
        .eq("shift_id", id),
    ]);

    const staffIds = (assignData || []).map(a => a.staff_id).filter(Boolean);
    let staffUserMap = {};

    if (staffIds.length > 0) {
      const { data: staffRows } = await supabase
        .from("staff").select("staff_id, user_id").in("staff_id", staffIds);
      const userIds = (staffRows || []).map(s => s.user_id).filter(Boolean);
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users").select("user_id, full_name, email").in("user_id", userIds);
        const userMap = Object.fromEntries((userRows || []).map(u => [u.user_id, u]));
        (staffRows || []).forEach(s => { staffUserMap[s.staff_id] = userMap[s.user_id] || {}; });
      }
    }

    const enriched = (assignData || []).map(a => ({ ...a, userInfo: staffUserMap[a.staff_id] || {} }));
    const merged = (roleData || []).map(role => ({
      ...role,
      shift_assignments: enriched.filter(a => a.role_id === role.role_id),
    }));
    setRoles(merged);
    setAssignments(enriched);
  }

  async function runAiRecommend() {
    setAiPanel({ loading: true });
    try {
      const result = await api.post(`/api/recommendations/shift/${id}`);
      setAiPanel({ recommendations: result.recommendations || [] });
    } catch (err) {
      showToast("AI recommendation failed. Please try again.", "error");
      setAiPanel(null);
    }
  }

  async function aiAssignStaff(staffId, roleId, staffName) {
    const numStaffId = Number(staffId);
    const numRoleId  = Number(roleId);
    setAiAssigning(numStaffId);
    try {
      const targetRole = roles.find(r => Number(r.role_id) === numRoleId);
      const filled = targetRole?.shift_assignments?.length || 0;
      if (targetRole && filled >= (targetRole.headcount || 1)) {
        showToast(`"${targetRole.role_name}" is already fully staffed.`, "error");
        return;
      }

      const { data: inserted, error: err } = await supabase
        .from("shift_assignments")
        .insert({
          shift_id: Number(id),
          role_id: numRoleId,
          staff_id: numStaffId,
          status: "assigned",
          acknowledged: false,
        })
        .select("assignment_id, role_id, staff_id, status, acknowledged")
        .single();

      if (err) throw err;

      // Optimistic update — add the new assignment to the role card immediately
      const newAssignment = {
        ...inserted,
        userInfo: { full_name: staffName },
      };
      setRoles(prev => prev.map(r =>
        Number(r.role_id) === numRoleId
          ? { ...r, shift_assignments: [...(r.shift_assignments || []), newAssignment] }
          : r
      ));
      setAssignments(prev => [...prev, newAssignment]);

      setAiPanel(null);
      showToast(`${staffName} assigned successfully.`);
    } catch (err) {
      console.error("AI assign error:", err);
      showToast(err?.message || "Failed to assign staff.", "error");
    } finally {
      setAiAssigning(null);
    }
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

        // Load skills for the Add Role dropdown
        const { data: skillsData } = await supabase.from("skills").select("skill_id, name").order("name");

        // Load krewby requests for this shift
        const { data: krewbyData } = await supabase
          .from("krewby_requests")
          .select(`request_id, role_id, status, assigned_worker_id, krewby_workers!assigned_worker_id(user_id, users(full_name, email))`)
          .eq("shift_id", Number(id));
        if (!cancelled && krewbyData) {
          setKrewbyRequests(krewbyData.map(r => ({
            request_id: r.request_id,
            role_id: r.role_id,
            status: r.status,
            worker_name: r.krewby_workers?.users?.full_name || r.krewby_workers?.users?.email || null,
          })));
        }

        if (!cancelled) {
          setSkillOptions(skillsData || []);
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

  // ── Add role to shift ──────────────────────────────────────────────────────
  async function addRole() {
    if (!roleForm.role_name.trim()) { showToast("Role name is required.", "error"); return; }
    if (Number(roleForm.headcount) < 1) { showToast("Headcount must be at least 1.", "error"); return; }
    setSavingRole(true);
    try {
      const { data, error } = await supabase.from("shift_roles").insert({
        shift_id:  Number(id),
        role_name: roleForm.role_name.trim(),
        headcount: Number(roleForm.headcount),
        skill_id:  roleForm.skill_id ? Number(roleForm.skill_id) : null,
      }).select(`role_id, role_name, skill_id, headcount, skills ( name )`).single();

      if (error) throw error;
      setRoles(prev => [...prev, { ...data, shift_assignments: [] }]);
      setRoleForm({ role_name: "", headcount: 1, skill_id: "" });
      setShowRoleForm(false);
      showToast(`Role "${data.role_name}" added.`);
    } catch (err) {
      console.error(err);
      showToast("Failed to add role.", "error");
    } finally {
      setSavingRole(false);
    }
  }

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

      // Fetch user info (incl. role so we can exclude managers)
      let userMap = {};
      if (userIds.length > 0) {
        const { data: userRows } = await supabase
          .from("users").select(`user_id, full_name, email, role`).in("user_id", userIds);
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
          if (user.role === "outlet_manager") return null; // managers cannot be assigned shifts

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
    const targetRole = roles.find(r => r.role_id === roleId);
    const filled = targetRole?.shift_assignments?.length || 0;
    if (targetRole && filled >= (targetRole.headcount || 1)) {
      showToast(`"${targetRole.role_name}" is already fully staffed (${filled}/${targetRole.headcount}).`, "error");
      return;
    }
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
      await reloadRoles();
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
  async function doRemoveAssignment(assignmentId) {
    await supabase.from("shift_assignments").delete().eq("assignment_id", assignmentId);
    setRoles(prev => prev.map(r => ({
      ...r,
      shift_assignments: (r.shift_assignments || []).filter(a => a.assignment_id !== assignmentId),
    })));
    setAssignments(prev => prev.filter(a => a.assignment_id !== assignmentId));
    showToast("Assignment removed.");
  }

  function removeAssignment(assignmentId) {
    // On a published shift, the staff member may have already seen it — confirm first
    if (shift.status === "published") {
      const a = assignments.find(x => x.assignment_id === assignmentId);
      const name = a?.userInfo?.full_name || "this staff member";
      setConfirmModal({
        title: "Remove from shift?",
        body: <>This shift is already published. <strong>{name}</strong> may have seen their schedule. Remove them anyway?</>,
        confirmLabel: "Remove",
        danger: true,
        onConfirm: () => doRemoveAssignment(assignmentId),
      });
      return;
    }
    doRemoveAssignment(assignmentId);
  }

  // ── Publish with conflict checks ──────────────────────────────────────────
  async function handlePublish() {
    setPublishing(true);
    try {
      const hardBlocks = [];
      const warnings = [];

      // Understaffing check (include krewby-assigned workers in filled count)
      for (const role of roles) {
        const kr = krewbyRequests.find(r => r.role_id === role.role_id);
        const krewbyFilled = (kr?.status === "assigned" || kr?.status === "approved") ? 1 : 0;
        const filled = (role.shift_assignments?.length || 0) + krewbyFilled;
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

  async function submitKrewbyRequest() {
    setKrewbySubmitting(true);
    try {
      const role = krewbyModal.role;
      const { data, error } = await supabase.from("krewby_requests").insert({
        shift_id: Number(id),
        role_id: role.role_id,
        outlet_id: shift.outlet_id,
        role_name: role.role_name,
        skill_id: role.skill_id || null,
        shift_date: shift.shift_date,
        start_time: shift.start_time,
        end_time: shift.end_time,
        headcount: role.headcount || 1,
        status: "pending_review",
        override_note: krewbyNote.trim() || null,
        created_by: user?.user_id,
      }).select("request_id, role_id, status").single();
      if (error) throw error;
      setKrewbyRequests(prev => [...prev, { request_id: data.request_id, role_id: data.role_id, status: "pending_review", worker_name: null }]);
      setKrewbyModal(null);
      setKrewbyNote("");
      showToast("Krewby worker requested successfully.");
    } catch (err) {
      showToast(err?.message || "Failed to submit request.", "error");
    } finally {
      setKrewbySubmitting(false);
    }
  }

  function handleCancelShift() {
    setConfirmModal({
      title: "Cancel this shift?",
      body: <>This will mark <strong>{shift?.title || "this shift"}</strong> as cancelled. Assigned staff will no longer be scheduled for it.</>,
      confirmLabel: "Cancel Shift",
      danger: true,
      onConfirm: async () => {
        await supabase.from("shifts").update({ status: "cancelled" }).eq("shift_id", id);
        setShift(prev => ({ ...prev, status: "cancelled" }));
        showToast("Shift cancelled.");
      },
    });
  }

  function handleDelete() {
    setConfirmModal({
      title: "Delete this shift?",
      body: <>This will permanently delete <strong>{shift?.title || "this shift"}</strong> and all its role assignments. This cannot be undone.</>,
      confirmLabel: "Delete Shift",
      danger: true,
      onConfirm: async () => {
        await supabase.from("shifts").delete().eq("shift_id", id);
        goTo("/outlet-manager/shifts");
      },
    });
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
  const totalAssigned = roles.reduce((sum, r) => {
    const kr = krewbyRequests.find(k => k.role_id === r.role_id);
    const krewbyFilled = (kr?.status === "assigned" || kr?.status === "approved") ? 1 : 0;
    return sum + (r.shift_assignments?.length || 0) + krewbyFilled;
  }, 0);
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
            {shift.status !== "completed" && shift.status !== "cancelled" && (
              <button
                style={s.aiBtn}
                onClick={aiPanel ? () => setAiPanel(null) : runAiRecommend}
                disabled={aiPanel?.loading}
              >
                {aiPanel?.loading
                  ? <span style={{ animation: "aiPulse 1.2s ease infinite" }}><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}} /> Thinking…</span>
                  : aiPanel ? <><X size={14} style={{verticalAlign:"middle",marginRight:4}} /> Close AI</> : <><Sparkles size={14} style={{verticalAlign:"middle",marginRight:4}} /> Smart Recommend</>}
              </button>
            )}
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
              <>
                <button style={s.unpublishBtn} onClick={handleUnpublish}>Move to Draft</button>
                <button style={s.cancelShiftBtn} onClick={handleCancelShift}>Cancel Shift</button>
              </>
            )}
            {shift.status === "draft" && (
              <button style={s.cancelShiftBtn} onClick={handleCancelShift}>Cancel Shift</button>
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
            {totalAssigned}/{totalRoles} positions filled{isFullyStaffed && " ·  Ready to publish"}
          </span>
        </div>
      </div>

      {/* ── AI Recommendation Panel ──────────────────────────────────────────── */}
      {aiPanel && !aiPanel.loading && (
        <div style={s.aiPanel}>
          <div style={s.aiPanelHeader}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={s.aiIcon}>✦</span>
              <span style={s.aiPanelTitle}>AI Staff Recommendations</span>
            </div>
            <span style={s.aiPanelSub}>Powered by Groq · Click Assign to apply a suggestion</span>
          </div>

          {aiPanel.recommendations.length === 0 ? (
            <p style={{ fontSize: "13px", color: "#64748B", padding: "12px 0" }}>
              All roles are fully staffed — nothing to recommend.
            </p>
          ) : (
            aiPanel.recommendations.map(rec => (
              <div key={rec.role_id} style={s.aiRoleBlock}>
                <p style={s.aiRoleName}>{rec.role_name}</p>
                {(rec.suggestions || []).length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94A3B8" }}>No available staff to suggest for this role.</p>
                ) : (
                  rec.suggestions.map((sug, i) => (
                    <div key={sug.staff_id} style={{
                      ...s.aiSugRow,
                      borderColor: i === 0 ? "#A5B4FC" : "#E2E8F0",
                      background: i === 0 ? "#F5F3FF" : "#FAFAFA",
                    }}>
                      <div style={{ ...s.aiRank, background: i === 0 ? "#6366F1" : "#CBD5E1" }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <p style={s.aiSugName}>{sug.name}</p>
                          <span style={{
                            ...s.confBadge,
                            background: sug.confidence === "high" ? "#DCFCE7" : sug.confidence === "medium" ? "#FFFBEB" : "#FEE2E2",
                            color: sug.confidence === "high" ? "#166534" : sug.confidence === "medium" ? "#92400E" : "#991B1B",
                          }}>
                            {sug.confidence}
                          </span>
                        </div>
                        <p style={s.aiSugReason}>{sug.reason}</p>
                      </div>
                      <button
                        style={{
                          ...s.aiAssignBtn,
                          opacity: aiAssigning === sug.staff_id ? 0.6 : 1,
                          background: i === 0 ? "#6366F1" : "#2563EB",
                        }}
                        disabled={!!aiAssigning}
                        onClick={() => aiAssignStaff(Number(sug.staff_id), Number(rec.role_id), sug.name)}
                      >
                        {aiAssigning === sug.staff_id ? "…" : "Assign"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h3 style={{ ...s.sectionTitle, margin: 0 }}>Roles & Assignments</h3>
        {shift.status !== "completed" && shift.status !== "cancelled" && (
          <button
            onClick={() => { setShowRoleForm(v => !v); setRoleForm({ role_name: "", headcount: 1, skill_id: "" }); }}
            style={{ background: showRoleForm ? "#F1F5F9" : "#2563EB", color: showRoleForm ? "#64748B" : "#FFFFFF", border: "none", padding: "8px 16px", borderRadius: "9px", fontSize: "13px", fontWeight: "600", cursor: "pointer" }}>
            {showRoleForm ? "Cancel" : "+ Add Role"}
          </button>
        )}
      </div>

      {/* Add Role form */}
      {showRoleForm && (
        <div style={{ background: "#F8FAFC", border: "1.5px solid #BFDBFE", borderRadius: "14px", padding: "20px", marginBottom: "20px" }}>
          <p style={{ fontSize: "14px", fontWeight: "700", color: "#1E293B", marginBottom: "16px" }}>New Role</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={s.formLabel}>Role Name *</label>
              <input
                style={s.formInput}
                placeholder="e.g. Cashier, Barista, Server…"
                value={roleForm.role_name}
                onChange={e => setRoleForm(p => ({ ...p, role_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={s.formLabel}>Headcount *</label>
              <input
                style={s.formInput}
                type="number" min="1" max="20"
                value={roleForm.headcount}
                onChange={e => setRoleForm(p => ({ ...p, headcount: e.target.value }))}
              />
            </div>
            <div>
              <label style={s.formLabel}>Required Skill (optional)</label>
              <select style={s.formInput} value={roleForm.skill_id} onChange={e => setRoleForm(p => ({ ...p, skill_id: e.target.value }))}>
                <option value="">No specific skill</option>
                {skillOptions.map(sk => (
                  <option key={sk.skill_id} value={sk.skill_id}>{sk.name}</option>
                ))}
              </select>
            </div>
          </div>
          <button onClick={addRole} disabled={savingRole}
            style={{ background: savingRole ? "#93C5FD" : "#2563EB", color: "#FFFFFF", border: "none", padding: "9px 22px", borderRadius: "9px", fontSize: "14px", fontWeight: "700", cursor: savingRole ? "default" : "pointer" }}>
            {savingRole ? "Adding…" : "Add Role"}
          </button>
        </div>
      )}

      {roles.length === 0 ? (
        <div style={{ ...s.empty, padding: "40px", textAlign: "center" }}>
          <div style={{ marginBottom: "10px" }}><Users size={32} color="#64748B" /></div>
          <p style={{ fontSize: "15px", fontWeight: "600", color: "#64748B", marginBottom: "4px" }}>No roles defined yet</p>
          <p style={{ fontSize: "13px", color: "#94A3B8" }}>Click "+ Add Role" above to define positions for this shift, then assign staff to each role.</p>
        </div>
      ) : (
        roles.map(role => {
          const kr = krewbyRequests.find(r => r.role_id === role.role_id);
          const krewbyFilled = (kr?.status === "assigned" || kr?.status === "approved") ? 1 : 0;
          const filled = (role.shift_assignments?.length || 0) + krewbyFilled;
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
                    {isFull ? "Full" : `${needed - filled} needed`}
                  </span>
                  {(() => {
                    const kr = krewbyRequests.find(r => r.role_id === role.role_id);
                    if (kr) {
                      if (kr.status === "assigned" || kr.status === "approved") {
                        return <span style={s.krewbyAssignedBadge}>Krewby:{kr.worker_name || "Worker assigned"}</span>;
                      }
                      return <span style={s.krewbyPendingBadge}>⏳ Krewby requested</span>;
                    }
                    if (shift.status !== "completed" && shift.status !== "cancelled" && !isFull) {
                      return (
                        <button style={s.krewbyBtn} onClick={() => { setKrewbyModal({ role }); setKrewbyNote(""); }}>
                          + Request Krewby
                        </button>
                      );
                    }
                    return null;
                  })()}
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
                      ? <span style={s.ackTagYes}>Acknowledged</span>
                      : <span style={s.ackTagNo}>Pending acknowledgement</span>
                    }
                    {(shift.status === "draft" || shift.status === "published") && (
                      <button
                        style={s.removeBtn}
                        title="Remove from shift"
                        onClick={() => removeAssignment(a.assignment_id)}
                        onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
                        onMouseLeave={e => { e.currentTarget.style.color = "#94A3B8"; }}
                      ><X size={14} /></button>
                    )}
                  </div>
                </div>
              ))}

              {/* Krewby worker row */}
              {krewbyFilled > 0 && (
                <div style={{ ...s.assignedRow, background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                  <div style={{ ...s.assignedAvatar, background: "#16A34A", color: "#FFF" }}>
                    {kr.worker_name?.[0]?.toUpperCase() || "K"}
                  </div>
                  <div style={s.assignedInfo}>
                    <p style={s.assignedName}>{kr.worker_name || "Krewby Worker"}</p>
                    <p style={{ ...s.assignedEmail, color: "#16A34A", fontWeight: "600" }}>Krewby Casual Worker</p>
                  </div>
                  <div style={s.assignedRight}>
                    <span style={s.ackTagYes}>Krewby Assigned</span>
                  </div>
                </div>
              )}

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
              <button style={s.closeBtn} onClick={() => setAssignModal(null)}><X size={18} /></button>
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
                            <span style={s.recBadge}>Recommended</span>
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
              <h3 style={{ ...s.modalTitle, color: "#991B1B", display:"flex", alignItems:"center", gap:"6px" }}><AlertTriangle size={18} /> Publish Conflicts</h3>
              <button style={s.closeBtn} onClick={() => setConflictModal(null)}><X size={18} /></button>
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

      {/* ── Confirm Modal ──────────────────────────────────────────────────── */}
      {confirmModal && (
        <div style={s.modalOverlay} onClick={() => !confirmBusy && setConfirmModal(null)}>
          <div style={{ ...s.modal, maxWidth: "400px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "50%", margin: "0 auto 14px",
              background: confirmModal.danger ? "#FEF2F2" : "#EFF6FF",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke={confirmModal.danger ? "#EF4444" : "#2563EB"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "8px" }}>
              {confirmModal.title}
            </h3>
            <p style={{ fontSize: "13.5px", color: "#64748B", lineHeight: 1.6, marginBottom: "22px" }}>
              {confirmModal.body}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                style={s.cancelConflictBtn}
                onClick={() => setConfirmModal(null)}
                disabled={confirmBusy}
              >
                Cancel
              </button>
              <button
                style={{
                  background: confirmModal.danger ? "#EF4444" : "#2563EB",
                  border: "none", borderRadius: "9px", padding: "8px 18px",
                  fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer",
                  opacity: confirmBusy ? 0.6 : 1,
                }}
                disabled={confirmBusy}
                onClick={async () => {
                  setConfirmBusy(true);
                  try {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  } finally {
                    setConfirmBusy(false);
                  }
                }}
              >
                {confirmBusy ? "Working…" : confirmModal.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Krewby Request Modal ──────────────────────────────────────────── */}
      {krewbyModal && (
        <div style={s.modalOverlay} onClick={() => setKrewbyModal(null)}>
          <div style={{ ...s.modal, maxWidth: "420px" }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h3 style={s.modalTitle}>Request Krewby Worker</h3>
              <button style={s.closeBtn} onClick={() => setKrewbyModal(null)}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "16px" }}>
              Requesting a Krewby casual worker for <strong>{krewbyModal.role.role_name}</strong>
              {krewbyModal.role.skills?.name ? ` (${krewbyModal.role.skills.name})` : ""} on{" "}
              <strong>{fmtDate(shift.shift_date)}</strong>, {shift.start_time?.slice(0,5)} – {shift.end_time?.slice(0,5)}.
            </p>
            <label style={s.formLabel}>Note for Coordinator (optional)</label>
            <textarea
              style={{ ...s.formInput, height: "80px", resize: "vertical", fontFamily: "inherit" }}
              placeholder="Any special requirements or instructions…"
              value={krewbyNote}
              onChange={e => setKrewbyNote(e.target.value)}
            />
            <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
              <button style={s.cancelConflictBtn} onClick={() => setKrewbyModal(null)} disabled={krewbySubmitting}>Cancel</button>
              <button
                style={{ flex: 1, background: krewbySubmitting ? "#93C5FD" : "#2563EB", border: "none", borderRadius: "9px", padding: "10px", fontSize: "14px", fontWeight: "700", color: "#FFF", cursor: krewbySubmitting ? "default" : "pointer" }}
                onClick={submitKrewbyRequest}
                disabled={krewbySubmitting}
              >
                {krewbySubmitting ? "Submitting…" : "Submit Request"}
              </button>
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
  cancelShiftBtn: { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "8px 14px", fontSize: "13px", fontWeight: "600", color: "#991B1B", cursor: "pointer" },
  staffingSummary: { display: "flex", alignItems: "center", gap: "12px" },
  staffingBar: { flex: 1, height: "6px", background: "#F1F5F9", borderRadius: "100px", overflow: "hidden" },
  staffingFill: { height: "100%", borderRadius: "100px", transition: "width 0.3s ease" },
  staffingText: { fontSize: "13px", color: "#64748B", fontWeight: "500", whiteSpace: "nowrap" },
  sectionTitle: { fontSize: "15px", fontWeight: "700", color: "#1E293B", marginBottom: "14px" },
  formLabel: { display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" },
  formInput: { display: "block", width: "100%", padding: "9px 12px", border: "1.5px solid #E2E8F0", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFFFFF", boxSizing: "border-box" },
  roleCard: { background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "16px", marginBottom: "12px" },
  roleCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "8px" },
  roleName: { fontSize: "15px", fontWeight: "700", color: "#1E293B" },
  roleMeta: { fontSize: "12px", color: "#64748B", marginTop: "2px" },
  roleActions: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
  fillBadge: { padding: "3px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: "600" },
  assignBtn: { background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "7px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", color: "#1D4ED8", cursor: "pointer" },
  krewbyBtn: { background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: "7px", padding: "5px 12px", fontSize: "12px", fontWeight: "600", color: "#C2410C", cursor: "pointer" },
  krewbyPendingBadge: { fontSize: "11px", fontWeight: "600", color: "#D97706", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "3px 9px", borderRadius: "100px" },
  krewbyAssignedBadge: { fontSize: "11px", fontWeight: "600", color: "#059669", background: "#ECFDF5", border: "1px solid #A7F3D0", padding: "3px 9px", borderRadius: "100px" },
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
  // AI panel
  aiBtn: { background: "linear-gradient(135deg,#6366F1,#8B5CF6)", border: "none", borderRadius: "9px", padding: "8px 16px", fontSize: "13px", fontWeight: "700", color: "#FFF", cursor: "pointer", letterSpacing: "0.01em" },
  aiPanel: { background: "linear-gradient(135deg,#F5F3FF,#EEF2FF)", border: "1.5px solid #C4B5FD", borderRadius: "14px", padding: "20px", marginBottom: "24px", animation: "aiPanelIn 0.3s ease both" },
  aiPanelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "6px" },
  aiIcon: { fontSize: "16px", color: "#6366F1" },
  aiPanelTitle: { fontSize: "15px", fontWeight: "700", color: "#4338CA" },
  aiPanelSub: { fontSize: "11px", color: "#7C3AED", opacity: 0.7 },
  aiRoleBlock: { marginBottom: "16px" },
  aiRoleName: { fontSize: "12px", fontWeight: "700", color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" },
  aiSugRow: { display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "10px", border: "1px solid #E2E8F0", marginBottom: "6px" },
  aiRank: { width: "22px", height: "22px", borderRadius: "50%", color: "#FFF", fontSize: "11px", fontWeight: "800", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  aiSugName: { fontSize: "13px", fontWeight: "600", color: "#1E293B" },
  confBadge: { fontSize: "10px", fontWeight: "700", padding: "2px 6px", borderRadius: "100px" },
  aiSugReason: { fontSize: "12px", color: "#64748B", marginTop: "2px", lineHeight: 1.4 },
  aiAssignBtn: { border: "none", borderRadius: "7px", padding: "7px 14px", fontSize: "12px", fontWeight: "700", color: "#FFF", cursor: "pointer", flexShrink: 0 },
};
