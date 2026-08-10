const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  staff: { findFirst: jest.fn() },
  shift_tasks: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { getUnfilledTasks } = require("../src/controllers/taskController");

const BRANCH_ID = 9;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// Round 6, Task 7a: gaps view. Pin "today" to a known Wednesday (2026-08-12) so the urgency
// bucket boundaries (Tomorrow / This week / Next week / Later) are deterministic to assert on.
describe("getUnfilledTasks — urgency buckets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-08-12T10:00:00.000Z")); // Wed
    prisma.staff.findFirst.mockResolvedValue({ branch_id: BRANCH_ID });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function task(id, dateStr, title = "Cashier") {
    return {
      task_id: id, title, skill_id: null, start_time: t("09:00"), end_time: t("13:00"),
      skills: null,
      shifts: { shift_id: 100 + id, title: "Full Day", shift_date: new Date(`${dateStr}T00:00:00.000Z`), status: "draft" },
    };
  }

  test("buckets today, overdue, and tomorrow into 'Tomorrow'; this/next week and beyond into their own buckets", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([
      task(1, "2026-08-12"), // today (Wed) -> Tomorrow bucket
      task(2, "2026-08-13"), // tomorrow (Thu) -> Tomorrow bucket
      task(3, "2026-08-15"), // Sat, still this week (week ends Sun 08-16) -> This week
      task(4, "2026-08-16"), // Sun -> This week (last day of this week)
      task(5, "2026-08-20"), // next Thu -> Next week
      task(6, "2026-09-01"), // well beyond -> Later
    ]);

    const res = makeRes();
    await getUnfilledTasks({ user: { user_id: 1 } }, res);

    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    const byId = Object.fromEntries(body.gaps.map(g => [g.task_id, g.urgency]));
    expect(byId[1]).toBe("Tomorrow");
    expect(byId[2]).toBe("Tomorrow");
    expect(byId[3]).toBe("This week");
    expect(byId[4]).toBe("This week");
    expect(byId[5]).toBe("Next week");
    expect(byId[6]).toBe("Later");
  });

  test("results are sorted ascending by shift date", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([
      task(1, "2026-08-20"),
      task(2, "2026-08-13"),
      task(3, "2026-09-01"),
    ]);

    const res = makeRes();
    await getUnfilledTasks({ user: { user_id: 1 } }, res);

    // The controller relies on the DB orderBy for sorting — confirm the query asked for it.
    expect(prisma.shift_tasks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: [{ shifts: { shift_date: "asc" } }, { start_time: "asc" }] })
    );
  });

  test("only queries the caller's own branch, non-cancelled shifts, from today onward", async () => {
    prisma.shift_tasks.findMany.mockResolvedValue([]);

    const res = makeRes();
    await getUnfilledTasks({ user: { user_id: 1 } }, res);

    const call = prisma.shift_tasks.findMany.mock.calls[0][0];
    expect(call.where.status).toBe("open");
    expect(call.where.shifts.branch_id).toBe(BRANCH_ID);
    expect(call.where.shifts.status).toEqual({ not: "cancelled" });
    expect(call.where.shifts.shift_date.gte.toISOString().slice(0, 10)).toBe("2026-08-12");
  });

  test("falls back to branch_managers when the caller has no staff row", async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    supabaseAdmin.from.mockReturnValue(makeSupabaseChain({ data: { branch_id: 42 }, error: null }));
    prisma.shift_tasks.findMany.mockResolvedValue([]);

    const res = makeRes();
    await getUnfilledTasks({ user: { user_id: 1 } }, res);

    expect(prisma.shift_tasks.findMany.mock.calls[0][0].where.shifts.branch_id).toBe(42);
  });

  test("no branch resolvable returns 404", async () => {
    prisma.staff.findFirst.mockResolvedValue(null);
    supabaseAdmin.from.mockReturnValue(makeSupabaseChain({ data: null, error: null }));

    const res = makeRes();
    await getUnfilledTasks({ user: { user_id: 1 } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
