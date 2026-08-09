const { getShiftRecommendations } = require("../services/recommendationService");
const logger = require("../config/logger");

const recommendShiftStaff = async (req, res) => {
  try {
    const shiftId = Number(req.params.shift_id);
    if (!shiftId) return res.status(400).json({ message: "Invalid shift ID" });

    const result = await getShiftRecommendations(shiftId);
    res.json(result);
  } catch (err) {
    (req.log || logger).error({ err }, "Recommendation error");
    res.status(500).json({ message: "Failed to generate recommendations." });
  }
};

module.exports = { recommendShiftStaff };
