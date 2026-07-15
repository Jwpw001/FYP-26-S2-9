const prisma = require("../config/prisma");
const supabaseAdmin = require("../config/supabaseAdmin");

const getAccount = async (req, res) => {
    try {
        const user = await prisma.users.findUnique({
            where: {
                user_id: req.user.user_id || req.user.id
            },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true,
                created_at: true
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

const updateAccount = async (req, res) => {
    try {
        const { full_name, email } = req.body;

        const updatedUser = await prisma.users.update({
            where: {
                user_id: req.user.user_id || req.user.id
            },
            data: {
                full_name,
                email
            },
            select: {
                user_id: true,
                full_name: true,
                email: true,
                role: true
            }
        });

        res.json({
            success: true,
            message: "Account updated successfully",
            user: updatedUser
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
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
        res.status(500).json({
            success: false,
            message: error.message
        });
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
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    getAccount,
    updateAccount,
    deleteAccount,
    getAccountSkills,
};