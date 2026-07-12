require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

const BUSINESS_NAME = "Dream";

// 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const TIME_SLOTS = [
  { from: "08:00", to: "14:00" },
  { from: "09:00", to: "17:00" },
  { from: "10:00", to: "18:00" },
  { from: "12:00", to: "20:00" },
  { from: "14:00", to: "22:00" },
];

function getMondayOfWeek(offsetWeeks = 0) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff + offsetWeeks * 7);
  return monday.toISOString().split("T")[0];
}

async function run() {
  console.log(`=== Seeding casual availability for "${BUSINESS_NAME}" ===\n`);

  // 1. Find the business
  const { data: biz, error: bizErr } = await supabaseAdmin
    .from("businesses")
    .select("business_id")
    .ilike("name", BUSINESS_NAME)
    .single();
  if (bizErr) { console.error("Business not found:", bizErr.message); process.exit(1); }
  console.log("Business id:", biz.business_id);

  // 2. Get all outlets
  const { data: outlets } = await supabaseAdmin
    .from("outlets")
    .select("outlet_id")
    .eq("business_id", biz.business_id);
  const outletIds = outlets.map(o => o.outlet_id);
  console.log("Outlet ids:", outletIds.join(", "));

  // 3. Get ALL staff — casual workers may use various staff_type values
  const { data: allStaff, error: staffErr } = await supabaseAdmin
    .from("staff")
    .select("staff_id, staff_type, user_id")
    .in("outlet_id", outletIds);
  if (staffErr) { console.error("Staff error:", staffErr.message); process.exit(1); }

  // Log all distinct staff_type values so we know what's in the DB
  const typeValues = [...new Set(allStaff.map(s => s.staff_type))];
  console.log("Distinct staff_type values found:", typeValues.join(", "));

  // 4. Find which staff already have casual_availability records
  const allStaffIds = allStaff.map(s => s.staff_id);
  const { data: existing } = await supabaseAdmin
    .from("casual_availability")
    .select("staff_id")
    .in("staff_id", allStaffIds);
  const staffWithRecords = new Set((existing || []).map(r => r.staff_id));
  console.log(`Staff already with availability records: ${staffWithRecords.size} (staff_ids: ${[...staffWithRecords].join(", ")})`);

  // 5. Identify casual staff = those who already have records OR whose staff_type indicates casual
  const casualTypes = ["casual", "outlet_casual_staff", "casual_worker", "casual_staff"];
  const casualStaff = allStaff.filter(s =>
    staffWithRecords.has(s.staff_id) ||
    casualTypes.includes(s.staff_type?.toLowerCase())
  );
  console.log(`Casual staff identified: ${casualStaff.length}`);

  if (casualStaff.length === 0) {
    console.log("No casual staff found. Printing all staff for debugging:");
    allStaff.forEach(s => console.log(`  staff_id=${s.staff_id} staff_type=${s.staff_type}`));
    return;
  }

  // 6. Only seed for those WITHOUT existing records
  const toSeed = casualStaff.filter(s => !staffWithRecords.has(s.staff_id));
  console.log(`Staff to seed (no records yet): ${toSeed.length}`);

  if (toSeed.length === 0) {
    console.log("All casual staff already have availability records. Nothing to add.");
    return;
  }

  // 7. Build rows for current week + next 2 weeks
  const weeks = [getMondayOfWeek(0), getMondayOfWeek(1), getMondayOfWeek(2)];
  const rows = [];

  for (const s of toSeed) {
    for (const weekStart of weeks) {
      const shuffledDays = [...ALL_DAYS].sort(() => Math.random() - 0.5);
      const count = 3 + Math.floor(Math.random() * 3); // 3–5 days
      for (const day of shuffledDays.slice(0, count)) {
        const slot = TIME_SLOTS[Math.floor(Math.random() * TIME_SLOTS.length)];
        rows.push({
          staff_id: s.staff_id,
          week_start_date: weekStart,
          day_of_week: day,
          available_from: slot.from,
          available_to: slot.to,
        });
      }
    }
  }

  const { error: insErr } = await supabaseAdmin.from("casual_availability").insert(rows);
  if (insErr) { console.error("Insert error:", insErr.message); process.exit(1); }

  console.log(`\nInserted ${rows.length} rows for ${toSeed.length} staff across weeks: ${weeks.join(", ")}`);
  console.log("=== Done! ===");
}

run().catch(console.error);
