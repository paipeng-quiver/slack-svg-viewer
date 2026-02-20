const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "teams.db");

// Ensure data directory exists
const fs = require("fs");
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS teams (
    team_id TEXT PRIMARY KEY,
    team_name TEXT,
    bot_token TEXT NOT NULL,
    bot_user_id TEXT,
    installed_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )
`);

const upsertTeam = db.prepare(`
  INSERT INTO teams (team_id, team_name, bot_token, bot_user_id, installed_at, updated_at)
  VALUES (@team_id, @team_name, @bot_token, @bot_user_id, datetime('now'), datetime('now'))
  ON CONFLICT(team_id) DO UPDATE SET
    bot_token = @bot_token,
    bot_user_id = @bot_user_id,
    team_name = @team_name,
    updated_at = datetime('now')
`);

const getTeam = db.prepare("SELECT * FROM teams WHERE team_id = ?");
const getAllTeams = db.prepare("SELECT team_id, team_name, installed_at FROM teams");

module.exports = { db, upsertTeam, getTeam, getAllTeams };
