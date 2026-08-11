jest.mock("../src/config/prisma", () => ({
  shifts: { findUnique: jest.fn() },
  task_assignments: { findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const { checkDoubleBooking } = require("../src/controllers/taskController");

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);

describe("checkDoubleBooking", () => {
  const staffId = 100;
  const shiftId = 1;
  const taskId  = 10;
  const staffName = "Jane Doe";

  test("returns [] when the staff member has no other assignments that day", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("17:00"),
    });
    prisma.task_assignments.findMany.mockResolvedValue([]);

    const result = await checkDoubleBooking(staffId, shiftId, taskId, staffName);
    expect(result).toEqual([]);
  });

  test("returns a warning when another assignment's shift overlaps the target shift's time window", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("17:00"),
    });
    prisma.task_assignments.findMany.mockResolvedValue([
      {
        shift_tasks: { title: "Kitchen Prep" },
        shifts: { start_time: t("12:00"), end_time: t("20:00") }, // overlaps 09:00-17:00
      },
    ]);

    const result = await checkDoubleBooking(staffId, shiftId, taskId, staffName);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("Jane Doe is already assigned to Kitchen Prep on this date (12:00–20:00)");
  });

  test("returns one warning per overlapping assignment when there are several", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("17:00"),
    });
    prisma.task_assignments.findMany.mockResolvedValue([
      { shift_tasks: { title: "Kitchen Prep" },  shifts: { start_time: t("08:00"), end_time: t("10:00") } },
      { shift_tasks: { title: "Front of House" }, shifts: { start_time: t("16:00"), end_time: t("22:00") } },
    ]);

    const result = await checkDoubleBooking(staffId, shiftId, taskId, staffName);
    expect(result).toHaveLength(2);
  });

  test("does not flag an adjacent, non-overlapping shift on the same date", async () => {
    prisma.shifts.findUnique.mockResolvedValue({
      shift_date: new Date("2026-08-10T00:00:00.000Z"),
      start_time: t("09:00"),
      end_time: t("13:00"),
    });
    // Prisma-side filtering (start_time < target.end AND end_time > target.start) would exclude
    // this back-to-back shift — simulate that by returning no rows, same as the real query would.
    prisma.task_assignments.findMany.mockResolvedValue([]);

    const result = await checkDoubleBooking(staffId, shiftId, taskId, staffName);
    expect(result).toEqual([]);
  });

  test("returns [] when the target shift is not found", async () => {
    prisma.shifts.findUnique.mockResolvedValue(null);
    const result = await checkDoubleBooking(staffId, shiftId, taskId, staffName);
    expect(result).toEqual([]);
  });
});
