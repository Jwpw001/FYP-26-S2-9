// A staff deactivation used to remove all future task_assignments in one prisma.deleteMany()
// call. Any assignment ever referenced by a swap_requests row (requester_assign/target_assign_id,
// both NOT NULL/ON DELETE NO ACTION FKs at assignment_id) makes that single call fail outright —
// the whole batch, not just the blocked row — while the staff.update() setting is_active:false
// (called before offboardStaff, in updateStaff) had already committed. The manager saw a raw DB
// error and the staff member stayed silently assigned to every one of their future shifts.
jest.mock("../src/config/prisma", () => ({
  task_assignments: { findMany: jest.fn(), delete: jest.fn() },
  shift_tasks: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
  staff: { findUnique: jest.fn().mockResolvedValue({ users: { full_name: "Test Staff" } }) },
}));
jest.mock("../src/utils/notify", () => ({
  notifyUsers: jest.fn().mockResolvedValue(undefined),
  getBranchManagerUserIds: jest.fn().mockResolvedValue([9]),
}));
jest.mock("../src/utils/auditLog", () => ({ logAudit: jest.fn().mockResolvedValue(undefined) }));

const prisma = require("../src/config/prisma");
const { notifyUsers } = require("../src/utils/notify");
const { logAudit } = require("../src/utils/auditLog");
const { offboardStaff } = require("../src/utils/offboarding");

const STAFF_ID = 70, ACTOR_ID = 4;

beforeEach(() => jest.clearAllMocks());

test("no future assignments — logs and returns cleanly", async () => {
  prisma.task_assignments.findMany.mockResolvedValue([]);
  const result = await offboardStaff(STAFF_ID, ACTOR_ID);
  expect(result).toEqual({ unassignedCount: 0 });
  expect(prisma.task_assignments.delete).not.toHaveBeenCalled();
});

test("normal case: every assignment deletes cleanly and every task reopens", async () => {
  prisma.task_assignments.findMany.mockResolvedValue([
    { assignment_id: 1, task_id: 11, shifts: { branch_id: 1, title: "Morning", shift_date: "2026-09-01" } },
    { assignment_id: 2, task_id: 12, shifts: { branch_id: 1, title: "Evening", shift_date: "2026-09-02" } },
  ]);
  prisma.task_assignments.delete.mockResolvedValue({});

  const result = await offboardStaff(STAFF_ID, ACTOR_ID);

  expect(prisma.task_assignments.delete).toHaveBeenCalledTimes(2);
  expect(prisma.shift_tasks.updateMany).toHaveBeenCalledWith({
    where: { task_id: { in: [11, 12] } },
    data: { status: "open" },
  });
  expect(result.unassignedCount).toBe(2);
  expect(result.skippedCount).toBe(0);
  expect(notifyUsers).toHaveBeenCalledWith([9], expect.objectContaining({
    message: expect.not.stringContaining("couldn't be auto-removed"),
  }));
});

test("one assignment blocked by swap history: the rest still get cleaned up, the blocked one is skipped without crashing", async () => {
  prisma.task_assignments.findMany.mockResolvedValue([
    { assignment_id: 1, task_id: 11, shifts: { branch_id: 1, title: "Morning", shift_date: "2026-09-01" } },
    { assignment_id: 2, task_id: 12, shifts: { branch_id: 1, title: "Evening", shift_date: "2026-09-02" } },
  ]);
  prisma.task_assignments.delete.mockImplementation(({ where }) => {
    if (where.assignment_id === 2) {
      return Promise.reject(new Error('Foreign key constraint violated: "swap_requests_requester_assign_fkey"'));
    }
    return Promise.resolve({});
  });

  const result = await offboardStaff(STAFF_ID, ACTOR_ID);

  expect(result.unassignedCount).toBe(1);
  expect(result.skippedCount).toBe(1);
  // Only the successfully-removed task's shift_tasks row gets reopened.
  expect(prisma.shift_tasks.updateMany).toHaveBeenCalledWith({
    where: { task_id: { in: [11] } },
    data: { status: "open" },
  });
  expect(notifyUsers).toHaveBeenCalledWith([9], expect.objectContaining({
    message: expect.stringContaining("1 other shift couldn't be auto-removed due to swap history"),
  }));
  expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({
    after: expect.objectContaining({ shifts_unassigned: 1, shifts_skipped: 1 }),
  }));
});
