// F2: casual auto-assign must not hand a task to a casual while a contracted-today regular is
// still below their contracted hours this week and free to take it. Dedicated file — the harness
// needs to distinguish several task_assignments.findMany call shapes precisely (gate same-date
// check, the shortfall week query, and the existing casual same-day/past-90-day/labor-rule
// queries), which is easier to get right in a purpose-built mock than bolted onto the existing
// autoAssignCasual.test.js harness.
const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  branches: { findUnique: jest.fn() },
  shifts: { findUnique: jest.fn() },
  task_assignments: { findFirst: jest.fn(), findMany: jest.fn(), groupBy: jest.fn(), create: jest.fn() },
  shift_tasks: { findUnique: jest.fn() },
  user_skill_tags: { findMany: jest.fn() },
  users: { findMany: jest.fn(), findUnique: jest.fn() },
  staff: { findMany: jest.fn() },
  casual_availability: { findMany: jest.fn() },
  casual_period_availability: { findMany: jest.fn() },
  casual_standing_availability: { findMany: jest.fn() },
  branch_shift_periods: { findMany: jest.fn() },
  timesheets: { findMany: jest.fn() },
  availability: { findMany: jest.fn() },
  off_day_requests: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/utils/notify", () => ({ notifyUser: jest.fn().mockResolvedValue(undefined) }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { autoAssignCasual } = require("../src/controllers/casualController");

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const BRANCH_ID = 9, BUSINESS_ID = 1, MANAGER_USER_ID = 500, SHIFT_ID = 1, TASK_ID = 1;
const CASUAL_STAFF_ID = 102, CASUAL_USER_ID = 202;
const REGULAR_STAFF_ID = 701, REGULAR_USER_ID = 801;
// 2026-08-10 is a Monday (dow=0).
const SHIFT_DATE_STR = "2026-08-10";
const SHIFT_DATE = new Date(`${SHIFT_DATE_STR}T00:00:00.000Z`);

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

// Global fixtures the precise task_assignments.findMany dispatcher below reads from — each test
// sets only what's relevant to it, everything else defaults to "no rows".
let fixture;

function resetFixtures() {
  fixture = {
    regularSameDate: [],   // gate: is this regular already assigned on the shift's date?
    regularWeekHours: [],  // shortfall query: hours already rostered this Monday-aligned week
    casualSameDay: [],     // existing: casual double-booking check
    casualPast90d: [],     // existing: casual attendance sub-score
    laborRuleAssignments: [], // existing (T-02): checkLaborRules batched prefetch
  };
}

function setupBaseline({ regularStaff = [], offDayRows = [], leaveRows = [] } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    switch (table) {
      case "branch_managers":
        return makeSupabaseChain({ data: { branch_id: BRANCH_ID }, error: null });
      case "casual_branch_preferences":
        return makeSupabaseChain({ data: [{ user_id: CASUAL_USER_ID }], error: null });
      case "casual_workers":
        return makeSupabaseChain({ data: [{ id: 1, user_id: CASUAL_USER_ID, status: "approved" }], error: null });
      case "branch_allocation_preferences":
        return makeSupabaseChain({ data: null, error: null });
      case "branch_settings":
        return makeSupabaseChain({ data: { work_hours_day: 8, max_work_hours_day: 12, max_consecutive_days: 6, allow_overtime: false }, error: null });
      default:
        return makeSupabaseChain({ data: null, error: null });
    }
  });

  prisma.branches.findUnique.mockResolvedValue({ branch_id: BRANCH_ID, business_id: BUSINESS_ID, name: "Test Branch" });
  prisma.shifts.findUnique.mockResolvedValue({
    shift_id: SHIFT_ID, branch_id: BRANCH_ID, shift_date: SHIFT_DATE, start_time: t("09:00"), end_time: t("13:00"),
  });
  prisma.task_assignments.findFirst.mockResolvedValue(null);
  prisma.shift_tasks.findUnique.mockResolvedValue({ title: "Cashier", start_time: t("09:00"), end_time: t("13:00"), skill_id: null });
  prisma.user_skill_tags.findMany.mockResolvedValue([]);
  prisma.users.findMany.mockResolvedValue([{ user_id: CASUAL_USER_ID, full_name: "Casey Casual" }]);
  prisma.users.findUnique.mockResolvedValue({ full_name: "Casey Casual" });

  // staff.findMany is called for two different purposes: the casual candidate pool
  // (where.staff_type === "casual") and F2's gate branchRegulars fetch
  // (where.staff_type === "regular") — dispatch on that.
  prisma.staff.findMany.mockImplementation(({ where }) => {
    if (where?.staff_type === "regular") return Promise.resolve(regularStaff);
    return Promise.resolve([{ staff_id: CASUAL_STAFF_ID, user_id: CASUAL_USER_ID }]);
  });

  prisma.off_day_requests.findMany.mockResolvedValue(offDayRows);
  prisma.availability.findMany.mockResolvedValue(leaveRows);
  prisma.task_assignments.groupBy.mockResolvedValue([]);
  prisma.casual_availability.findMany.mockResolvedValue([
    { staff_id: CASUAL_STAFF_ID, available_from: t("08:00"), available_to: t("18:00") },
  ]);
  prisma.casual_period_availability.findMany.mockResolvedValue([]);
  prisma.casual_standing_availability.findMany.mockResolvedValue([]);
  prisma.branch_shift_periods.findMany.mockResolvedValue([]);
  prisma.timesheets.findMany.mockResolvedValue([]);
  prisma.task_assignments.create.mockResolvedValue({ assignment_id: 999 });

  // Precise dispatch across every task_assignments.findMany shape this request can produce.
  prisma.task_assignments.findMany.mockImplementation(({ where }) => {
    if (where?.shift_id) return Promise.resolve(fixture.laborRuleAssignments); // checkLaborRules batch (T-02)
    const dateFilter = where?.shifts?.shift_date;
    const isRange = dateFilter && typeof dateFilter === "object" && !(dateFilter instanceof Date);
    if (where?.status) {
      // Existing casual-side queries (sameDayAssignments has no range, pastAssignments90d does).
      return Promise.resolve(isRange ? fixture.casualPast90d : fixture.casualSameDay);
    }
    // F2's own queries: gate same-date check (exact date) vs shortfall week query (range).
    return Promise.resolve(isRange ? fixture.regularWeekHours : fixture.regularSameDate);
  });
}

function makeReq() {
  return { body: { shift_id: SHIFT_ID, task_id: TASK_ID }, user: { user_id: MANAGER_USER_ID } };
}

describe("autoAssignCasual — F2 regular-shortfall gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetFixtures();
  });

  test("refuses the casual when a contracted regular is below contract and free that date", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "1111100", users: { full_name: "Rina Regular" } }],
    });
    // Rina is contracted Mon-Fri (40h/week at 8h/day) and has 0 hours rostered this week.

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.flagged).toBe(true);
    expect(body.reason).toMatch(/Rina Regular/);
    expect(body.reason).toMatch(/below contracted hours/);
    expect(prisma.task_assignments.create).not.toHaveBeenCalled(); // no assignment made at all
  });

  test("assigns the casual once that regular has reached contract this week", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "1111100", users: { full_name: "Rina Regular" } }],
    });
    // Rina's contracted 40h/week (Mon-Fri @ 8h) is already fully rostered via 5 earlier shifts.
    fixture.regularWeekHours = Array.from({ length: 5 }, (_, i) => ({
      staff_id: REGULAR_STAFF_ID,
      shifts: { start_time: t("09:00"), end_time: t("17:00") }, // 8h each
    }));

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(CASUAL_USER_ID);
  });

  test("assigns the casual when the only short regular is already booked that date", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "1111100", users: { full_name: "Rina Regular" } }],
    });
    fixture.regularSameDate = [{ staff_id: REGULAR_STAFF_ID }]; // already has a shift this date

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(CASUAL_USER_ID);
  });

  test("assigns the casual when the only short regular is on approved leave that date", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "1111100", users: { full_name: "Rina Regular" } }],
      leaveRows: [{ staff_id: REGULAR_STAFF_ID }],
    });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(CASUAL_USER_ID);
  });

  test("assigns the casual when the only short regular has an approved off-day for that date", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "1111100", users: { full_name: "Rina Regular" } }],
      offDayRows: [{ staff_id: REGULAR_STAFF_ID }],
    });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(CASUAL_USER_ID);
  });

  test("assigns the casual when no regular is contracted for the shift's weekday", async () => {
    setupBaseline({
      regularStaff: [{ staff_id: REGULAR_STAFF_ID, default_work_days: "0111111", users: { full_name: "Rina Regular" } }], // every day except Monday
    });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(CASUAL_USER_ID);
  });
});
