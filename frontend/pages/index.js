// frontend/pages/index.js
// Dashboard: lists all bots, create new bot modal

import { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { Plus, Play, Square, RotateCcw, Trash2, ExternalLink, CheckCircle, Clock } from 'lucide-react';
import { withAuth } from '../lib/auth';
import { api } from '../lib/api';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';

function Dashboard() {
  const { data: bots, mutate, error } = useSWR('/bots', () => api.listBots(), { refreshInterval: 5000 });
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', source: 'template', github_url: '' });
  const [actionLoading, setActionLoading] = useState({});

  async function createBot(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createBot(form);
      setShowCreate(false);
      setForm({ name: '', source: 'template', github_url: '' });
      mutate();
    } catch (err) {
      alert(err.message);
    } finally { setCreating(false); }
  }

  async function botAction(id, action) {
    setActionLoading(p => ({ ...p, [`${id}-${action}`]: true }));
    try {
      await api[`${action}Bot`](id);
      mutate();
    } catch (err) { alert(err.message); }
    finally { setActionLoading(p => ({ ...p, [`${id}-${action}`]: false })); }
  }

  async function deleteBot(id, name) {
    if (!confirm(`Delete bot "${name}"? This cannot be undone.`)) return;
    await api.deleteBot(id);
    mutate();
  }

  const isRunning = (bot) => ['online', 'running'].includes(bot.pm2_status || bot.status);

  return (
    <Layout title="Dashboard">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-gray-500 text-sm font-sans">{bots?.length || 0} bot{bots?.length !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> New Bot
        </button>
      </div>

      {/* Bots grid */}
      {error && <div className="badge-red mb-4 px-4 py-2 rounded-lg">Failed to load bots</div>}

      {!bots ? (
        <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
      ) : bots.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-dark-600 rounded-2xl flex items-center justify-center mb-4">
            <Plus className="w-7 h-7 text-dark-400" />
          </div>
          <p className="text-white font-display font-medium mb-1">No bots yet</p>
          <p className="text-gray-500 text-sm mb-4 font-sans">Create your first WhatsApp bot to get started</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Create Bot</button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {bots.map(bot => (
            <div key={bot.id} className="card p-5 flex flex-col gap-4 hover:border-dark-400 transition-colors">
              {/* Top row */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display font-semibold text-white text-sm">{bot.name}</h3>
                  <p className="text-xs text-gray-500 font-sans mt-0.5 truncate max-w-[160px]">
                    {bot.source === 'github' ? bot.github_url : 'Template bot'}
                  </p>
                </div>
                <StatusBadge status={bot.status} pm2Status={bot.pm2_status} />
              </div>

              {/* Stats */}
              {(bot.memory || bot.cpu != null) && (
                <div className="flex gap-4 text-xs font-sans text-gray-500">
                  {bot.memory && <span>RAM: {(bot.memory / 1024 / 1024).toFixed(0)}MB</span>}
                  {bot.cpu != null && <span>CPU: {bot.cpu}%</span>}
                  {bot.restarts > 0 && <span className="text-warn">↺ {bot.restarts}</span>}
                </div>
              )}

              {/* Pending approval badge */}
              {!bot.approved && (
                <div className="badge-yellow text-xs">
                  <Clock className="w-3 h-3" /> Awaiting admin approval
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-dark-600">
                {isRunning(bot) ? (
                  <>
                    <button onClick={() => botAction(bot.id, 'stop')}
                      disabled={actionLoading[`${bot.id}-stop`]}
                      className="btn-ghost flex items-center gap-1 text-xs py-1.5">
                      <Square className="w-3 h-3" /> Stop
                    </button>
                    <button onClick={() => botAction(bot.id, 'restart')}
                      disabled={actionLoading[`${bot.id}-restart`]}
                      className="btn-ghost flex items-center gap-1 text-xs py-1.5">
                      <RotateCcw className="w-3 h-3" /> Restart
                    </button>
                  </>
                ) : (
                  <button onClick={() => botAction(bot.id, 'start')}
                    disabled={actionLoading[`${bot.id}-start`] || !bot.approved}
                    className="btn-primary flex items-center gap-1 text-xs py-1.5">
                    <Play className="w-3 h-3" /> Start
                  </button>
                )}

                <div className="flex-1" />

                <Link href={`/bots/${bot.id}`} className="btn-ghost py-1.5 px-2 text-xs">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <button onClick={() => deleteBot(bot.id, bot.name)} className="btn-danger py-1.5 px-2 text-xs">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Bot Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card w-full max-w-md p-6 animate-slide-up">
            <h2 className="font-display font-semibold text-white mb-5">Create New Bot</h2>
            <form onSubmit={createBot} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-sans uppercase tracking-wider">Bot Name</label>
                <input className="input" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                  placeholder="My Support Bot" required />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 font-sans uppercase tracking-wider">Source</label>
                <div className="flex gap-2">
                  {['template', 'github'].map(s => (
                    <button type="button" key={s} onClick={() => setForm(p => ({...p, source: s}))}
                      className={`flex-1 py-2 rounded-lg text-sm font-sans border transition-all
                        ${form.source === s ? 'border-accent/50 bg-accent/10 text-accent' : 'border-dark-400 text-gray-400 hover:border-dark-300'}`}>
                      {s === 'template' ? '📦 Template' : '🐙 GitHub'}
                    </button>
                  ))}
                </div>
                {form.source === 'github' && (
                  <p className="text-xs text-warn mt-1.5 font-sans">⚠️ GitHub bots require admin approval before starting</p>
                )}
              </div>
              {form.source === 'github' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5 font-sans uppercase tracking-wider">GitHub URL</label>
                  <input className="input" value={form.github_url} onChange={e => setForm(p => ({...p, github_url: e.target.value}))}
                    placeholder="https://github.com/user/repo" type="url" />
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? 'Creating…' : 'Create Bot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default withAuth(Dashboard);
