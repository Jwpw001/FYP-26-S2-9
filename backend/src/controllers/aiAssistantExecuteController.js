const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUser } = require("../utils/notify");
const logger = require("../config/logger");

const ALLOWED_TOOLS = ["approve_leave", "reject_leave", "create_draft_shift", "add_task_to_shift", "publish_shift", "assign_staff_to_task", "set_staff_active"];

async function getCallerBranchId(userId) {
  const staffRecord = await prisma.staff.findFirst({
    where: { user_id: userId },
    select: { branch_id: true },
  }).catch(() => null);
  if (staffRecord?.branch_id) return staffRecord.branch_id;

  const { data: bm } = await supabaseAdmin
    .from("branch_managers")
    .select("branch_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return bm?.branch_id ?? null;
}

async function execute(req, res) {
  try {
    const { tool_name, args } = req.body;
    const userId = req.user?.user_id;
    const role   = req.user?.role;

    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized." });
    if (role !== "manager") {
      return res.status(403).json({ success: false, message: "Action capabilities are for managers only." });
    }
    if (!ALLOWED_TOOLS.includes(tool_name)) {
      return res.status(400).json({ success: false, message: "Unknown action." });
    }

    const branchId = await getCallerBranchId(userId);
    if (!branchId) {
      return res.status(403).json({ success: false, message: "No branch found for your account." });
    }

    let message;

    // ── Approve leave ──────────────────────────────────────────────────────────
    if (tool_name === "approve_leave") {
      const { request_id, staff_name } = args;

      const leave = await prisma.availability.findUnique({
        where: { request_id: Number(request_id) },
        include: { staff: { select: { branch_id: true, user_id: true, staff_id: true } } },
      });

      if (!leave || leave.staff?.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Leave request not found or access denied." });
      }
      if (leave.status !== "pending") {
        return res.status(400).json({ success: false, message: "This leave request is no longer pending." });
      }

      await prisma.availability.update({
        where: { request_id: Number(request_id) },
        data: { status: "approved" },
      });

      if (leave.staff?.user_id) {
        const from = leave.start_date ? new Date(leave.start_date).toISOString().slice(0, 10) : "?";
        const to   = leave.end_date   ? new Date(leave.end_date).toISOString().slice(0, 10)   : "?";
        await notifyUser({
          recipientId: leave.staff.user_id,
          type: "leave_approved",
          title: "Leave Request Approved",
          message: `Your leave request (${from} to ${to}) has been approved.`,
        });
      }

      message = `Leave approved for ${staff_name}.`;
    }

    // ── Reject leave ───────────────────────────────────────────────────────────
    if (tool_name === "reject_leave") {
      const { request_id, staff_name, reason } = args;

      const leave = await prisma.availability.findUnique({
        where: { request_id: Number(request_id) },
        include: { staff: { select: { branch_id: true, user_id: true } } },
      });

      if (!leave || leave.staff?.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Leave request not found or access denied." });
      }
      if (leave.status !== "pending") {
        return res.status(400).json({ success: false, message: "This leave request is no longer pending." });
      }

      await prisma.availability.update({
        where: { request_id: Number(request_id) },
        data: { status: "rejected" },
      });

      if (leave.staff?.user_id) {
        await notifyUser({
          recipientId: leave.staff.user_id,
          type: "leave_rejected",
          title: "Leave Request Rejected",
          message: `Your leave request has been rejected${reason ? `: ${reason}` : "."}`,
        });
      }

      message = `Leave rejected for ${staff_name}${reason ? ` (reason: ${reason})` : ""}.`;
    }

    // ── Create draft shift ─────────────────────────────────────────────────────
    if (tool_name === "create_draft_shift") {
      const { title, shift_date, start_time, end_time } = args;

      if (!title || !shift_date || !start_time || !end_time) {
        return res.status(400).json({ success: false, message: "Missing required shift fields." });
      }

      const shift = await prisma.shifts.create({
        data: {
          branch_id: branchId,
          title,
          shift_date: new Date(shift_date),
          start_time: new Date(`1970-01-01T${start_time}:00Z`),
          end_time:   new Date(`1970-01-01T${end_time}:00Z`),
          status: "draft",
          created_by: userId,
        },
      });

      message = `Draft shift "${title}" created for ${shift_date} (${start_time}–${end_time}). Shift ID: ${shift.shift_id}. You can now add tasks to it or publish it — just ask me.`;
    }

    // ── Activate / deactivate staff ───────────────────────────────────────────
    if (tool_name === "set_staff_active") {
      const { staff_id, staff_name, is_active } = args;

      const staffMember = await prisma.staff.findFirst({
        where: { staff_id: Number(staff_id), branch_id: branchId },
        select: { staff_id: true, user_id: true },
      });
      if (!staffMember) {
        return res.status(403).json({ success: false, message: "Staff member not found in your branch." });
      }

      await prisma.staff.update({
        where: { staff_id: Number(staff_id) },
        data: { is_active },
      });
      await prisma.users.update({
        where: { user_id: staffMember.user_id },
        data: { is_active },
      });

      message = is_active
        ? `${staff_name} has been reactivated. They can now log in and be assigned to shifts.`
        : `${staff_name} has been deactivated. They can no longer log in or be assigned to new shifts.`;
    }

    // ── Add task to shift ──────────────────────────────────────────────────────
    if (tool_name === "add_task_to_shift") {
      const { shift_id, title, start_time, end_time, headcount, shift_title } = args;

      const shift = await prisma.shifts.findUnique({
        where: { shift_id: Number(shift_id) },
        select: { branch_id: true, status: true },
      });
      if (!shift || shift.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Shift not found or access denied." });
      }

      const count = Math.max(1, Number(headcount) || 1);
      let lastTaskId;
      for (let i = 0; i < count; i++) {
        const task = await prisma.shift_tasks.create({
          data: {
            shift_id: Number(shift_id),
            title: title.trim(),
            start_time: new Date(`1970-01-01T${start_time}:00Z`),
            end_time:   new Date(`1970-01-01T${end_time}:00Z`),
            status: "open",
          },
        });
        lastTaskId = task.task_id;
      }

      message = `${count > 1 ? `${count} "${title}" tasks` : `Task "${title}"`} added to shift "${shift_title}" (Task ID: ${lastTaskId}). Would you like to assign a staff member to this task now?`;
    }

    // ── Publish shift ──────────────────────────────────────────────────────────
    if (tool_name === "publish_shift") {
      const { shift_id, shift_title } = args;

      const shift = await prisma.shifts.findUnique({
        where: { shift_id: Number(shift_id) },
        select: { branch_id: true, status: true },
      });
      if (!shift || shift.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Shift not found or access denied." });
      }
      if (shift.status === "published") {
        return res.status(400).json({ success: false, message: `Shift "${shift_title}" is already published.` });
      }

      await prisma.shifts.update({
        where: { shift_id: Number(shift_id) },
        data: { status: "published" },
      });

      message = `Shift "${shift_title}" has been published. Staff can now see and acknowledge their assignments.`;
    }

    // ── Assign staff to task ───────────────────────────────────────────────────
    if (tool_name === "assign_staff_to_task") {
      const { task_id, staff_id, staff_name, shift_title, task_name } = args;

      // Verify the task belongs to a shift in this branch
      const task = await prisma.shift_tasks.findUnique({
        where: { task_id: Number(task_id) },
        include: { shifts: { select: { branch_id: true } } },
      });
      if (!task || task.shifts?.branch_id !== branchId) {
        return res.status(403).json({ success: false, message: "Task not found or access denied." });
      }

      // Verify staff belongs to this branch
      const staffMember = await prisma.staff.findFirst({
        where: { staff_id: Number(staff_id), branch_id: branchId },
      });
      if (!staffMember) {
        return res.status(403).json({ success: false, message: "Staff member not found in your branch." });
      }

      // Prevent duplicate assignments
      const existing = await prisma.task_assignments.findFirst({
        where: { task_id: Number(task_id), staff_id: Number(staff_id) },
      });
      if (existing) {
        return res.status(400).json({ success: false, message: `${staff_name} is already assigned to this task.` });
      }

      await prisma.task_assignments.create({
        data: { task_id: Number(task_id), shift_id: task.shift_id, staff_id: Number(staff_id) },
      });

      message = `${staff_name} has been assigned to "${task_name}" in "${shift_title}".`;
    }

    res.json({ success: true, message });
  } catch (err) {
    (req.log || logger).error({ err }, "[AI execute] error");
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: "Action failed. Please try again." });
    }
  }
}

module.exports = { execute };
