require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

const BUSINESS_ID = 23;
const OUTLETS = [55, 56, 57];
const MANAGERS = { 55: 225, 56: 230, 57: 231 };

const TASK_DESCRIPTIONS = [
  "Managed front-of-house operations and assisted customers throughout the shift.",
  "Handled inventory restocking and organized storage areas.",
  "Operated the point-of-sale system and processed customer orders.",
  "Supervised junior staff and ensured service standards were met.",
  "Prepared and maintained the work area before and after shift.",
  "Coordinated with kitchen team for smooth service delivery.",
  "Assisted with daily opening procedures and equipment checks.",
  "Handled customer inquiries and resolved complaints professionally.",
  "Performed closing duties including cleaning and cash reconciliation.",
  "Supported team during peak hours and ensured timely service.",
  "Monitored stock levels and reported low inventory to supervisor.",
  "Trained new staff on standard operating procedures.",
  "Processed delivery orders and ensured accuracy of items.",
  "Maintained hygiene and cleanliness standards across the floor.",
  "Assisted manager with scheduling and shift coordination tasks.",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function shiftClockIn(shiftDate, startTime, isLate = false) {
  const t = (startTime || "09:00").slice(0, 5);
  const baseISO = `${shiftDate}T${t}:00+08:00`;
  const base = new Date(baseISO);
  const offsetMin = isLate ? (8 + Math.floor(Math.random() * 22)) : (-2 + Math.floor(Math.random() * 4));
  base.setMinutes(base.getMinutes() + offsetMin);
  return base.toISOString();
}

function shiftClockOut(shiftDate, endTime) {
  const t = (endTime || "17:00").slice(0, 5);
  const baseISO = `${shiftDate}T${t}:00+08:00`;
  const base = new Date(baseISO);
  // Leave slightly early or stay slightly late
  const offsetMin = -5 + Math.floor(Math.random() * 15);
  base.setMinutes(base.getMinutes() + offsetMin);
  return base.toISOString();
}

function hoursWorked(clockIn, clockOut) {
  return Math.round(((new Date(clockOut) - new Date(clockIn)) / 3600000) * 10) / 10;
}

async function run() {
  const supabase = supabaseAdmin;
  const today = new Date().toISOString().split("T")[0];

  console.log("=== Fix Attendance + Seed Timesheets for Dream ===\n");

  // ── 1. Get all past completed shifts for Dream outlets ──────────────────────
  console.log("Fetching past completed shifts…");
  const { data: shifts, error: shiftErr } = await supabase
    .from("shifts")
    .select("shift_id, outlet_id, shift_date, start_time, end_time, status")
    .in("outlet_id", OUTLETS)
    .lt("shift_date", today)
    .in("status", ["completed", "published"])
    .order("shift_date", { ascending: false });

  if (shiftErr) { console.error("Shift error:", shiftErr.message); process.exit(1); }
  console.log(`Found ${shifts.length} past shifts.`);

  const shiftMap = Object.fromEntries(shifts.map(s => [s.shift_id, s]));
  const shiftIds = shifts.map(s => s.shift_id);

  if (shiftIds.length === 0) {
    console.log("No past shifts found. Run seedDreamMockData.js first.");
    process.exit(0);
  }

  // ── 2. Get all assignments for those shifts ──────────────────────────────────
  console.log("Fetching assignments…");
  const { data: assignments, error: assignErr } = await supabase
    .from("shift_assignments")
    .select("assignment_id, shift_id, staff_id, status")
    .in("shift_id", shiftIds);

  if (assignErr) { console.error("Assignment error:", assignErr.message); process.exit(1); }
  console.log(`Found ${assignments.length} assignments.`);

  // ── 3. Check which assignments already have attendance ──────────────────────
  const assignIds = assignments.map(a => a.assignment_id);
  const { data: existingAtt } = await supabase
    .from("attendance")
    .select("attendance_id, assignment_id, status, clock_in, clock_out")
    .in("assignment_id", assignIds);

  const attMap = Object.fromEntries((existingAtt || []).map(a => [a.assignment_id, a]));
  const withoutAtt = assignments.filter(a => !attMap[a.assignment_id]);
  const withBadTimes = (existingAtt || []).filter(a => !a.clock_in || !a.clock_out).map(a => a.attendance_id);

  console.log(`  Already have attendance: ${Object.keys(attMap).length}`);
  console.log(`  Missing attendance: ${withoutAtt.length}`);
  console.log(`  Have attendance but missing clock times: ${withBadTimes.length}`);

  // ── 4. Insert missing attendance records ────────────────────────────────────
  if (withoutAtt.length > 0) {
    console.log("\nInserting missing attendance records…");
    const newAttRows = [];
    for (const a of withoutAtt) {
      const shift = shiftMap[a.shift_id];
      if (!shift) continue;
      const rand = Math.random();
      const status = rand > 0.12 ? "present" : rand > 0.06 ? "late" : "absent";
      const startTime = shift.start_time || "09:00";
      const endTime   = shift.end_time   || "17:00";
      const clockIn  = status !== "absent" ? shiftClockIn(shift.shift_date, startTime, status === "late") : null;
      const clockOut = status !== "absent" ? shiftClockOut(shift.shift_date, endTime) : null;
      newAttRows.push({
        assignment_id: a.assignment_id,
        status,
        clock_in:  clockIn,
        clock_out: clockOut,
        marked_by: MANAGERS[shift.outlet_id] || 225,
        marked_at: new Date().toISOString(),
      });
    }
    const { error: attErr } = await supabase.from("attendance").insert(newAttRows);
    if (attErr) console.error("  Attendance insert error:", attErr.message);
    else console.log(`  ✓ Inserted ${newAttRows.length} attendance records`);

    // Add newly inserted to map so timesheets can use them
    for (const r of newAttRows) attMap[r.assignment_id] = r;
  }

  // ── 5. Fix missing clock times on existing records ──────────────────────────
  if (withBadTimes.length > 0) {
    console.log(`\nFixing ${withBadTimes.length} attendance records with missing clock times…`);
    for (const att of (existingAtt || []).filter(a => !a.clock_in || !a.clock_out)) {
      if (att.status === "absent") continue;
      const assign = assignments.find(x => x.assignment_id === att.assignment_id);
      const shift  = assign ? shiftMap[assign.shift_id] : null;
      if (!shift) continue;
      const clockIn  = att.clock_in  || shiftClockIn(shift.shift_date, shift.start_time, att.status === "late");
      const clockOut = att.clock_out || shiftClockOut(shift.shift_date, shift.end_time);
      await supabase.from("attendance")
        .update({ clock_in: clockIn, clock_out: clockOut })
        .eq("attendance_id", att.attendance_id);
    }
    console.log("  ✓ Clock times fixed");
  }

  // ── 6. Seed timesheet submissions for past assignments ──────────────────────
  console.log("\nSeeding timesheet submissions…");

  // Check existing timesheets to avoid duplicates
  const allStaffIds = [...new Set(assignments.map(a => a.staff_id))];
  const { data: existingTs } = await supabase
    .from("timesheets")
    .select("staff_id, log_date")
    .in("staff_id", allStaffIds)
    .is("task_id", null);

  const tsKey = s => `${s.staff_id}_${s.log_date}`;
  const existingTsSet = new Set((existingTs || []).map(tsKey));

  // Group assignments by staff + shift_date to avoid duplicate dates
  // (a staff might be assigned to multiple shifts same day — pick one)
  const covered = new Map(); // `staffId_date` -> assignment
  for (const a of assignments) {
    const shift = shiftMap[a.shift_id];
    if (!shift) continue;
    const k = `${a.staff_id}_${shift.shift_date}`;
    if (!covered.has(k)) covered.set(k, { assignment: a, shift });
  }

  const tsRows = [];
  for (const [k, { assignment: a, shift }] of covered) {
    if (existingTsSet.has(k)) continue; // already submitted

    const att = attMap[a.assignment_id];
    if (!att || att.status === "absent") continue; // don't submit for absent days

    const daysAgo = Math.ceil((new Date(today) - new Date(shift.shift_date + "T00:00:00")) / 86400000);

    // Decide status: older shifts more likely resolved, recent more likely pending
    let status;
    if (daysAgo > 10) {
      const r = Math.random();
      status = r < 0.7 ? "approved" : r < 0.85 ? "rejected" : "pending";
    } else if (daysAgo > 4) {
      const r = Math.random();
      status = r < 0.5 ? "approved" : r < 0.65 ? "rejected" : "pending";
    } else {
      // Very recent: mostly pending
      status = Math.random() < 0.7 ? "pending" : "approved";
    }

    // Skip ~20% of shifts (staff didn't bother submitting for those)
    if (Math.random() < 0.2) continue;

    const hours = att.clock_in && att.clock_out
      ? Math.round(hoursWorked(att.clock_in, att.clock_out) * 2) / 2
      : parseFloat((4 + Math.random() * 4).toFixed(1));

    const managerId = MANAGERS[shift.outlet_id] || 225;

    tsRows.push({
      staff_id:    a.staff_id,
      log_date:    shift.shift_date,
      hours_worked: hours,
      description: pick(TASK_DESCRIPTIONS),
      status,
      reviewed_by:  status !== "pending" ? managerId : null,
      reviewed_at:  status !== "pending" ? new Date(new Date(shift.shift_date + "T18:00:00+08:00").getTime() + 86400000 * 2).toISOString() : null,
      task_id:      null,
      project_id:   null,
    });
  }

  if (tsRows.length === 0) {
    console.log("  All timesheets already seeded.");
  } else {
    // Insert in chunks to avoid payload limits
    const CHUNK = 100;
    let inserted = 0;
    for (let i = 0; i < tsRows.length; i += CHUNK) {
      const chunk = tsRows.slice(i, i + CHUNK);
      const { error: tsErr } = await supabase.from("timesheets").insert(chunk);
      if (tsErr) console.error(`  Chunk ${i/CHUNK+1} error:`, tsErr.message);
      else inserted += chunk.length;
    }
    console.log(`  ✓ Inserted ${inserted} timesheet submissions`);

    const pending  = tsRows.filter(r => r.status === "pending").length;
    const approved = tsRows.filter(r => r.status === "approved").length;
    const rejected = tsRows.filter(r => r.status === "rejected").length;
    console.log(`     Pending: ${pending}  Approved: ${approved}  Rejected: ${rejected}`);
  }

  console.log("\n=== Done! ===");
}

run().catch(err => { console.error(err); process.exit(1); });
