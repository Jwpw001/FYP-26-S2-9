const prisma = require("../config/prisma");
const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Fetch relevant workforce context from DB based on user role
async function fetchWorkforceContext(userId, role) {
  const context = {};

  try {
    // Get current user info
    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { user_id: true, full_name: true, username: true, role: true },
    });
    context.currentUser = user;

    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);

    if (role === "manager") {
      // Manager sees their outlet's shifts
      const staffRecord = await prisma.staff.findFirst({
        where: { user_id: userId },
        select: { outlet_id: true },
      });
      const outletId = staffRecord?.outlet_id;
      context.outletId = outletId;

      if (outletId) {
        // Upcoming shifts with assignments
        const shifts = await prisma.shifts.findMany({
          where: {
            outlet_id: outletId,
            shift_date: { gte: today, lte: weekFromNow },
          },
          include: {
            shift_assignments: {
              include: {
                staff: { include: { users: { select: { full_name: true } } } },
                krewby_workers: { include: { users: { select: { full_name: true } } } },
              },
            },
          },
          orderBy: { shift_date: "asc" },
        });
        context.upcomingShifts = shifts.map((s) => ({
          shift_id: s.shift_id,
          date: s.shift_date,
          start: s.start_time,
          end: s.end_time,
          required_headcount: s.required_headcount,
          status: s.status,
          assigned_count: s.shift_assignments.length,
          is_understaffed: s.shift_assignments.length < (s.required_headcount || 1),
          assigned_staff: s.shift_assignments.map((a) =>
            a.staff?.users?.full_name || a.krewby_workers?.users?.full_name || "Unknown"
          ),
        }));

        // Pending leave requests
        const pendingLeave = await prisma.availability.findMany({
          where: {
            status: "pending",
            staff: { outlet_id: outletId },
          },
          include: {
            staff: { include: { users: { select: { full_name: true } } } },
          },
        });
        context.pendingLeaveRequests = pendingLeave.map((l) => ({
          staff_name: l.staff?.users?.full_name,
          leave_type: l.leave_type,
          start_date: l.start_date,
          end_date: l.end_date,
          reason: l.reason,
        }));

        // Pending swap requests
        const pendingSwaps = await prisma.swap_requests.findMany({
          where: {
            status: "pending",
            requester_shift: { outlet_id: outletId },
          },
          include: {
            staff_swap_requests_requester_idTostaff: {
              include: { users: { select: { full_name: true } } },
            },
          },
        }).catch(() => []);
        context.pendingSwapRequests = pendingSwaps.length;

        // Outlet info
        const outlet = await prisma.outlets.findUnique({
          where: { outlet_id: outletId },
          select: { name: true, address: true },
        });
        context.outlet = outlet;
      }
    } else if (role === "coordinator") {
      // Coordinator sees all Krewby requests and workers
      const krewbyWorkers = await prisma.krewby_workers.findMany({
        where: { is_active: true },
        include: {
          users: { select: { full_name: true, email: true } },
          shift_assignments: {
            where: { shift: { shift_date: { gte: today } } },
            select: { assignment_id: true },
          },
        },
      });
      context.krewbyWorkers = krewbyWorkers.map((w) => ({
        name: w.users?.full_name,
        rating: w.rating,
        total_jobs: w.total_jobs,
        upcoming_assignments: w.shift_assignments.length,
        preferred_location: w.preferred_location,
      }));

      // Pending Krewby shift assignments awaiting review
      const pendingAssignments = await prisma.shift_assignments.findMany({
        where: {
          krewby_worker_id: { not: null },
          status: "pending",
        },
        include: {
          shift: { include: { outlets: { select: { name: true } } } },
          krewby_workers: { include: { users: { select: { full_name: true } } } },
        },
      }).catch(() => []);
      context.pendingKrewbyAssignments = pendingAssignments.map((a) => ({
        worker_name: a.krewby_workers?.users?.full_name,
        outlet: a.shift?.outlets?.name,
        date: a.shift?.shift_date,
        status: a.status,
      }));

      // All upcoming shifts needing casual workers
      const understaffedShifts = await prisma.shifts.findMany({
        where: { shift_date: { gte: today, lte: weekFromNow } },
        include: {
          shift_assignments: { select: { assignment_id: true } },
          outlets: { select: { name: true } },
        },
      });
      context.understaffedShifts = understaffedShifts
        .filter((s) => s.shift_assignments.length < (s.required_headcount || 1))
        .map((s) => ({
          outlet: s.outlets?.name,
          date: s.shift_date,
          required: s.required_headcount,
          assigned: s.shift_assignments.length,
        }));
    }

    // Recent AI recommendations (shared)
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
- You are helping a ${role} (${context.currentUser?.full_name || "user"})
${role === "manager" ? `- They manage outlet: "${context.outlet?.name || "their outlet"}" (${context.outlet?.address || ""})` : "- They are a Krewby Coordinator overseeing all casual worker operations"}

STRICT RULES:
1. You are READ-ONLY. You cannot create, edit, approve, reject, assign, or delete anything.
2. If asked to perform any action, politely decline and direct to the appropriate module.
3. Only reference data from the context provided — do not make up numbers or names.
4. Keep answers concise and clear. Use bullet points for lists.
5. If data is unavailable, say "I don't have that data available right now."

CURRENT WORKFORCE CONTEXT (as of ${new Date().toLocaleDateString("en-SG", { timeZone: "Asia/Singapore" })}):
${JSON.stringify(context, null, 2)}`;

  const messages = [
    ...conversationHistory.slice(-8), // keep last 8 turns for context
    { role: "user", content: question },
  ];

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    system: systemPrompt,
    messages,
  });

  return {
    answer: response.content[0].text,
    usage: response.usage,
  };
}

module.exports = { askAssistant };
