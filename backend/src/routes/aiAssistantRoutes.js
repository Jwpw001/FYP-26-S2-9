const express = require("express");
const router = express.Router();
const { chat, brief } = require("../controllers/aiAssistantController");
const protect = require("../middleware/authMiddleware");

router.post("/chat", protect, chat);
router.get("/brief", protect, brief);

module.exports = router;

