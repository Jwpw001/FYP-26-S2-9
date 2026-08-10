import { api } from "../lib/api";

// Fetches the reference public-holiday list for a given year/country from the
// backend's public_holidays table and shapes it into the { date, name, enabled }
// rows the branch/business settings "holidays" list expects as its default seed.
export async function fetchDefaultHolidays(year = new Date().getFullYear(), countryCode = "SG") {
  try {
    const { holidays } = await api.get(`/api/public-holidays?year=${year}&country_code=${countryCode}`);
    return (holidays || []).map(h => ({
      date: h.holiday_date.slice(0, 10),
      name: h.name,
      enabled: true,
    }));
  } catch {
    return [];
  }
}
