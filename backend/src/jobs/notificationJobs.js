const cron = require("node-cron");
const OpenAI = require("openai");
const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUser } = require("../utils/notify");
const logger = require("../config/logger");
const { buildBriefMessages } = require("../services/aiAssistantService");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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
    // Round 6, Task 6: the casual-facing submission UI now writes to casual_period_availability
    // instead of casual_availability, so "submitted" is checked against the new table — reading
    // the old one here would report every casual as missing forever, since nothing writes to it
    // any more.
    const submitted = await prisma.casual_period_availability.findMany({
      where: { week_start_date: new Date(`${weekStartStr}T00:00:00.000Z`), staff_id: { in: staffIds } },
      select: { staff_id: true },
      distinct: ["staff_id"],
    });
    const submittedIds = new Set(submitted.map(r => r.staff_id));

    const missing = casualStaff.filter(s => !submittedIds.has(s.staff_id));
    for (const s of missing) {
      await notifyUser({
        recipientId: s.user_id,
        type: "availability_reminder",
        title: "Submit Your Availability",
        message: `You haven't submitted your availability for the week of ${weekStartStr} yet. Please submit it soon.`,
        relatedEntity: "casual_period_availability",
        relatedId: s.staff_id,
      });
    }
  } catch (err) {
    logger.error({ err }, "[remindMissingAvailability] error");
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
    logger.error({ err }, "[remindMissingReports] error");
  }
}

// Runs every Monday at 00:00 UTC (= 08:00 SGT) — sends an AI weekly digest to all branch managers.
async function sendMondayDigest() {
  try {
    const { data: bm } = await supabaseAdmin
      .from("branch_managers")
      .select("user_id");
    if (!bm?.length) return;

    const uniqueIds = [...new Set(bm.map((r) => r.user_id))];
    for (const userId of uniqueIds) {
      try {
        const messages = await buildBriefMessages(
          userId,
          "manager",
          "It's the start of a new week. Give me a weekly digest — what happened recently, what's coming up this week, and what needs action right now. Max 5 bullet points."
        );
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 400,
          temperature: 0.3,
        });
        await notifyUser({
          recipientId: userId,
          type: "ai_weekly_digest",
          title: "AI Weekly Digest",
          message: completion.choices[0].message.content,
        });
      } catch (err) {
        logger.error({ err, userId }, "[Monday digest] manager digest failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "[sendMondayDigest] error");
  }
}

// Runs daily at 23:00 UTC (= 07:00 SGT next day) — suggests staff for tomorrow's understaffed shifts.
async function suggestUnderstaffedShifts() {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const shifts = await prisma.shifts.findMany({
      where: {
        shift_date: { gte: tomorrow, lt: dayAfter },
        status: { in: ["open", "published"] },
      },
      include: {
        shift_tasks: { select: { task_id: true } },
        task_assignments: { select: { assignment_id: true } },
      },
    });

    const understaffedBranchIds = [
      ...new Set(
        shifts
          .filter((s) => s.task_assignments.length < s.shift_tasks.length)
          .map((s) => s.branch_id)
      ),
    ];
    if (understaffedBranchIds.length === 0) return;

    const { data: managers } = await supabaseAdmin
      .from("branch_managers")
      .select("user_id, branch_id")
      .in("branch_id", understaffedBranchIds);
    if (!managers?.length) return;

    const uniqueManagerIds = [...new Set(managers.map((m) => m.user_id))];
    for (const userId of uniqueManagerIds) {
      try {
        const messages = await buildBriefMessages(
          userId,
          "manager",
          `There are understaffed shifts scheduled for tomorrow (${tomorrowStr}). Looking at my staff roster and their availability, who should I consider assigning to fill the open positions? Give specific name recommendations with one-line reasoning. Max 5 bullet points.`
        );
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 350,
          temperature: 0.3,
        });
        await notifyUser({
          recipientId: userId,
          type: "ai_shift_suggestion",
          title: "AI: Staff suggestions for tomorrow",
          message: completion.choices[0].message.content,
        });
      } catch (err) {
        logger.error({ err, userId }, "[suggestUnderstaffedShifts] manager suggestion failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "[suggestUnderstaffedShifts] error");
  }
}

function startNotificationJobs() {
  // Every Sunday at 18:00 UTC
  cron.schedule("0 18 * * 0", remindMissingAvailability);
  // Every day at 09:00 UTC
  cron.schedule("0 9 * * *", remindMissingReports);
  // Every Monday at 00:00 UTC (08:00 SGT) — weekly AI digest for managers
  cron.schedule("0 0 * * 1", sendMondayDigest);
  // Every day at 23:00 UTC (07:00 SGT next day) — staff suggestions for tomorrow's understaffed shifts
  cron.schedule("0 23 * * *", suggestUnderstaffedShifts);
}

module.exports = {
  startNotificationJobs,
  remindMissingAvailability,
  remindMissingReports,
  sendMondayDigest,
  suggestUnderstaffedShifts,
};
