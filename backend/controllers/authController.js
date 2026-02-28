// backend/controllers/authController.js
// Handles register and login endpoints

const bcrypt = require('bcryptjs');
const db = require('../database');
const { signToken } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * Body: { email, password }
 * Note: First user or admin-invites only; adjust logic as needed for private use
 */
async function register(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 chars' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare('INSERT INTO users (email, password, role) VALUES (?, ?, ?)').run(email.toLowerCase(), hash, 'user');
  const user = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(result.lastInsertRowid);

  return res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role } });
}

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  // Audit log
  db.prepare('INSERT INTO audit_logs (user_id, action) VALUES (?, ?)').run(user.id, 'login');

  return res.json({ token: signToken(user), user: { id: user.id, email: user.email, role: user.role } });
}

/**
 * GET /api/auth/me
 */
function me(req, res) {
  res.json({ user: { id: req.user.id, email: req.user.email, role: req.user.role } });
}

module.exports = { register, login, me };
