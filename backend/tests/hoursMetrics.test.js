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

  // Round 5, Task 1's own acceptance scenario: a casual worker rostered 17:00-22:00 who
  // actually worked to 23:30 at a branch closing at 22:00.
  test("Round 5 Task 1 acceptance scenario: rostered 17:00-22:00, worked to 23:30, branch closes 22:00", () => {
    const m = computeHoursMetrics({
      rosteredStart: "17:00", rosteredEnd: "22:00",
      actualStart: "17:00", actualEnd: "23:30",
      branchOpenTime: "08:00", branchCloseTime: "22:00",
    });
    expect(m.workedHours).toBe(6.5);
    expect(m.additionalHours).toBe(1.5);
    expect(m.overtimeHours).toBe(1.5);
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

// Round 6, Task 3 — break/rest hours. All three rows of the round's own worked-example table:
// period 10:00-15:00 (rostered 5.0h), branch open 08:00-22:00.
describe("computeHoursMetrics — break minutes", () => {
  const period = { rosteredStart: "10:00", rosteredEnd: "15:00" };
  const branch = { branchOpenTime: "08:00", branchCloseTime: "22:00" };

  test("null break_minutes behaves exactly as before — the regression guard", () => {
    const withNull = computeHoursMetrics({ ...period, ...branch, actualStart: "10:00", actualEnd: "16:00", breakMinutes: null });
    const withUndefined = computeHoursMetrics({ ...period, ...branch, actualStart: "10:00", actualEnd: "16:00" });
    expect(withNull).toEqual(withUndefined);
    expect(withNull.workedHours).toBe(6); // span, unreduced — no break recorded
  });

  test("row 1: submitted exactly as rostered, 60m break → worked 4.0, additional 0, overtime 0", () => {
    const m = computeHoursMetrics({ ...period, ...branch, actualStart: "10:00", actualEnd: "15:00", breakMinutes: 60 });
    expect(m.spanHours).toBe(5);
    expect(m.workedHours).toBe(4);
    expect(m.additionalHours).toBe(0);
    expect(m.overtimeHours).toBe(0);
  });

  test("row 2: stayed an hour past the period, 60m break → worked 5.0, additional +1.0 (not 0), overtime 0", () => {
    const m = computeHoursMetrics({ ...period, ...branch, actualStart: "10:00", actualEnd: "16:00", breakMinutes: 60 });
    expect(m.spanHours).toBe(6);
    expect(m.workedHours).toBe(5);
    expect(m.additionalHours).toBe(1); // measured on span (6 - 5 rostered), NOT on net worked (5 - 5 = 0)
    expect(m.overtimeHours).toBe(0);
  });

  test("row 3: worked past branch close, 60m break → worked 4.0, additional 0, overtime 1.0 (unadjusted for break)", () => {
    const m = computeHoursMetrics({ ...period, ...branch, actualStart: "18:00", actualEnd: "23:00", breakMinutes: 60 });
    expect(m.spanHours).toBe(5);
    expect(m.workedHours).toBe(4);
    expect(m.additionalHours).toBe(0);
    expect(m.overtimeHours).toBe(1); // computed on the raw span (18:00-23:00 vs 08:00-22:00), never net of break
  });

  test("30-minute break on a 6.5-hour span gives worked 6.0", () => {
    const m = computeHoursMetrics({ actualStart: "09:00", actualEnd: "15:30", breakMinutes: 30 });
    expect(m.spanHours).toBe(6.5);
    expect(m.workedHours).toBe(6);
  });

  test("additional hours measured on span, not net: 60m break against a 10:00-15:00 period gives +1.0", () => {
    const m = computeHoursMetrics({ rosteredStart: "10:00", rosteredEnd: "15:00", actualStart: "10:00", actualEnd: "16:00", breakMinutes: 60 });
    expect(m.additionalHours).toBe(1); // NOT 0 — computing from net (5.0 worked - 5.0 rostered) would hide the late stay
  });
});
