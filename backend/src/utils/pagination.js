// Parses ?page/?limit query params with sane defaults and an upper bound. `requested` is false
// when neither param was supplied, so callers can keep returning their pre-pagination response
// shape unchanged for existing clients that don't send these params yet.
function parsePagination(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  const requested = query.page !== undefined || query.limit !== undefined;
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { requested, page, limit, skip };
}

module.exports = { parsePagination };
