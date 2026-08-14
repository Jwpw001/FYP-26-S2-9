// F2: manual assignStaff (taskController.js) is deliberately never gated by the regular-shortfall
// check added to casualController.js's autoAssignCasual — it stays the escape hatch for a manager
// who genuinely needs to put a casual on a task even though a contracted regular is short. This
// only proves the escape hatch still works; the round's own comment on assignStaff (checkLaborRules
// is advisory, not blocking, "a manager who gets blocked works around the system") already covers
// why manual assignment isn't gated in the first place.
jest.mock("../src/config/prisma", () => ({
  shifts: { findUnique: jest.fn() },
  shift_tasks: { findUnique: jest.fn(), update: jest.fn() },
  task_assignments: { findFirst: jest.fn(), create: jest.fn(), findMany: jest.fn() },
  staff: { findFirst: jest.fn() },
}));
jest.mock("../src/config/supabaseAdmin", () => ({ from: jest.fn() }));
jest.mock("../src/utils/notify", () => ({ notifyUser: jest.fn().mockResolvedValue(undefined), notifyUsers: jest.fn(), getBranchManagerUserIds: jest.fn() }));
jest.mock("../src/utils/auditLog", () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

const { makeSupabaseChain } = require("./helpers/supabaseChain");
const prisma = require("../src/config/prisma");
const supabaseAdmin = require("../src/config/supabaseAdmin");
const { assignStaff } = require("../src/controllers/taskController");

const t = (hhmm) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const BRANCH_ID = 9, SHIFT_ID = 1, TASK_ID = 1, CASUAL_STAFF_ID = 102, MANAGER_USER_ID = 500;

function makeRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

test("manual assignment succeeds even when a regular would be short of contract (F2 does not gate this path)", async () => {
  prisma.shift_tasks.findUnique.mockResolvedValue({
    shift_id: SHIFT_ID, status: "open", shifts: { branch_id: BRANCH_ID },
  });
  // getCallerBranchId: staff.findFirst first, falls back to supabaseAdmin branch_managers.
  prisma.staff.findFirst.mockResolvedValue({ branch_id: BRANCH_ID });
  prisma.task_assignments.findFirst.mockResolvedValue(null); // task not already assigned
  // checkLaborRules's own fallback path (no prefetch passed from this call site): shift lookup,
  // branch_settings, then a bounded assignments query — all mocked to "no conflicts".
  prisma.shifts.findUnique.mockResolvedValue({ shift_date: new Date("2026-08-10T00:00:00.000Z"), start_time: t("09:00"), end_time: t("13:00") });
  supabaseAdmin.from.mockReturnValue(makeSupabaseChain({ data: { max_work_hours_day: 12, max_consecutive_days: 6, allow_overtime: false }, error: null }));
  prisma.task_assignments.findMany.mockResolvedValue([]);
  prisma.task_assignments.create.mockResolvedValue({
    assignment_id: 1, task_id: TASK_ID, shift_id: SHIFT_ID, staff_id: CASUAL_STAFF_ID, status: "assigned",
    staff: { users: { user_id: 202, full_name: "Casey Casual", email: "casey@example.com" } },
    shift_tasks: { title: "Cashier" },
  });
  prisma.shift_tasks.update.mockResolvedValue({});

  const req = { params: { taskId: String(TASK_ID) }, body: { staff_id: CASUAL_STAFF_ID }, user: { user_id: MANAGER_USER_ID } };
  const res = makeRes();
  await assignStaff(req, res);

  expect(res.status).not.toHaveBeenCalledWith(400);
  expect(res.status).not.toHaveBeenCalledWith(403);
  expect(res.status).not.toHaveBeenCalledWith(409);
  const body = res.json.mock.calls[0][0];
  expect(body.success).toBe(true);
  expect(prisma.task_assignments.create).toHaveBeenCalledTimes(1);
});
