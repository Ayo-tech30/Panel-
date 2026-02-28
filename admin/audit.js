// frontend/pages/admin/audit.js
// Admin: view audit trail

import useSWR from 'swr';
import { withAuth } from '../../lib/auth';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import Layout from '../../components/Layout';

function AuditLogs() {
  const { user: me } = useAuth();
  const { data: logs } = useSWR('/admin/audit', () => api.auditLogs(), { refreshInterval: 10000 });

  if (me?.role !== 'admin') return <Layout title="Audit"><p className="text-danger">Access denied</p></Layout>;

  const actionColor = {
    login: 'badge-gray',
    create_bot: 'badge-green',
    start_bot: 'badge-green',
    stop_bot: 'badge-yellow',
    restart_bot: 'badge-yellow',
  };

  return (
    <Layout title="Audit Trail">
      <div className="card overflow-hidden">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="border-b border-dark-600">
              {['Time', 'User', 'Action', 'Target'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {(logs || []).map(log => (
              <tr key={log.id} className="hover:bg-dark-600/20">
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(log.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 text-white text-xs truncate max-w-[160px]">{log.email || '—'}</td>
                <td className="px-4 py-3"><span className={actionColor[log.action] || 'badge-gray'}>{log.action}</span></td>
                <td className="px-4 py-3 text-gray-500 text-xs font-mono truncate max-w-[160px]">{log.target_id || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export default withAuth(AuditLogs);
