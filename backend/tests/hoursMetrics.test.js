const { computeHoursMetrics, toMinutes } = require("../src/utils/hoursMetrics");

describe("toMinutes", () => {
  test("returns null for null/undefined", () => {
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes(undefined)).toBeNull();
  });

  test("parses an HH:MM string", () => {
    expect(toMinutes("14:30")).toBe(14 * 60 + 30);
  });

  test("parses a Date (time column) value", () => {
    expect(toMinutes(new Date("1970-01-01T09:00:00.000Z"))).toBe(9 * 60);
  });
});

describe("computeHoursMetrics — overtime", () => {
  const branch = { branchOpenTime: "10:00", branchCloseTime: "22:00" };

  test("actual window fully inside operating hours → zero overtime", () => {
    // The brief's own worked example: rostered 10:00-14:00, actual 10:00-16:00, branch 10-22.
    const m = computeHoursMetrics({ rosteredStart: "10:00", rosteredEnd: "14:00", actualStart: "10:00", actualEnd: "16:00", ...branch });
    expect(m.workedHours).toBe(6);
    expect(m.additionalHours).toBe(2);
    expect(m.overtimeHours).toBe(0);
    expect(m.hoursUnknown).toBe(false);
  });

  test("actual start before opening → overtime equals the pre-opening portion", () => {
    // The brief's other worked example: 08:00-12:00 at a branch opening at 10:00 → 2.0 overtime.
    const m = computeHoursMetrics({ actualStart: "08:00", actualEnd: "12:00", ...branch });
    expect(m.overtimeHours).toBe(2);
    expect(m.workedHours).toBe(4);
  });

  test("actual end after closing → overtime equals the post-closing portion", () => {
    const m = computeHoursMetrics({ actualStart: "20:00", actualEnd: "23:30", ...branch });
    expect(m.overtimeHours).toBe(1.5); // 22:00-23:30
    expect(m.workedHours).toBe(3.5);
  });

  test("actual window spans both before opening and after closing", () => {
    const m = computeHoursMetrics({ actualStart: "08:00", actualEnd: "23:00", ...branch });
    expect(m.overtimeHours).toBe(3); // 2h before + 1h after
    expect(m.workedHours).toBe(15);
  });

  test("null actual start/end → hoursUnknown true, additional/overtime null, worked falls back to hours_worked", () => {
    const m = computeHoursMetrics({ actualStart: null, actualEnd: null, hoursWorkedFallback: 5.5, ...branch });
    expect(m.hoursUnknown).toBe(true);
    expect(m.workedHours).toBe(5.5);
    expect(m.additionalHours).toBeNull();
    expect(m.overtimeHours).toBeNull();
  });

  test("missing hoursWorkedFallback with no actual times → worked is also null, never 0", () => {
    const m = computeHoursMetrics({ actualStart: null, actualEnd: null });
    expect(m.workedHours).toBeNull(); // not 0 — 0 would falsely claim "worked nothing"
  });

  test("end <= start is treated as an input error, not a next-day rollover — unknown, never negative", () => {
    const m = computeHoursMetrics({ actualStart: "14:00", actualEnd: "10:00", hoursWorkedFallback: 4, ...branch });
    expect(m.hoursUnknown).toBe(true);
    expect(m.overtimeHours).toBeNull();
    expect(m.workedHours).toBe(4); // still falls back to the legacy total, not a crash/negative number
  });
});

describe("computeHoursMetrics — additional hours", () => {
  test("worked equals rostered → zero additional", () => {
    const m = computeHoursMetrics({ rosteredStart: "10:00", rosteredEnd: "14:00", actualStart: "10:00", actualEnd: "14:00" });
    expect(m.additionalHours).toBe(0);
  });

  test("worked exceeds rostered → positive additional", () => {
    const m = computeHoursMetrics({ rosteredStart: "10:00", rosteredEnd: "14:00", actualStart: "10:00", actualEnd: "15:30" });
    expect(m.additionalHours).toBe(1.5);
  });

  test("worked falls short of rostered → clamped to zero, never negative", () => {
    const m = computeHoursMetrics({ rosteredStart: "10:00", rosteredEnd: "14:00", actualStart: "10:00", actualEnd: "12:00" });
    expect(m.additionalHours).toBe(0);
  });

  test("no rostered window available → additional is null (unknown), not 0", () => {
    const m = computeHoursMetrics({ actualStart: "10:00", actualEnd: "14:00" });
    expect(m.additionalHours).toBeNull();
  });
});
