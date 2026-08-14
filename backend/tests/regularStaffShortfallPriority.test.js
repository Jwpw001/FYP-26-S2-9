// Round 7, P2: regular staff must be placed onto open tasks in descending shortfall order
// (contracted hours this week minus hours already rostered this week) — whoever is furthest
// below contract picks first, not whoever prisma.staff.findMany happened to return first (there
// was no orderBy at all before this round). Dedicated file per the round's brief: "a new test in
// backend/tests/ proving that given two regular staff contracted for the same day, one already
// rostered near contract and one well below it, the one below gets the task."
jest.mock("../src/config/prisma", () => ({
  branch_settings: { findUnique: jest.fn() },
  branches: { findUnique: jest.fn() },
  branch_task_templates: { findMany: jest.fn() },
  branch_shift_periods: { findMany: jest.fn() },
  staff: { findMany: jest.fn() },
  off_day_requests: { findMany: jest.fn() },
  public_holidays: { findMany: jest.fn() },
  shifts: { findMany: jest.fn(), createManyAndReturn: jest.fn() },
  shift_tasks: { createManyAndReturn: jest.fn(), updateMany: jest.fn() },
  task_assignments: { findMany: jest.fn(), createMany: jest.fn() },
  $transaction: jest.fn(),
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const { generateShiftsForBranch } = require("../src/controllers/shiftGenerationController");

const BRANCH_ID = 7;
const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
// 2026-08-10 is a Monday — both staff below are contracted Mon-Fri (5 days), so at 8h/day
// (branch_settings.work_hours_day default) contracted_hours_per_week = 40.
const MONDAY = "2026-08-10";

function setupBaseline({ templates, regularStaff, existingAssignmentsThisWeek = [] }) {
  prisma.branch_settings.findUnique.mockResolvedValue({
    branch_id: BRANCH_ID, operating_days: "1111111", holidays: [], treat_public_holidays_as_working: true, work_hours_day: 8,
  });
  prisma.branches.findUnique.mockResolvedValue({ open_time: t("09:00"), close_time: t("22:00") });
  prisma.branch_task_templates.findMany.mockResolvedValue(templates);
  prisma.branch_shift_periods.findMany.mockResolvedValue([]);
  prisma.staff.findMany.mockResolvedValue(regularStaff);
  prisma.off_day_requests.findMany.mockResolvedValue([]);
  prisma.task_assignments.findMany.mockResolvedValue(existingAssignmentsThisWeek);
  prisma.shifts.findMany.mockResolvedValue([]);

  let nextShiftId = 1;
  prisma.shifts.createManyAndReturn.mockImplementation(({ data }) => Promise.resolve(data.map(row => ({ ...row, shift_id: nextShiftId++ }))));
  let nextTaskId = 1;
  prisma.shift_tasks.createManyAndReturn.mockImplementation(({ data }) => Promise.resolve(data.map(row => ({ ...row, task_id: nextTaskId++ }))));
  prisma.shift_tasks.updateMany.mockResolvedValue({ count: 0 });
  prisma.task_assignments.createMany.mockResolvedValue({ count: 0 });
  prisma.$transaction.mockImplementation((fn) => fn(prisma));
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("regular staff placement — descending shortfall priority", () => {
  const template = { day_of_week: 0, title: "Cashier", skill_id: null, start_time: t("09:00"), end_time: t("17:00"), required_workers: 1, sort_order: 0 };
  // Both contracted Mon-Fri -> 40h/week contracted at the branch's default 8h/day.
  const nearContract = { staff_id: 601, default_work_days: "1111100" };
  const wellBelow = { staff_id: 602, default_work_days: "1111100" };

  test("the staff member well below contract gets the task over one already near contract", async () => {
    setupBaseline({
      templates: [template],
      regularStaff: [nearContract, wellBelow], // insertion order deliberately favours the WRONG one
      // 601 already has 36 of 40 contracted hours this week (four 9h shifts Tue-Fri, already
      // assigned via a manual shift or an earlier partial generation run — same week as the
      // Monday being generated, Aug10-16); 602 has none.
      existingAssignmentsThisWeek: [601, 601, 601, 601].map((staff_id, i) => ({
        staff_id,
        shifts: {
          shift_date: new Date(`2026-08-${String(11 + i).padStart(2, "0")}T00:00:00Z`), // Tue 08-11..Fri 08-14
          start_time: t("09:00"),
          end_time: t("18:00"), // 9h
        },
      })),
    });

    const result = await generateShiftsForBranch(BRANCH_ID, MONDAY, MONDAY);
    expect(prisma.task_assignments.createMany).toHaveBeenCalledTimes(1);
    const placedRows = prisma.task_assignments.createMany.mock.calls[0][0].data;
    expect(placedRows).toHaveLength(1); // only one open task
    expect(placedRows[0].staff_id).toBe(602); // furthest below contract wins, despite coming second in staff.findMany's order
    expect(result.autoPopulated).toEqual([{ date: MONDAY, assigned_count: 1 }]);
  });

  test("with enough tasks for both, the one further below contract is still placed first (not just present)", async () => {
    const twoTasksTemplate = { ...template, required_workers: 2 };
    setupBaseline({
      templates: [twoTasksTemplate],
      regularStaff: [nearContract, wellBelow],
      existingAssignmentsThisWeek: [{
        staff_id: 601,
        shifts: { shift_date: new Date("2026-08-11T00:00:00Z"), start_time: t("09:00"), end_time: t("18:00") },
      }],
    });

    await generateShiftsForBranch(BRANCH_ID, MONDAY, MONDAY);
    const placedRows = prisma.task_assignments.createMany.mock.calls[0][0].data;
    expect(placedRows).toHaveLength(2); // both fit, but order still reflects priority
    expect(placedRows[0].staff_id).toBe(602);
    expect(placedRows[1].staff_id).toBe(601);
  });

  test("placement is stable (reproducible) across repeated runs with identical input", async () => {
    const results = [];
    for (let i = 0; i < 3; i++) {
      setupBaseline({
        templates: [template],
        regularStaff: [nearContract, wellBelow],
        existingAssignmentsThisWeek: [{
          staff_id: 601,
          shifts: { shift_date: new Date("2026-08-11T00:00:00Z"), start_time: t("09:00"), end_time: t("18:00") },
        }],
      });
      await generateShiftsForBranch(BRANCH_ID, MONDAY, MONDAY);
      results.push(prisma.task_assignments.createMany.mock.calls[0][0].data[0].staff_id);
      jest.clearAllMocks();
    }
    expect(results).toEqual([602, 602, 602]);
  });

  test("a dead-even shortfall tie breaks on staff_id ascending, deterministically", async () => {
    setupBaseline({
      templates: [template], // one task
      regularStaff: [{ staff_id: 999, default_work_days: "1111100" }, { staff_id: 100, default_work_days: "1111100" }],
      existingAssignmentsThisWeek: [], // neither has any hours rostered yet — exact tie
    });

    await generateShiftsForBranch(BRANCH_ID, MONDAY, MONDAY);
    const placedRows = prisma.task_assignments.createMany.mock.calls[0][0].data;
    expect(placedRows[0].staff_id).toBe(100); // lower staff_id wins the tie, not insertion order
  });
});
