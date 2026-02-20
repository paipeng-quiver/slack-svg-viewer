const express = require("express");
const { upsertTeam } = require("./db");

const router = express.Router();

const SCOPES = [
  "files:read",
  "files:write",
  "chat:write",
  "commands",
  "im:write",
].join(",");

// GET /auth/install — redirect to Slack OAuth
router.get("/install", (req, res) => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
  const redirectUri = `${appUrl}/auth/callback`;

  const url =
    `https://slack.com/oauth/v2/authorize?` +
    `client_id=${clientId}&scope=${SCOPES}&redirect_uri=${encodeURIComponent(redirectUri)}`;

  res.redirect(url);
});

// GET /auth/callback — handle OAuth callback
router.get("/callback", async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`Installation cancelled: ${error}`);
  }

  if (!code) {
    return res.status(400).send("Missing code parameter");
  }

  try {
    const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
    const redirectUri = `${appUrl}/auth/callback`;

    const resp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await resp.json();

    if (!data.ok) {
      console.error("OAuth error:", data);
      return res.status(400).send(`OAuth failed: ${data.error}`);
    }

    // Store the workspace token
    upsertTeam.run({
      team_id: data.team.id,
      team_name: data.team.name,
      bot_token: data.access_token,
      bot_user_id: data.bot_user_id || null,
    });

    console.log(`✅ Installed to workspace: ${data.team.name} (${data.team.id})`);

    res.send(`
      <!DOCTYPE html>
      <html><head><title>Installed!</title>
      <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f8f9fa}
      .card{text-align:center;padding:3rem;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.08)}
      h1{color:#2eb67d;margin-bottom:.5rem}p{color:#555}</style></head>
      <body><div class="card"><h1>✅ Installed!</h1>
      <p>Quiver SVG Viewer has been added to <strong>${data.team.name}</strong>.</p>
      <p>Upload any SVG file and the bot will render a preview automatically.</p>
      </div></body></html>
    `);
  } catch (err) {
    console.error("OAuth callback error:", err);
    res.status(500).send("Installation failed");
  }
});

module.exports = router;
