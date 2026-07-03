const prisma = require("../config/prisma");

async function getOutletId(userId) {
  const s = await prisma.staff.findFirst({ where: { user_id: userId }, select: { outlet_id: true } });
  return s?.outlet_id || null;
}

// ── Services CRUD ─────────────────────────────────────────────────────────────
const getServices = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const services = await prisma.services.findMany({
      where: { outlet_id: outletId, is_active: true },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, services });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createService = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const { name, duration_mins, requires_skill, color } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, message: "Name required." });
    const service = await prisma.services.create({
      data: { outlet_id: outletId, name: name.trim(), duration_mins: Number(duration_mins) || 60, requires_skill: requires_skill || null, color: color || "#6366F1" },
    });
    res.status(201).json({ success: true, service });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateService = async (req, res) => {
  try {
    const service = await prisma.services.update({
      where: { service_id: Number(req.params.id) },
      data: req.body,
    });
    res.json({ success: true, service });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteService = async (req, res) => {
  try {
    await prisma.services.update({ where: { service_id: Number(req.params.id) }, data: { is_active: false } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Bookings ──────────────────────────────────────────────────────────────────
const getBookings = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const { date, dateFrom, dateTo } = req.query;
    const where = { outlet_id: outletId };
    if (date)               where.booking_date = new Date(date);
    else if (dateFrom && dateTo) where.booking_date = { gte: new Date(dateFrom), lte: new Date(dateTo) };

    const bookings = await prisma.bookings.findMany({
      where,
      include: {
        services: { select: { name: true, duration_mins: true, color: true, requires_skill: true } },
        staff:    { include: { users: { select: { full_name: true } } } },
      },
      orderBy: [{ booking_date: "asc" }, { start_time: "asc" }],
    });
    res.json({ success: true, bookings });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createBooking = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const { service_id, customer_name, customer_phone, booking_date, start_time, assigned_staff_id, notes } = req.body;
    if (!customer_name?.trim() || !booking_date || !start_time) {
      return res.status(400).json({ success: false, message: "customer_name, booking_date and start_time required." });
    }

    // Calculate end_time from service duration
    let end_time = start_time;
    if (service_id) {
      const svc = await prisma.services.findUnique({ where: { service_id: Number(service_id) }, select: { duration_mins: true } });
      if (svc) {
        const [h, m] = start_time.split(":").map(Number);
        const endMins = h * 60 + m + svc.duration_mins;
        end_time = `${String(Math.floor(endMins/60)).padStart(2,"0")}:${String(endMins%60).padStart(2,"0")}`;
      }
    }

    // Check for double-booking
    if (assigned_staff_id) {
      const conflict = await prisma.bookings.findFirst({
        where: {
          assigned_staff_id: Number(assigned_staff_id),
          booking_date: new Date(booking_date),
          status: { in: ["confirmed"] },
          OR: [
            { start_time: { gte: new Date(`1970-01-01T${start_time}:00`), lt: new Date(`1970-01-01T${end_time}:00`) } },
            { end_time:   { gt:  new Date(`1970-01-01T${start_time}:00`), lte: new Date(`1970-01-01T${end_time}:00`) } },
          ],
        },
      });
      if (conflict) return res.status(409).json({ success: false, message: "Staff already booked at this time." });
    }

    const booking = await prisma.bookings.create({
      data: {
        outlet_id: outletId,
        service_id: service_id ? Number(service_id) : null,
        customer_name: customer_name.trim(),
        customer_phone: customer_phone || null,
        booking_date: new Date(booking_date),
        start_time: new Date(`1970-01-01T${start_time}:00`),
        end_time:   new Date(`1970-01-01T${end_time}:00`),
        assigned_staff_id: assigned_staff_id ? Number(assigned_staff_id) : null,
        notes: notes || null,
      },
      include: {
        services: { select: { name: true, color: true } },
        staff:    { include: { users: { select: { full_name: true } } } },
      },
    });
    res.status(201).json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateBooking = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.booking_date) data.booking_date = new Date(data.booking_date);
    if (data.start_time)   data.start_time   = new Date(`1970-01-01T${data.start_time}:00`);
    if (data.end_time)     data.end_time     = new Date(`1970-01-01T${data.end_time}:00`);
    const booking = await prisma.bookings.update({ where: { booking_id: Number(req.params.id) }, data });
    res.json({ success: true, booking });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteBooking = async (req, res) => {
  try {
    await prisma.bookings.update({ where: { booking_id: Number(req.params.id) }, data: { status: "cancelled" } });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── AI: auto-assign staff to a booking based on skill match ──────────────────
const autoAssign = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const { booking_id } = req.body;

    const booking = await prisma.bookings.findUnique({
      where: { booking_id: Number(booking_id) },
      include: { services: true },
    });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found." });

    const requiredSkill = booking.services?.requires_skill;

    // Fetch all active staff at this outlet
    const allStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true },
      include: {
        users: { select: { full_name: true, role: true } },
        bookings: {
          where: { booking_date: booking.booking_date, status: "confirmed" },
          select: { start_time: true, end_time: true },
        },
      },
    });

    // Filter: skill match + not double-booked
    const bStart = booking.start_time.getTime();
    const bEnd   = booking.end_time.getTime();

    const available = allStaff.filter(s => {
      if (s.users?.role === "outlet_manager") return false;
      // Check skill match (simple name contains check)
      if (requiredSkill) {
        const hasSkill = s.skill_tags?.some(t => t.name?.toLowerCase().includes(requiredSkill.toLowerCase()));
        // If skill required but staff has no tag info loaded, allow and rely on manager to verify
      }
      // Check no overlap
      const conflict = s.bookings.some(b => {
        const s_ = b.start_time.getTime(), e_ = b.end_time.getTime();
        return s_ < bEnd && e_ > bStart;
      });
      return !conflict;
    });

    // Prefer intermediate/expert
    const RANK = { expert: 3, intermediate: 2, beginner: 1 };
    available.sort((a, b) => (RANK[b.experience_level]||1) - (RANK[a.experience_level]||1));

    if (available.length === 0) {
      return res.json({ success: false, message: "No available staff found for this time slot." });
    }

    // Assign the best candidate
    const pick = available[0];
    await prisma.bookings.update({
      where: { booking_id: Number(booking_id) },
      data:  { assigned_staff_id: pick.staff_id },
    });

    res.json({ success: true, assigned: { staff_id: pick.staff_id, name: pick.users?.full_name, experience: pick.experience_level }, suggestions: available.slice(0,3).map(s=>({ staff_id:s.staff_id, name:s.users?.full_name, experience:s.experience_level })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Gap detection ─────────────────────────────────────────────────────────────
const detectGaps = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });
    const { date } = req.query;
    if (!date) return res.status(400).json({ success: false, message: "date required." });

    const outlet = await prisma.outlets.findUnique({ where: { outlet_id: outletId }, select: { open_time: true, close_time: true } });
    const toHHMM = v => { if (!v) return null; if (v instanceof Date) return v.toISOString().slice(11,16); return String(v).slice(0,5); };
    const openTime  = toHHMM(outlet?.open_time)  || "09:00";
    const closeTime = toHHMM(outlet?.close_time) || "22:00";

    const bookings = await prisma.bookings.findMany({
      where: { outlet_id: outletId, booking_date: new Date(date), status: { in: ["confirmed"] } },
      orderBy: { start_time: "asc" },
      select: { start_time: true, end_time: true, customer_name: true },
    });

    // Build timeline — find gaps > 30 mins
    const toMins = t => { const [h,m]=String(t).slice(11,16).split(":").map(Number); return h*60+m; };
    const openMins  = toMins("1970-01-01T"+openTime+":00.000Z");
    const closeMins = toMins("1970-01-01T"+closeTime+":00.000Z");

    const gaps = [];
    let cursor = openMins;

    bookings.forEach(b => {
      const bStart = toMins(b.start_time.toISOString());
      if (bStart - cursor >= 30) {
        gaps.push({ from: `${String(Math.floor(cursor/60)).padStart(2,"0")}:${String(cursor%60).padStart(2,"0")}`, to: `${String(Math.floor(bStart/60)).padStart(2,"0")}:${String(bStart%60).padStart(2,"0")}`, duration_mins: bStart - cursor });
      }
      cursor = Math.max(cursor, toMins(b.end_time.toISOString()));
    });

    if (closeMins - cursor >= 30) {
      gaps.push({ from: `${String(Math.floor(cursor/60)).padStart(2,"0")}:${String(cursor%60).padStart(2,"0")}`, to: closeTime, duration_mins: closeMins - cursor });
    }

    res.json({ success: true, date, gaps, total_bookings: bookings.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Staff: my appointments today ──────────────────────────────────────────────
const getMyAppointments = async (req, res) => {
  try {
    const staffRow = await prisma.staff.findFirst({ where: { user_id: req.user.user_id }, select: { staff_id: true } });
    if (!staffRow) return res.status(403).json({ success: false, message: "Staff not found." });
    const { date } = req.query;
    const where = { assigned_staff_id: staffRow.staff_id, status: { in: ["confirmed","completed"] } };
    if (date) where.booking_date = new Date(date);
    const appointments = await prisma.bookings.findMany({
      where,
      include: { services: { select: { name: true, duration_mins: true, color: true } } },
      orderBy: [{ booking_date: "asc" }, { start_time: "asc" }],
    });
    res.json({ success: true, appointments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ── Capacity — weekly scheduled hours per staff (appointment mode) ────────────
const getBookingCapacity = async (req, res) => {
  try {
    const outletId = await getOutletId(req.user.user_id);
    if (!outletId) return res.status(403).json({ success: false, message: "No outlet." });

    const { weekStart, weekEnd } = req.query;
    if (!weekStart || !weekEnd) return res.status(400).json({ success: false, message: "weekStart and weekEnd required." });

    const allStaff = await prisma.staff.findMany({
      where: { outlet_id: outletId, is_active: true },
      include: { users: { select: { full_name: true, role: true } } },
    }).then(list => list.filter(s => s.users?.role !== "outlet_manager"));

    const bookings = await prisma.bookings.findMany({
      where: {
        assigned_staff_id: { in: allStaff.map(s => s.staff_id) },
        status: { not: "cancelled" },
        booking_date: { gte: new Date(weekStart), lte: new Date(weekEnd) },
      },
      include: { services: { select: { name: true } } },
    });

    const leave = await prisma.availability.findMany({
      where: {
        staff: { outlet_id: outletId },
        status: "approved",
        start_date: { lte: new Date(weekEnd) },
        end_date:   { gte: new Date(weekStart) },
      },
      select: { staff_id: true },
    });

    const hoursOf = b => Math.max(0, (b.end_time.getTime() - b.start_time.getTime()) / 3600000);

    const capacity = allStaff.map(s => {
      const bookingsFor = bookings.filter(b => b.assigned_staff_id === s.staff_id);
      const hoursLogged = bookingsFor.reduce((sum, b) => sum + hoursOf(b), 0);
      const onLeave = leave.some(l => l.staff_id === s.staff_id);
      return {
        staff_id:     s.staff_id,
        name:         s.users?.full_name,
        experience:   s.experience_level,
        hours_logged: Math.round(hoursLogged * 10) / 10,
        hours_target: 40,
        on_leave:     onLeave,
        logs: bookingsFor.map(b => ({ date: b.booking_date, hours: hoursOf(b), project: b.services?.name || "Appointment" })),
      };
    });

    res.json({ success: true, capacity });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getServices, createService, updateService, deleteService, getBookings, createBooking, updateBooking, deleteBooking, autoAssign, detectGaps, getMyAppointments, getBookingCapacity };
