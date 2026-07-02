const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

function getSb() { return supabaseAdmin; }

// Get caller's outlet_id and business_id — checks staff table first, then outlet_managers
async function getCallerContext(userId) {
  let outlet_id;
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  if (s?.outlet_id) {
    outlet_id = s.outlet_id;
  } else {
    const { data: om } = await getSb().from("outlet_managers").select("outlet_id").eq("user_id", userId).maybeSingle();
    if (!om?.outlet_id) return null;
    outlet_id = om.outlet_id;
  }
  const { data: outlet } = await getSb().from("outlets").select("business_id").eq("outlet_id", outlet_id).maybeSingle();
  return { outlet_id, business_id: outlet?.business_id };
}

// ── GET all projects for the business ────────────────────────────────────────
const getProjects = async (req, res) => {
  try {
    const ctx = await getCallerContext(req.user.user_id);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found." });

    const projects = await prisma.projects.findMany({
      where: { business_id: ctx.business_id },
      include: {
        project_assignments: {
          include: { staff: { include: { users: { select: { full_name: true } } } } }
        },
        timesheets: { select: { hours_worked: true, status: true } }
      },
      orderBy: { created_at: "desc" }
    });

    // Enrich with computed stats
    const enriched = projects.map(p => {
      const totalLogged  = p.timesheets.filter(t => t.status === "approved").reduce((s, t) => s + Number(t.hours_worked), 0);
      const totalEstimated = p.project_assignments.reduce((s, a) => s + Number(a.estimated_hours), 0);
      return { ...p, total_logged_hours: totalLogged, total_estimated_hours: totalEstimated };
    });

    res.json({ success: true, projects: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── CREATE project ────────────────────────────────────────────────────────────
const createProject = async (req, res) => {
  try {
    const ctx = await getCallerContext(req.user.user_id);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found." });

    const { name, description, start_date, end_date, color, staff_ids } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Project name is required." });

    const project = await prisma.projects.create({
      data: {
        business_id: ctx.business_id,
        location_id: ctx.outlet_id,
        name: name.trim(),
        description: description || null,
        start_date: start_date ? new Date(start_date) : null,
        end_date:   end_date   ? new Date(end_date)   : null,
        color: color || "#6366F1",
        created_by: req.user.user_id,
      }
    });

    // Assign staff if provided
    if (Array.isArray(staff_ids) && staff_ids.length > 0) {
      await prisma.project_assignments.createMany({
        data: staff_ids.map(staff_id => ({ project_id: project.project_id, staff_id: Number(staff_id), estimated_hours: 0 })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── UPDATE project ────────────────────────────────────────────────────────────
const updateProject = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { name, description, start_date, end_date, color, status } = req.body;

    const project = await prisma.projects.update({
      where: { project_id: projectId },
      data: {
        name:        name?.trim()                  || undefined,
        description: description                    ?? undefined,
        start_date:  start_date ? new Date(start_date) : undefined,
        end_date:    end_date   ? new Date(end_date)   : undefined,
        color:       color                          || undefined,
        status:      status                         || undefined,
      }
    });

    res.json({ success: true, project });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── DELETE project ────────────────────────────────────────────────────────────
const deleteProject = async (req, res) => {
  try {
    await prisma.projects.delete({ where: { project_id: Number(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Assign / remove staff from project ───────────────────────────────────────
const assignStaff = async (req, res) => {
  try {
    const projectId = Number(req.params.id);
    const { staff_id, estimated_hours, role_on_project } = req.body;

    const assignment = await prisma.project_assignments.upsert({
      where:  { project_id_staff_id: { project_id: projectId, staff_id: Number(staff_id) } },
      create: { project_id: projectId, staff_id: Number(staff_id), estimated_hours: estimated_hours || 0, role_on_project: role_on_project || null },
      update: { estimated_hours: estimated_hours ?? undefined, role_on_project: role_on_project ?? undefined },
    });

    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const removeStaff = async (req, res) => {
  try {
    await prisma.project_assignments.delete({
      where: { project_id_staff_id: { project_id: Number(req.params.id), staff_id: Number(req.params.staffId) } }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── Capacity — weekly hours per staff ────────────────────────────────────────
const getCapacity = async (req, res) => {
  try {
    const ctx = await getCallerContext(req.user.user_id);
    if (!ctx) return res.status(403).json({ success: false, message: "No business found." });

    const { weekStart, weekEnd } = req.query;
    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    // All active staff at this outlet (exclude managers)
    const allStaff = await prisma.staff.findMany({
      where: { outlet_id: ctx.outlet_id, is_active: true },
      include: { users: { select: { full_name: true, role: true } } }
    }).then(list => list.filter(s => s.users?.role !== "outlet_manager"));

    // Timesheets logged this week
    const timesheets = await prisma.timesheets.findMany({
      where: {
        staff_id: { in: allStaff.map(s => s.staff_id) },
        log_date: { gte: new Date(weekStart), lte: new Date(weekEnd) }
      },
      include: { projects: { select: { name: true, color: true } } }
    });

    // Leave requests this week
    const leave = await prisma.availability.findMany({
      where: {
        staff: { outlet_id: ctx.outlet_id },
        status: "approved",
        start_date: { lte: new Date(weekEnd) },
        end_date:   { gte: new Date(weekStart) }
      },
      select: { staff_id: true, leave_type: true, start_date: true, end_date: true }
    });

    const capacity = allStaff.map(s => {
      const logs       = timesheets.filter(t => t.staff_id === s.staff_id);
      const hoursLogged = logs.reduce((sum, t) => sum + Number(t.hours_worked), 0);
      const onLeave    = leave.some(l => l.staff_id === s.staff_id);
      return {
        staff_id:     s.staff_id,
        name:         s.users?.full_name,
        role:         s.users?.role,
        experience:   s.experience_level,
        hours_logged: hoursLogged,
        hours_target: 40,
        utilisation:  Math.round((hoursLogged / 40) * 100),
        on_leave:     onLeave,
        logs:         logs.map(t => ({ date: t.log_date, hours: Number(t.hours_worked), project: t.projects?.name, color: t.projects?.color, status: t.status }))
      };
    });

    res.json({ success: true, capacity });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getProjects, createProject, updateProject, deleteProject, assignStaff, removeStaff, getCapacity };
