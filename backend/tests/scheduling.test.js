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

describe("computeWeightedScore", () => {
  // Alice: perfect availability fit, no required skill. Bob: loose availability (lots of
  // slack), holds the required skill.
  const alice = { availability: 1.0, skills: 0.0, attendance: 0.5, performance: 0.5, workload: 1 };
  const bob   = { availability: 0.4, skills: 1.0, attendance: 0.5, performance: 0.5, workload: 1 };

  test("availability-heavy weights favour the tighter availability fit", () => {
    const weights = { availability: 100, skills: 0, attendance: 0, performance: 0, workload: 0 };
    expect(computeWeightedScore(alice, weights)).toBeGreaterThan(computeWeightedScore(bob, weights));
  });

  test("skills-heavy weights favour the skill match, flipping the ranking", () => {
    const weights = { availability: 0, skills: 100, attendance: 0, performance: 0, workload: 0 };
    expect(computeWeightedScore(bob, weights)).toBeGreaterThan(computeWeightedScore(alice, weights));
  });

  test("default weights (40/30/15/10/5) produce a deterministic, reproducible score", () => {
    const weights = { availability: 40, skills: 30, attendance: 15, performance: 10, workload: 5 };
    expect(computeWeightedScore(alice, weights)).toBeCloseTo(40 * 1.0 + 30 * 0 + 15 * 0.5 + 10 * 0.5 + 5 * 1, 5);
  });
});
