const supabaseAdmin = require("../config/supabaseAdmin");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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
    .select("shift_id, title, shift_date, start_time, end_time, outlet_id, outlets(name, open_time, close_time)")
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

  // 2. Load all active non-manager staff for the outlet
  const { data: staffRows } = await supabaseAdmin
    .from("staff")
    .select("staff_id, user_id, staff_type, default_work_days, experience_level, years_of_experience")
    .eq("outlet_id", shift.outlet_id)
    .eq("is_active", true);

  const userIds = (staffRows || []).map(s => s.user_id);

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
    if (availErr) console.error("casual_availability query failed:", availErr.message);
    (availRows || []).forEach(a => { casualAvailMap[a.staff_id] = a; });
  }

  // 7. Build staff context for AI, per task (a casual may cover one task's time but not another's)
  function buildStaffContext(task) {
    const rangeStart = task.start_time || shift.start_time;
    const rangeEnd   = task.end_time   || shift.end_time;
    return staffRows
      .map(s => {
        const user = userMap[s.user_id] || {};
        if (user.role === "outlet_manager") return null;
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

  // 8. Call Groq
  const prompt = `You are a smart workforce scheduling assistant for an F&B outlet.

SHIFT: ${shift.title} on ${shift.shift_date} (${shiftDayName}), ${toHHMM(shift.start_time)}–${toHHMM(shift.end_time)} at ${shift.outlets?.name}

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

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);

  // LLM often hallucinates task IDs — remap by task title to real IDs
  const taskTitleToId = Object.fromEntries(
    openTasks.map(t => [t.title.toLowerCase().trim(), t.task_id])
  );
  const fixedRecs = (parsed.recommendations || []).map(rec => ({
    ...rec,
    role_id: taskTitleToId[rec.role_name?.toLowerCase().trim()] ?? rec.role_id,
  }));

  return {
    shift: {
      title: shift.title,
      shift_date: shift.shift_date,
      start_time: shift.start_time,
      end_time: shift.end_time,
    },
    recommendations: fixedRecs,
  };
}

module.exports = { getShiftRecommendations };
