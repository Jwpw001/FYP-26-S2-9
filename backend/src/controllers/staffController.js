const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const { offboardStaff } = require("../utils/offboarding");

async function getCallerBranchId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { branch_id: true } });
  if (s?.branch_id) return s.branch_id;
  const { data: mgr } = await supabaseAdmin.from("branch_managers").select("branch_id").eq("user_id", userId).limit(1).maybeSingle();
  return mgr?.branch_id || null;
}

// True if this staff member is visible on the given branch's roster: regular staff via their
// home branch_id, casual staff via casual_branch_preferences (branch_id is just their origin).
async function staffBelongsToBranch(staff, branchId) {
  if (staff.staff_type !== "casual") return staff.branch_id === branchId;
  const { data } = await supabaseAdmin
    .from("casual_branch_preferences")
    .select("id")
    .eq("user_id", staff.user_id)
    .eq("branch_id", branchId)
    .maybeSingle();
  return !!data;
}

const getStaff = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    if (!branchId) return res.status(403).json({ success: false, message: "No branch found for your account." });

    // Regular staff belong to exactly one branch. Casual staff are pool-based — their appearance
    // on a branch's roster is governed entirely by casual_branch_preferences, not by their
    // staff.branch_id "home" (which is just where they were originally created).
    const regularStaff = await prisma.staff.findMany({
      where: { branch_id: branchId, staff_type: "regular", is_active: true },
      include: {
        users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
        branches: true,
      },
    });

    const { data: prefRows } = await supabaseAdmin
      .from("casual_branch_preferences")
      .select("user_id")
      .eq("branch_id", branchId);
    const preferredUserIds = [...new Set((prefRows || []).map(r => r.user_id))];

    const casualStaff = preferredUserIds.length > 0
      ? await prisma.staff.findMany({
          where: { user_id: { in: preferredUserIds }, staff_type: "casual", is_active: true },
          include: {
            users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
            branches: true,
          },
        })
      : [];

    res.json({ success: true, staff: [...regularStaff, ...casualStaff] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getStaffById = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const staff = await prisma.staff.findUnique({
      where: { staff_id: staffId },
      include: {
        users: { select: { user_id: true, full_name: true, email: true, role: true, avatar_url: true } },
        branches: true,
      },
    });

    if (!staff) return res.status(404).json({ success: false, message: "Staff not found" });
    if (branchId && !(await staffBelongsToBranch(staff, branchId)))
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createStaff = async (req, res) => {
  try {
    const branchId = await getCallerBranchId(req.user.user_id);
    const { user_id, branch_id, staff_type, default_work_days, hired_at, is_active } = req.body;

    // Ensure manager can only create staff for their own branch
    const targetBranch = branch_id || branchId;
    if (branchId && targetBranch !== branchId)
      return res.status(403).json({ success: false, message: "Cannot create staff for a different branch." });

    const staff = await prisma.staff.create({
      data: { user_id, branch_id: targetBranch, staff_type, default_work_days, hired_at: hired_at ? new Date(hired_at) : null, is_active },
    });
    res.status(201).json({ success: true, message: "Staff created successfully", staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateStaff = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.staff.findUnique({ where: { staff_id: staffId }, select: { branch_id: true, staff_type: true, user_id: true, is_active: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Staff not found" });
    if (branchId && !(await staffBelongsToBranch(existing, branchId)))
      return res.status(403).json({ success: false, message: "Access denied." });

    const { branch_id, staff_type, default_work_days, hired_at, is_active } = req.body;
    const staff = await prisma.staff.update({
      where: { staff_id: staffId },
      data: { branch_id: branch_id, staff_type, default_work_days, hired_at: hired_at ? new Date(hired_at) : undefined, is_active },
    });

    const isBeingDeactivated = is_active === false && existing.is_active !== false;
    if (isBeingDeactivated) {
      await offboardStaff(staffId, req.user.user_id);
    }

    res.json({ success: true, message: "Staff updated successfully", staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteStaff = async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const branchId = await getCallerBranchId(req.user.user_id);

    const existing = await prisma.staff.findUnique({ where: { staff_id: staffId }, select: { branch_id: true, staff_type: true, user_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Staff not found" });
    if (branchId && !(await staffBelongsToBranch(existing, branchId)))
      return res.status(403).json({ success: false, message: "Access denied." });

    await prisma.staff.delete({ where: { staff_id: staffId } });
    res.json({ success: true, message: "Staff deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getStaff, getStaffById, createStaff, updateStaff, deleteStaff };
