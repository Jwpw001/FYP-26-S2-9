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

  // Deleted one at a time rather than a single deleteMany: an assignment that's ever been
  // involved in a swap request (swap_requests.requester_assign/target_assign_id, both a NOT
  // NULL/ON DELETE NO ACTION FK straight at assignment_id) can't be deleted at all, and a single
  // batch delete containing even one such row fails the whole statement — silently leaving the
  // staff member deactivated (that update already committed above, in updateStaff) but still
  // assigned to every one of their future shifts, with the manager seeing a raw DB error instead
  // of any indication of what actually happened. Isolating each delete means the normal case
  // (no swap history) still cleans up everything, and the rare blocked one is skipped rather than
  // taking the rest down with it.
  const removed = [];
  for (const a of futureAssignments) {
    try {
      await prisma.task_assignments.delete({ where: { assignment_id: a.assignment_id } });
      removed.push(a);
    } catch { /* referenced by a swap_requests row — leave this one assigned, see comment above */ }
  }
  if (removed.length > 0) {
    await prisma.shift_tasks.updateMany({ where: { task_id: { in: removed.map(a => a.task_id) } }, data: { status: "open" } });
  }
  const skippedCount = futureAssignments.length - removed.length;

  // Group by branch so each branch's managers get one consolidated notification, not one per shift.
  const byBranch = {};
  removed.forEach(a => {
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
      message: `${staffName} was deactivated and has been removed from ${rows.length} upcoming shift${rows.length !== 1 ? "s" : ""}. Please assign replacement coverage.`
        + (skippedCount > 0 ? ` ${skippedCount} other shift${skippedCount !== 1 ? "s" : ""} couldn't be auto-removed due to swap history — please check manually.` : ""),
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
    after: { is_active: false, shifts_unassigned: removed.length, shifts_skipped: skippedCount },
  });

  return { unassignedCount: removed.length, skippedCount };
}

module.exports = { offboardStaff };
