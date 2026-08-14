// Regression: Round 6, Task 10 rebuilt allocation scoring to three dimensions (skills,
// attendance, workload — see casualController.js/recommendationService.js) but
// updateBranchAllocationPrefs/updateAllocationPrefs still required weight_availability and
// weight_performance (legacy columns, no longer read by scoring, never sent by the current
// Settings/BranchDetail UI) to also contribute to the sum-to-100 check. A user could set the
// three sliders the UI actually shows to a genuine 100% split — the donut would say "100 of
// 100%, Balanced" — and Save would still 400 with "Allocation weights must sum to 100.", because
// the leftover weight_availability/weight_performance values from the fetched record (defaults
// 40/10 from a pre-Round-6 row) pushed the backend's five-field total to 150.
const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  branches: { findUnique: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const supabaseAdmin = require("../src/config/supabaseAdmin");
const { updateBranchAllocationPrefs, updateAllocationPrefs } = require("../src/controllers/businessOwnerController");

const BUSINESS_ID = 1, BRANCH_ID = 9, OWNER_USER_ID = 500;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function mockOwnerAndTarget({ branchFound = true, upsertResult = { data: {}, error: null } } = {}) {
  supabaseAdmin.from.mockImplementation((table) => {
    switch (table) {
      case "businesses":
        return makeSupabaseChain({ data: { business_id: BUSINESS_ID, industry: "fnb" }, error: null });
      case "branches":
        return makeSupabaseChain({ data: branchFound ? { branch_id: BRANCH_ID } : null, error: null });
      case "branch_allocation_preferences":
      case "allocation_preferences":
        return makeSupabaseChain(upsertResult);
      default:
        return makeSupabaseChain({ data: null, error: null });
    }
  });
}

describe("updateBranchAllocationPrefs — sum-to-100 check", () => {
  beforeEach(() => jest.clearAllMocks());

  test("a genuine 100% split across skills/attendance/workload saves, even with stale availability/performance leftover in the request", async () => {
    mockOwnerAndTarget();
    const req = {
      user: { user_id: OWNER_USER_ID, role: "business_owner" },
      params: { branch_id: String(BRANCH_ID) },
      // Exactly what the live UI sends: the 3 edited sliders sum to 100, plus whatever
      // weight_availability/weight_performance the fetched record had (old defaults 40/10) —
      // never edited, just carried along in state.
      body: { weight_skills: 57, weight_attendance: 28, weight_workload: 15, weight_availability: 40, weight_performance: 10 },
    };
    const res = makeRes();
    await updateBranchAllocationPrefs(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  test("still rejects when the three live dimensions genuinely don't sum to 100", async () => {
    mockOwnerAndTarget();
    const req = {
      user: { user_id: OWNER_USER_ID, role: "business_owner" },
      params: { branch_id: String(BRANCH_ID) },
      body: { weight_skills: 50, weight_attendance: 20, weight_workload: 20 }, // sums to 90
    };
    const res = makeRes();
    await updateBranchAllocationPrefs(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/must sum to 100/);
  });
});

describe("updateAllocationPrefs — sum-to-100 check", () => {
  beforeEach(() => jest.clearAllMocks());

  test("a genuine 100% split across skills/attendance/workload saves, even with stale availability/performance leftover in the request", async () => {
    mockOwnerAndTarget({ upsertResult: { data: {}, error: null } });
    const req = {
      user: { user_id: OWNER_USER_ID, role: "business_owner" },
      body: { weight_skills: 50, weight_attendance: 30, weight_workload: 20, weight_availability: 40, weight_performance: 10 },
    };
    const res = makeRes();
    await updateAllocationPrefs(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
  });
});
