const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

const sendServerError = require("../utils/sendServerError");
const getAccount = async (req, res) => {
    try {
        const dbUser = req.dbUser;
        if (!dbUser) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({
            success: true,
            user: {
                user_id: dbUser.user_id,
                full_name: dbUser.full_name,
                email: dbUser.email,
                role: dbUser.role,
                created_at: dbUser.created_at,
                avatar_url: dbUser.avatar_url || "/avatars/default.png",
            }
        });

    } catch (error) {
        sendServerError(res, error, req);
    }
};

const VALID_AVATARS = [
    "/avatars/default.png",
    "/avatars/avatar1.png",
    "/avatars/avatar2.png",
    "/avatars/avatar3.png",
    "/avatars/avatar4.png",
    "/avatars/avatar5.png",
    "/avatars/avatar6.png",
    "/avatars/avatar7.png",
    "/avatars/avatar8.png",
    "/avatars/avatar9.png",
];

const updateAccount = async (req, res) => {
    try {
        const { full_name, email, avatar_url } = req.body;

        const data = {};
        if (full_name !== undefined) data.full_name = full_name;
        if (email !== undefined) data.email = email;
        if (avatar_url !== undefined) {
            if (!VALID_AVATARS.includes(avatar_url)) {
                return res.status(400).json({ success: false, message: "Invalid avatar selection." });
            }
            data.avatar_url = avatar_url;
        }

        const updatedUser = await prisma.users.update({
            where: {
                user_id: req.user.user_id || req.user.id
            },
            data,
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                avatar_url: true,
            }
        });

        res.json({
            success: true,
            message: "Account updated successfully",
            user: updatedUser
        });

    } catch (error) {
        sendServerError(res, error, req);
    }
};

const deleteAccount = async (req, res) => {
    try {
        await prisma.users.delete({
            where: {
                user_id: req.user.user_id || req.user.id
            }
        });

        res.json({
            success: true,
            message: "Account deleted successfully"
        });

    } catch (error) {
        sendServerError(res, error, req);
    }
};

const getAccountSkills = async (req, res) => {
    try {
        const user_id = req.user.user_id || req.user.id;

        const { data: rows, error } = await supabaseAdmin
            .from("user_skill_tags")
            .select("id, skill_id, experience_level, years_of_experience")
            .eq("user_id", user_id)
            .order("id");
        if (error) throw error;
        if (!rows || rows.length === 0) return res.json({ success: true, skills: [] });

        const skillIds = rows.map(r => r.skill_id);
        const skillRecords = await prisma.skills.findMany({
            where: { skill_id: { in: skillIds } },
            select: { skill_id: true, name: true },
        });
        const nameMap = Object.fromEntries(skillRecords.map(s => [s.skill_id, s.name]));
        const skills = rows
            .map(r => ({
                skill_id: r.skill_id,
                name: nameMap[r.skill_id] || null,
                experience_level: r.experience_level,
                years_of_experience: r.years_of_experience,
            }))
            .filter(r => r.name);

        res.json({ success: true, skills });
    } catch (error) {
        sendServerError(res, error, req);
    }
};

const getMyBranch = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const staffRow = await prisma.staff.findFirst({
            where: { user_id: userId },
            select: { branch_id: true, branches: { select: { name: true } } },
        });
        if (staffRow?.branch_id) {
            return res.json({ success: true, branch_id: staffRow.branch_id, name: staffRow.branches?.name });
        }
        const { data: mgr } = await supabaseAdmin
            .from("branch_managers")
            .select("branch_id, branches(name)")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
        if (mgr?.branch_id) {
            return res.json({ success: true, branch_id: mgr.branch_id, name: mgr.branches?.name });
        }
        return res.status(404).json({ success: false, message: "No branch assigned" });
    } catch (error) {
        return sendServerError(res, error, req);
    }
};

module.exports = {
    getAccount,
    updateAccount,
    deleteAccount,
    getAccountSkills,
    getMyBranch,
};