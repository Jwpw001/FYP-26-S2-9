require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

const LEVELS = ["junior", "intermediate", "senior", "expert"];
const BUSINESS_NAME = "Dream";

async function run() {
  console.log(`=== Fixing staff_skills for business "${BUSINESS_NAME}" ===\n`);

  // 1. Find the Dream business
  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("businesses")
    .select("business_id, name")
    .ilike("name", BUSINESS_NAME)
    .single();
  if (bizErr) { console.error("Business not found:", bizErr.message); process.exit(1); }
  console.log(`Business: ${biz.name} (id=${biz.business_id})`);

  // 2. Get all outlets under this business
  const { data: outlets, error: outletErr } = await supabaseAdmin
    .from("outlets")
    .select("outlet_id")
    .eq("business_id", biz.business_id);
  if (outletErr) { console.error("Outlets error:", outletErr.message); process.exit(1); }
  const outletIds = outlets.map(o => o.outlet_id);
  console.log(`Outlets: ${outletIds.join(", ")}`);

  // 3. Get all staff under these outlets
  const { data: allStaff, error: staffErr } = await supabaseAdmin
    .from("staff")
    .select("staff_id")
    .in("outlet_id", outletIds);
  if (staffErr) { console.error("Staff error:", staffErr.message); process.exit(1); }
  const staffIds = allStaff.map(s => s.staff_id);
  console.log(`Staff count: ${staffIds.length}`);

  // 4. Get all skills available
  const { data: skills } = await supabaseAdmin.from("skills").select("skill_id");
  const skillIds = (skills || []).map(s => s.skill_id);
  if (skillIds.length === 0) { console.log("No skills found in DB."); return; }

  // 5. Get existing staff_skills for these staff
  const { data: existingRows, error: ssErr } = await supabaseAdmin
    .from("staff_skills")
    .select("id, staff_id, skill_id, experience_level, years_of_experience")
    .in("staff_id", staffIds);
  if (ssErr) { console.error("staff_skills fetch error:", ssErr.message); process.exit(1); }
  console.log(`Existing staff_skill rows: ${existingRows.length}\n`);

  // 6. Update rows missing exp_level or years_of_experience
  const toUpdate = existingRows.filter(r => !r.experience_level || r.years_of_experience == null);
  console.log(`Rows missing fields: ${toUpdate.length}`);
  let updated = 0;
  for (const row of toUpdate) {
    const level = row.experience_level || LEVELS[Math.floor(Math.random() * LEVELS.length)];
    const years = row.years_of_experience ?? (1 + Math.floor(Math.random() * 8));
    const { error } = await supabaseAdmin
      .from("staff_skills")
      .update({ experience_level: level, years_of_experience: years })
      .eq("id", row.id);
    if (error) console.warn(`  Failed id=${row.id}:`, error.message);
    else updated++;
  }
  if (toUpdate.length > 0) console.log(`Updated ${updated} rows.`);

  // 7. Assign 2–3 skills to staff who have zero skill rows
  const staffWithSkills = new Set(existingRows.map(r => r.staff_id));
  const bareStaff = staffIds.filter(id => !staffWithSkills.has(id));
  console.log(`\nStaff with no skills at all: ${bareStaff.length}`);

  const newRows = [];
  for (const staff_id of bareStaff) {
    const shuffled = [...skillIds].sort(() => Math.random() - 0.5);
    const count = 2 + Math.floor(Math.random() * 2);
    for (const skill_id of shuffled.slice(0, Math.min(count, shuffled.length))) {
      newRows.push({
        staff_id,
        skill_id,
        experience_level: LEVELS[Math.floor(Math.random() * LEVELS.length)],
        years_of_experience: 1 + Math.floor(Math.random() * 8),
      });
    }
  }

  if (newRows.length > 0) {
    const { error: insErr } = await supabaseAdmin.from("staff_skills").insert(newRows);
    if (insErr) console.error("Insert error:", insErr.message);
    else console.log(`Inserted ${newRows.length} new staff_skill rows.`);
  }

  console.log("\n=== Done! ===");
}

run().catch(console.error);
