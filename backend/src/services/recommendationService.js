const supabaseAdmin = require("../config/supabaseAdmin");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function fullyCovers(availFrom, availTo, shiftStart, shiftEnd) {
  const af = toMinutes(availFrom), at = toMinutes(availTo);
  const ss = toMinutes(shiftStart), se = toMinutes(shiftEnd);
  if (af == null || at == null || ss == null || se == null) return null;
  return af <= ss && at >= se;
}

async function getShiftRecommendations(shiftId) {
  // 1. Load shift + roles
  const { data: shift } = await supabaseAdmin
    .from("shifts")
    .select("shift_id, title, shift_date, start_time, end_time, outlet_id, outlets(name, open_time, close_time)")
    .eq("shift_id", shiftId)
    .single();

  if (!shift) throw new Error("Shift not found");

  const { data: roles } = await supabaseAdmin
    .from("shift_roles")
    .select("role_id, role_name, skill_id, headcount, skills(name)")
    .eq("shift_id", shiftId);

  // Already assigned staff for this shift
  const { data: existingAssignments } = await supabaseAdmin
    .from("shift_assignments")
    .select("staff_id, role_id")
    .eq("shift_id", shiftId);

  const alreadyAssignedStaffIds = new Set((existingAssignments || []).map(a => a.staff_id));

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

  // 5. Load double-booking on same date
  const { data: sameDayAssigns } = await supabaseAdmin
    .from("shift_assignments")
    .select("staff_id, shifts!inner(shift_date)")
    .neq("shift_id", shiftId)
    .in("staff_id", staffIds);
  const doubleBookedIds = new Set(
    (sameDayAssigns || [])
      .filter(a => a.shifts?.shift_date === shift.shift_date)
      .map(a => a.staff_id)
  );

  // 6. Load casual availability for the shift date
  const shiftDay = new Date(shift.shift_date);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const shiftDayName = dayNames[shiftDay.getDay()];
  // Week start (Monday) for the shift date, and Monday-indexed day_of_week (Mon=0…Sun=6)
  const dayOfWeek = shiftDay.getDay();
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const weekStart = new Date(shiftDay);
  weekStart.setDate(shiftDay.getDate() - daysToMonday);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const mondayIndexedDay = daysToMonday; // Mon=0…Sun=6, matches casualController's auto-assign convention

  const casualStaffIds = staffRows.filter(s => s.staff_type === "casual").map(s => s.staff_id);
  let casualAvailMap = {};
  if (casualStaffIds.length > 0) {
    const { data: availRows, error: availErr } = await supabaseAdmin
      .from("casual_availability")
      .select("staff_id, available_from, available_to")
      .in("staff_id", casualStaffIds)
      .eq("week_start_date", weekStartStr)
      .eq("day_of_week", mondayIndexedDay);
    if (availErr) console.error("casual_availability query failed:", availErr.message);
    (availRows || []).forEach(a => { casualAvailMap[a.staff_id] = a; });
  }

  // 7. Build staff context for AI
  const staffContext = staffRows
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
          const covers = fullyCovers(av.available_from, av.available_to, shift.start_time, shift.end_time);
          const window = `${av.available_from?.slice(0,5)}–${av.available_to?.slice(0,5)}`;
          availability = covers
            ? `available ${window} (covers full shift)`
            : `available ${window} — DOES NOT fully cover the shift time (${shift.start_time?.slice(0,5)}–${shift.end_time?.slice(0,5)})`;
        } else {
          availability = "no availability submitted for this day";
        }
      } else {
        // Regular staff: check default_work_days bitmask (Mon=0...Sun=6)
        const bitmask = s.default_work_days || "1111100";
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        availability = bitmask[dayIndex] === "1" ? "available (regular work day)" : "not a regular work day";
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

  const rolesContext = (roles || []).map(r => {
    const filledCount = (existingAssignments || []).filter(a => a.role_id === r.role_id).length;
    return {
      role_id: r.role_id,
      role_name: r.role_name,
      required_skill: r.skills?.name || null,
      headcount: r.headcount || 1,
      slots_remaining: Math.max(0, (r.headcount || 1) - filledCount),
    };
  }).filter(r => r.slots_remaining > 0);

  if (rolesContext.length === 0) {
    return { message: "All roles are already fully staffed.", recommendations: [] };
  }

  // 8. Call Groq
  const prompt = `You are a smart workforce scheduling assistant for an F&B outlet.

SHIFT: ${shift.title} on ${shift.shift_date} (${shiftDayName}), ${shift.start_time?.slice(0,5)}–${shift.end_time?.slice(0,5)} at ${shift.outlets?.name}

ROLES NEEDING STAFF:
${rolesContext.map(r => `- ${r.role_name} (requires skill: ${r.required_skill || "any"}, need ${r.slots_remaining} more staff)`).join("\n")}

AVAILABLE STAFF:
${staffContext.map(s => `- [ID:${s.staff_id}] ${s.name} | Type: ${s.type} | Skills: ${s.skills} | Experience: ${s.experience_level}, ${s.years_of_experience} yrs | Status: ${s.availability}`).join("\n")}

For each role, recommend the best staff to fill the remaining slots. Prioritise, in order:
1. Staff who are available (not on leave, not double-booked). Treat "DOES NOT fully cover the shift time" as a hard warning — only suggest that person at "low" confidence and say so in the reason, even if their skills are a good match.
2. Staff with the required skill, favouring higher proficiency in that skill
3. Staff with more years of experience and a higher experience level
4. Regular staff over casual for critical roles

Respond ONLY with valid JSON in this exact format:
{
  "recommendations": [
    {
      "role_id": <number>,
      "role_name": "<string>",
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

Include up to ${Math.max(3, staffContext.length)} suggestions per role, ordered best-first. Only include staff from the list above.`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1200,
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);

  // LLM often hallucinates role_ids — remap by role_name to real IDs
  const roleNameToId = Object.fromEntries(
    (roles || []).map(r => [r.role_name.toLowerCase().trim(), r.role_id])
  );
  const fixedRecs = (parsed.recommendations || []).map(rec => ({
    ...rec,
    role_id: roleNameToId[rec.role_name?.toLowerCase().trim()] ?? rec.role_id,
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
