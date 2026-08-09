const pino = require("pino");

// Pretty-printed, human-readable logs in development; structured JSON (for log aggregation) in
// production. Never log secrets/tokens/passwords or full request bodies — redact known-sensitive
// paths so a stray `logger.info({ req }, ...)` can't leak credentials.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV === "production" ? undefined : { target: "pino-pretty" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.password",
      "*.token",
      "*.access_token",
      "*.refresh_token",
      "*.apiKey",
      "*.api_key",
    ],
    censor: "[REDACTED]",
  },
});

module.exports = logger;
