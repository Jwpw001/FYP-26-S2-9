// Pure — resolves the single origin to use for links emailed to users (invitations, password
// reset), given the raw PUBLIC_APP_URL env value. No env access or logging in here, so this is
// unit-testable without mocking process.env or the logger; config/publicAppUrl.js wraps this
// with the actual env read and the production startup warning.
function resolvePublicAppUrl(rawValue) {
  if (!rawValue) return "http://localhost:5173";
  // Defensive: this variable is documented as single-origin, but if it's ever set to a
  // comma-separated list by the same mistake FRONTEND_URL had (see app.js's CORS comment — that
  // one really is meant to be a list), take the first entry rather than gluing every entry into
  // one unresolvable URL the way the old bug did.
  const first = rawValue.split(",")[0].trim();
  return first || "http://localhost:5173";
}

module.exports = { resolvePublicAppUrl };
