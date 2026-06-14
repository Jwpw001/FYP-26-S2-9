const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");
const supabaseAdmin = require("../config/supabaseAdmin");

const login = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await prisma.users.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found. Please contact your administrator."
            });
        }

        const token = generateToken({
            user_id: user.user_id,
            email: user.email,
            role: user.role
        });

        return res.status(200).json({
            success: true,
            message: "Login successful",
            token,
            user: {
                user_id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const register = async (req, res) => {
    return res.status(403).json({
        success: false,
        message: "Registration is disabled. Please contact administrator."
    });
};

const forgotPassword = async (req, res) => {
    return res.json({
        success: true,
        message: "Forgot password endpoint working"
    });
};

const resetPassword = async (req, res) => {
    return res.json({
        success: true,
        message: "Reset password endpoint working"
    });
};

// Used by managers to create staff accounts (bypasses email domain restrictions)
const createStaffAccount = async (req, res) => {
    try {
        const { full_name, username, email, password, role, outlet_id, staff_type, default_work_days, hired_at, skill_ids } = req.body;

        if (!email || !password || !full_name || !username) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        // Check if user already exists in our users table
        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "A user with this email already exists." });
        }

        // Create Supabase Auth account using admin (bypasses email validation)
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // skip email confirmation
            user_metadata: { full_name },
        });

        if (authErr) {
            return res.status(400).json({ success: false, message: authErr.message });
        }

        // Insert into users table
        const newUser = await prisma.users.create({
            data: { full_name, username, email, role, is_active: true },
        });

        // Insert staff record
        await prisma.staff.create({
            data: {
                user_id: newUser.user_id,
                outlet_id: Number(outlet_id),
                staff_type,
                default_work_days: staff_type === "regular" ? default_work_days : null,
                hired_at: hired_at ? new Date(hired_at) : null,
                is_active: true,
            },
        });

        // Assign skill tags
        if (skill_ids && skill_ids.length > 0) {
            await prisma.user_skill_tags.createMany({
                data: skill_ids.map(skill_id => ({ user_id: newUser.user_id, skill_id: Number(skill_id) })),
                skipDuplicates: true,
            });
        }

        return res.status(201).json({ success: true, message: "Staff account created successfully." });
    } catch (error) {
        console.error("createStaffAccount error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Used by coordinators to list all krewby workers with user info
const getKrewbyWorkers = async (req, res) => {
    try {
        const workers = await prisma.krewby_workers.findMany({
            orderBy: { krewby_worker_id: "asc" },
            include: {
                users: {
                    select: { user_id: true, full_name: true, email: true }
                }
            }
        });

        const result = workers.map(w => ({
            krewby_worker_id: w.krewby_worker_id,
            user_id: w.user_id,
            preferred_location: w.preferred_location,
            rating: w.rating ? Number(w.rating) : null,
            total_jobs: w.total_jobs,
            is_active: w.is_active,
            user: w.users || null,
        }));

        return res.json({ success: true, workers: result });
    } catch (error) {
        console.error("getKrewbyWorkers error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Used by coordinators to create krewby worker accounts
const createWorkerAccount = async (req, res) => {
    try {
        const { full_name, username, email, password, preferred_location } = req.body;

        if (!email || !password || !full_name || !username) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "A user with this email already exists." });
        }

        // Create Supabase Auth account (allows login)
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
        });

        if (authErr) {
            return res.status(400).json({ success: false, message: authErr.message });
        }

        // Insert into users table
        const newUser = await prisma.users.create({
            data: { full_name, username, email, role: "krewby_casual_worker", is_active: true },
        });

        // Insert into krewby_workers table
        const newWorker = await prisma.krewby_workers.create({
            data: {
                user_id: newUser.user_id,
                preferred_location: preferred_location || null,
                rating: 5.0,
                total_jobs: 0,
                is_active: true,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Krewby worker account created successfully.",
            worker: {
                krewby_worker_id: newWorker.krewby_worker_id,
                user_id: newUser.user_id,
                preferred_location: newWorker.preferred_location,
                rating: Number(newWorker.rating),
                total_jobs: newWorker.total_jobs,
                is_active: newWorker.is_active,
                user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email },
            },
        });
    } catch (error) {
        console.error("createWorkerAccount error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// Used by system admin to create outlet manager accounts
const createManagerAccount = async (req, res) => {
    try {
        const { full_name, username, email, password, outlet_id } = req.body;

        if (!email || !password || !full_name || !username) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "A user with this email already exists." });
        }

        const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
        });

        if (authErr) {
            return res.status(400).json({ success: false, message: authErr.message });
        }

        const newUser = await prisma.users.create({
            data: { full_name, username, email, role: "outlet_manager", is_active: true },
        });

        return res.status(201).json({
            success: true,
            message: "Manager account created successfully.",
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
        });
    } catch (error) {
        console.error("createManagerAccount error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/auth/worker-availability?week_start=YYYY-MM-DD
const getWorkerAvailability = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { week_start } = req.query;
        if (!week_start) return res.status(400).json({ success: false, message: "week_start required" });

        const worker = await prisma.krewby_workers.findFirst({ where: { user_id: userId } });
        if (!worker) return res.status(404).json({ success: false, message: "Worker profile not found" });

        const { data, error } = await supabaseAdmin
            .from("krewby_worker_availability")
            .select("day_of_week")
            .eq("krewby_worker_id", worker.krewby_worker_id)
            .eq("week_start_date", week_start);

        if (error) throw new Error(error.message);

        return res.json({ success: true, availability: (data || []).map(r => r.day_of_week) });
    } catch (error) {
        console.error("getWorkerAvailability error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/auth/worker-availability
// body: { week_start: "YYYY-MM-DD", days: [{ day_of_week: 0-6, available: bool }] }
const saveWorkerAvailability = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { week_start, days } = req.body;
        if (!week_start || !Array.isArray(days)) {
            return res.status(400).json({ success: false, message: "week_start and days are required" });
        }

        const worker = await prisma.krewby_workers.findFirst({ where: { user_id: userId } });
        if (!worker) return res.status(404).json({ success: false, message: "Worker profile not found" });

        // Delete existing rows for this worker + week
        const { error: delError } = await supabaseAdmin
            .from("krewby_worker_availability")
            .delete()
            .eq("krewby_worker_id", worker.krewby_worker_id)
            .eq("week_start_date", week_start);

        if (delError) throw new Error(delError.message);

        // Insert only available days
        const availableDays = days.filter(d => d.available);
        if (availableDays.length > 0) {
            const { error: insError } = await supabaseAdmin
                .from("krewby_worker_availability")
                .insert(availableDays.map(d => ({
                    krewby_worker_id: worker.krewby_worker_id,
                    week_start_date:  week_start,
                    day_of_week:      d.day_of_week,
                })));
            if (insError) throw new Error(insError.message);
        }

        return res.json({ success: true, message: "Availability saved." });
    } catch (error) {
        console.error("saveWorkerAvailability error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/auth/worker-availability-by-id?worker_id=N
// Used by coordinator to view any worker's availability (uses admin client, bypasses RLS)
const getWorkerAvailabilityById = async (req, res) => {
    try {
        const { worker_id } = req.query;
        if (!worker_id) return res.status(400).json({ success: false, message: "worker_id required" });

        const { data, error } = await supabaseAdmin
            .from("krewby_worker_availability")
            .select("week_start_date, day_of_week")
            .eq("krewby_worker_id", worker_id)
            .order("week_start_date", { ascending: false });

        if (error) throw new Error(error.message);
        return res.json({ success: true, availability: data || [] });
    } catch (error) {
        console.error("getWorkerAvailabilityById error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    register,
    login,
    forgotPassword,
    resetPassword,
    createStaffAccount,
    createManagerAccount,
    createWorkerAccount,
    getKrewbyWorkers,
    getWorkerAvailability,
    saveWorkerAvailability,
    getWorkerAvailabilityById,
};