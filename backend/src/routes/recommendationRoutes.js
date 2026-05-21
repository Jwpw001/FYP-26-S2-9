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

const {
    createRecommendationSchema,
    updateRecommendationSchema
} = require("../validators/recommendationValidator");

router.get("/", getRecommendations);
router.get("/:id", getRecommendationById);

router.post(
    "/",
    validate(createRecommendationSchema),
    createRecommendation
);

router.patch(
    "/:id",
    validate(updateRecommendationSchema),
    updateRecommendation
);

router.delete("/:id", deleteRecommendation);

module.exports = router;