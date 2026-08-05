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
        users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
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
        users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
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

    // Validate against operating days
    if (shift_date) {
      const resolvedBranchId = branch_id || callerBranchId;
      const { data: branchSettings } = await supabaseAdmin
        .from("branch_settings")
        .select("operating_days")
        .eq("branch_id", resolvedBranchId)
        .maybeSingle();
      if (branchSettings?.operating_days) {
        // operating_days is a 7-char string "1111100" where index 0 = Monday
        const dayIndex = (new Date(shift_date + "T12:00:00Z").getUTCDay() + 6) % 7; // Mon=0, Sun=6
        if (branchSettings.operating_days[dayIndex] === "0") {
          return res.status(400).json({ success: false, message: "Shifts cannot be created on non-operating days." });
        }
      }
    }

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

    // Delete in FK dependency order (DB constraints may not cascade automatically)
    const assignments = await prisma.task_assignments.findMany({ where: { shift_id: shiftId }, select: { assignment_id: true } });
    const assignmentIds = assignments.map(a => a.assignment_id);
    if (assignmentIds.length > 0) {
      // swap_requests references task_assignments with NoAction — must go first
      await prisma.swap_requests.deleteMany({
        where: { OR: [{ requester_assign: { in: assignmentIds } }, { target_assign_id: { in: assignmentIds } }] },
      });
      await prisma.task_assignments.deleteMany({ where: { assignment_id: { in: assignmentIds } } });
    }
    await prisma.shift_tasks.deleteMany({ where: { shift_id: shiftId } });
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

    const { weekStart, weekEnd, preferences = {} } = req.body;
    const { shiftsPerDay = 2, shiftNames = ["Morning", "Evening"], offDays = [], shiftRoles: prefShiftRoles, roles: prefRoles, difficultyByDay = {} } = preferences;

    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    // Branch info
    const branch = await prisma.branches.findUnique({
      where: { branch_id: branchId },
      select: { name: true, open_time: true, close_time: true },
    });

    // Regular staff — direct branch assignment
    const regularStaffRows = await prisma.staff.findMany({
      where: { branch_id: branchId, is_active: true, staff_type: "regular" },
      include: { users: { select: { full_name: true } } },
    });

    // Casual staff — via casual_branch_preferences (not branch_id)
    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branchId);
    const preferredUserIds = (prefRows || []).map(r => r.user_id);
    const casualStaffRows = preferredUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: preferredUserIds }, staff_type: "casual", is_active: true },
          include: { users: { select: { full_name: true } } },
        })
      : [];

    const regularStaff = regularStaffRows.map(s => s.users?.full_name).filter(Boolean);

    // Casual availability for this week
    // week_start_date is always the Monday — match exactly using noon UTC to avoid timezone drift
    const casualIds = casualStaffRows.map(s => s.staff_id);
    const casualAvailRows = casualIds.length > 0
      ? await prisma.casual_availability.findMany({
          where: { staff_id: { in: casualIds }, week_start_date: new Date(weekStart + "T12:00:00Z") },
        })
      : [];

    // day_of_week uses Mon=0…Sun=6 (same convention as casual_availability table)
    const dowNames = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const timeVal = (v) => {
      if (!v) return null;
      if (v instanceof Date) return v.toISOString().slice(11, 16);
      return String(v).slice(0, 5);
    };
    const [wsy, wsm, wsd] = weekStart.split("-").map(Number);
    const casualMap = {};
    casualStaffRows.forEach(s => { casualMap[s.staff_id] = { name: s.users?.full_name, slots: [] }; });
    casualAvailRows.forEach(r => {
      if (!casualMap[r.staff_id]) return;
      // Convert day_of_week offset from this week's Monday to a specific date
      const actualDate = new Date(Date.UTC(wsy, wsm - 1, wsd + r.day_of_week));
      const dateStr = actualDate.toISOString().split("T")[0];
      casualMap[r.staff_id].slots.push({
        date: dateStr,
        day: dowNames[r.day_of_week],
        from: timeVal(r.available_from),
        to: timeVal(r.available_to),
      });
    });

    // Role templates — per-shift if provided, else flat roles, else DB templates
    const dbTemplates = await prisma.branch_role_templates.findMany({
      where: { branch_id: branchId },
      select: { role_name: true, headcount: true },
    }).catch(() => []);

    // Build per-shift role map: shiftSlots[i].name → roles array
    const getRolesForShift = (i) => {
      if (Array.isArray(prefShiftRoles) && prefShiftRoles[i]?.length > 0) {
        return prefShiftRoles[i].filter(r => r.role_name?.trim());
      }
      if (Array.isArray(prefRoles) && prefRoles.length > 0) {
        return prefRoles.filter(r => r.role_name?.trim());
      }
      return dbTemplates;
    };

    // Build shift time slots
    const toHHMM = (val) => {
      if (!val) return null;
      if (typeof val === "string") return val.slice(0, 5);
      if (val instanceof Date) return val.toISOString().slice(11, 16);
      return String(val).slice(0, 5);
    };
    const openTime  = toHHMM(branch?.open_time)  || "09:00";
    const closeTime = toHHMM(branch?.close_time) || "22:00";
    const [openH, openM]   = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const totalMins = (closeH * 60 + closeM) - (openH * 60 + openM);
    const slotMins  = Math.floor(totalMins / shiftsPerDay);
    const fmt = (mins) => `${String(Math.floor(mins / 60)).padStart(2,"0")}:${String(mins % 60).padStart(2,"0")}`;

    const shiftSlots = Array.from({ length: shiftsPerDay }, (_, i) => {
      const startMins = openH * 60 + openM + i * slotMins;
      const endMins   = i === shiftsPerDay - 1 ? closeH * 60 + closeM : startMins + slotMins;
      return { name: shiftNames[i] || `Shift ${i + 1}`, start: fmt(startMins), end: fmt(endMins) };
    });

    // Working days (manager-selected off-days excluded)
    // Use UTC methods to avoid local-timezone shifting YYYY-MM-DD strings
    const [sy, sm, sd] = weekStart.split("-").map(Number);
    const allDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.UTC(sy, sm - 1, sd + i));
      return d.toISOString().split("T")[0];
    });
    const workingDays = allDays.filter(d => !offDays.includes(d));

    // ── Fetch additional context in parallel ──────────────────────────────────
    const [{ data: branchSettings }, { data: branchAlloc }] = await Promise.all([
      supabaseAdmin.from("branch_settings").select("*").eq("branch_id", branchId).maybeSingle(),
      supabaseAdmin.from("branch_allocation_preferences").select("*").eq("branch_id", branchId).maybeSingle(),
    ]);

    // Public holidays this week that are active → skip them
    const rawHolidays = Array.isArray(branchSettings?.holidays) ? branchSettings.holidays : [];
    const activeHolidaysThisWeek = rawHolidays.filter(h => h.active !== false && workingDays.includes(h.date));
    const finalWorkingDays = workingDays.filter(d => !activeHolidaysThisWeek.some(h => h.date === d));

    // Approved leave for all staff during the week
    const allStaffIds = [...regularStaffRows.map(s => s.staff_id), ...casualStaffRows.map(s => s.staff_id)];
    const staffIdToName = {};
    [...regularStaffRows, ...casualStaffRows].forEach(s => { staffIdToName[s.staff_id] = s.users?.full_name; });

    const { data: leaveRows } = allStaffIds.length > 0
      ? await supabaseAdmin.from("availability").select("staff_id, start_date, end_date")
          .eq("status", "approved").lte("start_date", weekEnd).gte("end_date", weekStart).in("staff_id", allStaffIds)
      : { data: [] };

    const leaveDaysByName = {};
    (leaveRows || []).forEach(l => {
      const name = staffIdToName[l.staff_id];
      if (!name) return;
      if (!leaveDaysByName[name]) leaveDaysByName[name] = [];
      const s = new Date(l.start_date + "T00:00:00"), e = new Date(l.end_date + "T00:00:00");
      for (const cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1)) {
        const ds = cur.toISOString().split("T")[0];
        if (finalWorkingDays.includes(ds)) leaveDaysByName[name].push(ds);
      }
    });
    const leaveLines = Object.entries(leaveDaysByName)
      .filter(([, dates]) => dates.length > 0)
      .map(([name, dates]) => `- ${name}: UNAVAILABLE on ${dates.join(", ")}`)
      .join("\n") || "- None this week";

    // Staff skills via user_skill_tags
    const allUserIds = [...regularStaffRows, ...casualStaffRows].map(s => s.user_id).filter(Boolean);
    const skillTagRows = allUserIds.length > 0
      ? await prisma.user_skill_tags.findMany({
          where: { user_id: { in: allUserIds } },
          include: { skills: { select: { name: true } } },
        }).catch(() => [])
      : [];
    const userIdToSkillName = {};
    [...regularStaffRows, ...casualStaffRows].forEach(s => { if (s.user_id) userIdToSkillName[s.user_id] = s.users?.full_name; });
    const skillsByStaff = {};
    skillTagRows.forEach(t => {
      const name = userIdToSkillName[t.user_id];
      if (!name || !t.skills?.name) return;
      if (!skillsByStaff[name]) skillsByStaff[name] = [];
      skillsByStaff[name].push(t.skills.name);
    });
    const allStaffNamesList = [...regularStaff, ...Object.values(casualMap).map(s => s.name)].filter(Boolean);
    const staffSkillLines = allStaffNamesList.map(name => {
      const skills = skillsByStaff[name];
      return `- ${name}: ${skills?.length > 0 ? skills.join(", ") : "general (no specific skills recorded)"}`;
    }).join("\n") || "- None";

    // Business rules from settings
    const stdHours    = branchSettings?.work_hours_day      || 8;
    const maxHours    = branchSettings?.max_work_hours_day  || 12;
    const maxConsec   = branchSettings?.max_consecutive_days || 6;
    const minWorkers  = branchSettings?.min_workers_per_assignment || 1;
    const allowOT     = branchSettings?.allow_overtime ?? false;

    // Allocation weights
    const wAvail   = branchAlloc?.weight_availability ?? 40;
    const wSkills  = branchAlloc?.weight_skills       ?? 30;
    const wAttend  = branchAlloc?.weight_attendance   ?? 15;
    const wPerf    = branchAlloc?.weight_performance  ?? 10;
    const wWork    = branchAlloc?.weight_workload      ?? 5;

    const totalShifts = finalWorkingDays.length * shiftsPerDay;

    // Pre-compute total role slots and per-person target for balance enforcement
    const totalRoleSlots = finalWorkingDays.length * shiftSlots.reduce((sum, _, i) => {
      const roles = getRolesForShift(i);
      return sum + (roles.length > 0 ? roles.reduce((s, r) => s + (r.headcount || 1), 0) : 1);
    }, 0);
    const staffCount = allStaffNamesList.length;
    const targetPerPerson = staffCount > 0 ? Math.ceil(totalRoleSlots / staffCount) : 0;

    // Casuals who have no availability submissions this week
    const missedCasuals = Object.values(casualMap)
      .filter(c => c.slots.length === 0)
      .map(c => c.name)
      .filter(Boolean);

    // Pre-compute eligible staff per date+shift so the AI has an explicit allowed list
    const casualSlotsByDate = {};
    Object.values(casualMap).forEach(({ name, slots }) => {
      slots.forEach(({ date, from, to }) => {
        if (!casualSlotsByDate[date]) casualSlotsByDate[date] = {};
        if (!casualSlotsByDate[date][name]) casualSlotsByDate[date][name] = { from, to };
      });
    });

    function toMins(hhmm) {
      if (!hhmm) return null;
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    }

    const eligibleLines = finalWorkingDays.map(date => {
      const onLeaveNames = new Set(
        Object.entries(leaveDaysByName).filter(([, ds]) => ds.includes(date)).map(([n]) => n)
      );
      return shiftSlots.map(slot => {
        const ss = toMins(slot.start), se = toMins(slot.end);
        const eligible = [];
        regularStaff.forEach(name => { if (!onLeaveNames.has(name)) eligible.push(name); });
        const casualOnDate = casualSlotsByDate[date] || {};
        Object.entries(casualOnDate).forEach(([name, { from, to }]) => {
          if (onLeaveNames.has(name)) return;
          const af = toMins(from), at = toMins(to);
          // Eligible if available on this day; annotate if time window doesn't fully cover shift
          const fullyCovers = af !== null && at !== null && af <= ss && at >= se;
          const note = (!fullyCovers && from && to) ? ` [avail ${from}–${to}]` : "";
          eligible.push(name + note);
        });
        return `  ${date} ${slot.name} (${slot.start}–${slot.end}): [${eligible.join(", ") || "NO ONE AVAILABLE"}]`;
      }).join("\n");
    }).join("\n");

    const prompt = `You are a professional workforce scheduling assistant.

Generate a complete weekly shift schedule for the week ${weekStart} to ${weekEnd}.

WORKPLACE: ${branch?.name || "Branch"}, open ${openTime}–${closeTime}

SHIFT STRUCTURE (${shiftsPerDay} shift${shiftsPerDay > 1 ? "s" : ""} per day):
${shiftSlots.map(s => `- ${s.name}: ${s.start}–${s.end}`).join("\n")}

════════════════════════════════════════
RULE #1 — AVAILABILITY IS ABSOLUTE (cannot be overridden by any other rule):
You MUST only assign staff from the ELIGIBLE STAFF list for each specific shift below.
Assigning anyone NOT on that list is a hard error, even for balance purposes.
- Regular staff on approved leave are excluded.
- Casual staff appear in the list ONLY for days they submitted availability.
- If a casual staff's time window is annotated as [avail HH:MM–HH:MM], it means their
  declared window does not fully cover the shift. You MAY still assign them — but prefer
  staff without annotations when workload balance allows.

ELIGIBLE STAFF PER SHIFT (the ONLY people you may assign):
${eligibleLines}
════════════════════════════════════════

WORKING DAYS — generate shifts ONLY for these dates:
${finalWorkingDays.map(d => `- ${d}`).join("\n") || "- None"}
${offDays.length > 0 ? `MANAGER OFF-DAYS (skip): ${offDays.join(", ")}` : ""}
${activeHolidaysThisWeek.length > 0 ? `PUBLIC HOLIDAYS (skip): ${activeHolidaysThisWeek.map(h => `${h.date} (${h.name})`).join(", ")}` : ""}

STAFF SKILLS (use for role matching within the eligible pool only):
${staffSkillLines}

ROLE TEMPLATES PER SHIFT (base structure):
${shiftSlots.map((s, i) => {
  const roles = getRolesForShift(i);
  const rolesStr = roles.length > 0 ? roles.map(r => `${r.role_name} x${r.headcount}`).join(", ") : "Staff x1";
  return `- ${s.name} (${s.start}–${s.end}): ${rolesStr}`;
}).join("\n")}

SKILL LEVEL REQUIREMENTS (per date — overrides base structure):
${finalWorkingDays.map(date => {
  const dayDiff = difficultyByDay[date] || {};
  const lines = shiftSlots.map((s, si) => {
    const roles = getRolesForShift(si);
    const roleParts = roles.map((r, j) => {
      const diff = (dayDiff[si] || {})[j] || "any";
      return diff !== "any" ? `${r.role_name} [${diff}]` : null;
    }).filter(Boolean);
    return roleParts.length ? `  ${date} ${s.name}: ${roleParts.join(", ")}` : null;
  }).filter(Boolean);
  return lines.join("\n");
}).filter(Boolean).join("\n") || "  (all roles set to Any — no restrictions)"}

SKILL LEVEL MATCHING RULE:
- "any": no restriction, all eligible staff qualify
- "junior": prefer staff whose skills show beginner/junior experience
- "intermediate": prefer staff with intermediate or higher experience
- "senior": only assign staff with senior or expert experience; do NOT assign beginners/juniors
- "lead": only assign the most experienced staff; reserve for the highest-skill roles
Regular staff without recorded skills may fill "any" or "junior" roles only.

BUSINESS RULES:
- Max ${maxHours}h per person per day
- Max ${maxConsec} consecutive days
- Min ${minWorkers} worker per role slot
- Overtime: ${allowOT ? "allowed" : "NOT allowed"}

WORKLOAD BALANCE (secondary — only after availability is satisfied):
- Across the whole week, keep each eligible person's assignment count as even as possible.
- Within each shift's eligible pool, prefer the person with the fewest assignments so far.
- DO NOT violate Rule #1 to achieve balance. If someone can only work 2 days, that is their max — do not assign them on other days to close the gap.

MANDATORY RULES:
1. ONLY assign staff from the ELIGIBLE STAFF list for each shift. No exceptions.
2. Every working day must have all ${shiftsPerDay} shifts: ${shiftSlots.map(s => s.name).join(", ")}.
3. Each shift uses its own role template.
4. Within a single shift, each person may appear in only ONE role.
5. Every shift must have at least one staff assigned.
6. Return ONLY a valid JSON array — no prose, no markdown, no code fences.

OUTPUT FORMAT:
[
  {
    "title": "${shiftSlots[0].name} Shift",
    "date": "${finalWorkingDays[0] || weekStart}",
    "start_time": "${shiftSlots[0].start}",
    "end_time": "${shiftSlots[0].end}",
    "roles": [
      { "role_name": "${getRolesForShift(0)[0]?.role_name || "Staff"}", "headcount": ${getRolesForShift(0)[0]?.headcount || 1}, "assigned_staff": ["Alice Tan"] }
    ]
  }
]

Generate ALL ${totalShifts} shifts now (${shiftsPerDay} per day × ${finalWorkingDays.length} working days):`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 5000,
      temperature: 0.2,
    });

    const raw = completion.choices[0].message.content;
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ success: false, message: "AI returned invalid schedule format. Please try again." });

    const schedule = JSON.parse(match[0]);
    return res.json({ success: true, schedule, hasRoleTemplates: dbTemplates.length > 0, missedCasuals });
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

// ── Deterministic staff redistribution (no AI) ────────────────────────────────
const rescheduleStaff = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found." });

    const { schedule } = req.body;
    if (!Array.isArray(schedule) || schedule.length === 0)
      return res.status(400).json({ success: false, message: "No schedule provided." });

    const dates = schedule.map(s => s.date).sort();
    const ws = dates[0], we = dates[dates.length - 1];

    // Regular staff
    const regularRows = await prisma.staff.findMany({
      where: { branch_id: branchId, is_active: true, staff_type: "regular" },
      include: { users: { select: { full_name: true } } },
    });

    // Casual staff via preferences
    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences").select("user_id").eq("branch_id", branchId);
    const prefUserIds = (prefRows || []).map(r => r.user_id);
    const casualRows = prefUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: prefUserIds }, staff_type: "casual", is_active: true },
          include: { users: { select: { full_name: true } } },
        })
      : [];

    // Casual availability indexed by staffId → dayOfWeek (Mon=0..Sun=6) → { from, to }
    // Don't filter by week_start_date range — it can exclude the Monday entry when the
    // first shift falls on a non-Monday day (e.g. Tuesday when Monday is an off day).
    // Instead take the most-recent entry per (staff_id, day_of_week).
    const casualIds = casualRows.map(s => s.staff_id);
    const casualAvailMap = {};
    if (casualIds.length > 0) {
      const { data: availRows } = await supabaseAdmin
        .from("casual_availability")
        .select("staff_id, day_of_week, available_from, available_to, week_start_date")
        .in("staff_id", casualIds)
        .order("week_start_date", { ascending: false });
      const seen = new Set();
      (availRows || []).forEach(r => {
        const key = `${r.staff_id}:${r.day_of_week}`;
        if (seen.has(key)) return;
        seen.add(key);
        if (!casualAvailMap[r.staff_id]) casualAvailMap[r.staff_id] = {};
        casualAvailMap[r.staff_id][r.day_of_week] = {
          from: r.available_from ? String(r.available_from).slice(0, 5) : null,
          to:   r.available_to   ? String(r.available_to).slice(0, 5)   : null,
        };
      });
    }

    // Approved leave
    const allIds = [...regularRows.map(s => s.staff_id), ...casualIds];
    const { data: leaveRows } = allIds.length > 0
      ? await supabaseAdmin.from("availability").select("staff_id, start_date, end_date")
          .eq("status", "approved").lte("start_date", we).gte("end_date", ws).in("staff_id", allIds)
      : { data: [] };

    const idToName = {};
    [...regularRows, ...casualRows].forEach(s => { idToName[s.staff_id] = s.users?.full_name; });
    const leaveDates = {};
    (leaveRows || []).forEach(l => {
      const name = idToName[l.staff_id];
      if (!name) return;
      if (!leaveDates[name]) leaveDates[name] = new Set();
      const s = new Date(l.start_date + "T00:00:00"), e = new Date(l.end_date + "T00:00:00");
      for (const cur = new Date(s); cur <= e; cur.setDate(cur.getDate() + 1))
        leaveDates[name].add(cur.toISOString().split("T")[0]);
    });

    // Staff skills
    const allUserIds = [...regularRows, ...casualRows].map(s => s.user_id).filter(Boolean);
    const skillRows = allUserIds.length > 0
      ? await prisma.user_skill_tags.findMany({
          where: { user_id: { in: allUserIds } },
          include: { skills: { select: { name: true } } },
        }).catch(() => [])
      : [];
    const skillsByUserId = {};
    skillRows.forEach(t => {
      if (!skillsByUserId[t.user_id]) skillsByUserId[t.user_id] = [];
      if (t.skills?.name) skillsByUserId[t.user_id].push(t.skills.name.toLowerCase());
    });

    function toMins(t) {
      if (!t) return null;
      const [h, m] = String(t).slice(0, 5).split(":").map(Number);
      return h * 60 + m;
    }

    // Build staff pool
    const staffPool = [
      ...regularRows.map(s => ({
        name: s.users?.full_name, type: "regular",
        skills: skillsByUserId[s.user_id] || [],
        staffId: s.staff_id,
      })),
      ...casualRows.map(s => ({
        name: s.users?.full_name, type: "casual",
        skills: skillsByUserId[s.user_id] || [],
        staffId: s.staff_id,
        avail: casualAvailMap[s.staff_id] || {},
      })),
    ].filter(s => s.name);

    const assignCount = {};
    staffPool.forEach(s => { assignCount[s.name] = 0; });

    function canWork(staff, dateStr) {
      if (leaveDates[staff.name]?.has(dateStr)) return false;
      if (staff.type === "casual") {
        // Use noon UTC to get the correct calendar day regardless of server timezone
        const dow = (new Date(dateStr + "T12:00:00Z").getUTCDay() + 6) % 7;
        const av = staff.avail[dow];
        // Eligible on any day they submitted availability; time window is shown as a warning, not a gate
        return av !== undefined;
      }
      return true;
    }

    // Sort chronologically for fair round-robin, then restore original order
    const origOrder = {};
    schedule.forEach((s, i) => { origOrder[`${s.date}||${s.start_time}||${s.title}`] = i; });

    const sorted = [...schedule].sort((a, b) =>
      a.date !== b.date ? a.date.localeCompare(b.date) : a.start_time.localeCompare(b.start_time)
    );

    const result = sorted.map(shift => {
      const usedInShift = new Set();
      const roles = (shift.roles || []).map(role => {
        const roleLower = (role.role_name || "").toLowerCase();
        const assigned_staff = [];

        for (let slot = 0; slot < (role.headcount || 1); slot++) {
          const candidates = staffPool
            .filter(s => s.name && !usedInShift.has(s.name) && !assigned_staff.includes(s.name) &&
              canWork(s, shift.date))
            .sort((a, b) => {
              // Primary: fewest total assignments (balance)
              const diff = assignCount[a.name] - assignCount[b.name];
              if (diff !== 0) return diff;
              // Tiebreaker: skill match
              const aSkill = a.skills.some(sk => roleLower.includes(sk) || sk.includes(roleLower));
              const bSkill = b.skills.some(sk => roleLower.includes(sk) || sk.includes(roleLower));
              return aSkill === bSkill ? 0 : aSkill ? -1 : 1;
            });

          if (candidates.length === 0) break;
          const chosen = candidates[0];
          assigned_staff.push(chosen.name);
          assignCount[chosen.name]++;
          usedInShift.add(chosen.name);
        }
        return { ...role, assigned_staff };
      });
      return { ...shift, roles };
    });

    result.sort((a, b) => {
      const ka = `${a.date}||${a.start_time}||${a.title}`;
      const kb = `${b.date}||${b.start_time}||${b.title}`;
      return (origOrder[ka] ?? 999) - (origOrder[kb] ?? 999);
    });

    return res.json({ success: true, schedule: result });
  } catch (err) {
    console.error("rescheduleStaff error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const reviewWeeklySchedule = async (req, res) => {
  try {
    const { schedule } = req.body;
    if (!Array.isArray(schedule) || schedule.length === 0) {
      return res.status(400).json({ error: "No schedule provided" });
    }

    function parseH(t) {
      const [h, m] = (t || "00:00").slice(0, 5).split(":").map(Number);
      return h + m / 60;
    }

    const staffMap = {};
    let totalSlots = 0, filledSlots = 0, understaffedRoles = 0;

    schedule.forEach(shift => {
      const hours = Math.max(0, parseH(shift.end_time) - parseH(shift.start_time));
      (shift.roles || []).forEach(role => {
        totalSlots += role.headcount || 1;
        const assigned = (role.assigned_staff || []).length;
        filledSlots += Math.min(assigned, role.headcount || 1);
        if (assigned < (role.headcount || 1)) understaffedRoles++;
        (role.assigned_staff || []).forEach(name => {
          if (!staffMap[name]) staffMap[name] = { shifts: 0, hours: 0 };
          staffMap[name].shifts++;
          staffMap[name].hours += hours;
        });
      });
    });

    const staffList = Object.entries(staffMap).map(([name, s]) => ({
      name, shifts: s.shifts, hours: Math.round(s.hours * 10) / 10,
    }));
    const hours = staffList.map(s => s.hours);
    const maxH = hours.length > 0 ? Math.max(...hours) : 0;
    const minH = hours.length > 0 ? Math.min(...hours) : 0;
    const avgH = hours.length > 0 ? hours.reduce((a, b) => a + b, 0) / hours.length : 0;

    const workingDays = [...new Set(schedule.map(s => {
      const d = new Date(s.date + "T00:00:00");
      return d.toLocaleDateString("en-SG", { weekday: "short" });
    }))].join(", ");

    const prompt = `You are a workforce scheduling assistant. Review this weekly shift schedule and provide concise, actionable feedback.

SCHEDULE OVERVIEW:
- Total shifts: ${schedule.length} over ${workingDays}
- Role slots: ${filledSlots}/${totalSlots} filled (${understaffedRoles} understaffed roles)

STAFF WORKLOAD:
${staffList.length > 0 ? staffList.map(s => `- ${s.name}: ${s.shifts} shift(s), ${s.hours}h total`).join("\n") : "- No staff assigned yet"}
Average: ${avgH.toFixed(1)}h | Spread (max-min): ${(maxH - minH).toFixed(1)}h

SHIFT DETAILS:
${schedule.map(s => `- ${s.date} "${s.title}" ${s.start_time}–${s.end_time}: ${(s.roles || []).map(r => `${r.role_name || "Role"} ${(r.assigned_staff || []).length}/${r.headcount}`).join(", ")}`).join("\n")}

Respond ONLY with valid JSON:
{
  "score": <integer 0-100, overall schedule quality>,
  "summary": "<2-3 sentence overall assessment>",
  "flags": [
    { "severity": "warning"|"info"|"success", "message": "<short actionable point>" }
  ]
}
Max 5 flags. Cover: coverage gaps, workload balance, overworked staff, positive observations.`;

    const OpenAI = require("openai");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 600,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const review = JSON.parse(completion.choices[0].message.content);
    return res.json({ success: true, review });
  } catch (err) {
    console.error("reviewWeeklySchedule error:", err.message);
    return res.status(500).json({ error: err.message });
  }
};

// ── Preview Roster (for AI draft shifts — no shift_id required) ───────────────
const previewRoster = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found." });

    const { date, start_time, end_time } = req.query;
    if (!date || !start_time || !end_time)
      return res.status(400).json({ success: false, message: "date, start_time, end_time required" });

    const shiftDate    = new Date(date + "T00:00:00Z");
    const shiftDateStr = date;

    const regularStaff = await prisma.staff.findMany({
      where: { branch_id: branchId, staff_type: "regular", is_active: true },
      include: { users: { select: { user_id: true, full_name: true, role: true } } },
    });

    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branchId);
    const preferredUserIds = [...new Set((prefRows || []).map(r => r.user_id))];
    const casualStaff = preferredUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: preferredUserIds }, staff_type: "casual", is_active: true },
          include: { users: { select: { user_id: true, full_name: true, role: true } } },
        })
      : [];

    const filtered = [...regularStaff, ...casualStaff].filter(s => s.users?.role !== "manager");
    const staffIds  = filtered.map(s => s.staff_id);
    const userIds   = filtered.map(s => s.user_id).filter(Boolean);

    // Skills
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
      skillMap[st.user_id].push({ name, experience_level: st.experience_level || null });
    });

    // Leave
    const leaveRows = await prisma.availability.findMany({
      where: { staff_id: { in: staffIds }, status: "approved", start_date: { lte: shiftDate }, end_date: { gte: shiftDate } },
      select: { staff_id: true },
    });
    const { data: offDayRows = [] } = await supabaseAdmin
      .from("off_day_requests")
      .select("staff_id")
      .in("staff_id", staffIds)
      .eq("status", "approved")
      .eq("requested_date", shiftDateStr);
    const onLeaveIds = new Set([...leaveRows.map(l => l.staff_id), ...offDayRows.map(o => o.staff_id)]);

    // Double-booked
    const toMinsHH = hhmm => { if (!hhmm) return null; const [h,m] = hhmm.split(":").map(Number); return h*60+m; };
    const toMinsISO = t => t ? toMinsHH(new Date(t).toISOString().slice(11,16)) : null;
    const thisStart = toMinsHH(start_time);
    const thisEnd   = toMinsHH(end_time);

    const otherAssignments = await prisma.task_assignments.findMany({
      where: { staff_id: { in: staffIds } },
      include: { shifts: { select: { shift_date: true, title: true, start_time: true, end_time: true } } },
    });
    const sameDayConflicts = otherAssignments.filter(a => {
      if (a.shifts?.shift_date?.toISOString().slice(0,10) !== shiftDateStr) return false;
      const os = toMinsISO(a.shifts?.start_time), oe = toMinsISO(a.shifts?.end_time);
      if (thisStart == null || thisEnd == null || os == null || oe == null) return true;
      return thisStart < oe && thisEnd > os;
    });
    const doubleBookedIds = new Set(sameDayConflicts.map(a => a.staff_id));
    const doubleBookedShiftMap = {};
    sameDayConflicts.forEach(a => {
      if (!doubleBookedShiftMap[a.staff_id] && a.shifts) {
        doubleBookedShiftMap[a.staff_id] = {
          title:      a.shifts.title || "Shift",
          start_time: a.shifts.start_time ? new Date(a.shifts.start_time).toISOString().slice(11,16) : null,
          end_time:   a.shifts.end_time   ? new Date(a.shifts.end_time).toISOString().slice(11,16)   : null,
        };
      }
    });

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
      hoursMap[a.staff_id] = (hoursMap[a.staff_id] || 0) +
        (new Date(a.shifts.end_time) - new Date(a.shifts.start_time)) / 3600000;
    });

    // Casual availability — query all entries for this day_of_week (any week) and take the
    // most recent per staff member so timezone drift in week_start_date never loses records.
    const shiftDow = (shiftDate.getUTCDay() + 6) % 7;
    const casualIds = filtered.filter(s => s.staff_type === "casual").map(s => s.staff_id);
    const casualAvailMap = {};
    if (casualIds.length > 0) {
      const avail = await prisma.casual_availability.findMany({
        where: { staff_id: { in: casualIds }, day_of_week: shiftDow },
        orderBy: { week_start_date: "desc" },
        select: { staff_id: true, available_from: true, available_to: true },
      });
      const seen = new Set();
      avail.forEach(a => {
        if (seen.has(a.staff_id)) return; // already have a more-recent entry
        seen.add(a.staff_id);
        casualAvailMap[a.staff_id] = {
          from: a.available_from ? new Date(a.available_from).toISOString().slice(11,16) : null,
          to:   a.available_to   ? new Date(a.available_to).toISOString().slice(11,16)   : null,
        };
      });
    }

    const roster = filtered.map(s => ({
      full_name:             s.users?.full_name || "Unknown",
      staff_type:            s.staff_type,
      skills:                skillMap[s.user_id] || [],
      hours_this_week:       Math.round((hoursMap[s.staff_id] || 0) * 10) / 10,
      is_on_leave:           onLeaveIds.has(s.staff_id),
      is_double_booked:      doubleBookedIds.has(s.staff_id),
      double_booked_shift:   doubleBookedShiftMap[s.staff_id] || null,
      casual_available_today: (() => {
        if (s.staff_type !== "casual") return null;
        const avail = casualAvailMap[s.staff_id];
        if (!avail) return false;
        const { from, to } = avail;
        if (!from && !to) return true;
        return !!from && !!to && from <= start_time && to >= end_time;
      })(),
      casual_avail_from: s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.from ?? null) : null,
      casual_avail_to:   s.staff_type === "casual" ? (casualAvailMap[s.staff_id]?.to ?? null)   : null,
    }));

    res.json({ success: true, roster });
  } catch (error) {
    console.error("[previewRoster] ERROR:", error.message, error.stack?.split("\n")[1]);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift, generateWeeklySchedule, confirmWeeklySchedule, rescheduleStaff, reviewWeeklySchedule, previewRoster };
