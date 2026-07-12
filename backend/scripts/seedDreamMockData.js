require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const supabaseAdmin = require("../src/config/supabaseAdmin");

// ── Dream business constants (from DB) ───────────────────────────────────────
const BUSINESS_ID = 23;
const OUTLETS = [
  { outlet_id: 55, name: "Downtown" },
  { outlet_id: 56, name: "Midtown" },
  { outlet_id: 57, name: "Uptown" },
];
const MANAGERS = { 55: 225, 56: 230, 57: 231 }; // outlet_id -> user_id

// Regular staff per outlet
const REGULAR_STAFF = {
  55: [131,132,154,155,156,157,158,159,160,161],
  56: [144,145,146,147,148,149,150,151,152,153],
  57: [134,135,136,137,138,139,140,141,142,143],
};
// Casual staff per outlet
const CASUAL_STAFF = {
  55: [133,162,164,167,169],
  56: [163,166,168,170],
  57: [165,170],
};

const LEAVE_TYPES = ["annual", "medical", "emergency"];
const LEAVE_REASONS = {
  annual:    ["Family vacation", "Personal trip", "Rest and recovery", "Attending a wedding"],
  medical:   ["Feeling unwell", "Doctor appointment", "Dental procedure", "Recovery from illness"],
  emergency: ["Family emergency", "Urgent personal matter", "Home emergency"],
  unpaid:    ["Personal reasons", "Attending a course", "Extended break"],
};
const SWAP_REASONS = [
  "Have a prior commitment", "Family event", "Doctor appointment",
  "Personal matter", "Clash with another schedule", "Not available that day",
];

function dateStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

async function clearDreamData(supabase) {
  console.log("Clearing existing Dream shift data…");
  const outletIds = OUTLETS.map(o => o.outlet_id);
  const { data: existingShifts } = await supabase.from("shifts").select("shift_id").in("outlet_id", outletIds);
  const shiftIds = (existingShifts || []).map(s => s.shift_id);

  if (shiftIds.length > 0) {
    const { data: assignments } = await supabase.from("shift_assignments").select("assignment_id").in("shift_id", shiftIds);
    const assignIds = (assignments || []).map(a => a.assignment_id);
    if (assignIds.length > 0) {
      await supabase.from("attendance").delete().in("assignment_id", assignIds);
      await supabase.from("shift_assignments").delete().in("assignment_id", assignIds);
    }
    await supabase.from("shift_roles").delete().in("shift_id", shiftIds);
    await supabase.from("shifts").delete().in("shift_id", shiftIds);
  }

  // Clear leave + swap for Dream staff
  const allStaffIds = Object.values(REGULAR_STAFF).flat().concat(Object.values(CASUAL_STAFF).flat());
  await supabase.from("availability").delete().in("staff_id", allStaffIds);
  await supabase.from("swap_requests").delete().in("requester_id", allStaffIds);
  await supabase.from("casual_requests").delete().eq("business_id", BUSINESS_ID);

  console.log("  ✓ Cleared old data");
}

async function seedShifts(supabase) {
  console.log("\nSeeding shifts…");
  const SHIFT_CONFIGS = [
    { title: "Morning Shift",   start: "07:00", end: "13:00", type: "regular" },
    { title: "Afternoon Shift", start: "13:00", end: "19:00", type: "regular" },
    { title: "Evening Shift",   start: "19:00", end: "23:00", type: "regular" },
  ];
  const shiftRows = [];
  // Past 2 weeks + current week + next 2 weeks = -14 to +14
  for (let d = -14; d <= 14; d++) {
    const date = dateStr(d);
    for (const outlet of OUTLETS) {
      const config = d < 0 || d === 0
        ? pick([SHIFT_CONFIGS[0], SHIFT_CONFIGS[1], SHIFT_CONFIGS[2]])
        : null;
      // 2 shifts per day per outlet
      const configs = d < -1
        ? [SHIFT_CONFIGS[0], SHIFT_CONFIGS[1]]
        : [SHIFT_CONFIGS[0], SHIFT_CONFIGS[1], SHIFT_CONFIGS[2]].slice(0, 2);
      for (const cfg of configs) {
        shiftRows.push({
          outlet_id: outlet.outlet_id,
          title: cfg.title,
          shift_date: date,
          start_time: cfg.start,
          end_time: cfg.end,
          status: d < -1 ? "completed" : d <= 1 ? "published" : "draft",
          created_by: MANAGERS[outlet.outlet_id],
          shift_type: "regular",
        });
      }
    }
  }

  const { data: shifts, error } = await supabase.from("shifts").insert(shiftRows).select("shift_id, outlet_id, shift_date, status");
  if (error) { console.error("  Shifts error:", error.message); return []; }
  console.log(`  ✓ ${shifts.length} shifts created`);
  return shifts;
}

async function seedShiftRoles(supabase, shifts) {
  console.log("\nSeeding shift roles…");
  const { data: templates } = await supabase
    .from("outlet_role_templates")
    .select("outlet_id, role_name, skill_id, headcount")
    .in("outlet_id", OUTLETS.map(o => o.outlet_id));

  const templatesByOutlet = {};
  (templates || []).forEach(t => {
    if (!templatesByOutlet[t.outlet_id]) templatesByOutlet[t.outlet_id] = [];
    templatesByOutlet[t.outlet_id].push(t);
  });

  const roleRows = [];
  for (const shift of shifts) {
    const outletTemplates = templatesByOutlet[shift.outlet_id] || [];
    const picked = pickN(outletTemplates, 2 + Math.floor(Math.random() * 2));
    for (const t of picked) {
      roleRows.push({
        shift_id: shift.shift_id,
        role_name: t.role_name,
        skill_id: t.skill_id,
        headcount: t.headcount || 2,
      });
    }
  }

  if (roleRows.length === 0) { console.log("  No role templates found, skipping"); return []; }
  const { data: roles, error } = await supabase.from("shift_roles").insert(roleRows).select("role_id, shift_id");
  if (error) { console.error("  Shift roles error:", error.message); return []; }
  console.log(`  ✓ ${roles.length} shift roles created`);
  return roles;
}

async function seedAssignments(supabase, shifts, roles) {
  console.log("\nSeeding shift assignments…");
  // Build a map: shift_id -> [role_id, ...]
  const rolesByShift = {};
  for (const r of (roles || [])) {
    if (!rolesByShift[r.shift_id]) rolesByShift[r.shift_id] = [];
    rolesByShift[r.shift_id].push(r.role_id);
  }

  const assignRows = [];
  for (const shift of shifts) {
    if (shift.status === "draft") continue;
    const regularStaff = REGULAR_STAFF[shift.outlet_id] || [];
    if (regularStaff.length === 0) continue;
    const shiftRoleIds = rolesByShift[shift.shift_id] || [];
    if (shiftRoleIds.length === 0) continue;
    const count = 3 + Math.floor(Math.random() * 3);
    const picked = pickN(regularStaff, count);
    for (const staffId of picked) {
      assignRows.push({
        shift_id: shift.shift_id,
        role_id: pick(shiftRoleIds),
        staff_id: staffId,
        status: shift.status === "completed" ? "completed" : "assigned",
        acknowledged: shift.status === "completed" ? true : Math.random() > 0.3,
      });
    }
  }

  const { data: assignments, error } = await supabase.from("shift_assignments").insert(assignRows).select("assignment_id, shift_id, staff_id, status");
  if (error) { console.error("  Assignments error:", error.message); return []; }
  console.log(`  ✓ ${assignments.length} assignments created`);
  return assignments;
}

async function seedAttendance(supabase, assignments, shifts) {
  console.log("\nSeeding attendance…");
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s.shift_id] = s; });

  const completedAssignments = assignments.filter(a => {
    const shift = shiftMap[a.shift_id];
    return shift?.status === "completed";
  });

  const attRows = [];
  const managerId = MANAGERS[55]; // use any manager for marking
  for (const a of completedAssignments) {
    const shift = shiftMap[a.shift_id];
    if (!shift) continue;
    const rand = Math.random();
    const status = rand > 0.1 ? "present" : rand > 0.05 ? "late" : "absent";
    const baseDate = shift.shift_date + "T" + (shift.start_time || "09:00") + ":00";
    const clockIn = status !== "absent" ? new Date(new Date(baseDate).getTime() + (status === "late" ? 15 : -5) * 60000).toISOString() : null;
    const clockOut = status !== "absent" ? new Date(new Date(baseDate).getTime() + (6 * 3600000)).toISOString() : null;

    attRows.push({
      assignment_id: a.assignment_id,
      clock_in: clockIn,
      clock_out: clockOut,
      status,
      marked_by: MANAGERS[shift.outlet_id] || managerId,
      marked_at: new Date().toISOString(),
    });
  }

  const { error } = await supabase.from("attendance").insert(attRows);
  if (error) console.error("  Attendance error:", error.message);
  else console.log(`  ✓ ${attRows.length} attendance records created`);
}

async function seedLeaveRequests(supabase, assignments) {
  console.log("\nSeeding leave requests…");
  const rows = [];
  const assignedStaffIds = [...new Set(assignments.map(a => a.staff_id))];
  // Pick ~30% of regular staff to have leave requests
  const withLeave = pickN(assignedStaffIds, Math.ceil(assignedStaffIds.length * 0.3));

  for (const staffId of withLeave) {
    const leaveType = pick(LEAVE_TYPES);
    const startOffset = Math.floor(Math.random() * 20) - 5; // -5 to +15 days
    const duration = 1 + Math.floor(Math.random() * 3);
    const status = startOffset < 0 ? pick(["approved","rejected"]) : pick(["pending","approved"]);
    rows.push({
      staff_id: staffId,
      leave_type: leaveType,
      start_date: dateStr(startOffset),
      end_date: dateStr(startOffset + duration),
      reason: pick(LEAVE_REASONS[leaveType]),
      status,
      reviewed_by: status !== "pending" ? MANAGERS[55] : null,
      reviewed_at: status !== "pending" ? new Date().toISOString() : null,
    });
  }

  const { error } = await supabase.from("availability").insert(rows);
  if (error) console.error("  Leave requests error:", error.message);
  else console.log(`  ✓ ${rows.length} leave requests created`);
}

async function seedSwapRequests(supabase, assignments, shifts) {
  console.log("\nSeeding swap requests…");
  const shiftMap = {};
  shifts.forEach(s => { shiftMap[s.shift_id] = s; });

  // Get published shift assignments per outlet
  const publishedAssignments = assignments.filter(a => shiftMap[a.shift_id]?.status === "published");
  if (publishedAssignments.length < 4) { console.log("  Not enough published assignments"); return; }

  const rows = [];
  // Create ~8 swap/replacement requests
  const used = new Set();
  let attempts = 0;
  while (rows.length < 8 && attempts < 50) {
    attempts++;
    const reqAssign = pick(publishedAssignments);
    if (used.has(reqAssign.assignment_id)) continue;
    used.add(reqAssign.assignment_id);

    const outletId = shiftMap[reqAssign.shift_id]?.outlet_id;
    const sameOutletStaff = REGULAR_STAFF[outletId] || [];
    const others = sameOutletStaff.filter(id => id !== reqAssign.staff_id);
    const isSwap = Math.random() > 0.4;
    const targetStaffId = others.length > 0 ? pick(others) : null;
    const targetAssign = isSwap && targetStaffId
      ? publishedAssignments.find(a => a.staff_id === targetStaffId && a.shift_id !== reqAssign.shift_id)
      : null;

    const status = pick(["pending", "pending", "approved", "rejected"]);
    rows.push({
      requester_id: reqAssign.staff_id,
      requester_assign: reqAssign.assignment_id,
      target_staff_id: targetStaffId,
      target_assign_id: targetAssign?.assignment_id || null,
      request_type: isSwap ? "swap" : "replacement",
      reason: pick(SWAP_REASONS),
      status,
      manager_id: MANAGERS[outletId] || MANAGERS[55],
      manager_decided_at: status !== "pending" ? new Date().toISOString() : null,
      responded_at: status === "approved" && targetStaffId ? new Date().toISOString() : null,
    });
  }

  const { error } = await supabase.from("swap_requests").insert(rows);
  if (error) console.error("  Swap requests error:", error.message);
  else console.log(`  ✓ ${rows.length} swap/replacement requests created`);
}

async function seedCasualRequests(supabase, shifts) {
  console.log("\nSeeding casual requests…");
  // Casual requests for upcoming shifts
  const futureDraftShifts = shifts.filter(s => s.status === "draft").slice(0, 12);
  if (futureDraftShifts.length === 0) { console.log("  No draft shifts found"); return; }

  const rows = [];
  for (const shift of futureDraftShifts) {
    const outletTemplates_res = await supabaseAdmin
      .from("outlet_role_templates").select("role_name, headcount").eq("outlet_id", shift.outlet_id).limit(1);
    const tmpl = outletTemplates_res.data?.[0];
    rows.push({
      outlet_id: shift.outlet_id,
      business_id: BUSINESS_ID,
      created_by: MANAGERS[shift.outlet_id],
      role_name: tmpl?.role_name || "General Staff",
      work_date: shift.shift_date,
      start_time: "09:00",
      end_time: "17:00",
      headcount: 1 + Math.floor(Math.random() * 2),
      notes: pick(["Please bring your own uniform.", "Training will be provided.", "Report to front desk.", ""]),
      status: pick(["open", "open", "filled", "cancelled"]),
    });
  }

  const { error } = await supabase.from("casual_requests").insert(rows);
  if (error) console.error("  Casual requests error:", error.message);
  else console.log(`  ✓ ${rows.length} casual requests created`);
}

async function seedNotifications(supabase) {
  console.log("\nSeeding notifications…");
  const rows = [];
  const managerUserIds = Object.values(MANAGERS);
  const msgs = [
    { type: "leave_request",   title: "New Leave Request",        message: "Lionel Messi submitted a leave request for 3 days." },
    { type: "swap_request",    title: "Shift Swap Request",       message: "Cristiano Ronaldo requested a shift swap with Alex Tan." },
    { type: "attendance",      title: "Attendance Alert",         message: "2 staff members were marked absent for Morning Shift." },
    { type: "casual_request",  title: "Casual Request Filled",    message: "Your casual request for General Staff has been filled." },
    { type: "shift",           title: "New Shift Published",      message: "Morning Shift on 14 Jul has been published." },
    { type: "swap_request",    title: "Replacement Request",      message: "Sam Lee requested a replacement for Evening Shift." },
    { type: "leave_request",   title: "Leave Approved",           message: "Taylor Ng's annual leave has been approved." },
  ];
  for (const uid of managerUserIds) {
    for (const m of pickN(msgs, 4)) {
      rows.push({
        recipient_id: uid,
        type: m.type,
        title: m.title,
        message: m.message,
        is_read: Math.random() > 0.5,
        related_entity: m.type,
        related_id: "1",
      });
    }
  }

  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("  Notifications error:", error.message);
  else console.log(`  ✓ ${rows.length} notifications created`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  console.log("=== Seeding full mock data for Dream business ===\n");
  const s = supabaseAdmin;

  await clearDreamData(s);
  const shifts      = await seedShifts(s);
  const roles       = await seedShiftRoles(s, shifts);
  const assignments = await seedAssignments(s, shifts, roles);
  await seedAttendance(s, assignments, shifts);
  await seedLeaveRequests(s, assignments);
  await seedSwapRequests(s, assignments, shifts);
  await seedCasualRequests(s, shifts);
  await seedNotifications(s);

  console.log("\n=== Done! Dream business mock data is ready. ===");
}

run().catch(console.error);
