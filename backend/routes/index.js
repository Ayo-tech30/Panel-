// backend/routes/index.js
// Central router: auth + bot routes

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ─── Auth ─────────────────────────────────────────────────────────────────────
const auth = require('../controllers/authController');
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);

// ─── Bots ─────────────────────────────────────────────────────────────────────
const bot = require('../controllers/botController');
router.get('/bots', requireAuth, bot.listBots);
router.post('/bots', requireAuth, bot.createBot);
router.get('/bots/:id', requireAuth, bot.getBot);
router.delete('/bots/:id', requireAuth, bot.deleteBot);

// Bot controls
router.post('/bots/:id/start', requireAuth, bot.startBot);
router.post('/bots/:id/stop', requireAuth, bot.stopBot);
router.post('/bots/:id/restart', requireAuth, bot.restartBot);

// Env vars
router.put('/bots/:id/env', requireAuth, bot.setEnvVars);
router.delete('/bots/:id/env/:key', requireAuth, bot.deleteEnvVar);

// Admin-only
router.post('/bots/:id/approve', requireAuth, requireAdmin, bot.approveBot);

// ─── Admin: Users list ────────────────────────────────────────────────────────
const db = require('../database');
router.get('/admin/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, role, created_at, active FROM users ORDER BY created_at DESC').all();
  res.json(users);
});
router.patch('/admin/users/:id/toggle', requireAuth, requireAdmin, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE users SET active = ? WHERE id = ?').run(user.active ? 0 : 1, user.id);
  res.json({ ok: true });
});

// ─── Audit logs ───────────────────────────────────────────────────────────────
router.get('/admin/logs', requireAuth, requireAdmin, (req, res) => {
  const logs = db.prepare(`
    SELECT a.*, u.email FROM audit_logs a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.created_at DESC LIMIT 200
  `).all();
  res.json(logs);
});

module.exports = router;
