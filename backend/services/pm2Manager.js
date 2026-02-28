// backend/services/pm2Manager.js
// Manages bot processes via PM2 programmatic API
// Each bot runs as a separate PM2 process named `bot-<id>`

const pm2 = require('pm2');
const path = require('path');
const fs = require('fs');
const db = require('../database');

const BOTS_DIR = path.join(__dirname, '../../bots');
const SESSIONS_DIR = path.join(__dirname, '../../sessions');
const LOGS_DIR = path.join(__dirname, '../../logs');

// Ensure directories exist
[BOTS_DIR, SESSIONS_DIR, LOGS_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// Connect PM2 once at startup (non-daemon mode for Replit)
let pm2Connected = false;
function connectPM2() {
  return new Promise((resolve, reject) => {
    if (pm2Connected) return resolve();
    pm2.connect(true, (err) => { // true = no daemon
      if (err) return reject(err);
      pm2Connected = true;
      resolve();
    });
  });
}

/**
 * Start a bot process
 * @param {Object} bot - bot row from DB
 */
async function startBot(bot) {
  await connectPM2();

  const sessionDir = path.join(SESSIONS_DIR, bot.id);
  fs.mkdirSync(sessionDir, { recursive: true });

  const logFile = path.join(LOGS_DIR, `${bot.id}.log`);
  const botScript = path.join(BOTS_DIR, bot.id, 'index.js');

  // Fallback to template if bot script doesn't exist
  const scriptPath = fs.existsSync(botScript)
    ? botScript
    : path.join(BOTS_DIR, 'templates/basic/index.js');

  // Load env vars for this bot
  const envRows = db.prepare('SELECT key, value FROM env_vars WHERE bot_id = ?').all(bot.id);
  const env = {};
  envRows.forEach(r => { env[r.key] = r.value; });
  env.BOT_ID = bot.id;
  env.SESSION_DIR = sessionDir;
  env.MAX_MSG_RATE = String(bot.max_msg_rate || 20);

  return new Promise((resolve, reject) => {
    pm2.start({
      name: `bot-${bot.id}`,
      script: scriptPath,
      cwd: path.dirname(scriptPath),
      env,
      max_memory_restart: '200M',     // soft memory limit
      restart_delay: 5000,            // wait 5s before restart on crash
      max_restarts: 10,
      autorestart: true,
      log_file: logFile,
      error_file: logFile,
      merge_logs: true,
      watch: false,
    }, (err, proc) => {
      if (err) return reject(err);
      db.prepare(`UPDATE bots SET status = 'running' WHERE id = ?`).run(bot.id);
      resolve(proc);
    });
  });
}

/**
 * Stop a bot process
 */
async function stopBot(botId) {
  await connectPM2();
  return new Promise((resolve) => {
    pm2.stop(`bot-${botId}`, () => {
      pm2.delete(`bot-${botId}`, () => {
        db.prepare(`UPDATE bots SET status = 'stopped' WHERE id = ?`).run(botId);
        resolve();
      });
    });
  });
}

/**
 * Restart a bot process
 */
async function restartBot(botId) {
  await connectPM2();
  return new Promise((resolve, reject) => {
    pm2.restart(`bot-${botId}`, (err) => {
      if (err) return reject(err);
      db.prepare(`UPDATE bots SET status = 'running' WHERE id = ?`).run(botId);
      resolve();
    });
  });
}

/**
 * Get live status of all running bot processes
 * Returns a map: { [name]: { status, memory, cpu, restarts } }
 */
async function listProcesses() {
  await connectPM2();
  return new Promise((resolve) => {
    pm2.list((err, list) => {
      if (err) return resolve({});
      const map = {};
      list.forEach(p => {
        map[p.name] = {
          status: p.pm2_env?.status,
          memory: p.monit?.memory,
          cpu: p.monit?.cpu,
          restarts: p.pm2_env?.restart_time,
          uptime: p.pm2_env?.pm_uptime,
        };
      });
      resolve(map);
    });
  });
}

module.exports = { startBot, stopBot, restartBot, listProcesses };
