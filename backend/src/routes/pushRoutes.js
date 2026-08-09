const express = require("express");

const router = express.Router();

const { registerPush, unregisterPush } = require("../controllers/pushController");
const verifyToken = require("../middleware/authMiddleware");

// GET /api/push/vapid-public-key — lets the web client fetch the public key at runtime instead
// of hardcoding it, so rotating VAPID keys doesn't require a frontend redeploy.
router.get("/vapid-public-key", (req, res) => {
  res.json({ success: true, publicKey: process.env.VAPID_PUBLIC_KEY || null });
});

router.post("/register", verifyToken, registerPush);
router.post("/unregister", verifyToken, unregisterPush);

module.exports = router;
