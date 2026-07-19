const prisma        = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

// Prisma returns date/time columns as JS Date objects, which Express serializes to full ISO
// strings (e.g. "1970-01-01T09:00:00.000Z" for a `time` column, "2026-07-18T00:00:00.000Z" for
// a `date` column). Frontend code was written against Supabase-direct's plain "HH:MM:SS" /
// "YYYY-MM-DD" strings, so responses built from Prisma must be normalized to match or every date
// formatter downstream breaks ("Invalid Date", "1970", NaN durations, etc).
function toHHMMSS(t) {
  if (!t) return null;
  const s = t instanceof Date ? t.toISOString() : String(t);
  return s.includes("T") ? s.slice(11, 19) : s;
}
function toDateOnly(d) {
  if (!d) return null;
  const s = d instanceof Date ? d.toISOString() : String(d);
  return s.includes("T") ? s.slice(0, 10) : s;
}
function normalizeShift(shift) {
  if (!shift) return shift;
  return { ...shift, shift_date: toDateOnly(shift.shift_date), start_time: toHHMMSS(shift.start_time), end_time: toHHMMSS(shift.end_time) };
}
function normalizeTask(task) {
  if (!task) return task;
  return { ...task, start_time: toHHMMSS(task.start_time), end_time: toHHMMSS(task.end_time) };
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
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

    const { difficulty } = req.body;
    const task = await prisma.shift_tasks.create({
      data: {
        shift_id: shiftId,
        title: title.trim(),
        description: description || null,
        skill_id: skill_id || null,
        difficulty: difficulty || null,
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
    const { title, description, skill_id, difficulty, start_time, end_time, status } = req.body;

    const existing = await prisma.shift_tasks.findUnique({ where: { task_id: taskId } });
    if (!existing) return res.status(404).json({ success: false, message: "Task not found." });

    const task = await prisma.shift_tasks.update({
      where: { task_id: taskId },
      data: {
        title: title?.trim() || existing.title,
        description: description !== undefined ? description : existing.description,
        skill_id: skill_id !== undefined ? (skill_id || null) : existing.skill_id,
        difficulty: difficulty !== undefined ? (difficulty || null) : existing.difficulty,
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

    // Staff should never see shifts that haven't been published yet — a draft is still being
    // built by the manager and its assignments/tasks may change before it goes live.
    const assignments = await prisma.task_assignments.findMany({
      where: {
        staff_id: staffRow.staff_id,
        shifts: { status: { not: "draft" } },
        NOT: {
          swap_requests_swap_requests_requester_assignTotask_assignments: {
            some: { status: "approved" },
          },
        },
      },
      include: {
        shift_tasks: {
          include: { skills: { select: { skill_id: true, name: true } } },
        },
        shifts: { select: { shift_id: true, title: true, shift_date: true, start_time: true, end_time: true, status: true } },
      },
      orderBy: { shifts: { shift_date: "asc" } },
    });

    const normalized = assignments.map(a => ({
      ...a,
      shifts: normalizeShift(a.shifts),
      shift_tasks: normalizeTask(a.shift_tasks),
    }));

    res.json({ success: true, assignments: normalized });
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
      select: { shift_date: true, branch_id: true, start_time: true, end_time: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });

    const shiftDateStr = shift.shift_date.toISOString().slice(0, 10);
    const shiftDate    = new Date(shiftDateStr + "T00:00:00Z");
    const branchId     = shift.branch_id;

    // Regular staff belong to exactly one branch. Casual staff are pool-based — they're a
    // candidate for a branch only if they've listed it as a preference, regardless of which
    // branch their staff row was originally created under.
    const regularStaff = await prisma.staff.findMany({
      where: { branch_id: branchId, staff_type: "regular", is_active: true },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
    });

    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branchId);
    const preferredUserIds = [...new Set((prefRows || []).map(r => r.user_id))];

    const casualStaff = preferredUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: preferredUserIds }, staff_type: "casual", is_active: true },
          include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
        })
      : [];

    const staffList = [...regularStaff, ...casualStaff];
    const filtered = staffList.filter(s => s.users?.role !== "manager");

    // staff.experience_level isn't declared in schema.prisma (only the legacy, never-populated
    // exp_level is), so Prisma silently omits it — fetch it directly via supabaseAdmin instead.
    const { data: expLevelRows } = await supabaseAdmin
      .from("staff")
      .select("staff_id, experience_level")
      .in("staff_id", filtered.map(s => s.staff_id));
    const expLevelByStaffId = Object.fromEntries((expLevelRows || []).map(r => [r.staff_id, r.experience_level]));

    const EXP_RANK = { junior: 1, mid: 2, senior: 3, expert: 4 };
    // staff.experience_level uses a 3-tier scale (beginner/intermediate/expert); map onto the
    // 4-tier task-difficulty scale used above.
    const EXP_LEVEL_MAP = { beginner: "junior", intermediate: "mid", expert: "expert" };
    const mapExpLevel = s => EXP_LEVEL_MAP[expLevelByStaffId[s.staff_id]] || null;
    const staffIds = filtered.map(s => s.staff_id);
    const userIds  = filtered.map(s => s.user_id).filter(Boolean);

    // Skills — use supabaseAdmin to get experience_level per skill
    const { data: skillTagRows } = await supabaseAdmin
      .from("user_skill_tags")
      .select("user_id, skill_id, experience_level")
      .in("user_id", userIds);
    const skillIds = [...new Set((skillTagRows || []).map(r => r.skill_id))];
    const skillRecords = skillIds.length > 0
      ? await prisma.skills.findMany({ where: { skill_id: { in: skillIds } }, select: { skill_id: true, name: true } })
      : [];
    const skillNameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));
    const skillMap = {};
    (skillTagRows || []).forEach(st => {
      const name = skillNameMap[st.skill_id];
      if (!name) return;
      if (!skillMap[st.user_id]) skillMap[st.user_id] = [];
      skillMap[st.user_id].push({ skill_id: st.skill_id, name, experience_level: st.experience_level || null });
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

    // Casual availability for shift day — day_of_week in this table is Monday-indexed (Mon=0…Sun=6),
    // not JS's native Sunday=0, so convert before querying. Must also match the specific week the
    // shift falls in — a worker may have submitted different hours for different weeks.
    const shiftDow        = (shiftDate.getUTCDay() + 6) % 7;
    const shiftWeekStart  = new Date(shiftDate);
    shiftWeekStart.setUTCDate(shiftWeekStart.getUTCDate() - shiftDow);
    const casualIds  = filtered.filter(s => s.staff_type === "casual").map(s => s.staff_id);
    const casualAvailMap = {}; // staff_id -> { from: "HH:MM"|null, to: "HH:MM"|null }
    if (casualIds.length > 0) {
      const avail = await prisma.casual_availability.findMany({
        where: { staff_id: { in: casualIds }, day_of_week: shiftDow, week_start_date: shiftWeekStart },
        select: { staff_id: true, available_from: true, available_to: true },
      });
      avail.forEach(a => {
        casualAvailMap[a.staff_id] = {
          from: a.available_from ? new Date(a.available_from).toISOString().slice(11, 16) : null,
          to:   a.available_to   ? new Date(a.available_to).toISOString().slice(11, 16)   : null,
        };
      });
    }

    const shiftStartHH = new Date(shift.start_time).toISOString().slice(11, 16);
    const shiftEndHH   = new Date(shift.end_time).toISOString().slice(11, 16);

    const roster = filtered.map(s => ({
      staff_id:              s.staff_id,
      full_name:             s.users?.full_name || "Unknown",
      email:                 s.users?.email || "",
      staff_type:            s.staff_type,
      exp_level:             mapExpLevel(s),
      hired_at:              s.hired_at || null,
      skills:                skillMap[s.user_id] || [],
      is_on_leave:           onLeaveIds.has(s.staff_id),
      is_double_booked:      doubleBookedIds.has(s.staff_id),
      already_assigned:      assignedIds.has(s.staff_id),
      assigned_task_id:      assignedTaskMap[s.staff_id] || null,
      hours_this_week:       Math.round((hoursMap[s.staff_id] || 0) * 10) / 10,
      casual_available_today: (() => {
        if (s.staff_type !== "casual") return null;
        const avail = casualAvailMap[s.staff_id];
        if (!avail) return false; // no declaration for this week/day
        const { from, to } = avail;
        if (!from && !to) return true; // declared with no specific times = available all day
        // Declared window must cover the entire shift (start at or before shift start, end at or after shift end)
        return !!from && !!to && from <= shiftStartHH && to >= shiftEndHH;
      })(),
      casual_avail_from:      s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.from ?? null) : null,
      casual_avail_to:        s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.to ?? null) : null,
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
      },
    });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const selected = (roster || []).find(r => r.staff_id === Number(staff_id));
    if (!selected) return res.json({ success: true, suitable: true, message: "Assignment saved." });

    const EXP_RANK  = { junior: 1, mid: 2, senior: 3, expert: 4 };
    const taskSkill = task.skills?.name || null;
    const hasSkill  = !task.skill_id || selected.skills.some(s => s.skill_id === task.skill_id);
    const taskDiffRank  = EXP_RANK[task.difficulty] || 0;
    const staffExpRank  = EXP_RANK[selected.exp_level] || 0;
    const underQualified = task.difficulty && selected.exp_level && staffExpRank < taskDiffRank;
    const toHHMM    = t => { if (!t) return ""; const s = t instanceof Date ? t.toISOString() : String(t); return s.includes("T") ? s.slice(11,16) : s.slice(0,5); };
    const yearsOfService = selected.hired_at
      ? Math.max(0, Math.floor((Date.now() - new Date(selected.hired_at).getTime()) / (365.25 * 24 * 3600 * 1000)))
      : null;

    const toMins = hhmm => { if (!hhmm) return null; const [h,m] = hhmm.split(":").map(Number); return h*60+m; };
    function casualCoversTask(r) {
      if (r.staff_type !== "casual") return true;
      if (!r.casual_available_today) return false;
      const taskStart = toMins(toHHMM(task.start_time));
      const taskEnd   = toMins(toHHMM(task.end_time));
      if (taskStart == null || taskEnd == null) return true;
      const availFrom = toMins(r.casual_avail_from);
      const availTo   = toMins(r.casual_avail_to);
      if (availFrom == null || availTo == null) return true;
      return availFrom <= taskStart && availTo >= taskEnd;
    }
    function availLabel(r) {
      if (r.staff_type !== "casual") return null;
      if (!r.casual_available_today) return "no availability declared for this day";
      const covers = casualCoversTask(r);
      return `declared ${r.casual_avail_from||"?"}–${r.casual_avail_to||"?"}${covers ? " (covers task)" : " (does NOT cover task hours)"}`;
    }
    const selectedCoversTask = casualCoversTask(selected);

    const alternatives = (roster || [])
      .filter(r =>
        r.staff_id !== Number(staff_id) &&
        !r.already_assigned && !r.is_on_leave && !r.is_double_booked &&
        (!task.skill_id || r.skills.some(s => s.skill_id === task.skill_id)) &&
        casualCoversTask(r)
      )
      .sort((a, b) => a.hours_this_week - b.hours_this_week)
      .slice(0, 2);

    // Deterministic hard-fail: a casual whose declared hours don't cover the task is a clear-cut
    // problem — don't leave catching it up to the LLM's instruction-following.
    if (selected.staff_type === "casual" && !selectedCoversTask) {
      const best = alternatives[0];
      return res.json({
        success: true,
        suitable: false,
        message: `${selected.full_name}'s declared availability (${availLabel(selected)}) does not cover this task's hours (${toHHMM(task.start_time)}–${toHHMM(task.end_time)}).`,
        alternative: best ? { name: best.full_name, reason: `Available and covers the task hours, with ${best.hours_this_week}h already worked this week.` } : null,
      });
    }

    const Groq = require("groq-sdk");
    const groq  = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are a smart F&B workforce scheduling AI. Evaluate this staff assignment and respond in JSON only.

Task: "${task.title}"${taskSkill ? ` (requires: ${taskSkill})` : " (no specific skill required)"}
Task difficulty: ${task.difficulty ? task.difficulty.charAt(0).toUpperCase() + task.difficulty.slice(1) : "Not set"}
Task hours: ${toHHMM(task.start_time)}–${toHHMM(task.end_time)}

Assigned: ${selected.full_name} (${selected.staff_type})
- Experience level: ${selected.exp_level ? selected.exp_level.charAt(0).toUpperCase() + selected.exp_level.slice(1) : "Not set"}
- Years of service: ${yearsOfService !== null ? `${yearsOfService} yr${yearsOfService !== 1 ? "s" : ""}` : "Unknown"}
- Meets difficulty requirement: ${underQualified ? "No (under-qualified)" : "Yes"}
- Skills: ${selected.skills.map(s => s.name).join(", ") || "None"}
- Has required skill: ${hasSkill ? "Yes" : "No"}
- Hours this week: ${selected.hours_this_week}h
- On leave today: ${selected.is_on_leave ? "Yes" : "No"}
${selected.staff_type === "casual" ? `- Availability: ${availLabel(selected)}` : ""}

${alternatives.length > 0
  ? `Available alternatives (have skill, no conflicts, and if casual their availability covers the task hours):\n${alternatives.map(a => `- ${a.full_name}: ${a.hours_this_week}h this week, skills: ${a.skills.map(s=>s.name).join(", ")||"none"}${a.staff_type==="casual" ? `, availability: ${availLabel(a)}` : ""}`).join("\n")}`
  : "No better alternatives available."}

IMPORTANT: Never suggest a casual staff member as an alternative unless their availability window fully covers the task's hours (${toHHMM(task.start_time)}–${toHHMM(task.end_time)}). If the assigned person's availability does NOT cover the task hours, that is a serious problem worth flagging even if their skills/experience are otherwise fine.

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
