const cron = require("node-cron");
const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUser } = require("../utils/notify");

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Runs every Sunday evening — reminds casual staff who haven't submitted availability for next week.
async function remindMissingAvailability() {
  try {
    const today = new Date();
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    const weekStartStr = toDateStr(nextMonday);

    const casualStaff = await prisma.staff.findMany({
      where: { staff_type: "casual", is_active: true },
      select: { staff_id: true, user_id: true },
    });
    if (casualStaff.length === 0) return;

    const staffIds = casualStaff.map(s => s.staff_id);
    const { data: submitted } = await supabaseAdmin
      .from("casual_availability")
      .select("staff_id")
      .eq("week_start_date", weekStartStr)
      .in("staff_id", staffIds);
    const submittedIds = new Set((submitted || []).map(r => r.staff_id));

    const missing = casualStaff.filter(s => !submittedIds.has(s.staff_id));
    for (const s of missing) {
      await notifyUser({
        recipientId: s.user_id,
        type: "availability_reminder",
        title: "Submit Your Availability",
        message: `You haven't submitted your availability for the week of ${weekStartStr} yet. Please submit it soon.`,
        relatedEntity: "casual_availability",
        relatedId: s.staff_id,
      });
    }
  } catch (err) {
    console.error("[remindMissingAvailability] error:", err.message);
  }
}

// Runs daily — reminds staff who completed a shift yesterday but haven't submitted a work report for it.
async function remindMissingReports() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = toDateStr(yesterday);

    const shifts = await prisma.shifts.findMany({
      where: { shift_date: new Date(`${dateStr}T00:00:00Z`), status: { not: "draft" } },
      select: {
        shift_id: true,
        title: true,
        task_assignments: {
          where: { staff_id: { not: null } },
          select: { staff_id: true, staff: { select: { user_id: true } } },
        },
      },
    });
    if (shifts.length === 0) return;

    const shiftIds = shifts.map(s => s.shift_id);
    const { data: submittedTs } = await supabaseAdmin
      .from("timesheets")
      .select("staff_id, shift_id")
      .in("shift_id", shiftIds);
    const submittedSet = new Set((submittedTs || []).map(t => `${t.staff_id}_${t.shift_id}`));

    for (const shift of shifts) {
      for (const a of shift.task_assignments) {
        if (!a.staff_id || submittedSet.has(`${a.staff_id}_${shift.shift_id}`)) continue;
        await notifyUser({
          recipientId: a.staff?.user_id,
          type: "report_reminder",
          title: "Submit Your Work Report",
          message: `You haven't submitted a report for ${shift.title || "your shift"} on ${dateStr} yet.`,
          relatedEntity: "shifts",
          relatedId: shift.shift_id,
        });
      }
    }
  } catch (err) {
    console.error("[remindMissingReports] error:", err.message);
  }
}

function startNotificationJobs() {
  // Every Sunday at 18:00 server time
  cron.schedule("0 18 * * 0", remindMissingAvailability);
  // Every day at 09:00 server time
  cron.schedule("0 9 * * *", remindMissingReports);
}

module.exports = { startNotificationJobs, remindMissingAvailability, remindMissingReports };
