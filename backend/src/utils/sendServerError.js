const logger = require("../config/logger");

// Round 5, Task 3: most controllers catch their own errors and respond directly rather than
// calling next(err), so errorMiddleware.js's production/development message split (and its
// logging) never actually runs for them — this is the same split, callable from inside a catch
// block. Always logs the full error either way; only the response body's message differs.
function sendServerError(res, err, req) {
  (req?.log || logger).error({ err }, "Unhandled error");
  const message = process.env.NODE_ENV === "production"
    ? "Something went wrong. Please try again later."
    : (err?.message || "Server Error");
  return res.status(500).json({ success: false, message });
}

module.exports = sendServerError;
