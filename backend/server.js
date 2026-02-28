// backend/server.js
// Entry point: Express + WebSocket server
// Runs on PORT 3001 (backend), frontend on 3000

require('dotenv').config({ path: '../.env' });
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const routes = require('./routes/index');
const { setupLogWebSocket } = require('./services/logStreamer');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws/logs' });

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production-secret-key-32ch';
const PORT = process.env.BACKEND_PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [FRONTEND_URL, 'http://localhost:3000'],
  credentials: true,
}));

// Global rate limit: 100 req/min per IP
app.use(rateLimit({ windowMs: 60_000, max: 100, standardHeaders: true }));

// Auth endpoints stricter: 10 req/min
app.use('/api/auth', rateLimit({ windowMs: 60_000, max: 10, message: { error: 'Too many requests' } }));

app.use(express.json({ limit: '1mb' }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', routes);

app.get('/health', (_, res) => res.json({ ok: true, time: new Date().toISOString() }));

// ─── WebSocket log streaming ───────────────────────────────────────────────────
setupLogWebSocket(wss, (token) => jwt.verify(token, JWT_SECRET));

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Backend running on port ${PORT}`);
  // Initialize DB (import triggers seed)
  require('./database');
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); process.exit(0); });
