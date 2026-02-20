require("dotenv").config();
const express = require("express");
const path = require("path");
const { verifySlackRequest } = require("./verify");
const authRouter = require("./auth");
const { handleFileShared, handleInteraction } = require("./slack");

const app = express();

// Capture raw body for Slack signature verification
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

// ── Landing Page ─────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "views", "index.html"));
});

// ── OAuth Routes ─────────────────────────────────────────────────────
app.use("/auth", authRouter);

// ── Slack Events ─────────────────────────────────────────────────────
app.post("/slack/events", verifySlackRequest, (req, res) => {
  const body = req.body;

  // URL verification challenge
  if (body.type === "url_verification") {
    return res.json({ challenge: body.challenge });
  }

  // Acknowledge immediately
  res.status(200).send();

  // Process event asynchronously
  if (body.type === "event_callback" && body.event) {
    const teamId = body.team_id;
    const event = body.event;

    if (event.type === "file_shared") {
      handleFileShared(event, teamId).catch((err) =>
        console.error("Event handler error:", err)
      );
    }
  }
});

// ── Slack Interactions ───────────────────────────────────────────────
app.post("/slack/interactions", verifySlackRequest, (req, res) => {
  // Acknowledge immediately
  res.status(200).send();

  try {
    const payload = JSON.parse(req.body.payload);
    handleInteraction(payload).catch((err) =>
      console.error("Interaction handler error:", err)
    );
  } catch (err) {
    console.error("Failed to parse interaction payload:", err);
  }
});

// ── Health ───────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Start ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`⚡ Quiver SVG Viewer running on port ${PORT}`);
});

module.exports = app;
