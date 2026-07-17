const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { getLimits } = require("../utils/planLimits");

// Resolves business_id for both business owners and outlet managers
async function resolveBusinessId(user) {
  if (user.role === "business_owner") {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, industry").eq("owner_id", user.user_id).maybeSingle();
    return biz || null;
  }
  // outlet_manager: find their branch → business
  const { data: link } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", user.user_id).limit(1).maybeSingle();
  if (!link) return null;
  const outlet = await prisma.branches.findUnique({ where: { branch_id: link.branch_id }, select: { business_id: true } });
  if (!outlet) return null;
  const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, industry").eq("business_id", outlet.business_id).maybeSingle();
  return biz || null;
}

// ── Outlets ──────────────────────────────────────────────

// GET /api/business/outlets
const getMyOutlets = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, outlets: [] });

    const { data: outlets } = await supabaseAdmin
      .from("branches")
      .select("branch_id, name, address, business_id, open_time, close_time")
      .eq("business_id", biz.business_id)
      .order("branch_id");
    return res.json({ success: true, outlets: outlets || [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/business/outlets
const createOutlet = async (req, res) => {
  try {
    const { name, address, open_time, close_time, role_templates } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Outlet name is required." });

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, plan").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    // Enforce outlet limit
    const limits = getLimits(biz.plan);
    if (limits.outlets !== Infinity) {
      const { count } = await supabaseAdmin.from("branches").select("*", { count: "exact", head: true }).eq("business_id", biz.business_id);
      if ((count || 0) >= limits.outlets) {
        return res.status(403).json({
          success: false,
          limitReached: true,
          limitType: "outlets",
          plan: biz.plan,
          message: `Your ${biz.plan} plan allows ${limits.outlets} outlet${limits.outlets === 1 ? "" : "s"}. Upgrade to add more.`,
        });
      }
    }

    const { data: outlet, error: outletErr } = await supabaseAdmin
      .from("branches")
      .insert({ name, address: address || null, business_id: biz.business_id, open_time: open_time || "08:00:00", close_time: close_time || "22:00:00" })
      .select()
      .single();
    if (outletErr) throw new Error(outletErr.message);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const filtered = role_templates.filter(r => r.role_name?.trim());
      const allSkills = await prisma.skills.findMany({ select: { skill_id: true, name: true } });
      const skillByName = Object.fromEntries(allSkills.map(s => [s.name.toLowerCase(), s.skill_id]));
      const rows = filtered.map(r => ({
        branch_id: outlet.branch_id,
        role_name: r.role_name.trim(),
        skill_id: skillByName[r.role_name.trim().toLowerCase()] || null,
        headcount: Number(r.headcount) || 1,
      }));
      if (rows.length > 0) await supabaseAdmin.from("branch_role_templates").insert(rows);
    }

    return res.status(201).json({ success: true, outlet });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/staff
const getAllStaff = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, staff: [] });

    const outlets = await prisma.branches.findMany({ where: { business_id: biz.business_id }, select: { branch_id: true, name: true } });
    const outletIds = outlets.map(o => o.branch_id);
    if (outletIds.length === 0) return res.json({ success: true, staff: [] });

    const staff = await prisma.staff.findMany({
      where: { branch_id: { in: outletIds } },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
      orderBy: { staff_id: "asc" },
    });

    const outletNameById = Object.fromEntries(outlets.map(o => [o.branch_id, o.name]));
    const enriched = staff.map(s => ({ ...s, outlet_name: outletNameById[s.branch_id] }));

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

    const outlets = await prisma.branches.findMany({ where: { business_id: biz.business_id }, select: { branch_id: true, name: true } });
    const outletIds = outlets.map(o => o.branch_id);
    if (outletIds.length === 0) return res.json({ success: true, managers: [] });

    const { data: links } = await supabaseAdmin.from("branch_managers").select("user_id, branch_id, is_primary").in("branch_id", outletIds);
    const userIds = [...new Set((links || []).map(l => l.user_id))];
    if (userIds.length === 0) return res.json({ success: true, managers: [] });

    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, full_name: true, email: true, is_active: true },
    });

    const outletNameById = Object.fromEntries(outlets.map(o => [o.branch_id, o.name]));
    const usersById = Object.fromEntries(users.map(u => [u.user_id, u]));

    const managers = (links || [])
      .filter(l => usersById[l.user_id])
      .map(l => ({
        ...usersById[l.user_id],
        branch_id: l.branch_id,
        outlet_name: outletNameById[l.branch_id],
        is_primary: l.is_primary,
      }));

    return res.json({ success: true, managers });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/outlets/:outlet_id/staff
const getOutletStaff = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.branches.findUnique({ where: { branch_id: outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const staff = await prisma.staff.findMany({
      where: { branch_id: outlet_id },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
      orderBy: { staff_id: "asc" },
    });
    return res.json({ success: true, staff });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/outlets/:outlet_id/managers
const getOutletManagers = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.branches.findUnique({ where: { branch_id: outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const { data: links } = await supabaseAdmin.from("branch_managers").select("user_id, is_primary").eq("branch_id", outlet_id);
    const userIds = (links || []).map(l => l.user_id);
    if (userIds.length === 0) return res.json({ success: true, managers: [] });

    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, full_name: true, email: true },
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

  const outlet = await prisma.branches.findUnique({ where: { branch_id: link.branch_id } });
  if (!outlet || outlet.business_id !== biz.business_id) return null;

  return { ...link, outlet };
}

// GET /api/business/managers/:user_id
const getManagerDetail = async (req, res) => {
  try {
    const user_id = Number(req.params.user_id);
    const link = await getOwnedManagerLinkOrNull(req, user_id);
    if (!link) return res.status(404).json({ success: false, message: "Manager not found." });

    const manager = await prisma.users.findUnique({
      where: { user_id },
      select: { user_id: true, full_name: true, email: true, is_active: true, created_at: true },
    });
    if (!manager) return res.status(404).json({ success: false, message: "Manager not found." });

    return res.json({ success: true, manager, outlet: link.outlet, is_primary: link.is_primary });
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
      select: { user_id: true, full_name: true, email: true, is_active: true, created_at: true },
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

// PATCH /api/business/outlets/:outlet_id
const updateOutlet = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const { name, address, open_time, close_time, working_days } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Outlet name is required." });
    if (working_days !== undefined && ![5, 6, 7].includes(Number(working_days))) {
      return res.status(400).json({ success: false, message: "working_days must be 5, 6, or 7." });
    }

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.branches.findUnique({ where: { branch_id: outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("branches")
      .update({ name, address: address || null, open_time: open_time || outlet.open_time, close_time: close_time || outlet.close_time, ...(working_days !== undefined && { working_days: Number(working_days) }) })
      .eq("branch_id", outlet_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return res.json({ success: true, outlet: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/business/outlets/:outlet_id/role-templates
const getRoleTemplates = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const { data, error } = await supabaseAdmin
      .from("branch_role_templates")
      .select("*, skills(skill_id, name)")
      .eq("branch_id", outlet_id)
      .order("template_id");
    if (error) throw new Error(error.message);
    return res.json({ success: true, templates: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/business/outlets/:outlet_id/role-templates  (replace all)
const upsertRoleTemplates = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const { role_templates } = req.body;

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    await supabaseAdmin.from("branch_role_templates").delete().eq("branch_id", outlet_id);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const filtered = role_templates.filter(r => r.role_name?.trim());
      const allSkills = await prisma.skills.findMany({ select: { skill_id: true, name: true } });
      const skillByName = Object.fromEntries(allSkills.map(s => [s.name.toLowerCase(), s.skill_id]));
      const rows = filtered.map(r => ({
        branch_id: outlet_id,
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

// DELETE /api/business/outlets/:outlet_id
const deleteOutlet = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.branches.findUnique({ where: { branch_id: outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    await prisma.branches.delete({ where: { branch_id: outlet_id } });
    return res.json({ success: true, message: "Outlet deleted." });
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
    include: { users: { select: { user_id: true, full_name: true, email: true, role: true } }, branches: true },
  });
  if (!staff || staff.branches.business_id !== biz.business_id) return null;
  return staff;
}

// GET /api/business/staff/:staff_id/kpi
const getStaffKpi = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const assignments = await prisma.task_assignments.findMany({
      where: { staff_id },
      include: {
        attendance: true,
        shifts: { select: { shift_date: true, start_time: true } },
      },
    });

    const totalAssigned = assignments.length;
    let present = 0, absent = 0, late = 0, totalMinutes = 0;

    for (const a of assignments) {
      const att = a.attendance[0];
      if (!att) continue;
      const status = (att.status || "").toLowerCase();
      if (status === "present" || status === "attended") present++;
      else if (status === "absent") absent++;
      if (status === "late") late++;
      if (att.clock_in && att.clock_out) {
        totalMinutes += (new Date(att.clock_out) - new Date(att.clock_in)) / 60000;
      }
    }

    const attendanceRate = totalAssigned > 0 ? Math.round((present / totalAssigned) * 100) : null;
    const totalHours = Math.round(totalMinutes / 6) / 10;

    return res.json({
      success: true,
      kpi: { totalAssigned, present, absent, late, attendanceRate, totalHours },
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
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
    });

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

// ── Skill tags scoped to outlet ───────────────────────────

// GET /api/business/outlets/:outlet_id/skills
const getOutletSkills = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const skills = await prisma.skills.findMany({ where: { branch_id: outlet_id }, orderBy: { name: "asc" } });
    return res.json({ success: true, skills });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/business/outlets/:outlet_id/skills
const createOutletSkill = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Skill name is required." });

    const skill = await prisma.skills.create({ data: { name, description: description || null, branch_id: outlet_id, created_by: req.user.user_id } });
    return res.status(201).json({ success: true, skill });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ success: false, message: "A skill with this name already exists for this outlet." });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// PATCH /api/business/outlets/:outlet_id/skills/:skill_id
const updateOutletSkill = async (req, res) => {
  try {
    const skill_id = Number(req.params.skill_id);
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Skill name is required." });

    const skill = await prisma.skills.update({ where: { skill_id }, data: { name, description: description || null } });
    return res.json({ success: true, skill });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ success: false, message: "A skill with this name already exists for this outlet." });
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /api/business/outlets/:outlet_id/skills/:skill_id
const deleteOutletSkill = async (req, res) => {
  try {
    const skill_id = Number(req.params.skill_id);
    // Cascade: remove all staff assignments for this skill before deleting the skill itself
    await supabaseAdmin.from("user_skill_tags").delete().eq("skill_id", skill_id);
    await prisma.skills.delete({ where: { skill_id } });
    return res.json({ success: true, message: "Skill deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Stats / consolidated report ───────────────────────────

// GET /api/business/stats
const getBusinessStats = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, name").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, outlets_count: 0, staff_count: 0, shifts_count: 0, active_invites: 0 });

    const outlets = await prisma.branches.findMany({ where: { business_id: biz.business_id }, select: { branch_id: true } });
    const outletIds = outlets.map(o => o.branch_id);

    const [staffCount, shiftCount, inviteCount] = await Promise.all([
      outletIds.length ? prisma.staff.count({ where: { branch_id: { in: outletIds }, is_active: true } }) : 0,
      outletIds.length ? prisma.shifts.count({ where: { branch_id: { in: outletIds } } }) : 0,
      prisma.invitations.count({ where: { invited_by: req.user.user_id, status: "pending" } }),
    ]);

    return res.json({
      success: true,
      outlets_count: outletIds.length,
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
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.json({ success: true, skills: [] });

    const { data: roles } = await supabaseAdmin
      .from("business_roles")
      .select("role_name")
      .eq("business_id", biz.business_id)
      .order("role_name", { ascending: true });

    if (!roles || roles.length === 0) return res.json({ success: true, skills: [] });

    const roleNames = roles.map(r => r.role_name);
    const skills = await prisma.skills.findMany({
      where: { name: { in: roleNames } },
      select: { skill_id: true, name: true },
      orderBy: { name: "asc" },
    });

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

const getOutletSettings = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const outlet_id = req.params.outlet_id;
    const { data: outlet } = await supabaseAdmin.from("branches").select("branch_id").eq("branch_id", outlet_id).eq("business_id", biz.business_id).maybeSingle();
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found." });

    const [{ data: settings }, { data: alloc }] = await Promise.all([
      supabaseAdmin.from("branch_settings").select("*").eq("branch_id", outlet_id).maybeSingle(),
      supabaseAdmin.from("branch_allocation_preferences").select("*").eq("branch_id", outlet_id).maybeSingle(),
    ]);

    return res.json({ success: true, settings: settings || null, allocation: alloc || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateOutletSettings = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const outlet_id = req.params.outlet_id;
    const { data: outlet } = await supabaseAdmin.from("branches").select("branch_id").eq("branch_id", outlet_id).eq("business_id", biz.business_id).maybeSingle();
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found." });

    const { operating_days, holidays, work_hours_day, max_work_hours_day, max_consecutive_days, allow_overtime, min_workers_per_assignment } = req.body;

    if (operating_days && !/^[01]{7}$/.test(operating_days)) {
      return res.status(400).json({ success: false, message: "operating_days must be a 7-character string of 0s and 1s." });
    }

    const upsertData = {
      branch_id: Number(outlet_id),
      ...(operating_days !== undefined && { operating_days }),
      ...(holidays !== undefined && { holidays }),
      ...(work_hours_day !== undefined && { work_hours_day }),
      ...(max_work_hours_day !== undefined && { max_work_hours_day }),
      ...(max_consecutive_days !== undefined && { max_consecutive_days }),
      ...(allow_overtime !== undefined && { allow_overtime }),
      ...(min_workers_per_assignment !== undefined && { min_workers_per_assignment }),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from("branch_settings").upsert(upsertData, { onConflict: "branch_id" }).select("*").single();
    if (error) throw new Error(error.message);

    return res.json({ success: true, settings: data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateOutletAllocationPrefs = async (req, res) => {
  try {
    const biz = await resolveBusinessId(req.user);
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const outlet_id = req.params.outlet_id;
    const { data: outlet } = await supabaseAdmin.from("branches").select("branch_id").eq("branch_id", outlet_id).eq("business_id", biz.business_id).maybeSingle();
    if (!outlet) return res.status(404).json({ success: false, message: "Outlet not found." });

    const { weight_availability, weight_skills, weight_attendance, weight_performance, weight_workload } = req.body;
    const total = (weight_availability || 0) + (weight_skills || 0) + (weight_attendance || 0) + (weight_performance || 0) + (weight_workload || 0);
    if (total !== 100) return res.status(400).json({ success: false, message: "Allocation weights must sum to 100." });

    const upsertData = {
      branch_id: Number(outlet_id),
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

module.exports = { getMyOutlets, createOutlet, updateOutlet, deleteOutlet, getAllStaff, getAllManagers, getOutletStaff, getOutletManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, getStaffKpi, updateStaffDetail, deleteStaffDetail, getMyBusiness, getOutletSkills, createOutletSkill, updateOutletSkill, deleteOutletSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill, getBusinessSkillsForAssignment, getBusinessSettings, updateBusinessSettings, updateAllocationPrefs, getOutletSettings, updateOutletSettings, updateOutletAllocationPrefs };
