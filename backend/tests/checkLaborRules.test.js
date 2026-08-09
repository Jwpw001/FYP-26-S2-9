const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  shifts: { findUnique: jest.fn() },
  task_assignments: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { checkLaborRules } = require("../src/controllers/taskController");

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);

function mockSettings({ max_work_hours_day = 12, max_consecutive_days = 6, allow_overtime = false }) {
  supabaseAdmin.from.mockReturnValue(
    makeSupabaseChain({ data: { max_work_hours_day, max_consecutive_days, allow_overtime }, error: null })
  );
}

describe("checkLaborRules", () => {
  const targetShiftId = 1;
  const staffId = 100;
  const branchId = 9;

  test("returns null (passes) when under both daily-hours and consecutive-day limits", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("13:00"), // 4h
    });
    prisma.task_assignments.findMany.mockResolvedValue([]); // no other assignments at all
    mockSettings({ max_work_hours_day: 12, max_consecutive_days: 6, allow_overtime: false });

    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).toBeNull();
  });

  test("fails when the new shift would exceed max_work_hours_day for that day", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("15:00"), // 6h
    });
    // Already has an 8h shift the same day elsewhere -> 6h + 8h = 14h > 12h limit
    prisma.task_assignments.findMany.mockResolvedValue([
      { shifts: { shift_date: new Date("2026-08-10T00:00:00.000Z"), start_time: t("00:00"), end_time: t("08:00") } },
    ]);
    mockSettings({ max_work_hours_day: 12, max_consecutive_days: 6, allow_overtime: false });

    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).not.toBeNull();
    expect(result).toMatch(/12h\/day limit/);
  });

  test("allow_overtime=true changes the outcome for the same over-hours data", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("15:00"), // 6h
    });
    prisma.task_assignments.findMany.mockResolvedValue([
      { shifts: { shift_date: new Date("2026-08-10T00:00:00.000Z"), start_time: t("00:00"), end_time: t("08:00") } },
    ]);
    mockSettings({ max_work_hours_day: 12, max_consecutive_days: 6, allow_overtime: true });

    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).toBeNull();
  });

  test("fails when the new shift would exceed max_consecutive_days", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"), // Monday
      start_time: t("09:00"),
      end_time: t("13:00"),
    });
    // Already working 6 consecutive days immediately before this one (08-04..08-09) -> adding
    // 08-10 makes a 7-day run, over a 6-day limit.
    const priorDates = ["2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08", "2026-08-09"];
    prisma.task_assignments.findMany.mockResolvedValue(
      priorDates.map(d => ({ shifts: { shift_date: new Date(`${d}T00:00:00.000Z`), start_time: t("09:00"), end_time: t("10:00") } }))
    );
    mockSettings({ max_work_hours_day: 100, max_consecutive_days: 6, allow_overtime: false });

    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).not.toBeNull();
    expect(result).toMatch(/consecutive working days/);
  });

  test("returns null when shift is not found", async () => {
    prisma.shifts.findUnique.mockResolvedValue(null);
    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).toBeNull();
  });

  test("returns null when the branch has no configured settings", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("13:00"),
    });
    supabaseAdmin.from.mockReturnValue(makeSupabaseChain({ data: null, error: null }));
    const result = await checkLaborRules(staffId, targetShiftId, branchId);
    expect(result).toBeNull();
  });
});
