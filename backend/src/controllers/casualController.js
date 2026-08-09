const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const generateToken = require("../utils/generateToken");
const { notifyUser, notifyUsers, getBranchManagerUserIds } = require("../utils/notify");
const { checkLaborRules } = require("./taskController");
const {
  toMinutesFromTimeValue,
  doTimeRangesOverlap,
  getUTCDayOfWeekMondayFirst,
  getUTCMondayWeekStart,
  computeWeightedScore,
} = require("../utils/scheduling");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}-${rand(4)}`;
}

async function resolveManagerBranch(userId) {
  const { data: link } = await supabaseAdmin
    .from("branch_managers")
    .select("branch_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!link) return null;
  const branch = await prisma.branches.findUnique({
    where: { branch_id: link.branch_id },
    select: { branch_id: true, business_id: true, name: true },
  });
  return branch || null;
}

async function resolveOwnerBusiness(userId) {
  const { data: biz } = await supabaseAdmin
    .from("businesses")
    .select("business_id, name, join_code")
    .eq("owner_id", userId)
    .maybeSingle();
  return biz || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// REGISTRATION
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

async function registerCasualWorker(req, res) {
  try {
    const { full_name, username: rawUsername, email, password, join_code, bio } = req.body;

    if (!full_name || !rawUsername || !email || !password || !join_code) {
      return res.status(400).json({ success: false, message: "All fields and a valid join code are required." });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    const username = rawUsername.trim().toLowerCase();

    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("business_id, name")
      .eq("join_code", join_code.trim().toUpperCase())
      .maybeSingle();

    if (!biz) {
      return res.status(404).json({ success: false, message: "Invalid join code. Please check with your employer." });
    }

    const existingEmail = await prisma.users.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "An account with this email already exists." });
    }

    const existingUsername = await prisma.users.findFirst({ where: { username } });
    if (existingUsername) {
      return res.status(409).json({ success: false, message: "This username is already taken." });
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (authErr) return res.status(400).json({ success: false, message: authErr.message });

    const newUser = await prisma.users.create({
      data: { full_name, username, email, role: "casual_staff", is_active: true },
    });

    const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert({
      user_id: newUser.user_id,
      business_id: biz.business_id,
      status: "pending",
      bio: bio || null,
    });
    if (cwErr) throw new Error(cwErr.message);

    // Give them a staff_id (no branch — pool-based) so scheduling/availability/skills all work
    // once approved. Stays inactive until a business owner approves them.
    await prisma.staff.create({
      data: { user_id: newUser.user_id, branch_id: null, staff_type: "casual", is_active: false },
    });

    const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: `Application submitted! ${biz.name} will review and approve your account.`,
      token,
      user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
      approval_status: "pending",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — status + branch preferences
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/me
async function getCasualWorkerStatus(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("id, business_id, status, bio, joined_at, approved_at")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    let businessName = null;
    if (cw.business_id) {
      const { data: biz } = await supabaseAdmin.from("businesses").select("name").eq("business_id", cw.business_id).maybeSingle();
      businessName = biz?.name || null;
    }

    return res.json({ success: true, casual_worker: { ...cw, business_name: businessName } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/my-branches — list all branches in the worker's business
async function getMyBranches(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { data: branches } = await supabaseAdmin
      .from("branches")
      .select("branch_id, name, address")
      .eq("business_id", cw.business_id)
      .is("deleted_at", null)
      .order("name");

    return res.json({ success: true, branches: branches || [], approval_status: cw.status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/preferences — get preferred branch IDs
async function getPreferences(req, res) {
  try {
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("branch_id")
      .eq("user_id", req.user.user_id);

    return res.json({ success: true, preferred_branch_ids: (prefs || []).map(p => p.branch_id) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/casual/preferences — replace preferred branches { branch_ids: [1,2,3] }
async function setPreferences(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { branch_ids } = req.body;
    if (!Array.isArray(branch_ids)) {
      return res.status(400).json({ success: false, message: "branch_ids must be an array." });
    }

    // Delete existing, then insert new ones
    await supabaseAdmin.from("casual_branch_preferences").delete().eq("user_id", req.user.user_id);

    if (branch_ids.length > 0) {
      const rows = branch_ids.map(id => ({ user_id: req.user.user_id, branch_id: id }));
      const { error } = await supabaseAdmin.from("casual_branch_preferences").insert(rows);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: "Branch preferences saved.", preferred_branch_ids: branch_ids });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CASUAL WORKER — weekly availability
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/availability
async function getMyAvailability(req, res) {
  try {
    const { data: rows } = await supabaseAdmin
      .from("casual_weekly_availability")
      .select("id, day_of_week, available_from, available_to")
      .eq("user_id", req.user.user_id)
      .order("day_of_week");
    return res.json({ success: true, availability: rows || [] });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/casual/availability  body: { availability: [{day_of_week, available_from, available_to}] }
async function setMyAvailability(req, res) {
  try {
    const { availability } = req.body;
    if (!Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: "availability must be an array." });
    }
    // Replace all existing rows
    await supabaseAdmin.from("casual_weekly_availability").delete().eq("user_id", req.user.user_id);
    if (availability.length > 0) {
      const rows = availability.map(a => ({
        user_id: req.user.user_id,
        day_of_week: a.day_of_week,
        available_from: a.available_from,
        available_to: a.available_to,
      }));
      const { error } = await supabaseAdmin.from("casual_weekly_availability").insert(rows);
      if (error) throw new Error(error.message);
    }
    return res.json({ success: true, message: "Availability saved." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/availability/submit  body: { week_start_date, availability: [{day_of_week, available_from, available_to}] }
async function submitWeeklyAvailability(req, res) {
  try {
    const { week_start_date, availability } = req.body;
    if (!week_start_date || !Array.isArray(availability)) {
      return res.status(400).json({ success: false, message: "week_start_date and availability array required." });
    }

    const userId = req.user.user_id;

    // Get staff record for this user
    const { data: staffRecord } = await supabaseAdmin
      .from("staff")
      .select("staff_id, branch_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!staffRecord) return res.status(404).json({ success: false, message: "Staff record not found." });

    // Replace this week's rows in casual_availability
    await supabaseAdmin.from("casual_availability")
      .delete()
      .eq("staff_id", staffRecord.staff_id)
      .eq("week_start_date", week_start_date);

    if (availability.length > 0) {
      const rows = availability.map(a => ({
        staff_id:       staffRecord.staff_id,
        week_start_date,
        day_of_week:    a.day_of_week,
        available_from: a.available_from,
        available_to:   a.available_to,
      }));
      const { error } = await supabaseAdmin.from("casual_availability").insert(rows);
      if (error) throw new Error(error.message);
    }

    // Also sync to casual_weekly_availability so the dashboard count stays accurate
    await supabaseAdmin.from("casual_weekly_availability").delete().eq("user_id", userId);
    if (availability.length > 0) {
      const weeklyRows = availability.map(a => ({
        user_id:        userId,
        day_of_week:    a.day_of_week,
        available_from: a.available_from,
        available_to:   a.available_to,
      }));
      await supabaseAdmin.from("casual_weekly_availability").insert(weeklyRows);
    }

    // Notify manager(s)
    const user = await prisma.users.findUnique({ where: { user_id: userId }, select: { full_name: true } });
    if (staffRecord.branch_id) {
      const managerIds = await getBranchManagerUserIds(staffRecord.branch_id);
      const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const summary = availability.length > 0
        ? availability.map(a => `${DN[a.day_of_week]} ${a.available_from?.slice(0,5)}–${a.available_to?.slice(0,5)}`).join(", ")
        : "No availability set";
      await notifyUsers(managerIds, {
        type:           "casual_availability",
        title:          `${user?.full_name || "Casual worker"} submitted availability`,
        message:        `Week of ${week_start_date}: ${summary}`,
        relatedEntity:  "casual_availability",
        relatedId:      staffRecord.staff_id,
      });
    }

    return res.json({ success: true, message: "Availability submitted." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — casual pool for their branch
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/manager/pool — workers who prefer this branch
async function getManagerPool(req, res) {
  try {
    const branch = await resolveManagerBranch(req.user.user_id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found for this manager." });

    // Get all users who have this branch as a preference and are approved
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branch.branch_id);

    const userIds = (prefs || []).map(p => p.user_id);
    if (userIds.length === 0) return res.json({ success: true, workers: [] });

    // Filter to approved workers only
    const { data: approved } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, approved_at")
      .eq("business_id", branch.business_id)
      .eq("status", "approved")
      .in("user_id", userIds);

    const enriched = await Promise.all((approved || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true, avatar_url: true },
      });
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", w.user_id);

      // How many other branches they prefer
      const { count: branchCount } = await supabaseAdmin
        .from("casual_branch_preferences")
        .select("*", { count: "exact", head: true })
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        avatar_url: user?.avatar_url || "/avatars/default.png",
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        branch_count: branchCount || 1,
      };
    }));

    return res.json({ success: true, workers: enriched });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUSINESS OWNER — pool management
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/pool
async function getPool(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { status } = req.query;

    let query = supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, joined_at, approved_at")
      .eq("business_id", biz.business_id)
      .order("joined_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data: workers } = await query;

    const enriched = await Promise.all((workers || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true },
      });
      const { data: skills } = await supabaseAdmin
        .from("user_skill_tags")
        .select("skills(name)")
        .eq("user_id", w.user_id);

      // Which branches they prefer
      const { data: prefs } = await supabaseAdmin
        .from("casual_branch_preferences")
        .select("branches(branch_id, name)")
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        preferred_branches: (prefs || []).map(p => p.branches).filter(Boolean),
      };
    }));

    return res.json({ success: true, workers: enriched, join_code: biz.join_code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/pool/:id/approve
async function approveWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "approved", approved_by: req.user.user_id, approved_at: new Date().toISOString() })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id);

    if (error) throw new Error(error.message);

    const { data: cw } = await supabaseAdmin.from("casual_workers").select("user_id").eq("id", Number(req.params.id)).maybeSingle();
    if (cw?.user_id) {
      await prisma.staff.updateMany({ where: { user_id: cw.user_id, staff_type: "casual" }, data: { is_active: true } });
      await notifyUser({
        recipientId: cw.user_id,
        type: "casual_approved",
        title: "Your application was approved!",
        message: `You've been approved as a casual worker for ${biz.name}. You can now set your preferred branches.`,
        relatedEntity: "casual_worker",
        relatedId: Number(req.params.id),
      });
    }

    return res.json({ success: true, message: "Worker approved." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/pool/:id/reject
async function rejectWorker(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { data: cw, error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "rejected" })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id)
      .select("user_id")
      .maybeSingle();

    if (error) throw new Error(error.message);

    if (cw?.user_id) {
      await notifyUser({
        recipientId: cw.user_id,
        type: "casual_rejected",
        title: "Application Update",
        message: `Your application to join ${biz.name} as a casual worker was not approved.`,
        relatedEntity: "casual_worker",
        relatedId: req.params.id,
      });
    }

    return res.json({ success: true, message: "Worker rejected." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/join-code
async function getJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    if (!biz.join_code) {
      const code = generateJoinCode();
      await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
      return res.json({ success: true, join_code: code });
    }

    return res.json({ success: true, join_code: biz.join_code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — auto-assign casual to a shift role
// ─────────────────────────────────────────────────────────────────────────────

// POST /api/casual/manager/auto-assign  body: { shift_id, task_id }
async function autoAssignCasual(req, res) {
  try {
    const { shift_id, task_id } = req.body;
    if (!shift_id || !task_id) {
      return res.status(400).json({ success: false, message: "shift_id and task_id are required." });
    }

    const branch = await resolveManagerBranch(req.user.user_id);
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    // Get shift details
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: Number(shift_id) },
      select: { shift_id: true, branch_id: true, shift_date: true, start_time: true, end_time: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });
    if (shift.branch_id !== branch.branch_id) return res.status(403).json({ success: false, message: "Access denied." });

    // One task = one person: reject if already assigned
    const existingAssignment = await prisma.task_assignments.findFirst({ where: { task_id: Number(task_id) } });
    const task = await prisma.shift_tasks.findUnique({ where: { task_id: Number(task_id) }, select: { title: true, start_time: true, end_time: true, skill_id: true } });
    if (existingAssignment) {
      return res.status(400).json({ success: false, message: "This task is already assigned." });
    }

    // shift_date day of week: Mon=0 … Sun=6. Prisma returns `@db.Date` columns as UTC-midnight
    // ISO strings, and shiftWeekStart below is computed in UTC — mixing that with a local-time
    // getDay() here would silently shift the computed day by one near a UTC/local timezone
    // boundary (e.g. late evening in a negative-UTC-offset server timezone), which then makes
    // casual_availability's exact (day_of_week, week_start_date) match miss every candidate.
    // getUTCDayOfWeekMondayFirst/getUTCMondayWeekStart (utils/scheduling.js) keep this UTC
    // consistently, and are unit tested directly (tests/scheduling.test.js).
    const shiftDate = new Date(shift.shift_date);
    const dayOfWeek = getUTCDayOfWeekMondayFirst(shiftDate);

    // Use the task's own time window (falls back to the shift's overall span if unset)
    const toMins = toMinutesFromTimeValue;
    const shiftStart = toMins(task?.start_time || shift.start_time);
    const shiftEnd   = toMins(task?.end_time || shift.end_time);
    const shiftDateStr = shiftDate.toISOString().slice(0, 10);

    // Casual workers from this business who've listed this branch as a preferred branch
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branch.branch_id);
    const preferredUserIds = new Set((prefs || []).map(p => p.user_id));

    const { data: approvedWorkers } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status")
      .eq("business_id", branch.business_id)
      .eq("status", "approved")
      .in("user_id", preferredUserIds.size > 0 ? [...preferredUserIds] : [-1]);

    if (!approvedWorkers || approvedWorkers.length === 0) {
      return res.json({ success: false, flagged: true, reason: "No approved casual workers prefer this branch yet." });
    }

    // week_start_date for the shift's week (Mon-aligned), to match casual_availability's granularity
    const shiftWeekStart = getUTCMondayWeekStart(shiftDate);

    // Configurable allocation weights (business owner sets these in Settings; same table
    // shiftController.js reads for the AI weekly scheduler). Weights are on a 0-100 scale and
    // sum to 100 by convention, so the composite candidate scores below land in a readable
    // 0-100 range.
    const { data: branchAlloc } = await supabaseAdmin
      .from("branch_allocation_preferences")
      .select("*")
      .eq("branch_id", branch.branch_id)
      .maybeSingle();
    const wAvail  = branchAlloc?.weight_availability ?? 40;
    const wSkills = branchAlloc?.weight_skills       ?? 30;
    const wAttend = branchAlloc?.weight_attendance   ?? 15;
    const wPerf   = branchAlloc?.weight_performance  ?? 10;
    const wWork   = branchAlloc?.weight_workload     ?? 5;

    // Batched lookups for scoring — fetched for every approved worker up front (not just the
    // eventual winner) so the response can show a full per-candidate breakdown.
    const approvedUserIds = approvedWorkers.map(w => w.user_id);
    const [skillTagRows, userRows] = await Promise.all([
      prisma.user_skill_tags.findMany({
        where: { user_id: { in: approvedUserIds } },
        select: { user_id: true, skill_id: true, experience_level: true },
      }),
      prisma.users.findMany({
        where: { user_id: { in: approvedUserIds } },
        select: { user_id: true, full_name: true },
      }),
    ]);
    const skillTagsByUser = {};
    skillTagRows.forEach(t => {
      if (!skillTagsByUser[t.user_id]) skillTagsByUser[t.user_id] = [];
      skillTagsByUser[t.user_id].push(t);
    });
    const nameByUser = Object.fromEntries(userRows.map(u => [u.user_id, u.full_name]));

    // 0-1 sub-score: does the candidate hold the task's required skill, weighted by their
    // recorded experience level? A task with no skill_id has nothing to differentiate on, so
    // every candidate scores full marks for this dimension.
    const EXPERIENCE_LEVEL_SCORE = { junior: 0.6, intermediate: 0.8, senior: 1, expert: 1 };
    function skillsSubScore(userId) {
      if (!task?.skill_id) return 1;
      const tag = (skillTagsByUser[userId] || []).find(t => t.skill_id === task.skill_id);
      if (!tag) return 0;
      const level = (tag.experience_level || "").toLowerCase();
      return EXPERIENCE_LEVEL_SCORE[level] ?? 0.7;
    }

    // 0-1 sub-score: how tightly the candidate's declared availability window fits the task's
    // time window. Every candidate reaching this point already fully covers the task (hard
    // filter 1 below) — this only ranks *how* generously, so an exact-fit window outranks
    // someone who's "available all day" for a 1-hour task.
    function availabilitySubScore(availStart, availEnd) {
      const availDuration = availEnd - availStart;
      const taskDuration = shiftEnd - shiftStart;
      if (availDuration <= 0) return 0;
      return Math.min(1, taskDuration / availDuration);
    }

    // No attendance-quality or performance-rating data exists anywhere in the schema for casual
    // workers (no attendance model, no rating/review table). Rather than invent a metric, both
    // dimensions use a fixed neutral score. This applies identically to every candidate, so it
    // never changes the ranking — it just means the attendance/performance weight sliders have
    // no real signal behind them yet, until a real data source exists to back them.
    const NEUTRAL_SUBSCORE = 0.5;

    // Batched eligibility lookups — one query per data source across all approved workers,
    // instead of the previous per-candidate round trips (staff row, availability,
    // double-booking, past-assignment count each queried once per worker in a loop). Total
    // query count here is now independent of how many casual workers are in the pool.
    const staffRowsForPool = await prisma.staff.findMany({
      where: { user_id: { in: approvedUserIds }, staff_type: "casual" },
      select: { staff_id: true, user_id: true },
    });
    const staffIdByUserId = Object.fromEntries(staffRowsForPool.map(s => [s.user_id, s.staff_id]));
    const staffIds = staffRowsForPool.map(s => s.staff_id);

    // Postgres DATE columns carry no time component, so any UTC-midnight Date for this day
    // matches regardless of exact time-of-day — this is an exact-date filter, not a range.
    const shiftDateOnly = new Date(`${shiftDateStr}T00:00:00.000Z`);

    const [availRows, sameDayAssignments, pastAssignmentCounts] = await Promise.all([
      prisma.casual_availability.findMany({
        where: { staff_id: { in: staffIds }, day_of_week: dayOfWeek, week_start_date: shiftWeekStart },
        select: { staff_id: true, available_from: true, available_to: true },
      }),
      // Only this exact date's assignments — the previous version fetched every assignment a
      // staff member had *ever* had and filtered down to same-day in JS, an unbounded query that
      // grew without limit over the lifetime of the app.
      prisma.task_assignments.findMany({
        where: { staff_id: { in: staffIds }, status: { not: "cancelled" }, shifts: { shift_date: shiftDateOnly } },
        select: { staff_id: true, shifts: { select: { start_time: true, end_time: true } } },
      }),
      prisma.task_assignments.groupBy({
        by: ["staff_id"],
        where: { staff_id: { in: staffIds }, status: { not: "cancelled" } },
        _count: { staff_id: true },
      }),
    ]);

    const availByStaffId = Object.fromEntries(availRows.map(a => [a.staff_id, a]));
    const sameDayAssignmentsByStaffId = {};
    sameDayAssignments.forEach(a => {
      if (!sameDayAssignmentsByStaffId[a.staff_id]) sameDayAssignmentsByStaffId[a.staff_id] = [];
      sameDayAssignmentsByStaffId[a.staff_id].push(a.shifts);
    });
    const pastAssignmentsByStaffId = Object.fromEntries(pastAssignmentCounts.map(r => [r.staff_id, r._count.staff_id]));

    const candidates = [];
    const failReasons = { unavailable: 0, double_booked: 0, labor_rules: 0 };

    for (const cw of approvedWorkers) {
      const staffId = staffIdByUserId[cw.user_id];
      if (!staffId) { failReasons.unavailable++; continue; }

      // Hard filter 1: weekly availability on this day and time overlaps
      const avail = availByStaffId[staffId];
      if (!avail) { failReasons.unavailable++; continue; }
      const availStart = toMins(avail.available_from);
      const availEnd   = toMins(avail.available_to);
      if (availStart > shiftStart || availEnd < shiftEnd) { failReasons.unavailable++; continue; }

      // Hard filter 2: not double-booked on same date with overlapping times
      const doubleBooked = (sameDayAssignmentsByStaffId[staffId] || []).some(s =>
        doTimeRangesOverlap(toMins(s.start_time), toMins(s.end_time), shiftStart, shiftEnd)
      );
      if (doubleBooked) { failReasons.double_booked++; continue; }

      // Round 3, Task 5: branch labor rules (max daily hours, max consecutive working days) are
      // now a SOFT signal, not a hard filter — the same check assignStaff uses for manual
      // assignment (checkLaborRules is shared, unmodified logic from taskController.js), but a
      // breach here only ranks the candidate lower via laborPenalty below, applied after
      // weighted scoring. failReasons.labor_rules is kept for the score_breakdown / empty-result
      // messaging below, now meaning "would breach" rather than "excluded".
      const laborWarning = await checkLaborRules(staffId, Number(shift_id), branch.branch_id);
      if (laborWarning) failReasons.labor_rules++;

      // Passed the remaining hard filters — gather the raw signal needed for weighted scoring.
      const pastAssignments = pastAssignmentsByStaffId[staffId] || 0;

      candidates.push({
        cw,
        staffId,
        pastAssignments,
        laborWarning,
        subScores: {
          availability: availabilitySubScore(availStart, availEnd),
          skills: skillsSubScore(cw.user_id),
          attendance: NEUTRAL_SUBSCORE,
          performance: NEUTRAL_SUBSCORE,
        },
      });
    }

    if (candidates.length === 0) {
      // labor_rules is deliberately not a possible cause here any more (Task 5: it's a soft
      // score penalty below, not a filter) — any candidate who only breaches labor rules is
      // still in `candidates`, so reaching zero can only mean unavailable/double_booked.
      const parts = [];
      if (failReasons.unavailable > 0) parts.push(`${failReasons.unavailable} unavailable on ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][dayOfWeek]}`);
      if (failReasons.double_booked > 0) parts.push(`${failReasons.double_booked} already booked at this time`);
      return res.json({
        success: false,
        flagged: true,
        reason: `No eligible casual workers — ${parts.join(", ")}.`,
      });
    }

    // Workload is normalised relative to this candidate set (not a fixed scale), so it can only
    // be computed once every surviving candidate's past-assignment count is known.
    const maxPastAssignments = Math.max(...candidates.map(c => c.pastAssignments), 0);
    // Round 3, Task 5: a labor-rule breach costs 30% of the otherwise-earned score rather than
    // excluding the candidate outright — enough to consistently rank a clean candidate above a
    // breaching one when both are viable, but a breaching candidate can still win when nobody
    // else fits (matching allow_overtime's own meaning: the branch already expects some breaches
    // to happen sometimes).
    const LABOR_WARNING_PENALTY = 0.7;
    candidates.forEach(c => {
      c.subScores.workload = maxPastAssignments === 0 ? 1 : 1 - c.pastAssignments / maxPastAssignments;
      c.score = computeWeightedScore(c.subScores, {
        availability: wAvail, skills: wSkills, attendance: wAttend, performance: wPerf, workload: wWork,
      });
      if (c.laborWarning) c.score *= LABOR_WARNING_PENALTY;
    });

    // Pick top scorer
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];

    // Create assignment
    const assignment = await prisma.task_assignments.create({
      data: {
        shift_id: Number(shift_id),
        task_id: Number(task_id),
        staff_id: winner.staffId,
        status: "assigned",
        acknowledged: false,
      },
    });

    // Notify the worker
    const user = await prisma.users.findUnique({ where: { user_id: winner.cw.user_id }, select: { full_name: true } });
    await notifyUser({
      recipientId: winner.cw.user_id,
      type: "casual_assigned",
      title: "You've been assigned to a shift!",
      message: `You've been assigned to ${task?.title || "a task"} on ${shiftDateStr} at ${branch.name}. Please check your schedule.`,
      relatedEntity: "shift",
      relatedId: Number(shift_id),
    });

    return res.json({
      success: true,
      assigned: {
        assignment_id: assignment.assignment_id,
        full_name: user?.full_name,
        user_id: winner.cw.user_id,
        past_assignments: winner.pastAssignments,
        score: Math.round(winner.score * 10) / 10,
        labor_warning: winner.laborWarning || null,
      },
      // Explainable breakdown for every candidate who passed the hard filters (already sorted
      // best-first), so a demo can show why the winner beat the runners-up.
      score_breakdown: {
        weights_applied: { availability: wAvail, skills: wSkills, attendance: wAttend, performance: wPerf, workload: wWork },
        candidates: candidates.map(c => ({
          user_id: c.cw.user_id,
          full_name: nameByUser[c.cw.user_id] || null,
          score: Math.round(c.score * 10) / 10,
          sub_scores: {
            availability: Math.round(c.subScores.availability * 100) / 100,
            skills: Math.round(c.subScores.skills * 100) / 100,
            attendance: c.subScores.attendance,
            performance: c.subScores.performance,
            workload: Math.round(c.subScores.workload * 100) / 100,
          },
          // Round 3, Task 5: the labor-rule outcome for this candidate — null when clean, the
          // human-readable reason from checkLaborRules when it would breach a limit. Applied as
          // a 30% score penalty above, not an exclusion.
          labor_warning: c.laborWarning || null,
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// POST /api/casual/join-code/regenerate
async function regenerateJoinCode(req, res) {
  try {
    const biz = await resolveOwnerBusiness(req.user.user_id);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const code = generateJoinCode();
    const { error } = await supabaseAdmin.from("businesses").update({ join_code: code }).eq("business_id", biz.business_id);
    if (error) throw new Error(error.message);

    return res.json({ success: true, join_code: code });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  registerCasualWorker,
  getCasualWorkerStatus,
  getMyBranches,
  getPreferences,
  setPreferences,
  getMyAvailability,
  setMyAvailability,
  submitWeeklyAvailability,
  getManagerPool,
  autoAssignCasual,
  getPool,
  approveWorker,
  rejectWorker,
  getJoinCode,
  regenerateJoinCode,
};
