require("dotenv").config();
const supabaseAdmin = require("../src/config/supabaseAdmin");

// Adds more regular staff to business_id=1, following the same shape as the existing
// regular1-4@gmail.com accounts (staff_type "regular", a default_work_days bitmask,
// Test1234@ password matching every other seed account this session).

const BUSINESS_ID = 1;
const PASSWORD = "Test1234@";
const BRANCH_DOWNTOWN = 1;
const BRANCH_UPTOWN = 2;

const PLANS = [
  { n: "Five",  branch_id: BRANCH_DOWNTOWN, default_work_days: "1111100" }, // Mon-Fri
  { n: "Six",   branch_id: BRANCH_DOWNTOWN, default_work_days: "0111110" }, // Tue-Sat
  { n: "Seven", branch_id: BRANCH_UPTOWN,   default_work_days: "1111110" }, // Mon-Sat
  { n: "Eight", branch_id: BRANCH_UPTOWN,   default_work_days: "1101011" }, // Mon,Tue,Thu,Sat,Sun
].map((p, i) => ({
  email: `regular${5 + i}@gmail.com`,
  username: `regular${5 + i}`,
  full_name: `Regular ${p.n}`,
  branch_id: p.branch_id,
  default_work_days: p.default_work_days,
}));

async function run() {
  console.log(`=== Creating ${PLANS.length} regular staff for business ${BUSINESS_ID} ===\n`);

  const authIdByEmail = {};
  for (const p of PLANS) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: p.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: p.full_name },
    });
    if (authErr) { console.error(`  Auth create ${p.email}:`, authErr.message); continue; }
    authIdByEmail[p.email] = authData.user.id;
  }
  console.log(`  ${Object.keys(authIdByEmail).length}/${PLANS.length} auth accounts created`);

  const okPlans = PLANS.filter(p => authIdByEmail[p.email]);

  const { data: newUsers, error: userErr } = await supabaseAdmin
    .from("users")
    .insert(okPlans.map(p => ({ email: p.email, username: p.username, full_name: p.full_name, role: "regular_staff", is_active: true })))
    .select("user_id, email");
  if (userErr) { console.error("  users error:", userErr.message); return; }
  const userIdByEmail = Object.fromEntries(newUsers.map(u => [u.email, u.user_id]));
  console.log(`  ${newUsers.length} public user rows created`);

  const { data: newStaff, error: staffErr } = await supabaseAdmin
    .from("staff")
    .insert(okPlans.map(p => ({
      user_id: userIdByEmail[p.email],
      branch_id: p.branch_id,
      staff_type: "regular",
      default_work_days: p.default_work_days,
      is_active: true,
    })))
    .select("staff_id, user_id");
  if (staffErr) { console.error("  staff error:", staffErr.message); return; }
  console.log(`  ${newStaff.length} staff rows created`);

  console.log(`\n=== Done! ${okPlans.length} regular staff created with password ${PASSWORD} ===`);
  okPlans.forEach(p => console.log(`  ${p.full_name} <${p.email}> — branch ${p.branch_id}, work days ${p.default_work_days}`));
}

run().catch(console.error);
