const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");
const supabaseAdmin = require("../config/supabaseAdmin");
const bcrypt = require("bcryptjs");

const login = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();

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

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
function isValidEmail(email) {
    if (!EMAIL_REGEX.test(email)) return false;
    const tld = email.split(".").pop();
    return tld.length >= 2;
}

const register = async (req, res) => {
    try {
        const { full_name, username: rawUsername, email: rawEmail, password, role } = req.body;
        const email = rawEmail?.trim().toLowerCase();

        if (!rawUsername || rawUsername.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Username is required (min 2 characters)." });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        const username = rawUsername.trim().toLowerCase();

        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const existingUsername = await prisma.users.findFirst({ where: { username } });
        if (existingUsername) {
            return res.status(409).json({ success: false, message: "This username is already taken." });
        }

        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name },
        });
        if (authErr) return res.status(400).json({ success: false, message: authErr.message });

        const newUser = await prisma.users.create({
            data: { full_name, username, email, role: role || "pending", is_active: true },
        });

        if (role === "krewby_casual_worker") {
            await prisma.krewby_workers.create({
                data: { user_id: newUser.user_id, is_available: true },
            });
        }

        const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

const registerBusiness = async (req, res) => {
    try {
        const {
            business_name, description, owner_name, email: rawEmail, phone, address, password,
            plan, business_settings, business_roles, allocation_preferences,
        } = req.body;
        const email = rawEmail?.trim().toLowerCase();
        const validPlans = ["free", "premium", "enterprise"];
        const selectedPlan = validPlans.includes(plan) ? plan : "free";

        if (!business_name || !owner_name || !email || !password) {
            return res.status(400).json({ success: false, message: "Missing required fields." });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: "Please enter a valid email address." });
        }

        if (business_settings?.operating_days && !/^[01]{7}$/.test(business_settings.operating_days)) {
            return res.status(400).json({ success: false, message: "operating_days must be a 7-character string of 0s and 1s." });
        }

        if (allocation_preferences) {
            const { weight_availability = 40, weight_skills = 30, weight_attendance = 15, weight_performance = 10, weight_workload = 5 } = allocation_preferences;
            if (weight_availability + weight_skills + weight_attendance + weight_performance + weight_workload !== 100) {
                return res.status(400).json({ success: false, message: "Allocation weights must sum to 100." });
            }
        }

        if (business_roles && business_roles.length > 0 && business_roles.length < 3) {
            return res.status(400).json({ success: false, message: "Please add at least 3 workforce roles." });
        }

        const existing = await prisma.users.findUnique({ where: { email } });
        if (existing) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const username = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "") + Math.floor(Math.random() * 1000);

        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: owner_name },
        });
        if (authErr) return res.status(400).json({ success: false, message: authErr.message });

        let newUser;
        try {
            newUser = await prisma.users.create({
                data: { full_name: owner_name, username, email, role: "business_owner", is_active: true },
            });

            const { data: bizData, error: bizErr } = await supabaseAdmin.from("businesses").insert({
                name: business_name,
                description: description || null,
                contact_email: email,
                contact_phone: phone || null,
                address: address || null,
                owner_id: newUser.user_id,
                plan: selectedPlan,
            }).select("business_id").single();
            if (bizErr) throw new Error(bizErr.message);

            const businessId = bizData.business_id;

            const settingsDefaults = {
                operating_days: "1111100", open_time: "09:00", close_time: "18:00",
                holidays: [], work_hours_day: 8, max_work_hours_day: 12,
                max_consecutive_days: 6, allow_overtime: false, min_workers_per_assignment: 1,
            };
            const settingsRow = { business_id: businessId, ...settingsDefaults, ...(business_settings || {}) };
            const { error: setErr } = await supabaseAdmin.from("business_settings").insert(settingsRow);
            if (setErr) throw new Error(setErr.message);

            if (business_roles && business_roles.length > 0) {
                const roleRows = business_roles.map(r => ({
                    business_id: businessId,
                    role_name: r.role_name,
                    description: r.description || "",
                    is_suggested: r.is_suggested || false,
                }));
                const { error: roleErr } = await supabaseAdmin.from("business_roles").insert(roleRows);
                if (roleErr) throw new Error(roleErr.message);
            }

            const prefDefaults = {
                weight_availability: 40, weight_skills: 30, weight_attendance: 15,
                weight_performance: 10, weight_workload: 5,
            };
            const prefRow = { business_id: businessId, ...prefDefaults, ...(allocation_preferences || {}) };
            const { error: prefErr } = await supabaseAdmin.from("allocation_preferences").insert(prefRow);
            if (prefErr) throw new Error(prefErr.message);
        } catch (innerErr) {
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw innerErr;
        }

        const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

        return res.status(201).json({
            success: true,
            message: "Business registered successfully.",
            token,
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
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
        const { full_name, username, email: rawEmail, password, role, outlet_id, staff_type, default_work_days, hired_at, skill_ids, skill_assignments } = req.body;
        const email = rawEmail?.trim().toLowerCase();

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

        // Assign skill tags — write to both tables
        const assignments = skill_assignments || (skill_ids ? skill_ids.map(id => ({ skill_id: id })) : []);
        if (assignments.length > 0) {
            const newStaff = await prisma.staff.findFirst({ where: { user_id: newUser.user_id, outlet_id: Number(outlet_id) } });
            await prisma.user_skill_tags.createMany({
                data: assignments.map(a => ({ user_id: newUser.user_id, skill_id: Number(a.skill_id) })),
                skipDuplicates: true,
            });
            if (newStaff) {
                const { error: ssErr } = await supabaseAdmin.from("staff_skills").upsert(
                    assignments.map(a => ({
                        staff_id: newStaff.staff_id,
                        skill_id: Number(a.skill_id),
                        experience_level: a.experience_level || null,
                        years_of_experience: a.years_of_experience != null && a.years_of_experience !== "" ? Number(a.years_of_experience) : null,
                    })),
                    { onConflict: "staff_id,skill_id" }
                );
                if (ssErr) console.error("staff_skills insert error:", ssErr.message);
            }
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
        const { full_name, username, email: rawEmail, password, preferred_location } = req.body;
        const email = rawEmail?.trim().toLowerCase();

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
        const { full_name, username, email: rawEmail, password, outlet_id } = req.body;
        const email = rawEmail?.trim().toLowerCase();

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

// POST /api/auth/apply-worker — public, stores application pending coordinator approval
const applyWorker = async (req, res) => {
    try {
        const { full_name, username, email, password } = req.body;
        if (!full_name || !username || !email || !password)
            return res.status(400).json({ success: false, message: "All fields are required." });
        if (username.trim().length < 2)
            return res.status(400).json({ success: false, message: "Username must be at least 2 characters." });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: "Password must be at least 6 characters." });

        // Check duplicates in existing users
        const existingUser = await prisma.users.findUnique({ where: { email } });
        if (existingUser)
            return res.status(409).json({ success: false, message: "An account with this email already exists." });

        // Check duplicates in pending applications
        const { data: existingApp } = await supabaseAdmin
            .from("worker_applications")
            .select("id")
            .eq("email", email)
            .maybeSingle();
        if (existingApp)
            return res.status(409).json({ success: false, message: "An application with this email is already pending review." });

        const password_hash = await bcrypt.hash(password, 10);

        const { error } = await supabaseAdmin.from("worker_applications").insert({
            full_name: full_name.trim(),
            username:  username.trim().toLowerCase(),
            email:     email.trim().toLowerCase(),
            password_hash,
        });
        if (error) throw new Error(error.message);

        return res.status(201).json({ success: true, message: "Application submitted successfully." });
    } catch (error) {
        console.error("applyWorker error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// GET /api/coordinator/applications — coordinator only
const getWorkerApplications = async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from("worker_applications")
            .select("id, full_name, username, email, status, applied_at, notes")
            .order("applied_at", { ascending: false });
        if (error) throw new Error(error.message);
        return res.json({ success: true, applications: data || [] });
    } catch (error) {
        console.error("getWorkerApplications error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/coordinator/applications/:id/approve — creates user + krewby_worker, deletes application
const approveWorkerApplication = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: app, error: fetchErr } = await supabaseAdmin
            .from("worker_applications")
            .select("*")
            .eq("id", id)
            .single();
        if (fetchErr || !app) return res.status(404).json({ success: false, message: "Application not found." });

        // Check if user already exists (edge case)
        const existing = await prisma.users.findUnique({ where: { email: app.email } });
        if (existing) {
            // Clean up the application and return success
            await supabaseAdmin.from("worker_applications").delete().eq("id", id);
            return res.json({ success: true, message: "User already exists. Application removed." });
        }

        // Create Supabase auth user — generate a random temp password; user resets via Forgot Password
        const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
        const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email: app.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: app.full_name },
        });
        if (authErr) return res.status(400).json({ success: false, message: authErr.message });

        // Create user record
        const newUser = await prisma.users.create({
            data: { full_name: app.full_name, username: app.username, email: app.email, role: "krewby_casual_worker", is_active: true },
        });

        // Create krewby_worker record
        await prisma.krewby_workers.create({
            data: { user_id: newUser.user_id, is_available: true, total_jobs: 0 },
        });

        // Delete the application
        await supabaseAdmin.from("worker_applications").delete().eq("id", id);

        return res.json({ success: true, message: `Account approved for ${app.email}. They can use Forgot Password to set their password and log in.` });
    } catch (error) {
        console.error("approveWorkerApplication error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// POST /api/coordinator/applications/:id/reject — deletes application
const rejectWorkerApplication = async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin.from("worker_applications").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: "Application rejected and removed." });
    } catch (error) {
        console.error("rejectWorkerApplication error:", error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    register,
    registerBusiness,
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
    applyWorker,
    getWorkerApplications,
    approveWorkerApplication,
    rejectWorkerApplication,
};