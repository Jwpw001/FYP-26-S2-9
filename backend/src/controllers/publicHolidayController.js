const prisma = require("../config/prisma");

// GET /api/public-holidays?year=2026&country_code=SG
const getPublicHolidays = async (req, res) => {
  try {
    const { year, country_code } = req.query;
    const where = {};
    if (year) where.year = Number(year);
    if (country_code) where.country_code = String(country_code).toUpperCase();

    const holidays = await prisma.public_holidays.findMany({
      where,
      orderBy: { holiday_date: "asc" },
      select: { holiday_id: true, country_code: true, holiday_date: true, name: true, year: true },
    });
    return res.json({ success: true, holidays });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPublicHolidays };
