const prisma = require("../config/prisma");

async function getCallerOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  return s?.outlet_id || null;
}

const getShifts = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found for your account." });

    const shifts = await prisma.shifts.findMany({
      where: { outlet_id: outletId },
      include: {
        outlets: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_roles: true,
        shift_assignments: true,
      },
      orderBy: { shift_date: "asc" },
    });
    res.json({ success: true, shifts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getShiftById = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const shift = await prisma.shifts.findUnique({
      where: { shift_id: shiftId },
      include: {
        outlets: true,
        users: { select: { user_id: true, full_name: true, email: true, role: true } },
        shift_roles: true,
        shift_assignments: true,
      },
    });

    if (!shift) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && shift.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    res.json({ success: true, shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const createShift = async (req, res) => {
  try {
    const callerOutletId = await getCallerOutletId(req.user.user_id);
    const { outlet_id, title, shift_date, start_time, end_time, status } = req.body;

    // Ensure manager can only create shifts for their own outlet
    if (callerOutletId && outlet_id && outlet_id !== callerOutletId)
      return res.status(403).json({ success: false, message: "Cannot create shifts for a different outlet." });

    const shift = await prisma.shifts.create({
      data: {
        outlet_id: outlet_id || callerOutletId,
        title,
        shift_date: new Date(shift_date),
        start_time: new Date(`1970-01-01T${start_time}`),
        end_time: new Date(`1970-01-01T${end_time}`),
        status,
        created_by: req.user.user_id,
      },
    });
    res.status(201).json({ success: true, message: "Shift created successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { outlet_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && existing.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    const { outlet_id, title, shift_date, start_time, end_time, status } = req.body;
    const shift = await prisma.shifts.update({
      where: { shift_id: shiftId },
      data: {
        outlet_id,
        title,
        shift_date: shift_date ? new Date(shift_date) : undefined,
        start_time: start_time ? new Date(`1970-01-01T${start_time}`) : undefined,
        end_time: end_time ? new Date(`1970-01-01T${end_time}`) : undefined,
        status,
      },
    });
    res.json({ success: true, message: "Shift updated successfully", shift });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteShift = async (req, res) => {
  try {
    const shiftId = Number(req.params.id);
    const outletId = await getCallerOutletId(req.user.user_id);

    const existing = await prisma.shifts.findUnique({ where: { shift_id: shiftId }, select: { outlet_id: true } });
    if (!existing) return res.status(404).json({ success: false, message: "Shift not found" });
    if (outletId && existing.outlet_id !== outletId)
      return res.status(403).json({ success: false, message: "Access denied." });

    await prisma.shifts.delete({ where: { shift_id: shiftId } });
    res.json({ success: true, message: "Shift deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── AI Weekly Schedule ─────────────────────────────────────────────────────────

const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const generateWeeklySchedule = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found." });

    const { weekStart, weekEnd } = req.body;
    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    // Fetch outlet info + business industry
    const outlet = await prisma.outlets.findUnique({
      where: { outlet_id: outletId },
      select: { name: true, open_time: true, close_time: true, business_id: true },
    });

    // Get business industry & scheduling mode
    const sb = require("../config/supabaseAdmin");
    let industry = "f&b";
    if (outlet?.business_id) {
      const { data: biz } = await sb.from("businesses").select("industry, scheduling_mode").eq("business_id", outlet.business_id).maybeSingle();
      if (biz?.industry) industry = biz.industry;
    }

    // Fetch all active staff including experience level and certifications
    const staff = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true },
      include: {
        users: { select: { full_name: true, role: true } },
        staff_certifications: { select: { cert_name: true, expiry_date: true } },
      },
    });

    const regularStaff = staff.filter(s => s.users?.role === "outlet_regular_staff" || s.users?.role === "regular_staff");
    const casualStaff  = staff.filter(s => s.users?.role === "outlet_casual_staff");

    // Fetch casual availability for this week
    const casualIds = casualStaff.map(s => s.staff_id);
    const casualAvailRows = casualIds.length > 0
      ? await prisma.casual_availability.findMany({
          where: {
            staff_id: { in: casualIds },
            week_start_date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
          },
        })
      : [];

    // Build casual availability summary
    const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const casualMap = {};
    casualStaff.forEach(s => { casualMap[s.staff_id] = { name: s.users?.full_name, days: [] }; });
    casualAvailRows.forEach(r => {
      if (casualMap[r.staff_id]) {
        casualMap[r.staff_id].days.push({
          day: dayNames[r.day_of_week],
          from: r.available_from ? String(r.available_from).slice(0,5) : null,
          to:   r.available_to   ? String(r.available_to).slice(0,5)   : null,
        });
      }
    });

    // Fetch existing role templates for this outlet (including min experience + certification)
    const roleTemplates = await prisma.outlet_role_templates.findMany({
      where: { outlet_id: outletId },
      select: { role_name: true, headcount: true, min_experience_level: true, requires_certification: true, certification_name: true },
    }).catch(() => []);

    const context = {
      outlet: { name: outlet?.name, open_time: outlet?.open_time, close_time: outlet?.close_time },
      weekStart,
      weekEnd,
      industry,
      regularStaff: regularStaff.map(s => ({
        name:             s.users?.full_name,
        experience_level: s.experience_level || "intermediate",
        years:            s.years_of_experience ? Number(s.years_of_experience) : null,
        certifications:   (s.staff_certifications || []).map(c => c.cert_name),
      })),
      casualAvailability: Object.values(casualMap).map(c => {
        const staffRow = casualStaff.find(s => s.users?.full_name === c.name);
        return {
          ...c,
          experience_level: staffRow?.experience_level || "intermediate",
          years:            staffRow?.years_of_experience ? Number(staffRow.years_of_experience) : null,
          certifications:   (staffRow?.staff_certifications || []).map(c => c.cert_name),
        };
      }),
      roleTemplates: roleTemplates.map(r => ({
        role:                 r.role_name,
        headcount:            r.headcount,
        min_experience:       r.min_experience_level || "beginner",
        requires_cert:        r.requires_certification || false,
        cert_name:            r.certification_name || null,
      })),
    };

    // Prisma returns time as a Date object — convert to "HH:MM" string
    const toHHMM = (val) => {
      if (!val) return null;
      if (typeof val === "string") return val.slice(0, 5);
      if (val instanceof Date) return val.toISOString().slice(11, 16);
      return String(val).slice(0, 5);
    };
    const openTime  = toHHMM(context.outlet.open_time)  || "09:00";
    const closeTime = toHHMM(context.outlet.close_time) || "22:00";

    // Calculate midpoint for morning/evening split
    const [openH, openM]   = openTime.split(":").map(Number);
    const [closeH, closeM] = closeTime.split(":").map(Number);
    const totalMins   = (closeH * 60 + closeM) - (openH * 60 + openM);
    const midMins     = openH * 60 + openM + Math.floor(totalMins / 2);
    const midHour     = String(Math.floor(midMins / 60)).padStart(2, "0");
    const midMinute   = String(midMins % 60).padStart(2, "0");
    const midTime     = `${midHour}:${midMinute}`;

    const roles = context.roleTemplates.length > 0
      ? context.roleTemplates.map(r => {
          let desc = `${r.role} x${r.headcount} (min: ${r.min_experience}`;
          if (r.requires_cert && r.cert_name) desc += `, requires: ${r.cert_name}`;
          return desc + ")";
        }).join(", ")
      : "Service Staff x2 (min: beginner), Kitchen Staff x1 (min: intermediate)";

    const casualLines = context.casualAvailability.length > 0
      ? context.casualAvailability.map(s => {
          const certs = s.certifications?.length ? ` | certs: ${s.certifications.join(", ")}` : "";
          return `${s.name} [${s.experience_level}${s.years ? `, ${s.years}yr` : ""}${certs}]: ${s.days.map(d => `${d.day} ${d.from}-${d.to}`).join(", ")}`;
        }).join("\n")
      : "None";

    const regularLines = context.regularStaff.length > 0
      ? context.regularStaff.map(s => {
          const certs = s.certifications?.length ? ` | certs: ${s.certifications.join(", ")}` : "";
          return `${s.name} [${s.experience_level}${s.years ? `, ${s.years}yr` : ""}${certs}]`;
        }).join(", ")
      : "None";

    // Industry-specific additional rules
    const industryRules = {
      "retail": `
RETAIL-SPECIFIC RULES:
- Saturday and Sunday shifts must have 20-30% more staff than weekday shifts.
- Ensure at least 2 floor staff during peak hours: 11:00-14:00 and 17:00-21:00.
- If a stock-take shift is needed, it can be scheduled outside normal operating hours.`,

      "logistics": `
LOGISTICS-SPECIFIC RULES:
- Enforce minimum 8 hours rest between any two shifts for the same staff member.
- Only assign staff with the required certification to certified roles (e.g. forklift license, hazmat certified).
- Night shift workers must NOT be assigned a morning/day shift the following day.
- Flag any staff member scheduled for more than 48 hours — do not exceed this.
- Rotate staff across different zones (Receiving, Dispatch, Packing) for balanced workload.`,

      "healthcare": `
HEALTHCARE-SPECIFIC RULES:
- NEVER leave any time slot uncovered — every operating hour must have minimum staffing.
- Only assign staff with the correct certification or license to clinical/nursing roles.
- At least one expert-level staff member must be present in every shift.
- No staff member may work more than 12 hours in a single shift.
- Always schedule a backup (on-call) for each shift in case of no-show.`,

      "hospitality": `
HOSPITALITY-SPECIFIC RULES:
- Every department (Front Desk, Housekeeping, F&B) needs coverage every hour of operation.
- Night shift staff (after 23:00) must not be assigned a morning shift the next day.
- Weekend and public holiday headcount must be automatically increased by 20%.
- Cross-department assignments allowed only if staff is qualified for both roles.`,

      "f&b": `
F&B-SPECIFIC RULES:
- Ensure coverage during meal rush periods: lunch (11:30-14:00) and dinner (18:00-21:00).
- Morning shift covers prep and lunch service; evening shift covers dinner and closing.`,
    };

    const extraRules = industryRules[industry] || industryRules["f&b"];

    const prompt = `You are a professional workforce scheduler for a ${industry} business. Output ONLY a valid JSON array, no explanation, no markdown.

WEEK: ${weekStart} to ${weekEnd}
OPERATING HOURS: ${openTime}–${closeTime}
SHIFT SPLIT: Morning ${openTime}–${midTime} | Evening ${midTime}–${closeTime}
ROLES PER SHIFT: ${roles}
REGULAR STAFF (available all 7 days): ${regularLines}
CASUAL STAFF AVAILABILITY THIS WEEK:
${casualLines}

SCHEDULING RULES (all mandatory):

COVERAGE:
1. Generate exactly 14 shifts — one Morning and one Evening for each of the 7 days.
2. Every shift must have all role headcounts filled as fully as possible.
3. Every shift must include at least 1 regular staff member — never fill a shift with casual workers only.

EXPERIENCE & SKILL MATCHING:
4. Each role has a minimum experience level (beginner / intermediate / expert). Experience ranks: beginner < intermediate < expert.
5. NEVER assign a staff member to a role if their experience level is below the role's minimum requirement. For example, a beginner cannot fill a role that requires intermediate or expert.
6. For complex or high-responsibility roles (min: intermediate or expert), always prefer to assign the most experienced available staff first.
7. Beginner staff must always be scheduled alongside at least one intermediate or expert staff member in the same shift — never leave beginners working alone.
8. If a shift has both senior and junior roles, assign expert/intermediate staff to senior roles and beginners only to junior roles.

STAFF WELFARE:
9. Each regular staff member must have at least 1 full day off per week (not assigned to any shift that day).
10. No regular staff member may work more than 5 consecutive days in a row.
11. No regular staff member should work an Evening shift and then a Morning shift the very next day (avoid back-to-back close→open). If they work Evening on Day N, assign them Evening or give them the day off on Day N+1.
12. Cap each regular staff member at a maximum of 44 working hours this week.

FAIRNESS:
13. Distribute weekend shifts (Saturday and Sunday) fairly — do not always assign the same people to weekends.
14. Balance morning and evening shifts per regular staff member — each person should work a roughly equal mix of both.
15. Mix regular and casual staff together within the same shift where casual availability allows.

CASUAL STAFF:
16. Assign casual staff only on days they are available and only within their available hours.
17. Apply the same experience matching rules to casual staff — do not assign them to roles above their experience level.
18. Casual staff are not subject to the consecutive-day or back-to-back rules, but do not exceed their stated available hours.

${extraRules}

OUTPUT: Return only the JSON array. No text before or after.
[{"title":"Morning Shift","date":"YYYY-MM-DD","start_time":"${openTime}","end_time":"${midTime}","roles":[{"role_name":"Service Staff","headcount":2,"assigned_staff":["Name"]}]}]

Generate all 14 shifts now:`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.3,
    });

    const raw = completion.choices[0].message.content;
    // Extract JSON array from response
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) return res.status(500).json({ success: false, message: "AI returned invalid schedule format. Please try again." });

    const schedule = JSON.parse(match[0]);
    // Return casual staff names so frontend can highlight them
    const casualNames = casualStaff.map(s => s.users?.full_name).filter(Boolean);
    return res.json({ success: true, schedule, casualNames });
  } catch (err) {
    console.error("generateWeeklySchedule error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

const confirmWeeklySchedule = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found." });

    const { shifts: scheduleShifts } = req.body;
    if (!Array.isArray(scheduleShifts) || scheduleShifts.length === 0)
      return res.status(400).json({ success: false, message: "No shifts provided." });

    // Fetch all staff for name→id lookup
    const allStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true },
      include: { users: { select: { full_name: true } } },
    });
    const nameToStaffId = {};
    allStaff.forEach(s => { if (s.users?.full_name) nameToStaffId[s.users.full_name.toLowerCase()] = s.staff_id; });

    const created = [];
    for (const s of scheduleShifts) {
      // Create shift
      const shift = await prisma.shifts.create({
        data: {
          outlet_id: outletId,
          title: s.title || "Shift",
          shift_date: new Date(s.date),
          start_time: new Date(`1970-01-01T${s.start_time}:00`),
          end_time:   new Date(`1970-01-01T${s.end_time}:00`),
          status: "draft",
          created_by: null,
        },
      });

      // Create roles + assignments
      for (const role of (s.roles || [])) {
        const shiftRole = await prisma.shift_roles.create({
          data: { shift_id: shift.shift_id, role_name: role.role_name, headcount: role.headcount || 1 },
        });

        for (const staffName of (role.assigned_staff || [])) {
          const staffId = nameToStaffId[staffName.toLowerCase()];
          if (staffId) {
            await prisma.shift_assignments.create({
              data: { shift_id: shift.shift_id, role_id: shiftRole.role_id, staff_id: staffId, status: "pending" },
            }).catch(() => {});
          }
        }
      }
      created.push(shift.shift_id);
    }

    return res.json({ success: true, created: created.length });
  } catch (err) {
    console.error("confirmWeeklySchedule error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET casual availability for the outlet (used by manager UI) ──────────────
const getCasualAvailability = async (req, res) => {
  try {
    const outletId = await getCallerOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet found." });

    const { weekStart, weekEnd } = req.query;
    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    // Fetch all casual staff for this outlet
    const casualStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true, users: { role: "outlet_casual_staff" } },
      include: { users: { select: { full_name: true, email: true } } },
    });

    const casualIds = casualStaff.map(s => s.staff_id);
    const nameMap   = {};
    casualStaff.forEach(s => { nameMap[s.staff_id] = s.users?.full_name || s.users?.email || "Unknown"; });

    const rows = casualIds.length > 0
      ? await prisma.casual_availability.findMany({
          where: {
            staff_id: { in: casualIds },
            week_start_date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
          },
          orderBy: [{ staff_id: "asc" }, { day_of_week: "asc" }],
        })
      : [];

    // Group by staff
    const byStaff = {};
    rows.forEach(r => {
      const id = r.staff_id;
      if (!byStaff[id]) byStaff[id] = { name: nameMap[id], days: [] };
      byStaff[id].days.push({
        day_of_week: r.day_of_week,
        available_from: r.available_from ? String(r.available_from).slice(0, 5) : null,
        available_to:   r.available_to   ? String(r.available_to).slice(0, 5)   : null,
      });
    });

    return res.json({ success: true, availability: Object.values(byStaff), totalCasual: casualStaff.length });
  } catch (err) {
    console.error("getCasualAvailability error:", err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getShifts, getShiftById, createShift, updateShift, deleteShift, generateWeeklySchedule, confirmWeeklySchedule, getCasualAvailability };
