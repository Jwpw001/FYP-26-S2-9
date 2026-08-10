// Round 5, Task 8/10: multi-business casual membership.
//
// Investigated, not implemented this round (reported as Future Work — see the final report).
// registerCasualWorker is the only "join a business by code" entry point, and it's a
// create-account-only flow: it hard-rejects any email that already has an account before it
// ever looks at casual_workers, so there is currently no way for an already-registered casual
// worker to join a second business at all, whether via a join code or an invitation reaching
// this same rejection.
//
// Building real support would need every "resolve my staff_id from user_id" call site across the
// backend (12+ in casualController.js alone, e.g. submitWeeklyAvailability's
// .eq("user_id", userId).maybeSingle() — Supabase's maybeSingle() throws outright if more than
// one row matches) to disambiguate by a selected business, plus casual_weekly_availability
// (getMyAvailability/setMyAvailability) is keyed by user_id directly with no business dimension
// at all — i.e. genuinely global across every business a worker belongs to, not per-business.
// That's a systemic identity-resolution change, not a contained one.
//
// This test documents current, still-blocking behavior deliberately — flip it (and add the
// "second membership succeeds" case) when that Future Work actually lands.
jest.mock("../src/config/prisma", () => ({
  users: { findUnique: jest.fn(), findFirst: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({
  from: jest.fn(),
  auth: { admin: { createUser: jest.fn() } },
}));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { registerCasualWorker } = require("../src/controllers/casualController");

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("registerCasualWorker — already-registered user tries to join a second business", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "businesses") {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { business_id: 2, name: "Second Business" }, error: null }),
        };
      }
      return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) };
    });
  });

  test("currently rejected with 409 rather than creating a second casual_workers membership", async () => {
    // Simulates a casual worker already registered at Business A entering Business B's join code.
    prisma.users.findUnique.mockResolvedValue({ user_id: 5, email: "already@registered.com" });

    const req = {
      body: {
        full_name: "Already Registered", username: "already2",
        email: "already@registered.com", password: "password123",
        join_code: "BIZB-CODE",
      },
    };
    const res = makeRes();
    await registerCasualWorker(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/account with this email already exists/i),
    }));
  });
});
