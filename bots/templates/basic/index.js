// bots/templates/basic/index.js
// WhatsApp bot template using Baileys
// Features: pairing code auth, QR fallback, message rate limiting, auto-reconnect
// Env vars:
//   BOT_ID        - injected by panel
//   SESSION_DIR   - path to session storage
//   MAX_MSG_RATE  - messages per minute allowed to send
//   PHONE_NUMBER  - WhatsApp number for pairing code (e.g. 15551234567)
//   USE_QR        - set to 'true' to use QR code instead of pairing code
//   PREFIX        - bot command prefix (default: '!')

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
  Browsers,
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const fs = require('fs');
const path = require('path');

// ─── Config ───────────────────────────────────────────────────────────────────
const BOT_ID = process.env.BOT_ID || 'dev';
const SESSION_DIR = process.env.SESSION_DIR || path.join(__dirname, 'session');
const MAX_MSG_RATE = parseInt(process.env.MAX_MSG_RATE || '20', 10);
const PREFIX = process.env.PREFIX || '!';
const PHONE = process.env.PHONE_NUMBER;          // e.g. '15551234567'
const USE_QR = process.env.USE_QR === 'true';

fs.mkdirSync(SESSION_DIR, { recursive: true });

// ─── Rate Limiter ─────────────────────────────────────────────────────────────
// Simple sliding window per JID
const rateLimiter = new Map(); // jid -> [timestamps]
function isRateLimited(jid) {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const timestamps = (rateLimiter.get(jid) || []).filter(t => now - t < window);
  if (timestamps.length >= MAX_MSG_RATE) return true;
  timestamps.push(now);
  rateLimiter.set(jid, timestamps);
  return false;
}

// ─── Store (in-memory message cache) ─────────────────────────────────────────
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

// ─── Main ─────────────────────────────────────────────────────────────────────
let retryCount = 0;
const MAX_RETRIES = 10;

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: 'warn' }); // reduce noise; panel captures stdout anyway

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: Browsers.macOS('Desktop'),
    printQRInTerminal: USE_QR || !PHONE,
    generateHighQualityLinkPreview: false,
    markOnlineOnConnect: false,
  });

  store.bind(sock.ev);

  // ─── Auth / Connection ──────────────────────────────────────────────────────
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Pairing code: request after socket opens if not yet registered
    if (!USE_QR && PHONE && !state.creds.registered && !sock.authState?.creds?.registered) {
      if (update.isNewLogin === false || update.receivedPendingNotifications === false) return;
      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(PHONE);
          console.log(`[${BOT_ID}] PAIRING CODE: ${code}`); // panel captures this line
        } catch (err) {
          console.error(`[${BOT_ID}] Pairing code error:`, err.message);
        }
      }, 3000);
    }

    if (qr) console.log(`[${BOT_ID}] QR_DATA:${qr}`); // panel can render this

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`[${BOT_ID}] Connection closed. Status: ${statusCode}. LoggedOut: ${isLoggedOut}`);

      if (isLoggedOut) {
        console.log(`[${BOT_ID}] Logged out. Clearing session.`);
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        fs.mkdirSync(SESSION_DIR, { recursive: true });
        retryCount = 0;
        setTimeout(startBot, 3000);
        return;
      }

      if (retryCount < MAX_RETRIES) {
        retryCount++;
        const delay = Math.min(retryCount * 5000, 60000);
        console.log(`[${BOT_ID}] Reconnecting in ${delay / 1000}s (attempt ${retryCount})`);
        setTimeout(startBot, delay);
      } else {
        console.error(`[${BOT_ID}] Max retries reached. Bot stopped.`);
        process.exit(1); // PM2 will restart
      }
    }

    if (connection === 'open') {
      retryCount = 0;
      const phone = sock.user?.id?.split(':')[0];
      console.log(`[${BOT_ID}] Connected as ${phone}`);
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // ─── Messages ───────────────────────────────────────────────────────────────
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      const body = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || '';

      if (!body.startsWith(PREFIX)) continue;

      // Rate limiting check
      if (isRateLimited(jid)) {
        console.warn(`[${BOT_ID}] Rate limit hit for ${jid}`);
        continue;
      }

      const [command, ...args] = body.slice(PREFIX.length).trim().split(' ');

      console.log(`[${BOT_ID}] Command: ${command} from ${jid}`);

      // ─── Command Handlers ─────────────────────────────────────────────────
      try {
        switch (command.toLowerCase()) {
          case 'ping':
            await sock.sendMessage(jid, { text: '🏓 Pong! Bot is alive.' });
            break;

          case 'info':
            await sock.sendMessage(jid, {
              text: `🤖 *Bot Info*\nID: ${BOT_ID}\nPrefix: ${PREFIX}\nCommands: ping, info, help`
            });
            break;

          case 'help':
            await sock.sendMessage(jid, {
              text: `📖 *Commands*\n${PREFIX}ping - Check if bot is alive\n${PREFIX}info - Bot information\n${PREFIX}help - This message`
            });
            break;

          default:
            // Unknown command - optionally reply
            break;
        }
      } catch (err) {
        console.error(`[${BOT_ID}] Handler error:`, err.message);
      }
    }
  });
}

startBot().catch(err => {
  console.error(`[${BOT_ID}] Fatal error:`, err);
  process.exit(1);
});
