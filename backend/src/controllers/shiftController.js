const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUsers, notifyUsersBatched } = require("../utils/notify");
const { logAudit } = require("../utils/auditLog");
const logger = require("../config/logger");
const { parsePagination } = require("../utils/pagination");
const sendServerError = require("../utils/sendServerError");

async function getAssignedStaffUserIds(shiftId) {
  const assignments = await prisma.task_assignments.findMany({
    where: { shift_id: shiftId, staff_id: { not: null } },
    include: { staff: { select: { user_id: true } } },
  });
  return assignments.map(a => a.staff?.user_id).filter(Boolean);
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// Prisma serializes date/time columns as full ISO strings (e.g. "1970-01-01T09:00:00.000Z" for a
// `time` column). Frontend formatters expect Supabase-direct's plain "HH:MM:SS" / "YYYY-MM-DD" —
// normalize here so nothing downstream has to special-case the two formats.
function toHHMMSS(t) {
  if (!t) return null;
  const s = t instanceof Date ? t.toISOString() : String(t);
  return s.includes("T") ? s.slice(11, 19) : s;
}
function toDateOnly(d) {
  if (!d) return null;
  const s = d instanceof Date ? d.toISOString() : String(d);
  return s.includes("T") ? s.slice(0, 10) : s;
}
function normalizeShift(shift) {
  if (!shift) return shift;
  return {
    ...shift,
    shift_date: toDateOnly(shift.shift_date),
    start_time: toHHMMSS(shift.start_time),
    end_time: toHHMMSS(shift.end_time),
    shift_tasks: (shift.shift_tasks || []).map(t => ({ ...t, start_time: toHHMMSS(t.start_time), end_time: toHHMMSS(t.end_time) })),
  };
}

const getShifts = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found for your account." });

    const where = { branch_id: branchId };
    const include = {
      branches: true,
      users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
      shift_tasks: {
        include: {
          skills: { select: { skill_id: true, name: true } },
          task_assignments: {
            include: {
              staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
            },
          },
        },
      },
    };

    const { requested, page, limit, skip } = parsePagination(req.query);
    if (!requested) {
      // No ?page/?limit supplied — preserve the pre-pagination response shape unchanged so
      // existing frontend calls keep working without a coordinated update.
      const shifts = await prisma.shifts.findMany({ where, include, orderBy: { shift_date: "asc" } });
      return res.json({ success: true, shifts });
    }

    const [data, total] = await Promise.all([
      prisma.shifts.findMany({ where, include, orderBy: { shift_date: "asc" }, skip, take: limit }),
      prisma.shifts.count({ where }),
    ]);
    res.json({ success: true, data, page, limit, total });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const getShiftById = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      include: {
        branches: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
        shift_tasks: {
          include: {
            skills: { select: { skill_id: true, name: true } },
            task_assignments: {
              include: {
                staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } },
              },
            },
          },
        },
      },
    });

    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && shift.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, shift: normalizeShift(shift) });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const createShift = async (req, res) => {
  try {
    const callerBranchId = await getCallerBranchId(req.user.user_id);
    const { branch_id, title, shift_date, start_time, end_time, deadline, status } = req.body;

    // Ensure manager can only create shifts for their own branch
    if (callerBranchId && branch_id && branch_id !== callerBranchId)
      return res.status(403).json({ success: false, message: "Cannot create shifts for a different branch." });

    // This schema has no support for a shift crossing midnight (shift_date is a single DATE,
    // start/end are TIME-only columns with no day component — see shiftGenerationController.js's
    // own comment on the same constraint). end_time <= start_time silently produces a
    // zero/negative-duration shift rather than an error, which is worse than just rejecting it.
    if (start_time && end_time && end_time <= start_time) {
      return res.status(400).json({ success: false, message: "End time must be after start time." });
    }

    // Round 5, Task 4: operating_days no longer blocks manual creation here. Every operating day
    // is now generated automatically (Round 3's automatic shift generation), so a manager reaching
    // this form is deliberately creating an exception (a closure-day cover shift, a one-off on a
    // normally-closed day, etc.) — blocking exactly the case manual creation exists for defeated
    // its own purpose. The frontend still shows a non-blocking explanatory note for the date.
    const shift = await prisma.shifts.create({
      data: {
        branch_id: branch_id || callerBranchId,
        title: title || null,
        shift_date: new Date(shift_date),
        start_time: new Date(`1970-01-01T${start_time}:00Z`),
        end_time: new Date(`1970-01-01T${end_time}:00Z`),
        deadline: deadline ? new Date(deadline) : null,
        status,
        created_by: req.user.user_id,
        source: "manual",
      },
    });

    // Advisory only — other shifts on the same branch/date whose time window overlaps this one.
    // Never blocks creation; the manager decides whether the overlap is intentional (e.g. a
    // handover window or a cover shift).
    const overlapping = await prisma.shifts.findMany({
      where: {
        branch_id: shift.branch_id,
        shift_date: shift.shift_date,
        shift_id: { not: shift.shift_id },
        status: { not: "cancelled" },
        start_time: { lt: shift.end_time },
        end_time: { gt: shift.start_time },
      },
      select: { title: true, start_time: true, end_time: true },
    });
    const warnings = overlapping.map(o =>
      `Overlaps with existing shift: ${o.title || "Untitled Shift"} ${toHHMMSS(o.start_time)?.slice(0, 5)}–${toHHMMSS(o.end_time)?.slice(0, 5)}`
    );

    res.status(201).json({ success: true, message: "Shift created successfully", shift, ...(warnings.length > 0 ? { warnings } : {}) });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const updateShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { branch_id: true, status: true, shift_date: true, start_time: true, end_time: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && existing.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const { branch_id, title, shift_date, start_time, end_time, status } = req.body;

    // Same "no midnight-crossing shifts" constraint as createShift — a partial update might only
    // touch one of the two times, so fall back to the existing value for whichever wasn't sent.
    const effectiveStart = start_time || toHHMMSS(existing.start_time)?.slice(0, 5);
    const effectiveEnd = end_time || toHHMMSS(existing.end_time)?.slice(0, 5);
    if (effectiveStart && effectiveEnd && effectiveEnd <= effectiveStart) {
      return res.status(400).json({ success: false, message: "End time must be after start time." });
    }

    const shift = await prisma.shifts.update({
      where: { shift_id: shiftId },
      data: {
        branch_id: branch_id,
        title,
        shift_date: shift_date ? new Date(shift_date) : undefined,
        start_time: start_time ? new Date(`1970-01-01T${start_time}:00Z`) : undefined,
        end_time: end_time ? new Date(`1970-01-01T${end_time}:00Z`) : undefined,
        status,
      },
    });

    try {
      const wasVisible = existing.status !== "draft";
      const justPublished = existing.status === "draft" && status && status !== "draft";
      const dateOrTimeChanged = shift_date || start_time || end_time;
      const cancelled = status === "cancelled" && existing.status !== "cancelled";
      const dateStr = shift.shift_date ? new Date(shift.shift_date).toISOString().slice(0, 10) : "";

      if (justPublished) {
        const staffUserIds = await getAssignedStaffUserIds(shiftId);
        await notifyUsers(staffUserIds, {
          type: "shift_assigned",
          title: "New Shift Assignment",
          message: `You've been assigned to ${shift.title || "a shift"} on ${dateStr}.`,
          relatedEntity: "shifts",
          relatedId: shiftId,
        });
      } else if (wasVisible && (dateOrTimeChanged || cancelled)) {
        const staffUserIds = await getAssignedStaffUserIds(shiftId);
        await notifyUsers(staffUserIds, {
          type: cancelled ? "shift_cancelled" : "shift_updated",
          title: cancelled ? "Shift Cancelled" : "Shift Updated",
          message: cancelled
            ? `${shift.title || "Your shift"} on ${dateStr} has been cancelled.`
            : `${shift.title || "Your shift"} on ${dateStr} has been updated. Please check the new details.`,
          relatedEntity: "shifts",
          relatedId: shiftId,
        });
      }
    } catch { /* notification failure shouldn't block the update */ }

    await logAudit({
      actorId: req.user.user_id, action: "shift_updated", entity: "shifts", entityId: shiftId,
      before: existing, after: { title: shift.title, shift_date: shift.shift_date, status: shift.status },
    });

    res.json({ success: true, message: "Shift updated successfully", shift });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// GET the counts a confirmation dialog needs before committing to a bulk publish — never
// mutates. Round 6, Task 4b.
const previewBulkPublish = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    const shiftIds = (req.body.shift_ids || []).map(Number).filter(Number.isInteger);
    if (shiftIds.length === 0) return res.status(400).json({ success: false, message: "shift_ids required." });

    const shifts = await prisma.shifts.findMany({
      where: { shift_id: { in: shiftIds } },
      include: { shift_tasks: { select: { status: true } }, task_assignments: { where: { staff_id: { not: null } }, include: { staff: { select: { user_id: true } } } } },
    });
    const inBranch = shifts.filter(s => !branchId || s.branch_id === branchId);
    const drafts = inBranch.filter(s => s.status === "draft");
    const unfilledShiftCount = drafts.filter(s => s.shift_tasks.some(t => t.status === "open")).length;
    const staffIds = new Set();
    drafts.forEach(s => s.task_assignments.forEach(a => a.staff?.user_id && staffIds.add(a.staff.user_id)));

    return res.json({
      success: true,
      requested_count: shiftIds.length,
      draft_count: drafts.length,
      non_draft_count: inBranch.length - drafts.length,
      unfilled_shift_count: unfilledShiftCount,
      staff_count: staffIds.size,
    });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// Publishes every DRAFT shift in shift_ids (silently skips any that aren't draft — never touches
// published/cancelled/completed) and sends exactly ONE notification per affected staff member,
// regardless of how many of their shifts got published. Reuses the same status-transition +
// per-staff notification shape as the single-shift path in updateShift above, just batched
// (Round 6, Task 4b/4c/4d) — this is the one publish path; the frontend's single-shift button
// now calls PATCH /:id same as before, and this endpoint is purely additive for bulk.
const publishBulkShifts = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    const shiftIds = (req.body.shift_ids || []).map(Number).filter(Number.isInteger);
    if (shiftIds.length === 0) return res.status(400).json({ success: false, message: "shift_ids required." });

    const shifts = await prisma.shifts.findMany({
      where: { shift_id: { in: shiftIds } },
      include: { task_assignments: { where: { staff_id: { not: null } }, include: { staff: { select: { user_id: true } } } } },
    });
    const inBranch = shifts.filter(s => !branchId || s.branch_id === branchId);
    const drafts = inBranch.filter(s => s.status === "draft");
    const skipped = inBranch.length - drafts.length;

    if (drafts.length === 0) {
      return res.json({ success: true, published_count: 0, skipped_count: skipped, notified_count: 0 });
    }

    await prisma.shifts.updateMany({ where: { shift_id: { in: drafts.map(s => s.shift_id) } }, data: { status: "published" } });

    // Aggregate per staff member across every shift they're on, so each person gets exactly one
    // notification row no matter how many of their shifts were just published.
    const shiftCountByUser = new Map();
    let earliestDateByUser = new Map();
    for (const shift of drafts) {
      const userIds = new Set(shift.task_assignments.map(a => a.staff?.user_id).filter(Boolean));
      for (const userId of userIds) {
        shiftCountByUser.set(userId, (shiftCountByUser.get(userId) || 0) + 1);
        const prev = earliestDateByUser.get(userId);
        if (!prev || shift.shift_date < prev) earliestDateByUser.set(userId, shift.shift_date);
      }
    }

    function weekOfLabel(date) {
      const d = new Date(date);
      const day = d.getUTCDay();
      const monday = new Date(d);
      monday.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
      return monday.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    }

    await notifyUsersBatched([...shiftCountByUser.entries()].map(([recipientId, count]) => ({
      recipientId,
      type: "shift_published",
      title: "Schedule Published",
      message: `Your schedule for the week of ${weekOfLabel(earliestDateByUser.get(recipientId))} has been published — ${count} shift${count === 1 ? "" : "s"}.`,
      relatedEntity: "shifts",
      relatedId: null,
    })));

    await logAudit({
      actorId: req.user.user_id, action: "shifts_bulk_published", entity: "shifts", entityId: null,
      before: null, after: { shift_ids: drafts.map(s => s.shift_id), count: drafts.length },
    });

    return res.json({ success: true, published_count: drafts.length, skipped_count: skipped, notified_count: shiftCountByUser.size });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

const deleteShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { branch_id: true, status: true, title: true, shift_date: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (branchId && existing.branch_id !== branchId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const staffUserIds = existing.status !== "draft" ? await getAssignedStaffUserIds(shiftId) : [];

    // Delete in FK dependency order (DB constraints may not cascade automatically)
    const assignments = await prisma.task_assignments.findMany({ where: { shift_id: shiftId }, select: { assignment_id: true } });
    const assignmentIds = assignments.map(a => a.assignment_id);
    if (assignmentIds.length > 0) {
      // swap_requests references task_assignments with NoAction — must go first
      await prisma.swap_requests.deleteMany({
        where: { OR: [{ requester_assign: { in: assignmentIds } }, { target_assign_id: { in: assignmentIds } }] },
      });
      await prisma.task_assignments.deleteMany({ where: { assignment_id: { in: assignmentIds } } });
    }
    await prisma.shift_tasks.deleteMany({ where: { shift_id: shiftId } });
    await prisma.shifts.delete({ where: { shift_id: shiftId } });

    try {
      const dateStr = existing.shift_date ? new Date(existing.shift_date).toISOString().slice(0, 10) : "";
      await notifyUsers(staffUserIds, {
        type: "shift_cancelled",
        title: "Shift Cancelled",
        message: `${existing.title || "Your shift"} on ${dateStr} has been cancelled.`,
        relatedEntity: "shifts",
        relatedId: shiftId,
      });
    } catch { /* notification failure shouldn't block the deletion */ }

    await logAudit({
      actorId: req.user.user_id, action: "shift_deleted", entity: "shifts", entityId: shiftId,
      before: { title: existing.title, shift_date: existing.shift_date, status: existing.status }, after: null,
    });

    res.json({ success: true, message: "Shift deleted successfully" });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift, previewBulkPublish, publishBulkShifts };
