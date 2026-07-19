const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

const EVIDENCE_BUCKET = "report-evidence";
const MANAGER_ROLES = ["manager", "business_owner", "system_admin"];

function sanitizeFilename(name) {
  return (name || "file").replace(/[^a-zA-Z0-9._-]/g, "_");
}

// POST /api/timesheets — submit (or resubmit) a work report, with an optional evidence file
const submitReport = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const staffRow = await prisma.staff.findFirst({ where: { user_id: userId }, select: { staff_id: true } });
    if (!staffRow) return res.status(404).json({ success: false, message: "Staff record not found." });

    const { shift_id, log_date, hours_worked, description } = req.body;
    const hours = Number(hours_worked);
    if (!log_date) return res.status(400).json({ success: false, message: "log_date is required." });
    if (!hours || hours <= 0) return res.status(400).json({ success: false, message: "Valid hours_worked is required." });
    if (!description?.trim()) return res.status(400).json({ success: false, message: "Description is required." });

    const shiftId = shift_id ? Number(shift_id) : null;

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

    res.json({ success: true, timesheet: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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

    const isOwner = !MANAGER_ROLES.includes(req.user.role) && await prisma.staff.findFirst({
      where: { user_id: req.user.user_id, staff_id: ts.staff_id },
      select: { staff_id: true },
    });
    if (!MANAGER_ROLES.includes(req.user.role) && !isOwner) {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    const { data: signed, error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .createSignedUrl(ts.evidence_path, 300, { download: ts.evidence_name || true });
    if (error) throw new Error(error.message);

    res.json({ success: true, url: signed.signedUrl, filename: ts.evidence_name });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { submitReport, getEvidenceUrl };
