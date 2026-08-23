require("dotenv").config();
const supabaseAdmin = require("../src/config/supabaseAdmin");

// Sets F&B skill tags for every current business_id=1 staff member who has none yet —
// the 12 regular staff (regular1-8, john x2, E2E Test x2) and the 2 individually-created
// casuals (cedric23, alfred) that fell outside the casual-pool reseed. The casual1-8 pool
// already has skills from reseedCasualPool.js, so this only touches user_ids with zero rows.

const SKILLS = { kitchen: 1, service: 2, barista: 3, bartender: 4 };
const SKILL_IDS = Object.values(SKILLS);
const LEVELS = [
  { level: "junior", years: [0.5, 1] },
  { level: "intermediate", years: [2, 3] },
  { level: "senior", years: [4, 6] },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

async function run() {
  const { data: staffRows } = await supabaseAdmin
    .from("staff")
    .select("user_id, staff_type, branch_id, users(full_name)")
    .in("branch_id", [1, 2, 4, 5, 6, 7]); // all branches under business_id=1

  const userIds = staffRows.map(s => s.user_id);
  const { data: existingTags } = await supabaseAdmin.from("user_skill_tags").select("user_id").in("user_id", userIds);
  const alreadyTagged = new Set((existingTags || []).map(t => t.user_id));

  const targets = staffRows.filter(s => !alreadyTagged.has(s.user_id));
  console.log(`=== ${targets.length} staff with zero skills found — assigning ===\n`);

  const rows = targets.flatMap(s => {
    const skillCount = s.staff_type === "regular" ? 1 + Math.floor(Math.random() * 2) : 1 + Math.floor(Math.random() * 3); // regular: 1-2, casual: 1-3
    const skills = pickN(SKILL_IDS, skillCount).map(skill_id => {
      const lvl = pick(LEVELS);
      const years = lvl.years[0] + Math.random() * (lvl.years[1] - lvl.years[0]);
      return { user_id: s.user_id, skill_id, experience_level: lvl.level, years_of_experience: Math.round(years * 2) / 2 };
    });
    console.log(`  ${s.users?.full_name || s.user_id} (${s.staff_type}): ${skills.length} skill(s)`);
    return skills;
  });

  if (rows.length === 0) { console.log("Nothing to do."); return; }

  const { error } = await supabaseAdmin.from("user_skill_tags").insert(rows);
  if (error) { console.error("FAILED:", error.message); return; }
  console.log(`\n=== Done — ${rows.length} skill tags created across ${targets.length} staff ===`);
}

run().catch(console.error);
