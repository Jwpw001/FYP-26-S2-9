const MailComposer = require('nodemailer/lib/mail-composer');
const { google } = require('googleapis');

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const GMAIL_USER = 'krewbyadmin@gmail.com';

// Sends via the Gmail REST API (HTTPS) instead of raw SMTP — hosts that block outbound SMTP
// ports (25/465/587), Render among them, don't block HTTPS, so this avoids that entirely.
// MailComposer builds the raw RFC 2822 MIME message locally (no network call); it's the same
// message-building code nodemailer's SMTP transport uses internally, just without sending it
// over SMTP — the actual send happens via gmail.users.messages.send below.
async function sendMail({ to, subject, html }) {
  const mail = new MailComposer({
    from: `Krewby <${GMAIL_USER}>`,
    to,
    subject,
    html,
  });
  const message = await mail.compile().build();
  const raw = message.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, 'https://oauth2.googleapis.com/token');
  oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });
}

module.exports = { sendMail };
