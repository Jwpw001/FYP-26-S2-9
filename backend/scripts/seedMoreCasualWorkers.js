require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

// Harbourfront Bistro Co. — extends the casual1-3@gmail.com demo pool with
// casual4-6@gmail.com (same "Test1234@" password / naming format), then gives
// every casual worker (old + new) a fresh, varied standing availability
// pattern and a second skill tag.

const BUSINESS_ID = 1;
const PASSWORD = "Test1234@";
const BRANCH_DOWNTOWN = 1;
const BRANCH_UPTOWN = 2;
const PERIOD_DOWNTOWN_MORNING = 3; // 10:00-15:00
const PERIOD_DOWNTOWN_EVENING = 4; // 17:00-23:00
const PERIOD_UPTOWN_FULLDAY = 2;   // 11:00-23:00

const SKILLS = { kitchen: 1, service: 2, barista: 3, bartender: 4 };

const NEW_WORKERS = [
  {
    email: "casual4@gmail.com",
    username: "casual4",
    full_name: "Casual Four",
    branches: [BRANCH_UPTOWN],
    skills: [
      { skill_id: SKILLS.kitchen, experience_level: "intermediate", years_of_experience: 3 },
      { skill_id: SKILLS.service, experience_level: "junior", years_of_experience: 1 },
    ],
  },
  {
    email: "casual5@gmail.com",
    username: "casual5",
    full_name: "Casual Five",
    branches: [BRANCH_DOWNTOWN, BRANCH_UPTOWN],
    skills: [
      { skill_id: SKILLS.service, experience_level: "senior", years_of_experience: 4 },
      { skill_id: SKILLS.bartender, experience_level: "junior", years_of_experience: 1 },
    ],
  },
  {
    email: "casual6@gmail.com",
    username: "casual6",
    full_name: "Casual Six",
    branches: [BRANCH_UPTOWN],
    skills: [
      { skill_id: SKILLS.bartender, experience_level: "senior", years_of_experience: 6 },
      { skill_id: SKILLS.barista, experience_level: "intermediate", years_of_experience: 2 },
    ],
  },
];

// Extra skill tag for the existing casual1-3 (they already have a single Barista tag).
const EXTRA_SKILLS_FOR_EXISTING = {
  "casual1@gmail.com": { skill_id: SKILLS.kitchen, experience_level: "intermediate", years_of_experience: 3 },
  "casual2@gmail.com": { skill_id: SKILLS.bartender, experience_level: "junior", years_of_experience: 1 },
  "casual3@gmail.com": { skill_id: SKILLS.service, experience_level: "junior", years_of_experience: 1 },
};

// staff_id -> standing availability rows (period_id, day_of_week[]), Mon=0 ... Sun=6
function availabilityPlan(staffIdByEmail) {
  return {
    "casual1@gmail.com": [
      { period_id: PERIOD_DOWNTOWN_MORNING, days: [0, 2, 4] },   // Mon/Wed/Fri morning
      { period_id: PERIOD_DOWNTOWN_EVENING, days: [5] },          // Sat evening
    ],
    "casual2@gmail.com": [
      { period_id: PERIOD_DOWNTOWN_EVENING, days: [1, 3] },       // Tue/Thu evening
      { period_id: PERIOD_DOWNTOWN_MORNING, days: [5, 6] },       // weekend morning
    ],
    "casual3@gmail.com": [
      { period_id: PERIOD_DOWNTOWN_MORNING, days: [0, 1, 2, 3, 4] }, // Mon-Fri morning
    ],
    "casual4@gmail.com": [
      { period_id: PERIOD_UPTOWN_FULLDAY, days: [0, 2, 4, 5] },   // Mon/Wed/Fri/Sat
    ],
    "casual5@gmail.com": [
      { period_id: PERIOD_DOWNTOWN_MORNING, days: [1, 3] },       // Tue/Thu (Downtown)
      { period_id: PERIOD_UPTOWN_FULLDAY, days: [5, 6] },         // weekend (Uptown)
    ],
    "casual6@gmail.com": [
      { period_id: PERIOD_UPTOWN_FULLDAY, days: [1, 2, 3, 4, 5] }, // Tue-Sat
    ],
  };
}

async function run() {
  console.log("=== Seeding additional casual workers + availability/skills ===\n");

  // 1. Create casual4-6 (auth + public user + casual_workers + staff + branch prefs + skills)
  const staffIdByEmail = {};
  for (const w of NEW_WORKERS) {
    const { data: existingUser } = await supabaseAdmin.from("users").select("user_id").eq("email", w.email).maybeSingle();
    if (existingUser) {
      console.log(`  ${w.email} already exists, skipping creation`);
      const { data: s } = await supabaseAdmin.from("staff").select("staff_id").eq("user_id", existingUser.user_id).maybeSingle();
      if (s) staffIdByEmail[w.email] = s.staff_id;
      continue;
    }

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: w.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: w.full_name },
    });
    if (authErr) { console.error(`  Auth create ${w.email}:`, authErr.message); continue; }

    const { data: newUser, error: userErr } = await supabaseAdmin
      .from("users")
      .insert({ email: w.email, username: w.username, full_name: w.full_name, role: "casual_staff", is_active: true })
      .select("user_id")
      .single();
    if (userErr) { console.error(`  Public user ${w.email}:`, userErr.message); continue; }

    const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert({
      user_id: newUser.user_id,
      business_id: BUSINESS_ID,
      status: "approved",
      approved_at: new Date().toISOString(),
    });
    if (cwErr) console.error(`  casual_workers ${w.email}:`, cwErr.message);

    const { data: staffRow, error: staffErr } = await supabaseAdmin
      .from("staff")
      .insert({ user_id: newUser.user_id, branch_id: w.branches[0], staff_type: "casual", is_active: true })
      .select("staff_id")
      .single();
    if (staffErr) { console.error(`  staff ${w.email}:`, staffErr.message); continue; }
    staffIdByEmail[w.email] = staffRow.staff_id;

    const { error: prefErr } = await supabaseAdmin
      .from("casual_branch_preferences")
      .insert(w.branches.map(branch_id => ({ user_id: newUser.user_id, branch_id })));
    if (prefErr) console.error(`  branch prefs ${w.email}:`, prefErr.message);

    const { error: skillErr } = await supabaseAdmin
      .from("user_skill_tags")
      .insert(w.skills.map(s => ({ user_id: newUser.user_id, ...s })));
    if (skillErr) console.error(`  skills ${w.email}:`, skillErr.message);

    console.log(`  ✓ Created ${w.email} (staff_id ${staffRow.staff_id})`);
  }

  // 2. Look up staff_ids for casual1-3 too, and add their extra skill tag
  const existingEmails = Object.keys(EXTRA_SKILLS_FOR_EXISTING);
  const { data: existingUsers } = await supabaseAdmin.from("users").select("user_id, email").in("email", existingEmails);
  const { data: existingStaff } = await supabaseAdmin
    .from("staff")
    .select("staff_id, user_id")
    .in("user_id", (existingUsers || []).map(u => u.user_id));

  for (const u of existingUsers || []) {
    const staffRow = (existingStaff || []).find(s => s.user_id === u.user_id);
    if (staffRow) staffIdByEmail[u.email] = staffRow.staff_id;

    const extra = EXTRA_SKILLS_FOR_EXISTING[u.email];
    const { data: already } = await supabaseAdmin
      .from("user_skill_tags")
      .select("id")
      .eq("user_id", u.user_id)
      .eq("skill_id", extra.skill_id)
      .maybeSingle();
    if (already) { console.log(`  ${u.email} already has skill_id ${extra.skill_id}, skipping`); continue; }

    const { error } = await supabaseAdmin.from("user_skill_tags").insert({ user_id: u.user_id, ...extra });
    if (error) console.error(`  extra skill ${u.email}:`, error.message);
    else console.log(`  ✓ Added extra skill to ${u.email}`);
  }

  // 3. Replace standing availability for ALL casual1-6 with a fresh, varied pattern
  const plan = availabilityPlan(staffIdByEmail);
  const allStaffIds = Object.values(staffIdByEmail);
  if (allStaffIds.length === 0) { console.log("No casual staff_ids resolved, aborting availability step."); return; }

  const { error: delErr } = await supabaseAdmin.from("casual_standing_availability").delete().in("staff_id", allStaffIds);
  if (delErr) console.error("  Clear availability error:", delErr.message);
  else console.log(`\n  Cleared existing standing availability for staff_ids: ${allStaffIds.join(", ")}`);

  const rows = [];
  for (const [email, staffId] of Object.entries(staffIdByEmail)) {
    for (const entry of plan[email] || []) {
      for (const day of entry.days) {
        rows.push({ staff_id: staffId, period_id: entry.period_id, day_of_week: day });
      }
    }
  }

  const { error: insErr } = await supabaseAdmin.from("casual_standing_availability").insert(rows);
  if (insErr) console.error("  Insert availability error:", insErr.message);
  else console.log(`  ✓ Inserted ${rows.length} standing availability rows for ${Object.keys(staffIdByEmail).length} casual workers`);

  console.log("\n=== Done! ===");
}

run().catch(console.error);
