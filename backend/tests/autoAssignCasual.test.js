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
  timesheets: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/controllers/taskController", () => ({ checkLaborRules: jest.fn() }));
// Only reached once a candidate actually wins and gets assigned+notified — the two pre-existing
// filter-chain tests below return early and never touch this, but the Task 5 soft-penalty test
// does reach the full happy path.
jest.mock("../src/utils/notify", () => ({ notifyUser: jest.fn().mockResolvedValue(undefined) }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { checkLaborRules } = require("../src/controllers/taskController");
const { autoAssignCasual } = require("../src/controllers/casualController");

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const BRANCH_ID = 9, BUSINESS_ID = 1, MANAGER_USER_ID = 500, SHIFT_ID = 1, TASK_ID = 1;
const S1 = 101, S2 = 102, U1 = 201, U2 = 202;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

// task_assignments.findMany is called for two different purposes in autoAssignCasual — same-day
// double-booking rows (a plain Date equality filter on shifts.shift_date) and, since Round 6 Task
// 10, past-90-days assignments for the attendance sub-score (a {gte, lt} range filter on the same
// field). Both go through the single mocked function, so this dispatches on the shape of the
// `where` clause it was called with rather than call order, which would be fragile.
let mockSameDayAssignments = [];
let mockPast90dAssignments = [];

// Configures every dependency autoAssignCasual reaches on the "happy path" up to the candidate
// loop, shared across all three filter-chain scenarios below. Each test then overrides only the
// piece of data relevant to the failure mode it's exercising.
function setupBaseline() {
  supabaseAdmin.from.mockImplementation((table) => {
    switch (table) {
      case "branch_managers":
        return makeSupabaseChain({ data: { branch_id: BRANCH_ID }, error: null });
      case "casual_branch_preferences":
        return makeSupabaseChain({ data: [{ user_id: U1 }, { user_id: U2 }], error: null });
      case "casual_workers":
        return makeSupabaseChain({
          data: [
            { id: 1, user_id: U1, status: "approved" },
            { id: 2, user_id: U2, status: "approved" },
          ],
          error: null,
        });
      case "branch_allocation_preferences":
        return makeSupabaseChain({ data: null, error: null }); // use defaults
      default:
        return makeSupabaseChain({ data: null, error: null });
    }
  });

  prisma.branches.findUnique.mockResolvedValue({ branch_id: BRANCH_ID, business_id: BUSINESS_ID, name: "Test Branch" });
  prisma.shifts.findUnique.mockResolvedValue({
    shift_id: SHIFT_ID,
    branch_id: BRANCH_ID,
    shift_date: new Date("2026-08-10T00:00:00.000Z"), // Monday
    start_time: t("09:00"),
    end_time: t("13:00"),
  });
  prisma.task_assignments.findFirst.mockResolvedValue(null); // task not already assigned
  prisma.shift_tasks.findUnique.mockResolvedValue({ title: "Cashier", start_time: t("09:00"), end_time: t("13:00"), skill_id: null });
  prisma.user_skill_tags.findMany.mockResolvedValue([]);
  prisma.users.findMany.mockResolvedValue([
    { user_id: U1, full_name: "Worker One" },
    { user_id: U2, full_name: "Worker Two" },
  ]);
  prisma.staff.findMany.mockResolvedValue([
    { staff_id: S1, user_id: U1 },
    { staff_id: S2, user_id: U2 },
  ]);
  prisma.task_assignments.groupBy.mockResolvedValue([]); // no past assignments (workload dimension)
  prisma.casual_period_availability.findMany.mockResolvedValue([]);
  prisma.casual_standing_availability.findMany.mockResolvedValue([]);
  prisma.timesheets.findMany.mockResolvedValue([]); // no approved timesheets by default

  mockSameDayAssignments = [];
  mockPast90dAssignments = [];
  prisma.task_assignments.findMany.mockImplementation(({ where }) => {
    const isRangeFilter = where?.shifts?.shift_date && typeof where.shifts.shift_date === "object" && !(where.shifts.shift_date instanceof Date);
    return Promise.resolve(isRangeFilter ? mockPast90dAssignments : mockSameDayAssignments);
  });

  checkLaborRules.mockResolvedValue(null); // passes by default; overridden in the labor-rules test
}

function makeReq() {
  return { body: { shift_id: SHIFT_ID, task_id: TASK_ID }, user: { user_id: MANAGER_USER_ID } };
}

describe("autoAssignCasual filter chain", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupBaseline();
  });

  test("candidates with no submitted availability are excluded as unavailable", async () => {
    prisma.casual_availability.findMany.mockResolvedValue([]); // neither worker submitted availability

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.flagged).toBe(true);
    expect(body.reason).toMatch(/2 unavailable on Mon/);
    expect(body.reason).not.toMatch(/already booked/);
    expect(body.reason).not.toMatch(/labor limits/);
    expect(checkLaborRules).not.toHaveBeenCalled(); // never reached hard filter 3
  });

  test("candidates whose availability fully covers the task but who are double-booked are excluded", async () => {
    prisma.casual_availability.findMany.mockResolvedValue([
      { staff_id: S1, available_from: t("08:00"), available_to: t("18:00") },
      { staff_id: S2, available_from: t("08:00"), available_to: t("18:00") },
    ]);
    // Existing same-day assignment for both, overlapping the 09:00-13:00 task window
    mockSameDayAssignments = [
      { staff_id: S1, shifts: { start_time: t("10:00"), end_time: t("11:00") } },
      { staff_id: S2, shifts: { start_time: t("10:00"), end_time: t("11:00") } },
    ];

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.reason).toMatch(/2 already booked at this time/);
    expect(body.reason).not.toMatch(/unavailable/);
    expect(body.reason).not.toMatch(/labor limits/);
    expect(checkLaborRules).not.toHaveBeenCalled(); // never reached hard filter 3
  });

  // Round 3, Task 5: checkLaborRules moved from a hard filter to a soft score penalty — a
  // breaching candidate now ranks lower but still appears and can still be assigned.
  test("candidates who would exceed labor rules are ranked lower, not excluded, and the assignment still succeeds", async () => {
    prisma.casual_availability.findMany.mockResolvedValue([
      { staff_id: S1, available_from: t("08:00"), available_to: t("18:00") },
      { staff_id: S2, available_from: t("08:00"), available_to: t("18:00") },
    ]);
    // Only S2 would breach — S1 should win despite otherwise-identical sub-scores.
    checkLaborRules.mockImplementation(async (staffId) =>
      staffId === S2 ? "This would put the staff member over the branch's daily-hours limit." : null
    );
    prisma.users.findUnique.mockResolvedValue({ full_name: "Worker One" });
    prisma.task_assignments.create.mockResolvedValue({ assignment_id: 999 });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(U1); // the clean candidate, not the breaching one
    expect(body.assigned.labor_warning).toBeNull();
    expect(checkLaborRules).toHaveBeenCalledTimes(2); // once per surviving candidate, neither excluded

    const s1 = body.score_breakdown.candidates.find(c => c.user_id === U1);
    const s2 = body.score_breakdown.candidates.find(c => c.user_id === U2);
    expect(s1.labor_warning).toBeNull();
    expect(s2.labor_warning).toMatch(/daily-hours limit/);
    expect(s2.score).toBeLessThan(s1.score); // penalised, but still present in the breakdown
  });
});

// Round 6, Task 6: period-based availability. A shift with a period_id switches the hard
// filter from casual_availability's time-coverage check to the binary
// casual_period_availability / casual_standing_availability resolution below — a shift with no
// period_id (branch not using periods) keeps the exact behaviour covered above.
describe("autoAssignCasual — period-based availability", () => {
  const PERIOD_ID = 77;

  beforeEach(() => {
    jest.clearAllMocks();
    setupBaseline();
    // This branch's shift belongs to a shift period — switches the resolution path.
    prisma.shifts.findUnique.mockResolvedValue({
      shift_id: SHIFT_ID,
      branch_id: BRANCH_ID,
      shift_date: new Date("2026-08-10T00:00:00.000Z"), // Monday (day_of_week 0)
      start_time: t("09:00"),
      end_time: t("13:00"),
      period_id: PERIOD_ID,
    });
  });

  test("a shift without a period_id ignores period tables entirely and uses the old time-coverage check unchanged", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_id: SHIFT_ID, branch_id: BRANCH_ID,
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"), end_time: t("13:00"),
      period_id: null,
    });
    prisma.casual_availability.findMany.mockResolvedValue([
      { staff_id: S1, available_from: t("08:00"), available_to: t("18:00") },
    ]);
    prisma.users.findUnique.mockResolvedValue({ full_name: "Worker One" });
    prisma.task_assignments.create.mockResolvedValue({ assignment_id: 1 });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    expect(prisma.casual_period_availability.findMany).not.toHaveBeenCalled();
    expect(prisma.casual_standing_availability.findMany).not.toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(U1);
  });

  test("explicit weekly rows: a staff member with an explicit row for this exact period is available", async () => {
    prisma.casual_period_availability.findMany.mockResolvedValue([
      { staff_id: S1, period_id: PERIOD_ID },
    ]);
    prisma.users.findUnique.mockResolvedValue({ full_name: "Worker One" });
    prisma.task_assignments.create.mockResolvedValue({ assignment_id: 2 });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(U1);
    // Round 6, Task 10: availability is a gate, not a scored dimension any more — the breakdown
    // only carries skills/attendance/workload.
    const winnerBreakdown = body.score_breakdown.candidates.find(c => c.user_id === U1);
    expect(winnerBreakdown.sub_scores.availability).toBeUndefined();
    expect(Object.keys(winnerBreakdown.sub_scores).sort()).toEqual(["attendance", "skills", "workload"]);
  });

  test("explicit weekly rows for OTHER periods do not fall back to the standing pattern — resolution order is exact", async () => {
    const OTHER_PERIOD_ID = 88;
    // S1 explicitly submitted this week, but only ticked a different period.
    prisma.casual_period_availability.findMany.mockResolvedValue([
      { staff_id: S1, period_id: OTHER_PERIOD_ID },
    ]);
    // S1 also has a standing pattern that WOULD cover this period/day — must be ignored because
    // an explicit submission exists for this week at all.
    prisma.casual_standing_availability.findMany.mockResolvedValue([
      { staff_id: S1, period_id: PERIOD_ID },
    ]);

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.reason).toMatch(/unavailable/);
  });

  test("no explicit rows this week falls back to the standing pattern for this weekday", async () => {
    prisma.casual_period_availability.findMany.mockResolvedValue([]); // nothing explicit this week
    prisma.casual_standing_availability.findMany.mockResolvedValue([
      { staff_id: S1, period_id: PERIOD_ID }, // (mock already pre-filtered to this weekday)
    ]);
    prisma.users.findUnique.mockResolvedValue({ full_name: "Worker One" });
    prisma.task_assignments.create.mockResolvedValue({ assignment_id: 3 });

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.assigned.user_id).toBe(U1);
  });

  test("no explicit rows and no standing pattern excludes the candidate as unavailable", async () => {
    prisma.casual_period_availability.findMany.mockResolvedValue([]);
    prisma.casual_standing_availability.findMany.mockResolvedValue([]);

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.reason).toMatch(/2 unavailable on Mon/);
  });
});

// Round 6, Task 10: rebuilt allocation weights — availability/performance dropped from the
// score, attendance is now a real approved-timesheets ÷ assignments ratio over the trailing 90
// days (relative to the shift being filled), workload/skills unchanged.
describe("autoAssignCasual — attendance sub-score (Round 6, Task 10)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupBaseline();
    prisma.casual_availability.findMany.mockResolvedValue([
      { staff_id: S1, available_from: t("08:00"), available_to: t("18:00") },
      { staff_id: S2, available_from: t("08:00"), available_to: t("18:00") },
    ]);
    prisma.users.findUnique.mockResolvedValue({ full_name: "Worker One" });
    prisma.task_assignments.create.mockResolvedValue({ assignment_id: 42 });
  });

  test("a candidate with no assignments in the trailing 90 days scores the neutral 0.75, not 0 or 1", async () => {
    mockPast90dAssignments = []; // neither candidate has any history

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    const s1 = body.score_breakdown.candidates.find(c => c.user_id === U1);
    const s2 = body.score_breakdown.candidates.find(c => c.user_id === U2);
    expect(s1.sub_scores.attendance).toBe(0.75);
    expect(s2.sub_scores.attendance).toBe(0.75);
  });

  test("attendance is approved timesheets divided by past assignments, and a clean record outranks a spotty one", async () => {
    // S1: 4 past assignments, all 4 approved -> 1.0. S2: 4 past assignments, only 1 approved -> 0.25.
    mockPast90dAssignments = [
      { staff_id: S1, shift_id: 901 }, { staff_id: S1, shift_id: 902 }, { staff_id: S1, shift_id: 903 }, { staff_id: S1, shift_id: 904 },
      { staff_id: S2, shift_id: 911 }, { staff_id: S2, shift_id: 912 }, { staff_id: S2, shift_id: 913 }, { staff_id: S2, shift_id: 914 },
    ];
    prisma.timesheets.findMany.mockResolvedValue([
      { staff_id: S1, shift_id: 901 }, { staff_id: S1, shift_id: 902 }, { staff_id: S1, shift_id: 903 }, { staff_id: S1, shift_id: 904 },
      { staff_id: S2, shift_id: 911 },
    ]);

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    const s1 = body.score_breakdown.candidates.find(c => c.user_id === U1);
    const s2 = body.score_breakdown.candidates.find(c => c.user_id === U2);
    expect(s1.sub_scores.attendance).toBe(1);
    expect(s2.sub_scores.attendance).toBe(0.25);
    expect(body.assigned.user_id).toBe(U1); // the cleaner attendance record wins
  });

  test("a pending (not approved) timesheet does not count toward attendance", async () => {
    mockPast90dAssignments = [{ staff_id: S1, shift_id: 901 }];
    prisma.timesheets.findMany.mockResolvedValue([]); // approved-only query returns nothing — the row exists but is still "pending"

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    const s1 = body.score_breakdown.candidates.find(c => c.user_id === U1);
    expect(s1.sub_scores.attendance).toBe(0);
  });
});
