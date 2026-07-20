const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

function fmtTime(t) {
  if (!t) return null;
  if (typeof t === "string") return t.slice(0, 5);
  // Prisma Time fields come back as Date objects — use ISO string to get HH:MM in UTC
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

// ─── MANAGER CONTEXT ──────────────────────────────────────────────────────────

async function fetchManagerContext(userId) {
  const context = {};

  // User
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
  const weekFromNow = new Date(today);
  weekFromNow.setDate(today.getDate() + 7);
  const { monday, sunday } = getWeekBounds();

  // Branch info
  const branch = await prisma.branches.findUnique({
    where: { branch_id: branchId },
    select: { name: true, address: true },
  }).catch(() => null);
  context.branch = branch;

  // Upcoming shifts
  const shifts = await prisma.shifts.findMany({
    where: { branch_id: branchId, shift_date: { gte: today, lte: weekFromNow } },
    include: {
      shift_tasks: { include: { skills: { select: { name: true } } } },
      task_assignments: {
        include: { staff: { include: { users: { select: { full_name: true } } } } },
      },
    },
    orderBy: { shift_date: "asc" },
  }).catch(() => []);

  context.upcomingShifts = shifts.map((s) => ({
    shift_id: s.shift_id,
    title: s.title,
    date: s.shift_date,
    start: s.start_time,
    end: s.end_time,
    status: s.status,
    tasks: (s.shift_tasks || []).map((t) => ({ title: t.title, skill: t.skills?.name || null })),
    total_positions_needed: (s.shift_tasks || []).length,
    assigned_count: (s.task_assignments || []).length,
    is_understaffed: (s.task_assignments || []).length < (s.shift_tasks || []).length,
    assigned_staff: (s.task_assignments || []).map((a) => a.staff?.users?.full_name || "Unknown"),
  }));

  // Leave requests — all statuses so AI knows about pending, approved and rejected
  const allLeave = await prisma.availability.findMany({
    where: { staff: { branch_id: branchId } },
    include: { staff: { include: { users: { select: { full_name: true } } } } },
    orderBy: { start_date: "desc" },
    take: 30,
  }).catch(() => []);
  context.leaveRequests = allLeave.map((l) => ({
    staff_name: l.staff?.users?.full_name,
    leave_type: l.leave_type,
    status: l.status,
    start_date: l.start_date,
    end_date: l.end_date,
    reason: l.reason,
  }));

  // Pending swaps — scoped to this branch via the requester's assignment → shift
  const pendingSwaps = await prisma.swap_requests.findMany({
    where: {
      status: "pending",
      task_assignments_swap_requests_requester_assignTotask_assignments: {
        shifts: { branch_id: branchId },
      },
    },
  }).catch(() => []);
  context.pendingSwapRequests = pendingSwaps.length;

  // Regular staff — direct branch assignment
  const regularStaff = await prisma.staff.findMany({
    where: { branch_id: branchId, staff_type: "regular" },
    select: {
      staff_id: true, staff_type: true, exp_level: true, is_active: true,
      users: { select: { user_id: true, full_name: true, email: true } },
    },
  }).catch(() => []);

  // Casual staff — via casual_branch_preferences (same as staffController)
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
  console.log("[AI] regular:", regularStaff.length, "| casual:", casualStaff.length, "| staffIds:", staffIds);

  // Staff roster with skills
  const skillTags = userIds.length > 0
    ? await prisma.user_skill_tags.findMany({
        where: { user_id: { in: userIds } },
        include: { skills: { select: { name: true } } },
      }).catch(() => [])
    : [];

  const skillsByUser = {};
  skillTags.forEach((t) => {
    if (!skillsByUser[t.user_id]) skillsByUser[t.user_id] = [];
    if (t.skills?.name) skillsByUser[t.user_id].push(t.skills.name);
  });

  context.staffRoster = branchStaff.map((s) => ({
    name: s.users?.full_name || s.users?.email || "Unknown",
    type: s.staff_type,
    exp_level: s.exp_level || null,
    is_active: s.is_active,
    skills: skillsByUser[s.users?.user_id] || [],
  }));

  // Timesheets this week
  if (staffIds.length > 0) {
    const { data: timesheets, error: tsErr } = await supabaseAdmin
      .from("timesheets")
      .select("staff_id, log_date, hours_worked, status")
      .in("staff_id", staffIds)
      .gte("log_date", monday)
      .lte("log_date", sunday);

    console.log("[AI] week:", monday, "→", sunday, "| timesheets:", timesheets?.length ?? 0, "| error:", tsErr?.message);

    const staffMap = {};
    branchStaff.forEach((s) => { staffMap[s.staff_id] = s.users?.full_name || s.users?.email; });

    const hoursByStaff = {};
    (timesheets || []).forEach((t) => {
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
  } else {
    context.timesheetsThisWeek = "No staff found in this branch.";
  }

  // Casual availability
  if (staffIds.length > 0) {
    const casualAvail = await prisma.casual_availability.findMany({
      where: { staff_id: { in: staffIds } },
      orderBy: { week_start_date: "desc" },
    }).catch(() => []);

    const staffNameMap = {};
    branchStaff.forEach((s) => { staffNameMap[s.staff_id] = s.users?.full_name || "Unknown"; });
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const grouped = {};
    casualAvail.forEach((row) => {
      const week = row.week_start_date.toISOString().split("T")[0];
      const key  = `${row.staff_id}_${week}`;
      if (!grouped[key]) grouped[key] = { staff_name: staffNameMap[row.staff_id], week, days: [] };
      grouped[key].days.push({
        day: dayNames[row.day_of_week],
        from: fmtTime(row.available_from),
        to:   fmtTime(row.available_to),
      });
    });
    context.casualAvailabilitySubmissions = Object.values(grouped);
  }

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

  const branches = await prisma.branches.findMany({
    where: { business_id: biz.business_id },
    select: { branch_id: true, name: true, address: true },
  }).catch(() => []);

  const branchIds = branches.map((b) => b.branch_id);
  context.totalBranches = branches.length;

  if (branchIds.length === 0) return context;

  const [allStaff, upcomingShifts, pendingLeave] = await Promise.all([
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
    prisma.availability.findMany({
      where: { status: "pending", staff: { branch_id: { in: branchIds } } },
      include: {
        staff: {
          include: {
            users: { select: { full_name: true } },
            branches: { select: { name: true } },
          },
        },
      },
    }).catch(() => []),
  ]);

  // Fetch branch managers from Supabase
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

  // Full staff list with branch name
  context.allStaff = allStaff.map((s) => ({
    name: s.users?.full_name || s.users?.email || "Unknown",
    type: s.staff_type,
    exp_level: s.exp_level || null,
    branch: branchNameMap[s.branch_id] || s.branch_id,
  }));

  context.branchSummaries = branches.map((b) => {
    const bStaff    = allStaff.filter((s) => s.branch_id === b.branch_id);
    const bShifts   = upcomingShifts.filter((s) => s.branch_id === b.branch_id);
    const understaffed = bShifts.filter((s) => s.task_assignments.length < s.shift_tasks.length);
    const bManagers = (bmRows || []).filter((r) => r.branch_id === b.branch_id).map((r) => {
      const u = managerUsers.find((u) => u.user_id === r.user_id);
      return u?.full_name || u?.email || "Unknown";
    });
    return {
      name: b.name,
      address: b.address,
      managers: bManagers,
      staff_count: bStaff.length,
      upcoming_shifts: bShifts.length,
      understaffed_shifts: understaffed.length,
    };
  });

  context.upcomingShifts = upcomingShifts.map((s) => ({
    branch: s.branches?.name,
    title: s.title,
    date: s.shift_date,
    start: s.start_time,
    end: s.end_time,
    status: s.status,
    total_positions: s.shift_tasks.length,
    assigned_count: s.task_assignments.length,
    is_understaffed: s.task_assignments.length < s.shift_tasks.length,
  }));

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
    return `You are the Krewby AI Workforce Assistant — a read-only conversational tool for the Krewby F&B workforce management platform.

You are helping a manager: ${context.currentUser?.full_name || "user"}
Branch: "${context.branch?.name || "their branch"}" (${context.branch?.address || ""})

RULES:
1. READ-ONLY — you cannot create, edit, approve, reject, assign, or delete anything.
2. Only reference data from the context below. Do not make up numbers or names.
3. Keep answers concise. Use bullet points for lists.
4. If a field in the context is an empty array, say "none recorded" or "none found" — do NOT say "I don't have that data."
5. Only say "I don't have that data" if the field is completely absent from the context.

KEY FIELDS:
- staffRoster: all branch staff with type, experience, and skills
- timesheetsThisWeek: hours logged this week per staff member (approved vs pending)
- leaveRequests: all leave requests with status (pending/approved/rejected) — last 30
- upcomingShifts: next 7 days of shifts with assigned staff and task details
- casualAvailabilitySubmissions: weekly hours submitted by casual staff
- pendingSwapRequests: count of pending shift swap requests

CONTEXT (${date}):
${JSON.stringify(context, null, 2)}`;
  }

  if (role === "business_owner") {
    return `You are the Krewby AI Workforce Assistant — a read-only conversational tool for the Krewby F&B workforce management platform.

You are helping the business owner: ${context.currentUser?.full_name || "user"}
Business: "${context.business?.name || "their business"}" with ${context.totalBranches || 0} branch(es)

RULES:
1. READ-ONLY — you cannot create, edit, approve, reject, assign, or delete anything.
2. Only reference data from the context below. Do not make up numbers or names.
3. Keep answers concise. Use bullet points for lists.
4. If a field in the context is an empty array, say "none recorded" — do NOT say "I don't have that data."
5. Only say "I don't have that data" if the field is completely absent from the context.

CONTEXT (${date}):
${JSON.stringify(context, null, 2)}`;
  }

  return "";
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

async function buildMessages(userId, role, question, conversationHistory = []) {
  let context;
  if (role === "manager") {
    context = await fetchManagerContext(userId);
  } else if (role === "business_owner") {
    context = await fetchBOContext(userId);
  } else {
    throw new Error("Unsupported role");
  }

  const systemPrompt = buildSystemPrompt(role, context);

  return [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: question },
  ];
}

module.exports = { buildMessages };
