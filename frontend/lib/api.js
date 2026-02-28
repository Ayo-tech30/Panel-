// frontend/lib/api.js
// Centralized API client with JWT injection

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  register: (email, password) => request('/auth/register', { method: 'POST', body: { email, password } }),
  me: () => request('/auth/me'),

  // Bots
  listBots: () => request('/bots'),
  createBot: (data) => request('/bots', { method: 'POST', body: data }),
  getBot: (id) => request(`/bots/${id}`),
  deleteBot: (id) => request(`/bots/${id}`, { method: 'DELETE' }),

  startBot: (id) => request(`/bots/${id}/start`, { method: 'POST' }),
  stopBot: (id) => request(`/bots/${id}/stop`, { method: 'POST' }),
  restartBot: (id) => request(`/bots/${id}/restart`, { method: 'POST' }),

  setEnvVars: (id, vars) => request(`/bots/${id}/env`, { method: 'PUT', body: vars }),
  deleteEnvVar: (id, key) => request(`/bots/${id}/env/${key}`, { method: 'DELETE' }),
  approveBot: (id) => request(`/bots/${id}/approve`, { method: 'POST' }),

  // Admin
  listUsers: () => request('/admin/users'),
  toggleUser: (id) => request(`/admin/users/${id}/toggle`, { method: 'PATCH' }),
  auditLogs: () => request('/admin/logs'),
};

export function getWsUrl(botId) {
  const base = (BASE || 'http://localhost:3001').replace(/^http/, 'ws');
  const token = getToken();
  return `${base}/ws/logs?botId=${botId}&token=${token}`;
}
