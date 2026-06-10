const express = require("express");
const router = express.Router();
const { getAccount, updateAccount, deleteAccount } = require("../controllers/accountController");
const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");
const { updateAccountSchema } = require("../validators/accountValidator");
const prisma = require("../config/prisma");

router.get("/",
  verifyToken,
  allowRoles(ROLES.SYSTEM_ADMIN, ROLES.OUTLET_MANAGER, ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ROLES.KREWBY_COORDINATOR, ROLES.KREWBY_CASUAL_WORKER),
  getAccount
);

router.patch("/",
  verifyToken,
  allowRoles(ROLES.SYSTEM_ADMIN, ROLES.OUTLET_MANAGER, ROLES.REGULAR_STAFF, ROLES.OUTLET_CASUAL_STAFF, ROLES.KREWBY_COORDINATOR, ROLES.KREWBY_CASUAL_WORKER),
  validate(updateAccountSchema),
  updateAccount
);

router.delete("/",
  verifyToken,
  allowRoles(ROLES.SYSTEM_ADMIN),
  deleteAccount
);

// GET /api/account/skills - returns all skills for dropdowns
router.get("/skills",
  verifyToken,
  async (req, res) => {
    try {
      const data = await prisma.skills.findMany({ orderBy: { name: "asc" } });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;
