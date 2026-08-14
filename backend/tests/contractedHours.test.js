const { countContractedDays, contractedHoursPerWeek } = require("../src/utils/contractedHours");

describe("countContractedDays", () => {
  test("counts the 1s in a default_work_days string", () => {
    expect(countContractedDays("1111100")).toBe(5);
  });

  test("returns 0 for null/undefined (the existing data-gap case)", () => {
    expect(countContractedDays(null)).toBe(0);
    expect(countContractedDays(undefined)).toBe(0);
  });

  test("returns 0 for an empty string", () => {
    expect(countContractedDays("")).toBe(0);
  });

  test("counts a non-contiguous pattern correctly", () => {
    expect(countContractedDays("1010101")).toBe(4);
  });
});

describe("contractedHoursPerWeek", () => {
  test("multiplies contracted days by the branch's nominal work-hours-per-day", () => {
    expect(contractedHoursPerWeek("1111100", 8)).toBe(40);
  });

  test("a 4-day contract at a 10h/day branch is 40h, not the same number for a different reason", () => {
    expect(contractedHoursPerWeek("1111000", 10)).toBe(40);
  });

  test("returns 0 when default_work_days is missing", () => {
    expect(contractedHoursPerWeek(null, 8)).toBe(0);
  });

  test("returns 0 when work_hours_day is 0, null, or undefined", () => {
    expect(contractedHoursPerWeek("1111100", 0)).toBe(0);
    expect(contractedHoursPerWeek("1111100", null)).toBe(0);
    expect(contractedHoursPerWeek("1111100", undefined)).toBe(0);
  });
});
