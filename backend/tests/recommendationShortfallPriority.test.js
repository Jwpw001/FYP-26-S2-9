// F2: getShiftRecommendations' deterministic fallback must not rank a short-of-contract regular
// below a casual for the same task, even when the casual's raw score is higher (e.g. a strong
// skill match against a regular who doesn't hold the skill at all). Forces the AI call to fail so
// this exercises buildDeterministicRecommendations directly, same pattern as
// recommendationExperienceLevel.test.js.
const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockRejectedValue(new Error("no API key in test env")) } },
  }));
});
jest.mock("../src/config/prisma", () => ({
  task_assignments: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { getShiftRecommendations } = require("../src/services/recommendationService");

const SHIFT_ID = 1, BRANCH_ID = 9, TASK_ID = 1, SKILL_ID = 7;
const REGULAR_STAFF = 101, REGULAR_USER = 201; // no matching skill, contracted Monday, 0h rostered this week
const CASUAL_STAFF = 102, CASUAL_USER = 202;   // holds the required skill at expert level, fully available

function setup({ regularRosteredHours = 0 } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    switch (table) {
      case "shifts":
        return makeSupabaseChain({
          data: {
            shift_id: SHIFT_ID, title: "Morning Shift", shift_date: "2026-08-10", // Monday
            start_time: "09:00", end_time: "13:00", branch_id: BRANCH_ID,
            branches: { name: "Downtown", open_time: "08:00", close_time: "22:00" },
          },
          error: null,
        });
      case "shift_tasks":
        return makeSupabaseChain({
          data: [{ task_id: TASK_ID, title: "Cashier", skill_id: SKILL_ID, difficulty: "mid", start_time: null, end_time: null, status: "open", skills: { name: "Cashiering" } }],
          error: null,
        });
      case "task_assignments":
        return makeSupabaseChain({ data: [], error: null });
      case "staff":
        return makeSupabaseChain({
          data: [
            { staff_id: REGULAR_STAFF, user_id: REGULAR_USER, staff_type: "regular", default_work_days: "1111100", experience_level: "junior", years_of_experience: 1 },
            { staff_id: CASUAL_STAFF, user_id: CASUAL_USER, staff_type: "casual", default_work_days: null, experience_level: "expert", years_of_experience: 5 },
          ],
          error: null,
        });
      case "casual_branch_preferences":
        return makeSupabaseChain({ data: [{ user_id: CASUAL_USER }], error: null });
      case "users":
        return makeSupabaseChain({
          data: [
            { user_id: REGULAR_USER, full_name: "Rina Regular", email: "rina@test.com", role: "regular_staff" },
            { user_id: CASUAL_USER, full_name: "Casey Casual", email: "casey@test.com", role: "casual_staff" },
          ],
          error: null,
        });
      case "user_skill_tags":
        return makeSupabaseChain({
          data: [{ user_id: CASUAL_USER, skill_id: SKILL_ID, experience_level: "expert", skills: { name: "Cashiering" } }],
          error: null,
        });
      case "availability":
        return makeSupabaseChain({ data: [], error: null });
      case "casual_availability":
        return makeSupabaseChain({ data: [{ staff_id: CASUAL_STAFF, available_from: "08:00", available_to: "22:00" }], error: null });
      case "branch_allocation_preferences":
        return makeSupabaseChain({ data: null, error: null }); // defaults: wAvail 40, wSkills 30, wAttend 15, wPerf 10, wWork 5
      case "branch_settings":
        return makeSupabaseChain({ data: { work_hours_day: 8 }, error: null });
      default:
        return makeSupabaseChain({ data: [], error: null });
    }
  });

  // computeShortfallByStaffId's query — only the regular staff member's rostered hours matter
  // here (casuals are filtered out of the input before this function is even called). Modelled
  // as several 8h shifts rather than one long one, matching how hours actually accumulate.
  const eightHourShifts = Math.round(regularRosteredHours / 8);
  prisma.task_assignments.findMany.mockResolvedValue(
    Array.from({ length: eightHourShifts }, () => ({
      staff_id: REGULAR_STAFF,
      shifts: { start_time: "1970-01-01T09:00:00.000Z", end_time: "1970-01-01T17:00:00.000Z" }, // 8h
    }))
  );
}

describe("getShiftRecommendations — F2 short-of-contract regular priority", () => {
  beforeEach(() => jest.clearAllMocks());

  test("a short-of-contract regular outranks a casual with a much stronger raw score", async () => {
    setup(); // regular has 0h rostered this week -> fully short of their 40h Mon-Fri contract

    const result = await getShiftRecommendations(SHIFT_ID);
    const suggestion = result.recommendations.find(r => r.role_id === TASK_ID);
    expect(suggestion.suggestions[0].staff_id).toBe(REGULAR_STAFF);
    expect(suggestion.suggestions[0].reason).toEqual(expect.stringContaining("below contracted hours"));
    // The casual is still offered, just not ranked first.
    expect(suggestion.suggestions.map(s => s.staff_id)).toContain(CASUAL_STAFF);
  });

  test("once the regular has reached contract this week, ranking reverts to plain score", async () => {
    setup({ regularRosteredHours: 40 }); // fully at contract already -> not short

    const result = await getShiftRecommendations(SHIFT_ID);
    const suggestion = result.recommendations.find(r => r.role_id === TASK_ID);
    // No shortfall tier boost left — the casual's much stronger skill match wins on raw score.
    expect(suggestion.suggestions[0].staff_id).toBe(CASUAL_STAFF);
  });
});
