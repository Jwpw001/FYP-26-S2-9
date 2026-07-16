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

// ── Staff Roster ───────────────────────────────────────────────────────────────

const getStaffRoster = async (req, res) => {
  try {
    const shiftId = Number(req.params.shiftId);
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      select: { shift_date: true, outlet_id: true, start_time: true, end_time: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    const shiftDateStr = shift.shift_date.toISOString().slice(0, 10);
    const shiftDate    = new Date(shiftDateStr + "T00:00:00Z");
    const outletId     = shift.outlet_id;

    const staffList = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
    });

    const filtered = staffList.filter(s => s.users?.role !== "outlet_manager");
    const staffIds = filtered.map(s => s.staff_id);
    const userIds  = filtered.map(s => s.user_id).filter(Boolean);

    // Skills
    const skillTags = await prisma.user_skill_tags.findMany({
      where: { user_id: { in: userIds } },
      include: { skills: { select: { skill_id: true, name: true } } },
    });
    const skillMap = {};
    skillTags.forEach(st => {
      if (!skillMap[st.user_id]) skillMap[st.user_id] = [];
      skillMap[st.user_id].push({ skill_id: st.skill_id, name: st.skills?.name });
    });

    // Leave
    const leaveRows = await prisma.availability.findMany({
      where: { staff_id: { in: staffIds }, status: "approved", start_date: { lte: shiftDate }, end_date: { gte: shiftDate } },
      select: { staff_id: true },
    });
    const onLeaveIds = new Set(leaveRows.map(l => l.staff_id));

    // Double-booked on same date (other shifts)
    const otherAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds }, shift_id: { not: shiftId } },
      include: { shifts: { select: { shift_date: true } } },
    });
    const doubleBookedIds = new Set(
      otherAssignments
        .filter(a => a.shifts?.shift_date?.toISOString().slice(0, 10) === shiftDateStr)
        .map(a => a.staff_id)
    );

    // Already assigned to this shift
    const alreadyAssigned = await prisma.task_assignments.findMany({
      where: { shift_id: shiftId, staff_id: { in: staffIds } },
      select: { staff_id: true, task_id: true },
    });
    const assignedIds    = new Set(alreadyAssigned.map(a => a.staff_id));
    const assignedTaskMap = {};
    alreadyAssigned.forEach(a => { assignedTaskMap[a.staff_id] = a.task_id; });

    // Hours this week
    const weekStart = new Date(shiftDate);
    weekStart.setUTCDate(weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    const weekAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds }, shifts: { shift_date: { gte: weekStart, lte: weekEnd } } },
      include: { shifts: { select: { start_time: true, end_time: true } } },
    });
    const hoursMap = {};
    weekAssignments.forEach(a => {
      if (!a.staff_id || !a.shifts?.start_time || !a.shifts?.end_time) return;
      const h = (new Date(a.shifts.end_time) - new Date(a.shifts.start_time)) / 3600000;
      hoursMap[a.staff_id] = (hoursMap[a.staff_id] || 0) + h;
    });

    // Casual availability for shift day
    const shiftDow = shiftDate.getUTCDay();
    const casualIds = filtered.filter(s => s.staff_type === "casual").map(s => s.staff_id);
    let casualAvailSet = new Set();
    if (casualIds.length > 0) {
      const avail = await prisma.casual_availability.findMany({
        where: { staff_id: { in: casualIds }, day_of_week: shiftDow },
        select: { staff_id: true },
      });
      avail.forEach(a => casualAvailSet.add(a.staff_id));
    }

    const roster = filtered.map(s => ({
      staff_id:              s.staff_id,
      full_name:             s.users?.full_name || "Unknown",
      email:                 s.users?.email || "",
      staff_type:            s.staff_type,
      skills:                skillMap[s.user_id] || [],
      is_on_leave:           onLeaveIds.has(s.staff_id),
      is_double_booked:      doubleBookedIds.has(s.staff_id),
      already_assigned:      assignedIds.has(s.staff_id),
      assigned_task_id:      assignedTaskMap[s.staff_id] || null,
      hours_this_week:       Math.round((hoursMap[s.staff_id] || 0) * 10) / 10,
      casual_available_today: s.staff_type === "casual" ? casualAvailSet.has(s.staff_id) : null,
    }));

    res.json({ success: true, roster });
  } catch (error) {
    console.error("[getStaffRoster] ERROR:", error.message, error.stack?.split("\n")[1]);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Validate Assignment ─────────────────────────────────────────────────────

const validateAssignment = async (req, res) => {
  try {
    const taskId  = Number(req.params.taskId);
    const { staff_id, roster } = req.body;
    if (!staff_id) return res.status(400).json({ success: false, message: "staff_id required" });

    const task = await prisma.shift_tasks.findUnique({
      where: { task_id: taskId },
      include: {
        skills: { select: { skill_id: true, name: true } },
        shifts: { select: { start_time: true, end_time: true } },
      },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const selected = (roster || []).find(r => r.staff_id === Number(staff_id));
    if (!selected) return res.json({ success: true, suitable: true, message: "Assignment saved." });

    const taskSkill = task.skills?.name || null;
    const hasSkill  = !task.skill_id || selected.skills.some(s => s.skill_id === task.skill_id);
    const toHHMM    = t => { const s = String(t || ""); return s.includes("T") ? s.slice(11,16) : s.slice(0,5); };

    const alternatives = (roster || [])
      .filter(r =>
        r.staff_id !== Number(staff_id) &&
        !r.already_assigned && !r.is_on_leave && !r.is_double_booked &&
        (!task.skill_id || r.skills.some(s => s.skill_id === task.skill_id))
      )
      .sort((a, b) => a.hours_this_week - b.hours_this_week)
      .slice(0, 2);

    const Groq = require("groq-sdk");
    const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are a smart F&B workforce scheduling AI. Evaluate this staff assignment and respond in JSON only.

Task: "${task.title}"${taskSkill ? ` (requires: ${taskSkill})` : " (no specific skill required)"}
Shift hours: ${toHHMM(task.shifts?.start_time)}–${toHHMM(task.shifts?.end_time)}

Assigned: ${selected.full_name} (${selected.staff_type})
- Skills: ${selected.skills.map(s => s.name).join(", ") || "None"}
- Has required skill: ${hasSkill ? "Yes" : "No"}
- Hours this week: ${selected.hours_this_week}h
- On leave today: ${selected.is_on_leave ? "Yes" : "No"}
${selected.staff_type === "casual" ? `- Declared available today: ${selected.casual_available_today ? "Yes" : "No"}` : ""}

${alternatives.length > 0
  ? `Available alternatives (have skill, no conflicts):\n${alternatives.map(a => `- ${a.full_name}: ${a.hours_this_week}h this week, skills: ${a.skills.map(s=>s.name).join(", ")||"none"}`).join("\n")}`
  : "No better alternatives available."}

Respond ONLY with this JSON (no other text):
{ "suitable": true or false, "message": "1-2 sentence assessment", "alternative": null or { "name": "Name", "reason": "why they are a better fit in one sentence" } }`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 250,
      temperature: 0.15,
    });

    const raw   = completion.choices[0].message.content;
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.json({ success: true, suitable: true, message: "Assignment looks good." });

    const result = JSON.parse(match[0]);
    res.json({ success: true, ...result });
  } catch {
    res.json({ success: true, suitable: true, message: "Assignment saved successfully." });
  }
};

module.exports = { getShiftTasks, createTask, updateTask, deleteTask, assignStaff, unassignStaff, getMyTasks, getStaffRoster, validateAssignment };
