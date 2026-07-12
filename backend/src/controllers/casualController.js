const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const generateToken = require("../utils/generateToken");

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function generateJoinCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}-${rand(4)}`;
}

async function resolveManagerOutlet(userId) {
  const { data: link } = await supabaseAdmin
    .from("outlet_managers")
    .select("outlet_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (!link) return null;
  const outlet = await prisma.outlets.findUnique({
    where: { outlet_id: link.outlet_id },
    select: { outlet_id: true, business_id: true, name: true },
  });
  return outlet || null;
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
      data: { full_name, username, email, role: "outlet_casual_staff", is_active: true },
    });

    const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert({
      user_id: newUser.user_id,
      business_id: biz.business_id,
      status: "pending",
      bio: bio || null,
    });
    if (cwErr) throw new Error(cwErr.message);

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

// GET /api/casual/my-outlets — list all outlets in the worker's business
async function getMyOutlets(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("outlet_id, name, address")
      .eq("business_id", cw.business_id)
      .order("name");

    return res.json({ success: true, outlets: outlets || [], approval_status: cw.status });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// GET /api/casual/preferences — get preferred outlet IDs
async function getPreferences(req, res) {
  try {
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("outlet_id")
      .eq("user_id", req.user.user_id);

    return res.json({ success: true, preferred_outlet_ids: (prefs || []).map(p => p.outlet_id) });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// PUT /api/casual/preferences — replace preferred outlets { outlet_ids: [1,2,3] }
async function setPreferences(req, res) {
  try {
    const { data: cw } = await supabaseAdmin
      .from("casual_workers")
      .select("business_id, status")
      .eq("user_id", req.user.user_id)
      .maybeSingle();

    if (!cw) return res.status(404).json({ success: false, message: "Casual worker record not found." });

    const { outlet_ids } = req.body;
    if (!Array.isArray(outlet_ids)) {
      return res.status(400).json({ success: false, message: "outlet_ids must be an array." });
    }

    // Delete existing, then insert new ones
    await supabaseAdmin.from("casual_branch_preferences").delete().eq("user_id", req.user.user_id);

    if (outlet_ids.length > 0) {
      const rows = outlet_ids.map(id => ({ user_id: req.user.user_id, outlet_id: id }));
      const { error } = await supabaseAdmin.from("casual_branch_preferences").insert(rows);
      if (error) throw new Error(error.message);
    }

    return res.json({ success: true, message: "Branch preferences saved.", preferred_outlet_ids: outlet_ids });
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
      .select("staff_id, outlet_id")
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

    // Notify manager
    const user = await prisma.users.findUnique({ where: { user_id: userId }, select: { full_name: true } });
    if (staffRecord.outlet_id) {
      const { data: managerLink } = await supabaseAdmin
        .from("outlet_managers")
        .select("user_id")
        .eq("outlet_id", staffRecord.outlet_id)
        .maybeSingle();

      if (managerLink?.user_id) {
        const DN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const summary = availability.length > 0
          ? availability.map(a => `${DN[a.day_of_week]} ${a.available_from?.slice(0,5)}–${a.available_to?.slice(0,5)}`).join(", ")
          : "No availability set";
        await supabaseAdmin.from("notifications").insert({
          recipient_id:   managerLink.user_id,
          type:           "casual_availability",
          title:          `${user?.full_name || "Casual worker"} submitted availability`,
          message:        `Week of ${week_start_date}: ${summary}`,
          related_entity: "casual_availability",
          related_id:     String(staffRecord.staff_id),
          is_read:        false,
        });
      }
    }

    return res.json({ success: true, message: "Availability submitted." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MANAGER — casual pool for their outlet
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/casual/manager/pool — workers who prefer this outlet
async function getManagerPool(req, res) {
  try {
    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found for this manager." });

    // Get all users who have this outlet as a preference and are approved
    const { data: prefs } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("outlet_id", outlet.outlet_id);

    const userIds = (prefs || []).map(p => p.user_id);
    if (userIds.length === 0) return res.json({ success: true, workers: [] });

    // Filter to approved workers only
    const { data: approved } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status, bio, approved_at")
      .eq("business_id", outlet.business_id)
      .eq("status", "approved")
      .in("user_id", userIds);

    const enriched = await Promise.all((approved || []).map(async (w) => {
      const user = await prisma.users.findUnique({
        where: { user_id: w.user_id },
        select: { full_name: true, email: true, username: true },
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
        .select("outlets(outlet_id, name)")
        .eq("user_id", w.user_id);

      return {
        ...w,
        full_name: user?.full_name,
        email: user?.email,
        username: user?.username,
        skills: (skills || []).map(s => s.skills?.name).filter(Boolean),
        preferred_branches: (prefs || []).map(p => p.outlets).filter(Boolean),
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
      await supabaseAdmin.from("notifications").insert({
        recipient_id: cw.user_id,
        type: "casual_approved",
        title: "Your application was approved!",
        message: `You've been approved as a casual worker for ${biz.name}. You can now set your preferred branches.`,
        related_entity: "casual_worker",
        related_id: Number(req.params.id),
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

    const { error } = await supabaseAdmin
      .from("casual_workers")
      .update({ status: "rejected" })
      .eq("id", Number(req.params.id))
      .eq("business_id", biz.business_id);

    if (error) throw new Error(error.message);
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

// POST /api/casual/manager/auto-assign  body: { shift_id, role_id }
async function autoAssignCasual(req, res) {
  try {
    const { shift_id, role_id } = req.body;
    if (!shift_id || !role_id) {
      return res.status(400).json({ success: false, message: "shift_id and role_id are required." });
    }

    const outlet = await resolveManagerOutlet(req.user.user_id);
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found." });

    // Get shift details
    const shift = await prisma.shifts.findUnique({
      where: { shift_id: Number(shift_id) },
      select: { shift_id: true, outlet_id: true, shift_date: true, start_time: true, end_time: true },
    });
    if (!shift) return res.status(404).json({ success: false, message: "Shift not found." });
    if (shift.outlet_id !== outlet.outlet_id) return res.status(403).json({ success: false, message: "Access denied." });

    // Count how many casuals are already assigned to this role
    const existingAssignments = await prisma.shift_assignments.count({
      where: { role_id: Number(role_id), krewby_worker_id: { not: null }, status: { not: "cancelled" } },
    });
    const role = await prisma.shift_roles.findUnique({ where: { role_id: Number(role_id) }, select: { headcount: true, role_name: true } });
    if (role && existingAssignments >= role.headcount) {
      return res.status(400).json({ success: false, message: "This role is already fully staffed." });
    }

    // shift_date day of week: Mon=0 … Sun=6
    const shiftDate = new Date(shift.shift_date);
    const dayOfWeek = (shiftDate.getDay() + 6) % 7;

    // Time helpers (HH:MM string → minutes)
    const toMins = (t) => { const [h, m] = String(t).split(":"); return Number(h) * 60 + Number(m); };
    const shiftStart = toMins(shift.start_time);
    const shiftEnd   = toMins(shift.end_time);
    const shiftDateStr = shiftDate.toISOString().slice(0, 10);

    // All approved casual workers for this business
    const { data: approvedWorkers } = await supabaseAdmin
      .from("casual_workers")
      .select("id, user_id, status")
      .eq("business_id", outlet.business_id)
      .eq("status", "approved");

    if (!approvedWorkers || approvedWorkers.length === 0) {
      return res.json({ success: false, flagged: true, reason: "No approved casual workers in this business yet." });
    }

    const candidates = [];
    const failReasons = { unavailable: 0, double_booked: 0 };

    for (const cw of approvedWorkers) {
      // Hard filter 1: weekly availability on this day and time overlaps
      const { data: avail } = await supabaseAdmin
        .from("casual_weekly_availability")
        .select("available_from, available_to")
        .eq("user_id", cw.user_id)
        .eq("day_of_week", dayOfWeek)
        .maybeSingle();

      if (!avail) { failReasons.unavailable++; continue; }
      const availStart = toMins(avail.available_from);
      const availEnd   = toMins(avail.available_to);
      if (availStart > shiftStart || availEnd < shiftEnd) { failReasons.unavailable++; continue; }

      // Get their krewby_worker record
      const kw = await prisma.krewby_workers.findFirst({ where: { user_id: cw.user_id }, select: { krewby_worker_id: true } });
      if (!kw) { failReasons.unavailable++; continue; }

      // Hard filter 2: not double-booked on same date with overlapping times
      const conflictingShifts = await prisma.shift_assignments.findMany({
        where: { krewby_worker_id: kw.krewby_worker_id, status: { not: "cancelled" } },
        select: { shifts: { select: { shift_date: true, start_time: true, end_time: true } } },
      });
      const doubleBooked = conflictingShifts.some(a => {
        const s = a.shifts;
        if (!s) return false;
        const sDate = new Date(s.shift_date).toISOString().slice(0, 10);
        if (sDate !== shiftDateStr) return false;
        const cStart = toMins(s.start_time);
        const cEnd   = toMins(s.end_time);
        return cStart < shiftEnd && cEnd > shiftStart; // overlap
      });
      if (doubleBooked) { failReasons.double_booked++; continue; }

      // Passed all hard filters — compute soft rank score
      const prefMatch = await supabaseAdmin
        .from("casual_branch_preferences")
        .select("outlet_id", { count: "exact", head: true })
        .eq("user_id", cw.user_id)
        .eq("outlet_id", outlet.outlet_id);

      const pastAssignments = await prisma.shift_assignments.count({
        where: { krewby_worker_id: kw.krewby_worker_id, status: { not: "cancelled" } },
      });

      const score = (prefMatch.count > 0 ? 20 : 0) - pastAssignments;

      candidates.push({ cw, kw, score, pastAssignments, prefMatch: prefMatch.count > 0 });
    }

    if (candidates.length === 0) {
      const parts = [];
      if (failReasons.unavailable > 0) parts.push(`${failReasons.unavailable} unavailable on ${["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][dayOfWeek]}`);
      if (failReasons.double_booked > 0) parts.push(`${failReasons.double_booked} already booked at this time`);
      return res.json({
        success: false,
        flagged: true,
        reason: `No eligible casual workers — ${parts.join(", ")}.`,
      });
    }

    // Pick top scorer
    candidates.sort((a, b) => b.score - a.score);
    const winner = candidates[0];

    // Create assignment
    const assignment = await prisma.shift_assignments.create({
      data: {
        shift_id: Number(shift_id),
        role_id: Number(role_id),
        krewby_worker_id: winner.kw.krewby_worker_id,
        status: "assigned",
        acknowledged: false,
      },
    });

    // Notify the worker
    const user = await prisma.users.findUnique({ where: { user_id: winner.cw.user_id }, select: { full_name: true } });
    await supabaseAdmin.from("notifications").insert({
      recipient_id: winner.cw.user_id,
      type: "casual_assigned",
      title: "You've been assigned to a shift!",
      message: `You've been assigned to ${role?.role_name || "a role"} on ${shiftDateStr} at ${outlet.name}. Please check your schedule.`,
      related_entity: "shift",
      related_id: Number(shift_id),
    });

    return res.json({
      success: true,
      assigned: {
        assignment_id: assignment.assignment_id,
        full_name: user?.full_name,
        user_id: winner.cw.user_id,
        preferred_branch: winner.prefMatch,
        past_assignments: winner.pastAssignments,
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
  getMyOutlets,
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
