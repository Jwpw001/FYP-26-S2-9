const nodemailer = require("nodemailer");
const logger = require("../config/logger");

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
  return transporter;
}

// Sends via a dedicated Gmail account's SMTP relay (a workaround for not having a
// domain-verified transactional email provider). Falls back to logging the email content
// to the console if GMAIL_USER/GMAIL_APP_PASSWORD aren't configured, so local dev and any
// environment without credentials set still runs without crashing.
async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  if (!t) {
    // Dev-only fallback (no GMAIL_USER/GMAIL_APP_PASSWORD configured) — intentionally logs the
    // full email body, including any reset/invite link, so a developer without real credentials
    // configured can still read and use it locally. Never reached once real credentials are set.
    logger.info({ to, subject, html }, "[EMAIL - DEV] no mail transport configured, logging instead");
    return { sent: false, dev: true };
  }
  try {
    await t.sendMail({
      from: `Krewby <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (err) {
    logger.error({ err }, "[mailer] sendMail failed");
    return { sent: false, error: err.message };
  }
}

module.exports = { sendMail };
