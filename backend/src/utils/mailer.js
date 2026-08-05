const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

async function sendMail({ to, subject, html }) {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[MAIL - DEV] To: ${to} | Subject: ${subject}`);
    return;
  }
  return transporter.sendMail({
    from: `Krewby <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendMail };
