const { getShiftRecommendations } = require("../services/recommendationService");

const recommendShiftStaff = async (req, res) => {
  try {
    const shiftId = Number(req.params.shift_id);
    if (!shiftId) return res.status(400).json({ message: "Invalid shift ID" });

    const result = await getShiftRecommendations(shiftId);
    res.json(result);
  } catch (err) {
    console.error("Recommendation error:", err.message);
    res.status(500).json({ message: "Failed to generate recommendations." });
  }
};

module.exports = { recommendShiftStaff };
