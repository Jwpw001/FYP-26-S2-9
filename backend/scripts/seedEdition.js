require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

const USERS = [
  // Managers (1 per outlet)
  { email: "sophie.tan@edition.sg",   full_name: "Sophie Tan",    username: "sophie.tan",   role: "outlet_manager", staff_type: "regular" },
  { email: "marcus.lim@edition.sg",   full_name: "Marcus Lim",    username: "marcus.lim",   role: "outlet_manager", staff_type: "regular" },
  { email: "priya.nair@edition.sg",   full_name: "Priya Nair",    username: "priya.nair",   role: "outlet_manager", staff_type: "regular" },
  // Regular staff (5 per outlet = 15)
  { email: "aiden.wong@edition.sg",   full_name: "Aiden Wong",    username: "aiden.wong",   role: "regular_staff", staff_type: "regular" },
  { email: "bella.cruz@edition.sg",   full_name: "Bella Cruz",    username: "bella.cruz",   role: "regular_staff", staff_type: "regular" },
  { email: "chris.ng@edition.sg",     full_name: "Chris Ng",      username: "chris.ng",     role: "regular_staff", staff_type: "regular" },
  { email: "diana.koh@edition.sg",    full_name: "Diana Koh",     username: "diana.koh",    role: "regular_staff", staff_type: "regular" },
  { email: "ethan.raj@edition.sg",    full_name: "Ethan Raj",     username: "ethan.raj",    role: "regular_staff", staff_type: "regular" },
  { email: "fiona.lee@edition.sg",    full_name: "Fiona Lee",     username: "fiona.lee",    role: "regular_staff", staff_type: "regular" },
  { email: "george.tan@edition.sg",   full_name: "George Tan",    username: "george.tan",   role: "regular_staff", staff_type: "regular" },
  { email: "hannah.ong@edition.sg",   full_name: "Hannah Ong",    username: "hannah.ong",   role: "regular_staff", staff_type: "regular" },
  { email: "ivan.chua@edition.sg",    full_name: "Ivan Chua",     username: "ivan.chua",    role: "regular_staff", staff_type: "regular" },
  { email: "jasmine.ho@edition.sg",   full_name: "Jasmine Ho",    username: "jasmine.ho",   role: "regular_staff", staff_type: "regular" },
  { email: "kevin.yeo@edition.sg",    full_name: "Kevin Yeo",     username: "kevin.yeo",    role: "regular_staff", staff_type: "regular" },
  { email: "laura.sim@edition.sg",    full_name: "Laura Sim",     username: "laura.sim",    role: "regular_staff", staff_type: "regular" },
  { email: "michael.goh@edition.sg",  full_name: "Michael Goh",   username: "michael.goh",  role: "regular_staff", staff_type: "regular" },
  { email: "nina.teo@edition.sg",     full_name: "Nina Teo",      username: "nina.teo",     role: "regular_staff", staff_type: "regular" },
  { email: "oscar.chan@edition.sg",   full_name: "Oscar Chan",    username: "oscar.chan",   role: "regular_staff", staff_type: "regular" },
  { email: "paula.seah@edition.sg",   full_name: "Paula Seah",    username: "paula.seah",   role: "regular_staff", staff_type: "regular" },
  // Casual staff (2 per outlet = 6)
  { email: "quinn.beh@edition.sg",    full_name: "Quinn Beh",     username: "quinn.beh",    role: "outlet_casual_staff", staff_type: "casual" },
  { email: "rachel.foo@edition.sg",   full_name: "Rachel Foo",    username: "rachel.foo",   role: "outlet_casual_staff", staff_type: "casual" },
  { email: "sam.khoo@edition.sg",     full_name: "Sam Khoo",      username: "sam.khoo",     role: "outlet_casual_staff", staff_type: "casual" },
  { email: "tanya.wee@edition.sg",    full_name: "Tanya Wee",     username: "tanya.wee",    role: "outlet_casual_staff", staff_type: "casual" },
  { email: "umar.malik@edition.sg",   full_name: "Umar Malik",    username: "umar.malik",   role: "outlet_casual_staff", staff_type: "casual" },
  { email: "vera.loh@edition.sg",     full_name: "Vera Loh",      username: "vera.loh",     role: "outlet_casual_staff", staff_type: "casual" },
];

async function run() {
  console.log("=== Seeding Edition business ===\n");

  // 1. Create business
  const { data: bizData, error: bizErr } = await supabaseAdmin
    .from("businesses")
    .insert({ name: "Edition", contact_email: "admin@edition.sg", contact_phone: "+65 6789 1234", address: "1 Edition Way, Singapore 018960" })
    .select("business_id")
    .single();
  if (bizErr) { console.error("Business:", bizErr); process.exit(1); }
  const businessId = bizData.business_id;
  console.log("Business created:", businessId);

  // 2. Create outlets
  const outletDefs = [
    { name: "Edition Marina Bay",  address: "10 Bayfront Ave, Singapore 018956",    open_time: "10:00", close_time: "22:00" },
    { name: "Edition Bugis",       address: "200 Victoria St, Singapore 188021",     open_time: "11:00", close_time: "23:00" },
    { name: "Edition Sentosa",     address: "8 Sentosa Gateway, Singapore 098269",   open_time: "09:00", close_time: "21:00" },
  ];
  const { data: outletsData, error: outletErr } = await supabaseAdmin
    .from("outlets")
    .insert(outletDefs.map(o => ({ ...o, business_id: businessId })))
    .select("outlet_id, name");
  if (outletErr) { console.error("Outlets:", outletErr); process.exit(1); }
  const [outletMB, outletBugis, outletSentosa] = outletsData;
  console.log("Outlets created:", outletsData.map(o => `${o.name}(${o.outlet_id})`).join(", "));

  // 3. Get skills (column is 'name', not 'skill_name')
  const { data: skills } = await supabaseAdmin.from("skills").select("skill_id, name");
  const skillMap = skills ? Object.fromEntries(skills.map(s => [s.name.toLowerCase(), s.skill_id])) : {};
  console.log("Skills found:", Object.keys(skillMap).join(", ") || "(none)");

  // 4. Role templates per outlet
  const commonRoles = Object.keys(skillMap).slice(0, 3); // use first 3 skills available
  if (commonRoles.length) {
    for (const outlet of outletsData) {
      const templates = commonRoles.map(name => ({
        outlet_id: outlet.outlet_id,
        skill_id: skillMap[name],
        required_headcount: 2,
      }));
      const { error } = await supabaseAdmin.from("outlet_role_templates").insert(templates);
      if (error) console.warn("Role templates:", error.message);
    }
    console.log("Role templates inserted");
  } else {
    console.log("No skills found, skipping role templates");
  }

  // 5. Create auth users + public users
  const userIdMap = {}; // email -> user_id (public)
  for (const u of USERS) {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
      email: u.email,
      password: "mock123",
      email_confirm: true,
      user_metadata: { full_name: u.full_name, email_verified: true },
    });
    if (authErr) { console.error(`Auth create ${u.email}:`, authErr.message); continue; }

    const { data: pubData, error: pubErr } = await supabaseAdmin
      .from("users")
      .insert({ email: u.email, full_name: u.full_name, username: u.username, role: u.role, is_active: true })
      .select("user_id")
      .single();
    if (pubErr) { console.error(`Public user ${u.email}:`, pubErr.message); continue; }

    userIdMap[u.email] = pubData.user_id;
    console.log(`Created user: ${u.email} -> public user_id ${pubData.user_id}`);
  }

  // outlet -> manager email mapping
  const managerOutlets = {
    "sophie.tan@edition.sg": outletMB.outlet_id,
    "marcus.lim@edition.sg": outletBugis.outlet_id,
    "priya.nair@edition.sg": outletSentosa.outlet_id,
  };

  // regular staff outlet assignment (5 each)
  const regularStaff = [
    "aiden.wong@edition.sg", "bella.cruz@edition.sg", "chris.ng@edition.sg", "diana.koh@edition.sg", "ethan.raj@edition.sg",
    "fiona.lee@edition.sg", "george.tan@edition.sg", "hannah.ong@edition.sg", "ivan.chua@edition.sg", "jasmine.ho@edition.sg",
    "kevin.yeo@edition.sg", "laura.sim@edition.sg", "michael.goh@edition.sg", "nina.teo@edition.sg", "oscar.chan@edition.sg", "paula.seah@edition.sg",
  ];
  const staffOutlets = {};
  regularStaff.forEach((email, i) => {
    const outlets = [outletMB.outlet_id, outletBugis.outlet_id, outletSentosa.outlet_id];
    staffOutlets[email] = outlets[Math.floor(i / 5) % 3] || outlets[i % 3];
  });
  // Spread evenly: 0-4 -> MB, 5-9 -> Bugis, 10-15 -> Sentosa
  regularStaff.forEach((email, i) => {
    if (i < 5) staffOutlets[email] = outletMB.outlet_id;
    else if (i < 10) staffOutlets[email] = outletBugis.outlet_id;
    else staffOutlets[email] = outletSentosa.outlet_id;
  });

  // casual staff outlet assignment (2 each)
  const casualStaff = [
    "quinn.beh@edition.sg", "rachel.foo@edition.sg",
    "sam.khoo@edition.sg", "tanya.wee@edition.sg",
    "umar.malik@edition.sg", "vera.loh@edition.sg",
  ];
  const casualOutlets = {
    "quinn.beh@edition.sg": outletMB.outlet_id,    "rachel.foo@edition.sg": outletMB.outlet_id,
    "sam.khoo@edition.sg": outletBugis.outlet_id,  "tanya.wee@edition.sg": outletBugis.outlet_id,
    "umar.malik@edition.sg": outletSentosa.outlet_id, "vera.loh@edition.sg": outletSentosa.outlet_id,
  };

  // 6. Insert staff records
  const staffRows = [];
  for (const u of USERS) {
    const userId = userIdMap[u.email];
    if (!userId) continue;
    let outletId;
    if (u.role === "outlet_manager") outletId = managerOutlets[u.email];
    else if (u.role === "regular_staff") outletId = staffOutlets[u.email];
    else outletId = casualOutlets[u.email];
    staffRows.push({ user_id: userId, outlet_id: outletId, staff_type: u.staff_type, default_work_days: "1111100" });
  }
  const { data: staffData, error: staffErr } = await supabaseAdmin.from("staff").insert(staffRows).select("staff_id, user_id, outlet_id, staff_type");
  if (staffErr) { console.error("Staff:", staffErr); process.exit(1); }
  console.log("Staff records created:", staffData.length);

  // 7. Link managers to outlet_managers
  const managerLinks = staffData
    .filter(s => s.staff_type === "regular" && USERS.find(u => userIdMap[u.email] === s.user_id && u.role === "outlet_manager"))
    .map(s => ({ outlet_id: s.outlet_id, user_id: s.user_id, is_primary: true }));
  const { error: mgErr } = await supabaseAdmin.from("outlet_managers").insert(managerLinks);
  if (mgErr) console.error("Outlet managers:", mgErr.message);
  else console.log("Manager links created:", managerLinks.length);

  // 8. Create shifts (2 weeks, 2 per day per outlet)
  const today = new Date();
  today.setHours(0,0,0,0);
  const shiftRows = [];
  for (let d = 0; d < 14; d++) {
    const date = new Date(today);
    date.setDate(today.getDate() + d - 3); // -3 days in past, rest future
    const dateStr = date.toISOString().split("T")[0];
    for (const outlet of outletsData) {
      shiftRows.push({ outlet_id: outlet.outlet_id, title: "Morning Shift", shift_date: dateStr, start_time: "09:00", end_time: "15:00", status: "published" });
      shiftRows.push({ outlet_id: outlet.outlet_id, title: "Evening Shift", shift_date: dateStr, start_time: "15:00", end_time: "22:00", status: "published" });
    }
  }
  const { data: shiftsData, error: shiftErr } = await supabaseAdmin.from("shifts").insert(shiftRows).select("shift_id, outlet_id, shift_date, title");
  if (shiftErr) { console.error("Shifts:", shiftErr); process.exit(1); }
  console.log("Shifts created:", shiftsData.length);

  // 9. Assign regular staff to shifts
  const assignmentRows = [];
  const regularStaffByOutlet = {};
  for (const s of staffData.filter(s => s.staff_type === "outlet_staff")) {
    if (!regularStaffByOutlet[s.outlet_id]) regularStaffByOutlet[s.outlet_id] = [];
    regularStaffByOutlet[s.outlet_id].push(s);
  }
  for (const shift of shiftsData) {
    const outletStaff = regularStaffByOutlet[shift.outlet_id] || [];
    // Assign 3 staff per shift, rotating
    const shiftIndex = shiftsData.indexOf(shift);
    for (let i = 0; i < Math.min(3, outletStaff.length); i++) {
      const staff = outletStaff[(shiftIndex + i) % outletStaff.length];
      assignmentRows.push({ shift_id: shift.shift_id, staff_id: staff.staff_id, status: "assigned", acknowledged: false });
    }
  }
  const { error: assignErr } = await supabaseAdmin.from("shift_assignments").insert(assignmentRows);
  if (assignErr) console.error("Assignments:", assignErr.message);
  else console.log("Shift assignments created:", assignmentRows.length);

  // 10. Casual availability (next 2 weeks)
  const casualStaffRecords = staffData.filter(s => s.staff_type === "outlet_casual_staff");
  const availRows = [];
  for (const cs of casualStaffRecords) {
    for (let w = 0; w < 2; w++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() + 1 + w * 7); // Monday
      const weekStartStr = weekStart.toISOString().split("T")[0];
      ["Monday","Tuesday","Wednesday","Thursday","Friday"].forEach((day, di) => {
        if (Math.random() > 0.4) {
          availRows.push({ staff_id: cs.staff_id, week_start_date: weekStartStr, day_of_week: day, available_from: "10:00", available_to: "18:00" });
        }
      });
    }
  }
  const { error: availErr } = await supabaseAdmin.from("casual_availability").insert(availRows);
  if (availErr) console.error("Casual availability:", availErr.message);
  else console.log("Casual availability rows created:", availRows.length);

  console.log("\n=== Done! All Edition data seeded. Login with any @edition.sg email and password: mock123 ===");
}

run().catch(console.error);
