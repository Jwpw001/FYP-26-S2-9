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
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/controllers/taskController", () => ({ checkLaborRules: jest.fn() }));

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
  prisma.task_assignments.groupBy.mockResolvedValue([]); // no past assignments
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
    prisma.task_assignments.findMany.mockResolvedValue([]); // no same-day assignments either way

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
    prisma.task_assignments.findMany.mockResolvedValue([
      { staff_id: S1, shifts: { start_time: t("10:00"), end_time: t("11:00") } },
      { staff_id: S2, shifts: { start_time: t("10:00"), end_time: t("11:00") } },
    ]);

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.reason).toMatch(/2 already booked at this time/);
    expect(body.reason).not.toMatch(/unavailable/);
    expect(body.reason).not.toMatch(/labor limits/);
    expect(checkLaborRules).not.toHaveBeenCalled(); // never reached hard filter 3
  });

  test("candidates who pass availability and double-booking checks but would exceed labor rules are excluded", async () => {
    prisma.casual_availability.findMany.mockResolvedValue([
      { staff_id: S1, available_from: t("08:00"), available_to: t("18:00") },
      { staff_id: S2, available_from: t("08:00"), available_to: t("18:00") },
    ]);
    prisma.task_assignments.findMany.mockResolvedValue([]); // not double-booked
    checkLaborRules.mockResolvedValue("This would put the staff member over the branch's daily-hours limit.");

    const res = makeRes();
    await autoAssignCasual(makeReq(), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.reason).toMatch(/2 would exceed branch labor limits/);
    expect(body.reason).not.toMatch(/unavailable/);
    expect(body.reason).not.toMatch(/already booked/);
    expect(checkLaborRules).toHaveBeenCalledTimes(2); // once per surviving candidate
  });
});
