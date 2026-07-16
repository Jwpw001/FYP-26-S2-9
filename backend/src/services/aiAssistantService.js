const prisma = require("../config/prisma");
const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function fetchWorkforceContext(userId, role) {
  const context = {};
  try {
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, full_name: true, username: true, role: true },
    });
    context.currentUser = user;

    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    if (role === "outlet_manager") {
      const staffRecord = await prisma.staff.findFirst({
        where: { user_id: userId },
        select: { outlet_id: true },
      });
      const outletId = staffRecord?.outlet_id;
      context.outletId = outletId;

      if (outletId) {
        const shifts = await prisma.shifts.findMany({
          where: { outlet_id: outletId, shift_date: { gte: today, lte: weekFromNow } },
          include: {
            shift_tasks: { select: { task_id: true } },
            task_assignments: {
              include: {
                staff: { include: { users: { select: { full_name: true } } } },
                krewby_workers: { include: { users: { select: { full_name: true } } } },
              },
            },
          },
          orderBy: { shift_date: "asc" },
        });
        context.upcomingShifts = shifts.map((s) => {
          // One person per task — total positions needed is just the task count
          const totalNeeded = (s.shift_tasks || []).length;
          const totalAssigned = s.task_assignments.length;
          return {
            shift_id: s.shift_id,
            title: s.title,
            date: s.shift_date,
            start: s.start_time,
            end: s.end_time,
            total_positions_needed: totalNeeded,
            status: s.status,
            assigned_count: totalAssigned,
            is_understaffed: totalAssigned < totalNeeded,
            assigned_staff: s.task_assignments.map(
              (a) => a.staff?.users?.full_name || a.krewby_workers?.users?.full_name || "Unknown"
            ),
          };
        });

        const pendingLeave = await prisma.availability.findMany({
          where: { status: "pending", staff: { outlet_id: outletId } },
          include: { staff: { include: { users: { select: { full_name: true } } } } },
        });
        context.pendingLeaveRequests = pendingLeave.map((l) => ({
          staff_name: l.staff?.users?.full_name,
          leave_type: l.leave_type,
          start_date: l.start_date,
          end_date: l.end_date,
          reason: l.reason,
        }));

        const pendingSwaps = await prisma.swap_requests
          .findMany({
            where: { status: "pending", requester_shift: { outlet_id: outletId } },
            include: {
              staff_swap_requests_requester_idTostaff: {
                include: { users: { select: { full_name: true } } },
              },
            },
          })
          .catch(() => []);
        context.pendingSwapRequests = pendingSwaps.length;

        const outlet = await prisma.outlets.findUnique({
          where: { outlet_id: outletId },
          select: { name: true, address: true },
        });
        context.outlet = outlet;

        // Casual staff availability submissions
        const outletStaff = await prisma.staff.findMany({
          where: { outlet_id: outletId, is_active: true },
          select: { staff_id: true, users: { select: { full_name: true, email: true } } },
        }).catch(() => []);

        const staffIdList = outletStaff.map(s => s.staff_id);
        const staffNameMap = {};
        outletStaff.forEach(s => { staffNameMap[s.staff_id] = s.users?.full_name || s.users?.email || "Unknown"; });

        const casualAvail = staffIdList.length > 0
          ? await prisma.casual_availability.findMany({
              where: { staff_id: { in: staffIdList } },
              orderBy: { week_start_date: "desc" },
            }).catch(() => [])
          : [];

        const dayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
        const grouped = {};
        casualAvail.forEach(row => {
          const week = row.week_start_date.toISOString().split("T")[0];
          const key = `${row.staff_id}_${week}`;
          if (!grouped[key]) {
            grouped[key] = { staff_name: staffNameMap[row.staff_id] || "Unknown", week, days: [] };
          }
          grouped[key].days.push({
            day: dayNames[row.day_of_week],
            from: row.available_from ? String(row.available_from).slice(0,5) : null,
            to: row.available_to ? String(row.available_to).slice(0,5) : null,
          });
        });
        context.casualAvailabilitySubmissions = Object.values(grouped);
      }
    }

    const recommendations = await prisma.recommendations
      .findMany({
        take: 5,
        orderBy: { created_at: "desc" },
        include: {
          staff: { include: { users: { select: { full_name: true } } } },
          shifts: { select: { shift_date: true } },
        },
      })
      .catch(() => []);
    context.recentRecommendations = recommendations.map((r) => ({
      staff_name: r.staff?.users?.full_name,
      score: r.score,
      reason: r.reason,
      shift_date: r.shifts?.shift_date,
    }));
  } catch (err) {
    console.error("Context fetch error:", err.message);
  }
  return context;
}

async function askAssistant(userId, role, question, conversationHistory = []) {
  const context = await fetchWorkforceContext(userId, role);

  const systemPrompt = `You are the Krewby AI Workforce Assistant — a read-only conversational tool for the Krewby F&B workforce management platform.

Your role:
- Answer questions about workforce data using the context provided below
- You are helping an outlet manager (${context.currentUser?.full_name || "user"})
- They manage outlet: "${context.outlet?.name || "their outlet"}" (${context.outlet?.address || ""})

STRICT RULES:
1. You are READ-ONLY. You cannot create, edit, approve, reject, assign, or delete anything.
2. If asked to perform any action, politely decline and direct to the appropriate module.
3. Only reference data from the context provided — do not make up numbers or names.
4. Keep answers concise and clear. Use bullet points for lists.
5. If data is unavailable, say "I don't have that data available right now."

AVAILABLE DATA INCLUDES:
- upcomingShifts: shifts for the next 7 days with assigned staff
- pendingLeaveRequests: staff leave requests awaiting approval
- pendingSwapRequests: count of pending shift swap requests
- casualAvailabilitySubmissions: weekly availability submitted by casual staff (grouped by staff + week, showing which days and hours they are available)

CURRENT WORKFORCE CONTEXT (as of ${new Date().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" })}):
${JSON.stringify(context, null, 2)}`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-8).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    })),
    { role: "user", content: question },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages,
    max_tokens: 600,
    temperature: 0.4,
  });

  return { answer: completion.choices[0].message.content };
}

module.exports = { askAssistant };
