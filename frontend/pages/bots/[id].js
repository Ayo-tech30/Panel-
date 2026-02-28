// frontend/pages/bots/[id].js
// Bot detail: env vars management, pairing code request, inline logs preview

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import Link from 'next/link';
import { ArrowLeft, Play, Square, RotateCcw, Plus, Trash2, Eye, EyeOff, ScrollText, CheckCircle } from 'lucide-react';
import { withAuth } from '../../lib/auth';
import { api, getWsUrl } from '../../lib/api';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';

function BotDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { data: bot, mutate } = useSWR(id ? `/bots/${id}` : null, () => api.getBot(id), { refreshInterval: 6000 });

  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [maskedVars, setMaskedVars] = useState(new Set());
  const [actionLoading, setActionLoading] = useState('');
  const [recentLogs, setRecentLogs] = useState([]);

  const isRunning = bot && ['online', 'running'].includes(bot.pm2_status || bot.status);

  // WebSocket: show last 15 log lines inline
  useEffect(() => {
    if (!id) return;
    const wsUrl = getWsUrl(id);
    const ws = new WebSocket(wsUrl.replace('?', '/').replace(`/${id}`, ''));
    // send subscribe after connect
    ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', botId: id, token: localStorage.getItem('token') }));
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log') setRecentLogs(prev => [...prev.slice(-14), msg.line]);
    };
    return () => ws.close();
  }, [id]);

  async function action(name) {
    setActionLoading(name);
    try {
      await api[`${name}Bot`](id);
      mutate();
    } catch (err) { alert(err.message); }
    finally { setActionLoading(''); }
  }

  async function addEnvVar(e) {
    e.preventDefault();
    if (!newKey || !newVal) return;
    await api.setEnvVars(id, { [newKey]: newVal });
    setNewKey(''); setNewVal('');
    mutate();
  }

  async function deleteVar(key) {
    await api.deleteEnvVar(id, key);
    mutate();
  }

  if (!bot) return (
    <Layout title="Bot Detail">
      <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
    </Layout>
  );

  return (
    <Layout title={bot.name}>
      {/* Back + header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/" className="btn-ghost py-1.5 px-2"><ArrowLeft className="w-4 h-4" /></Link>
        <div className="flex items-center gap-3">
          <h2 className="font-display font-semibold text-white">{bot.name}</h2>
          <StatusBadge status={bot.status} pm2Status={bot.pm2_status} />
        </div>
        <div className="flex-1" />
        {/* Controls */}
        <div className="flex gap-2">
          {isRunning ? (
            <>
              <button onClick={() => action('stop')} disabled={!!actionLoading} className="btn-ghost flex items-center gap-1.5 text-sm">
                <Square className="w-3.5 h-3.5" /> Stop
              </button>
              <button onClick={() => action('restart')} disabled={!!actionLoading} className="btn-ghost flex items-center gap-1.5 text-sm">
                <RotateCcw className="w-3.5 h-3.5" /> Restart
              </button>
            </>
          ) : (
            <button onClick={() => action('start')} disabled={!!actionLoading || !bot.approved} className="btn-primary flex items-center gap-1.5 text-sm">
              <Play className="w-3.5 h-3.5" /> Start Bot
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Info card */}
        <div className="card p-5">
          <h3 className="font-display font-medium text-white mb-4 text-sm">Bot Info</h3>
          <dl className="space-y-2.5 text-sm font-sans">
            {[
              ['ID', bot.id],
              ['Source', bot.source],
              ['GitHub', bot.github_url || '—'],
              ['Phone', bot.phone || 'Not linked'],
              ['Session', bot.session_path?.split('/').pop() || '—'],
              ['Rate Limit', `${bot.max_msg_rate} msg/min`],
              ['Approved', bot.approved ? '✅ Yes' : '⏳ Pending'],
              ['Memory', bot.memory ? `${(bot.memory/1024/1024).toFixed(0)} MB` : '—'],
              ['CPU', bot.cpu != null ? `${bot.cpu}%` : '—'],
              ['Restarts', bot.restarts ?? '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-500 w-24 shrink-0">{k}</dt>
                <dd className="text-gray-200 truncate">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Env Vars */}
        <div className="card p-5">
          <h3 className="font-display font-medium text-white mb-4 text-sm">Environment Variables</h3>

          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {(bot.env_vars || []).length === 0 ? (
              <p className="text-gray-500 text-xs font-sans">No variables set</p>
            ) : bot.env_vars.map(({ key, value }) => (
              <div key={key} className="flex items-center gap-2 bg-dark-800 rounded-lg px-3 py-2">
                <code className="text-accent text-xs flex-1 truncate">{key}</code>
                <span className="text-gray-400 text-xs font-mono flex-1 truncate">
                  {maskedVars.has(key) ? value : '••••••••'}
                </span>
                <button onClick={() => setMaskedVars(p => { const n = new Set(p); p.has(key) ? n.delete(key) : n.add(key); return n; })}
                  className="text-dark-400 hover:text-gray-300 transition-colors">
                  {maskedVars.has(key) ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => deleteVar(key)} className="text-dark-400 hover:text-danger transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* Add new var */}
          <form onSubmit={addEnvVar} className="flex gap-2">
            <input className="input text-xs" value={newKey} onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="KEY_NAME" />
            <input className="input text-xs flex-1" value={newVal} onChange={e => setNewVal(e.target.value)} placeholder="value" />
            <button type="submit" className="btn-primary py-1.5 px-3 text-xs"><Plus className="w-3.5 h-3.5" /></button>
          </form>
        </div>

        {/* WhatsApp pairing hint */}
        {!bot.phone && (
          <div className="card p-5">
            <h3 className="font-display font-medium text-white mb-3 text-sm">WhatsApp Login</h3>
            <p className="text-gray-400 text-sm font-sans mb-4">
              To link WhatsApp, set the <code className="text-accent">PHONE_NUMBER</code> env var (e.g. <code className="text-accent">15551234567</code>) then start the bot. The pairing code will appear in the logs below.
            </p>
            <div className="bg-dark-800 rounded-lg p-3 text-xs font-mono text-gray-300 space-y-1">
              <p className="text-gray-500"># Set env var then start bot</p>
              <p>PHONE_NUMBER = 15551234567</p>
              <p className="text-gray-500"># Look for in logs:</p>
              <p className="text-accent">[bot-id] PAIRING CODE: XXXX-XXXX</p>
            </div>
            <p className="text-xs text-gray-500 mt-2 font-sans">Or set <code className="text-accent">USE_QR=true</code> for QR code mode (scan from logs)</p>
          </div>
        )}

        {/* Live log preview */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-medium text-white text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              Live Logs
            </h3>
            <Link href={`/logs?botId=${id}`} className="text-xs text-accent hover:underline font-sans flex items-center gap-1">
              <ScrollText className="w-3.5 h-3.5" /> Full logs
            </Link>
          </div>
          <div className="bg-dark-900 rounded-lg p-3 h-48 overflow-y-auto font-mono text-xs space-y-0.5">
            {recentLogs.length === 0
              ? <p className="text-dark-400">No log output yet. Start the bot to see logs.</p>
              : recentLogs.map((line, i) => (
                <div key={i} className={`${line.includes('ERROR') || line.includes('error') ? 'text-danger' : line.includes('PAIRING') ? 'text-accent font-bold' : 'text-gray-400'}`}>
                  {line}
                </div>
              ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(BotDetail);
