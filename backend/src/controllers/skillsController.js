const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

// Resolve business_id + outlet_id from the calling user
async function getCtx(user) {
  if (user.role === "business_owner") {
    const { data: biz } = await supabaseAdmin.from("businesses").select("business_id").eq("owner_id", user.user_id).maybeSingle();
    return biz ? { business_id: biz.business_id, outlet_id: null } : null;
  }
  // outlet_manager or other staff — check staff table first, then outlet_managers
  const staff = await prisma.staff.findFirst({ where: { user_id: user.user_id }, select: { outlet_id: true } });
  const outlet_id = staff?.outlet_id || (() => null)();
  if (!outlet_id) {
    const { data: om } = await supabaseAdmin.from("outlet_managers").select("outlet_id").eq("user_id", user.user_id).maybeSingle();
    if (!om?.outlet_id) return null;
    const { data: o } = await supabaseAdmin.from("outlets").select("business_id").eq("outlet_id", om.outlet_id).maybeSingle();
    return o ? { business_id: o.business_id, outlet_id: om.outlet_id } : null;
  }
  const { data: o } = await supabaseAdmin.from("outlets").select("business_id").eq("outlet_id", outlet_id).maybeSingle();
  return o ? { business_id: o.business_id, outlet_id } : null;
}

// ── Business skill library ────────────────────────────────────────────────────

const getBusinessSkills = async (req, res) => {
  try {
    const ctx = await getCtx(req.user);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
    const { data, error } = await supabaseAdmin
      .from("business_skills")
      .select("*")
      .eq("business_id", ctx.business_id)
      .order("name");
    if (error) throw error;
    res.json({ success: true, skills: data || [] });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createBusinessSkill = async (req, res) => {
  try {
    const ctx = await getCtx(req.user);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
    const { name, color = "#6366F1" } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Skill name required" });
    const { data, error } = await supabaseAdmin
      .from("business_skills")
      .insert({ business_id: ctx.business_id, name: name.trim(), color })
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, skill: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateBusinessSkill = async (req, res) => {
  try {
    const ctx = await getCtx(req.user);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
    const { skill_id } = req.params;
    const { name, color } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (color !== undefined) updates.color = color;
    const { data, error } = await supabaseAdmin
      .from("business_skills")
      .update(updates)
      .eq("skill_id", skill_id)
      .eq("business_id", ctx.business_id)
      .select()
      .single();
    if (error) throw error;
    res.json({ success: true, skill: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteBusinessSkill = async (req, res) => {
  try {
    const ctx = await getCtx(req.user);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
    const { skill_id } = req.params;
    const { error } = await supabaseAdmin
      .from("business_skills")
      .delete()
      .eq("skill_id", skill_id)
      .eq("business_id", ctx.business_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Staff skill assignment ─────────────────────────────────────────────────────

const getStaffSkills = async (req, res) => {
  try {
    const { staff_id } = req.params;
    // Step 1: get staff_skill rows
    const { data: rows, error } = await supabaseAdmin
      .from("staff_skills")
      .select("id, skill_id, experience_level, years_of_experience")
      .eq("staff_id", staff_id)
      .order("id");
    if (error) throw error;
    if (!rows || rows.length === 0) return res.json({ success: true, skills: [] });
    // Step 2: look up skill names via Prisma skills table
    const skillIds = rows.map(r => r.skill_id);
    const skillRecords = await prisma.skills.findMany({ where: { skill_id: { in: skillIds } }, select: { skill_id: true, name: true } });
    const nameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));
    const skills = rows.map(r => ({
      id: r.id,
      skill_id: r.skill_id,
      name: nameMap[r.skill_id] || null,
      experience_level: r.experience_level,
      years_of_experience: r.years_of_experience,
    })).filter(r => r.name);
    res.json({ success: true, skills });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const addStaffSkill = async (req, res) => {
  try {
    const { staff_id } = req.params;
    const { skill_id, experience_level, years_of_experience } = req.body;
    if (!skill_id) return res.status(400).json({ success: false, message: "skill_id required" });
    const sid = Number(staff_id);
    const skid = Number(skill_id);
    const row = {
      staff_id: sid,
      skill_id: skid,
      experience_level: experience_level || null,
      years_of_experience: years_of_experience !== undefined && years_of_experience !== "" ? Number(years_of_experience) : null,
    };
    // upsert the row
    const { error: upsertErr } = await supabaseAdmin
      .from("staff_skills")
      .upsert(row, { onConflict: "staff_id,skill_id" });
    if (upsertErr) throw upsertErr;
    // fetch back without join
    const { data, error: fetchErr } = await supabaseAdmin
      .from("staff_skills")
      .select("id, skill_id, experience_level, years_of_experience")
      .eq("staff_id", sid)
      .eq("skill_id", skid)
      .single();
    if (fetchErr) throw fetchErr;
    const skillRecord = await prisma.skills.findUnique({ where: { skill_id: skid }, select: { name: true } });
    res.json({ success: true, skill: {
      id: data.id, skill_id: data.skill_id,
      name: skillRecord?.name || null,
      experience_level: data.experience_level, years_of_experience: data.years_of_experience,
    }});
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeStaffSkill = async (req, res) => {
  try {
    const { staff_id, skill_id } = req.params;
    const { error } = await supabaseAdmin
      .from("staff_skills")
      .delete()
      .eq("staff_id", staff_id)
      .eq("skill_id", skill_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getBusinessSkills, createBusinessSkill, updateBusinessSkill, deleteBusinessSkill,
  getStaffSkills, addStaffSkill, removeStaffSkill,
};
