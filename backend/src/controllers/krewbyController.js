const {
  getAllRequests, getRequestsByOutlet, getRequestById, createRequest, updateRequestStatus,
  getMatchesForRequest, getAllWorkers, getWorkerById,
  getMyAssignments, confirmAssignment, declineAssignment, clockIn, clockOut,
  submitWorkerAvailability, rateWorker,
} = require("../services/krewbyService");
const { getOutletId } = require("../utils/getOutletId");
const prisma = require("../config/prisma");

// Helper to get outlet_id for manager
async function getManagerOutletId(userId, role) {
  return getOutletId(userId, role || "outlet_manager");
}

// ─── Requests ─────────────────────────────────────────────────
const getRequests = async (req, res) => {
  try {
    const { role, user_id } = req.user;
    let data;
    if (role === "outlet_manager") {
      const outletId = await getManagerOutletId(user_id, role);
      data = await getRequestsByOutlet(outletId);
    } else {
      data = await getAllRequests();
    }
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getRequestByIdController = async (req, res) => {
  try {
    const data = await getRequestById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createRequestController = async (req, res) => {
  try {
    const outletId = await getManagerOutletId(req.user.user_id, req.user.role);
    if (!outletId) return res.status(404).json({ success: false, message: "Outlet not found" });
    const data = await createRequest(req.body, outletId, req.user.user_id);
    res.status(201).json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateRequestController = async (req, res) => {
  try {
    const { status, override_note, worker_id } = req.body;
    const data = await updateRequestStatus(Number(req.params.id), status, worker_id, override_note);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getMatchesController = async (req, res) => {
  try {
    const data = await getMatchesForRequest(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const assignWorkerController = async (req, res) => {
  try {
    const { worker_id, override_note } = req.body;
    const requestId = Number(req.params.id);
    const request = await getRequestById(requestId);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    // Create shift assignment for the krewby worker
    await prisma.shift_assignments.create({
      data: {
        shift_id: request.shift_id || null,
        role_id: request.role_id || null,
        krewby_worker_id: worker_id,
        status: "assigned",
        assigned_at: new Date(),
      },
    });

    // Update request status
    await updateRequestStatus(requestId, "matched", worker_id, override_note);

    // Update worker job count
    await prisma.krewby_workers.update({
      where: { krewby_worker_id: worker_id },
      data: { total_jobs: { increment: 1 } },
    });

    res.json({ success: true, message: "Worker assigned" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── Workers ──────────────────────────────────────────────────
const getWorkersController = async (req, res) => {
  try {
    const data = await getAllWorkers();
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getWorkerByIdController = async (req, res) => {
  try {
    const data = await getWorkerById(Number(req.params.id));
    if (!data) return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── My Assignments (Worker) ───────────────────────────────────
const getMyAssignmentsController = async (req, res) => {
  try {
    const data = await getMyAssignments(req.user.user_id);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const confirmAssignmentController = async (req, res) => {
  try {
    const data = await confirmAssignment(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const declineAssignmentController = async (req, res) => {
  try {
    const data = await declineAssignment(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const clockInController = async (req, res) => {
  try {
    const data = await clockIn(Number(req.params.id), req.user.user_id);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const clockOutController = async (req, res) => {
  try {
    const data = await clockOut(Number(req.params.id));
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── Availability ──────────────────────────────────────────────
const submitAvailabilityController = async (req, res) => {
  try {
    const { week_start_date, slots, preferred_location } = req.body;
    const data = await submitWorkerAvailability(req.user.user_id, week_start_date, slots, preferred_location);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ─── Rating ────────────────────────────────────────────────────
const rateWorkerController = async (req, res) => {
  try {
    const outletId = await getManagerOutletId(req.user.user_id, req.user.role);
    const { rating, comment } = req.body;
    const data = await rateWorker(Number(req.params.id), rating, comment, outletId);
    res.json({ success: true, data });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getRequests, getRequestByIdController, createRequestController, updateRequestController,
  getMatchesController, assignWorkerController,
  getWorkersController, getWorkerByIdController,
  getMyAssignmentsController, confirmAssignmentController, declineAssignmentController,
  clockInController, clockOutController,
  submitAvailabilityController, rateWorkerController,
};
