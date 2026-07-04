const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");
const ROLES = require("../constants/roles");

function sb() { return supabaseAdmin; }

const TASK_MANAGER_ROLES = [ROLES.BUSINESS_OWNER, ROLES.OUTLET_MANAGER, ROLES.SYSTEM_ADMIN];

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getManagerCtx(userId) {
  let outlet_id, staff_id;
  const staff = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true, staff_id: true } });
  if (staff?.outlet_id) {
    outlet_id = staff.outlet_id;
    staff_id = staff.staff_id;
  } else {
    const { data: om } = await sb().from("outlet_managers").select("outlet_id").eq("user_id", userId).maybeSingle();
    if (!om?.outlet_id) return null;
    outlet_id = om.outlet_id;
  }
  const { data: outlet } = await sb().from("outlets").select("business_id, name").eq("outlet_id", outlet_id).maybeSingle();
  return { outlet_id, staff_id, business_id: outlet?.business_id };
}

async function getBOCtx(userId) {
  const { data: biz } = await sb().from("businesses").select("business_id").eq("owner_id", userId).maybeSingle();
  return biz ? { business_id: biz.business_id } : null;
}

// ── TASKS ─────────────────────────────────────────────────────────────────────

// Attach `assignees: [{user_id,full_name,email}]` to each task from task_assignees
async function attachAssignees(tasks) {
  const taskIds = tasks.map(t => t.task_id);
  if (taskIds.length === 0) return tasks;
  const { data: rows } = await sb()
    .from("task_assignees")
    .select("task_id, users(user_id, full_name, email)")
    .in("task_id", taskIds);
  const byTask = {};
  for (const r of rows || []) {
    if (!byTask[r.task_id]) byTask[r.task_id] = [];
    if (r.users) byTask[r.task_id].push(r.users);
  }
  return tasks.map(t => ({ ...t, assignees: byTask[t.task_id] || [] }));
}

// Replace a task's assignee set and keep assigned_to in sync as the primary (first) assignee
async function syncAssignees(task_id, assignee_ids) {
  const ids = Array.isArray(assignee_ids) ? [...new Set(assignee_ids.map(Number))] : [];
  await sb().from("task_assignees").delete().eq("task_id", task_id);
  if (ids.length > 0) {
    const { error } = await sb().from("task_assignees").insert(ids.map(user_id => ({ task_id, user_id })));
    if (error) throw error;
  }
  await sb().from("tasks").update({ assigned_to: ids[0] || null }).eq("task_id", task_id);
}

const getTasks = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { sprint_id, epic_id, status } = req.query;
    let q = sb().from("tasks")
      .select(`*, epics(epic_id,title,color), sprints(sprint_id,name), users!tasks_assigned_to_fkey(user_id,full_name,email)`)
      .eq("project_id", project_id)
      .order("order_index", { ascending: true });
    if (sprint_id) q = q.eq("sprint_id", sprint_id);
    if (epic_id)   q = q.eq("epic_id", epic_id);
    if (status)    q = q.eq("status", status);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ success: true, tasks: await attachAssignees(data || []) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createTask = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { title, description, priority = "medium", assignee_ids, due_date, required_skills } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
    const ids = Array.isArray(assignee_ids) ? [...new Set(assignee_ids.map(Number))] : [];
    const { data, error } = await sb().from("tasks").insert({
      project_id: Number(project_id), title: title.trim(), description: description || null,
      priority, assigned_to: ids[0] || null, due_date: due_date || null,
      required_skills: Array.isArray(required_skills) ? required_skills : [],
      created_by: req.user.user_id, status: "todo",
    }).select("*, users!tasks_assigned_to_fkey(user_id,full_name,email)").single();
    if (error) throw error;
    if (ids.length > 0) {
      const { error: assignErr } = await sb().from("task_assignees").insert(ids.map(user_id => ({ task_id: data.task_id, user_id })));
      if (assignErr) throw assignErr;
    }
    const [task] = await attachAssignees([data]);
    res.json({ success: true, task });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateTask = async (req, res) => {
  try {
    const { task_id } = req.params;

    // Non-managers may only change a task's status, and only if they're assigned to it
    if (!TASK_MANAGER_ROLES.includes(req.user.role)) {
      const bodyKeys = Object.keys(req.body);
      if (bodyKeys.some(k => k !== "status")) {
        return res.status(403).json({ success: false, message: "You can only update this task's status." });
      }
      const { data: assignment } = await sb().from("task_assignees").select("task_id").eq("task_id", task_id).eq("user_id", req.user.user_id).maybeSingle();
      if (!assignment) {
        return res.status(403).json({ success: false, message: "You're not assigned to this task." });
      }
    }

    const allowed = ["title","description","status","priority","due_date","order_index"];
    const updates = {};
    for (const k of allowed) if (req.body[k] !== undefined) updates[k] = req.body[k] || null;
    if (req.body.required_skills !== undefined) updates.required_skills = Array.isArray(req.body.required_skills) ? req.body.required_skills : [];
    updates.updated_at = new Date().toISOString();
    if (Object.keys(updates).length > 0) {
      const { error } = await sb().from("tasks").update(updates).eq("task_id", task_id);
      if (error) throw error;
    }
    if (req.body.assignee_ids !== undefined) await syncAssignees(task_id, req.body.assignee_ids);
    const { data, error: fetchErr } = await sb().from("tasks").select("*, users!tasks_assigned_to_fkey(user_id,full_name,email)").eq("task_id", task_id).single();
    if (fetchErr) throw fetchErr;
    const [task] = await attachAssignees([data]);
    res.json({ success: true, task });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteTask = async (req, res) => {
  try {
    const { task_id } = req.params;
    const { error } = await sb().from("tasks").delete().eq("task_id", task_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── EPICS ─────────────────────────────────────────────────────────────────────
const getEpics = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { data: epics, error } = await sb().from("epics").select("*").eq("project_id", project_id).order("order_index");
    if (error) throw error;
    // attach task counts
    const epicIds = (epics || []).map(e => e.epic_id);
    let counts = {};
    if (epicIds.length) {
      const { data: tasks } = await sb().from("tasks").select("epic_id, status").in("epic_id", epicIds);
      for (const t of tasks || []) {
        if (!counts[t.epic_id]) counts[t.epic_id] = { total: 0, done: 0 };
        counts[t.epic_id].total++;
        if (t.status === "done") counts[t.epic_id].done++;
      }
    }
    res.json({ success: true, epics: (epics || []).map(e => ({ ...e, ...(counts[e.epic_id] || { total: 0, done: 0 }) })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createEpic = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { title, description, color = "#6366F1" } = req.body;
    if (!title?.trim()) return res.status(400).json({ success: false, message: "Title required" });
    const { data, error } = await sb().from("epics").insert({ project_id: Number(project_id), title: title.trim(), description, color }).select().single();
    if (error) throw error;
    res.json({ success: true, epic: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateEpic = async (req, res) => {
  try {
    const { epic_id } = req.params;
    const { title, description, color, status, order_index } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (color !== undefined) updates.color = color;
    if (status !== undefined) updates.status = status;
    if (order_index !== undefined) updates.order_index = order_index;
    const { data, error } = await sb().from("epics").update(updates).eq("epic_id", epic_id).select().single();
    if (error) throw error;
    res.json({ success: true, epic: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteEpic = async (req, res) => {
  try {
    const { error } = await sb().from("epics").delete().eq("epic_id", req.params.epic_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── SPRINTS ───────────────────────────────────────────────────────────────────
const getSprints = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { data: sprints, error } = await sb().from("sprints").select("*").eq("project_id", project_id).order("start_date");
    if (error) throw error;
    const sprintIds = (sprints || []).map(s => s.sprint_id);
    let sprintStats = {};
    if (sprintIds.length) {
      const { data: tasks } = await sb().from("tasks").select("sprint_id, status, story_points").in("sprint_id", sprintIds);
      for (const t of tasks || []) {
        if (!sprintStats[t.sprint_id]) sprintStats[t.sprint_id] = { total: 0, done: 0, points: 0, done_points: 0 };
        sprintStats[t.sprint_id].total++;
        sprintStats[t.sprint_id].points += t.story_points || 0;
        if (t.status === "done") { sprintStats[t.sprint_id].done++; sprintStats[t.sprint_id].done_points += t.story_points || 0; }
      }
    }
    res.json({ success: true, sprints: (sprints || []).map(s => ({ ...s, ...(sprintStats[s.sprint_id] || { total: 0, done: 0, points: 0, done_points: 0 }) })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createSprint = async (req, res) => {
  try {
    const { project_id } = req.params;
    const { name, goal, start_date, end_date } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Sprint name required" });
    const { data, error } = await sb().from("sprints").insert({ project_id: Number(project_id), name: name.trim(), goal, start_date, end_date }).select().single();
    if (error) throw error;
    res.json({ success: true, sprint: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateSprint = async (req, res) => {
  try {
    const { sprint_id } = req.params;
    const { name, goal, start_date, end_date, status } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (goal !== undefined) updates.goal = goal;
    if (start_date !== undefined) updates.start_date = start_date;
    if (end_date !== undefined) updates.end_date = end_date;
    if (status !== undefined) updates.status = status;
    const { data, error } = await sb().from("sprints").update(updates).eq("sprint_id", sprint_id).select().single();
    if (error) throw error;
    res.json({ success: true, sprint: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteSprint = async (req, res) => {
  try {
    const { error } = await sb().from("sprints").delete().eq("sprint_id", req.params.sprint_id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── BO PORTFOLIO ──────────────────────────────────────────────────────────────
const getPortfolio = async (req, res) => {
  try {
    let business_id;
    if (req.user.role === "business_owner") {
      const ctx = await getBOCtx(req.user.user_id);
      if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
      business_id = ctx.business_id;
    } else {
      const ctx = await getManagerCtx(req.user.user_id);
      if (!ctx) return res.status(403).json({ success: false, message: "No business found" });
      business_id = ctx.business_id;
    }

    const projects = await prisma.projects.findMany({
      where: { business_id },
      include: {
        project_assignments: { include: { staff: { include: { users: { select: { user_id: true, full_name: true, email: true } } } } } },
        timesheets: { select: { hours_worked: true, status: true } },
      },
      orderBy: { created_at: "desc" },
    });

    const projectIds = projects.map(p => p.project_id);
    let taskStats = {};
    let sprintMap = {};
    let epicMap = {};

    if (projectIds.length) {
      const { data: tasks } = await sb().from("tasks").select("project_id, status, story_points").in("project_id", projectIds);
      for (const t of tasks || []) {
        if (!taskStats[t.project_id]) taskStats[t.project_id] = { total: 0, done: 0, points: 0, done_points: 0 };
        taskStats[t.project_id].total++;
        taskStats[t.project_id].points += t.story_points || 0;
        if (t.status === "done") { taskStats[t.project_id].done++; taskStats[t.project_id].done_points += t.story_points || 0; }
      }
      const { data: activeSprints } = await sb().from("sprints").select("*").in("project_id", projectIds).eq("status", "active");
      for (const s of activeSprints || []) sprintMap[s.project_id] = s;
      const { data: epicCounts } = await sb().from("epics").select("project_id, status").in("project_id", projectIds);
      for (const e of epicCounts || []) {
        if (!epicMap[e.project_id]) epicMap[e.project_id] = { total: 0, closed: 0 };
        epicMap[e.project_id].total++;
        if (e.status === "closed") epicMap[e.project_id].closed++;
      }
    }

    const enriched = projects.map(p => {
      const ts = taskStats[p.project_id] || { total: 0, done: 0, points: 0, done_points: 0 };
      const logged = p.timesheets.filter(t => t.status === "approved").reduce((s, t) => s + Number(t.hours_worked), 0);
      const overdue = p.end_date && new Date(p.end_date) < new Date() && p.status === "active";
      return {
        project_id: p.project_id, name: p.name, description: p.description,
        status: p.status, color: p.color, start_date: p.start_date, end_date: p.end_date,
        overdue, logged_hours: logged,
        members: p.project_assignments.map(a => a.staff?.users).filter(Boolean),
        tasks: ts,
        epics: epicMap[p.project_id] || { total: 0, closed: 0 },
        active_sprint: sprintMap[p.project_id] || null,
      };
    });

    // Business-level summary
    const summary = {
      total: enriched.length,
      active: enriched.filter(p => p.status === "active").length,
      overdue: enriched.filter(p => p.overdue).length,
      total_tasks: Object.values(taskStats).reduce((s, t) => s + t.total, 0),
      done_tasks: Object.values(taskStats).reduce((s, t) => s + t.done, 0),
    };

    res.json({ success: true, projects: enriched, summary });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Project members — all active outlet staff with their skills ───────────────
const getProjectMembers = async (req, res) => {
  try {
    const ctx = await getManagerCtx(req.user.user_id);
    if (!ctx) return res.status(403).json({ success: false, message: "No outlet found" });

    const allStaff = await prisma.staff.findMany({
      where: { outlet_id: ctx.outlet_id, is_active: true },
      include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
    });
    const members = allStaff
      .filter(s => s.users?.role !== "outlet_manager")
      .map(s => ({ staff_id: s.staff_id, ...s.users }));

    // Enrich with skill IDs so frontend can filter by task required_skills
    const staffIds = members.map(m => m.staff_id);
    const { data: skillRows } = await sb().from("staff_skills").select("staff_id, skill_id").in("staff_id", staffIds);
    const skillMap = {};
    for (const r of skillRows || []) {
      if (!skillMap[r.staff_id]) skillMap[r.staff_id] = [];
      skillMap[r.staff_id].push(r.skill_id);
    }
    const enriched = members.map(m => ({ ...m, skill_ids: skillMap[m.staff_id] || [] }));
    res.json({ success: true, members: enriched });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Krewby worker requests (writes into the same krewby_requests table the
//    outlet-manager Manpower page reads from — shift-shaped, one day per request) ──
const createKrewbyRequest = async (req, res) => {
  try {
    const { task_id, role_name, shift_date, start_time, end_time, workers_count, skill_id, notes } = req.body;
    if (!role_name?.trim()) return res.status(400).json({ success: false, message: "Task/role name required" });
    if (!shift_date || !start_time || !end_time) return res.status(400).json({ success: false, message: "Date and time required" });

    const ctx = await getManagerCtx(req.user.user_id);
    if (!ctx) return res.status(403).json({ success: false, message: "No outlet found" });

    const { data, error } = await sb().from("krewby_requests").insert({
      outlet_id:     ctx.outlet_id,
      task_id:       task_id || null,
      role_name:     role_name.trim(),
      shift_date,
      start_time:    start_time.length === 5 ? `${start_time}:00` : start_time,
      end_time:      end_time.length === 5 ? `${end_time}:00` : end_time,
      headcount:     Number(workers_count) || 1,
      skill_id:      skill_id || null,
      status:        "pending_review",
      override_note: notes || null,
      created_by:    req.user.user_id,
    }).select().single();
    if (error) throw error;
    res.json({ success: true, request: data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── My Tasks (staff) — tasks assigned to the caller across every project ──────
const getMyTasks = async (req, res) => {
  try {
    const { data: rows, error } = await sb()
      .from("task_assignees")
      .select("tasks(task_id, title, description, status, priority, due_date, required_skills, project_id, projects(name, color))")
      .eq("user_id", req.user.user_id);
    if (error) throw error;

    const tasks = (rows || []).map(r => r.tasks).filter(Boolean).sort((a, b) => {
      if ((a.status === "done") !== (b.status === "done")) return a.status === "done" ? 1 : -1;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

    res.json({ success: true, tasks });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getTasks, createTask, updateTask, deleteTask,
  getEpics, createEpic, updateEpic, deleteEpic,
  getSprints, createSprint, updateSprint, deleteSprint,
  getPortfolio, getProjectMembers, createKrewbyRequest, getMyTasks,
};
