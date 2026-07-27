const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

function fmtTime(t) {
  if (!t) return null;
  if (typeof t === "string") return t.slice(0, 5);
  return new Date(t).toISOString().slice(11, 16);
}

function getWeekBounds() {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    monday: monday.toISOString().slice(0, 10),
    sunday: sunday.toISOString().slice(0, 10),
  };
}

function fourWeeksAgoDate() {
  const d = new Date();
  d.setDate(d.getDate() - 28);
  d.setHours(0, 0, 0, 0);
  return d;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── MANAGER CONTEXT ──────────────────────────────────────────────────────────

async function fetchManagerContext(userId) {
  const context = {};

  const user = await prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true, full_name: true, role: true },
  }).catch(() => null);
  context.currentUser = user;

  // Branch — try staff table first, fall back to branch_managers
  let branchId = null;
  const staffRecord = await prisma.staff.findFirst({
    where: { user_id: userId },
    select: { branch_id: true },
  }).catch(() => null);
  branchId = staffRecord?.branch_id ?? null;

  if (!branchId) {
    const { data: bm } = await supabaseAdmin
      .from("branch_managers")
      .select("branch_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    branchId = bm?.branch_id ?? null;
  }

  console.log("[AI] userId:", userId, "| branchId resolved:", branchId);
  context.branchId = branchId;

  if (!branchId) {
    context.note = "No branch found for this manager.";
    return context;
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const { monday, sunday } = getWeekBounds();
  const fourWeeksAgo = fourWeeksAgoDate();
  const fourWeeksAgoStr = fourWeeksAgo.toISOString().slice(0, 10);

  // ── Parallel fetch: branch info, upcoming shifts, leave requests, swaps, past shifts ──
  const [
    branch,
    shifts,
    allLeave,
    pendingSwaps,
    pastShifts,
    regularStaff,
  ] = await Promise.all([
    prisma.branches.findUnique({
      where: { branch_id: branchId },
      select: { name: true, address: true },
    }).catch(() => null),

    prisma.shifts.findMany({
      where: { branch_id: branchId, shift_date: { gte: today, lte: weekFromNow } },
      include: {
        shift_tasks: { include: { skills: { select: { name: true } } } },
        task_assignments: {
          include: { staff: { include: { users: { select: { full_name: true } } } } },
        },
      },
      orderBy: { shift_date: "asc" },
    }).catch(() => []),

    // Phase 1.1 — fetch all leave but we'll compress below
    prisma.availability.findMany({
      where: { staff: { branch_id: branchId } },
      include: { staff: { include: { users: { select: { full_name: true } } } } },
      orderBy: { start_date: "desc" },
      take: 60,
    }).catch(() => []),

    prisma.swap_requests.findMany({
      where: {
        status: "pending",
        task_assignments_swap_requests_requester_assignTotask_assignments: {
          shifts: { branch_id: branchId },
        },
      },
    }).catch(() => []),

    // Phase 1.3 — 4-week shift history
    prisma.shifts.findMany({
      where: { branch_id: branchId, shift_date: { gte: fourWeeksAgo, lt: today } },
      include: {
        shift_tasks: { include: { skills: { select: { name: true } } } },
        task_assignments: { select: { assignment_id: true, task_id: true, staff_id: true } },
      },
      orderBy: { shift_date: "asc" },
    }).catch(() => []),

    prisma.staff.findMany({
      where: { branch_id: branchId, staff_type: "regular" },
      select: {
        staff_id: true, staff_type: true, exp_level: true, is_active: true,
        users: { select: { user_id: true, full_name: true, email: true } },
      },
    }).catch(() => []),
  ]);

  context.branch = branch;
  context.pendingSwapRequests = pendingSwaps.length;

  // ── Upcoming shifts ──
  context.upcomingShifts = shifts.map((s) => ({
    shift_id: s.shift_id,
    title: s.title,
    date: s.shift_date,
    start: fmtTime(s.start_time),
    end: fmtTime(s.end_time),
    status: s.status,
    tasks: (s.shift_tasks || []).map((t) => ({ title: t.title, skill: t.skills?.name || null })),
    total_positions_needed: (s.shift_tasks || []).length,
    assigned_count: (s.task_assignments || []).length,
    is_understaffed: (s.task_assignments || []).length < (s.shift_tasks || []).length,
    assigned_staff: (s.task_assignments || []).map((a) => a.staff?.users?.full_name || "Unknown"),
  }));

  // Phase 1.5 — track who is assigned at least once this week
  const assignedThisWeek = new Set();
  shifts.forEach((s) => {
    s.task_assignments.forEach((a) => { if (a.staff_id) assignedThisWeek.add(a.staff_id); });
  });

  // ── Phase 1.1 — Compressed leave requests ──
  const pendingLeave = allLeave.filter((l) => l.status === "pending");
  const approvedCount = allLeave.filter((l) => l.status === "approved").length;
  const rejectedCount = allLeave.filter((l) => l.status === "rejected").length;

  context.leaveRequestSummary = {
    pending: pendingLeave.length,
    approved_last_60_days: approvedCount,
    rejected_last_60_days: rejectedCount,
  };
  context.pendingLeaveRequests = pendingLeave.map((l) => ({
    staff_name: l.staff?.users?.full_name,
    leave_type: l.leave_type,
    status: l.status,
    start_date: l.start_date,
    end_date: l.end_date,
    reason: l.reason,
  }));

  // ── Phase 1.3 — 4-week shift history by day of week ──
  const byDay = {};
  DAY_NAMES.forEach((d) => { byDay[d] = { shifts: 0, total_positions: 0, filled_positions: 0 }; });

  // Phase 1.4 — skills gap from past shifts
  const skillGapMap = {};

  pastShifts.forEach((s) => {
    const dayName = DAY_NAMES[new Date(s.shift_date).getDay()];
    byDay[dayName].shifts += 1;
    byDay[dayName].total_positions += s.shift_tasks.length;
    byDay[dayName].filled_positions += s.task_assignments.length;

    // Phase 1.4 — track which tasks were unfilled and what skill they needed
    const filledTaskIds = new Set(s.task_assignments.map((a) => a.task_id));
    s.shift_tasks.forEach((task) => {
      if (!filledTaskIds.has(task.task_id)) {
        const skillName = task.skills?.name || "Unspecified";
        skillGapMap[skillName] = (skillGapMap[skillName] || 0) + 1;
      }
    });
  });

  context.shiftHistoryByDay = DAY_NAMES
    .filter((d) => byDay[d].shifts > 0)
    .map((d) => {
      const { shifts: count, total_positions, filled_positions } = byDay[d];
      const fillPct = total_positions > 0
        ? Math.round((filled_positions / total_positions) * 100)
        : 100;
      return {
        day: d,
        avg_shifts_per_week: (count / 4).toFixed(1),
        fill_rate: `${fillPct}%`,
        typically_understaffed: fillPct < 80,
      };
    });

  // Phase 1.4 — skills gap summary (top unfilled, sorted)
  const skillsGapEntries = Object.entries(skillGapMap)
    .sort((a, b) => b[1] - a[1]);
  context.skillsGap = skillsGapEntries.length > 0
    ? skillsGapEntries.map(([skill, times]) => ({ skill, unfilled_slots_last_4wk: times }))
    : "No unfilled slots in the past 4 weeks — full coverage achieved.";

  // ── Casual staff ──
  const { data: prefs } = await supabaseAdmin
    .from("casual_branch_preferences")
    .select("user_id")
    .eq("branch_id", branchId);
  const preferredUserIds = (prefs || []).map((p) => p.user_id);

  const casualStaff = preferredUserIds.length > 0
    ? await prisma.staff.findMany({
        where: { user_id: { in: preferredUserIds }, staff_type: "casual" },
        select: {
          staff_id: true, staff_type: true, exp_level: true, is_active: true,
          users: { select: { user_id: true, full_name: true, email: true } },
        },
      }).catch(() => [])
    : [];

  const branchStaff = [...regularStaff, ...casualStaff];
  const staffIds = branchStaff.map((s) => s.staff_id);
  const userIds  = branchStaff.map((s) => s.users?.user_id).filter(Boolean);
  console.log("[AI] regular:", regularStaff.length, "| casual:", casualStaff.length, "| staffIds:", staffIds.length);

  if (staffIds.length === 0) {
    context.staffRoster = [];
    context.timesheetsThisWeek = "No staff found in this branch.";
    context.casualAvailabilitySubmissions = [];
    return context;
  }

  // ── Parallel fetch: skills, timesheets (this week + 4 weeks), past assignments, casual avail ──
  const [skillTags, weekTimesheets, fourWkTimesheets, casualAvail] = await Promise.all([
    prisma.user_skill_tags.findMany({
      where: { user_id: { in: userIds } },
      include: { skills: { select: { name: true } } },
    }).catch(() => []),

    supabaseAdmin
      .from("timesheets")
      .select("staff_id, log_date, hours_worked, status")
      .in("staff_id", staffIds)
      .gte("log_date", monday)
      .lte("log_date", sunday)
      .then((r) => r.data || [])
      .catch(() => []),

    // Phase 1.2 — 4-week timesheets for attendance rate
    supabaseAdmin
      .from("timesheets")
      .select("staff_id, log_date, status")
      .in("staff_id", staffIds)
      .gte("log_date", fourWeeksAgoStr)
      .lt("log_date", todayStr)
      .then((r) => r.data || [])
      .catch(() => []),

    prisma.casual_availability.findMany({
      where: { staff_id: { in: staffIds } },
      orderBy: { week_start_date: "desc" },
    }).catch(() => []),
  ]);

  // Skills by user
  const skillsByUser = {};
  skillTags.forEach((t) => {
    if (!skillsByUser[t.user_id]) skillsByUser[t.user_id] = [];
    if (t.skills?.name) skillsByUser[t.user_id].push(t.skills.name);
  });

  // This-week timesheets
  const staffMap = {};
  branchStaff.forEach((s) => { staffMap[s.staff_id] = s.users?.full_name || s.users?.email; });

  const hoursByStaff = {};
  weekTimesheets.forEach((t) => {
    if (!hoursByStaff[t.staff_id]) {
      hoursByStaff[t.staff_id] = { name: staffMap[t.staff_id], approved_hours: 0, pending_hours: 0 };
    }
    const hrs = Number(t.hours_worked) || 0;
    if (t.status === "approved") hoursByStaff[t.staff_id].approved_hours += hrs;
    else if (t.status === "pending") hoursByStaff[t.staff_id].pending_hours += hrs;
  });
  const timesheetRows = Object.values(hoursByStaff);
  context.timesheetsThisWeek = timesheetRows.length > 0
    ? timesheetRows
    : "No timesheet entries have been submitted for the current week yet.";

  // Phase 1.2 — Attendance rate from 4-week timesheets vs past assignments
  // "scheduled days" = distinct shift_dates where staff had a task assignment in past 4 weeks
  const scheduledDays = {}; // staff_id → Set<dateStr>
  pastShifts.forEach((s) => {
    const dateStr = new Date(s.shift_date).toISOString().slice(0, 10);
    s.task_assignments.forEach((a) => {
      if (!a.staff_id) return;
      if (!scheduledDays[a.staff_id]) scheduledDays[a.staff_id] = new Set();
      scheduledDays[a.staff_id].add(dateStr);
    });
  });

  // "present days" = distinct log_dates with approved status in past 4 weeks
  const presentDays = {}; // staff_id → Set<dateStr>
  fourWkTimesheets.forEach((t) => {
    if (t.status !== "approved") return;
    if (!presentDays[t.staff_id]) presentDays[t.staff_id] = new Set();
    presentDays[t.staff_id].add(t.log_date);
  });

  // Build roster with all Phase 1 enrichments
  context.staffRoster = branchStaff.map((s) => {
    const sid = s.staff_id;
    const uid = s.users?.user_id;
    const scheduled = scheduledDays[sid]?.size ?? 0;
    const present = presentDays[sid]?.size ?? 0;
    const attendanceRate = scheduled > 0
      ? `${Math.round((Math.min(present, scheduled) / scheduled) * 100)}%`
      : "no data";

    return {
      name: s.users?.full_name || s.users?.email || "Unknown",
      type: s.staff_type,
      exp_level: s.exp_level || null,
      is_active: s.is_active,
      skills: skillsByUser[uid] || [],
      assigned_this_week: assignedThisWeek.has(sid),
      scheduled_days_last_4wk: scheduled,
      attendance_rate_4wk: attendanceRate,
    };
  });

  // Highlight staff not yet assigned this week
  const unassignedThisWeek = context.staffRoster.filter((s) => !s.assigned_this_week).map((s) => s.name);
  context.staffNotAssignedThisWeek = unassignedThisWeek.length > 0
    ? unassignedThisWeek
    : "All staff have been assigned at least one shift this week.";

  // Casual availability grouped by staff + week
  const staffNameMap = {};
  branchStaff.forEach((s) => { staffNameMap[s.staff_id] = s.users?.full_name || "Unknown"; });
  const grouped = {};
  casualAvail.forEach((row) => {
    const week = row.week_start_date.toISOString().split("T")[0];
    const key  = `${row.staff_id}_${week}`;
    if (!grouped[key]) grouped[key] = { staff_name: staffNameMap[row.staff_id], week, days: [] };
    grouped[key].days.push({
      day: DAY_NAMES[row.day_of_week],
      from: fmtTime(row.available_from),
      to:   fmtTime(row.available_to),
    });
  });
  context.casualAvailabilitySubmissions = Object.values(grouped);

  return context;
}

// ─── BUSINESS OWNER CONTEXT ───────────────────────────────────────────────────

async function fetchBOContext(userId) {
  const context = {};

  const user = await prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true, full_name: true, role: true },
  }).catch(() => null);
  context.currentUser = user;

  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("business_id, name")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!biz) return context;
  context.business = { name: biz.name };

  const today = new Date();
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const fourWeeksAgo = fourWeeksAgoDate();

  const branches = await prisma.branches.findMany({
    where: { business_id: biz.business_id },
    select: { branch_id: true, name: true, address: true },
  }).catch(() => []);

  const branchIds = branches.map((b) => b.branch_id);
  context.totalBranches = branches.length;

  if (branchIds.length === 0) return context;

  const [allStaff, upcomingShifts, allLeave, pastShifts] = await Promise.all([
    prisma.staff.findMany({
      where: { branch_id: { in: branchIds } },
      select: { staff_id: true, staff_type: true, branch_id: true, exp_level: true, users: { select: { full_name: true, email: true } } },
    }).catch(() => []),

    prisma.shifts.findMany({
      where: { branch_id: { in: branchIds }, shift_date: { gte: today, lte: weekFromNow } },
      include: {
        shift_tasks: { select: { task_id: true } },
        task_assignments: { select: { assignment_id: true } },
        branches: { select: { name: true } },
      },
      orderBy: { shift_date: "asc" },
    }).catch(() => []),

    // Phase 1.1 — all leave, compressed below
    prisma.availability.findMany({
      where: { staff: { branch_id: { in: branchIds } } },
      include: {
        staff: {
          include: {
            users: { select: { full_name: true } },
            branches: { select: { name: true } },
          },
        },
      },
      orderBy: { start_date: "desc" },
      take: 60,
    }).catch(() => []),

    // Phase 1.3 — 4-week history for BO-level fill rate per branch
    prisma.shifts.findMany({
      where: { branch_id: { in: branchIds }, shift_date: { gte: fourWeeksAgo, lt: today } },
      include: {
        shift_tasks: { select: { task_id: true } },
        task_assignments: { select: { assignment_id: true } },
      },
    }).catch(() => []),
  ]);

  // Branch managers
  const { data: bmRows } = await supabaseAdmin
    .from("branch_managers")
    .select("branch_id, user_id")
    .in("branch_id", branchIds);
  const managerUserIds = (bmRows || []).map((r) => r.user_id);
  const managerUsers = managerUserIds.length > 0
    ? await prisma.users.findMany({
        where: { user_id: { in: managerUserIds } },
        select: { user_id: true, full_name: true, email: true },
      }).catch(() => [])
    : [];
  const branchNameMap = {};
  branches.forEach((b) => { branchNameMap[b.branch_id] = b.name; });
  context.branchManagers = (bmRows || []).map((r) => {
    const u = managerUsers.find((u) => u.user_id === r.user_id);
    return { name: u?.full_name || u?.email || "Unknown", branch: branchNameMap[r.branch_id] || r.branch_id };
  });

  context.totalStaff = allStaff.length;
  context.staffByType = {
    regular: allStaff.filter((s) => s.staff_type === "regular").length,
    casual:  allStaff.filter((s) => s.staff_type === "casual").length,
  };
  context.allStaff = allStaff.map((s) => ({
    name: s.users?.full_name || s.users?.email || "Unknown",
    type: s.staff_type,
    exp_level: s.exp_level || null,
    branch: branchNameMap[s.branch_id] || s.branch_id,
  }));

  // Phase 1.3 — 4-week fill rate per branch
  const pastByBranch = {};
  pastShifts.forEach((s) => {
    if (!pastByBranch[s.branch_id]) pastByBranch[s.branch_id] = { total: 0, filled: 0 };
    pastByBranch[s.branch_id].total += s.shift_tasks.length;
    pastByBranch[s.branch_id].filled += s.task_assignments.length;
  });

  context.branchSummaries = branches.map((b) => {
    const bStaff       = allStaff.filter((s) => s.branch_id === b.branch_id);
    const bShifts      = upcomingShifts.filter((s) => s.branch_id === b.branch_id);
    const understaffed = bShifts.filter((s) => s.task_assignments.length < s.shift_tasks.length);
    const bManagers    = (bmRows || []).filter((r) => r.branch_id === b.branch_id).map((r) => {
      const u = managerUsers.find((u) => u.user_id === r.user_id);
      return u?.full_name || u?.email || "Unknown";
    });
    const hist = pastByBranch[b.branch_id];
    const fillRate4wk = hist && hist.total > 0
      ? `${Math.round((hist.filled / hist.total) * 100)}%`
      : "no data";

    return {
      name: b.name,
      address: b.address,
      managers: bManagers,
      staff_count: bStaff.length,
      upcoming_shifts: bShifts.length,
      understaffed_shifts: understaffed.length,
      fill_rate_last_4wk: fillRate4wk,
    };
  });

  context.upcomingShifts = upcomingShifts.map((s) => ({
    branch: s.branches?.name,
    title: s.title,
    date: s.shift_date,
    start: fmtTime(s.start_time),
    end: fmtTime(s.end_time),
    status: s.status,
    total_positions: s.shift_tasks.length,
    assigned_count: s.task_assignments.length,
    is_understaffed: s.task_assignments.length < s.shift_tasks.length,
  }));

  // Phase 1.1 — compressed leave for BO
  const pendingLeave = allLeave.filter((l) => l.status === "pending");
  const approvedCount = allLeave.filter((l) => l.status === "approved").length;
  const rejectedCount = allLeave.filter((l) => l.status === "rejected").length;

  context.leaveRequestSummary = {
    pending: pendingLeave.length,
    approved_last_60_days: approvedCount,
    rejected_last_60_days: rejectedCount,
  };
  context.pendingLeaveRequests = pendingLeave.map((l) => ({
    staff_name: l.staff?.users?.full_name,
    branch: l.staff?.branches?.name,
    leave_type: l.leave_type,
    start_date: l.start_date,
    end_date: l.end_date,
    reason: l.reason,
  }));

  return context;
}

// ─── SYSTEM PROMPTS ───────────────────────────────────────────────────────────

function buildSystemPrompt(role, context) {
  const date = new Date().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" });

  if (role === "manager") {
    return `You are the Krewby AI Workforce Assistant — a conversational tool for the Krewby workforce management platform.

You are helping manager: ${context.currentUser?.full_name || "user"}
Branch: "${context.branch?.name || "their branch"}" (${context.branch?.address || ""})
Today: ${date}

RULES:
1. READ-ONLY — you cannot create, edit, approve, reject, assign, or delete anything.
2. Only reference data from the context below. Do not make up numbers, names, or dates.
3. Be concise. Use bullet points for lists. Bold important names and numbers.
4. If a context field is an empty array, say "none recorded" — do NOT say "I don't have that data."
5. Only say "I don't have that information" if the field is genuinely absent from the context.
6. When asked for a recommendation (e.g. who to assign), give a clear answer with brief reasoning from the data.

KEY CONTEXT FIELDS:
- upcomingShifts: next 7 days — includes tasks, required skills, assigned staff, understaffing flag
- pendingLeaveRequests: leave requests awaiting approval (full detail)
- leaveRequestSummary: counts of pending / approved / rejected leave in last 60 days
- staffRoster: all branch staff — includes skills, attendance_rate_4wk, assigned_this_week flag
- staffNotAssignedThisWeek: names of staff with no shift assignment yet this week
- timesheetsThisWeek: approved and pending hours logged this week per staff member
- shiftHistoryByDay: 4-week trend — which days are busiest and which have low fill rates
- skillsGap: which skill types had the most unfilled slots in the past 4 weeks
- casualAvailabilitySubmissions: availability windows submitted by casual staff
- pendingSwapRequests: count of pending shift swap requests

CONTEXT (${date}):
${JSON.stringify(context, null, 2)}`;
  }

  if (role === "business_owner") {
    return `You are the Krewby AI Workforce Assistant — a conversational tool for the Krewby workforce management platform.

You are helping business owner: ${context.currentUser?.full_name || "user"}
Business: "${context.business?.name || "their business"}" — ${context.totalBranches || 0} branch(es)
Today: ${date}

RULES:
1. READ-ONLY — you cannot create, edit, approve, reject, assign, or delete anything.
2. Only reference data from the context below. Do not make up numbers, names, or dates.
3. Be concise. Use bullet points for lists. Bold important names and numbers.
4. If a context field is an empty array, say "none recorded" — do NOT say "I don't have that data."
5. Only say "I don't have that information" if the field is genuinely absent from the context.
6. When asked for a recommendation, give a clear answer with brief reasoning from the data.

KEY CONTEXT FIELDS:
- branchSummaries: per-branch — staff count, upcoming shifts, understaffed shifts, fill_rate_last_4wk
- upcomingShifts: next 7 days across all branches — includes understaffing flag
- pendingLeaveRequests: all pending leave across all branches (full detail)
- leaveRequestSummary: counts of pending / approved / rejected leave in last 60 days
- allStaff: full staff list with branch, type, and experience level
- branchManagers: who manages each branch
- staffByType: total regular vs casual staff count

CONTEXT (${date}):
${JSON.stringify(context, null, 2)}`;
  }

  return "";
}

// ─── PHASE 2: QUESTION CLASSIFIER ─────────────────────────────────────────────

function classifyQuestion(question) {
  const q = question.toLowerCase();
  const cats = new Set();

  if (/shift|roster|schedule|working|who.s in|tonight|tomorrow|this week|next week|understaffed|position|task|assigned|cover/i.test(q))
    cats.add("shifts");

  if (/leave|time.?off|absent|approve|reject|request|sick|annual|pending leave/i.test(q))
    cats.add("leave");

  if (/staff|worker|employee|team|skill|casual|regular|experience|active|inactive|attendance|rate|not assigned|unassigned|who has/i.test(q))
    cats.add("staff");

  if (/timesheet|hours|clock|log|worked|approved hour/i.test(q))
    cats.add("timesheets");

  if (/availab|free|when can|who can work/i.test(q))
    cats.add("availability");

  if (/gap|unfilled|missing skill|coverage|skill/i.test(q))
    cats.add("skills_gap");

  // Broad / summary questions → full context
  if (cats.size === 0 || /summar|overview|brief|report|everything|all|what.s happening|how.s the branch|how are we doing/i.test(q))
    cats.add("all");

  return cats;
}

// ─── PHASE 2: CONTEXT SLICES ───────────────────────────────────────────────────

function selectManagerContext(full, cats) {
  const isAll = cats.has("all");
  const ctx = {
    currentUser: full.currentUser,
    branch: full.branch,
    pendingSwapRequests: full.pendingSwapRequests,
  };

  if (isAll || cats.has("shifts")) {
    ctx.upcomingShifts = full.upcomingShifts;
    ctx.shiftHistoryByDay = full.shiftHistoryByDay;
  }

  if (isAll || cats.has("leave")) {
    ctx.pendingLeaveRequests = full.pendingLeaveRequests;
    ctx.leaveRequestSummary = full.leaveRequestSummary;
  }

  // Staff info is needed for both "staff" and "shifts" questions (assignments need names)
  if (isAll || cats.has("staff") || cats.has("shifts")) {
    ctx.staffRoster = full.staffRoster;
    ctx.staffNotAssignedThisWeek = full.staffNotAssignedThisWeek;
  }

  if (isAll || cats.has("timesheets")) {
    ctx.timesheetsThisWeek = full.timesheetsThisWeek;
  }

  if (isAll || cats.has("availability")) {
    ctx.casualAvailabilitySubmissions = full.casualAvailabilitySubmissions;
  }

  if (isAll || cats.has("skills_gap") || cats.has("staff")) {
    ctx.skillsGap = full.skillsGap;
  }

  return ctx;
}

function selectBOContext(full, cats) {
  const isAll = cats.has("all");
  const ctx = {
    currentUser: full.currentUser,
    business: full.business,
    totalBranches: full.totalBranches,
    totalStaff: full.totalStaff,
    staffByType: full.staffByType,
    branchManagers: full.branchManagers,
    // Always include branch summaries — it's lightweight and nearly always relevant
    branchSummaries: full.branchSummaries,
  };

  if (isAll || cats.has("shifts")) {
    ctx.upcomingShifts = full.upcomingShifts;
  }

  if (isAll || cats.has("leave")) {
    ctx.pendingLeaveRequests = full.pendingLeaveRequests;
    ctx.leaveRequestSummary = full.leaveRequestSummary;
  }

  if (isAll || cats.has("staff")) {
    ctx.allStaff = full.allStaff;
  }

  return ctx;
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

async function buildMessages(userId, role, question, conversationHistory = []) {
  let fullContext;
  if (role === "manager") {
    fullContext = await fetchManagerContext(userId);
  } else if (role === "business_owner") {
    fullContext = await fetchBOContext(userId);
  } else {
    throw new Error("Unsupported role");
  }

  const categories = classifyQuestion(question);
  console.log("[AI] question categories:", [...categories]);

  const context = role === "manager"
    ? selectManagerContext(fullContext, categories)
    : selectBOContext(fullContext, categories);

  const systemPrompt = buildSystemPrompt(role, context);

  return [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-12).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: question },
  ];
}

module.exports = { buildMessages };
