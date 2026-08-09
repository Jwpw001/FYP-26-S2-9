const cron = require("node-cron");
const prisma = require("../config/prisma");
const logger = require("../config/logger");
const { generateShiftsForBranch, ROLLING_HORIZON_DAYS } = require("../controllers/shiftGenerationController");

function toDateStr(d) {
  return d.toISOString().slice(0, 10);
}

// Keeps a rolling ROLLING_HORIZON_DAYS-day window of generated shifts topped up for every
// active branch. Idempotent by construction (generateShiftsForBranch skips any date that
// already has a shift), so running this daily just extends the horizon by one day each time
// rather than re-doing prior work.
async function keepRollingHorizonGenerated() {
  try {
    const branches = await prisma.branches.findMany({ where: { deleted_at: null }, select: { branch_id: true } });
    if (branches.length === 0) return;

    const today = new Date();
    const end = new Date(today);
    end.setUTCDate(end.getUTCDate() + ROLLING_HORIZON_DAYS);
    const startDateStr = toDateStr(today);
    const endDateStr = toDateStr(end);

    for (const b of branches) {
      try {
        const { created } = await generateShiftsForBranch(b.branch_id, startDateStr, endDateStr);
        if (created.length > 0) {
          logger.info({ branch_id: b.branch_id, created: created.length }, "[keepRollingHorizonGenerated] generated shifts");
        }
      } catch (err) {
        logger.error({ err, branch_id: b.branch_id }, "[keepRollingHorizonGenerated] branch failed");
      }
    }
  } catch (err) {
    logger.error({ err }, "[keepRollingHorizonGenerated] error");
  }
}

function startShiftGenerationJobs() {
  // Every day at 02:00 UTC (10:00 SGT) — well clear of the daily report-reminder/digest jobs.
  cron.schedule("0 2 * * *", keepRollingHorizonGenerated);
}

module.exports = { startShiftGenerationJobs, keepRollingHorizonGenerated };
