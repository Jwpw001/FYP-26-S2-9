require("dotenv").config();
const supabaseAdmin = require("../src/config/supabaseAdmin");

// Trims business_id=1's casual pool from ~54 down to 8, using the same worker-generation
// shape as reseedCasualWorkers50.js (branch preference, 1-3 skills, standing availability),
// just fewer of them and generalized to delete the CURRENT full pool rather than only casual1-6.

const BUSINESS_ID = 1;
const PASSWORD = "Test1234@";
const COUNT = 8;

const BRANCH_DOWNTOWN = 1;
const BRANCH_UPTOWN = 2;
const PERIOD_DOWNTOWN_MORNING = 3; // 10:00-15:00
const PERIOD_DOWNTOWN_EVENING = 4; // 17:00-23:00
const PERIOD_UPTOWN_FULLDAY = 2;   // 11:00-23:00

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
function shuffledDays(n) {
  const days = [0, 1, 2, 3, 4, 5, 6];
  return pickN(days, n);
}

async function deleteExistingCasualPool() {
  console.log("=== Deleting existing casual pool for business", BUSINESS_ID, "===\n");
  const { data: cws } = await supabaseAdmin.from("casual_workers").select("user_id").eq("business_id", BUSINESS_ID);
  const userIds = (cws || []).map(c => c.user_id);
  if (userIds.length === 0) { console.log("  Nothing to delete.\n"); return; }

  const { data: staffRows } = await supabaseAdmin.from("staff").select("staff_id, user_id").in("user_id", userIds);
  const staffIds = (staffRows || []).map(s => s.staff_id);

  if (staffIds.length > 0) {
    await supabaseAdmin.from("casual_standing_availability").delete().in("staff_id", staffIds);
    await supabaseAdmin.from("casual_period_availability").delete().in("staff_id", staffIds);
    await supabaseAdmin.from("availability").delete().in("staff_id", staffIds);
    await supabaseAdmin.from("off_day_requests").delete().in("staff_id", staffIds);
    await supabaseAdmin.from("task_assignments").delete().in("staff_id", staffIds);
    await supabaseAdmin.from("timesheets").delete().in("staff_id", staffIds);
  }
  await supabaseAdmin.from("user_skill_tags").delete().in("user_id", userIds);
  await supabaseAdmin.from("casual_branch_preferences").delete().in("user_id", userIds);
  await supabaseAdmin.from("casual_workers").delete().in("user_id", userIds);
  await supabaseAdmin.from("notifications").delete().in("recipient_id", userIds);
  await supabaseAdmin.from("staff").delete().in("user_id", userIds);
  await supabaseAdmin.from("users").delete().in("user_id", userIds);

  const { data: authList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const authMatches = (authList?.users || []).filter(a => a.email && /^casual\d+@gmail\.com$/.test(a.email));
  for (const a of authMatches) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(a.id);
    if (error) console.error(`  Auth delete ${a.email}:`, error.message);
  }

  console.log(`  Deleted ${userIds.length} public users, ${staffIds.length} staff rows, ${authMatches.length} auth accounts.\n`);
}

function numberWord(n) {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
  const teens = ["Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty"];
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  return tens[t] + (o ? "-" + ones[o].toLowerCase() : "");
}

function buildWorkerPlan(i) {
  const branchRoll = Math.random();
  const branches = branchRoll < 0.4 ? [BRANCH_DOWNTOWN] : branchRoll < 0.8 ? [BRANCH_UPTOWN] : [BRANCH_DOWNTOWN, BRANCH_UPTOWN];

  const skillCount = 1 + Math.floor(Math.random() * 3); // 1-3
  const skills = pickN(SKILL_IDS, skillCount).map(skill_id => {
    const lvl = pick(LEVELS);
    const years = lvl.years[0] + Math.random() * (lvl.years[1] - lvl.years[0]);
    return { skill_id, experience_level: lvl.level, years_of_experience: Math.round(years * 2) / 2 };
  });

  const availability = [];
  if (branches.includes(BRANCH_DOWNTOWN)) {
    if (Math.random() > 0.3) availability.push({ period_id: PERIOD_DOWNTOWN_MORNING, days: shuffledDays(1 + Math.floor(Math.random() * 4)) });
    if (Math.random() > 0.5) availability.push({ period_id: PERIOD_DOWNTOWN_EVENING, days: shuffledDays(1 + Math.floor(Math.random() * 4)) });
  }
  if (branches.includes(BRANCH_UPTOWN)) {
    if (Math.random() > 0.2) availability.push({ period_id: PERIOD_UPTOWN_FULLDAY, days: shuffledDays(1 + Math.floor(Math.random() * 5)) });
  }
  if (availability.length === 0) {
    const period = branches.includes(BRANCH_DOWNTOWN) ? PERIOD_DOWNTOWN_MORNING : PERIOD_UPTOWN_FULLDAY;
    availability.push({ period_id: period, days: shuffledDays(2) });
  }

  return {
    email: `casual${i}@gmail.com`,
    username: `casual${i}`,
    full_name: `Casual ${numberWord(i)}`,
    branches,
    skills,
    availability,
  };
}

async function run() {
  await deleteExistingCasualPool();

  console.log(`=== Seeding ${COUNT} casual workers ===\n`);
  const plans = Array.from({ length: COUNT }, (_, idx) => buildWorkerPlan(idx + 1));

  const authIdByEmail = {};
  for (const p of plans) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: p.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.full_name },
    });
    if (authErr) { console.error(`  Auth create ${p.email}:`, authErr.message); continue; }
    authIdByEmail[p.email] = authData.user.id;
  }
  console.log(`  ${Object.keys(authIdByEmail).length}/${COUNT} auth accounts created`);

  const okPlans = plans.filter(p => authIdByEmail[p.email]);

  const { data: newUsers, error: userErr } = await supabaseAdmin
    .from("users")
    .insert(okPlans.map(p => ({ email: p.email, username: p.username, full_name: p.full_name, role: "casual_staff", is_active: true })))
    .select("user_id, email");
  if (userErr) { console.error("  Public users error:", userErr.message); return; }
  const userIdByEmail = Object.fromEntries(newUsers.map(u => [u.email, u.user_id]));
  console.log(`  ${newUsers.length} public user rows created`);

  const { error: cwErr } = await supabaseAdmin.from("casual_workers").insert(
    okPlans.map(p => ({ user_id: userIdByEmail[p.email], business_id: BUSINESS_ID, status: "approved", approved_at: new Date().toISOString() }))
  );
  if (cwErr) console.error("  casual_workers error:", cwErr.message);
  else console.log(`  ${okPlans.length} casual_workers rows created`);

  const { data: newStaff, error: staffErr } = await supabaseAdmin
    .from("staff")
    .insert(okPlans.map(p => ({ user_id: userIdByEmail[p.email], branch_id: p.branches[0], staff_type: "casual", is_active: true })))
    .select("staff_id, user_id");
  if (staffErr) { console.error("  staff error:", staffErr.message); return; }
  const staffIdByUserId = Object.fromEntries(newStaff.map(s => [s.user_id, s.staff_id]));
  console.log(`  ${newStaff.length} staff rows created`);

  const prefRows = okPlans.flatMap(p => p.branches.map(branch_id => ({ user_id: userIdByEmail[p.email], branch_id })));
  const { error: prefErr } = await supabaseAdmin.from("casual_branch_preferences").insert(prefRows);
  if (prefErr) console.error("  branch prefs error:", prefErr.message);
  else console.log(`  ${prefRows.length} branch preference rows created`);

  const skillRows = okPlans.flatMap(p => p.skills.map(s => ({ user_id: userIdByEmail[p.email], ...s })));
  const { error: skillErr } = await supabaseAdmin.from("user_skill_tags").insert(skillRows);
  if (skillErr) console.error("  skills error:", skillErr.message);
  else console.log(`  ${skillRows.length} skill tag rows created`);

  const availRows = okPlans.flatMap(p => {
    const staffId = staffIdByUserId[userIdByEmail[p.email]];
    return p.availability.flatMap(a => a.days.map(day_of_week => ({ staff_id: staffId, period_id: a.period_id, day_of_week })));
  });
  const { error: availErr } = await supabaseAdmin.from("casual_standing_availability").insert(availRows);
  if (availErr) console.error("  availability error:", availErr.message);
  else console.log(`  ${availRows.length} standing availability rows created`);

  console.log(`\n=== Done! ${COUNT} casual workers seeded with password ${PASSWORD} ===`);
}

run().catch(console.error);
