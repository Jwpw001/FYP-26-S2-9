const prisma = require("../config/prisma");

// ─── Requests ────────────────────────────────────────────────
const getAllRequests = async () => {
  return await prisma.krewby_requests.findMany({
    include: {
      outlets: { select: { name: true, address: true } },
      skills: { select: { name: true } },
      krewby_workers: { include: { users: { select: { full_name: true, email: true } } } },
    },
    orderBy: { created_at: "desc" },
  });
};

const getRequestsByOutlet = async (outletId) => {
  return await prisma.krewby_requests.findMany({
    where: { outlet_id: outletId },
    include: {
      outlets: { select: { name: true, address: true } },
      skills: { select: { name: true } },
      krewby_workers: { include: { users: { select: { full_name: true, email: true } } } },
    },
    orderBy: { created_at: "desc" },
  });
};

const getRequestById = async (requestId) => {
  return await prisma.krewby_requests.findUnique({
    where: { request_id: requestId },
    include: {
      outlets: { select: { name: true, address: true } },
      skills: { select: { name: true } },
      krewby_workers: { include: { users: { select: { full_name: true, email: true } } } },
    },
  });
};

const createRequest = async (data, outletId, createdBy) => {
  return await prisma.krewby_requests.create({
    data: {
      outlet_id: outletId,
      skill_id: data.skill_id ? Number(data.skill_id) : null,
      role_name: data.role_name,
      shift_date: new Date(data.shift_date),
      start_time: new Date(`1970-01-01T${data.start_time}:00`),
      end_time: new Date(`1970-01-01T${data.end_time}:00`),
      outlet_address: data.outlet_address,
      headcount: data.headcount || 1,
      status: "pending_review",
      created_by: createdBy,
    },
  });
};

const updateRequestStatus = async (requestId, status, workerId = null, overrideNote = null) => {
  return await prisma.krewby_requests.update({
    where: { request_id: requestId },
    data: {
      status,
      ...(workerId && { assigned_worker_id: workerId }),
      ...(overrideNote && { override_note: overrideNote }),
      updated_at: new Date(),
    },
  });
};

// ─── AI Matching ─────────────────────────────────────────────
const getMatchesForRequest = async (requestId) => {
  const request = await prisma.krewby_requests.findUnique({ where: { request_id: requestId } });
  if (!request) return [];

  const shiftDateStr = request.shift_date.toISOString().split("T")[0];
  const dayOfWeek = new Date(request.shift_date).getDay() || 7; // 1=Mon, 7=Sun

  // Get available workers for this date
  const availableWorkers = await prisma.krewby_workers.findMany({
    where: { is_active: true },
    include: {
      users: { select: { user_id: true, full_name: true, email: true } },
    },
  });

  // Get casual availability for the week
  const weekStart = getWeekStart(request.shift_date);
  const availability = await prisma.casual_availability.findMany({
    where: {
      week_start_date: weekStart,
      day_of_week: dayOfWeek,
      staff_id: { in: availableWorkers.map(w => w.krewby_worker_id) },
    },
  });
  const availableIds = new Set(availability.map(a => a.staff_id));

  // Score each worker
  const scored = availableWorkers
    .filter(w => availableIds.has(w.krewby_worker_id))
    .map(w => {
      const rating = Number(w.rating) || 5;
      const locationMatch = request.outlet_address && w.preferred_location
        ? request.outlet_address.toLowerCase().includes(w.preferred_location.toLowerCase()) ? 1 : 0
        : 0.5;
      const workloadScore = Math.max(0, 1 - (w.total_jobs || 0) / 20);
      const score = (rating / 5) * 0.4 + locationMatch * 0.3 + workloadScore * 0.3;
      return { ...w, score: Math.round(score * 100) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return scored;
};

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// ─── Workers ─────────────────────────────────────────────────
const getAllWorkers = async () => {
  return await prisma.krewby_workers.findMany({
    include: { users: { select: { user_id: true, full_name: true, email: true, role: true } } },
    orderBy: { krewby_worker_id: "asc" },
  });
};

const getWorkerById = async (workerId) => {
  return await prisma.krewby_workers.findUnique({
    where: { krewby_worker_id: workerId },
    include: { users: { select: { user_id: true, full_name: true, email: true } } },
  });
};

// ─── Assignments ─────────────────────────────────────────────
const getMyAssignments = async (userId) => {
  const worker = await prisma.krewby_workers.findFirst({ where: { user_id: userId } });
  if (!worker) return [];

  return await prisma.shift_assignments.findMany({
    where: { krewby_worker_id: worker.krewby_worker_id },
    include: {
      shifts: {
        include: { outlets: { select: { name: true, address: true } } },
      },
      shift_roles: { select: { role_name: true } },
      attendance: true,
    },
    orderBy: { assigned_at: "desc" },
  });
};

const confirmAssignment = async (assignmentId) => {
  return await prisma.shift_assignments.update({
    where: { assignment_id: assignmentId },
    data: { status: "confirmed" },
  });
};

const declineAssignment = async (assignmentId) => {
  return await prisma.shift_assignments.update({
    where: { assignment_id: assignmentId },
    data: { status: "declined" },
  });
};

const clockIn = async (assignmentId, userId) => {
  const existing = await prisma.attendance.findFirst({ where: { assignment_id: assignmentId } });
  if (existing) {
    return await prisma.attendance.update({
      where: { attendance_id: existing.attendance_id },
      data: { clock_in: new Date(), status: "present" },
    });
  }
  return await prisma.attendance.create({
    data: { assignment_id: assignmentId, clock_in: new Date(), status: "present", marked_by: userId },
  });
};

const clockOut = async (assignmentId) => {
  const existing = await prisma.attendance.findFirst({ where: { assignment_id: assignmentId } });
  if (!existing) throw new Error("No clock-in record found");
  return await prisma.attendance.update({
    where: { attendance_id: existing.attendance_id },
    data: { clock_out: new Date() },
  });
};

// ─── Availability ─────────────────────────────────────────────
const submitWorkerAvailability = async (userId, weekStartDate, slots, preferredLocation) => {
  const worker = await prisma.krewby_workers.findFirst({ where: { user_id: userId } });
  if (!worker) throw new Error("Krewby worker not found");

  if (preferredLocation) {
    await prisma.krewby_workers.update({
      where: { krewby_worker_id: worker.krewby_worker_id },
      data: { preferred_location: preferredLocation },
    });
  }

  // Upsert availability slots
  for (const slot of slots) {
    await prisma.casual_availability.upsert({
      where: {
        staff_id_week_start_date_day_of_week: {
          staff_id: worker.krewby_worker_id,
          week_start_date: new Date(weekStartDate),
          day_of_week: slot.day_of_week,
        },
      },
      update: { available_from: slot.available_from, available_to: slot.available_to },
      create: {
        staff_id: worker.krewby_worker_id,
        week_start_date: new Date(weekStartDate),
        day_of_week: slot.day_of_week,
        available_from: slot.available_from,
        available_to: slot.available_to,
      },
    });
  }
  return { success: true };
};

// ─── Rating ───────────────────────────────────────────────────
const rateWorker = async (workerId, rating, comment, outletId) => {
  // Update running average
  const worker = await prisma.krewby_workers.findUnique({ where: { krewby_worker_id: workerId } });
  const totalJobs = (worker.total_jobs || 0) + 1;
  const currentRating = Number(worker.rating) || 5;
  const newRating = ((currentRating * (totalJobs - 1)) + rating) / totalJobs;

  return await prisma.krewby_workers.update({
    where: { krewby_worker_id: workerId },
    data: { rating: newRating, total_jobs: totalJobs },
  });
};

module.exports = {
  getAllRequests, getRequestsByOutlet, getRequestById, createRequest, updateRequestStatus,
  getMatchesForRequest, getAllWorkers, getWorkerById,
  getMyAssignments, confirmAssignment, declineAssignment, clockIn, clockOut,
  submitWorkerAvailability, rateWorker,
};
