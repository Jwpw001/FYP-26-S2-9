const express = require("express");
const router = express.Router();
const prisma = require("../config/prisma");
const verifyToken = require("../middleware/authMiddleware");

// GET /api/skills
router.get("/", verifyToken, async (req, res) => {
  try {
    const skills = await prisma.skills.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, skills });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/skills/:id
router.get("/:id", verifyToken, async (req, res) => {
  try {
    const skill = await prisma.skills.findUnique({
      where: { skill_id: Number(req.params.id) }
    });
    if (!skill) return res.status(404).json({ success: false, message: "Skill not found" });
    res.json({ success: true, skill });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/user-skill-tags?user_ids=1,2,3
router.get("/user-skill-tags/list", verifyToken, async (req, res) => {
  try {
    const { user_ids } = req.query;
    const ids = user_ids ? user_ids.split(",").map(Number).filter(Boolean) : [];
    const where = ids.length > 0 ? { user_id: { in: ids } } : {};
    const user_skill_tags = await prisma.user_skill_tags.findMany({
      where,
      include: { skills: { select: { skill_id: true, name: true } } }
    });
    res.json({ success: true, user_skill_tags });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
