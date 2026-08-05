const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { sendInvitation, listInvitations, getInvitation, getInvitationByCode, acceptInvitation, cancelInvitation, resendInvitation } = require("../controllers/invitationController");

router.post("/send", protect, sendInvitation);
router.get("/", protect, listInvitations);
router.get("/check-code/:code", getInvitationByCode);
router.get("/:token", getInvitation);
router.post("/:token/accept", protect.optional, acceptInvitation);
router.delete("/:id/cancel", protect, cancelInvitation);
router.post("/:id/resend", protect, resendInvitation);

module.exports = router;

