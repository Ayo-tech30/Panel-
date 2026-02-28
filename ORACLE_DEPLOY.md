# 🌩️ Oracle Cloud Free Tier — Deployment Guide

> **Admin credentials**  
> Email: `ibraheemyakub48@gmail.com`  
> Password: `ibraheem123`

---

## Step 1 — Create Your Oracle Account

1. Go to → **[cloud.oracle.com/free](https://cloud.oracle.com/free)**
2. Click **Start for free**
3. Fill in details — use a real credit card (it's required for identity, you won't be charged)
4. Choose your **Home Region** — pick one close to you (e.g. UK South, Frankfurt, US East) — **cannot be changed later**
5. Wait for account activation email (~5-15 minutes)

---

## Step 2 — Create a Free VM Instance

1. Login to [cloud.oracle.com](https://cloud.oracle.com)
2. Click the **hamburger menu (☰)** → **Compute** → **Instances**
3. Click **Create Instance**

### Settings to configure:
| Setting | Value |
|---------|-------|
| **Name** | `whatsapp-panel` |
| **Image** | Canonical Ubuntu 22.04 (click "Change Image") |
| **Shape** | `VM.Standard.A1.Flex` ← **ARM, Always Free** |
| **OCPUs** | 1 (free allowance is 4 total, 1 is enough) |
| **Memory** | 6 GB (free allowance is 24GB total) |
| **Boot volume** | 50 GB (free allowance is 200GB) |

### SSH Key (important!):
- Select **Generate a key pair for me**
- Click **Save private key** → saves `ssh-key-XXXX.key` to your computer
- Keep this file safe — it's your only way to SSH in

4. Click **Create** — VM will be **Running** in ~2 minutes

---

## Step 3 — Open Firewall Ports in Oracle Console

Oracle has **two firewalls** — you must open both:

### A) Security List (Oracle's cloud firewall)
1. Go to your instance → click the **VCN name** link
2. Click **Security Lists** → **Default Security List**
3. Click **Add Ingress Rules** and add these 3 rules:

| Source CIDR | Protocol | Port |
|------------|----------|------|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |
| `0.0.0.0/0` | TCP | `3001` |

Click **Add Ingress Rules** to save.

> Port 22 (SSH) should already be open by default.

---

## Step 4 — Connect via SSH

```bash
# On your local machine (Mac/Linux terminal):
chmod 400 ssh-key-XXXX.key

ssh -i ssh-key-XXXX.key ubuntu@YOUR_VM_PUBLIC_IP

# Your VM's public IP is shown on the instance detail page
# Example: ssh -i ssh-key-2024-01.key ubuntu@132.145.22.88
```

**Windows users**: Use [PuTTY](https://www.putty.org/) or Windows Terminal with the above command.

---

## Step 5 — Upload and Run the Setup Script

### Option A: Upload the zip (easiest)
```bash
# From your LOCAL terminal (not SSH):
scp -i ssh-key-XXXX.key whatsapp-panel.zip ubuntu@YOUR_IP:~/

# Then in the SSH session:
sudo apt install unzip -y
unzip whatsapp-panel.zip
cd whatsapp-panel
chmod +x oracle-setup.sh
./oracle-setup.sh
```

### Option B: SCP the folder directly
```bash
# From your LOCAL terminal:
scp -i ssh-key-XXXX.key -r whatsapp-panel/ ubuntu@YOUR_IP:~/
```

---

## Step 6 — Run the Automated Setup

```bash
# Inside SSH session, from the project folder:
chmod +x oracle-setup.sh
./oracle-setup.sh
```

The script will automatically:
- ✅ Install Node.js 20, PM2, nginx, certbot
- ✅ Open OS-level firewall ports
- ✅ Create `.env` with your credentials
- ✅ Install all npm dependencies
- ✅ Build the Next.js frontend
- ✅ Configure nginx as reverse proxy
- ✅ Start backend + frontend with PM2
- ✅ Set PM2 to auto-start on reboot

**This takes about 3-5 minutes.**

When done, you'll see:
```
════════════════════════════════════════════════════════
✅  SETUP COMPLETE
════════════════════════════════════════════════════════

🌐 Panel URL:   http://132.145.22.88
🔌 Backend API: http://132.145.22.88:3001
📧 Admin:       ibraheemyakub48@gmail.com
🔑 Password:    ibraheem123
```

Open the URL in your browser — you're live! 🎉

---

## Step 7 — (Optional) Set Up a Domain + HTTPS

If you have a domain name:

### Point DNS to your Oracle IP
Add an **A record** in your domain's DNS settings:
```
Type: A
Name: panel   (or @ for root domain)
Value: YOUR_ORACLE_VM_IP
TTL: 300
```

### Edit the setup script before running
Open `oracle-setup.sh` and change:
```bash
DOMAIN=""   →   DOMAIN="panel.yourdomain.com"
```

### Or get SSL after setup:
```bash
# SSH into VM, then:
sudo certbot --nginx -d panel.yourdomain.com

# Certbot auto-renews — test with:
sudo certbot renew --dry-run
```

---

## Managing Your Panel

```bash
# SSH into VM, then:

pm2 status                    # See all running processes
pm2 logs panel-backend        # Backend logs (live)
pm2 logs panel-frontend       # Frontend logs
pm2 restart panel-backend     # Restart backend
pm2 restart all               # Restart everything
pm2 monit                     # Live CPU/RAM dashboard

# If you update the project files:
cd /opt/whatsapp-panel/frontend && npm run build
pm2 restart all
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Can't open the URL | Check Oracle Security List has ports 80/443 open (Step 3) |
| SSH connection refused | Check port 22 is in Security List |
| Panel loads but API fails | Check backend is running: `pm2 status` |
| WebSocket won't connect | Ensure nginx `/ws/` location block is present |
| Bots crashing | Run `pm2 logs bot-<id>` to see error |
| VM runs out of RAM | Use `pm2 monit` — 6GB is enough for ~20 bots |
| `better-sqlite3` error | Run: `cd /opt/whatsapp-panel/backend && npm rebuild` |

---

## VM Specs You're Getting (Free, Forever)

```
CPU:     1 ARM Ampere vCPU (upgradeable to 4 free)
RAM:     6 GB  (upgradeable to 24GB free)
Disk:    50 GB SSD
Network: 10 Gbps
Traffic: 10 TB/month outbound FREE
IP:      Static public IPv4
OS:      Ubuntu 22.04 LTS
```

This is more than enough to run the panel + 10-20 WhatsApp bots simultaneously.
