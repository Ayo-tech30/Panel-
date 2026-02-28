// ecosystem.config.js — PM2 process definitions for the panel itself
// (Bot processes are spawned dynamically by pm2Manager.js — this manages the panel servers)

module.exports = {
  apps: [
    {
      name: 'panel-backend',
      script: 'server.js',
      cwd: '/opt/whatsapp-panel/backend',
      env_file: '/opt/whatsapp-panel/.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      error_file: '/opt/whatsapp-panel/logs/backend-err.log',
      out_file: '/opt/whatsapp-panel/logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      name: 'panel-frontend',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/opt/whatsapp-panel/frontend',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '400M',
      error_file: '/opt/whatsapp-panel/logs/frontend-err.log',
      out_file: '/opt/whatsapp-panel/logs/frontend-out.log',
    },
  ],
};
