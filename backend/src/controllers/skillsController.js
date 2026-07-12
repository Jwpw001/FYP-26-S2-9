const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

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

const updateStaffSkill = async (req, res) => {
  try {
    const { staff_id, skill_id } = req.params;
    const { experience_level, years_of_experience } = req.body;
    const updates = {};
    if (experience_level !== undefined) updates.experience_level = experience_level || null;
    if (years_of_experience !== undefined)
      updates.years_of_experience = years_of_experience !== "" && years_of_experience !== null ? Number(years_of_experience) : null;
    const { error } = await supabaseAdmin
      .from("staff_skills")
      .update(updates)
      .eq("staff_id", staff_id)
      .eq("skill_id", skill_id);
    if (error) throw error;
    res.json({ success: true });
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

// GET /api/skills/outlet/:outlet_id — bulk staff→skill assignments for a whole outlet
const getOutletStaffSkills = async (req, res) => {
  try {
    const outlet_id = Number(req.params.outlet_id);
    const staffRows = await prisma.staff.findMany({ where: { outlet_id }, select: { staff_id: true } });
    const staffIds = staffRows.map(s => s.staff_id);
    if (staffIds.length === 0) return res.json({ success: true, skills: [] });

    const { data: rows, error } = await supabaseAdmin
      .from("staff_skills")
      .select("staff_id, skill_id")
      .in("staff_id", staffIds);
    if (error) throw error;

    const skillIds = [...new Set((rows || []).map(r => r.skill_id))];
    const skillRecords = await prisma.skills.findMany({ where: { skill_id: { in: skillIds } }, select: { skill_id: true, name: true } });
    const nameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));

    const skills = (rows || []).map(r => ({ staff_id: r.staff_id, skill_id: r.skill_id, name: nameMap[r.skill_id] || null })).filter(r => r.name);
    res.json({ success: true, skills });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getStaffSkills, addStaffSkill, updateStaffSkill, removeStaffSkill, getOutletStaffSkills,
};
