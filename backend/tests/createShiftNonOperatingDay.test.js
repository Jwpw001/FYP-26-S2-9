// Round 5, Task 4/10: manual shift creation is permitted on a non-operating day — the backend
// no longer blocks it (checked via branch_settings.operating_days before this round; that check
// was removed since every operating day is now generated automatically and manual creation
// exists specifically for exceptions).
const { makeSupabaseChain } = require("./helpers/supabaseChain");

// shiftController.js also instantiates an OpenAI client at module load (for a different,
// unrelated function) — mock it so requiring the controller doesn't need a real API key.
jest.mock("openai", () => jest.fn().mockImplementation(() => ({ chat: { completions: { create: jest.fn() } } })));

jest.mock("../src/config/prisma", () => ({
  staff: { findFirst: jest.fn() },
  shifts: { create: jest.fn(), findMany: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { createShift } = require("../src/controllers/shiftController");

const BRANCH_ID = 2, MANAGER_USER_ID = 2;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe("createShift — non-operating day", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.staff.findFirst.mockResolvedValue({ branch_id: BRANCH_ID });
    prisma.shifts.findMany.mockResolvedValue([]); // no overlapping shifts by default
    supabaseAdmin.from.mockImplementation(() => makeSupabaseChain({ data: null, error: null }));
  });

  test("a Saturday shift is created successfully for a Mon-Fri branch, not blocked", async () => {
    prisma.shifts.create.mockResolvedValue({
      shift_id: 501, branch_id: BRANCH_ID, shift_date: new Date("2026-08-15T00:00:00.000Z"),
      start_time: new Date("1970-01-01T10:00:00.000Z"), end_time: new Date("1970-01-01T14:00:00.000Z"),
      status: "draft", source: "manual",
    });
    const req = {
      user: { user_id: MANAGER_USER_ID },
      body: { branch_id: BRANCH_ID, title: "Weekend Cover", shift_date: "2026-08-15", start_time: "10:00", end_time: "14:00", status: "draft" },
    };
    const res = makeRes();
    await createShift(req, res);

    // No 400 for "non-operating day" — branch_settings isn't even consulted anymore for this.
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(supabaseAdmin.from).not.toHaveBeenCalledWith("branch_settings");
    expect(prisma.shifts.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ branch_id: BRANCH_ID, source: "manual" }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
