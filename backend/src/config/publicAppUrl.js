const logger = require("./logger");
const { resolvePublicAppUrl } = require("../utils/publicAppUrl");

// B2: separate from FRONTEND_URL on purpose. FRONTEND_URL is a comma-separated CORS allowlist
// (see app.js's own comment on it) — reading the same variable here, for links, either baked a
// raw localhost URL into a production email (FRONTEND_URL unset) or glued every allow-listed
// origin into one unresolvable URL (FRONTEND_URL set the way its own CORS comment tells you to
// set it: "your production domain plus any specific preview URLs"). Nobody noticed because CORS
// itself works fine regardless — app.js's Vercel wildcard regex covers the deployed frontend
// either way — so the only symptom was outbound links quietly breaking.
const PUBLIC_APP_URL = resolvePublicAppUrl(process.env.PUBLIC_APP_URL);

// Loud, not silent: a localhost URL in a production invitation or password-reset email is a
// broken link a real user will click, not a dev convenience — worth a startup log a human
// actually sees, rather than something only discoverable by clicking through from an inbox.
if (process.env.NODE_ENV === "production" && !process.env.PUBLIC_APP_URL) {
  logger.warn(
    "PUBLIC_APP_URL is not set — invitation and password-reset emails will link to http://localhost:5173, which is unreachable for real users."
  );
}

module.exports = PUBLIC_APP_URL;
