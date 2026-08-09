const supabaseAdmin = require("../config/supabaseAdmin");
const prisma = require("../config/prisma");
const OpenAI = require("openai");
const logger = require("../config/logger");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function toMinutes(t) {
  if (!t) return null;
  const s = t instanceof Date ? t.toISOString() : String(t);
  const hhmm = s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function toHHMM(t) {
  if (!t) return "";
  const s = t instanceof Date ? t.toISOString() : String(t);
  return s.includes("T") ? s.slice(11, 16) : s.slice(0, 5);
}

/** Does a casual's declared availability window fully cover the given task/shift time range? */
function fullyCovers(availFrom, availTo, rangeStart, rangeEnd) {
  const af = toMinutes(availFrom), at = toMinutes(availTo);
  const ss = toMinutes(rangeStart), se = toMinutes(rangeEnd);
  if (af == null || at == null || ss == null || se == null) return null;
  return af <= ss && at >= se;
}

async function getShiftRecommendations(shiftId) {
  // 1. Load shift + open tasks
  const { data: shift } = await supabaseAdmin
    .from("shifts")
    .select("shift_id, title, shift_date, start_time, end_time, branch_id, branches(name, open_time, close_time)")
    .eq("shift_id", shiftId)
    .single();

  if (!shift) throw new Error("Shift not found");

  const { data: tasks } = await supabaseAdmin
    .from("shift_tasks")
    .select("task_id, title, skill_id, difficulty, start_time, end_time, status, skills(name)")
    .eq("shift_id", shiftId);

  // Already assigned staff for this shift (one staff per task)
  const { data: existingAssignments } = await supabaseAdmin
    .from("task_assignments")
    .select("staff_id, task_id")
    .eq("shift_id", shiftId);

  const assignedTaskIds = new Set((existingAssignments || []).map(a => a.task_id));
  const alreadyAssignedStaffIds = new Set((existingAssignments || []).map(a => a.staff_id));

  const openTasks = (tasks || []).filter(t => !assignedTaskIds.has(t.task_id) && t.status !== "assigned" && t.status !== "done");
  if (openTasks.length === 0) {
    return { message: "All tasks are already assigned.", recommendations: [] };
  }

  // 2. Load all active non-manager staff for the branch. Regular staff belong to exactly one
  // branch; casual staff are pool-based — they're only included here if they've listed this
  // branch as a preference, regardless of which branch their staff row was created under.
  const { data: regularStaffRows } = await supabaseAdmin
    .from("staff")
    .select("staff_id, user_id, staff_type, default_work_days, experience_level, years_of_experience")
    .eq("branch_id", shift.branch_id)
    .eq("staff_type", "regular")
    .eq("is_active", true);

  const { data: prefRows } = await supabaseAdmin
    .from("casual_branch_preferences")
    .select("user_id")
    .eq("branch_id", shift.branch_id);
  const preferredUserIds = [...new Set((prefRows || []).map(r => r.user_id))];

  const { data: casualStaffRows } = preferredUserIds.length > 0
    ? await supabaseAdmin
        .from("staff")
        .select("staff_id, user_id, staff_type, default_work_days, experience_level, years_of_experience")
        .in("user_id", preferredUserIds)
        .eq("staff_type", "casual")
        .eq("is_active", true)
    : { data: [] };

  const staffRows = [...(regularStaffRows || []), ...(casualStaffRows || [])];
  const userIds = staffRows.map(s => s.user_id);

  const { data: userRows } = await supabaseAdmin
    .from("users")
    .select("user_id, full_name, email, role")
    .in("user_id", userIds);

  const userMap = Object.fromEntries((userRows || []).map(u => [u.user_id, u]));

  // 3. Load skill tags for all staff
  const { data: skillTagRows } = await supabaseAdmin
    .from("user_skill_tags")
    .select("user_id, skill_id, proficiency_level, skills(name)")
    .in("user_id", userIds);

  const skillMap = {};
  (skillTagRows || []).forEach(t => {
    if (!skillMap[t.user_id]) skillMap[t.user_id] = [];
    skillMap[t.user_id].push({ skill_id: t.skill_id, name: t.skills?.name, proficiency: t.proficiency_level });
  });

  // 4. Load approved leave on shift date
  const staffIds = staffRows.map(s => s.staff_id);
  const { data: leaveRows } = await supabaseAdmin
    .from("availability")
    .select("staff_id")
    .eq("status", "approved")
    .lte("start_date", shift.shift_date)
    .gte("end_date", shift.shift_date)
    .in("staff_id", staffIds);
  const onLeaveStaffIds = new Set((leaveRows || []).map(l => l.staff_id));

  // 5. Load double-booking on same date (other shifts)
  const { data: sameDayAssigns } = await supabaseAdmin
    .from("task_assignments")
    .select("staff_id, shifts!inner(shift_date)")
    .neq("shift_id", shiftId)
    .in("staff_id", staffIds);
  const doubleBookedIds = new Set(
    (sameDayAssigns || [])
      .filter(a => a.shifts?.shift_date === shift.shift_date)
      .map(a => a.staff_id)
  );

  // 6. Load casual availability for the shift date — day_of_week is Monday-indexed (Mon=0…Sun=6),
  // and must match the specific week the shift falls in.
  const shiftDay = new Date(shift.shift_date);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shiftDayName = dayNames[shiftDay.getUTCDay()];
  const dayOfWeek = (shiftDay.getUTCDay() + 6) % 7; // Mon=0…Sun=6
  const weekStart = new Date(shiftDay);
  weekStart.setUTCDate(weekStart.getUTCDate() - dayOfWeek);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const casualStaffIds = staffRows.filter(s => s.staff_type === "casual").map(s => s.staff_id);
  let casualAvailMap = {};
  if (casualStaffIds.length > 0) {
    const { data: availRows, error: availErr } = await supabaseAdmin
      .from("casual_availability")
      .select("staff_id, available_from, available_to")
      .in("staff_id", casualStaffIds)
      .eq("week_start_date", weekStartStr)
      .eq("day_of_week", dayOfWeek);
    if (availErr) logger.error({ err: availErr }, "casual_availability query failed");
    (availRows || []).forEach(a => { casualAvailMap[a.staff_id] = a; });
  }

  // 7. Build staff context for AI, per task (a casual may cover one task's time but not another's)
  function buildStaffContext(task) {
    const rangeStart = task.start_time || shift.start_time;
    const rangeEnd   = task.end_time   || shift.end_time;
    return staffRows
      .map(s => {
        const user = userMap[s.user_id] || {};
        if (user.role === "manager") return null;
        if (alreadyAssignedStaffIds.has(s.staff_id)) return null;

        const skills = (skillMap[s.user_id] || [])
          .map(sk => sk.proficiency ? `${sk.name} (${sk.proficiency})` : sk.name)
          .join(", ") || "none";
        const onLeave = onLeaveStaffIds.has(s.staff_id);
        const doubleBooked = doubleBookedIds.has(s.staff_id);

        let availability = "available";
        if (onLeave) availability = "on approved leave";
        else if (doubleBooked) availability = "already assigned to another shift this day";
        else if (s.staff_type === "casual") {
          const av = casualAvailMap[s.staff_id];
          if (av) {
            const covers = fullyCovers(av.available_from, av.available_to, rangeStart, rangeEnd);
            const window = `${toHHMM(av.available_from)}–${toHHMM(av.available_to)}`;
            availability = covers
              ? `available ${window} (covers this task's hours)`
              : `available ${window} — DOES NOT fully cover this task's hours (${toHHMM(rangeStart)}–${toHHMM(rangeEnd)})`;
          } else {
            availability = "no availability submitted for this day";
          }
        } else {
          // Regular staff: check default_work_days bitmask (Mon=0...Sun=6)
          const bitmask = s.default_work_days || "1111100";
          availability = bitmask[dayOfWeek] === "1" ? "available (regular work day)" : "not a regular work day";
        }

        return {
          staff_id: s.staff_id,
          name: user.full_name || user.email,
          type: s.staff_type,
          skills,
          experience_level: s.experience_level || "unspecified",
          years_of_experience: s.years_of_experience ?? "unspecified",
          availability,
        };
      })
      .filter(Boolean);
  }

  const tasksContext = openTasks.map(t => ({
    task_id: t.task_id,
    title: t.title,
    required_skill: t.skills?.name || null,
    difficulty: t.difficulty || null,
    start_time: toHHMM(t.start_time) || toHHMM(shift.start_time),
    end_time: toHHMM(t.end_time) || toHHMM(shift.end_time),
  }));

  // 8. Deterministic fallback — used if the AI call fails for any reason (missing/invalid API
  // key, rate limit, network error, malformed JSON). Scores every candidate actually offered to
  // the AI for each task with the same weighted formula as autoAssignCasual (availability,
  // skills, workload, neutral attendance/performance), using the business's configured
  // branch_allocation_preferences weights.
  async function buildDeterministicRecommendations() {
    const { data: branchAlloc } = await supabaseAdmin
      .from("branch_allocation_preferences")
      .select("*")
      .eq("branch_id", shift.branch_id)
      .maybeSingle();
    const wAvail  = branchAlloc?.weight_availability ?? 40;
    const wSkills = branchAlloc?.weight_skills       ?? 30;
    const wAttend = branchAlloc?.weight_attendance   ?? 15;
    const wPerf   = branchAlloc?.weight_performance  ?? 10;
    const wWork   = branchAlloc?.weight_workload     ?? 5;
    const NEUTRAL = 0.5;
    const EXPERIENCE_SCORE = { junior: 0.5, intermediate: 0.75, senior: 1, expert: 1 };

    const staffIds = staffRows.map(s => s.staff_id);
    const pastCounts = staffIds.length > 0
      ? await prisma.task_assignments.groupBy({
          by: ["staff_id"],
          where: { staff_id: { in: staffIds }, status: { not: "cancelled" } },
          _count: { staff_id: true },
        })
      : [];
    const pastByStaffId = Object.fromEntries(pastCounts.map(r => [r.staff_id, r._count.staff_id]));
    const maxPast = Math.max(...staffIds.map(id => pastByStaffId[id] || 0), 0);

    return openTasks.map(t => {
      const rangeStart = t.start_time || shift.start_time;
      const rangeEnd   = t.end_time   || shift.end_time;

      const scored = staffRows
        .map(s => {
          const user = userMap[s.user_id] || {};
          if (user.role === "manager") return null;
          if (alreadyAssignedStaffIds.has(s.staff_id)) return null;
          if (onLeaveStaffIds.has(s.staff_id)) return null;
          if (doubleBookedIds.has(s.staff_id)) return null;

          let availSub = 1;
          let lowConfidence = false;
          if (s.staff_type === "casual") {
            const av = casualAvailMap[s.staff_id];
            if (!av) return null; // no availability submitted — not a real candidate
            const covers = fullyCovers(av.available_from, av.available_to, rangeStart, rangeEnd);
            if (!covers) { availSub = 0.3; lowConfidence = true; }
          } else {
            const bitmask = s.default_work_days || "1111100";
            if (bitmask[dayOfWeek] !== "1") return null; // not a regular work day
          }

          const skillTags = skillMap[s.user_id] || [];
          let skillsSub, hasSkill = false;
          if (!t.skill_id) {
            skillsSub = 1;
          } else {
            const tag = skillTags.find(sk => sk.skill_id === t.skill_id);
            if (!tag) { skillsSub = 0; }
            else { hasSkill = true; skillsSub = EXPERIENCE_SCORE[(tag.proficiency || "").toLowerCase()] ?? 0.7; }
          }

          const pastAssignments = pastByStaffId[s.staff_id] || 0;
          const workSub = maxPast === 0 ? 1 : 1 - pastAssignments / maxPast;

          const score = wAvail * availSub + wSkills * skillsSub + wAttend * NEUTRAL + wPerf * NEUTRAL + wWork * workSub;

          return { staff_id: s.staff_id, name: user.full_name || user.email, score, lowConfidence, hasSkill };
        })
        .filter(Boolean)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(c => ({
          staff_id: c.staff_id,
          name: c.name,
          confidence: c.lowConfidence ? "low" : (c.score >= 75 ? "high" : c.score >= 50 ? "medium" : "low"),
          reason: c.lowConfidence
            ? "Deterministic fallback: available window doesn't fully cover this task's hours, so flagged low confidence."
            : `Deterministic fallback: ranked by availability, skill match and workload${c.hasSkill ? " (holds the required skill)" : ""}.`,
        }));

      return { role_id: t.task_id, role_name: t.title, suggestions: scored };
    });
  }

  const prompt = `You are a smart workforce scheduling assistant for an F&B branch.

SHIFT: ${shift.title} on ${shift.shift_date} (${shiftDayName}), ${toHHMM(shift.start_time)}–${toHHMM(shift.end_time)} at ${shift.branches?.name}

TASKS NEEDING STAFF (one person per task):
${tasksContext.map(t => `- [ID:${t.task_id}] "${t.title}" ${t.start_time}–${t.end_time} (requires skill: ${t.required_skill || "any"}${t.difficulty ? `, difficulty: ${t.difficulty}` : ""})`).join("\n")}

AVAILABLE STAFF PER TASK:
${tasksContext.map(t => `Task "${t.title}" [ID:${t.task_id}]:\n${buildStaffContext(t).map(s => `  - [ID:${s.staff_id}] ${s.name} | Type: ${s.type} | Skills: ${s.skills} | Experience: ${s.experience_level}, ${s.years_of_experience} yrs | Status: ${s.availability}`).join("\n")}`).join("\n\n")}

For each task, recommend the best staff. Prioritise, in order:
1. Staff who are available (not on leave, not double-booked). Treat "DOES NOT fully cover this task's hours" as a hard warning — only suggest that person at "low" confidence and say so in the reason, even if their skills are a good match.
2. Staff with the required skill, favouring higher proficiency in that skill
3. Staff with more years of experience and a higher experience level
4. Regular staff over casual for critical tasks

Respond ONLY with valid JSON in this exact format:
{
  "recommendations": [
    {
      "role_id": <task ID number>,
      "role_name": "<task title>",
      "suggestions": [
        {
          "staff_id": <number>,
          "name": "<string>",
          "confidence": "high" | "medium" | "low",
          "reason": "<one sentence explaining why this person fits>"
        }
      ]
    }
  ]
}

Include up to 3 suggestions per task, ordered best-first. Only include staff from that task's available-staff list above.`;

  let fixedRecs;
  let source;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0].message.content;
    const parsed = JSON.parse(raw);

    // LLM often hallucinates task IDs — remap by task title to real IDs first (second line of
    // defense; the staff_id/task_id check below is the primary one).
    const taskTitleToId = Object.fromEntries(
      openTasks.map(t => [t.title.toLowerCase().trim(), t.task_id])
    );
    // The exact candidate staff_id set actually offered to the model for each task — anything
    // outside this per task is a hallucination and gets dropped rather than trusted.
    const validStaffIdsByTask = Object.fromEntries(
      openTasks.map(t => [t.task_id, new Set(buildStaffContext(t).map(s => s.staff_id))])
    );

    fixedRecs = (parsed.recommendations || []).map(rec => {
      const role_id = taskTitleToId[rec.role_name?.toLowerCase().trim()] ?? rec.role_id;
      const validStaffIds = validStaffIdsByTask[role_id];
      const suggestions = (rec.suggestions || []).filter(s => validStaffIds?.has(s.staff_id));
      return { ...rec, role_id, suggestions };
    });
    source = "ai";
  } catch (err) {
    logger.error({ err }, "[getShiftRecommendations] AI call failed, using deterministic fallback");
    fixedRecs = await buildDeterministicRecommendations();
    source = "deterministic";
  }

  return {
    shift: {
      title: shift.title,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
    },
    recommendations: fixedRecs,
    source,
  };
}

module.exports = { getShiftRecommendations };
