const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { sendInvitation, listInvitations, getInvitation, acceptInvitation, cancelInvitation } = require("../controllers/invitationController");

router.post("/send", protect, sendInvitation);
router.get("/", protect, listInvitations);
router.get("/:token", getInvitation);
router.post("/:token/accept", acceptInvitation);
router.delete("/:id/cancel", protect, cancelInvitation);

module.exports = router;
