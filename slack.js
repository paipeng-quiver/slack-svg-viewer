const { WebClient } = require("@slack/web-api");
const { Resvg } = require("@resvg/resvg-js");
const { getTeam } = require("./db");

// Cache WebClient instances per team
const clients = new Map();

function getClient(teamId) {
  if (clients.has(teamId)) return clients.get(teamId);
  const team = getTeam.get(teamId);
  if (!team) return null;
  const client = new WebClient(team.bot_token);
  clients.set(teamId, client);
  return client;
}

// Invalidate cache on reinstall
function clearClient(teamId) {
  clients.delete(teamId);
}

// ── Helpers ──────────────────────────────────────────────────────────

async function fetchSvgFile(url, token) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch SVG: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function svgToPng(svgBuffer, width = 1024) {
  const resvg = new Resvg(svgBuffer, {
    fitTo: { mode: "width", value: width },
    background: "white",
  });
  return resvg.render().asPng();
}

// ── Event Handlers ───────────────────────────────────────────────────

async function handleFileShared(event, teamId) {
  const client = getClient(teamId);
  if (!client) {
    console.error(`No token for team ${teamId}`);
    return;
  }

  const team = getTeam.get(teamId);

  try {
    const result = await client.files.info({ file: event.file_id });
    const file = result.file;

    // Only handle SVG files
    if (file.mimetype !== "image/svg+xml" && !file.name?.endsWith(".svg")) {
      return;
    }

    console.log(`Processing SVG: ${file.name} (${file.id}) for team ${teamId}`);

    const svgBuffer = await fetchSvgFile(file.url_private, team.bot_token);
    const pngBuffer = svgToPng(svgBuffer);

    const quiverUrl = `https://quiver.app/edit?import=${encodeURIComponent(file.url_private)}`;
    const channel = event.channel_id;

    // Upload PNG preview
    await client.files.uploadV2({
      channel_id: channel,
      file: pngBuffer,
      filename: file.name.replace(/\.svg$/i, "_preview.png"),
      title: `Preview: ${file.name}`,
      thread_ts: event.event_ts || undefined,
    });

    // Post message with buttons
    await client.chat.postMessage({
      channel,
      thread_ts: event.event_ts || undefined,
      text: `SVG Preview: ${file.name}`,
      blocks: [
        {
          type: "section",
          text: { type: "mrkdwn", text: `🖼️ *SVG Preview:* \`${file.name}\`` },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✏️ Edit with Quiver" },
              url: quiverUrl,
              style: "primary",
              action_id: "edit_quiver",
            },
            {
              type: "button",
              text: { type: "plain_text", text: "🔍 Zoom" },
              action_id: "zoom_svg",
              value: file.id,
            },
          ],
        },
      ],
    });

    console.log(`Posted preview for ${file.name}`);
  } catch (err) {
    console.error("Error processing SVG:", err);
  }
}

async function handleInteraction(payload) {
  if (payload.type === "block_actions") {
    for (const action of payload.actions) {
      if (action.action_id === "zoom_svg") {
        await handleZoom(payload, action.value);
      }
      // edit_quiver is a link button — no server handling needed
    }
  }
}

async function handleZoom(payload, fileId) {
  const teamId = payload.team?.id || payload.user?.team_id;
  const client = getClient(teamId);
  if (!client) return;

  const team = getTeam.get(teamId);

  try {
    const result = await client.files.info({ file: fileId });
    const file = result.file;

    const svgBuffer = await fetchSvgFile(file.url_private, team.bot_token);
    const pngBuffer = svgToPng(svgBuffer, 2048);

    // Upload zoomed version to user's DM for URL
    const upload = await client.files.uploadV2({
      channel_id: payload.user.id,
      file: pngBuffer,
      filename: file.name.replace(/\.svg$/i, "_zoom.png"),
      title: `Zoom: ${file.name}`,
    });

    const quiverUrl = `https://quiver.app/edit?import=${encodeURIComponent(file.url_private)}`;

    const imageUrl =
      upload.files?.[0]?.files?.[0]?.url_private ||
      upload.file?.url_private ||
      "https://via.placeholder.com/800";

    await client.views.open({
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        title: { type: "plain_text", text: "SVG Zoom" },
        blocks: [
          {
            type: "image",
            image_url: imageUrl,
            alt_text: file.name,
            title: { type: "plain_text", text: file.name },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: "Rendered at 2048px width" },
            accessory: {
              type: "button",
              text: { type: "plain_text", text: "✏️ Edit with Quiver" },
              url: quiverUrl,
              action_id: "edit_quiver_modal",
            },
          },
        ],
      },
    });
  } catch (err) {
    console.error("Zoom modal error:", err);
  }
}

module.exports = { handleFileShared, handleInteraction, clearClient };
