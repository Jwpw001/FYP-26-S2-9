const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { getLimits } = require("../utils/planLimits");
const { logAudit } = require("../utils/auditLog");
const { offboardStaff } = require("../utils/offboarding");

// Resolves business_id for both business owners and managers
async function resolveBusinessId(user) {
  if (user.role === "business_owner") {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, industry").eq("owner_id", user.user_id).maybeSingle();
    return biz || null;
  }
  // manager: find their branch → business
  const { data: link } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", user.user_id).limit(1).maybeSingle();
  if (!link) return null;
  const branch = await prisma.branches.findUnique({ where: { branch_id: link.branch_id }, select: { business_id: true } });
  if (!branch) return null;
  const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, industry").eq("business_id", branch.business_id).maybeSingle();
  return biz || null;
}

// Verifies branch_id actually belongs to the caller's own business (owner or manager).
// Several branch-scoped endpoints previously skipped this check entirely, letting any
// authenticated business_owner/manager read or modify another business's branch data
// just by guessing a branch_id.
async function verifyBranchAccess(user, branch_id) {
  const biz = await resolveBusinessId(user);
  if (!biz) return false;
  const branch = await prisma.branches.findUnique({ where: { branch_id }, select: { business_id: true } });
  return !!branch && branch.business_id === biz.business_id;
}

// ── Branches ──────────────────────────────────────────────

// GET /api/business/branches
const getMyBranches = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, branches: [] });

    const { data: branches } = await supabaseAdmin
      .from("branches")
      .select("branch_id, name, address, business_id, open_time, close_time")
      .eq("business_id", biz.business_id)
      .is("deleted_at", null)
      .order("branch_id");
    return res.json({ success: true, branches: branches || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/business/branches
const createBranch = async (req, res) => {
  try {
    const { name, address, open_time, close_time, role_templates, operating_days, holidays, work_hours_day, max_work_hours_day, max_consecutive_days, allow_overtime, min_workers_per_assignment } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Branch name is required." });

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, plan").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    // Enforce branch limit
    const limits = getLimits(biz.plan);
    if (limits.branches !== Infinity) {
      const { count } = await supabaseAdmin.from("branches").select("*", { count: "exact", head: true }).eq("business_id", biz.business_id).is("deleted_at", null);
      if ((count || 0) >= limits.branches) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          limitType: "branches",
          plan: biz.plan,
          message: `Your ${biz.plan} plan allows ${limits.branches} branch${limits.branches === 1 ? "" : "s"}. Upgrade to add more.`,
        });
      }
    }

    const { data: branch, error: branchErr } = await supabaseAdmin
      .from("branches")
      .insert({ name, address: address || null, business_id: biz.business_id, open_time: open_time || "08:00:00", close_time: close_time || "22:00:00" })
      .select()
      .single();
    if (branchErr) throw new Error(branchErr.message);

    // Create branch_settings row with business_id
    const settingsRow = {
      branch_id: branch.branch_id,
      business_id: biz.business_id,
      ...(operating_days !== undefined && { operating_days }),
      ...(holidays !== undefined && { holidays }),
      ...(work_hours_day !== undefined && { work_hours_day }),
      ...(max_work_hours_day !== undefined && { max_work_hours_day }),
      ...(max_consecutive_days !== undefined && { max_consecutive_days }),
      ...(allow_overtime !== undefined && { allow_overtime }),
      ...(min_workers_per_assignment !== undefined && { min_workers_per_assignment }),
    };
    await supabaseAdmin.from("branch_settings").insert(settingsRow);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const filtered = role_templates.filter(r => r.role_name?.trim());
      const allSkills = await prisma.skills.findMany({ select: { skill_id: true, name: true } });
      const skillByName = Object.fromEntries(allSkills.map(s => [s.name.toLowerCase(), s.skill_id]));
      const rows = filtered.map(r => ({
        branch_id: branch.branch_id,
        role_name: r.role_name.trim(),
        skill_id: skillByName[r.role_name.trim().toLowerCase()] || null,
        headcount: Number(r.headcount) || 1,
      }));
      if (rows.length > 0) await supabaseAdmin.from("branch_role_templates").insert(rows);
    }

    return res.status(201).json({ success: true, branch });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/staff
const getAllStaff = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, staff: [] });

    const branches = await prisma.branches.findMany({ where: { business_id: biz.business_id, deleted_at: null }, select: { branch_id: true, name: true } });
    const branchIds = branches.map(o => o.branch_id);
    if (branchIds.length === 0) return res.json({ success: true, staff: [] });

    const staff = await prisma.staff.findMany({
      where: { branch_id: { in: branchIds } },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } },
      orderBy: { staff_id: "asc" },
    });

    const branchNameById = Object.fromEntries(branches.map(o => [o.branch_id, o.name]));
    const enriched = staff.map(s => ({ ...s, branch_name: branchNameById[s.branch_id] }));

    return res.json({ success: true, staff: enriched });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/managers
const getAllManagers = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, managers: [] });

    const branches = await prisma.branches.findMany({ where: { business_id: biz.business_id, deleted_at: null }, select: { branch_id: true, name: true } });
    const branchIds = branches.map(o => o.branch_id);
    if (branchIds.length === 0) return res.json({ success: true, managers: [] });

    const { data: links } = await supabaseAdmin.from("branch_managers").select("user_id, branch_id, is_primary").in("branch_id", branchIds);
    const userIds = [...new Set((links || []).map(l => l.user_id))];
    if (userIds.length === 0) return res.json({ success: true, managers: [] });

    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, full_name: true, email: true, is_active: true, avatar_url: true },
    });

    const branchNameById = Object.fromEntries(branches.map(o => [o.branch_id, o.name]));
    const usersById = Object.fromEntries(users.map(u => [u.user_id, u]));

    const managers = (links || [])
      .filter(l => usersById[l.user_id])
      .map(l => ({
        ...usersById[l.user_id],
        branch_id: l.branch_id,
        branch_name: branchNameById[l.branch_id],
        is_primary: l.is_primary,
      }));

    return res.json({ success: true, managers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/branches/:branch_id/staff
const getBranchStaff = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const branch = await prisma.branches.findUnique({ where: { branch_id: branch_id } });
    if (!branch || branch.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const staff = await prisma.staff.findMany({
      where: { branch_id: branch_id },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } },
      orderBy: { staff_id: "asc" },
    });
    return res.json({ success: true, staff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/branches/:branch_id/managers
const getBranchManagers = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const branch = await prisma.branches.findUnique({ where: { branch_id: branch_id } });
    if (!branch || branch.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const { data: links } = await supabaseAdmin.from("branch_managers").select("user_id, is_primary").eq("branch_id", branch_id);
    const userIds = (links || []).map(l => l.user_id);
    if (userIds.length === 0) return res.json({ success: true, managers: [] });

    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, full_name: true, email: true, avatar_url: true },
    });

    const managers = users.map(u => ({
      ...u,
      is_primary: links.find(l => l.user_id === u.user_id)?.is_primary || false,
    }));

    return res.json({ success: true, managers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Manager detail ───────────────────────────────────────

async function getOwnedManagerLinkOrNull(req, user_id) {
  const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
  if (!biz) return null;

  const { data: link } = await supabaseAdmin.from("branch_managers").select("branch_id, is_primary").eq("user_id", user_id).maybeSingle();
  if (!link) return null;

  const branch = await prisma.branches.findUnique({ where: { branch_id: link.branch_id } });
  if (!branch || branch.business_id !== biz.business_id) return null;

  return { ...link, branch };
}

// GET /api/business/managers/:user_id
const getManagerDetail = async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const link = await getOwnedManagerLinkOrNull(req, user_id);
    if (!link) return res.status(404).json({ success: false, message: "Manager not found." });

    const manager = await prisma.users.findUnique({
      where: { user_id },
      select: { user_id: true, full_name: true, email: true, is_active: true, created_at: true, avatar_url: true },
    });
    if (!manager) return res.status(404).json({ success: false, message: "Manager not found." });

    return res.json({ success: true, manager, branch: link.branch, is_primary: link.is_primary });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/business/managers/:user_id
const updateManagerDetail = async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const link = await getOwnedManagerLinkOrNull(req, user_id);
    if (!link) return res.status(404).json({ success: false, message: "Manager not found." });

    const { full_name, is_active } = req.body;
    const updated = await prisma.users.update({
      where: { user_id },
      data: {
        ...(full_name && full_name.trim() ? { full_name: full_name.trim() } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
      },
      select: { user_id: true, full_name: true, email: true, is_active: true, created_at: true, avatar_url: true },
    });

    return res.json({ success: true, manager: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/business/managers/:user_id
const deleteManagerDetail = async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const link = await getOwnedManagerLinkOrNull(req, user_id);
    if (!link) return res.status(404).json({ success: false, message: "Manager not found." });

    await prisma.users.delete({ where: { user_id } });
    return res.json({ success: true, message: "Manager removed." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/business/branches/:branch_id
const updateBranch = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    const { name, address, open_time, close_time, working_days } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Branch name is required." });
    if (working_days !== undefined && ![5, 6, 7].includes(Number(working_days))) {
      return res.status(400).json({ success: false, message: "working_days must be 5, 6, or 7." });
    }

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const branch = await prisma.branches.findUnique({ where: { branch_id: branch_id } });
    if (!branch || branch.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("branches")
      .update({ name, address: address || null, open_time: open_time || branch.open_time, close_time: close_time || branch.close_time, ...(working_days !== undefined && { working_days: Number(working_days) }) })
      .eq("branch_id", branch_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res.json({ success: true, branch: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/branches/:branch_id/role-templates
const getRoleTemplates = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    if (!(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const { data, error } = await supabaseAdmin
      .from("branch_role_templates")
      .select("*, skills(skill_id, name)")
      .eq("branch_id", branch_id)
      .order("template_id");
    if (error) throw new Error(error.message);
    return res.json({ success: true, templates: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/business/branches/:branch_id/role-templates  (replace all)
const upsertRoleTemplates = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    const { role_templates } = req.body;

    if (!(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    await supabaseAdmin.from("branch_role_templates").delete().eq("branch_id", branch_id);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const filtered = role_templates.filter(r => r.role_name?.trim());
      const allSkills = await prisma.skills.findMany({ select: { skill_id: true, name: true } });
      const skillByName = Object.fromEntries(allSkills.map(s => [s.name.toLowerCase(), s.skill_id]));
      const rows = filtered.map(r => ({
        branch_id: branch_id,
        role_name: r.role_name.trim(),
        skill_id: skillByName[r.role_name.trim().toLowerCase()] || null,
        headcount: Number(r.headcount) || 1,
      }));
      if (rows.length > 0) await supabaseAdmin.from("branch_role_templates").insert(rows);
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/business/branches/:branch_id
const deleteBranch = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const branch = await prisma.branches.findUnique({ where: { branch_id: branch_id } });
    if (!branch || branch.business_id !== biz.business_id || branch.deleted_at) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    // Soft delete — a hard delete here cascades and permanently destroys every historical
    // shift, timesheet, and swap record tied to the branch, which is both a record-retention
    // problem and irreversible if a manager clicks this by mistake.
    await prisma.branches.update({ where: { branch_id: branch_id }, data: { deleted_at: new Date() } });

    await logAudit({
      actorId: req.user.user_id, action: "branch_deleted", entity: "branches", entityId: branch_id,
      before: { name: branch.name, business_id: branch.business_id }, after: null,
    });

    return res.json({ success: true, message: "Branch deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Staff detail ─────────────────────────────────────────

async function getOwnedStaffOrNull(req, staff_id) {
  const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
  if (!biz) return null;

  const staff = await prisma.staff.findUnique({
    where: { staff_id },
    include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } }, branches: true },
  });
  if (!staff || staff.branches.business_id !== biz.business_id) return null;
  return staff;
}

// GET /api/business/staff/:staff_id/kpi
// Rebuilt against `timesheets` — this previously joined a Prisma relation called
// `attendance` that no longer exists in the schema (removed along with the old
// clock-in/out feature), so every call to this endpoint threw. There's no real
// "present/absent/late" concept anymore; the closest equivalent is whether a shift
// has an approved work report against it.
const getStaffKpi = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const [assignments, timesheets] = await Promise.all([
      prisma.task_assignments.findMany({ where: { staff_id }, select: { shift_id: true } }),
      prisma.timesheets.findMany({ where: { staff_id }, select: { shift_id: true, status: true, hours_worked: true } }),
    ]);

    const totalAssigned = assignments.length;
    const timesheetByShift = new Map();
    timesheets.forEach(t => { if (t.shift_id != null) timesheetByShift.set(t.shift_id, t); });

    let approved = 0, rejected = 0, missing = 0, totalHours = 0;
    for (const a of assignments) {
      const ts = a.shift_id != null ? timesheetByShift.get(a.shift_id) : null;
      if (!ts) { missing++; continue; }
      if (ts.status === "approved") { approved++; totalHours += Number(ts.hours_worked || 0); }
      else if (ts.status === "rejected") rejected++;
    }

    const attendanceRate = totalAssigned > 0 ? Math.round((approved / totalAssigned) * 100) : null;

    return res.json({
      success: true,
      kpi: { totalAssigned, approved, rejected, missing, attendanceRate, totalHours: Math.round(totalHours * 10) / 10 },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/staff/:staff_id
const getStaffDetail = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const [allSkills, assignedTags] = await Promise.all([
      prisma.skills.findMany({ orderBy: { name: "asc" } }),
      prisma.user_skill_tags.findMany({ where: { user_id: staff.user_id } }),
    ]);

    return res.json({
      success: true,
      staff,
      allSkills,
      assignedSkillIds: assignedTags.map(t => t.skill_id),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/business/staff/:staff_id
const updateStaffDetail = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const { full_name, staff_type, default_work_days, is_active, skill_ids } = req.body;

    if (full_name && full_name.trim()) {
      await prisma.users.update({ where: { user_id: staff.user_id }, data: { full_name: full_name.trim() } });
    }

    const updated = await prisma.staff.update({
      where: { staff_id },
      data: {
        ...(staff_type !== undefined ? { staff_type } : {}),
        ...(default_work_days !== undefined ? { default_work_days } : {}),
        ...(is_active !== undefined ? { is_active } : {}),
      },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } } },
    });

    const isBeingDeactivated = is_active === false && staff.is_active !== false;
    if (isBeingDeactivated) {
      await offboardStaff(staff_id, req.user.user_id);
    }

    if (Array.isArray(skill_ids)) {
      await prisma.user_skill_tags.deleteMany({ where: { user_id: staff.user_id } });
      if (skill_ids.length > 0) {
        await prisma.user_skill_tags.createMany({
          data: skill_ids.map(skill_id => ({ user_id: staff.user_id, skill_id })),
        });
      }
    }

    return res.json({ success: true, staff: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/business/staff/:staff_id
const deleteStaffDetail = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    await prisma.user_skill_tags.deleteMany({ where: { user_id: staff.user_id } });
    await prisma.staff.delete({ where: { staff_id } });
    await prisma.users.delete({ where: { user_id: staff.user_id } });

    return res.json({ success: true, message: "Staff member deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/info
const getMyBusiness = async (req, res) => {
  try {
    const { data: biz, error } = await supabaseAdmin.from("businesses").select("*").eq("owner_id", req.user.user_id).maybeSingle();
    if (error) throw new Error(error.message);
    return res.json({ success: true, business: biz || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const VALID_PLANS = ["free", "premium", "enterprise"];

// PATCH /api/business/plan — the owner picks their own plan; there's no payment step yet, but
// the update must still be scoped server-side to the caller's own business (owner_id from the
// verified JWT), not trusted from the client the way a direct Supabase write from the browser would be.
const updateMyBusinessPlan = async (req, res) => {
  try {
    const { plan } = req.body;
    if (!VALID_PLANS.includes(plan)) {
      return res.status(400).json({ success: false, message: "Invalid plan." });
    }

    const { data: biz, error: fetchErr } = await supabaseAdmin
      .from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { data: updated, error } = await supabaseAdmin
      .from("businesses").update({ plan }).eq("business_id", biz.business_id).select("plan").single();
    if (error) throw new Error(error.message);

    return res.json({ success: true, plan: updated.plan });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Skill tags scoped to branch ───────────────────────────

// GET /api/business/branches/:branch_id/skills
const getBranchSkills = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    if (!(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }
    const { data: rows, error } = await supabaseAdmin
      .from("branch_skills")
      .select("id, skill_id, skills(skill_id, name, description)")
      .eq("branch_id", branch_id);
    if (error) throw new Error(error.message);
    const skills = (rows || [])
      .map(r => ({ branch_skill_id: r.id, skill_id: r.skills?.skill_id ?? r.skill_id, name: r.skills?.name, description: r.skills?.description }))
      .filter(s => s.name)
      .sort((a, b) => a.name.localeCompare(b.name));
    return res.json({ success: true, skills });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/business/branches/:branch_id/skills
// Body: { skill_id } — link existing global skill
//    OR { name, description } — create new skill then link
const createBranchSkill = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    const { skill_id, name, description } = req.body;

    if (!(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    let skid;
    if (skill_id) {
      skid = Number(skill_id);
    } else {
      if (!name?.trim()) return res.status(400).json({ success: false, message: "Skill name is required." });
      // Reuse an existing global skill with the same name, or create one
      const existing = await prisma.skills.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, branch_id: null } });
      skid = existing
        ? existing.skill_id
        : (await prisma.skills.create({ data: { name: name.trim(), description: description || null, created_by: req.user.user_id } })).skill_id;
    }

    const { data: already } = await supabaseAdmin.from("branch_skills").select("id").eq("branch_id", branch_id).eq("skill_id", skid).maybeSingle();
    if (already) return res.status(409).json({ success: false, message: "Skill already added to this branch." });

    const { error } = await supabaseAdmin.from("branch_skills").insert({ branch_id: branch_id, skill_id: skid });
    if (error) throw new Error(error.message);

    const skill = await prisma.skills.findUnique({ where: { skill_id: skid }, select: { skill_id: true, name: true, description: true } });
    return res.status(201).json({ success: true, skill });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/business/branches/:branch_id/skills/:skill_id — update the global skill definition
const updateBranchSkill = async (req, res) => {
  try {
    const skill_id = Number(req.params.skill_id);
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Skill name is required." });

    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    // Only a skill this business actually owns (not the shared catalog) can be edited here —
    // editing a catalog skill would change it for every business using it.
    const existingSkill = await prisma.skills.findUnique({ where: { skill_id }, select: { business_id: true } });
    if (!existingSkill || existingSkill.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Skill not found." });
    }

    const skill = await prisma.skills.update({ where: { skill_id }, data: { name, description: description || null } });
    return res.json({ success: true, skill });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/business/branches/:branch_id/skills/:skill_id — unlink skill from branch only
const deleteBranchSkill = async (req, res) => {
  try {
    const branch_id = Number(req.params.branch_id);
    const skill_id = Number(req.params.skill_id);

    if (!(await verifyBranchAccess(req.user, branch_id))) {
      return res.status(404).json({ success: false, message: "Branch not found." });
    }

    const { error } = await supabaseAdmin.from("branch_skills").delete().eq("branch_id", branch_id).eq("skill_id", skill_id);
    if (error) throw new Error(error.message);
    return res.json({ success: true, message: "Skill removed from branch." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Stats / consolidated report ───────────────────────────

// GET /api/business/stats
const getBusinessStats = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, name").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, branches_count: 0, staff_count: 0, shifts_count: 0, active_invites: 0 });

    const branches = await prisma.branches.findMany({ where: { business_id: biz.business_id, deleted_at: null }, select: { branch_id: true } });
    const branchIds = branches.map(o => o.branch_id);

    const [staffCount, shiftCount, inviteCount] = await Promise.all([
      branchIds.length ? prisma.staff.count({ where: { branch_id: { in: branchIds }, is_active: true } }) : 0,
      branchIds.length ? prisma.shifts.count({ where: { branch_id: { in: branchIds } } }) : 0,
      prisma.invitations.count({ where: { invited_by: req.user.user_id, status: "pending" } }),
    ]);

    return res.json({
      success: true,
      branches_count: branchIds.length,
      staff_count: staffCount,
      shifts_count: shiftCount,
      active_invites: inviteCount,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Business-level skills (backed by business_roles table) ──

const getBusinessSkills = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.json({ skills: [], suggestions: [], industry: "" });

    const { data: roles, error } = await supabaseAdmin
      .from("business_roles")
      .select("role_id, role_name, description, is_suggested, created_at")
      .eq("business_id", biz.business_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const skills = (roles || []).map(r => ({
      skill_id: r.role_id,
      name: r.role_name,
      description: r.description || "",
      is_suggested: r.is_suggested,
    }));

    const existingNames = new Set((roles || []).map(r => r.role_name.toLowerCase()));
    const allSkills = await prisma.skills.findMany({ orderBy: { name: "asc" }, select: { skill_id: true, name: true, description: true } });
    const suggestions = allSkills.filter(s => !existingNames.has(s.name.toLowerCase()));

    return res.json({ skills, suggestions, industry: biz.industry || "" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createBusinessSkill = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Skill name is required." });

    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { data: existing } = await supabaseAdmin
      .from("business_roles")
      .select("role_id")
      .eq("business_id", biz.business_id)
      .ilike("role_name", name.trim())
      .maybeSingle();
    if (existing) return res.status(409).json({ success: false, message: "A skill with this name already exists." });

    const { data: role, error } = await supabaseAdmin
      .from("business_roles")
      .insert({ business_id: biz.business_id, role_name: name.trim(), description: description || "", is_suggested: false })
      .select("role_id, role_name, description")
      .single();
    if (error) throw new Error(error.message);

    // Ensure matching entry exists in global skills table for staff assignment
    const existingSkill = await prisma.skills.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" } } });
    if (!existingSkill) {
      await prisma.skills.create({ data: { name: name.trim(), description: description || "" } });
    }

    return res.status(201).json({ success: true, skill: { skill_id: role.role_id, name: role.role_name, description: description || "" } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/skills/assignable — returns skills table IDs filtered to this business's roles
const getBusinessSkillsForAssignment = async (req, res) => {
  try {
    let branchIds = [];

    if (req.user.role === "manager") {
      const { data: link } = await supabaseAdmin
        .from("branch_managers")
        .select("branch_id")
        .eq("user_id", req.user.user_id)
        .limit(1)
        .maybeSingle();
      if (!link) return res.json({ success: true, skills: [] });
      branchIds = [link.branch_id];
    } else {
      const biz = await resolveBusinessId(req.user);
      if (!biz) return res.json({ success: true, skills: [] });
      const { data: branches } = await supabaseAdmin
        .from("branches")
        .select("branch_id")
        .eq("business_id", biz.business_id);
      branchIds = (branches || []).map(b => b.branch_id);
    }

    if (branchIds.length === 0) return res.json({ success: true, skills: [] });

    const { data: rows } = await supabaseAdmin
      .from("branch_skills")
      .select("skill_id, skills(skill_id, name, description)")
      .in("branch_id", branchIds);

    const seen = new Set();
    const skills = (rows || [])
      .map(r => r.skills)
      .filter(s => s && s.name && !seen.has(s.skill_id) && seen.add(s.skill_id))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.json({ success: true, skills });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteBusinessSkill = async (req, res) => {
  try {
    const roleId = Number(req.params.skill_id);
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { error } = await supabaseAdmin
      .from("business_roles")
      .delete()
      .eq("role_id", roleId)
      .eq("business_id", biz.business_id);
    if (error) throw new Error(error.message);

    return res.json({ success: true, message: "Skill deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Business settings & allocation preferences ──────────

const getBranchSettings = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const branch_id = req.params.branch_id;
    const { data: branch } = await supabaseAdmin.from("branches").select("branch_id, open_time, close_time").eq("branch_id", branch_id).eq("business_id", biz.business_id).maybeSingle();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const [{ data: settings }, { data: alloc }] = await Promise.all([
      supabaseAdmin.from("branch_settings").select("*").eq("branch_id", branch_id).maybeSingle(),
      supabaseAdmin.from("branch_allocation_preferences").select("*").eq("branch_id", branch_id).maybeSingle(),
    ]);

    const mergedSettings = settings
      ? { ...settings, open_time: branch.open_time || settings.open_time, close_time: branch.close_time || settings.close_time }
      : { open_time: branch.open_time, close_time: branch.close_time };

    return res.json({ success: true, settings: mergedSettings, allocation: alloc || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateBranchSettings = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const branch_id = req.params.branch_id;
    const { data: branch } = await supabaseAdmin.from("branches").select("branch_id, open_time, close_time").eq("branch_id", branch_id).eq("business_id", biz.business_id).maybeSingle();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const { operating_days, open_time, close_time, holidays, work_hours_day, max_work_hours_day, max_consecutive_days, allow_overtime, min_workers_per_assignment } = req.body;

    if (operating_days && !/^[01]{7}$/.test(operating_days)) {
      return res.status(400).json({ success: false, message: "operating_days must be a 7-character string of 0s and 1s." });
    }

    const upsertData = {
      branch_id: Number(branch_id),
      ...(operating_days !== undefined && { operating_days }),
      ...(holidays !== undefined && { holidays }),
      ...(work_hours_day !== undefined && { work_hours_day }),
      ...(max_work_hours_day !== undefined && { max_work_hours_day }),
      ...(max_consecutive_days !== undefined && { max_consecutive_days }),
      ...(allow_overtime !== undefined && { allow_overtime }),
      ...(min_workers_per_assignment !== undefined && { min_workers_per_assignment }),
      updated_at: new Date().toISOString(),
    };

    const ops = [
      supabaseAdmin.from("branch_settings").upsert(upsertData, { onConflict: "branch_id" }).select("*").single(),
    ];
    if (open_time !== undefined || close_time !== undefined) {
      ops.push(supabaseAdmin.from("branches").update({
        ...(open_time !== undefined && { open_time }),
        ...(close_time !== undefined && { close_time }),
      }).eq("branch_id", branch_id));
    }

    const [{ data, error }] = await Promise.all(ops);
    if (error) throw new Error(error.message);

    return res.json({ success: true, settings: { ...data, open_time: open_time ?? branch.open_time, close_time: close_time ?? branch.close_time } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateBranchAllocationPrefs = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const branch_id = req.params.branch_id;
    const { data: branch } = await supabaseAdmin.from("branches").select("branch_id").eq("branch_id", branch_id).eq("business_id", biz.business_id).maybeSingle();
    if (!branch) return res.status(404).json({ success: false, message: "Branch not found." });

    const { weight_availability, weight_skills, weight_attendance, weight_performance, weight_workload } = req.body;
    const total = (weight_availability || 0) + (weight_skills || 0) + (weight_attendance || 0) + (weight_performance || 0) + (weight_workload || 0);
    if (total !== 100) return res.status(400).json({ success: false, message: "Allocation weights must sum to 100." });

    const upsertData = {
      branch_id: Number(branch_id),
      weight_availability, weight_skills, weight_attendance, weight_performance, weight_workload,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from("branch_allocation_preferences").upsert(upsertData, { onConflict: "branch_id" }).select("*").single();
    if (error) throw new Error(error.message);

    return res.json({ success: true, allocation: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const getBusinessSettings = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const [{ data: settings }, { data: prefs }] = await Promise.all([
      supabaseAdmin.from("business_settings").select("*").eq("business_id", biz.business_id).maybeSingle(),
      supabaseAdmin.from("allocation_preferences").select("*").eq("business_id", biz.business_id).maybeSingle(),
    ]);

    return res.json({ success: true, settings: settings || null, allocation: prefs || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateBusinessSettings = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { operating_days, open_time, close_time, holidays, work_hours_day, max_work_hours_day, max_consecutive_days, allow_overtime, min_workers_per_assignment } = req.body;

    if (operating_days && !/^[01]{7}$/.test(operating_days)) {
      return res.status(400).json({ success: false, message: "operating_days must be a 7-character string of 0s and 1s." });
    }

    const updates = {};
    if (operating_days !== undefined) updates.operating_days = operating_days;
    if (open_time !== undefined) updates.open_time = open_time;
    if (close_time !== undefined) updates.close_time = close_time;
    if (holidays !== undefined) updates.holidays = holidays;
    if (work_hours_day !== undefined) updates.work_hours_day = work_hours_day;
    if (max_work_hours_day !== undefined) updates.max_work_hours_day = max_work_hours_day;
    if (max_consecutive_days !== undefined) updates.max_consecutive_days = max_consecutive_days;
    if (allow_overtime !== undefined) updates.allow_overtime = allow_overtime;
    if (min_workers_per_assignment !== undefined) updates.min_workers_per_assignment = min_workers_per_assignment;

    const { data, error } = await supabaseAdmin.from("business_settings").update(updates).eq("business_id", biz.business_id).select("*").single();
    if (error) throw new Error(error.message);

    return res.json({ success: true, settings: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAllocationPrefs = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const { weight_availability, weight_skills, weight_attendance, weight_performance, weight_workload } = req.body;
    const total = (weight_availability || 0) + (weight_skills || 0) + (weight_attendance || 0) + (weight_performance || 0) + (weight_workload || 0);
    if (total !== 100) return res.status(400).json({ success: false, message: "Allocation weights must sum to 100." });

    const updates = { weight_availability, weight_skills, weight_attendance, weight_performance, weight_workload };
    const { data, error } = await supabaseAdmin.from("allocation_preferences").update(updates).eq("business_id", biz.business_id).select("*").single();
    if (error) throw new Error(error.message);

    return res.json({ success: true, allocation: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/branch-skills-summary
const getBranchSkillsSummary = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.json({ success: true, branches: [] });

    const branches = await prisma.branches.findMany({
      where: { business_id: biz.business_id, deleted_at: null },
      orderBy: { name: "asc" },
      select: { branch_id: true, name: true },
    });

    const result = await Promise.all(branches.map(async (b) => {
      const { data: rows } = await supabaseAdmin
        .from("branch_skills")
        .select("skill_id, skills(skill_id, name, description)")
        .eq("branch_id", b.branch_id);

      const skills = (rows || [])
        .map(r => ({ skill_id: r.skills?.skill_id ?? r.skill_id, name: r.skills?.name, description: r.skills?.description }))
        .filter(s => s.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      return { branch_id: b.branch_id, name: b.name, skills };
    }));

    return res.json({ success: true, branches: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyBranches, createBranch, updateBranch, deleteBranch, getAllStaff, getAllManagers, getBranchStaff, getBranchManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, getStaffKpi, updateStaffDetail, deleteStaffDetail, getMyBusiness, updateMyBusinessPlan, getBranchSkills, createBranchSkill, updateBranchSkill, deleteBranchSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill, getBusinessSkillsForAssignment, getBranchSkillsSummary, getBusinessSettings, updateBusinessSettings, updateAllocationPrefs, getBranchSettings, updateBranchSettings, updateBranchAllocationPrefs };
