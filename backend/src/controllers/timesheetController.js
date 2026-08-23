const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { notifyUsers, getBranchManagerUserIds } = require("../utils/notify");
const { computeHoursMetrics, toMinutes } = require("../utils/hoursMetrics");

const sendServerError = require("../utils/sendServerError");
const EVIDENCE_BUCKET = "report-evidence";
const MANAGER_ROLES = ["manager", "business_owner", "system_admin"];

function sanitizeFilename(name) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// POST /api/timesheets — submit (or resubmit) a work report, with an optional evidence file
const submitReport = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const staffRow = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true } });
    if (!staffRow) return res.status(404).json({ success: false, message: "Staff record not found." });

    const { shift_id, log_date, hours_worked, description, start_time, end_time, break_minutes } = req.body;
    if (!log_date) return res.status(400).json({ success: false, message: "log_date is required." });
    if (!description?.trim()) return res.status(400).json({ success: false, message: "Description is required." });

    // Round 6, Task 3: defaults to 0 (never guessed) — an unset field means "no break was taken",
    // not "unknown". Shared by both submission paths below: MyShifts.jsx uses one form component
    // for casual (start/end) and regular (plain hours) staff alike, so both get the field.
    const breakMinutes = break_minutes !== undefined && break_minutes !== "" ? Number(break_minutes) : 0;
    if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
      return res.status(400).json({ success: false, message: "break_minutes must be zero or a positive number." });
    }

    // Round 3, Task 4: actual worked from/to time is optional (regular staff keep submitting a
    // plain hours_worked total, exactly as before). When both are given, they're the source of
    // truth — hours_worked is derived from them, not taken from the client, so the two can never
    // disagree. Midnight-crossing isn't supported anywhere else in this schema (shift creation
    // already rejects end <= start), so the same rule applies here rather than guessing a
    // next-day rollover for just this one form.
    let hours;
    let actualStart = null, actualEnd = null;
    if (start_time || end_time) {
      if (!start_time || !end_time) {
        return res.status(400).json({ success: false, message: "Provide both a start and end time, or neither." });
      }
      if (end_time <= start_time) {
        return res.status(400).json({ success: false, message: "End time must be after start time." });
      }
      const spanMinutes = toMinutes(end_time) - toMinutes(start_time);
      if (breakMinutes >= spanMinutes) {
        return res.status(400).json({ success: false, message: "Break cannot be equal to or longer than the time worked." });
      }
      const metrics = computeHoursMetrics({ actualStart: start_time, actualEnd: end_time, breakMinutes });
      hours = metrics.workedHours;
      actualStart = start_time;
      actualEnd = end_time;
    } else {
      const rawHours = Number(hours_worked);
      if (!rawHours || rawHours <= 0) return res.status(400).json({ success: false, message: "Valid hours_worked is required." });
      // No separate start/end for this path — the entered hours figure IS the span a break gets
      // measured against.
      if (breakMinutes >= rawHours * 60) {
        return res.status(400).json({ success: false, message: "Break cannot be equal to or longer than the time worked." });
      }
      hours = Math.round((rawHours - breakMinutes / 60) * 10) / 10;
    }

    const shiftId = shift_id ? Number(shift_id) : null;

    // Nothing here previously checked that the submitter was actually assigned to this shift —
    // shift_id came straight from the request body and was trusted outright, so anyone could
    // submit hours (and evidence) against a shift they were never rostered on. Reports feed
    // approval and, eventually, payroll, so this is a hard check, not advisory.
    if (shiftId) {
      const ownAssignment = await prisma.task_assignments.findFirst({
        where: { staff_id: staffRow.staff_id, shift_id: shiftId },
        select: { assignment_id: true },
      });
      if (!ownAssignment) {
        return res.status(403).json({ success: false, message: "You aren't assigned to this shift." });
      }
    }

    // A report already exists for this shift (e.g. rejected and being resubmitted) — update it
    const { data: existing } = await supabaseAdmin
      .from("timesheets")
      .select("timesheet_id, evidence_path")
      .eq("staff_id", staffRow.staff_id)
      .eq("shift_id", shiftId)
      .maybeSingle();

    let evidencePath = existing?.evidence_path || null;
    let evidenceName = null;

    if (req.file) {
      const path = `${staffRow.staff_id}/${Date.now()}_${sanitizeFilename(req.file.originalname)}`;
      const { error: uploadErr } = await supabaseAdmin.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, req.file.buffer, { contentType: req.file.mimetype });
      if (uploadErr) throw new Error(uploadErr.message);

      // Replace old evidence file, if any
      if (existing?.evidence_path) {
        await supabaseAdmin.storage.from(EVIDENCE_BUCKET).remove([existing.evidence_path]);
      }
      evidencePath = path;
      evidenceName = req.file.originalname;
    }

    const row = {
      staff_id: staffRow.staff_id,
      shift_id: shiftId,
      log_date,
      hours_worked: hours,
      start_time: actualStart,
      end_time: actualEnd,
      break_minutes: breakMinutes,
      description: description.trim(),
      status: "pending",
      evidence_path: evidencePath,
      ...(evidenceName ? { evidence_name: evidenceName } : {}),
    };

    let result;
    if (existing) {
      const { data, error } = await supabaseAdmin
        .from("timesheets")
        .update(row)
        .eq("timesheet_id", existing.timesheet_id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    } else {
      const { data, error } = await supabaseAdmin
        .from("timesheets")
        .insert(row)
        .select()
        .single();
      if (error) throw new Error(error.message);
      result = data;
    }

    try {
      const shift = shiftId ? await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { branch_id: true, title: true } }) : null;
      const staffUser = await prisma.staff.findUnique({ where: { staff_id: staffRow.staff_id }, select: { users: { select: { full_name: true } } } });
      if (shift?.branch_id) {
        const managerIds = await getBranchManagerUserIds(shift.branch_id);
        await notifyUsers(managerIds, {
          type: "report_submitted",
          title: "New Work Report Submitted",
          message: `${staffUser?.users?.full_name || "A staff member"} submitted a report for ${shift.title || "a shift"} on ${log_date}.`,
          relatedEntity: "timesheets",
          relatedId: result.timesheet_id,
        });
      }
    } catch { /* notification failure shouldn't block submission */ }

    res.json({ success: true, timesheet: result });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

// GET /api/timesheets/:id/evidence — signed download URL for a report's evidence file
const getEvidenceUrl = async (req, res) => {
  try {
    const timesheetId = Number(req.params.id);
    const { data: ts } = await supabaseAdmin
      .from("timesheets")
      .select("timesheet_id, staff_id, evidence_path, evidence_name")
      .eq("timesheet_id", timesheetId)
      .maybeSingle();
    if (!ts) return res.status(404).json({ success: false, message: "Report not found." });
    if (!ts.evidence_path) return res.status(404).json({ success: false, message: "No evidence uploaded for this report." });

    const isOwner = await prisma.staff.findFirst({
      where: { user_id: req.user.user_id, staff_id: ts.staff_id },
      select: { staff_id: true },
    });

    if (!isOwner) {
      if (!MANAGER_ROLES.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: "Access denied." });
      }
      // A branch manager (unlike business_owner/system_admin) is scoped to their own branch —
      // otherwise any manager could pull any other branch's evidence file by guessing the id.
      if (req.user.role === "manager") {
        const branchId = await getCallerBranchId(req.user.user_id);
        const targetStaff = await prisma.staff.findUnique({ where: { staff_id: ts.staff_id }, select: { branch_id: true } });
        if (branchId && targetStaff?.branch_id !== branchId) {
          return res.status(403).json({ success: false, message: "Access denied." });
        }
      }
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(ts.evidence_path, 300, { download: ts.evidence_name || true });
    if (error) throw new Error(error.message);

    res.json({ success: true, url: signed.signedUrl, filename: ts.evidence_name });
  } catch (error) {
    sendServerError(res, error, req);
  }
};

module.exports = { submitReport, getEvidenceUrl };
