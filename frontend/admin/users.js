// frontend/pages/admin/users.js
// Admin: view and toggle users

import useSWR from 'swr';
import { UserCheck, UserX } from 'lucide-react';
import { withAuth } from '../../lib/auth';
import { useAuth } from '../../lib/auth';
import { api } from '../../lib/api';
import Layout from '../../components/Layout';

function AdminUsers() {
  const { user: me } = useAuth();
  const { data: users, mutate } = useSWR('/admin/users', () => api.listUsers());

  if (me?.role !== 'admin') return <Layout title="Users"><p className="text-danger">Access denied</p></Layout>;

  async function toggle(id) {
    await api.toggleUser(id);
    mutate();
  }

  return (
    <Layout title="Users">
      <div className="card overflow-hidden">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="border-b border-dark-600">
              {['Email', 'Role', 'Joined', 'Status', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-gray-500 uppercase tracking-wider font-sans">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-dark-600">
            {(users || []).map(u => (
              <tr key={u.id} className="hover:bg-dark-600/30 transition-colors">
                <td className="px-4 py-3 text-white font-sans">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={u.role === 'admin' ? 'badge-green' : 'badge-gray'}>{u.role}</span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3">
                  <span className={u.active ? 'badge-green' : 'badge-red'}>{u.active ? 'Active' : 'Disabled'}</span>
                </td>
                <td className="px-4 py-3">
                  {u.email !== 'ibraheemyakub48@gmail.com' && (
                    <button onClick={() => toggle(u.id)}
                      className={`btn text-xs py-1 px-2 ${u.active ? 'btn-danger' : 'btn-ghost'}`}>
                      {u.active ? <><UserX className="w-3.5 h-3.5 inline" /> Disable</> : <><UserCheck className="w-3.5 h-3.5 inline" /> Enable</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

export default withAuth(AdminUsers);
