const express = require("express");

const router = express.Router();

const {
    getRecommendations,
    getRecommendationById,
    createRecommendation,
    updateRecommendation,
    deleteRecommendation
} = require("../controllers/recommendationController");

const validate = require("../middleware/validateMiddleware");
const verifyToken = require("../middleware/authMiddleware");
const allowRoles = require("../middleware/roleMiddleware");
const ROLES = require("../constants/roles");

const {
    createRecommendationSchema,
    updateRecommendationSchema
} = require("../validators/recommendationValidator");

router.get(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    getRecommendations
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    getRecommendationById
);

router.post(
    "/",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    validate(createRecommendationSchema),
    createRecommendation
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER,
        ROLES.KREWBY_COORDINATOR
    ),
    validate(updateRecommendationSchema),
    updateRecommendation
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(
        ROLES.SYSTEM_ADMIN,
        ROLES.OUTLET_MANAGER
    ),
    deleteRecommendation
);

module.exports = router;