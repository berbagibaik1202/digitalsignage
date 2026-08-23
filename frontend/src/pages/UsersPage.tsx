import { useState, useEffect } from 'react';
import { Users, Plus, Search, Shield, Edit2, Trash2, X } from 'lucide-react';
import api from '../lib/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', password: '', full_name: '', role: 'viewer' });

  useEffect(() => { loadUsers(); }, [page, search]);

  async function loadUsers() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', String(page));
      if (search) params.set('search', search);
      const res = await api.get(`/users?${params}`);
      setUsers(res.data.data);
      setTotal(res.data.total);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingUser(null);
    setForm({ email: '', password: '', full_name: '', role: 'viewer' });
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditingUser(user);
    setForm({ email: user.email, password: '', full_name: user.full_name, role: user.role });
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          full_name: form.full_name,
          role: form.role,
        });
      } else {
        await api.post('/users', form);
      }
      setShowModal(false);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  async function handleDelete(userId: number) {
    if (!confirm('Deactivate this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed');
    }
  }

  function getRoleBadge(role: string) {
    const colors: Record<string, string> = {
      super_admin: 'text-red-400 bg-red-400/10',
      admin: 'text-orange-400 bg-orange-400/10',
      editor: 'text-blue-400 bg-blue-400/10',
      viewer: 'text-gray-400 bg-gray-400/10',
    };
    return colors[role] || colors.viewer;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-gray-400 mt-1">{total} user(s)</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">User</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Role</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
              <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Last Login</th>
              <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-500"><Users className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No users found</p></td></tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{user.full_name}</p>
                    <p className="text-sm text-gray-400">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(user.role)}`}>
                      <Shield className="w-3 h-3" /> {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm ${user.is_active ? 'text-green-400' : 'text-red-400'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-400">{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => openEdit(user)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(user.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 20 && (
        <div className="flex items-center justify-between">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
          <span className="text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={users.length < 20} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-96">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">{editingUser ? 'Edit User' : 'Create User'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Full Name</label>
                <input type="text" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} required
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Email</label>
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Password</label>
                    <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required
                      className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">
                {editingUser ? 'Update' : 'Create'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
