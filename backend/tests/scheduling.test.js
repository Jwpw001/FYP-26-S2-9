const {
  toMinutesFromTimeValue,
  doTimeRangesOverlap,
  getUTCDayOfWeekMondayFirst,
  getUTCMondayWeekStart,
  computeWeightedScore,
} = require("../src/utils/scheduling");

describe("toMinutesFromTimeValue", () => {
  test("returns null for falsy input", () => {
    expect(toMinutesFromTimeValue(null)).toBeNull();
    expect(toMinutesFromTimeValue(undefined)).toBeNull();
  });

  test("parses an HH:MM string", () => {
    expect(toMinutesFromTimeValue("09:30")).toBe(9 * 60 + 30);
  });

  test("parses an HH:MM:SS string", () => {
    expect(toMinutesFromTimeValue("09:30:00")).toBe(9 * 60 + 30);
  });

  test("parses a Prisma Date object (time column)", () => {
    const d = new Date("1970-01-01T14:15:00.000Z");
    expect(toMinutesFromTimeValue(d)).toBe(14 * 60 + 15);
  });
});

describe("doTimeRangesOverlap", () => {
  const mins = (h, m) => h * 60 + m;

  test("overlapping windows return true", () => {
    expect(doTimeRangesOverlap(mins(9, 0), mins(12, 0), mins(11, 0), mins(13, 0))).toBe(true);
  });

  test("adjacent windows (touching, not overlapping) return false", () => {
    expect(doTimeRangesOverlap(mins(9, 0), mins(12, 0), mins(12, 0), mins(15, 0))).toBe(false);
  });

  test("one window fully contained in another returns true", () => {
    expect(doTimeRangesOverlap(mins(9, 0), mins(17, 0), mins(10, 0), mins(11, 0))).toBe(true);
  });

  test("non-overlapping windows return false", () => {
    expect(doTimeRangesOverlap(mins(9, 0), mins(10, 0), mins(14, 0), mins(15, 0))).toBe(false);
  });
});

describe("week-start alignment (UTC, Monday=0)", () => {
  test("a Monday resolves to itself", () => {
    const monday = new Date("2026-08-03T00:00:00.000Z");
    expect(getUTCDayOfWeekMondayFirst(monday)).toBe(0);
    expect(getUTCMondayWeekStart(monday).toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  test("a Sunday resolves to the Monday six days earlier", () => {
    const sunday = new Date("2026-08-09T00:00:00.000Z");
    expect(getUTCDayOfWeekMondayFirst(sunday)).toBe(6);
    expect(getUTCMondayWeekStart(sunday).toISOString().slice(0, 10)).toBe("2026-08-03");
  });

  test("a date crossing a month boundary resolves to the correct Monday", () => {
    // 2026-02-01 is a Sunday; its week started Monday 2026-01-26 (January), not February.
    const sunday = new Date("2026-02-01T00:00:00.000Z");
    expect(getUTCDayOfWeekMondayFirst(sunday)).toBe(6);
    expect(getUTCMondayWeekStart(sunday).toISOString().slice(0, 10)).toBe("2026-01-26");
  });
});

// Round 6, Task 10: availability and performance dropped from the model — availability is a
// hard gate now (never reaches this scoring function), performance had no data source. Only
// skills/attendance/workload are weighted.
describe("computeWeightedScore", () => {
  // Alice: no required skill, decent attendance. Bob: holds the required skill, same attendance.
  const alice = { skills: 0.0, attendance: 0.5, workload: 1 };
  const bob   = { skills: 1.0, attendance: 0.5, workload: 1 };

  test("skills-heavy weights favour the skill match", () => {
    const weights = { skills: 100, attendance: 0, workload: 0 };
    expect(computeWeightedScore(bob, weights)).toBeGreaterThan(computeWeightedScore(alice, weights));
  });

  test("attendance-heavy weights produce a tie when attendance is equal", () => {
    const weights = { skills: 0, attendance: 100, workload: 0 };
    expect(computeWeightedScore(bob, weights)).toBe(computeWeightedScore(alice, weights));
  });

  test("default weights (50/30/20) produce a deterministic, reproducible score", () => {
    const weights = { skills: 50, attendance: 30, workload: 20 };
    expect(computeWeightedScore(bob, weights)).toBeCloseTo(50 * 1.0 + 30 * 0.5 + 20 * 1, 5);
  });
});
