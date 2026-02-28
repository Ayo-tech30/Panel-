// backend/controllers/botController.js
// Create, list, start, stop, restart bots
// Also handles env var management and GitHub bot setup

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const db = require('../database');
const pm2Manager = require('../services/pm2Manager');

const BOTS_DIR = path.join(__dirname, '../../bots');
const SESSIONS_DIR = path.join(__dirname, '../../sessions');

// ─── LIST ──────────────────────────────────────────────────────────────────────

async function listBots(req, res) {
  const isAdmin = req.user.role === 'admin';
  const bots = isAdmin
    ? db.prepare('SELECT b.*, u.email as owner_email FROM bots b JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC').all()
    : db.prepare('SELECT * FROM bots WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);

  // Merge live PM2 status
  const processes = await pm2Manager.listProcesses();
  const enriched = bots.map(bot => {
    const pm2Info = processes[`bot-${bot.id}`] || {};
    return {
      ...bot,
      pm2_status: pm2Info.status || 'stopped',
      memory: pm2Info.memory,
      cpu: pm2Info.cpu,
      restarts: pm2Info.restarts,
    };
  });

  res.json(enriched);
}

// ─── CREATE ────────────────────────────────────────────────────────────────────

async function createBot(req, res) {
  const { name, source, github_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Bot name required' });
  if (!['template', 'github'].includes(source)) return res.status(400).json({ error: 'Source must be template or github' });
  if (source === 'github' && !github_url) return res.status(400).json({ error: 'GitHub URL required for github source' });

  // GitHub bots need admin approval unless requester is admin
  const approved = source === 'template' ? 1 : (req.user.role === 'admin' ? 1 : 0);

  const id = uuidv4();
  const sessionPath = path.join(SESSIONS_DIR, id);
  fs.mkdirSync(sessionPath, { recursive: true });

  db.prepare(`
    INSERT INTO bots (id, user_id, name, source, github_url, status, session_path, approved)
    VALUES (?, ?, ?, ?, ?, 'stopped', ?, ?)
  `).run(id, req.user.id, name, source, github_url || null, sessionPath, approved);

  // If github source and approved, clone the repo
  if (source === 'github' && approved) {
    await cloneGithubRepo(id, github_url);
  } else if (source === 'template') {
    // Copy template to bot directory
    copyTemplate(id);
  }

  db.prepare('INSERT INTO audit_logs (user_id, action, target_id) VALUES (?, ?, ?)').run(req.user.id, 'create_bot', id);
  res.json(db.prepare('SELECT * FROM bots WHERE id = ?').get(id));
}

async function cloneGithubRepo(botId, url) {
  const destDir = path.join(BOTS_DIR, botId);
  fs.mkdirSync(destDir, { recursive: true });
  try {
    const git = simpleGit();
    await git.clone(url, destDir, ['--depth=1']);
  } catch (err) {
    console.error(`[Bot] Failed to clone ${url}:`, err.message);
  }
}

function copyTemplate(botId) {
  const templateDir = path.join(BOTS_DIR, 'templates/basic');
  const destDir = path.join(BOTS_DIR, botId);
  fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(templateDir)) {
    fs.cpSync(templateDir, destDir, { recursive: true });
  }
}

// ─── GET ONE ───────────────────────────────────────────────────────────────────

async function getBot(req, res) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  if (bot.user_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const envVars = db.prepare('SELECT key, value FROM env_vars WHERE bot_id = ?').all(bot.id);
  const processes = await pm2Manager.listProcesses();
  const pm2Info = processes[`bot-${bot.id}`] || {};

  res.json({ ...bot, env_vars: envVars, pm2_status: pm2Info.status, memory: pm2Info.memory, cpu: pm2Info.cpu });
}

// ─── CONTROLS ─────────────────────────────────────────────────────────────────

async function startBot(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  if (!bot.approved) return res.status(403).json({ error: 'Bot pending approval' });
  try {
    await pm2Manager.startBot(bot);
    db.prepare('INSERT INTO audit_logs (user_id, action, target_id) VALUES (?, ?, ?)').run(req.user.id, 'start_bot', bot.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function stopBot(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  try {
    await pm2Manager.stopBot(bot.id);
    db.prepare('INSERT INTO audit_logs (user_id, action, target_id) VALUES (?, ?, ?)').run(req.user.id, 'stop_bot', bot.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function restartBot(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  try {
    await pm2Manager.restartBot(bot.id);
    res.json({ ok: true });
  } catch (err) {
    // If not running, start it
    await pm2Manager.startBot(bot);
    res.json({ ok: true, note: 'Started (was not running)' });
  }
}

async function deleteBot(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  try { await pm2Manager.stopBot(bot.id); } catch {}
  db.prepare('DELETE FROM bots WHERE id = ?').run(bot.id);
  // Clean up files
  [path.join(BOTS_DIR, bot.id), path.join(SESSIONS_DIR, bot.id)].forEach(d => {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  });
  res.json({ ok: true });
}

// ─── ENV VARS ──────────────────────────────────────────────────────────────────

function setEnvVars(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });

  const vars = req.body; // { KEY: 'value', ... }
  const upsert = db.prepare('INSERT OR REPLACE INTO env_vars (bot_id, key, value) VALUES (?, ?, ?)');
  const tx = db.transaction((vars) => {
    for (const [key, value] of Object.entries(vars)) {
      if (/^[A-Z_][A-Z0-9_]*$/.test(key)) upsert.run(bot.id, key, String(value));
    }
  });
  tx(vars);
  res.json({ ok: true });
}

function deleteEnvVar(req, res) {
  const bot = getOwnedBot(req);
  if (!bot) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM env_vars WHERE bot_id = ? AND key = ?').run(bot.id, req.params.key);
  res.json({ ok: true });
}

// ─── ADMIN: APPROVE GITHUB BOT ────────────────────────────────────────────────

async function approveBot(req, res) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.id);
  if (!bot) return res.status(404).json({ error: 'Bot not found' });
  db.prepare('UPDATE bots SET approved = 1 WHERE id = ?').run(bot.id);
  if (bot.source === 'github' && bot.github_url) {
    await cloneGithubRepo(bot.id, bot.github_url);
  }
  res.json({ ok: true });
}

// ─── HELPERS ───────────────────────────────────────────────────────────────────

function getOwnedBot(req) {
  const bot = db.prepare('SELECT * FROM bots WHERE id = ?').get(req.params.id);
  if (!bot) return null;
  if (bot.user_id !== req.user.id && req.user.role !== 'admin') return null;
  return bot;
}

module.exports = { listBots, createBot, getBot, startBot, stopBot, restartBot, deleteBot, setEnvVars, deleteEnvVar, approveBot };
