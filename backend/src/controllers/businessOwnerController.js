const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { getLimits } = require("../utils/planLimits");

// ── Outlets ──────────────────────────────────────────────

// GET /api/business/outlets
const getMyOutlets = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, outlets: [] });

    const { data: outlets } = await supabaseAdmin
      .from("outlets")
      .select("outlet_id, name, address, business_id, open_time, close_time")
      .eq("business_id", biz.business_id)
      .order("outlet_id");
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
      const { count } = await supabaseAdmin.from("outlets").select("*", { count: "exact", head: true }).eq("business_id", biz.business_id);
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
      .from("outlets")
      .insert({ name, address: address || null, business_id: biz.business_id, open_time: open_time || "08:00:00", close_time: close_time || "22:00:00" })
      .select()
      .single();
    if (outletErr) throw new Error(outletErr.message);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const rows = role_templates
        .filter(r => r.role_name?.trim())
        .map(r => ({ outlet_id: outlet.outlet_id, role_name: r.role_name.trim(), skill_id: r.skill_id || null, headcount: Number(r.headcount) || 1, min_experience_level: r.min_experience_level || "beginner" }));
      if (rows.length > 0) await supabaseAdmin.from("outlet_role_templates").insert(rows);
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

    const outlets = await prisma.outlets.findMany({ where: { business_id: biz.business_id }, select: { outlet_id: true, name: true } });
    const outletIds = outlets.map(o => o.outlet_id);
    if (outletIds.length === 0) return res.json({ success: true, staff: [] });

    const staff = await prisma.staff.findMany({
      where: { outlet_id: { in: outletIds } },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
      orderBy: { staff_id: "asc" },
    });

    const outletNameById = Object.fromEntries(outlets.map(o => [o.outlet_id, o.name]));
    const enriched = staff.map(s => ({ ...s, outlet_name: outletNameById[s.outlet_id] }));

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

    const outlets = await prisma.outlets.findMany({ where: { business_id: biz.business_id }, select: { outlet_id: true, name: true } });
    const outletIds = outlets.map(o => o.outlet_id);
    if (outletIds.length === 0) return res.json({ success: true, managers: [] });

    const { data: links } = await supabaseAdmin.from("outlet_managers").select("user_id, outlet_id, is_primary").in("outlet_id", outletIds);
    const userIds = [...new Set((links || []).map(l => l.user_id))];
    if (userIds.length === 0) return res.json({ success: true, managers: [] });

    const users = await prisma.users.findMany({
      where: { user_id: { in: userIds } },
      select: { user_id: true, full_name: true, email: true, is_active: true },
    });

    const outletNameById = Object.fromEntries(outlets.map(o => [o.outlet_id, o.name]));
    const usersById = Object.fromEntries(users.map(u => [u.user_id, u]));

    const managers = (links || [])
      .filter(l => usersById[l.user_id])
      .map(l => ({
        ...usersById[l.user_id],
        outlet_id: l.outlet_id,
        outlet_name: outletNameById[l.outlet_id],
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

    const outlet = await prisma.outlets.findUnique({ where: { outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const staff = await prisma.staff.findMany({
      where: { outlet_id },
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

    const outlet = await prisma.outlets.findUnique({ where: { outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const { data: links } = await supabaseAdmin.from("outlet_managers").select("user_id, is_primary").eq("outlet_id", outlet_id);
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

  const { data: link } = await supabaseAdmin.from("outlet_managers").select("outlet_id, is_primary").eq("user_id", user_id).maybeSingle();
  if (!link) return null;

  const outlet = await prisma.outlets.findUnique({ where: { outlet_id: link.outlet_id } });
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
    const { name, address, open_time, close_time } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Outlet name is required." });

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.outlets.findUnique({ where: { outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    const { data: updated, error } = await supabaseAdmin
      .from("outlets")
      .update({ name, address: address || null, open_time: open_time || outlet.open_time, close_time: close_time || outlet.close_time })
      .eq("outlet_id", outlet_id)
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
      .from("outlet_role_templates")
      .select("*, skills(skill_id, name)")
      .eq("outlet_id", outlet_id)
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

    await supabaseAdmin.from("outlet_role_templates").delete().eq("outlet_id", outlet_id);

    if (Array.isArray(role_templates) && role_templates.length > 0) {
      const rows = role_templates
        .filter(r => r.role_name?.trim())
        .map(r => ({ outlet_id, role_name: r.role_name.trim(), skill_id: r.skill_id || null, headcount: Number(r.headcount) || 1, min_experience_level: r.min_experience_level || "beginner" }));
      if (rows.length > 0) await supabaseAdmin.from("outlet_role_templates").insert(rows);
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

    const outlet = await prisma.outlets.findUnique({ where: { outlet_id } });
    if (!outlet || outlet.business_id !== biz.business_id) {
      return res.status(404).json({ success: false, message: "Outlet not found." });
    }

    await prisma.outlets.delete({ where: { outlet_id } });
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
    include: { users: { select: { user_id: true, full_name: true, email: true, role: true } }, outlets: true },
  });
  if (!staff || staff.outlets.business_id !== biz.business_id) return null;
  return staff;
}

// GET /api/business/staff/:staff_id
const getStaffDetail = async (req, res) => {
  try {
    const staff_id = Number(req.params.staff_id);
    const staff = await getOwnedStaffOrNull(req, staff_id);
    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found." });

    const { data: biz2 } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    const [allSkills, assignedTags] = await Promise.all([
      prisma.skills.findMany({ where: { business_id: biz2?.business_id ?? -1 }, orderBy: { name: "asc" } }),
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

// GET /api/business/context — returns industry/mode/labels for the current user's business
// Works for business owners (direct lookup) and staff/managers (via outlet → business chain)
const getMyBusinessContext = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const role   = req.user.role;
    let biz = null;

    if (role === "business_owner") {
      const { data } = await supabaseAdmin
        .from("businesses")
        .select("industry, scheduling_mode, location_label, staff_label, plan")
        .eq("owner_id", userId)
        .maybeSingle();
      biz = data;
    } else {
      // staff / manager: user → staff row → outlet → business
      const { data: staffRow } = await supabaseAdmin
        .from("staff")
        .select("outlet_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (staffRow?.outlet_id) {
        const { data: outlet } = await supabaseAdmin
          .from("outlets")
          .select("business_id")
          .eq("outlet_id", staffRow.outlet_id)
          .maybeSingle();

        if (outlet?.business_id) {
          const { data } = await supabaseAdmin
            .from("businesses")
            .select("industry, scheduling_mode, location_label, staff_label, plan")
            .eq("business_id", outlet.business_id)
            .maybeSingle();
          biz = data;
        }
      }
    }

    return res.json({ success: true, context: biz || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Skill tags scoped to outlet ───────────────────────────

// GET /api/business/outlets/:outlet_id/skills
const getOutletSkills = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const skills = await prisma.skills.findMany({ where: { outlet_id }, orderBy: { name: "asc" } });
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

    const skill = await prisma.skills.create({ data: { name, description: description || null, outlet_id, created_by: req.user.user_id } });
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
    await prisma.skills.delete({ where: { skill_id } });
    return res.json({ success: true, message: "Skill deleted." });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── Business-level skills (not tied to an outlet) ────────────────────────────

// GET /api/business/skills  — returns business skills + catalog suggestions for their industry
const getBusinessSkills = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, industry").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });

    const [businessSkills, catalogSkills] = await Promise.all([
      prisma.skills.findMany({ where: { business_id: biz.business_id }, orderBy: { name: "asc" } }),
      prisma.skills.findMany({ where: { is_catalog: true, industry_type: biz.industry || "other" }, orderBy: { name: "asc" } }),
    ]);

    // Suggestions = catalog skills not yet added to business
    const businessNames = new Set(businessSkills.map(s => s.name.toLowerCase()));
    const suggestions = catalogSkills.filter(s => !businessNames.has(s.name.toLowerCase()));

    return res.json({ success: true, skills: businessSkills, suggestions, industry: biz.industry });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// POST /api/business/skills
const createBusinessSkill = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found." });
    const { name, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Skill name is required." });
    const skill = await prisma.skills.create({ data: { name: name.trim(), description: description || null, business_id: biz.business_id, created_by: req.user.user_id } });
    return res.status(201).json({ success: true, skill });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ success: false, message: "This skill already exists for your business." });
    return res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/business/skills/:skill_id
const deleteBusinessSkill = async (req, res) => {
  try {
    await prisma.skills.delete({ where: { skill_id: Number(req.params.skill_id) } });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

// ── Stats / consolidated report ───────────────────────────

// GET /api/business/stats — mode-aware: returns stats + today's overview + alerts
const getBusinessStats = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin
      .from("businesses")
      .select("business_id, scheduling_mode, industry")
      .eq("owner_id", req.user.user_id)
      .maybeSingle();

    if (!biz) return res.json({ success: true, mode: "shift", outlets_count: 0, staff_count: 0, alerts: [], today_overview: [] });

    const outlets = await prisma.outlets.findMany({ where: { business_id: biz.business_id }, select: { outlet_id: true, name: true } });
    const outletIds = outlets.map(o => o.outlet_id);
    const mode = biz.scheduling_mode || "shift";

    const staffCount = outletIds.length
      ? await prisma.staff.count({ where: { outlet_id: { in: outletIds }, is_active: true } })
      : 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let extra = {};
    let alerts = [];

    // ── SHIFT MODE ────────────────────────────────────────
    if (mode === "shift") {
      const todayShifts = outletIds.length
        ? await prisma.shifts.count({ where: { outlet_id: { in: outletIds }, shift_date: { gte: today, lt: tomorrow } } })
        : 0;

      let understaffedCount = 0;
      let todayOverview = [];

      if (outletIds.length) {
        const overviewRows = await prisma.$queryRaw`
          SELECT o.outlet_id, o.name,
                 COUNT(DISTINCT s.shift_id)::int AS total_shifts,
                 COALESCE(SUM(sr.headcount), 0)::int AS required_staff,
                 COUNT(sa.assignment_id) FILTER (WHERE sa.status != 'removed')::int AS assigned_staff
          FROM outlets o
          LEFT JOIN shifts s
            ON s.outlet_id = o.outlet_id
           AND s.shift_date >= ${today} AND s.shift_date < ${tomorrow}
          LEFT JOIN shift_roles sr ON sr.shift_id = s.shift_id
          LEFT JOIN shift_assignments sa ON sa.role_id = sr.role_id
          WHERE o.outlet_id = ANY(${outletIds}::int[])
          GROUP BY o.outlet_id, o.name
          ORDER BY o.name
        `;

        todayOverview = overviewRows.map(r => ({
          name: r.name,
          total_shifts: Number(r.total_shifts),
          required: Number(r.required_staff),
          assigned: Number(r.assigned_staff),
        }));

        const understaffedRows = await prisma.$queryRaw`
          SELECT s.shift_id, COALESCE(s.title,'Shift') AS title, o.name AS outlet_name
          FROM shifts s
          JOIN outlets o ON o.outlet_id = s.outlet_id
          JOIN shift_roles sr ON sr.shift_id = s.shift_id
          LEFT JOIN shift_assignments sa
            ON sa.role_id = sr.role_id AND sa.status != 'removed'
          WHERE s.outlet_id = ANY(${outletIds}::int[])
            AND s.shift_date >= ${today} AND s.shift_date < ${tomorrow}
            AND s.status = 'published'
          GROUP BY s.shift_id, s.title, o.name
          HAVING COUNT(sa.assignment_id) < SUM(sr.headcount)
        `;

        understaffedCount = understaffedRows.length;
        if (understaffedCount > 0) {
          alerts.push({
            type: "warning",
            message: `${understaffedCount} shift${understaffedCount > 1 ? "s" : ""} understaffed today`,
            link: "/outlet-manager/schedule",
            items: understaffedRows.map(r => ({ label: r.title, sub: r.outlet_name })),
          });
        }
      }

      extra = { today_shifts: todayShifts, understaffed_count: understaffedCount, today_overview: todayOverview };

    // ── FLEXIBLE MODE ─────────────────────────────────────
    } else if (mode === "flexible") {
      const [activeProjects, pendingTimesheets] = await Promise.all([
        prisma.projects.count({ where: { business_id: biz.business_id, status: "active" } }),
        outletIds.length
          ? prisma.timesheets.count({ where: { staff: { outlet_id: { in: outletIds } }, status: "pending" } })
          : 0,
      ]);

      const stalledProjects = await prisma.projects.findMany({
        where: { business_id: biz.business_id, status: "active", end_date: { lt: today } },
        select: { project_id: true, name: true, end_date: true },
        take: 5,
        orderBy: { end_date: "asc" },
      });

      if (stalledProjects.length > 0) {
        alerts.push({
          type: "warning",
          message: `${stalledProjects.length} project${stalledProjects.length > 1 ? "s" : ""} past deadline`,
          link: "/business-owner/projects",
          items: stalledProjects.map(p => ({ label: p.name, sub: `Due ${new Date(p.end_date).toLocaleDateString("en-SG")}` })),
        });
      }
      if (pendingTimesheets > 0) {
        alerts.push({
          type: "info",
          message: `${pendingTimesheets} timesheet${pendingTimesheets > 1 ? "s" : ""} awaiting approval`,
          link: "/business-owner/timesheets",
        });
      }

      const projectOverview = await prisma.projects.findMany({
        where: { business_id: biz.business_id },
        select: { project_id: true, name: true, status: true, end_date: true },
        orderBy: { start_date: "desc" },
        take: 6,
      });

      extra = { active_projects: activeProjects, pending_timesheets: pendingTimesheets, project_overview: projectOverview };

    // ── APPOINTMENT MODE ──────────────────────────────────
    } else if (mode === "appointment") {
      const [todayBookings, unassignedCount] = await Promise.all([
        outletIds.length
          ? prisma.bookings.count({ where: { outlet_id: { in: outletIds }, booking_date: { gte: today, lt: tomorrow } } })
          : 0,
        outletIds.length
          ? prisma.bookings.count({ where: { outlet_id: { in: outletIds }, assigned_staff_id: null, booking_date: { gte: today } } })
          : 0,
      ]);

      if (unassignedCount > 0) {
        alerts.push({
          type: "warning",
          message: `${unassignedCount} upcoming booking${unassignedCount > 1 ? "s" : ""} unassigned`,
          link: "/business-owner/bookings",
        });
      }

      const bookingOverview = outletIds.length
        ? await prisma.bookings.findMany({
            where: { outlet_id: { in: outletIds }, booking_date: { gte: today, lt: tomorrow } },
            select: {
              booking_id: true, customer_name: true, start_time: true, end_time: true,
              assigned_staff_id: true, status: true,
              services: { select: { name: true } },
            },
            orderBy: { start_time: "asc" },
            take: 8,
          })
        : [];

      extra = { today_bookings: todayBookings, unassigned_bookings: unassignedCount, booking_overview: bookingOverview };
    }

    return res.json({
      success: true,
      mode,
      industry: biz.industry,
      outlets_count: outletIds.length,
      staff_count: staffCount,
      alerts,
      ...extra,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyOutlets, createOutlet, updateOutlet, deleteOutlet, getAllStaff, getAllManagers, getOutletStaff, getOutletManagers, getManagerDetail, updateManagerDetail, deleteManagerDetail, getStaffDetail, updateStaffDetail, deleteStaffDetail, getMyBusiness, getMyBusinessContext, getOutletSkills, createOutletSkill, updateOutletSkill, deleteOutletSkill, getBusinessStats, getRoleTemplates, upsertRoleTemplates, getBusinessSkills, createBusinessSkill, deleteBusinessSkill };
