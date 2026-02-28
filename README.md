# 🤖 WhatsApp Bot Panel — Complete MVP

Private WhatsApp bot hosting dashboard. Dark-mode, JWT auth, PM2 process management, live log streaming, Baileys-powered bots.

---

## 📁 Folder Structure

```
whatsapp-panel/
├── backend/                    # Express API server
│   ├── controllers/            # Route handlers (auth, bots)
│   ├── middleware/             # JWT auth middleware
│   ├── routes/                 # Express routers
│   ├── services/               # PM2 manager + WebSocket log streamer
│   ├── database.js             # SQLite schema + admin seed
│   └── server.js               # Entry point: Express + WebSocket
│
├── frontend/                   # Next.js 14 dashboard
│   ├── components/             # Layout, StatusBadge
│   ├── lib/                    # API client, auth context
│   ├── pages/                  # Next.js pages
│   │   ├── index.js            # Dashboard (bot list)
│   │   ├── login.js            # Login/register
│   │   ├── logs.js             # Live log viewer
│   │   └── bots/[id].js        # Bot detail + env vars
│   └── styles/globals.css      # Tailwind + custom CSS
│
├── bots/
│   └── templates/basic/        # Baileys bot template
│       ├── index.js            # Bot code (pairing code, commands)
│       └── package.json
│
├── sessions/                   # Per-bot WhatsApp session files (auto-created)
├── logs/                       # Per-bot log files (auto-created)
├── data/panel.db               # SQLite database (auto-created)
├── .env.example                # Environment variable template
├── start.sh                    # Replit startup script
└── .replit                     # Replit config
```

---

## 🗄️ Database Schema

```sql
users       → id, email, password(bcrypt), role(admin/user), active, created_at
bots        → id(UUID), user_id, name, source, github_url, status, phone, session_path, approved, max_msg_rate
env_vars    → id, bot_id, key, value (per-bot environment variables)
audit_logs  → id, user_id, action, target_id, created_at
```

---

## 🚀 Replit Setup (Step-by-Step)

### 1. Create Replit Project
- Go to replit.com → New Repl → "Import from GitHub" or paste files
- Choose **Node.js** as the template
- Language: Node.js 20+

### 2. Set Secrets (Replit Secrets tab)
```
JWT_SECRET        = your-very-long-random-secret-here
ADMIN_PASSWORD    = YourSecureAdminPass@123
FRONTEND_URL      = https://your-repl-name.your-username.repl.co
NEXT_PUBLIC_API_URL = https://your-repl-name.your-username.repl.co:3001
```

### 3. First Run
```bash
# In Replit Shell:
chmod +x start.sh
bash start.sh
```

This will:
- Install all dependencies (backend, frontend, bot template)
- Build the Next.js frontend
- Start both servers

### 4. Login
- Open the Replit webview (port 3000)
- Login with: `ibraheemyakub48@gmail.com` / `Admin@1234`
- **Change password immediately** via a future settings page or directly in DB

### 5. Create Your First Bot
1. Click **New Bot** on Dashboard
2. Choose **Template** source, give it a name
3. Go to Bot Detail → add env var `PHONE_NUMBER` = your number (no + or spaces, e.g. `15551234567`)
4. Click **Start Bot**
5. Open Logs page → watch for `PAIRING CODE: XXXX-XXXX`
6. Open WhatsApp → Linked Devices → Link with phone number → enter code

---

## 🔧 Local Development Setup

```bash
# Clone / copy project files

# Install dependencies
cd backend && npm install
cd ../frontend && npm install  
cd ../bots/templates/basic && npm install

# Copy env
cp .env.example .env
# Edit .env with your values

# Run backend (terminal 1)
cd backend && node server.js

# Run frontend (terminal 2)
cd frontend && npm run dev

# Open: http://localhost:3000
```

---

## 🔌 API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | `{ email, password }` → `{ token, user }` |
| POST | `/api/auth/register` | `{ email, password }` → `{ token, user }` |
| GET  | `/api/auth/me` | Returns current user |

### Bots
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bots` | List user's bots |
| POST | `/api/bots` | Create bot `{ name, source, github_url? }` |
| GET | `/api/bots/:id` | Get bot with env vars |
| DELETE | `/api/bots/:id` | Delete bot + stop process |
| POST | `/api/bots/:id/start` | Start bot via PM2 |
| POST | `/api/bots/:id/stop` | Stop bot |
| POST | `/api/bots/:id/restart` | Restart bot |
| PUT | `/api/bots/:id/env` | Set env vars `{ KEY: 'value' }` |
| DELETE | `/api/bots/:id/env/:key` | Remove env var |
| POST | `/api/bots/:id/approve` | Admin: approve GitHub bot |

### WebSocket: Log Streaming
```
ws://localhost:3001/ws/logs

Client → { type: 'subscribe', botId: '<id>', token: '<jwt>' }
Server → { type: 'log', line: '...' }
       | { type: 'error', message: '...' }
```

---

## 🔐 Security Model

### What's Protected
| Threat | Mitigation |
|--------|-----------|
| Unauthenticated access | JWT required on all API endpoints |
| Brute force login | Rate limiter: 10 req/min on `/api/auth` |
| Arbitrary code via GitHub | Admin must approve + review repos manually |
| Bot escaping its env | PM2 isolates processes, no shell injection in config |
| Env var exposure | Values masked in UI by default |
| Admin account | Hardcoded email seed, cannot be disabled by toggleUser |
| XSS | Next.js escapes React output; no dangerouslySetInnerHTML |
| CORS | Restricted to your FRONTEND_URL only |
| DDoS | express-rate-limit + helmet headers |
| Log injection | Logs are display-only (not executed) |

### Known Limitations (Private Use Context)
- No email verification on register — add allowlist if needed
- Sessions stored as plaintext files — acceptable for personal use
- PM2 `--no-daemon` mode on Replit may have edge cases — test restarts

---

## 🤖 Bot Template: Adding Commands

Edit `bots/templates/basic/index.js` — the `switch(command)` block:

```js
case 'weather':
  const city = args.join(' ');
  // call weather API...
  await sock.sendMessage(jid, { text: `Weather in ${city}: 25°C ☀️` });
  break;
```

### Pairing Code Flow
1. Set env var `PHONE_NUMBER` = your number (no + or spaces)
2. Start bot
3. Watch logs for `PAIRING CODE: XXXX-XXXX`
4. WhatsApp → Settings → Linked Devices → Link with phone number

### QR Code Flow
1. Set env var `USE_QR=true`
2. Start bot
3. Watch logs for `QR_DATA:...` line — paste data into a QR generator
   (or use a QR scanner on the raw text from logs)

---

## 📊 PM2 Resource Limits

Each bot process has these limits configured:
- **Memory**: 200MB soft limit (auto-restart if exceeded)
- **Restarts**: Max 10 before giving up
- **Restart delay**: 5 seconds
- **Rate limit**: Configurable per bot via `max_msg_rate` (default: 20 msg/min)

---

## 🐳 VPS + Docker Migration Guide

### When to migrate from Replit
- Need persistent storage (Replit sleeps on free tier)
- High message volume (>1000 msg/day)
- Multiple users with many bots
- Need custom domain

### VPS Setup (Ubuntu 22.04)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 globally
sudo npm install -g pm2

# Clone your project
git clone your-repo /opt/whatsapp-panel
cd /opt/whatsapp-panel

# Setup
cp .env.example .env
nano .env  # set JWT_SECRET, FRONTEND_URL etc

npm run install:all
cd frontend && npm run build && cd ..

# Start with PM2
pm2 start backend/server.js --name "panel-backend"
pm2 start "cd frontend && node_modules/.bin/next start -p 3000" --name "panel-frontend"
pm2 save
pm2 startup  # follow printed command

# Nginx reverse proxy (optional)
sudo apt install nginx
```

Nginx config (`/etc/nginx/sites-available/panel`):
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }

    location /api {
        proxy_pass http://localhost:3001;
    }

    location /ws {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

### Docker Compose (optional)

```yaml
# docker-compose.yml
version: '3.8'
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    volumes:
      - ./data:/app/data
      - ./sessions:/app/sessions
      - ./logs:/app/logs
      - ./bots:/app/bots
    env_file: .env
    restart: always

  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on: [backend]
    restart: always
```

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| Bot won't start | Check logs page — look for dependency errors. Run `npm install` in bot folder |
| Pairing code not appearing | Ensure `PHONE_NUMBER` env var is set (digits only, no +) and bot is running |
| WebSocket not connecting | Check CORS/FRONTEND_URL setting. Ensure backend port 3001 is accessible |
| Session expired every restart | On Replit free tier, disk persists. If sessions clear, upgrade or use VPS |
| "Bot pending approval" | Admin must go to Bot Detail → approve (for GitHub source bots) |
| PM2 max retries reached | Bot crashed too many times. Check logs for root cause |
| `better-sqlite3` build error | Run: `npm rebuild better-sqlite3` |

---

## 👤 Admin Account

- **Email**: `ibraheemyakub48@gmail.com`  
- **Default Password**: `Admin@1234` (set `ADMIN_PASSWORD` env var before first start)
- Admin can: approve GitHub bots, enable/disable users, view all bots, view audit logs
