import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
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
        const { data: shiftData } = await api.get(`/api/shifts/${id}`);

        if (!shiftData.success || !shiftData.shift || cancelled) return;
        setShift(shiftData.shift);

        // The API should already return enriched data with roles and assignments
        // Format: shift.shift_roles (each with shift_assignments)
        // and shift.shift_assignments (each with staff info)
        if (!cancelled) {
          setRoles(shiftData.shift.shift_roles || []);

          // Flatten assignments for easier access
          const allAssignments = (shiftData.shift.shift_roles || [])
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
      const { data: response } = await api.post(`/api/shift-assignments`, {
        shift_id: Number(id),
        role_id: roleId,
        staff_id: staffId,
        status: "assigned",
        acknowledged: false,
      });

      if (!response.success) throw new Error(response.message || "Failed to assign staff");

      // Refresh
      const { data: shiftData } = await api.get(`/api/shifts/${id}`);

      if (shiftData.success && shiftData.shift) {
        setRoles(shiftData.shift.shift_roles || []);
        setActiveRole(null);
        setRecommendations([]);
        setSuccess("Staff assigned successfully.");
        setTimeout(() => setSuccess(""), 3000);
      }
    } catch (err) {
      setError("Failed to assign staff.");
      console.error(err);
    } finally {
      setAssigning(false);
    }
  }