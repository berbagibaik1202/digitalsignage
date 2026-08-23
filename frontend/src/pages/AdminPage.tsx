import { useState, useEffect } from 'react';
import { Shield, Users, Tv, Image, Plus, Search, Edit, Trash2 } from 'lucide-react';
import api from '../lib/api';

interface Tenant {
  id: number;
  name: string;
  slug: string;
  contact_email: string | null;
  max_devices: number;
  max_storage_mb: number;
  registration_token: string | null;
  status: string;
  user_count: number;
  device_count: number;
  online_device_count: number;
  created_at: string;
}

interface Overview {
  tenants: { total: number; by_status: { status: string; count: number }[]; recent: { date: string; count: number }[] };
  users: { total: number };
  devices: { total: number; online: number };
  media: { total: number; total_size: number };
  subscriptions: { total: number; active: number };
}

export default function AdminPage() {
  const [tab, setTab] = useState<'overview' | 'tenants'>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Create/Edit form
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formMaxDevices, setFormMaxDevices] = useState(5);
  const [formMaxStorage, setFormMaxStorage] = useState(1024);

  useEffect(() => { loadData(); }, [tab, page, search, statusFilter]);

  async function loadData() {
    try {
      setLoading(true);
      if (tab === 'overview') {
        const res = await api.get('/admin/overview');
        setOverview(res.data);
      } else {
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set('search', search);
        if (statusFilter) params.set('status', statusFilter);
        const res = await api.get(`/admin/tenants?${params}`);
        console.log('Tenants API response:', res.data);
        setTenants(res.data?.data || []);
        setTotal(res.data?.total || 0);
      }
    } catch (err: any) {
      console.error('Load error:', err);
      alert('Gagal memuat data: ' + (err.response?.data?.error || err.message));
    } finally { setLoading(false); }
  }

  async function handleSaveTenant() {
    try {
      const data = {
        name: formName, slug: formSlug, contact_email: formEmail,
        max_devices: formMaxDevices, max_storage_mb: formMaxStorage,
      };
      if (editingTenant) {
        await api.put(`/admin/tenants/${editingTenant.id}`, data);
        alert('Tenant berhasil diupdate!');
      } else {
        const res = await api.post('/admin/tenants', data);
        const token = res.data.registration_token;
        alert(`Tenant berhasil dibuat!\n\nRegistration Token:\n${token}\n\nSimpan token ini untuk registrasi device.`);
      }
      setShowModal(false);
      setEditingTenant(null);
      resetForm();
      loadData();
    } catch (err: any) {
      alert('Error: ' + (err.response?.data?.error || 'Gagal menyimpan tenant'));
    }
  }

  async function handleDeleteTenant(id: number) {
    if (!confirm('Deactivate this tenant?')) return;
    try {
      await api.delete(`/admin/tenants/${id}`);
      alert('Tenant berhasil di-deactivate!');
      loadData();
    } catch (err: any) { alert('Error: ' + (err.response?.data?.error || 'Gagal menghapus tenant')); }
  }

  function openEditTenant(tenant: Tenant) {
    setEditingTenant(tenant);
    setFormName(tenant.name);
    setFormSlug(tenant.slug);
    setFormEmail(tenant.contact_email || '');
    setFormMaxDevices(tenant.max_devices);
    setFormMaxStorage(tenant.max_storage_mb);
    setShowModal(true);
  }

  function resetForm() {
    setFormName(''); setFormSlug(''); setFormEmail(''); setFormMaxDevices(5); setFormMaxStorage(1024);
  }

  function formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'ACTIVE': return 'bg-green-400/10 text-green-400';
      case 'INACTIVE': return 'bg-gray-400/10 text-gray-500';
      case 'SUSPENDED': return 'bg-red-400/10 text-red-400';
      default: return 'bg-gray-400/10 text-gray-400';
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-blue-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-gray-400 mt-1">Super admin — tenant management and global overview</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'overview' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Overview</button>
        <button onClick={() => setTab('tenants')} className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${tab === 'tenants' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>Tenants</button>
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : overview && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-blue-400" /><span className="text-sm text-gray-400">Tenants</span></div>
                  <p className="text-3xl font-bold text-white">{overview.tenants.total}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2"><Users className="w-5 h-5 text-green-400" /><span className="text-sm text-gray-400">Total Users</span></div>
                  <p className="text-3xl font-bold text-white">{overview.users.total}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2"><Tv className="w-5 h-5 text-purple-400" /><span className="text-sm text-gray-400">Devices</span></div>
                  <p className="text-3xl font-bold text-white">{overview.devices.total}</p>
                  <p className="text-xs text-green-400 mt-1">{overview.devices.online} online</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-2"><Image className="w-5 h-5 text-yellow-400" /><span className="text-sm text-gray-400">Media Storage</span></div>
                  <p className="text-3xl font-bold text-white">{formatBytes(overview.media.total_size)}</p>
                  <p className="text-xs text-gray-500 mt-1">{overview.media.total} files</p>
                </div>
              </div>

              {/* Tenant Status Breakdown */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Tenants by Status</h2>
                <div className="space-y-2">
                  {overview.tenants.by_status.map(s => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(s.status)}`}>{s.status}</span>
                      <span className="text-white font-medium">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tenants Tab */}
      {tab === 'tenants' && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" placeholder="Search tenants..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <button onClick={() => { resetForm(); setEditingTenant(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm font-medium">
              <Plus className="w-4 h-4" /> New Tenant
            </button>
          </div>

          {/* Tenants Table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Tenant</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Slug</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Status</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Users</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Devices</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-gray-400">Created</th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">Loading...</td></tr>
                ) : tenants.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">No tenants found</td></tr>
                ) : tenants.map(tenant => (
                  <tr key={tenant.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <div>
                        <span className="text-white font-medium">{tenant.name}</span>
                        {tenant.contact_email && <p className="text-xs text-gray-500">{tenant.contact_email}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">{tenant.slug}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(tenant.status)}`}>{tenant.status}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{tenant.user_count}</td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-400">{tenant.device_count}</span>
                      {tenant.online_device_count > 0 && <span className="ml-1 text-xs text-green-400">({tenant.online_device_count} on)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">{new Date(tenant.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => openEditTenant(tenant)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white" title="Edit"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTenant(tenant.id)} className="p-1.5 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-red-400" title="Deactivate"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-between">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Previous</button>
              <span className="text-sm text-gray-400">Page {page}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={tenants.length < 20} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 rounded-lg text-sm text-white">Next</button>
            </div>
          )}
        </>
      )}

      {/* Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">{editingTenant ? 'Edit Tenant' : 'New Tenant'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name *</label>
                <input type="text" value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Slug *</label>
                <input type="text" value={formSlug} onChange={e => setFormSlug(e.target.value)} disabled={!!editingTenant}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
                <input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Devices</label>
                  <input type="number" value={formMaxDevices} onChange={e => setFormMaxDevices(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Max Storage (MB)</label>
                  <input type="number" value={formMaxStorage} onChange={e => setFormMaxStorage(Number(e.target.value))} className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={handleSaveTenant} className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-medium">Save</button>
              <button onClick={() => { setShowModal(false); setEditingTenant(null); }} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
