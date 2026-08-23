import { useState, useEffect } from 'react';
import { Users, Tv, Image, ListMusic, Key, Copy, Check, Plus, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface TenantStats {
  users: { total: number };
  devices: { total: number; online: number };
  media: { total: number; total_size: number };
  playlists: { total: number };
  schedules: { total: number };
}

interface TenantUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

interface TenantDevice {
  id: number;
  device_uuid: string;
  name: string;
  status: string;
  last_seen_at: string | null;
}

export default function TenantDashboardPage() {
  const [tab, setTab] = useState<'overview' | 'users' | 'devices' | 'token'>('overview');
  const [stats, setStats] = useState<TenantStats | null>(null);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [devices, setDevices] = useState<TenantDevice[]>([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Add user form
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');

  useEffect(() => { loadData(); }, [tab]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'overview') {
        const res = await api.get('/tenant/dashboard');
        setStats(res.data);
      } else if (tab === 'users') {
        const res = await api.get('/tenant/users');
        setUsers(res.data?.data || []);
      } else if (tab === 'devices') {
        const res = await api.get('/tenant/devices');
        setDevices(res.data?.data || []);
      } else if (tab === 'token') {
        const res = await api.get('/tenant/token');
        setToken(res.data?.tenant?.registration_token || '');
      }
    } catch (err) {
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddUser() {
    if (!newUserEmail || !newUserPassword || !newUserName) {
      alert('Semua field wajib diisi');
      return;
    }
    try {
      await api.post('/tenant/users', {
        email: newUserEmail,
        password: newUserPassword,
        full_name: newUserName,
        role: newUserRole,
      });
      alert('User berhasil ditambahkan!');
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('viewer');
      loadData();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Gagal menambahkan user'));
    }
  }

  async function handleDeleteUser(id: number) {
    if (!confirm('Nonaktifkan user ini?')) return;
    try {
      await api.delete(`/tenant/users/${id}`);
      alert('User berhasil dinonaktifkan');
      loadData();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Gagal'));
    }
  }

  async function sendCommand(deviceId: number, cmd: string) {
    try {
      await api.post(`/tenant/devices/${deviceId}/command`, { command_type: cmd });
      alert(`Command ${cmd} berhasil dikirim!`);
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Gagal'));
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Tenant</h1>
        <p className="text-gray-400 mt-1">Kelola user, device, dan registration token</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        {[
          { key: 'overview', label: 'Overview', icon: LayoutDashboard },
          { key: 'users', label: 'Users', icon: Users },
          { key: 'devices', label: 'Devices', icon: Tv },
          { key: 'token', label: 'Token', icon: Key },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === t.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-blue-400" /><span className="text-sm text-gray-400">Users</span></div>
            <p className="text-3xl font-bold text-white">{stats?.users.total ?? 0}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><Tv className="w-5 h-5 text-green-400" /><span className="text-sm text-gray-400">Devices</span></div>
            <p className="text-3xl font-bold text-white">{stats?.devices.total ?? 0}</p>
            <p className="text-xs text-green-400 mt-1">{stats?.devices.online ?? 0} online</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><Image className="w-5 h-5 text-yellow-400" /><span className="text-sm text-gray-400">Media</span></div>
            <p className="text-3xl font-bold text-white">{stats?.media.total ?? 0}</p>
            <p className="text-xs text-gray-500 mt-1">{formatBytes(stats?.media.total_size ?? 0)}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2"><ListMusic className="w-5 h-5 text-purple-400" /><span className="text-sm text-gray-400">Playlists</span></div>
            <p className="text-3xl font-bold text-white">{stats?.playlists.total ?? 0}</p>
          </div>
        </div>
      )}

      {/* Users Tab */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowAddUser(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium">
              <Plus className="w-4 h-4" /> Tambah User
            </button>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Nama</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Email</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Role</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">Belum ada user</td></tr>
                ) : users.map(u => (
                  <tr key={u.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3 text-white">{u.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{u.email}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-blue-400/10 text-blue-400' : 'bg-gray-400/10 text-gray-400'}`}>{u.role}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.status === 'ACTIVE' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>{u.status}</span></td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Devices Tab */}
      {tab === 'devices' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Nama</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">UUID</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Last Seen</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Loading...</td></tr>
              ) : devices.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500">Belum ada device. Gunakan Registration Token untuk menambah device.</td></tr>
              ) : devices.map(d => (
                <tr key={d.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 text-white">{d.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-400 font-mono">{d.device_uuid.slice(0, 12)}...</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${d.status === 'ONLINE' ? 'bg-green-400/10 text-green-400' : 'bg-red-400/10 text-red-400'}`}>{d.status}</span></td>
                  <td className="px-4 py-3 text-sm text-gray-400">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}</td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => sendCommand(d.id, 'RELOAD')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300">Reload</button>
                    <button onClick={() => sendCommand(d.id, 'SCREENSHOT')} className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-300">Screenshot</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Token Tab */}
      {tab === 'token' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">🔑 Registration Token</h3>
          <p className="text-gray-400 text-sm mb-4">Gunakan token ini untuk mendaftarkan device baru (TV/Monitor)</p>

          {token ? (
            <>
              <div className="bg-gray-800 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-green-400 text-sm font-mono break-all">{token}</code>
                  <button onClick={copyToken} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white shrink-0">
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="bg-gray-800 rounded-lg p-4 space-y-2 text-sm">
                <p className="text-white font-medium">Cara Pakai:</p>
                <p className="text-gray-300">1. Buka Electron Player di TV/Monitor</p>
                <p className="text-gray-300">2. Masukkan Server URL dan Registration Token ini</p>
                <p className="text-gray-300">3. Device akan otomatis terdaftar</p>
              </div>
            </>
          ) : (
            <p className="text-gray-500">Token tidak tersedia</p>
          )}
        </div>
      )}

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Tambah User Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nama Lengkap *</label>
                <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email *</label>
                <input type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Password *</label>
                <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Role</label>
                <select value={newUserRole} onChange={e => setNewUserRole(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="viewer">Viewer (Lihat saja)</option>
                  <option value="editor">Editor (Kelola konten)</option>
                  <option value="admin">Admin (Kelola semua)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleAddUser} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Tambah</button>
              <button onClick={() => setShowAddUser(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Batal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Import for tabs
import { LayoutDashboard } from 'lucide-react';
