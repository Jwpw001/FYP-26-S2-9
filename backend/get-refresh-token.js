// One-time helper: generates a Gmail OAuth2 refresh token. Scoped to https://mail.google.com/
// (the broadest Gmail scope) so the same token works whether mailer.js sends over SMTP or via
// the Gmail REST API over HTTPS — currently the latter, since it isn't affected by hosts that
// block outbound SMTP ports the way raw SMTP is.
//
// Usage:
//   node get-refresh-token.js
// Then open the printed URL, sign in as krewbyadmin@gmail.com, and approve. This script
// catches the redirect automatically and prints the refresh token — copy it into
// GMAIL_REFRESH_TOKEN in .env (and your deploy platform's env vars).
//
// Requires GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET to already be set in .env, and requires
// http://localhost:8080/oauth2callback to be an allowed redirect URI for that OAuth client
// (Google Auth Platform > Clients > your client > Authorized redirect URIs — required here since
// this client is a "Web application" type, which doesn't get the automatic loopback exception
// "Desktop app" clients get).

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
const http = require("http");
const { google } = require("googleapis");

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET must be set in .env first.");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces Google to reissue a refresh_token even if this client was already authorized before
  scope: ["https://mail.google.com/"],
});

console.log("\nOpen this URL, sign in as krewbyadmin@gmail.com, and approve:\n");
console.log(authUrl + "\n");
console.log(`Waiting for the redirect on ${REDIRECT_URI} ...\n`);

const server = http.createServer(async (req, res) => {
  console.log(`[request] ${req.method} ${req.url}`);

  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404);
    res.end();
    return;
  }

  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  console.log("[oauth2callback] code present:", !!code, "| error:", error);

  if (error) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end(`Google returned an error: ${error}. Check the terminal and try again.`);
    console.error("\nGoogle returned an error:", error);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Success — you can close this tab and go back to the terminal.");

    console.log("\n=== Refresh token (scope: https://mail.google.com/) ===\n");
    if (tokens.refresh_token) {
      console.log(tokens.refresh_token);
    } else {
      console.log("No refresh_token was returned — Google only issues one on first consent");
      console.log("for a given client+scope combination. Revoke prior access at");
      console.log("https://myaccount.google.com/permissions (for krewbyadmin@gmail.com) and");
      console.log("run this script again.");
    }
    console.log("\nPut this in GMAIL_REFRESH_TOKEN in .env and your deploy platform's env vars.\n");
  } catch (err) {
    console.error("\nFailed to exchange code for tokens.");
    console.error("message:", err.message);
    console.error("response.data:", JSON.stringify(err.response?.data || null, null, 2));
    console.error("stack:", err.stack);
    if (!res.writableEnded) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Token exchange failed — check the terminal.");
    }
  } finally {
    server.close();
    setTimeout(() => process.exit(0), 250); // let the HTTP response flush before exiting
  }
});

server.listen(PORT);
