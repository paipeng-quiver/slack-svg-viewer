# Quiver SVG Viewer for Slack

A public multi-tenant Slack app that automatically renders SVG file previews and integrates with [Quiver](https://quiver.app) for editing.

## Features

- **Instant SVG Previews** — Upload an SVG, get a PNG preview in-channel
- **Zoom** — View a high-res 2048px render in a modal
- **Edit with Quiver** — One-click to open in Quiver's SVG editor
- **Multi-tenant** — Any workspace can install via "Add to Slack"

## Setup

### 1. Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App**
2. Under **OAuth & Permissions**, add bot scopes: `files:read`, `files:write`, `chat:write`, `commands`, `im:write`
3. Under **Event Subscriptions**, enable events and set Request URL to `https://your-domain.com/slack/events`
4. Subscribe to bot event: `file_shared`
5. Under **Interactivity**, enable and set URL to `https://your-domain.com/slack/interactions`
6. Under **OAuth & Permissions**, add redirect URL: `https://your-domain.com/auth/callback`
7. Note your **Client ID**, **Client Secret**, and **Signing Secret**

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Slack app credentials
```

| Variable | Description |
|----------|-------------|
| `SLACK_CLIENT_ID` | Slack app client ID |
| `SLACK_CLIENT_SECRET` | Slack app client secret |
| `SLACK_SIGNING_SECRET` | Slack app signing secret |
| `APP_URL` | Public base URL (e.g. `https://svg-viewer.quiver.app`) |
| `PORT` | Server port (default: 3000) |

### 3. Run

```bash
npm install
npm start
```

### Docker

```bash
docker compose up -d
```

### Railway

Click **Deploy on Railway** or connect your repo. Environment variables are configured in Railway's dashboard.

### Vercel

```bash
vercel --prod
```

> **Note:** On Vercel (serverless), `better-sqlite3` won't work natively. You'll need to swap `db.js` to use Vercel KV, Turso, or another serverless-compatible store.

## Architecture

```
app.js          — Express server, route wiring
auth.js         — OAuth install + callback
verify.js       — Slack request signature verification
slack.js        — Event handlers, SVG→PNG rendering
db.js           — SQLite team token storage
views/index.html — Landing page with "Add to Slack"
```

## License

MIT
