const express = require("express");
const router = express.Router();
const { chat, brief, shiftReview, weeklyReview } = require("../controllers/aiAssistantController");
const { execute }     = require("../controllers/aiAssistantExecuteController");
const protect = require("../middleware/authMiddleware");

router.post("/chat",    protect, chat);
router.get("/brief",   protect, brief);
router.post("/execute",      protect, execute);
router.post("/shift-review", protect, shiftReview);
router.post("/weekly-review", protect, weeklyReview);

module.exports = router;

