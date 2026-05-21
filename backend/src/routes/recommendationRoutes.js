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
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getRecommendations
);

router.get(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    getRecommendationById
);

router.post(
    "/",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    validate(createRecommendationSchema),
    createRecommendation
);

router.patch(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER, ROLES.COORDINATOR),
    validate(updateRecommendationSchema),
    updateRecommendation
);

router.delete(
    "/:id",
    verifyToken,
    allowRoles(ROLES.MANAGER),
    deleteRecommendation
);

module.exports = router;