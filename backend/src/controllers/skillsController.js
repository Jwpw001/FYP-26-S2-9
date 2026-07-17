const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

// ── Staff skill assignment ─────────────────────────────────────────────────────

async function resolveUserId(staff_id) {
  const staff = await prisma.staff.findUnique({ where: { staff_id: Number(staff_id) }, select: { user_id: true } });
  return staff?.user_id ?? null;
}

const getStaffSkills = async (req, res) => {
  try {
    const { staff_id } = req.params;
    const user_id = await resolveUserId(staff_id);
    if (!user_id) return res.status(404).json({ success: false, message: "Staff not found." });

    const { data: rows, error } = await supabaseAdmin
      .from("user_skill_tags")
      .select("id, skill_id, experience_level, years_of_experience")
      .eq("user_id", user_id)
      .order("id");
    if (error) throw error;
    if (!rows || rows.length === 0) return res.json({ success: true, skills: [] });

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
    const user_id = await resolveUserId(staff_id);
    if (!user_id) return res.status(404).json({ success: false, message: "Staff not found." });
    const skid = Number(skill_id);
    const row = {
      user_id,
      skill_id: skid,
      experience_level: experience_level || null,
      years_of_experience: years_of_experience !== undefined && years_of_experience !== "" ? Number(years_of_experience) : null,
    };
    // upsert the row
    const { error: upsertErr } = await supabaseAdmin
      .from("user_skill_tags")
      .upsert(row, { onConflict: "user_id,skill_id" });
    if (upsertErr) throw upsertErr;
    // fetch back without join
    const { data, error: fetchErr } = await supabaseAdmin
      .from("user_skill_tags")
      .select("id, skill_id, experience_level, years_of_experience")
      .eq("user_id", user_id)
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

const updateStaffSkill = async (req, res) => {
  try {
    const { staff_id, skill_id } = req.params;
    const { experience_level, years_of_experience } = req.body;
    const user_id = await resolveUserId(staff_id);
    if (!user_id) return res.status(404).json({ success: false, message: "Staff not found." });
    const updates = {};
    if (experience_level !== undefined) updates.experience_level = experience_level || null;
    if (years_of_experience !== undefined)
      updates.years_of_experience = years_of_experience !== "" && years_of_experience !== null ? Number(years_of_experience) : null;
    const { error } = await supabaseAdmin
      .from("user_skill_tags")
      .update(updates)
      .eq("user_id", user_id)
      .eq("skill_id", skill_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const removeStaffSkill = async (req, res) => {
  try {
    const { staff_id, skill_id } = req.params;
    const user_id = await resolveUserId(staff_id);
    if (!user_id) return res.status(404).json({ success: false, message: "Staff not found." });
    const { error } = await supabaseAdmin
      .from("user_skill_tags")
      .delete()
      .eq("user_id", user_id)
      .eq("skill_id", skill_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET /api/skills/outlet/:outlet_id — bulk staff→skill assignments for a whole outlet
const getOutletStaffSkills = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const staffRows = await prisma.staff.findMany({ where: { branch_id: outlet_id }, select: { staff_id: true, user_id: true } });
    if (staffRows.length === 0) return res.json({ success: true, skills: [] });
    const userToStaff = Object.fromEntries(staffRows.map(s => [s.user_id, s.staff_id]));
    const userIds = staffRows.map(s => s.user_id);

    const { data: rows, error } = await supabaseAdmin
      .from("user_skill_tags")
      .select("user_id, skill_id")
      .in("user_id", userIds);
    if (error) throw error;

    const skillIds = [...new Set((rows || []).map(r => r.skill_id))];
    const skillRecords = await prisma.skills.findMany({ where: { skill_id: { in: skillIds } }, select: { skill_id: true, name: true } });
    const nameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));

    const skills = (rows || [])
      .map(r => ({ staff_id: userToStaff[r.user_id], skill_id: r.skill_id, name: nameMap[r.skill_id] || null }))
      .filter(r => r.name);
    res.json({ success: true, skills });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getStaffSkills, addStaffSkill, updateStaffSkill, removeStaffSkill, getOutletStaffSkills,
};
