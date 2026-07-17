import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../lib/supabaseClient";
import { getUser } from "../../utils/auth";
import ManagerLayout from "../../components/layout/ManagerLayout";
import { ClipboardList, List, GanttChartSquare } from "lucide-react";
import GanttChart, { RangeNav, startOfWeek, toDateStr, FullscreenPanel } from "../../components/GanttChart";

// ── Module-level keyframe injection ──────────────────────────────────────────
if (typeof document !== "undefined" && !document.getElementById("mgr-leave-styles")) {
  const style = document.createElement("style");
  style.id = "mgr-leave-styles";
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
    @keyframes toastIn {
      from { opacity: 0; transform: translateY(20px); }
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

export default function AvailabilityLeave() {
  const user = getUser();
  const userId = user?.user_id;

  // Main tab: "leave" | "swap" | "casual"
  const [mainTab, setMainTab] = useState("leave");

  // View mode per tab: "list" | "timeline"
  const [leaveView, setLeaveView]   = useState("timeline");
  const [swapView, setSwapView]     = useState("timeline");
  const [casualView, setCasualView] = useState("timeline");

  // Timeline range (shared 28-day window, navigable per tab)
  const [leaveRangeStart, setLeaveRangeStart]   = useState(() => startOfWeek(new Date()));
  const [swapRangeStart, setSwapRangeStart]     = useState(() => startOfWeek(new Date()));
  const [casualRangeStart, setCasualRangeStart] = useState(() => startOfWeek(new Date()));
  const TIMELINE_DAYS = 7;

  // Detail modal for a clicked Gantt bar — { kind: "leave" | "swap" | "casual", data }
  const [detailModal, setDetailModal] = useState(null);

  // Leave state
  const [requests, setRequests]         = useState([]);
  const [loadingLeave, setLoadingLeave] = useState(true);
  const [leaveFilter, setLeaveFilter]   = useState("pending");
  const [branchId, setBranchId]         = useState(null);
  const [staffUserMap, setStaffUserMap] = useState({}); // staff_id -> user_id

  // Swap state
  const [swaps, setSwaps]               = useState([]);
  const [loadingSwap, setLoadingSwap]   = useState(true);
  const [swapFilter, setSwapFilter]     = useState("pending");

  // Casual availability state
  const [casualData, setCasualData]         = useState([]);
  const [loadingCasual, setLoadingCasual]   = useState(false);
  const [casualWeekFilter, setCasualWeekFilter] = useState("all");

  // Off day requests state
  const [offDays, setOffDays]               = useState([]);
  const [loadingOffDay, setLoadingOffDay]   = useState(true);
  const [offDayFilter, setOffDayFilter]     = useState("pending");
  const [workingDays, setWorkingDays]       = useState(7);

  const [processing, setProcessing]     = useState(null);
  const [toast, setToast]               = useState(null);

  // Staff picker modal for swap approval
  const [swapApproveModal, setSwapApproveModal] = useState(null); // { sw, availableStaff }
  const [pickedStaffId, setPickedStaffId]       = useState("");
  const [approving, setApproving]               = useState(false);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  // ── Load branch + staff info once ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function loadBase() {
      const { data: myStaff } = await supabase
        .from("staff").select("branch_id").eq("user_id", userId).eq("is_active", true).limit(1);
      let oid = myStaff?.[0]?.branch_id;
      if (!oid) {
        const { data: omRow } = await supabase.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1);
        oid = omRow?.[0]?.branch_id;
      }
      if (!oid || cancelled) return;
      setBranchId(oid);

      const [{ data: staffRows }, { data: branchRow }] = await Promise.all([
        supabase.from("staff").select("staff_id, user_id").eq("branch_id", oid),
        supabase.from("branches").select("working_days").eq("branch_id", oid).single(),
      ]);
      if (!cancelled) setWorkingDays(branchRow?.working_days ?? 7);
      const map = {};
      (staffRows || []).forEach(s => { map[s.staff_id] = s.user_id; });
      if (!cancelled) setStaffUserMap(map);
    }
    loadBase();
    return () => { cancelled = true; };
  }, [userId]);

  // ── Load leave requests ────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    async function load() {
      setLoadingLeave(true);
      try {
        const staffIds = Object.keys(staffUserMap);
        if (staffIds.length === 0) { if (!cancelled) setLoadingLeave(false); return; }

        const { data: reqs, error } = await supabase
          .from("availability")
          .select(`
            request_id, leave_type, start_date, end_date,
            reason, status, reviewed_at, staff_id,
            staff:staff_id (
              staff_id, user_id,
              users:user_id ( full_name, email )
            )
          `)
          .in("staff_id", staffIds)
          .order("start_date", { ascending: false });

        if (error) console.error("availability fetch error:", error);
        if (!cancelled) setRequests(reqs || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingLeave(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, staffUserMap]);

  // ── Load swap requests ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    async function load() {
      setLoadingSwap(true);
      try {
        const staffIds = Object.keys(staffUserMap);
        if (staffIds.length === 0) { if (!cancelled) setLoadingSwap(false); return; }

        // Fetch swap requests where requester is in this branch's staff
        const { data: swapRows, error } = await supabase
          .from("swap_requests")
          .select(`
            swap_id, request_type, reason, status,
            responded_at, manager_decided_at,
            requester_id, requester_assign, target_staff_id, target_assign_id
          `)
          .in("requester_id", staffIds)
          .order("swap_id", { ascending: false });

        if (error) console.error("swap_requests fetch error:", error);

        const rawSwaps = swapRows || [];

        // Collect user_ids to resolve names
        const userIdsToFetch = new Set();
        rawSwaps.forEach(sw => {
          if (staffUserMap[sw.requester_id]) userIdsToFetch.add(staffUserMap[sw.requester_id]);
          if (staffUserMap[sw.target_staff_id]) userIdsToFetch.add(staffUserMap[sw.target_staff_id]);
        });

        let userMap = {};
        if (userIdsToFetch.size > 0) {
          const { data: userRows } = await supabase
            .from("users").select("user_id, full_name, email")
            .in("user_id", [...userIdsToFetch]);
          (userRows || []).forEach(u => { userMap[u.user_id] = u; });
        }

        // Fetch assignment shift dates for requester_assign and target_assign_id
        const assignIds = [...new Set(
          rawSwaps.flatMap(sw => [sw.requester_assign, sw.target_assign_id].filter(Boolean))
        )];
        let assignMap = {};
        if (assignIds.length > 0) {
          const { data: assignRows } = await supabase
            .from("task_assignments")
            .select(`assignment_id, shifts!inner(shift_date, title)`)
            .in("assignment_id", assignIds);
          (assignRows || []).forEach(a => { assignMap[a.assignment_id] = a.shifts; });
        }

        const enriched = rawSwaps.map(sw => {
          const requesterUid = staffUserMap[sw.requester_id];
          const targetUid = staffUserMap[sw.target_staff_id];
          return {
            ...sw,
            requesterUser: userMap[requesterUid] || {},
            targetUser: userMap[targetUid] || {},
            requesterShift: assignMap[sw.requester_assign] || null,
            targetShift: assignMap[sw.target_assign_id] || null,
          };
        });

        if (!cancelled) setSwaps(enriched);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingSwap(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, staffUserMap]);

  // ── Load off day requests ─────────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    async function load() {
      setLoadingOffDay(true);
      try {
        const staffIds = Object.keys(staffUserMap).map(Number);
        if (staffIds.length === 0) { if (!cancelled) setLoadingOffDay(false); return; }
        const { data, error } = await supabase
          .from("off_day_requests")
          .select("id, staff_id, requested_date, reason, status, created_at, reviewed_at, staff:staff_id(staff_id, user_id, staff_type, users:user_id(full_name, email))")
          .in("staff_id", staffIds)
          .order("created_at", { ascending: false });
        if (error) console.error("off_day_requests fetch:", error);
        // Only show regular staff off day requests
        const regular = (data || []).filter(r => r.staff?.staff_type === "regular");
        if (!cancelled) setOffDays(regular);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingOffDay(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, staffUserMap]);

  async function handleOffDay(id, action) {
    setProcessing(id);
    const myStaff = await supabase.from("staff").select("staff_id").eq("user_id", userId).limit(1);
    const mgrId = myStaff.data?.[0]?.staff_id;
    const { error } = await supabase.from("off_day_requests")
      .update({ status: action, reviewed_at: new Date().toISOString(), reviewed_by: mgrId })
      .eq("id", id);
    setProcessing(null);
    if (error) { showToast("Failed to update.", "error"); return; }
    setOffDays(prev => prev.map(r => r.id === id ? { ...r, status: action, reviewed_at: new Date().toISOString() } : r));
    showToast(action === "approved" ? "Off day approved." : "Off day rejected.");
  }

  // ── Load casual availability ───────────────────────────────────────────────
  useEffect(() => {
    if (!branchId) return;
    let cancelled = false;
    async function load() {
      setLoadingCasual(true);
      try {
        // Get all staff for this branch (filter by who has casual_availability records)
        const { data: casualStaff } = await supabase
          .from("staff")
          .select("staff_id, user_id, users:user_id(full_name, email)")
          .eq("branch_id", branchId)
          .eq("is_active", true);

        if (!casualStaff || casualStaff.length === 0) {
          if (!cancelled) { setCasualData([]); setLoadingCasual(false); }
          return;
        }

        const staffIds = casualStaff.map(s => s.staff_id);
        const { data: avail } = await supabase
          .from("casual_availability")
          .select("availability_id, staff_id, week_start_date, day_of_week, available_from, available_to")
          .in("staff_id", staffIds)
          .order("week_start_date", { ascending: false });

        const staffMap = {};
        casualStaff.forEach(s => { staffMap[s.staff_id] = s; });

        // Group by staff + week
        const grouped = {};
        (avail || []).forEach(row => {
          const key = `${row.staff_id}_${row.week_start_date}`;
          if (!grouped[key]) {
            grouped[key] = {
              staff_id: row.staff_id,
              week_start_date: row.week_start_date,
              staffInfo: staffMap[row.staff_id],
              days: [],
            };
          }
          grouped[key].days.push(row);
        });

        if (!cancelled) setCasualData(Object.values(grouped));
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoadingCasual(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [branchId, staffUserMap]);

  // ── Handle leave action ────────────────────────────────────────────────────
  async function handleLeaveAction(requestId, action) {
    setProcessing(requestId);
    try {
      const req = requests.find(r => r.request_id === requestId);
      await supabase.from("availability").update({
        status: action,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq("request_id", requestId);

      // If approved, remove shift assignments that fall within the leave period
      if (action === "approved" && req) {
        // Step 1: get all shift_ids in the leave date range
        const { data: shiftsInRange } = await supabase
          .from("shifts")
          .select("shift_id")
          .gte("shift_date", req.start_date)
          .lte("shift_date", req.end_date);

        if (shiftsInRange && shiftsInRange.length > 0) {
          const shiftIds = shiftsInRange.map(s => s.shift_id);
          // Step 2: delete assignments for this staff in those shifts
          await supabase.from("task_assignments")
            .delete()
            .eq("staff_id", req.staff_id)
            .in("shift_id", shiftIds);
        }
      }

      // Insert notification for staff member
      if (req) {
        const staffUserId = req.staff?.user_id || staffUserMap[req.staff_id];
        if (staffUserId) {
          const isApproved = action === "approved";
          await supabase.from("notifications").insert({
            recipient_id: staffUserId,
            type: "leave_decision",
            title: isApproved ? "Leave Request Approved" : "Leave Request Rejected",
            message: isApproved
              ? `Your ${req.leave_type} leave (${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}) has been approved. Any shifts during this period have been removed.`
              : `Your ${req.leave_type} leave request (${fmtDate(req.start_date)} – ${fmtDate(req.end_date)}) was rejected.`,
            related_entity: "availability",
            related_id: String(requestId),
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }

      setRequests(prev => prev.map(r =>
        r.request_id === requestId ? { ...r, status: action } : r
      ));
      showToast(action === "approved" ? "Leave approved. Shifts in this period removed." : "Request rejected.", action === "approved" ? "success" : "error");
    } catch (err) {
      console.error(err);
      showToast("Action failed. Please try again.", "error");
    } finally {
      setProcessing(null);
    }
  }

  // ── Handle swap action ────────────────────────────────────────────────────
  async function handleSwapAction(swapId, action) {
    if (action === "rejected") {
      // Reject immediately, no staff picker needed
      setProcessing(swapId);
      try {
        await supabase.from("swap_requests").update({
          status: "rejected",
          manager_id: userId,
          manager_decided_at: new Date().toISOString(),
        }).eq("swap_id", swapId);
        setSwaps(prev => prev.map(s =>
          s.swap_id === swapId ? { ...s, status: "rejected" } : s
        ));
        showToast("Request rejected.", "error");
      } catch (err) {
        console.error(err);
        showToast("Action failed. Please try again.", "error");
      } finally {
        setProcessing(null);
      }
      return;
    }

    // Approve — fetch available staff (same branch, active, not the requester)
    const sw = swaps.find(s => s.swap_id === swapId);
    if (!sw) return;

    // Get all branch staff except the requester
    const { data: branchStaff } = await supabase
      .from("staff")
      .select("staff_id, user_id, users:user_id(full_name, email)")
      .eq("branch_id", branchId)
      .eq("is_active", true)
      .neq("staff_id", sw.requester_id);

    setPickedStaffId("");
    setSwapApproveModal({ sw, availableStaff: branchStaff || [] });
  }

  async function confirmSwapApproval() {
    if (!pickedStaffId) { showToast("Please select a staff member to cover the shift.", "error"); return; }
    const { sw } = swapApproveModal;
    setApproving(true);
    try {
      // Get the requester's task_assignment to find shift_id and task_id
      const { data: assignRow } = await supabase
        .from("task_assignments")
        .select("assignment_id, shift_id, task_id")
        .eq("assignment_id", sw.requester_assign)
        .single();

      if (!assignRow) throw new Error("Original assignment not found");

      // 1. Delete requester's original assignment first — one task = one person, so the slot
      // must be freed before the cover staff can take it.
      await supabase.from("task_assignments")
        .delete().eq("assignment_id", sw.requester_assign);

      // 2. Create new assignment for the cover staff
      const { error: insertErr } = await supabase.from("task_assignments").insert({
        shift_id: assignRow.shift_id,
        task_id: assignRow.task_id,
        staff_id: Number(pickedStaffId),
        status: "assigned",
      });
      if (insertErr) throw insertErr;

      // 3. Update swap request status
      await supabase.from("swap_requests").update({
        status: "approved",
        target_staff_id: Number(pickedStaffId),
        manager_id: userId,
        manager_decided_at: new Date().toISOString(),
      }).eq("swap_id", sw.swap_id);

      // 4. Notify requester
      const requesterUserId = staffUserMap[sw.requester_id];
      if (requesterUserId) {
        const coverStaff = swapApproveModal.availableStaff.find(s => String(s.staff_id) === String(pickedStaffId));
        const coverName = coverStaff?.users?.full_name || "a colleague";
        await supabase.from("notifications").insert({
          recipient_id: requesterUserId,
          type: "swap_decision",
          title: "Swap Request Approved",
          message: `Your swap request has been approved. ${coverName} will cover your shift.`,
          related_entity: "swap_requests",
          related_id: String(sw.swap_id),
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      // 5. Notify the cover staff
      const coverUserId = staffUserMap[pickedStaffId] || staffUserMap[Number(pickedStaffId)];
      if (coverUserId) {
        await supabase.from("notifications").insert({
          recipient_id: coverUserId,
          type: "shift_assigned",
          title: "New Shift Assignment",
          message: `You have been assigned to cover a shift as part of a swap approval.`,
          related_entity: "task_assignments",
          related_id: String(assignRow.shift_id),
          is_read: false,
          created_at: new Date().toISOString(),
        });
      }

      setSwaps(prev => prev.map(s =>
        s.swap_id === sw.swap_id ? { ...s, status: "approved" } : s
      ));
      setSwapApproveModal(null);
      showToast("Swap approved. Assignment transferred.", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to approve swap. Please try again.", "error");
    } finally {
      setApproving(false);
    }
  }

  const filteredLeave   = requests.filter(r => leaveFilter === "all" ? true : r.status === leaveFilter);
  const pendingLeave    = requests.filter(r => r.status === "pending").length;
  const filteredSwap    = swaps.filter(s => swapFilter === "all" ? true : s.status === swapFilter);
  const pendingSwap     = swaps.filter(s => s.status === "pending").length;
  const filteredOffDays = offDays.filter(r => offDayFilter === "all" ? true : r.status === offDayFilter);
  const pendingOffDay   = offDays.filter(r => r.status === "pending").length;

  const LEAVE_TYPE_BAR = {
    annual:    { bg: "#DBEAFE", color: "#1D4ED8", border: "#BFDBFE" },
    medical:   { bg: "#DCFCE7", color: "#166534", border: "#BBF7D0" },
    emergency: { bg: "#FEE2E2", color: "#991B1B", border: "#FECACA" },
  };

  // ── Timeline row builders ────────────────────────────────────────────────
  function buildLeaveGanttRows() {
    const byStaff = {};
    filteredLeave.forEach(req => {
      const key = req.staff_id;
      if (!byStaff[key]) byStaff[key] = { id: key, name: getStaffName(req), avatarColor: avatarColor(getStaffName(req)), bars: [] };
      const tc = LEAVE_TYPE_BAR[req.leave_type] || { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0" };
      byStaff[key].bars.push({
        id: req.request_id, start: req.start_date, end: req.end_date,
        label: `${req.leave_type} · ${req.status}`,
        title: `${req.leave_type} leave — ${fmtDate(req.start_date)} to ${fmtDate(req.end_date)} (${req.status})`,
        bg: tc.bg, color: tc.color, border: tc.border, faded: req.status === "rejected",
        onClick: () => setDetailModal({ kind: "leave", data: req }),
      });
    });
    return Object.values(byStaff);
  }

  function buildSwapGanttRows() {
    const byStaff = {};
    filteredSwap.forEach(sw => {
      const name = sw.requesterUser?.full_name || sw.requesterUser?.email || "Unknown";
      const date = sw.requesterShift?.shift_date;
      if (!date) return;
      const key = sw.requester_id;
      if (!byStaff[key]) byStaff[key] = { id: key, name, avatarColor: avatarColor(name), bars: [] };
      const tc = sw.request_type === "swap" ? { bg: "#EFF6FF", color: "#1D4ED8", border: "#BFDBFE" } : { bg: "#F5F3FF", color: "#6D28D9", border: "#DDD6FE" };
      byStaff[key].bars.push({
        id: sw.swap_id, start: date, end: date,
        label: `${sw.request_type} · ${sw.status}`,
        title: `${sw.request_type === "swap" ? "Shift Swap" : "Replacement"} — ${fmtDate(date)} (${sw.status})`,
        bg: tc.bg, color: tc.color, border: tc.border, faded: sw.status === "rejected",
        onClick: () => setDetailModal({ kind: "swap", data: sw }),
      });
    });
    return Object.values(byStaff);
  }

  function buildCasualGanttRows() {
    const byStaff = {};
    casualData.forEach(entry => {
      const name = entry.staffInfo?.users?.full_name || entry.staffInfo?.users?.email || "Casual Staff";
      const key = entry.staff_id;
      if (!byStaff[key]) byStaff[key] = { id: key, name, avatarColor: avatarColor(name), bars: [] };
      entry.days.forEach(d => {
        const date = new Date(entry.week_start_date + "T00:00:00");
        date.setDate(date.getDate() + d.day_of_week);
        const dateStr = toDateStr(date);
        byStaff[key].bars.push({
          id: d.availability_id || `${key}_${dateStr}`, start: dateStr, end: dateStr,
          label: `${fmtTime(d.available_from?.slice(0,5))}–${fmtTime(d.available_to?.slice(0,5))}`,
          title: `Available ${fmtTime(d.available_from?.slice(0,5))} – ${fmtTime(d.available_to?.slice(0,5))} on ${fmtDate(dateStr)}`,
          bg: "#F0FDF4", color: "#166534", border: "#BBF7D0",
          onClick: () => setDetailModal({ kind: "casual", data: { name, dateStr, from: d.available_from, to: d.available_to } }),
        });
      });
    });
    return Object.values(byStaff);
  }

  function getStaffName(req) { return req.staff?.users?.full_name || req.staff?.users?.email || "Unknown"; }
  function getStaffEmail(req) { return req.staff?.users?.email || ""; }
  function getInitial(req) { return getStaffName(req)?.[0]?.toUpperCase() || "?"; }

  const LEAVE_FILTER_TABS = [
    { value: "pending",  label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all",      label: "All" },
  ];

  const SWAP_FILTER_TABS = [
    { value: "pending",  label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "all",      label: "All" },
  ];

  return (
    <ManagerLayout title="Availability & Leave">
      <div style={{ animation: "pageIn 0.4s ease both" }}>

        {/* ── Main tabs ─────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0", marginBottom: "24px", borderBottom: "2px solid #E2E8F0" }}>
          {[
            { key: "leave",   label: "Leave Requests",    badge: pendingLeave },
            { key: "swap",    label: "Swap & Replacement", badge: pendingSwap },
            { key: "casual",  label: "Casual Availability", badge: null },
            ...(workingDays >= 6 ? [{ key: "offday", label: "Off Day Requests", badge: pendingOffDay }] : []),
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom: mainTab === tab.key ? "2px solid #2563EB" : "2px solid transparent",
                marginBottom: "-2px",
                fontSize: "14px",
                fontWeight: mainTab === tab.key ? "700" : "500",
                color: mainTab === tab.key ? "#2563EB" : "#64748B",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span style={{ background: "#EF4444", color: "#FFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── LEAVE TAB ──────────────────────────────────────── */}
        {mainTab === "leave" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Leave Requests</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                  {pendingLeave > 0 ? `${pendingLeave} pending approval` : "No pending requests"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
                {LEAVE_FILTER_TABS.map(tab => (
                  <FilterTab
                    key={tab.value}
                    label={tab.label}
                    active={leaveFilter === tab.value}
                    badge={tab.value === "pending" && pendingLeave > 0 ? pendingLeave : null}
                    onClick={() => setLeaveFilter(tab.value)}
                  />
                ))}
              </div>
              <ViewToggle view={leaveView} onChange={setLeaveView} />
            </div>

            {loadingLeave ? (
              <ShimmerCards />
            ) : filteredLeave.length === 0 ? (
              <EmptyState label={`No ${leaveFilter} requests`} />
            ) : leaveView === "timeline" ? (
              <FullscreenPanel title="Leave Requests">
                <RangeNav rangeStart={leaveRangeStart} numDays={TIMELINE_DAYS} onChange={setLeaveRangeStart} />
                <GanttChart rangeStart={leaveRangeStart} numDays={TIMELINE_DAYS} rows={buildLeaveGanttRows()} emptyLabel="No leave in this date range." />
              </FullscreenPanel>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredLeave.map(req => (
                  <LeaveCard
                    key={req.request_id}
                    req={req}
                    processing={processing}
                    getStaffName={getStaffName}
                    getStaffEmail={getStaffEmail}
                    getInitial={getInitial}
                    onAction={handleLeaveAction}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── SWAP TAB ───────────────────────────────────────── */}
        {mainTab === "swap" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Swap & Replacement Requests</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                  {pendingSwap > 0 ? `${pendingSwap} pending review` : "No pending requests"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content" }}>
                {SWAP_FILTER_TABS.map(tab => (
                  <FilterTab
                    key={tab.value}
                    label={tab.label}
                    active={swapFilter === tab.value}
                    badge={tab.value === "pending" && pendingSwap > 0 ? pendingSwap : null}
                    onClick={() => setSwapFilter(tab.value)}
                  />
                ))}
              </div>
              <ViewToggle view={swapView} onChange={setSwapView} />
            </div>

            {loadingSwap ? (
              <ShimmerCards />
            ) : filteredSwap.length === 0 ? (
              <EmptyState label={`No ${swapFilter} swap/replacement requests`} />
            ) : swapView === "timeline" ? (
              <FullscreenPanel title="Swap & Replacement Requests">
                <RangeNav rangeStart={swapRangeStart} numDays={TIMELINE_DAYS} onChange={setSwapRangeStart} />
                <GanttChart rangeStart={swapRangeStart} numDays={TIMELINE_DAYS} rows={buildSwapGanttRows()} emptyLabel="No swap/replacement requests in this date range." />
              </FullscreenPanel>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {filteredSwap.map(sw => (
                  <SwapCard
                    key={sw.swap_id}
                    sw={sw}
                    processing={processing}
                    onAction={handleSwapAction}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── CASUAL AVAILABILITY TAB ────────────────────────── */}
        {mainTab === "casual" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Casual Staff Availability</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>Weekly availability submissions from casual staff.</p>
              </div>
              <ViewToggle view={casualView} onChange={setCasualView} />
            </div>

            {/* Week filter — list view only */}
            {casualView === "list" && !loadingCasual && casualData.length > 0 && (() => {
              const weeks = [...new Set(casualData.map(d => d.week_start_date))].sort((a, b) => b.localeCompare(a));
              return (
                <div style={{ display: "flex", gap: "6px", marginBottom: "20px", flexWrap: "wrap" }}>
                  <FilterTab label="All weeks" active={casualWeekFilter === "all"} onClick={() => setCasualWeekFilter("all")} />
                  {weeks.map(w => (
                    <FilterTab key={w} label={fmtWeekRange(w)} active={casualWeekFilter === w} onClick={() => setCasualWeekFilter(w)} />
                  ))}
                </div>
              );
            })()}

            {loadingCasual ? (
              <ShimmerCards />
            ) : casualData.length === 0 ? (
              <EmptyState label="No casual availability submissions yet" />
            ) : casualView === "timeline" ? (
              <FullscreenPanel title="Casual Staff Availability">
                <RangeNav rangeStart={casualRangeStart} numDays={TIMELINE_DAYS} onChange={setCasualRangeStart} />
                <GanttChart rangeStart={casualRangeStart} numDays={TIMELINE_DAYS} rows={buildCasualGanttRows()} emptyLabel="No availability submissions in this date range." />
              </FullscreenPanel>
            ) : (() => {
              const filtered = casualWeekFilter === "all" ? casualData : casualData.filter(d => d.week_start_date === casualWeekFilter);
              if (filtered.length === 0) return <EmptyState label="No submissions for this week" />;
              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {filtered.map(entry => (
                    <CasualAvailCard key={`${entry.staff_id}_${entry.week_start_date}`} entry={entry} />
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ── OFF DAY TAB ──────────────────────────────────────── */}
        {mainTab === "offday" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#1E293B" }}>Off Day Requests</h2>
                <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>
                  {pendingOffDay > 0 ? `${pendingOffDay} pending approval` : "No pending requests"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "6px", background: "#F1F5F9", padding: "4px", borderRadius: "10px", width: "fit-content", marginBottom: "20px" }}>
              {[
                { value: "pending",  label: "Pending" },
                { value: "approved", label: "Approved" },
                { value: "rejected", label: "Rejected" },
                { value: "all",      label: "All" },
              ].map(tab => (
                <FilterTab
                  key={tab.value}
                  label={tab.label}
                  active={offDayFilter === tab.value}
                  badge={tab.value === "pending" && pendingOffDay > 0 ? pendingOffDay : null}
                  onClick={() => setOffDayFilter(tab.value)}
                />
              ))}
            </div>

            {loadingOffDay ? (
              <ShimmerCards />
            ) : filteredOffDays.length === 0 ? (
              <EmptyState label={`No ${offDayFilter === "all" ? "" : offDayFilter} off day requests`} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredOffDays.map(r => {
                  const name  = r.staff?.users?.full_name || "Unknown";
                  const email = r.staff?.users?.email || "";
                  const date  = new Date(r.requested_date + "T00:00:00");
                  const dayName = date.toLocaleDateString("en-SG", { weekday: "long" });
                  const dateFmt = date.toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
                  const isPending = r.status === "pending";
                  return (
                    <div key={r.id} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", animation: "fadeSlideUp 0.25s ease both" }}>
                      {/* Avatar */}
                      <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: avatarColor(name), color: "#FFF", fontSize: "15px", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {name[0]?.toUpperCase()}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: "160px" }}>
                        <p style={{ fontWeight: "700", fontSize: "14px", color: "#0F172A" }}>{name}</p>
                        <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{email}</p>
                      </div>
                      {/* Requested date */}
                      <div style={{ background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: "10px", padding: "10px 16px", textAlign: "center", flexShrink: 0 }}>
                        <p style={{ fontSize: "11px", fontWeight: "700", color: "#0369A1", textTransform: "uppercase", letterSpacing: "0.05em" }}>Requested Off</p>
                        <p style={{ fontSize: "15px", fontWeight: "800", color: "#0C4A6E", marginTop: "2px" }}>{dayName}</p>
                        <p style={{ fontSize: "11px", color: "#0369A1", marginTop: "1px" }}>{dateFmt}</p>
                      </div>
                      {/* Reason */}
                      {r.reason && (
                        <div style={{ background: "#FAFAFA", border: "1px solid #F1F5F9", borderRadius: "8px", padding: "8px 12px", maxWidth: "220px", flexShrink: 0 }}>
                          <p style={{ fontSize: "10px", fontWeight: "600", color: "#94A3B8", marginBottom: "2px", textTransform: "uppercase" }}>Reason</p>
                          <p style={{ fontSize: "12px", color: "#475569" }}>{r.reason}</p>
                        </div>
                      )}
                      {/* Status / Actions */}
                      {isPending ? (
                        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                          <button
                            disabled={processing === r.id}
                            onClick={() => handleOffDay(r.id, "approved")}
                            style={{ padding: "8px 16px", borderRadius: "8px", border: "none", background: "#16A34A", color: "#FFF", fontSize: "13px", fontWeight: "600", cursor: "pointer", opacity: processing === r.id ? 0.6 : 1 }}>
                            Approve
                          </button>
                          <button
                            disabled={processing === r.id}
                            onClick={() => handleOffDay(r.id, "rejected")}
                            style={{ padding: "8px 16px", borderRadius: "8px", border: "1.5px solid #FCA5A5", background: "#FFF", color: "#DC2626", fontSize: "13px", fontWeight: "600", cursor: "pointer", opacity: processing === r.id ? 0.6 : 1 }}>
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ padding: "5px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "700", ...statusStyle(r.status), flexShrink: 0 }}>
                          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>

      {/* Gantt bar detail modal */}
      {detailModal && (
        <DetailModal
          modal={detailModal}
          processing={processing}
          onClose={() => setDetailModal(null)}
          onLeaveAction={(id, action) => { handleLeaveAction(id, action); setDetailModal(null); }}
          onSwapAction={(id, action) => {
            if (action === "rejected") { handleSwapAction(id, action); setDetailModal(null); }
            else { setDetailModal(null); handleSwapAction(id, action); }
          }}
        />
      )}

      {/* Staff picker modal for swap approval */}
      {swapApproveModal && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          zIndex: 25000, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}>
          <div style={{
            background: "#FFFFFF", borderRadius: "18px", padding: "28px",
            width: "100%", maxWidth: "440px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)",
            animation: "popIn 0.2s ease both",
          }}>
            <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#1E293B", marginBottom: "6px" }}>
              Choose Cover Staff
            </h3>
            <p style={{ fontSize: "13px", color: "#64748B", marginBottom: "20px" }}>
              Select a staff member to take over the shift from{" "}
              <strong>{swapApproveModal.sw.requesterUser?.full_name || "the requester"}</strong>.
              Their original shift assignment will be removed.
            </p>

            {swapApproveModal.sw.requesterShift && (
              <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "10px", padding: "12px 14px", marginBottom: "16px" }}>
                <p style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", marginBottom: "4px" }}>Shift to cover</p>
                <p style={{ fontSize: "14px", fontWeight: "600", color: "#1E293B" }}>
                  {swapApproveModal.sw.requesterShift.title || "Shift"} · {fmtDate(swapApproveModal.sw.requesterShift.shift_date)}
                </p>
              </div>
            )}

            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#64748B", marginBottom: "6px" }}>
              Select Cover Staff *
            </label>
            <select
              value={pickedStaffId}
              onChange={e => setPickedStaffId(e.target.value)}
              style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #D8D5CE", borderRadius: "9px", fontSize: "14px", color: "#1E293B", background: "#FFFFFF", marginBottom: "20px", boxSizing: "border-box" }}
            >
              <option value="">Choose a staff member…</option>
              {swapApproveModal.availableStaff.map(s => (
                <option key={s.staff_id} value={s.staff_id}>
                  {s.users?.full_name || s.users?.email || `Staff #${s.staff_id}`}
                </option>
              ))}
            </select>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={() => setSwapApproveModal(null)}
                disabled={approving}
                style={{ padding: "9px 18px", background: "#F1F5F9", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
                Cancel
              </button>
              <button
                onClick={confirmSwapApproval}
                disabled={approving || !pickedStaffId}
                style={{ padding: "9px 18px", background: pickedStaffId ? "#22C55E" : "#A7F3D0", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: pickedStaffId ? "pointer" : "default", transition: "background 0.15s" }}>
                {approving ? "Approving…" : "Confirm Approval"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 26000,
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function DetailModal({ modal, processing, onClose, onLeaveAction, onSwapAction }) {
  const { kind, data } = modal;

  let title, name, email, meta, reason, status, actions;

  if (kind === "leave") {
    name  = data.staff?.users?.full_name || data.staff?.users?.email || "Unknown";
    email = data.staff?.users?.email || "";
    title = `${data.leave_type.charAt(0).toUpperCase() + data.leave_type.slice(1)} Leave`;
    meta  = [
      { label: "Dates", value: `${fmtDate(data.start_date)} → ${fmtDate(data.end_date)}` },
      { label: "Duration", value: `${getDays(data.start_date, data.end_date)} day(s)` },
    ];
    reason = data.reason;
    status = data.status;
    if (status === "pending") {
      actions = (
        <>
          <button onClick={() => onLeaveAction(data.request_id, "rejected")} disabled={processing === data.request_id} style={rejectBtnStyle}>
            {processing === data.request_id ? "…" : "Reject"}
          </button>
          <button onClick={() => onLeaveAction(data.request_id, "approved")} disabled={processing === data.request_id} style={approveBtnStyle}>
            {processing === data.request_id ? "…" : "Approve"}
          </button>
        </>
      );
    }
  } else if (kind === "swap") {
    name  = data.requesterUser?.full_name || data.requesterUser?.email || "Unknown";
    email = data.requesterUser?.email || "";
    title = data.request_type === "swap" ? "Shift Swap Request" : "Replacement Request";
    meta  = [
      { label: "Requester's Shift", value: data.requesterShift ? `${fmtDate(data.requesterShift.shift_date)} · ${data.requesterShift.title || "Shift"}` : "—" },
    ];
    if (data.request_type === "swap") meta.push({ label: "Target Staff", value: data.targetUser?.full_name || data.targetUser?.email || "—" });
    reason = data.reason;
    status = data.status;
    if (status === "pending") {
      actions = (
        <>
          <button onClick={() => onSwapAction(data.swap_id, "rejected")} disabled={processing === data.swap_id} style={rejectBtnStyle}>
            {processing === data.swap_id ? "…" : "Reject"}
          </button>
          <button onClick={() => onSwapAction(data.swap_id, "approved")} disabled={processing === data.swap_id} style={approveBtnStyle}>
            {processing === data.swap_id ? "…" : "Approve"}
          </button>
        </>
      );
    }
  } else { // casual
    name  = data.name;
    title = "Casual Availability";
    meta  = [
      { label: "Date", value: fmtDate(data.dateStr) },
      { label: "Available", value: `${fmtTime(data.from?.slice(0,5))} – ${fmtTime(data.to?.slice(0,5))}` },
    ];
  }

  return createPortal(
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 25000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "440px", boxShadow: "0 24px 60px rgba(0,0,0,0.2)", animation: "popIn 0.2s ease both" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div>
            <p style={{ fontSize: "16px", fontWeight: "800", color: "#1E293B" }}>{title}</p>
            {name && <p style={{ fontSize: "13px", color: "#64748B", marginTop: "2px" }}>{name}{email ? ` · ${email}` : ""}</p>}
          </div>
          {status && (
            <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle(status) }}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: "16px" }}>
          {meta.map(m => (
            <div key={m.label} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#94A3B8" }}>{m.label}</span>
              <span style={{ fontSize: "13px", fontWeight: "600", color: "#1E293B", textAlign: "right" }}>{m.value}</span>
            </div>
          ))}
        </div>

        {reason && (
          <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "18px" }}>"{reason}"</p>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button onClick={onClose} style={{ padding: "9px 18px", background: "#F1F5F9", border: "none", borderRadius: "9px", fontSize: "13px", fontWeight: "600", color: "#475569", cursor: "pointer" }}>
            Close
          </button>
          {actions}
        </div>
      </div>
    </div>,
    document.body
  );
}

const rejectBtnStyle = { background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "600", color: "#991B1B", cursor: "pointer" };
const approveBtnStyle = { background: "#22C55E", border: "none", borderRadius: "9px", padding: "9px 18px", fontSize: "13px", fontWeight: "700", color: "#FFFFFF", cursor: "pointer" };

function ViewToggle({ view, onChange }) {
  return (
    <div style={{ display: "flex", gap: "4px", background: "#F1F5F9", padding: "4px", borderRadius: "10px" }}>
      {[{ key: "list", label: "List", Icon: List }, { key: "timeline", label: "Timeline", Icon: GanttChartSquare }].map(({ key, label, Icon }) => (
        <button key={key} onClick={() => onChange(key)}
          style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
            background: view === key ? "#FFFFFF" : "transparent", border: "none", borderRadius: "7px",
            fontSize: "13px", fontWeight: view === key ? "700" : "500", color: view === key ? "#1E293B" : "#64748B",
            cursor: "pointer", boxShadow: view === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s",
          }}>
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

function FilterTab({ label, active, badge, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "7px 16px", background: active ? "#FFFFFF" : "transparent",
        border: "none", borderRadius: "7px", fontSize: "13px",
        fontWeight: active ? "600" : "500", color: active ? "#1E293B" : "#64748B",
        cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
        boxShadow: active ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
        transition: "all 0.15s",
      }}>
      {label}
      {badge !== null && badge !== undefined && (
        <span style={{ background: "#EF4444", color: "#FFFFFF", fontSize: "10px", fontWeight: "700", padding: "1px 5px", borderRadius: "100px" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function ShimmerCards() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Shimmer w="40px" h="40px" r="50%" />
              <div>
                <Shimmer w="120px" h="15px" r="6px" style={{ marginBottom: "7px" }} />
                <Shimmer w="80px" h="12px" r="6px" />
              </div>
            </div>
            <Shimmer w="72px" h="26px" r="100px" />
          </div>
          <div style={{ display: "flex", gap: "20px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
            <Shimmer w="100px" h="36px" r="8px" />
            <Shimmer w="140px" h="36px" r="8px" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ label }) {
  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
      <div style={{ marginBottom: "10px", display: "flex", justifyContent: "center" }}><ClipboardList size={32} color="#94A3B8" /></div>
      <p style={{ fontSize: "16px", fontWeight: "600", color: "#64748B" }}>{label}</p>
    </div>
  );
}

function LeaveCard({ req, processing, getStaffName, getStaffEmail, getInitial, onAction }) {
  const [hoverApprove, setHoverApprove] = useState(false);
  const [hoverReject, setHoverReject]   = useState(false);
  const name = getStaffName(req);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", animation: "fadeSlideUp 0.3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
            {getInitial(req)}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{getStaffEmail(req)}</p>
          </div>
        </div>
        <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle(req.status) }}>
          {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
        </span>
      </div>

      <div style={{ display: "flex", gap: "28px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: "14px" }}>
        <InfoItem label="Type" value={`${req.leave_type.charAt(0).toUpperCase() + req.leave_type.slice(1)} Leave`} />
        <InfoItem label="Dates" value={`${fmtDate(req.start_date)} → ${fmtDate(req.end_date)}`} />
        <InfoItem label="Duration" value={`${getDays(req.start_date, req.end_date)} day(s)`} />
      </div>

      {req.reason && (
        <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "14px" }}>
          "{req.reason}"
        </p>
      )}

      {req.status === "pending" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onMouseEnter={() => setHoverReject(true)}
            onMouseLeave={() => setHoverReject(false)}
            onClick={() => onAction(req.request_id, "rejected")}
            disabled={processing === req.request_id}
            style={{
              background: hoverReject ? "#FEE2E2" : "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "600",
              color: "#991B1B", cursor: "pointer",
              opacity: processing === req.request_id ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
            {processing === req.request_id ? "…" : "Reject"}
          </button>
          <button
            onMouseEnter={() => setHoverApprove(true)}
            onMouseLeave={() => setHoverApprove(false)}
            onClick={() => onAction(req.request_id, "approved")}
            disabled={processing === req.request_id}
            style={{
              background: hoverApprove ? "#16A34A" : "#22C55E",
              border: "none", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "700",
              color: "#FFFFFF", cursor: "pointer",
              opacity: processing === req.request_id ? 0.6 : 1,
              transition: "background 0.15s",
            }}>
            {processing === req.request_id ? "…" : "Approve"}
          </button>
        </div>
      )}
    </div>
  );
}

function SwapCard({ sw, processing, onAction }) {
  const [hoverApprove, setHoverApprove] = useState(false);
  const [hoverReject, setHoverReject]   = useState(false);
  const requesterName = sw.requesterUser?.full_name || sw.requesterUser?.email || "Unknown";
  const targetName    = sw.targetUser?.full_name    || sw.targetUser?.email    || "—";

  const typeLabel = sw.request_type === "swap" ? "Shift Swap" : "Shift Replacement";
  const typeColor = sw.request_type === "swap"
    ? { background: "#EFF6FF", color: "#1D4ED8" }
    : { background: "#F5F3FF", color: "#6D28D9" };

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", animation: "fadeSlideUp 0.3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(requesterName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
            {requesterName[0]?.toUpperCase() || "?"}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{requesterName}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{sw.requesterUser?.email || ""}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "11px", fontWeight: "600", ...typeColor }}>{typeLabel}</span>
          <span style={{ padding: "4px 12px", borderRadius: "100px", fontSize: "12px", fontWeight: "600", ...statusStyle(sw.status) }}>
            {sw.status.charAt(0).toUpperCase() + sw.status.slice(1)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", padding: "14px 0", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", marginBottom: "14px" }}>
        <InfoItem label="Requester's Shift" value={sw.requesterShift ? `${fmtDate(sw.requesterShift.shift_date)} · ${sw.requesterShift.title || "Shift"}` : "—"} />
        {sw.request_type === "swap" && (
          <InfoItem label="Target Staff" value={targetName} />
        )}
        {sw.targetShift && (
          <InfoItem label="Target Shift" value={`${fmtDate(sw.targetShift.shift_date)} · ${sw.targetShift.title || "Shift"}`} />
        )}
      </div>

      {sw.reason && (
        <p style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic", marginBottom: "14px" }}>
          "{sw.reason}"
        </p>
      )}

      {sw.status === "pending" && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            onMouseEnter={() => setHoverReject(true)}
            onMouseLeave={() => setHoverReject(false)}
            onClick={() => onAction(sw.swap_id, "rejected")}
            disabled={processing === sw.swap_id}
            style={{
              background: hoverReject ? "#FEE2E2" : "#FEF2F2",
              border: "1px solid #FECACA", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "600",
              color: "#991B1B", cursor: "pointer",
              opacity: processing === sw.swap_id ? 0.6 : 1,
              transition: "all 0.15s",
            }}>
            {processing === sw.swap_id ? "…" : "Reject"}
          </button>
          <button
            onMouseEnter={() => setHoverApprove(true)}
            onMouseLeave={() => setHoverApprove(false)}
            onClick={() => onAction(sw.swap_id, "approved")}
            disabled={processing === sw.swap_id}
            style={{
              background: hoverApprove ? "#16A34A" : "#22C55E",
              border: "none", borderRadius: "9px",
              padding: "8px 18px", fontSize: "13px", fontWeight: "700",
              color: "#FFFFFF", cursor: "pointer",
              opacity: processing === sw.swap_id ? 0.6 : 1,
              transition: "background 0.15s",
            }}>
            {processing === sw.swap_id ? "…" : "Approve"}
          </button>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={{ fontSize: "11px", fontWeight: "600", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ fontSize: "13px", fontWeight: "500", color: "#1E293B" }}>{value}</span>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
}

function fmtWeekRange(weekStart) {
  const s = new Date(weekStart);
  const e = new Date(weekStart);
  e.setDate(e.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString("en-SG", opts)} – ${e.toLocaleDateString("en-SG", opts)}`;
}

function fmtTime(t) {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function CasualAvailCard({ entry }) {
  const name = entry.staffInfo?.users?.full_name || entry.staffInfo?.users?.email || "Casual Staff";
  const initial = name[0]?.toUpperCase() || "?";
  // day_of_week: 0=Mon … 6=Sun — sort numerically
  const sortedDays = [...entry.days].sort((a, b) => a.day_of_week - b.day_of_week);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "14px", padding: "22px", animation: "fadeSlideUp 0.3s ease both" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: avatarColor(name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: "700", flexShrink: 0 }}>
            {initial}
          </div>
          <div>
            <p style={{ fontSize: "15px", fontWeight: "700", color: "#1E293B" }}>{name}</p>
            <p style={{ fontSize: "12px", color: "#64748B", marginTop: "1px" }}>{entry.staffInfo?.users?.email || ""}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "12px", fontWeight: "600", color: "#64748B" }}>Week of</p>
          <p style={{ fontSize: "13px", fontWeight: "700", color: "#1E293B" }}>{fmtWeekRange(entry.week_start_date)}</p>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingTop: "14px", borderTop: "1px solid #F1F5F9" }}>
        {sortedDays.map(row => (
          <div key={row.availability_id || row.day_of_week} style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: "8px", padding: "6px 12px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#15803D" }}>{DAY_NAMES[row.day_of_week]}</span>
            <span style={{ fontSize: "12px", color: "#166534" }}>{fmtTime(row.available_from?.slice(0,5))} – {fmtTime(row.available_to?.slice(0,5))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDays(start, end) {
  if (!start || !end) return 0;
  return Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
}

function statusStyle(status) {
  const map = {
    pending:  { background: "#FFFBEB", color: "#D97706" },
    approved: { background: "#DCFCE7", color: "#166534" },
    rejected: { background: "#FEE2E2", color: "#991B1B" },
  };
  return map[status] || map.pending;
}
