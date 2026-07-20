const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUsers } = require("../utils/notify");

async function getAssignedStaffUserIds(shiftId) {
  const assignments = await prisma.task_assignments.findMany({
    where: { shift_id: shiftId, staff_id: { not: null } },
    include: { staff: { select: { user_id: true } } },
  });
  return assignments.map(a => a.staff?.user_id).filter(Boolean);
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// Prisma serializes date/time columns as full ISO strings (e.g. "1970-01-01T09:00:00.000Z" for a
// `time` column). Frontend formatters expect Supabase-direct's plain "HH:MM:SS" / "YYYY-MM-DD" —
// normalize here so nothing downstream has to special-case the two formats.
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
  return {
    ...shift,
    shift_date: toDateOnly(shift.shift_date),
    start_time: toHHMMSS(shift.start_time),
    end_time: toHHMMSS(shift.end_time),
    shift_tasks: (shift.shift_tasks || []).map(t => ({ ...t, start_time: toHHMMSS(t.start_time), end_time: toHHMMSS(t.end_time) })),
  };
}

const getShifts = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found for your account." });

    const shifts = await prisma.shifts.findMany({
      where: { branch_id: branchId },
      include: {
        branches: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_tasks: {
          include: {
            skills: { select: { skill_id: true, name: true } },
            task_assignments: {
              include: {
                staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
              },
            },
          },
        },
      },
      orderBy: { shift_date: "asc" },
    });
    res.json({ success: true, shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getShiftById = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      include: {
        branches: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_tasks: {
          include: {
            skills: { select: { skill_id: true, name: true } },
            task_assignments: {
              include: {
                staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
              },
            },
          },
        },
      },
    });

    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && shift.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, shift: normalizeShift(shift) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const callerBranchId = await getCallerBranchId(req.user.user_id);
    const { branch_id, title, shift_date, start_time, end_time, deadline, status } = req.body;

    // Ensure manager can only create shifts for their own branch
    if (callerBranchId && branch_id && branch_id !== callerBranchId)
      return res.status(403).json({ success: false, message: "Cannot create shifts for a different branch." });

    const shift = await prisma.shifts.create({
      data: {
        branch_id: branch_id || callerBranchId,
        title: title || null,
        shift_date: new Date(shift_date),
        start_time: new Date(`1970-01-01T${start_time}:00Z`),
        end_time: new Date(`1970-01-01T${end_time}:00Z`),
        deadline: deadline ? new Date(deadline) : null,
        status,
        created_by: req.user.user_id,
      },
    });
    res.status(201).json({ success: true, message: "Shift created successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { branch_id: true, status: true, shift_date: true, start_time: true, end_time: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && existing.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const { branch_id, title, shift_date, start_time, end_time, status } = req.body;
    const shift = await prisma.shifts.update({
      where: { shift_id: shiftId },
      data: {
        branch_id: branch_id,
        title,
        shift_date: shift_date ? new Date(shift_date) : undefined,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : undefined,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : undefined,
        status,
      },
    });

    try {
      const wasVisible = existing.status !== "draft";
      const justPublished = existing.status === "draft" && status && status !== "draft";
      const dateOrTimeChanged = shift_date || start_time || end_time;
      const cancelled = status === "cancelled" && existing.status !== "cancelled";
      const dateStr = shift.shift_date ? new Date(shift.shift_date).toISOString().slice(0, 10) : "";

      if (justPublished) {
        const staffUserIds = await getAssignedStaffUserIds(shiftId);
        await notifyUsers(staffUserIds, {
          type: "shift_assigned",
          title: "New Shift Assignment",
          message: `You've been assigned to ${shift.title || "a shift"} on ${dateStr}.`,
          relatedEntity: "shifts",
          relatedId: shiftId,
        });
      } else if (wasVisible && (dateOrTimeChanged || cancelled)) {
        const staffUserIds = await getAssignedStaffUserIds(shiftId);
        await notifyUsers(staffUserIds, {
          type: cancelled ? "shift_cancelled" : "shift_updated",
          title: cancelled ? "Shift Cancelled" : "Shift Updated",
          message: cancelled
            ? `${shift.title || "Your shift"} on ${dateStr} has been cancelled.`
            : `${shift.title || "Your shift"} on ${dateStr} has been updated. Please check the new details.`,
          relatedEntity: "shifts",
          relatedId: shiftId,
        });
      }
    } catch { /* notification failure shouldn't block the update */ }

    res.json({ success: true, message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { branch_id: true, status: true, title: true, shift_date: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && existing.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const staffUserIds = existing.status !== "draft" ? await getAssignedStaffUserIds(shiftId) : [];

    await prisma.shifts.delete({ where: { shift_id: shiftId } });

    try {
      const dateStr = existing.shift_date ? new Date(existing.shift_date).toISOString().slice(0, 10) : "";
      await notifyUsers(staffUserIds, {
        type: "shift_cancelled",
        title: "Shift Cancelled",
        message: `${existing.title || "Your shift"} on ${dateStr} has been cancelled.`,
        relatedEntity: "shifts",
        relatedId: shiftId,
      });
    } catch { /* notification failure shouldn't block the deletion */ }

    res.json({ success: true, message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Weekly Schedule ─────────────────────────────────────────────────────────

const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const generateWeeklySchedule = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found." });

    const { weekStart, weekEnd } = req.body;
    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    // Fetch branch info
    const branch = await prisma.branches.findUnique({
      where: { branch_id: branchId },
      select: { name: true, open_time: true, close_time: true },
    });

    // Fetch all active staff
    const staff = await prisma.staff.findMany({
      where: { branch_id: branchId, is_active: true },
      include: { users: { select: { full_name: true, role: true } } },
    });

    const regularStaff = staff.filter(s => s.users?.role === "branch_regular_staff" || s.users?.role === "regular_staff");
    const casualStaff  = staff.filter(s => s.users?.role === "casual_staff");

    // Fetch casual availability for this week
    const casualIds = casualStaff.map(s => s.staff_id);
    const casualAvailRows = casualIds.length > 0
      ? await prisma.casual_availability.findMany({
          where: {
            staff_id: { in: casualIds },
            week_start_date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
          },
        })
      : [];

    // Build casual availability summary
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const casualMap = {};
    casualStaff.forEach(s => { casualMap[s.staff_id] = { name: s.users?.full_name, days: [] }; });
    casualAvailRows.forEach(r => {
      if (casualMap[r.staff_id]) {
        casualMap[r.staff_id].days.push({
          day: dayNames[r.day_of_week],
          from: r.available_from ? String(r.available_from).slice(0,5) : null,
          to:   r.available_to   ? String(r.available_to).slice(0,5)   : null,
        });
      }
    });

    // Fetch existing role templates for this branch
    const roleTemplates = await prisma.branch_role_templates.findMany({
      where: { branch_id: branchId },
      select: { role_name: true, headcount: true },
    }).catch(() => []);

    const context = {
      branch: { name: branch?.name, open_time: branch?.open_time, close_time: branch?.close_time },
      weekStart,
      weekEnd,
      regularStaff: regularStaff.map(s => s.users?.full_name),
      casualAvailability: Object.values(casualMap),
      roleTemplates: roleTemplates.map(r => ({ role: r.role_name, headcount: r.headcount })),
    };

    // Prisma returns time as a Date object — convert to "HH:MM" string
    const toHHMM = (val) => {
      if (!val) return null;
      if (typeof val === "string") return val.slice(0, 5);
      if (val instanceof Date) return val.toISOString().slice(11, 16);
      return String(val).slice(0, 5);
    };
    const openTime  = toHHMM(context.branch.open_time)  || "09:00";
    const closeTime = toHHMM(context.branch.close_time) || "22:00";

    // Calculate midpoint for morning/evening split
    const [openH, openM]   = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const totalMins   = (closeH * 60 + closeM) - (openH * 60 + openM);
    const midMins     = openH * 60 + openM + Math.floor(totalMins / 2);
    const midHour     = String(Math.floor(midMins / 60)).padStart(2, "0");
    const midMinute   = String(midMins % 60).padStart(2, "0");
    const midTime     = `${midHour}:${midMinute}`;

    const prompt = `You are a professional F&B workforce scheduling assistant.

Generate a COMPLETE weekly shift schedule for the week ${weekStart} to ${weekEnd}.

BRANCH INFO:
- Name: ${context.branch.name}
- Opening time: ${openTime}
- Closing time: ${closeTime}
- Suggested shift split: Morning ${openTime}–${midTime}, Evening ${midTime}–${closeTime}

REGULAR STAFF (available every single day):
${context.regularStaff.length > 0 ? context.regularStaff.map(n => `- ${n}`).join("\n") : "- None"}

CASUAL STAFF AVAILABILITY THIS WEEK:
${context.casualAvailability.length > 0
  ? context.casualAvailability.map(s => `- ${s.name}: ${s.days.map(d => `${d.day} ${d.from}-${d.to}`).join(", ")}`).join("\n")
  : "- No casual staff submitted availability"}

ROLE TEMPLATES (use these exact roles per shift):
${context.roleTemplates.length > 0
  ? context.roleTemplates.map(r => `- ${r.role} x${r.headcount}`).join("\n")
  : "- Service Staff x2, Kitchen Staff x1"}

MANDATORY RULES — follow every one:
1. EVERY day (${weekStart} through ${weekEnd}) MUST have BOTH a Morning shift AND an Evening shift. Do not skip any day. Do not generate only evening shifts.
2. Morning shift: ${openTime} to ${midTime}. Evening shift: ${midTime} to ${closeTime}.
3. Distribute regular staff evenly — no one person should work every single shift. Alternate staff between morning and evening.
4. Assign casual staff ONLY on days/hours they listed as available.
5. Every shift MUST include at least one role with at least one assigned staff member.
6. Use the provided role templates for each shift.
7. Return ONLY a valid JSON array — no prose, no markdown, no explanation.

EXAMPLE FORMAT (follow exactly):
[
  {
    "title": "Morning Shift",
    "date": "2026-06-22",
    "start_time": "${openTime}",
    "end_time": "${midTime}",
    "roles": [
      { "role_name": "Service Staff", "headcount": 2, "assigned_staff": ["Alice Tan", "Bob Lim"] }
    ]
  },
  {
    "title": "Evening Shift",
    "date": "2026-06-22",
    "start_time": "${midTime}",
    "end_time": "${closeTime}",
    "roles": [
      { "role_name": "Service Staff", "headcount": 2, "assigned_staff": ["Carol Ng"] }
    ]
  }
]

Generate ALL 14 shifts now (2 per day × 7 days):`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ success: false, message: "AI returned invalid schedule format. Please try again." });

    const schedule = JSON.parse(match[0]);
    return res.json({ success: true, schedule });
  } catch (err) {
    console.error("generateWeeklySchedule error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const confirmWeeklySchedule = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found." });

    const { shifts: scheduleShifts } = req.body;
    if (!Array.isArray(scheduleShifts) || scheduleShifts.length === 0)
      return res.status(400).json({ success: false, message: "No shifts provided." });

    // Fetch all staff for name→id lookup
    const allStaff = await prisma.staff.findMany({
      where: { branch_id: branchId, is_active: true },
      include: { users: { select: { full_name: true } } },
    });
    const nameToStaffId = {};
    allStaff.forEach(s => { if (s.users?.full_name) nameToStaffId[s.users.full_name.toLowerCase()] = s.staff_id; });

    const created = [];
    for (const s of scheduleShifts) {
      // Create shift
      const shift = await prisma.shifts.create({
        data: {
          branch_id: branchId,
          title: s.title || "Shift",
          shift_date: new Date(s.date),
          start_time: new Date(`1970-01-01T${s.start_time}:00Z`),
          end_time:   new Date(`1970-01-01T${s.end_time}:00Z`),
          status: "draft",
          created_by: null,
        },
      });

      // Create tasks + assignments (one task per staff member or per role slot)
      for (const role of (s.roles || [])) {
        const assignedNames = role.assigned_staff || [];
        const slots = Math.max(role.headcount || 1, assignedNames.length);

        for (let i = 0; i < slots; i++) {
          const task = await prisma.shift_tasks.create({
            data: {
              shift_id: shift.shift_id,
              title: role.role_name,
              status: "open",
            },
          });

          const staffName = assignedNames[i];
          if (staffName) {
            const staffId = nameToStaffId[staffName.toLowerCase()];
            if (staffId) {
              await prisma.task_assignments.create({
                data: { task_id: task.task_id, shift_id: shift.shift_id, staff_id: staffId, status: "assigned" },
              }).catch(() => {});
              await prisma.shift_tasks.update({ where: { task_id: task.task_id }, data: { status: "assigned" } });
            }
          }
        }
      }
      created.push(shift.shift_id);
    }

    return res.json({ success: true, created: created.length });
  } catch (err) {
    console.error("confirmWeeklySchedule error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift, generateWeeklySchedule, confirmWeeklySchedule };
