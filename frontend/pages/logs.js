// frontend/pages/logs.js
// Full-page log viewer with WebSocket streaming, bot selector, search filter

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import useSWR from 'swr';
import { Search, Trash2, ChevronDown } from 'lucide-react';
import { withAuth } from '../lib/auth';
import { api, getWsUrl } from '../lib/api';
import Layout from '../components/Layout';

function LogsPage() {
  const router = useRouter();
  const [selectedBotId, setSelectedBotId] = useState(router.query.botId || '');
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logRef = useRef(null);
  const wsRef = useRef(null);

  const { data: bots } = useSWR('/bots', () => api.listBots());

  // Connect WS whenever selectedBotId changes
  useEffect(() => {
    if (!selectedBotId) return;
    if (wsRef.current) wsRef.current.close();
    setLogs([]);
    setConnected(false);

    const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/^http/, 'ws');
    const ws = new WebSocket(`${baseUrl}/ws/logs`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', botId: selectedBotId, token: localStorage.getItem('token') }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'log') setLogs(prev => [...prev.slice(-999), msg.line]);
    };
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [selectedBotId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filtered = filter ? logs.filter(l => l.toLowerCase().includes(filter.toLowerCase())) : logs;

  function lineClass(line) {
    if (line.includes('ERROR') || line.includes('error') || line.includes('FATAL')) return 'text-danger';
    if (line.includes('WARN') || line.includes('warn')) return 'text-warn';
    if (line.includes('PAIRING CODE')) return 'text-accent font-bold';
    if (line.includes('Connected') || line.includes('online')) return 'text-green-400';
    return 'text-gray-400';
  }

  return (
    <Layout title="Logs">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {/* Bot selector */}
        <div className="relative">
          <select value={selectedBotId} onChange={e => setSelectedBotId(e.target.value)}
            className="input pr-8 appearance-none min-w-[200px] text-sm cursor-pointer">
            <option value="">— Select a bot —</option>
            {(bots || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={filter} onChange={e => setFilter(e.target.value)}
            className="input pl-8 text-sm" placeholder="Filter logs…" />
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 ml-auto">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-accent animate-pulse' : 'bg-dark-400'}`} />
          <span className="text-xs text-gray-500 font-sans">{connected ? 'Live' : 'Disconnected'}</span>
          <span className="text-xs text-gray-600 font-sans">· {filtered.length} lines</span>
        </div>

        <button onClick={() => setLogs([])} className="btn-ghost py-1.5 px-2 text-xs">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Log terminal */}
      <div className="card overflow-hidden h-[calc(100vh-200px)]">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-dark-600">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-danger/60" />
            <div className="w-3 h-3 rounded-full bg-warn/60" />
            <div className="w-3 h-3 rounded-full bg-accent/60" />
          </div>
          <span className="text-xs text-gray-600 font-sans">
            {selectedBotId ? bots?.find(b => b.id === selectedBotId)?.name || selectedBotId : 'No bot selected'}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-500 font-sans cursor-pointer">
            <input type="checkbox" checked={autoScroll} onChange={e => setAutoScroll(e.target.checked)} className="accent-accent" />
            Auto-scroll
          </label>
        </div>

        <div ref={logRef} onScroll={() => {
          if (!logRef.current) return;
          const { scrollTop, scrollHeight, clientHeight } = logRef.current;
          setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
        }}
          className="overflow-y-auto h-full p-4 font-mono text-xs space-y-0.5 bg-dark-900">
          {!selectedBotId ? (
            <p className="text-dark-400">Select a bot to stream its logs</p>
          ) : filtered.length === 0 ? (
            <p className="text-dark-400">No log output yet…</p>
          ) : filtered.map((line, i) => (
            <div key={i} className={`leading-5 break-all ${lineClass(line)}`}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default withAuth(LogsPage);
