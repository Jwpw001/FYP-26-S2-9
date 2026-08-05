const prisma = require("../config/prisma");
const { notifyUsers, getBranchManagerUserIds } = require("./notify");
const { logAudit } = require("./auditLog");

// When a staff member is deactivated, they shouldn't be left silently assigned to shifts
// they're no longer expected to show up for. Unassigns them from every future shift, reopens
// those tasks so they show up as needing coverage again, and notifies the branch's managers.
async function offboardStaff(staffId, actorUserId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const futureAssignments = await prisma.task_assignments.findMany({
    where: { staff_id: staffId, shifts: { shift_date: { gte: today } } },
    select: {
      assignment_id: true,
      task_id: true,
      shifts: { select: { branch_id: true, title: true, shift_date: true } },
    },
  });

  if (futureAssignments.length === 0) {
    await logAudit({
      actorId: actorUserId,
      action: "staff_deactivated",
      entity: "staff",
      entityId: staffId,
      before: { is_active: true },
      after: { is_active: false, shifts_unassigned: 0 },
    });
    return { unassignedCount: 0 };
  }

  const assignmentIds = futureAssignments.map(a => a.assignment_id);
  const taskIds = futureAssignments.map(a => a.task_id);

  await prisma.task_assignments.deleteMany({ where: { assignment_id: { in: assignmentIds } } });
  await prisma.shift_tasks.updateMany({ where: { task_id: { in: taskIds } }, data: { status: "open" } });

  // Group by branch so each branch's managers get one consolidated notification, not one per shift.
  const byBranch = {};
  futureAssignments.forEach(a => {
    const branchId = a.shifts?.branch_id;
    if (!branchId) return;
    if (!byBranch[branchId]) byBranch[branchId] = [];
    byBranch[branchId].push(a);
  });

  const staffRow = await prisma.staff.findUnique({
    where: { staff_id: staffId },
    select: { users: { select: { full_name: true } } },
  });
  const staffName = staffRow?.users?.full_name || "A staff member";

  for (const [branchId, rows] of Object.entries(byBranch)) {
    const managerIds = await getBranchManagerUserIds(Number(branchId));
    await notifyUsers(managerIds, {
      type: "staff_offboarded",
      title: "Staff Deactivated — Shifts Need Coverage",
      message: `${staffName} was deactivated and has been removed from ${rows.length} upcoming shift${rows.length !== 1 ? "s" : ""}. Please assign replacement coverage.`,
      relatedEntity: "staff",
      relatedId: staffId,
    });
  }

  await logAudit({
    actorId: actorUserId,
    action: "staff_deactivated",
    entity: "staff",
    entityId: staffId,
    before: { is_active: true },
    after: { is_active: false, shifts_unassigned: futureAssignments.length },
  });

  return { unassignedCount: futureAssignments.length };
}

module.exports = { offboardStaff };
