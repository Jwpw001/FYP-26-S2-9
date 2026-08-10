jest.mock("../src/config/prisma", () => ({
  branch_settings: { findUnique: jest.fn() },
  branches: { findUnique: jest.fn() },
  branch_task_templates: { findMany: jest.fn() },
  branch_shift_periods: { findMany: jest.fn() },
  staff: { findMany: jest.fn() },
  off_day_requests: { findMany: jest.fn() },
  public_holidays: { findMany: jest.fn() },
  shifts: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn() },
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
function setupBaseline({ templates = [], regularStaff = [], offDayRows = [], holidays = [], existingShiftDates = [], periods = [] } = {}) {
  prisma.branch_settings.findUnique.mockResolvedValue({
    branch_id: BRANCH_ID, operating_days: "1111111", holidays, treat_public_holidays_as_working: true,
  });
  prisma.branches.findUnique.mockResolvedValue({ open_time: t("09:00"), close_time: t("22:00") });
  prisma.branch_task_templates.findMany.mockResolvedValue(templates);
  // Round 6, Task 2: empty by default — every existing test in this file exercises the
  // no-periods path, which is exactly the regression guarantee this round depends on. Tests that
  // need periods pass their own `periods` array.
  prisma.branch_shift_periods.findMany.mockResolvedValue(periods);
  prisma.staff.findMany.mockResolvedValue(regularStaff);
  prisma.off_day_requests.findMany.mockResolvedValue(offDayRows);
  // Round 6, Task 4: generateShiftsForBranch now fetches every existing shift in the range with
  // one shifts.findMany call instead of one shifts.findFirst per date (was 57 sequential DB
  // round-trips for a no-op re-check — see the function's own comment). findFirst is kept mocked
  // above for any test that still reaches for it directly, but the generator itself no longer does.
  prisma.shifts.findMany.mockImplementation(() =>
    Promise.resolve(existingShiftDates.map(dateStr => ({ shift_id: 999, source: "generated", shift_date: new Date(`${dateStr}T00:00:00Z`), period_id: null })))
  );
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

// Round 6, Task 2 — shift periods. 2026-08-10 is a Monday (dow=0); 2026-08-16 is the following
// Sunday (dow=6).
describe("generateShiftsForBranch — shift periods", () => {
  const morning = { period_id: 1, branch_id: BRANCH_ID, name: "Morning", start_time: t("08:00"), end_time: t("16:00"), active_days: "1111111", sort_order: 0, is_active: true };
  const evening = { period_id: 2, branch_id: BRANCH_ID, name: "Evening", start_time: t("16:00"), end_time: t("23:59"), active_days: "1111111", sort_order: 1, is_active: true };

  test("the key regression guarantee: a branch with ONE full-day period generates identically to pre-round behaviour", async () => {
    const fullDay = { period_id: 9, branch_id: BRANCH_ID, name: "Full Day", start_time: t("09:00"), end_time: t("22:00"), active_days: "1111111", sort_order: 0, is_active: true };
    const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0, period_id: 9 };
    setupBaseline({ templates: [template], periods: [fullDay] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).toHaveBeenCalledTimes(1);
    expect(prisma.shifts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: "Full Day", start_time: t("09:00"), end_time: t("22:00"), period_id: 9 }),
    }));
    expect(result.created.length).toBe(1);
  });

  test("branch with two periods generates two shifts per operating day", async () => {
    const templates = [
      { day_of_week: 0, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 },
      { day_of_week: 0, title: "Bar Service", skill_id: null, start_time: t("16:00"), end_time: t("23:00"), required_workers: 1, sort_order: 0, period_id: 2 },
    ];
    setupBaseline({ templates, periods: [morning, evening] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).toHaveBeenCalledTimes(2);
    expect(result.created).toEqual(["2026-08-10 (Morning)", "2026-08-10 (Evening)"]);
  });

  test("a period with active_days excluding Sunday produces no Sunday shift for that period", async () => {
    const weekdayOnly = { ...evening, active_days: "1111110" }; // Mon-Sat, not Sun
    const templates = [
      { day_of_week: 6, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 },
      { day_of_week: 6, title: "Bar Service", skill_id: null, start_time: t("16:00"), end_time: t("23:00"), required_workers: 1, sort_order: 0, period_id: 2 },
    ];
    setupBaseline({ templates, periods: [morning, weekdayOnly] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-16", "2026-08-16"); // Sunday
    expect(prisma.shifts.create).toHaveBeenCalledTimes(1);
    expect(result.created).toEqual(["2026-08-16 (Morning)"]);
  });

  test("templates with null period_id land in one fallback shift covering branch operating hours", async () => {
    const templates = [
      { day_of_week: 0, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 },
      { day_of_week: 0, title: "Deep Clean", skill_id: null, start_time: t("06:00"), end_time: t("08:00"), required_workers: 1, sort_order: 0, period_id: null },
    ];
    setupBaseline({ templates, periods: [morning, evening] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).toHaveBeenCalledTimes(2); // Morning + one fallback (Evening has no templates today, skipped)
    expect(result.created).toEqual(["2026-08-10 (Morning)", "2026-08-10 (unassigned tasks)"]);
    expect(prisma.shifts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ period_id: null, start_time: t("09:00"), end_time: t("22:00") }), // branch operating hours, not a period's window
    }));
  });

  test("generation remains idempotent with periods defined", async () => {
    const templates = [{ day_of_week: 0, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 }];
    setupBaseline({ templates, periods: [morning] });
    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");

    jest.clearAllMocks();
    setupBaseline({
      templates, periods: [morning],
      existingShiftDates: [], // overridden below to attach period_id
    });
    prisma.shifts.findMany.mockResolvedValue([{ shift_id: 999, source: "generated", shift_date: new Date("2026-08-10T00:00:00Z"), period_id: 1 }]);
    const second = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).not.toHaveBeenCalled();
    expect(second.created).toEqual([]);
    expect(second.skipped[0]).toMatchObject({ date: "2026-08-10" });
  });

  test("a closure (non-operating/holiday day) skips every period shift on that date", async () => {
    const templates = [
      { day_of_week: 0, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 },
      { day_of_week: 0, title: "Bar Service", skill_id: null, start_time: t("16:00"), end_time: t("23:00"), required_workers: 1, sort_order: 0, period_id: 2 },
    ];
    setupBaseline({ templates, periods: [morning, evening], holidays: [{ date: "2026-08-10", name: "Closed", enabled: true }] });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).not.toHaveBeenCalled();
    expect(result.skipped).toEqual([{ date: "2026-08-10", reason: "marked closed / public holiday" }]);
  });

  test("a regular staff member contracted on a two-period day is placed in at most one shift, not both", async () => {
    const templates = [
      { day_of_week: 0, title: "Kitchen Prep", skill_id: null, start_time: t("08:00"), end_time: t("16:00"), required_workers: 1, sort_order: 0, period_id: 1 },
      { day_of_week: 0, title: "Bar Service", skill_id: null, start_time: t("16:00"), end_time: t("23:00"), required_workers: 1, sort_order: 0, period_id: 2 },
    ];
    const staff = [{ staff_id: 1, default_work_days: "1000000" }]; // Monday only
    setupBaseline({ templates, periods: [morning, evening], regularStaff: staff });

    const result = await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.task_assignments.create).toHaveBeenCalledTimes(1); // not 2 — placed once, not in both periods
    expect(result.autoPopulated).toEqual([{ date: "2026-08-10", assigned_count: 1 }]);
  });

  test("overnight period (end <= start) generates a shift ending at 23:59:59, not a midnight crossing", async () => {
    const overnight = { period_id: 3, branch_id: BRANCH_ID, name: "Night", start_time: t("22:00"), end_time: t("00:00"), active_days: "1111111", sort_order: 0, is_active: true };
    const templates = [{ day_of_week: 0, title: "Security", skill_id: null, start_time: t("22:00"), end_time: t("00:00"), required_workers: 1, sort_order: 0, period_id: 3 }];
    setupBaseline({ templates, periods: [overnight] });

    await generateShiftsForBranch(BRANCH_ID, "2026-08-10", "2026-08-10");
    expect(prisma.shifts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ start_time: t("22:00"), end_time: new Date("1970-01-01T23:59:59Z") }),
    }));
  });
});
