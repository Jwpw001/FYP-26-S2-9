jest.mock("../src/config/prisma", () => ({
  branch_settings: { findUnique: jest.fn() },
  branches: { findUnique: jest.fn() },
  branch_task_templates: { findMany: jest.fn() },
  staff: { findMany: jest.fn() },
  off_day_requests: { findMany: jest.fn() },
  public_holidays: { findMany: jest.fn() },
  shifts: { findFirst: jest.fn(), create: jest.fn() },
  shift_tasks: { createManyAndReturn: jest.fn(), update: jest.fn() },
  task_assignments: { create: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const { generateShiftsForBranch } = require("../src/controllers/shiftGenerationController");

const BRANCH_ID = 7;
const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// Baseline: an ordinary branch, open every day, no closures, no public-holiday interaction
// (treat_public_holidays_as_working: true skips that lookup entirely so most tests don't need
// to mock it), one template on Monday (Mon=0, matching the app's existing convention), no
// regular staff unless a test adds them, and every date is "fresh" (no existing shift) unless a
// test's shifts.findFirst override says otherwise.
function setupBaseline({ templates = [], regularStaff = [], offDayRows = [], holidays = [], existingShiftDates = [] } = {}) {
  prisma.branch_settings.findUnique.mockResolvedValue({
    branch_id: BRANCH_ID, operating_days: "1111111", holidays, treat_public_holidays_as_working: true,
  });
  prisma.branches.findUnique.mockResolvedValue({ open_time: t("09:00"), close_time: t("22:00") });
  prisma.branch_task_templates.findMany.mockResolvedValue(templates);
  prisma.staff.findMany.mockResolvedValue(regularStaff);
  prisma.off_day_requests.findMany.mockResolvedValue(offDayRows);
  prisma.shifts.findFirst.mockImplementation(({ where }) => {
    const dateStr = where.shift_date.toISOString().slice(0, 10);
    return Promise.resolve(existingShiftDates.includes(dateStr) ? { shift_id: 999, source: "generated" } : null);
  });
  let nextShiftId = 1;
  prisma.shifts.create.mockImplementation(() => Promise.resolve({ shift_id: nextShiftId++ }));
  let nextTaskId = 1;
  prisma.shift_tasks.createManyAndReturn.mockImplementation(({ data }) =>
    Promise.resolve(data.map(row => ({ ...row, task_id: nextTaskId++ })))
  );
  prisma.shift_tasks.update.mockResolvedValue({});
  prisma.task_assignments.create.mockResolvedValue({ assignment_id: 1 });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("generateShiftsForBranch — idempotency", () => {
  test("running generation twice over the same range does not duplicate shifts", async () => {
    const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };
    setupBaseline({ templates: [template] });

    // 2026-08-10 is a Monday.
    const first = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(first.created).toEqual(["2026-08-10"]);
    expect(prisma.shifts.create).toHaveBeenCalledTimes(1);

    // Second run: the mock's shifts.findFirst doesn't know about the shift created above unless
    // told to — simulate the DB now having it. jest.clearAllMocks() resets call counters so the
    // assertion below is scoped to this second run only.
    jest.clearAllMocks();
    setupBaseline({ templates: [template], existingShiftDates: ["2026-08-10"] });
    const second = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(second.created).toEqual([]);
    expect(second.skipped[0]).toMatchObject({ date: "2026-08-10", reason: "already generated" });
    expect(prisma.shifts.create).not.toHaveBeenCalled(); // not called again in this second run
  });
});

describe("generateShiftsForBranch — copy, never reference", () => {
  test("a template edit after generation does not alter the already-generated task", async () => {
    const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };
    setupBaseline({ templates: [template] });

    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10"); // Monday
    const firstCallRows = prisma.shift_tasks.createManyAndReturn.mock.calls[0][0].data;
    expect(firstCallRows[0].title).toBe("Cashier");

    // Simulate editing the template in the database, then generating a later, untouched Monday.
    jest.clearAllMocks();
    template.title = "Manager"; // same object reference the mock's findMany still returns
    setupBaseline({ templates: [template] }); // fresh mocks, but a genuinely later date
    await generateShiftsForBranch(BRANCH_ID, "2026-08-17", "2026-08-17"); // the following Monday
    const secondCallRows = prisma.shift_tasks.createManyAndReturn.mock.calls[0][0].data;

    // The new generation picks up the edit (expected)...
    expect(secondCallRows[0].title).toBe("Manager");
    // ...but the row data captured from the FIRST generation is a plain object snapshot, not a
    // reference into the template — proving the copy is real and the earlier assertion
    // (title: "Cashier") above is unaffected by the later template mutation.
    expect(firstCallRows[0].title).toBe("Cashier");
  });

  test("required_workers > 1 expands into that many separate task rows", async () => {
    const template = { day_of_week: 0, title: "Barista", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 3, sort_order: 0 };
    setupBaseline({ templates: [template] });

    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    const rows = prisma.shift_tasks.createManyAndReturn.mock.calls[0][0].data;
    expect(rows).toHaveLength(3);
    expect(rows.every(r => r.title === "Barista")).toBe(true);
  });
});

describe("generateShiftsForBranch — closures", () => {
  test("a date marked closed in branch_settings.holidays is skipped, not generated", async () => {
    const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };
    setupBaseline({ templates: [template], holidays: [{ date: "2026-08-10", name: "Renovation", enabled: true }] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(result.created).toEqual([]);
    expect(result.skipped[0]).toMatchObject({ date: "2026-08-10", reason: "marked closed / public holiday" });
    expect(prisma.shifts.create).not.toHaveBeenCalled();
  });

  test("a closure entry with enabled:false does not skip the date (it's a disabled/reopened entry)", async () => {
    const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };
    setupBaseline({ templates: [template], holidays: [{ date: "2026-08-10", name: "Some Holiday", enabled: false }] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(result.created).toEqual(["2026-08-10"]);
  });
});

describe("generateShiftsForBranch — regular staff auto-population", () => {
  const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };

  test("a regular staff member contracted for the weekday is auto-assigned to an open task", async () => {
    setupBaseline({
      templates: [template],
      regularStaff: [{ staff_id: 501, default_work_days: "1000000" }], // Monday only
    });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10"); // Monday
    expect(prisma.task_assignments.create).toHaveBeenCalledTimes(1);
    expect(prisma.task_assignments.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ staff_id: 501 }),
    }));
    expect(result.autoPopulated).toEqual([{ date: "2026-08-10", assigned_count: 1 }]);
  });

  test("a regular staff member NOT contracted for the weekday is left unassigned", async () => {
    setupBaseline({
      templates: [template],
      regularStaff: [{ staff_id: 501, default_work_days: "0111111" }], // every day except Monday
    });

    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10"); // Monday
    expect(prisma.task_assignments.create).not.toHaveBeenCalled();
  });

  test("an approved off-day request covering the date is respected — staff skipped that day", async () => {
    setupBaseline({
      templates: [template],
      regularStaff: [{ staff_id: 501, default_work_days: "1111111" }],
      offDayRows: [{ staff_id: 501, requested_date: new Date("2026-08-10T00:00:00.000Z") }],
    });

    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.task_assignments.create).not.toHaveBeenCalled();
  });

  test("a staff member with no default_work_days set is skipped and reported as a data gap, never guessed", async () => {
    setupBaseline({
      templates: [template],
      regularStaff: [{ staff_id: 501, default_work_days: null }],
    });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.task_assignments.create).not.toHaveBeenCalled();
    expect(result.dataGaps.staff_ids).toEqual([501]);
  });

  test("more contracted staff than open tasks leaves the rest genuinely open for casual allocation", async () => {
    setupBaseline({
      templates: [template], // required_workers: 1 → only one open task today
      regularStaff: [
        { staff_id: 501, default_work_days: "1111111" },
        { staff_id: 502, default_work_days: "1111111" },
      ],
    });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.task_assignments.create).toHaveBeenCalledTimes(1); // only one task existed
    expect(result.autoPopulated).toEqual([{ date: "2026-08-10", assigned_count: 1 }]);
  });
});
