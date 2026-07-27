const express = require("express");
const router = express.Router();
const { chat, brief } = require("../controllers/aiAssistantController");
const { execute }     = require("../controllers/aiAssistantExecuteController");
const protect = require("../middleware/authMiddleware");

router.post("/chat",    protect, chat);
router.get("/brief",   protect, brief);
router.post("/execute", protect, execute);

module.exports = router;

