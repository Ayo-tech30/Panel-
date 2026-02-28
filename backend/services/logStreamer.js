// backend/services/logStreamer.js
// Streams bot log files to connected WebSocket clients in real-time
// Uses fs.watch + tail logic (no additional dependencies)

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../../logs');

/**
 * Setup WebSocket server for log streaming
 * Protocol:
 *   Client sends: { type: 'subscribe', botId: '<id>', token: '<jwt>' }
 *   Server sends: { type: 'log', line: '<text>' }
 *               | { type: 'error', message: '...' }
 */
function setupLogWebSocket(wss, verifyToken) {
  wss.on('connection', (ws) => {
    let watcher = null;
    let fd = null;
    let botId = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());

        if (msg.type === 'subscribe') {
          // Verify JWT
          let user;
          try { user = verifyToken(msg.token); }
          catch { return ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized' })); }

          botId = msg.botId;
          const logFile = path.join(LOGS_DIR, `${botId}.log`);

          // Ensure log file exists
          if (!fs.existsSync(logFile)) fs.writeFileSync(logFile, '');

          // Send last 100 lines (history)
          try {
            const content = fs.readFileSync(logFile, 'utf8');
            const lines = content.split('\n').filter(Boolean).slice(-100);
            lines.forEach(line => ws.send(JSON.stringify({ type: 'log', line })));
          } catch {}

          // Watch for new content
          let lastSize = fs.statSync(logFile).size;
          watcher = fs.watch(logFile, () => {
            try {
              const stat = fs.statSync(logFile);
              if (stat.size > lastSize) {
                const buf = Buffer.alloc(stat.size - lastSize);
                const filefd = fs.openSync(logFile, 'r');
                fs.readSync(filefd, buf, 0, buf.length, lastSize);
                fs.closeSync(filefd);
                lastSize = stat.size;
                const newLines = buf.toString('utf8').split('\n').filter(Boolean);
                newLines.forEach(line => {
                  if (ws.readyState === 1) ws.send(JSON.stringify({ type: 'log', line }));
                });
              }
            } catch {}
          });
        }
      } catch {}
    });

    ws.on('close', () => {
      if (watcher) watcher.close();
    });
  });
}

module.exports = { setupLogWebSocket };
