const prisma = require("../config/prisma");
const generateToken = require("../utils/generateToken");
const supabaseAdmin = require("../config/supabaseAdmin");
const supabaseAuth = require("../config/supabaseAuth");
const { notifyUsers, getSystemAdminUserIds } = require("../utils/notify");
const logger = require("../config/logger");

const sendServerError = require("../utils/sendServerError");
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

        const staff = await prisma.staff.findFirst({ where: { user_id: user.user_id }, select: { is_active: true } });
        const isActive = staff ? staff.is_active !== false : user.is_active;

        if (!isActive) {
            return res.status(401).json({
                success: false,
                message: "Account is deactivated. Contact your manager."
            });
        }

        const { error: authError } = await supabaseAuth.auth.signInWithPassword({
            email,
            password: req.body.password,
        });
        if (authError) {
            return res.status(401).json({ success: false, message: "Invalid email or password." });
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
                role: user.role,
                avatar_url: user.avatar_url || "/avatars/default.png"
            }
        });

    } catch (error) {
        return sendServerError(res, error, req);
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

        const token = generateToken({ user_id: newUser.user_id, email: newUser.email, role: newUser.role });

        return res.status(201).json({
            success: true,
            message: "Account created successfully.",
            token,
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role, avatar_url: newUser.avatar_url || "/avatars/default.png" },
        });
    } catch (error) {
        return sendServerError(res, error, req);
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
        let businessId;
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

            businessId = bizData.business_id;

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

        try {
            const adminIds = await getSystemAdminUserIds();
            await notifyUsers(adminIds, {
                type: "business_registered",
                title: "New Business Registered",
                message: `${business_name} just signed up (${selectedPlan} plan), owned by ${owner_name}.`,
                relatedEntity: "businesses",
                relatedId: businessId,
            });
        } catch { /* notification failure shouldn't block registration */ }

        return res.status(201).json({
            success: true,
            message: "Business registered successfully.",
            token,
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role, avatar_url: newUser.avatar_url || "/avatars/default.png" },
        });
    } catch (error) {
        return sendServerError(res, error, req);
    }
};

const forgotPassword = async (req, res) => {
    try {
        const email = req.body.email?.trim().toLowerCase();
        if (!email) return res.status(400).json({ success: false, message: "Email is required." });

        const { sendMail } = require("../utils/mailer");
        // B2: was process.env.FRONTEND_URL || "http://localhost:5173" — the same bug as
        // invitationController.js's invite links (FRONTEND_URL is a comma-separated CORS
        // allowlist, not a single link-building origin — see config/publicAppUrl.js). This is
        // the more likely explanation for the UR-05 password-recovery test cases sitting Blocked
        // than "SMTP unavailable": sendMail here goes over the Gmail API via HTTPS
        // (utils/mailer.js), not SMTP, and it's the exact same sendMail the invitation email that
        // DID arrive in testing used — so if the reset email arrives at all, this broken link is
        // what actually blocks the case, not mail delivery.
        const PUBLIC_APP_URL = require("../config/publicAppUrl");
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email,
            options: { redirectTo: `${PUBLIC_APP_URL}/reset-password` },
        });
        if (error) {
            (req.log || logger).error({ err: error }, "[forgotPassword] generateLink failed");
            // Don't reveal whether the email exists
            return res.json({ success: true, message: "If that email exists, a reset link has been sent." });
        }
        const resetLink = data.properties?.action_link;
        await sendMail({
            to: email,
            subject: "Reset your Krewby password",
            html: `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;">
                <h2 style="color:#0F172A;">Reset your password</h2>
                <p>Click the link below to set a new password. This link expires in 1 hour.</p>
                <a href="${resetLink}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#F59E0B;color:#1C1917;font-weight:700;border-radius:8px;text-decoration:none;">Reset Password</a>
                <p style="color:#64748B;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
            </div>`,
        });
        return res.json({ success: true, message: "If that email exists, a reset link has been sent." });
    } catch (error) {
        return sendServerError(res, error, req);
    }
};

const resetPassword = async (req, res) => {
    try {
        const { access_token, password } = req.body;
        if (!access_token || !password) {
            return res.status(400).json({ success: false, message: "Token and new password are required." });
        }
        const { error } = await supabaseAdmin.auth.admin.updateUserById(
            (await supabaseAdmin.auth.getUser(access_token)).data?.user?.id,
            { password }
        );
        if (error) return res.status(400).json({ success: false, message: error.message });
        return res.json({ success: true, message: "Password updated successfully." });
    } catch (error) {
        return sendServerError(res, error, req);
    }
};

// Used by managers to create staff accounts (bypasses email domain restrictions)
const createStaffAccount = async (req, res) => {
    try {
        const { full_name, username, email: rawEmail, password, role, branch_id: branch_id_body, branch_id, staff_type, default_work_days, hired_at, skill_ids, skill_assignments } = req.body;
        const resolvedBranchId = branch_id_body ?? branch_id;
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
                branch_id: Number(resolvedBranchId),
                staff_type,
                default_work_days: staff_type === "regular" ? default_work_days : null,
                hired_at: hired_at ? new Date(hired_at) : null,
                is_active: true,
            },
        });

        // Casual staff belong to a business-wide pool, not a single branch — set up their
        // pool membership and default their preferred branch to the one they were created in.
        // They can add more preferred branches later from their own account.
        if (staff_type === "casual") {
            const branch = await prisma.branches.findUnique({
                where: { branch_id: Number(resolvedBranchId) },
                select: { business_id: true },
            });
            if (branch?.business_id) {
                await supabaseAdmin.from("casual_workers").insert({
                    user_id: newUser.user_id,
                    business_id: branch.business_id,
                    status: "approved",
                    approved_at: new Date().toISOString(),
                });
                await supabaseAdmin.from("casual_branch_preferences").insert({
                    user_id: newUser.user_id,
                    branch_id: Number(resolvedBranchId),
                });
            }
        }

        // Assign skill tags to the user
        const assignments = skill_assignments || (skill_ids ? skill_ids.map(id => ({ skill_id: id })) : []);
        if (assignments.length > 0) {
            await supabaseAdmin.from("user_skill_tags").upsert(
                assignments.map(a => ({
                    user_id: newUser.user_id,
                    skill_id: Number(a.skill_id),
                    experience_level: a.experience_level || null,
                    years_of_experience: a.years_of_experience != null && a.years_of_experience !== "" ? Number(a.years_of_experience) : null,
                })),
                { onConflict: "user_id,skill_id" }
            );
        }

        return res.status(201).json({ success: true, message: "Staff account created successfully." });
    } catch (error) {
        return sendServerError(res, error, req);
    }
};

// Used by system admin to create manager accounts
const createManagerAccount = async (req, res) => {
    try {
        const { full_name, username, email: rawEmail, password, branch_id } = req.body;
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
            data: { full_name, username, email, role: "manager", is_active: true },
        });

        return res.status(201).json({
            success: true,
            message: "Manager account created successfully.",
            user: { user_id: newUser.user_id, full_name: newUser.full_name, email: newUser.email, role: newUser.role, avatar_url: newUser.avatar_url || "/avatars/default.png" },
        });
    } catch (error) {
        return sendServerError(res, error, req);
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
};