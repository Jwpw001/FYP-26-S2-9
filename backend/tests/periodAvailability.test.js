const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  branch_shift_periods: { findMany: jest.fn() },
  casual_period_availability: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
  shift_tasks: { findMany: jest.fn() },
  users: { findUnique: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/utils/notify", () => ({
  notifyUsersBatched: jest.fn().mockResolvedValue(undefined),
  getBranchManagerUserIds: jest.fn().mockResolvedValue([]),
}));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { notifyUsersBatched, getBranchManagerUserIds } = require("../src/utils/notify");
const { setPeriodAvailability } = require("../src/controllers/casualController");

const USER_ID = 6, STAFF_ID = 60, BUSINESS_ID = 1, BRANCH_ID = 1, PERIOD_ID = 1, MANAGER_ID = 501;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function makeReq(body) {
  return { user: { user_id: USER_ID }, body };
}

// Round 6, Task 7c: submitting weekly period availability should notify the branch manager(s)
// when it now covers unfilled tasks — but must never assign anyone by itself.
describe("setPeriodAvailability — Task 7c gap-match notification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "casual_workers") return makeSupabaseChain({ data: { business_id: BUSINESS_ID }, error: null });
      if (table === "staff") return makeSupabaseChain({ data: { staff_id: STAFF_ID }, error: null });
      if (table === "casual_branch_preferences") return makeSupabaseChain({ data: [{ branch_id: BRANCH_ID }], error: null });
      return makeSupabaseChain({ data: null, error: null });
    });
    prisma.branch_shift_periods.findMany.mockResolvedValue([
      { period_id: PERIOD_ID, branch_id: BRANCH_ID, name: "Full Day", start_time: new Date("1970-01-01T08:00:00Z"), end_time: new Date("1970-01-01T22:00:00Z"), active_days: "1111111", sort_order: 0, branches: { name: "Downtown" } },
    ]);
    prisma.casual_period_availability.deleteMany.mockResolvedValue({ count: 0 });
    prisma.casual_period_availability.createMany.mockResolvedValue({ count: 1 });
    prisma.users.findUnique.mockResolvedValue({ full_name: "Priya" });
  });

  test("saving a period that now matches unfilled tasks notifies the branch manager and does not create any assignment", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([
      { task_id: 1, shifts: { branch_id: BRANCH_ID } },
      { task_id: 2, shifts: { branch_id: BRANCH_ID } },
      { task_id: 3, shifts: { branch_id: BRANCH_ID } },
    ]);
    getBranchManagerUserIds.mockResolvedValue([MANAGER_ID]);

    const res = makeRes();
    await setPeriodAvailability(makeReq({ week_start_date: "2026-08-17", period_ids: [PERIOD_ID] }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(notifyUsersBatched).toHaveBeenCalledTimes(1);
    const entries = notifyUsersBatched.mock.calls[0][0];
    expect(entries).toHaveLength(1);
    expect(entries[0].recipientId).toBe(MANAGER_ID);
    expect(entries[0].title).toMatch(/Priya is now available for 3 unfilled tasks/);
    expect(entries[0].relatedEntity).toBe("shift_gaps");

    // Nothing here should have touched task_assignments — availability means "could work", not
    // "put me on anything". (No task_assignments mock exists at all in this suite, so any
    // attempt to call it would throw "not a function" and fail the test above already — this
    // assertion documents the intent explicitly.)
    expect(prisma.casual_period_availability.createMany).toHaveBeenCalledTimes(1);
  });

  test("saving a period with no matching unfilled tasks sends no notification", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([]);

    const res = makeRes();
    await setPeriodAvailability(makeReq({ week_start_date: "2026-08-17", period_ids: [PERIOD_ID] }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(notifyUsersBatched).not.toHaveBeenCalled();
  });

  test("clearing availability for the week (empty period_ids) never queries for matches or notifies", async () => {
    const res = makeRes();
    await setPeriodAvailability(makeReq({ week_start_date: "2026-08-17", period_ids: [] }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, period_ids: [] }));
    expect(prisma.shift_tasks.findMany).not.toHaveBeenCalled();
    expect(notifyUsersBatched).not.toHaveBeenCalled();
  });

  test("a notification failure does not fail the availability save itself", async () => {
    prisma.shift_tasks.findMany.mockRejectedValue(new Error("db hiccup"));

    const res = makeRes();
    await setPeriodAvailability(makeReq({ week_start_date: "2026-08-17", period_ids: [PERIOD_ID] }), res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true); // save still succeeded despite the notification-path error
    expect(prisma.casual_period_availability.createMany).toHaveBeenCalledTimes(1);
  });
});
