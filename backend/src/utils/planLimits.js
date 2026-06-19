const PLANS = {
  free:       { businesses: 1, outlets: 1, staff: 20 },
  premium:    { businesses: 1, outlets: 1, staff: Infinity },
  enterprise: { businesses: 2, outlets: Infinity, staff: Infinity },
};

function getLimits(plan) {
  return PLANS[plan] || PLANS.free;
}

module.exports = { getLimits };
