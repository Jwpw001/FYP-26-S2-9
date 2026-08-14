// Round 5, Task 2/10: proficiency_level -> experience_level fix in recommendationService.js.
// Forces the AI call to fail so getShiftRecommendations falls back to
// buildDeterministicRecommendations() — the code path that actually scores candidates using
// user_skill_tags.experience_level, which used to always read as unset (the query errored and
// was never checked) regardless of what any candidate actually held.
const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: { completions: { create: jest.fn().mockRejectedValue(new Error("no API key in test env")) } },
  }));
});
jest.mock("../src/config/prisma", () => ({
  // findMany: F2's computeShortfallByStaffId (regularStaffShortfall.js) queries this to seed
  // hours-already-rostered-this-week for the ranking's short-of-contract tier.
  task_assignments: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const supabaseAdmin = require("../src/config/supabaseAdmin");
const { getShiftRecommendations } = require("../src/services/recommendationService");

const SHIFT_ID = 1, BRANCH_ID = 9, TASK_ID = 1, SKILL_ID = 7;
const SKILLED_STAFF = 101, SKILLED_USER = 201; // holds the required skill, experience_level "expert"
const UNSKILLED_STAFF = 102, UNSKILLED_USER = 202; // no skill tag at all

function setup() {
  let capturedSkillTagsSelect = null;

  supabaseAdmin.from.mockImplementation((table) => {
    switch (table) {
      case "shifts":
        return makeSupabaseChain({
          data: {
            shift_id: SHIFT_ID, title: "Evening Shift", shift_date: "2026-08-10",
            start_time: "17:00", end_time: "22:00", branch_id: BRANCH_ID,
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
            { staff_id: SKILLED_STAFF, user_id: SKILLED_USER, staff_type: "regular", default_work_days: "1111100", experience_level: "expert", years_of_experience: 5 },
            { staff_id: UNSKILLED_STAFF, user_id: UNSKILLED_USER, staff_type: "regular", default_work_days: "1111100", experience_level: "junior", years_of_experience: 1 },
          ],
          error: null,
        });
      case "casual_branch_preferences":
        return makeSupabaseChain({ data: [], error: null });
      case "users":
        return makeSupabaseChain({
          data: [
            { user_id: SKILLED_USER, full_name: "Skilled Sam", email: "sam@test.com", role: "regular_staff" },
            { user_id: UNSKILLED_USER, full_name: "Unskilled Uma", email: "uma@test.com", role: "regular_staff" },
          ],
          error: null,
        });
      case "user_skill_tags": {
        const chain = makeSupabaseChain({
          data: [{ user_id: SKILLED_USER, skill_id: SKILL_ID, experience_level: "expert", skills: { name: "Cashiering" } }],
          error: null,
        });
        const origSelect = chain.select;
        chain.select = jest.fn((cols) => { capturedSkillTagsSelect = cols; return origSelect(cols); });
        return chain;
      }
      case "availability":
        return makeSupabaseChain({ data: [], error: null });
      case "branch_allocation_preferences":
        return makeSupabaseChain({ data: null, error: null });
      case "branch_settings":
        return makeSupabaseChain({ data: { work_hours_day: 8 }, error: null });
      default:
        return makeSupabaseChain({ data: [], error: null });
    }
  });

  return { getCapturedSelect: () => capturedSkillTagsSelect };
}

describe("getShiftRecommendations — experience_level after the proficiency_level fix", () => {
  beforeEach(() => jest.clearAllMocks());

  test("queries user_skill_tags for experience_level, not the nonexistent proficiency_level", async () => {
    const { getCapturedSelect } = setup();
    await getShiftRecommendations(SHIFT_ID);
    expect(getCapturedSelect()).toEqual(expect.stringContaining("experience_level"));
    expect(getCapturedSelect()).not.toEqual(expect.stringContaining("proficiency_level"));
  });

  test("deterministic fallback actually uses the skill data — skilled candidate outranks unskilled for a skill-required task", async () => {
    setup();
    const result = await getShiftRecommendations(SHIFT_ID);
    const suggestion = result.recommendations.find(r => r.role_id === TASK_ID);
    expect(suggestion).toBeTruthy();
    const top = suggestion.suggestions[0];
    expect(top.staff_id).toBe(SKILLED_STAFF);
    expect(top.reason).toEqual(expect.stringContaining("holds the required skill"));
  });
});
