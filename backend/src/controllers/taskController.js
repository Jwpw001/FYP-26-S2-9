const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  if (s?.outlet_id) return s.outlet_id;
  const om = await prisma.outlet_managers.findFirst({ where: { user_id: userId }, select: { outlet_id: true } }).catch(() => null);
  return om?.outlet_id || null;
}

// ── Tasks ──────────────────────────────────────────────────────────────────────

const getShiftTasks = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const tasks = await prisma.shift_tasks.findMany({
      where: { shift_id: shiftId },
      include: {
        skills: { select: { skill_id: true, name: true } },
        task_assignments: {
          include: {
            staff: {
              include: { users: { select: { user_id: true, full_name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { task_id: "asc" },
    });
    res.json({ success: true, tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createTask = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const { title, description, skill_id, start_time, end_time } = req.body;

    if (!title?.trim()) return res.status(400).json({ success: false, message: "Task title is required." });

    const shift = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { shift_id: true } });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });

    const task = await prisma.shift_tasks.create({
      data: {
        shift_id: shiftId,
        title: title.trim(),
        description: description || null,
        skill_id: skill_id || null,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : null,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : null,
        status: "open",
      },
      include: { skills: { select: { skill_id: true, name: true } } },
    });
    res.status(201).json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateTask = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { title, description, skill_id, start_time, end_time, status } = req.body;

    const existing = await prisma.shift_tasks.findUnique({ where: { task_id: taskId } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found." });

    const task = await prisma.shift_tasks.update({
      where: { task_id: taskId },
      data: {
        title: title?.trim() || existing.title,
        description: description !== undefined ? description : existing.description,
        skill_id: skill_id !== undefined ? (skill_id || null) : existing.skill_id,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : existing.start_time,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : existing.end_time,
        status: status || existing.status,
      },
      include: { skills: { select: { skill_id: true, name: true } } },
    });
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const existing = await prisma.shift_tasks.findUnique({ where: { task_id: taskId } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found." });

    await prisma.shift_tasks.delete({ where: { task_id: taskId } });
    res.json({ success: true, message: "Task deleted." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Assignments ────────────────────────────────────────────────────────────────

const assignStaff = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const { staff_id } = req.body;

    if (!staff_id) return res.status(400).json({ success: false, message: "staff_id is required." });

    const task = await prisma.shift_tasks.findUnique({ where: { task_id: taskId }, select: { shift_id: true, status: true } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found." });

    // One task = one person: reject if already assigned
    const existing = await prisma.task_assignments.findFirst({ where: { task_id: taskId } });
    if (existing) return res.status(409).json({ success: false, message: "Task already has an assignee. Remove the current assignee first." });

    const assignment = await prisma.task_assignments.create({
      data: {
        task_id: taskId,
        shift_id: task.shift_id,
        staff_id: Number(staff_id),
        status: "assigned",
      },
      include: {
        staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
      },
    });

    // Update task status to assigned
    await prisma.shift_tasks.update({ where: { task_id: taskId }, data: { status: "assigned" } });

    res.status(201).json({ success: true, assignment });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const unassignStaff = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);

    const assignment = await prisma.task_assignments.findFirst({ where: { task_id: taskId } });
    if (!assignment) return res.status(404).json({ success: false, message: "No assignment found for this task." });

    await prisma.task_assignments.delete({ where: { assignment_id: assignment.assignment_id } });
    await prisma.shift_tasks.update({ where: { task_id: taskId }, data: { status: "open" } });

    res.json({ success: true, message: "Staff unassigned from task." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Staff: get my tasks for a shift
const getMyTasks = async (req, res) => {
  try {
    const userId = req.user.user_id || req.user.id;
    const staffRow = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true } });
    if (!staffRow) return res.json({ success: true, tasks: [] });

    const assignments = await prisma.task_assignments.findMany({
      where: { staff_id: staffRow.staff_id },
      include: {
        shift_tasks: {
          include: { skills: { select: { skill_id: true, name: true } } },
        },
        shifts: { select: { shift_id: true, title: true, shift_date: true, start_time: true, end_time: true, status: true } },
      },
      orderBy: { shifts: { shift_date: "asc" } },
    });

    res.json({ success: true, assignments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getShiftTasks, createTask, updateTask, deleteTask, assignStaff, unassignStaff, getMyTasks };
