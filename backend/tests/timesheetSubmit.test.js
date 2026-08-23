// Round 5, Task 1/10: casual worker timesheet submission — valid range, end<=start rejected,
// hours_worked derived correctly. Covers the same submitReport() endpoint both regular and
// casual staff use (branching happens on whether start_time/end_time are present, not on role).
const { makeSupabaseChain } = require("./helpers/supabaseChain");

jest.mock("../src/config/prisma", () => ({
  staff: { findFirst: jest.fn(), findUnique: jest.fn() },
  shifts: { findUnique: jest.fn() },
  task_assignments: { findFirst: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn(), storage: { from: jest.fn() } }));
jest.mock("../src/utils/notify", () => ({
  notifyUsers: jest.fn().mockResolvedValue(undefined),
  getBranchManagerUserIds: jest.fn().mockResolvedValue([]),
}));

const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { submitReport } = require("../src/controllers/timesheetController");

const STAFF_ID = 4;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function makeReq(body) {
  return { user: { user_id: 5 }, body, file: undefined };
}

describe("submitReport — casual worker actual-hours submission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.staff.findFirst.mockResolvedValue({ staff_id: STAFF_ID });
    prisma.staff.findUnique.mockResolvedValue({ users: { full_name: "Neymar" } });
    prisma.shifts.findUnique.mockResolvedValue({ branch_id: 2, title: "Cybersecurity" });
    prisma.task_assignments.findFirst.mockResolvedValue({ assignment_id: 1 }); // submitter is assigned to the shift by default

    supabaseAdmin.from.mockImplementation((table) => {
      if (table === "timesheets") {
        // No existing report for this shift — insert path.
        const chain = makeSupabaseChain({ data: null, error: null });
        // .select().eq().eq().maybeSingle() -> no existing row
        // .insert().select().single() -> the created row, echoing back what was inserted
        chain.insert = jest.fn((row) => {
          const inserted = { timesheet_id: 99, ...row };
          return makeSupabaseChain({ data: inserted, error: null });
        });
        return chain;
      }
      return makeSupabaseChain({ data: null, error: null });
    });
  });

  test("valid start/end range submits and derives hours_worked correctly", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Covered the evening shift",
      start_time: "16:00", end_time: "22:00",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      timesheet: expect.objectContaining({ hours_worked: 6, start_time: "16:00", end_time: "22:00", status: "pending" }),
    }));
  });

  test("end_time <= start_time is rejected with a clear message, not submitted", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Bad range",
      start_time: "22:00", end_time: "16:00",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/end time must be after start time/i),
    }));
  });

  test("providing only one of start_time/end_time is rejected", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Missing end time",
      start_time: "16:00", end_time: "",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("regular staff plain hours_worked path still works unchanged", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Regular shift", hours_worked: "8",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      timesheet: expect.objectContaining({ hours_worked: 8, start_time: null, end_time: null }),
    }));
  });

  test("no break_minutes provided → defaults to 0, hours_worked unaffected — the regression guard", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Covered the evening shift",
      start_time: "16:00", end_time: "22:00",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      timesheet: expect.objectContaining({ hours_worked: 6, break_minutes: 0 }),
    }));
  });

  test("break_minutes nets out of hours_worked on the start/end path", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Covered the evening shift",
      start_time: "16:00", end_time: "22:00", break_minutes: "30",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      timesheet: expect.objectContaining({ hours_worked: 5.5, break_minutes: 30 }),
    }));
  });

  test("break_minutes nets out of hours_worked on the regular-staff plain-hours path too", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Regular shift", hours_worked: "8", break_minutes: "30",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      timesheet: expect.objectContaining({ hours_worked: 7.5, break_minutes: 30 }),
    }));
  });

  test("break equal to the start/end span is rejected", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Covered the evening shift",
      start_time: "16:00", end_time: "22:00", break_minutes: "360",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/break cannot be equal to or longer/i),
    }));
  });

  test("break exceeding the plain-hours span is rejected", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Regular shift", hours_worked: "8", break_minutes: "500",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test("negative break_minutes is rejected", async () => {
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "Regular shift", hours_worked: "8", break_minutes: "-10",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("a staff member with no assignment on the given shift is rejected outright", async () => {
    prisma.task_assignments.findFirst.mockResolvedValue(null); // never assigned to shift 38
    const req = makeReq({
      shift_id: 38, log_date: "2026-08-07",
      description: "I was totally there", hours_worked: "8",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: expect.stringMatching(/aren't assigned/i),
    }));
  });

  test("a submission with no shift_id at all skips the assignment check entirely", async () => {
    const req = makeReq({
      log_date: "2026-08-07", description: "Ad-hoc hours", hours_worked: "3",
    });
    const res = makeRes();
    await submitReport(req, res);

    expect(prisma.task_assignments.findFirst).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
