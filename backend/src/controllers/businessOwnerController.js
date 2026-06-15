const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

// ── Outlets ──────────────────────────────────────────────

// GET /api/business/outlets
const getMyOutlets = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, outlets: [] });

    const outlets = await prisma.outlets.findMany({ where: { business_id: biz.business_id }, orderBy: { outlet_id: "asc" } });
    return res.json({ success: true, outlets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/business/outlets
const createOutlet = async (req, res) => {
  try {
    const { name, address } = req.body;
    if (!name) return res.status(400).json({ success: false, message: "Outlet name is required." });

    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.status(404).json({ success: false, message: "Business not found for this owner." });

    const outlet = await prisma.outlets.create({ data: { name, address: address || null, business_id: biz.business_id } });
    return res.status(201).json({ success: true, outlet });
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

// ── Stats / consolidated report ───────────────────────────

// GET /api/business/stats
const getBusinessStats = async (req, res) => {
  try {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id, name").eq("owner_id", req.user.user_id).maybeSingle();
    if (!biz) return res.json({ success: true, stats: { outlets: 0, staff: 0, shifts: 0, business: null } });

    const outlets = await prisma.outlets.findMany({ where: { business_id: biz.business_id }, select: { outlet_id: true } });
    const outletIds = outlets.map(o => o.outlet_id);

    const [staffCount, shiftCount] = await Promise.all([
      outletIds.length ? prisma.staff.count({ where: { outlet_id: { in: outletIds }, is_active: true } }) : 0,
      outletIds.length ? prisma.shifts.count({ where: { outlet_id: { in: outletIds } } }) : 0,
    ]);

    return res.json({ success: true, stats: { business: biz.name, outlets: outletIds.length, staff: staffCount, shifts: shiftCount } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMyOutlets, createOutlet, getMyBusiness, getOutletSkills, createOutletSkill, deleteOutletSkill, getBusinessStats };
