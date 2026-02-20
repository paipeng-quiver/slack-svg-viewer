const crypto = require("crypto");

/**
 * Express middleware to verify Slack request signatures.
 * Buffers raw body and validates HMAC-SHA256.
 */
function verifySlackRequest(req, res, next) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    console.error("SLACK_SIGNING_SECRET not set");
    return res.status(500).send("Server misconfigured");
  }

  const timestamp = req.headers["x-slack-request-timestamp"];
  const slackSig = req.headers["x-slack-signature"];

  if (!timestamp || !slackSig) {
    return res.status(400).send("Missing Slack headers");
  }

  // Reject requests older than 5 minutes
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return res.status(400).send("Request too old");
  }

  const sigBasestring = `v0:${timestamp}:${req.rawBody}`;
  const hmac = crypto.createHmac("sha256", signingSecret);
  hmac.update(sigBasestring);
  const computed = `v0=${hmac.digest("hex")}`;

  if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(slackSig))) {
    return res.status(401).send("Invalid signature");
  }

  next();
}

module.exports = { verifySlackRequest };
